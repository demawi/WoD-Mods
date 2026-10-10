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
 * Bei createNew und connect wird einmalig meta/accessAt mit der Firebase-
 * Serverzeit aktualisiert.
 */
const WODB_FIREBASE_DATABASE_URL = "https://wodb-f27cf-default-rtdb.europe-west1.firebasedatabase.app";
const FIREBASE_SERVER_TIMESTAMP = { ".sv": "timestamp" };

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
    }

    getId() {
        return this.repoId;
    }

    getName() {
        return this.repoName;
    }

    async updateAccessTimestamp() {
        return this.set("meta/accessAt", FIREBASE_SERVER_TIMESTAMP);
    }

    updateAccessTimestampInBackground() {
        this.updateAccessTimestamp().catch(error => {
            console.error("Firebase-Zugriffszeitpunkt konnte nicht aktualisiert werden.", error);
        });
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

    async request(path, method, body) {
        const url = this.createUrl(path);
        const options = {
            method,
            headers: {
                Accept: "application/json",
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
                throw new Error(`Firebase lieferte ungültiges JSON zurück (${response.status}).`, { cause: error });
            }
        }
        if (!response.ok) {
            const details = responseBody && responseBody.error ? `: ${responseBody.error}` : "";
            throw new Error(`Firebase-Anfrage fehlgeschlagen (${response.status})${details}`);
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
    static async createNew(repoType, repoName, characterId) {
        if (typeof repoType !== "string" || repoType === "") {
            throw new TypeError("Ein Repository-Typ ist erforderlich.");
        }
        if (typeof repoName !== "string" || repoName.trim() === "") {
            throw new TypeError("Ein Repository-Name ist erforderlich.");
        }

        const repository = new FirebaseGroupRepository(
            FirebaseGroupRepository.createId(),
            repoType,
            repoName.trim()
        );
        await repository.set("", {
            repoType: repository.repoType,
            name: repository.getName(),
            createdAt: new Date().toISOString(),
        });
        if (characterId !== undefined) {
            await FirebaseGroupRepository.saveConnection(repoType, characterId, repository.getId());
        }
        repository.updateAccessTimestampInBackground();
        return repository;
    }

    static async connect(repoType, repoId, characterId) {
        if (typeof repoType !== "string" || repoType === "") {
            throw new TypeError("Ein Repository-Typ ist erforderlich.");
        }

        if (repoId === undefined) {
            repoId = await FirebaseGroupRepository.loadConnection(repoType, characterId);
        }

        if (typeof repoId !== "string" || repoId === "") {
            throw new Error(`Keine Repository-ID für ${FirebaseGroupRepository.storageKey(repoType, characterId)} übergeben oder gespeichert.`);
        }
        if (characterId !== undefined) {
            await FirebaseGroupRepository.saveConnection(repoType, characterId, repoId);
        }
        const repository = new FirebaseGroupRepository(repoId, repoType);
        repository.updateAccessTimestampInBackground();
        return repository;
    }
}

if (typeof globalThis !== "undefined") {
    globalThis.WODB_FIREBASE_DATABASE_URL = WODB_FIREBASE_DATABASE_URL;
    globalThis.FirebaseGroupRepository = FirebaseGroupRepository;
    globalThis.firebase = firebase;
}
