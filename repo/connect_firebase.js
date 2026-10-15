/**
 * Verbindung zum WoDb-Projekt und Zugriff auf eine gemeinsame Gruppe.
 *
 * Eine Gruppe wird ohne Anmeldung über ihre kryptische ID identifiziert.
 * Wer die ID kennt, kann auf die Gruppe zugreifen.
 *
 * Beispiel:
 *   const groupRepo = await firebase.createNew("group", "Freizeit-Helden", characterId);
 *   console.log(groupRepo.getId());
 *
 *   const sameGroup = await firebase.connect("group", group.getId(), characterId);
 *   await sameGroup.set("items/example", { value: 1 });
 *
 * Bei createNew und connect wird einmalig meta/access/<characterId> mit
 * Heldname und Firebase-Serverzeit aktualisiert.
 */
const WODB_FIREBASE_DATABASE_URL = "https://wodb-f27cf-default-rtdb.europe-west1.firebasedatabase.app";
const FIREBASE_SERVER_TIMESTAMP = {".sv": "timestamp"};

class FirebaseGroupRepository {
    constructor(repoId, repoType, repoName, databaseUrl = WODB_FIREBASE_DATABASE_URL) {
        if (typeof repoId !== "string" || repoId === "") {
            throw new TypeError("Eine Repository-ID ist erforderlich.");
        }
        if (typeof repoType !== "string" || repoType === "") {
            throw new TypeError("Ein Repository-Typ ist erforderlich.");
        }
        if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") {
            throw new TypeError("Eine Firebase-Realtime-Database-URL ist erforderlich.");
        }

        this.repoId = repoId;
        this.repoType = repoType;
        this.repoName = repoName;
        this.databaseUrl = databaseUrl.replace(/\/+$/, "");
        this.ready = Promise.resolve();
        this.accessUpdatePromise = Promise.resolve();
    }

    getId() {
        return this.repoId;
    }

    getName() {
        return this.repoName;
    }

    async updateAccessTimestamp(characterId, characterName) {
        if (typeof characterId !== "string" || characterId === "") {
            throw new TypeError("Eine Held-ID ist für die Zugriffserfassung erforderlich.");
        }
        return this.set(`meta/access/${characterId}`, {
            name: typeof characterName === "string" ? characterName : "",
            accessAt: FIREBASE_SERVER_TIMESTAMP,
        });
    }

    updateAccessTimestampInBackground(characterId, characterName) {
        this.accessUpdatePromise = this.updateAccessTimestamp(characterId, characterName).catch(error => {
            console.error("Firebase-Zugriffszeitpunkt konnte nicht aktualisiert werden.", error);
        });
        return this.accessUpdatePromise;
    }

    async get(path) {
        await this.ready;
        return this.request(path, "GET");
    }

    async set(path, value) {
        await this.ready;
        return this.request(path, "PUT", value);
    }

    async update(path, values) {
        await this.ready;
        if (!values || typeof values !== "object" || Array.isArray(values)) {
            throw new TypeError("Firebase-Updates müssen als Objekt übergeben werden.");
        }
        return this.request(path, "PATCH", values);
    }

    async push(path, value) {
        await this.ready;
        return this.request(path, "POST", value);
    }

    async remove(path) {
        await this.ready;
        return this.request(path, "DELETE");
    }

    async request(path, method, body, headers = {}) {
        const url = this.createUrl(path);
        const options = {
            method,
            headers: {
                Accept: "application/json",
                ...headers,
            },
        };

        if (body !== undefined) {
            options.headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const responseText = await response.text();
        let responseBody;

        if (responseText !== "") {
            try {
                responseBody = JSON.parse(responseText);
            } catch (error) {
                throw new Error(`Firebase lieferte ungültiges JSON zurück (${response.status}).`, {cause: error});
            }
        }
        if (!response.ok) {
            const details = responseBody && responseBody.error ? `: ${responseBody.error}` : "";
            const error = new Error(`Firebase-Anfrage fehlgeschlagen (${response.status})${details}`);
            error.status = response.status;
            throw error;
        }
        return responseBody;
    }

    createUrl(path) {
        if (typeof path !== "string") {
            throw new TypeError("Der Firebase-Pfad muss eine Zeichenkette sein.");
        }
        const normalizedPath = path
            .split("/")
            .filter(part => part !== "")
            .map(part => encodeURIComponent(part))
            .join("/");
        return `${this.databaseUrl}/${encodeURIComponent(this.repoId)}${normalizedPath ? `/${normalizedPath}` : ""}.json`;
    }

    static createId() {
        const bytes = new Uint8Array(18);
        crypto.getRandomValues(bytes);
        return btoa(String.fromCharCode(...bytes))
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/g, "");
    }

    static storageKey(repoType, characterId) {
        return `wodb.${repoType}.${characterId}`;
    }

    static async saveConnection(repoType, characterId, repoId) {
        const key = this.storageKey(repoType, characterId);
        if (typeof GM_setValue === "function") {
            await GM_setValue(key, repoId);
        } else if (typeof GM !== "undefined" && typeof GM.setValue === "function") {
            await GM.setValue(key, repoId);
        } else {
            throw new Error("Keine GM-Speicherfunktion verfügbar (GM_setValue oder GM.setValue).");
        }
    }

    static async loadConnection(repoType, characterId) {
        const key = this.storageKey(repoType, characterId);
        if (typeof GM_getValue === "function") {
            return await GM_getValue(key);
        }
        if (typeof GM !== "undefined" && typeof GM.getValue === "function") {
            return await GM.getValue(key);
        }
        throw new Error("Keine GM-Lesefunktion verfügbar (GM_getValue oder GM.getValue).");
    }
}

class firebase {
    static createRepositoryUi(repoType, onRepositoryConnected) {
        const repository = typeof demawiRepository !== "undefined"
            ? demawiRepository
            : undefined;
        if (!repository || !repository.WoD) {
            throw new Error("Die WoD-Datenquelle ist für die Repository-UI nicht verfügbar.");
        }

        const characterId = repository.WoD.getMyHeroId();
        const characterName = repository.WoD.getMyHeroName() || "Unbekannter Held";
        const repoName = repository.WoD.getCurrentGroupName() || "";
        const container = document.createElement("div");
        container.className = "layout_clear";

        const status = document.createElement("span");
        status.textContent = "Verbindung wird geprüft ...";
        container.append(status);

        const actionsButton = document.createElement("input");
        actionsButton.type = "button";
        actionsButton.value = "v";
        actionsButton.className = "button clickable";
        actionsButton.title = "Repository-Aktionen anzeigen";
        actionsButton.style.marginLeft = "8px";
        container.append(actionsButton);

        const actions = document.createElement("div");
        actions.style.display = "none";
        actions.style.marginTop = "8px";
        container.append(actions);

        const form = document.createElement("div");
        form.style.marginBottom = "8px";
        const repoIdInput = document.createElement("input");
        repoIdInput.type = "text";
        repoIdInput.placeholder = "Gruppen-ID";
        repoIdInput.size = 28;
        form.append(repoIdInput);

        const connectButton = document.createElement("input");
        connectButton.type = "button";
        connectButton.value = "Verbinden";
        connectButton.className = "button clickable";
        form.append(connectButton);

        const createButton = document.createElement("input");
        createButton.type = "button";
        createButton.value = "Neue Gruppenverbindung anlegen";
        createButton.className = "button clickable";
        form.append(createButton);
        actions.append(form);

        const details = document.createElement("div");
        actions.append(details);

        actionsButton.addEventListener("click", () => {
            actions.style.display = actions.style.display === "none" ? "block" : "none";
        });

        const renderRepository = async repository => {
            await repository.accessUpdatePromise;
            const data = await repository.get("");
            repoIdInput.value = repository.getId();
            status.textContent = `Gruppenverbindung: ${data && data.name ? data.name : repository.getId()}`;
            actions.style.display = "none";
            details.replaceChildren();

            const access = data && data.meta && data.meta.access ? data.meta.access : {};
            const entries = Object.values(access);
            if (entries.length === 0) {
                details.textContent = "Noch keine Zugriffe erfasst.";
                return;
            }

            const table = document.createElement("table");
            table.className = "content_table";
            const header = table.insertRow();
            header.className = "header";
            header.insertCell().textContent = "Held";
            header.insertCell().textContent = "Letzter Zugriff";
            for (const entry of entries) {
                const row = table.insertRow();
                row.insertCell().textContent = entry.name || "Unbekannter Held";
                row.insertCell().textContent = entry.accessAt
                    ? new Date(entry.accessAt).toLocaleString()
                    : "unbekannt";
            }
            details.append(table);
        };

        const connect = async repoId => {
            status.textContent = "Verbindung wird hergestellt ...";
            try {
                const repository = await firebase.connect(repoType, repoId, characterId, characterName);
                    container.repository = repository;
                    if (typeof onRepositoryConnected === "function") {
                        await onRepositoryConnected(repository);
                    }
                    await renderRepository(repository);
            } catch (error) {
                status.textContent = `Keine Verbindung: ${error.message}`;
                console.error("Repository konnte nicht verbunden werden.", error);
            }
        };

        connectButton.addEventListener("click", () => {
            const repoId = repoIdInput.value.trim();
            if (repoId === "") {
                status.textContent = "Gruppenverbindung: Bitte eine Gruppen-ID eingeben.";
                return;
            }
            connect(repoId);
        });

        createButton.addEventListener("click", async () => {
            status.textContent = "Repository wird angelegt ...";
            try {
                const repository = await firebase.createNew(repoType, repoName, characterId, characterName);
                container.repository = repository;
                if (typeof onRepositoryConnected === "function") {
                    await onRepositoryConnected(repository);
                }
                await renderRepository(repository);
            } catch (error) {
                status.textContent = `Repository konnte nicht angelegt werden: ${error.message}`;
                console.error("Repository konnte nicht angelegt werden.", error);
            }
        });

        container.ready = (async () => {
            try {
                const repository = await firebase.connect(repoType, undefined, characterId, characterName);
                container.repository = repository;
                if (typeof onRepositoryConnected === "function") {
                    await onRepositoryConnected(repository);
                }
                await renderRepository(repository);
            } catch (error) {
                status.textContent = "Gruppenverbindung: Nicht verbunden";
            }
        })();
        return container;
    }

    static async createNew(repoType, repoName, characterId, characterName) {
        if (typeof repoType !== "string" || repoType === "") {
            throw new TypeError("Ein Repository-Typ ist erforderlich.");
        }
        repoName = typeof repoName === "string" ? repoName.trim() : "";

        let repository;
        let created = false;
        for (let attempt = 0; attempt < 5 && !created; attempt++) {
            repository = new FirebaseGroupRepository(
                FirebaseGroupRepository.createId(),
                repoType,
                repoName
            );
            try {
                await repository.request("", "PUT", {
                    repoType: repository.repoType,
                    name: repository.getName(),
                    createdAt: new Date().toISOString(),
                }, {"If-Match": "null"});
                created = true;
            } catch (error) {
                if (error.status !== 412) {
                    throw error;
                }
            }
        }
        if (!created) {
            throw new Error("Das neue Repository konnte nach mehreren Versuchen nicht angelegt werden.");
        }
        if (characterId !== undefined) {
            await FirebaseGroupRepository.saveConnection(repoType, characterId, repository.getId());
            repository.updateAccessTimestampInBackground(characterId, characterName);
        }
        return repository;
    }

    static async connect(repoType, repoId, characterId, characterName) {
        if (typeof repoType !== "string" || repoType === "") {
            throw new TypeError("Ein Repository-Typ ist erforderlich.");
        }

        if (repoId === undefined) {
            repoId = await FirebaseGroupRepository.loadConnection(repoType, characterId);
        }

        if (typeof repoId !== "string" || repoId === "") {
            throw new Error(`Keine Repository-ID für ${FirebaseGroupRepository.storageKey(repoType, characterId)} übergeben oder gespeichert.`);
        }
        const repository = new FirebaseGroupRepository(repoId, repoType);
        const existingData = await repository.get("");
        if (!existingData || typeof existingData !== "object"
            || existingData.repoType !== repoType
            || typeof existingData.name !== "string") {
            throw new Error("Das Repository existiert nicht oder besitzt keine gültigen Metadaten. Bitte eine gültige Gruppen-ID verwenden oder eine neue Gruppe anlegen.");
        }
        if (characterId !== undefined) {
            await FirebaseGroupRepository.saveConnection(repoType, characterId, repoId);
        }
        if (characterId !== undefined) {
            repository.updateAccessTimestampInBackground(characterId, characterName);
        }
        return repository;
    }
}

if (typeof globalThis !== "undefined") {
    globalThis.WODB_FIREBASE_DATABASE_URL = WODB_FIREBASE_DATABASE_URL;
    globalThis.FirebaseGroupRepository = FirebaseGroupRepository;
    globalThis.firebase = firebase;
}
