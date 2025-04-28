/**
 * WoD-spezifische (WoD-Klasse) und WoD-spezifische technische Klassen mit entsprechenden Hilfsmethoden.
 */
class demawiRepository {

    static version = "1.0.4";

    static import(type, version) {
        return this[type];
    }

    /**
     * Speichert zusätzlich Klasseninformationen von Objekten. Dafür wird ein zusätzliches "_class"-Attribut zu den Objekten gespeichert.
     * Beim Laden werden die Objekte entsprechend wieder hergestellt.
     */
    static JSON2 = class {
        static stringify(object, objectChanger) {
            if (Array.isArray(object)) {
                let result = "[";
                for (let idx = 0; idx < object.length; idx++) {
                    if (result.length > 1) result += ",";
                    result += this.stringify(object[idx], objectChanger);
                }
                return result + "]";
            } else if (typeof object === "object") {
                if (object === null) {
                    return JSON.stringify(object);
                } else if (object.constructor) {
                    if (objectChanger) object = objectChanger(object);
                    let result = "{";
                    for (const key in object) {
                        const value = object[key];
                        if (value === undefined || typeof value === "function") continue;
                        if (result.length > 1) result += ",";
                        result += "\"" + key + "\":" + this.stringify(value, objectChanger);
                    }
                    if (result.length > 1) result += ",";
                    result += "\"_class\":" + JSON.stringify(object.constructor.name);
                    return result + "}";
                } else {
                    let result = "{";
                    for (const key in object) {
                        const value = object[key];
                        if (value === undefined || typeof value === "function") continue;
                        if (result.length > 1) result += ",";
                        result += "\"" + key + "\":" + this.stringify(value, objectChanger);
                    }
                    return result + "}";
                }
            } else {
                return JSON.stringify(object);
            }
        }

        /**
         * Zunächst werden die Objekte per Standard-JSON wieder hergestellt. Danach wird
         * toObjects aufgerufen.
         */
        static parse(json, objectFactory) {
            const jsonParse = unsafeWindow.JSON.parse(json);
            return this.toObjects(jsonParse, objectFactory || {});
        }

        /**
         * Wertet das zusätzlichen "_class"-Attribut aus und ersetzt die Standard-Objekten mit
         * den entsprechend instanziierten Objekten.
         * Die 'objectFactory' bietet die Möglichkeit beim Auswerten des "_class"-Attributs, selbst
         * die Instanziierung vorzunehmen.
         */
        static toObjects(object, objectFactory) {
            if (Array.isArray(object)) {
                for (let idx = 0; idx < object.length; idx++) {
                    object[idx] = this.toObjects(object[idx], objectFactory);
                }
            } else if (typeof object === "object") {
                if (!object) {
                    // nothing to do
                } else if (object._class) {
                    if (objectFactory[object._class]) {
                        const [newObject, finishParsing] = objectFactory[object._class](object);
                        if (finishParsing) return newObject;
                    }
                    // Über die ObjektFactory wurde kein neues Objekt erzeugt...
                    let newObject;
                    try {
                        newObject = eval("new " + object._class + "()");
                    } catch (e) {
                        newObject = unsafeWindow.eval("new " + object._class + "()");
                    }
                    for (const key in object) {
                        if (key === "_class") continue;
                        newObject[key] = this.toObjects(object[key], objectFactory);
                    }
                    return newObject;
                } else {
                    for (const key in object) {
                        object[key] = this.toObjects(object[key], objectFactory);
                    }
                }
            } else {
                // nothing to do
            }
            return object;
        }

        static toObject(object) {

        }
    }

    /**
     * Hilfemethoden für Down- und Uploads
     */
    static File = class {
        static jszip_loaded = false;

        static async getJSZip() {
            const thisObject = this;
            return new Promise((result, reject) => {
                if (thisObject.jszip_loaded) {
                    result(new JSZip());
                } else {
                    thisObject.jszip_loaded = true;
                    //xmlHttp.open("GET", "https://raw.githubusercontent.com/Stuk/jszip/refs/heads/main/dist/jszip.min.js", false); // false for synchronous request
                    var xmlHttp = new XMLHttpRequest();
                    xmlHttp.open("GET", "https://raw.githubusercontent.com/demawi/WoD-Mods/refs/heads/master/libs/jszip.min.js", false); // false for synchronous request
                    xmlHttp.send(null);
                    unsafeWindow.eval(xmlHttp.responseText);
                    console.log("JSZip loaded: " + JSZip.version);
                    result(new JSZip());
                }
            });
        }

        static forDownload(filename, data) {
            const blob = new Blob([data], {type: 'text/plain'});
            const fileURL = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = fileURL;
            downloadLink.download = filename;
            downloadLink.click();
            URL.revokeObjectURL(fileURL);
        }

        static createDownloadLink(filename, data) {
            const blob = new Blob([data], {type: 'text/plain'});
            const downloadLink = document.createElement('a');
            downloadLink.href = window.URL.createObjectURL(blob);
            downloadLink.download = filename;
            downloadLink.dataset.downloadurl = ['text/plain', downloadLink.download, downloadLink.href].join(':');
            downloadLink.draggable = true;
            return downloadLink;
        }

        static async createUploadForRead() {

            return new Promise((result, reject) => {
                const fileInput = document.createElement("input");
                fileInput.type = "file";
                fileInput.onchange = function () {
                    const file = fileInput.files[0];
                    const reader = new FileReader();
                    reader.onload = function () {
                        result(reader.result);
                    };
                    reader.readAsText(file);
                }
                fileInput.click();
            })
            //return result;
        }
    }

    /**
     * WoD-DBs:
     * Inhaber:
     * ItemDatenbank (wodDB.items[w], wodDB.itemSources[w])
     * KampfberichtArchiv (wodDB.reportSources[w], wodDB.reportSourcesMeta[w])
     * ErweiterteKampfstatistik (wodDB.reportStats[w])
     *
     * Lesend:
     *
     */
    static Storages = class {

        static IndexedDb = class {
            modname;
            dbname;
            objectStores = [];
            objectStoresToDelete = [];
            dbConnection;
            static requestIdx = 0; // only for debugging

            constructor(modname, dbname) {
                this.modname = modname;
                this.dbname = dbname;
            }

            /**
             * Kopiert die aktuelle Datenbank komplett in eine andere Datenbank.
             * @param dbNameTo
             * @returns {Promise<void>}
             */
            async cloneTo(dbNameTo) {
                console.log("Clone " + this.dbname + " to " + dbNameTo + "...");
                const dbTo = new demawiRepository.Storages.IndexedDb(this.modname, dbNameTo);
                const dbConnectionFrom = await this.getConnection();
                const objectStoreNames = dbConnectionFrom.objectStoreNames; // Array
                const objectStoresRead = [];
                const objectStoresWrite = [];
                for (const objectStoreName of objectStoreNames) {
                    let transactionFrom = dbConnectionFrom.transaction(objectStoreName, "readonly");
                    let objectStoreFrom = transactionFrom.objectStore(objectStoreName);
                    dbTo.createObjectStore(objectStoreName, objectStoreFrom.keyPath);
                    const readFrom = new demawiRepository.Storages.ObjectStorage(objectStoreName, objectStoreFrom.keyPath, null, true);
                    readFrom.indexedDb = this;
                    const writeTo = new demawiRepository.Storages.ObjectStorage(objectStoreName, objectStoreFrom.keyPath, null, false);
                    writeTo.indexedDb = dbTo;
                    objectStoresRead.push(readFrom);
                    objectStoresWrite.push(writeTo);
                }
                for (var i = 0, l = objectStoresRead.length; i < l; i++) {
                    let readFrom = objectStoresRead[i];
                    let writeTo = objectStoresWrite[i];
                    for (const cur of await readFrom.getAll()) {
                        await writeTo.setValue(cur);
                    }
                }
                console.log("Clone " + this.dbname + " to " + dbNameTo + "... finished!");
            }

            /**
             * Exportiert alle Objekte aus allen Object-Stores in ein JSON-Resultat.
             * {
             *     store1: [
             *
             *     ],
             *     store2: [
             *
             *     ]
             * }
             */
            async exportToJson(storeNames) {
                const idbDatabase = await this.getConnection();
                return new Promise((resolve, reject) => {
                    const exportObject = {}
                    if (idbDatabase.objectStoreNames.length === 0) {
                        resolve(JSON.stringify(exportObject))
                    } else {
                        const transaction = idbDatabase.transaction(
                            idbDatabase.objectStoreNames,
                            'readonly'
                        )

                        transaction.addEventListener('error', reject);
                        let storeNamesToLoad = [];
                        if (!storeNames) storeNamesToLoad = idbDatabase.objectStoreNames;
                        else {
                            for (const storeName of idbDatabase.objectStoreNames) {
                                if (storeNames.includes(storeName)) {
                                    storeNamesToLoad.push(storeName);
                                }
                            }
                        }
                        console.log("StoresToLoad: ", storeNamesToLoad);

                        for (const storeName of storeNamesToLoad) {
                            const allObjects = []
                            transaction
                                .objectStore(storeName)
                                .openCursor()
                                .addEventListener('success', event => {
                                    const cursor = event.target.result
                                    if (cursor) {
                                        // Cursor holds value, put it into store data
                                        allObjects.push(cursor.value)
                                        cursor.continue()
                                    } else {
                                        // No more values, store is done
                                        exportObject[storeName] = allObjects

                                        // Last store was handled
                                        if (storeNamesToLoad.length === Object.keys(exportObject).length) {
                                            resolve(_.util.JSONstringify(exportObject));
                                        }
                                    }
                                })
                        }
                    }
                })
            }

            /**
             * Import ein JSON-Objekt komplett in die Objekt-Stores.
             */
            async importFromJson(json) {
                const idbDatabase = await this.getConnection();
                return new Promise((resolve, reject) => {
                    const transaction = idbDatabase.transaction(
                        idbDatabase.objectStoreNames,
                        'readwrite'
                    )
                    transaction.addEventListener('error', reject)

                    var importObject = JSON.parse(json)
                    for (const storeName of idbDatabase.objectStoreNames) {
                        let count = 0
                        for (const toAdd of importObject[storeName]) {
                            const request = transaction.objectStore(storeName).add(toAdd)
                            request.addEventListener('success', () => {
                                count++;
                                if (count === importObject[storeName].length) {
                                    // Added all objects for this store
                                    delete importObject[storeName]
                                    if (Object.keys(importObject).length === 0) {
                                        // Added all object stores
                                        resolve()
                                    }
                                }
                            })
                        }
                    }
                })
            }

            async clearDatabase() {
                const idbDatabase = await this.getConnection();
                return new Promise((resolve, reject) => {
                    const transaction = idbDatabase.transaction(
                        idbDatabase.objectStoreNames,
                        'readwrite'
                    )
                    transaction.addEventListener('error', reject)

                    let count = 0
                    for (const storeName of idbDatabase.objectStoreNames) {
                        transaction
                            .objectStore(storeName)
                            .clear()
                            .addEventListener('success', () => {
                                count++
                                if (count === idbDatabase.objectStoreNames.length) {
                                    // Cleared all object stores
                                    resolve()
                                }
                            })
                    }
                })
            }

            /**
             * Sofern nicht vorhanden wird der Object-Store erstellt.
             */
            createObjectStore(storageId, key, indizes) {
                let readonly = false;
                if (indizes === true) {
                    indizes = null;
                    readonly = true;
                }
                let objectStore = new demawiRepository.Storages.ObjectStorage(storageId, key, indizes, readonly);
                objectStore.indexedDb = this;
                this.objectStores.push(objectStore);
                return objectStore;
            }

            deleteObjectStore(storageId) {
                this.objectStoresToDelete.push(storageId);
            }

            async getConnection() {
                if (this.dbConnection) return this.dbConnection;
                this.dbConnection = await this.dbConnect();
                let thisObject = this;
                // wenn sich die Datenbank-Version durch eine andere Seite verändert hat
                this.dbConnection.onversionchange = function (event) {
                    if (!thisObject.areAllObjectStoresSynced(thisObject.dbConnection)) {
                        thisObject.dbConnection.close();
                        thisObject.dbConnection = null;
                        alert("Die IndexDB hat sich geändert! (" + thisObject.modname + ") Bitte die Seite einmal neuladen! (versionchange)");
                    } else { // Das Schema hat sich nicht verändert, wir können also ungehindert weitermachen, wenn wir nur neu verbinden.
                        thisObject.dbConnection.close();
                        thisObject.dbConnection = null;
                        thisObject.getConnection();
                    }
                };
                return this.dbConnection;
            }

            closeConnection(request, dbConnection) {
                delete request.onerror;
                delete request.onblocked;
                delete request.onupgradeneeded;
                delete dbConnection.onversionchange;
                dbConnection.close();
            }

            async dbConnect(version) {
                const thisObject = this;
                return new Promise((resolve, reject) => {
                    var request = indexedDB.open(thisObject.dbname, version);
                    request.idx = demawiRepository.Storages.IndexedDb.requestIdx++;
                    console.log("request created " + request.idx + "_" + version);
                    request.onsuccess = function (event) {
                        let dbConnection = event.target.result;
                        let needNewStores = !thisObject.areAllObjectStoresSynced(dbConnection);
                        console.log("DBconnect success! (" + thisObject.dbname + ") Need update: " + needNewStores, event);
                        if (needNewStores) {
                            thisObject.closeConnection(request, dbConnection);
                            resolve(thisObject.dbConnect(new Date().getTime())); // force upgrade
                        } else {
                            resolve(event.target.result);
                        }
                    }
                    request.onerror = function (event) {
                        console.log("DBconnect error", event);
                        reject();
                    }
                    request.onblocked = function () {
                        console.log("DBconnect blocked", request.idx, event);
                        alert("Die IndexDB hat sich geändert! (" + thisObject.modname + ") Bitte die Seite einmal neuladen! (blocked)");
                        reject();
                    }
                    request.onupgradeneeded = async function (event) {
                        console.log("DBconnect upgradeneeded", event);
                        let dbConnection = event.target.result;
                        await thisObject.syncObjectStores(dbConnection);
                        thisObject.closeConnection(request, dbConnection);
                        resolve(thisObject.dbConnect());
                    }
                });
            }

            // synchronisiert die Datenbank mit den gewünschten ObjectStore-Definitionen
            async syncObjectStores(dbConnection) {
                try {
                    this.objectStoresToDelete.slice().forEach((storageId, idx) => {
                        if (dbConnection.objectStoreNames.contains(storageId)) {
                            console.log("Lösche Objectstore " + this.dbname + "." + storageId);
                            dbConnection.deleteObjectStore(storageId);
                        }
                        this.objectStoresToDelete.splice(idx, 1);
                    });
                    this.objectStores.forEach(objectstore => {
                        if (objectstore.readonly) return;
                        const storageId = objectstore.storageId;
                        if (!dbConnection.objectStoreNames.contains(storageId)) {
                            // create complete new object store (IDBObjectStore)
                            let newDbStore = dbConnection.createObjectStore(objectstore.storageId, {
                                keyPath: objectstore.key,
                            });
                            if (objectstore.indizes) {
                                objectstore.indizes.forEach(index => {
                                    newDbStore.createIndex(index, index);
                                })
                            }
                        }
                    });
                } catch (exception) {
                    console.warn("objectStoreStatusReportList", exception);
                }
                return true;
            }

            /**
             * @return boolean: ob die Object-Stores entsprechend ihrer Definition installiert/deinstalliert sind.
             */
            areAllObjectStoresSynced(dbConnection) {
                if (this.objectStoresToDelete.length > 0) return false;
                const installedNames = dbConnection.objectStoreNames; // Array
                for (const objectStore of this.objectStores) {
                    if (objectStore.readonly) continue;
                    if (!installedNames.contains(objectStore.storageId)) return false;
                }
                return true;
            }

            async doesObjectStoreExist(objectStore) {
                let dbConnection = await this.getConnection();
                return dbConnection.objectStoreNames.contains(objectStore.storageId);
            }
        }

        static ObjectStorage = class {
            storageId;
            key;
            indizes;
            indexedDb;
            readonly;

            constructor(storageId, key, indizes, readonly) {
                this.storageId = storageId;
                this.key = key;
                this.indizes = indizes;
                this.readonly = readonly;
            }

            async connect(withWrite) {
                let connection = await this.indexedDb.getConnection();
                let transaction = connection.transaction(this.storageId, withWrite ? "readwrite" : "readonly");
                return transaction.objectStore(this.storageId);
            }

            async setValue(dbObject) {
                const thisObject = this;
                return new Promise(async (resolve, reject) => {
                    let objectStore = await thisObject.connect(true);
                    let request = objectStore.put(dbObject);
                    request.onsuccess = function (event) {
                        resolve();
                    };
                    request.onerror = function (event) {
                        reject();
                    }
                });
            }

            async deleteValue(dbObjectId) {
                const thisObject = this;
                return new Promise(async (resolve, reject) => {
                    let objectStore = await thisObject.connect(true);
                    let request = objectStore.delete(dbObjectId);
                    request.onsuccess = function (event) {
                        resolve();
                    };
                    request.onerror = function (event) {
                        reject();
                    }
                });
            }

            async getValue(dbObjectId) {
                const thisObject = this;
                return new Promise(async (resolve, reject) => {
                    let objectStore = await thisObject.connect(false);
                    const request = objectStore.get(dbObjectId);
                    request.onsuccess = function (event) {
                        const result = event.target.result;
                        resolve(result);
                    };
                });
            }

            async contains(dbObjectId) {
                const thisObject = this;
                return new Promise(async (resolve, reject) => {
                    let objectStore = await thisObject.connect(false);
                    const request = objectStore.getKey(dbObjectId);
                    request.onsuccess = function (event) {
                        const result = event.target.result;
                        resolve(!!result);
                    };
                });
            }

            /**
             * Liefert ein Array über alle vorhandenen Objekte.
             */
            async getAll() {
                const thisObject = this;
                return new Promise(async (resolve, reject) => {
                    let connection = await thisObject.indexedDb.getConnection();
                    let transaction = connection.transaction(this.storageId, "readwrite");
                    let objectStore = transaction.objectStore(this.storageId);
                    const request = objectStore.getAll();

                    request.onsuccess = function (event) {
                        const result = event.target.result;
                        resolve(result);
                    };
                });
            }

            /**
             * Liefert ein Array über alle vorhandenen Objekte.
             */
            async getAllKeys() {
                const thisObject = this;
                return new Promise(async (resolve, reject) => {
                    let connection = await thisObject.indexedDb.getConnection();
                    let transaction = connection.transaction(this.storageId, "readwrite");
                    let objectStore = transaction.objectStore(this.storageId);
                    const request = objectStore.getAllKeys();

                    request.onsuccess = function (event) {
                        const result = event.target.result;
                        resolve(result);
                    };
                });
            }

            /**
             * Liefert ein Array über alle vorhandenen Objekte.
             */
            async count() {
                const thisObject = this;
                return new Promise(async (resolve, reject) => {
                    let connection = await thisObject.indexedDb.getConnection();
                    let transaction = connection.transaction(this.storageId, "readwrite");
                    let objectStore = transaction.objectStore(this.storageId);
                    const request = objectStore.count();

                    request.onsuccess = function (event) {
                        const result = event.target.result;
                        resolve(result);
                    };
                });
            }

            // für readonly objectstores, kann man hierüber abfragen, ob der ObjectStore auch existiert
            async exists() {
                return await this.indexedDb.doesObjectStoreExist(this);
            }

            async copyTo(toObjectStore) {
                for (const curKey of await this.getAllKeys()) {
                    const object = await this.getValue(curKey);
                    await toObjectStore.setValue(object);
                }
            }

            async cloneTo(toObjectStore) {
                console.log("Clone objectstore " + this.storageId + " to " + toObjectStore.storageId + "...");
                if (await toObjectStore.getAllKeys().length !== 0) {
                    console.error("Zielobjectstore " + toObjectStore.storageId + " ist nicht leer!");
                }
                console.log("Clone objectstore " + this.storageId + " to " + toObjectStore.storageId + "... starte...");
                await this.copyTo(toObjectStore);
                console.log("Clone objectstore " + this.storageId + " to " + toObjectStore.storageId + "... finished!");
            }
        }

        /**
         * Kopiert die Objekte von einem Object-Storage zu einem anderen.
         * Der Ziel-Storage muss dabei leer sein.
         */
        static async migrate(from, to) {
            if ((await this.to.getAll()).length > 0) return; // nur migrieren wenn die Zieldatenbank leer ist
            const db = await this.from.getAll();
            for (const report of db) {
                this.to.setValue(report);
            }
            console.log("Migration finished! " + db.length);
        }
    }

    /**
     * Hilfemethoden um allgemeine Informationen von WoD zu erhalten (Name, Gruppe etc.)
     */
    static WoD = class {
        static getMainForm(doc) {
            return (doc || document).getElementsByName("the_form")[0];
        }

        static getValueFromMainForm(valueType, doc) {
            const form = _.WoD.getMainForm(doc);
            if (!form) return;
            return form[valueType].value;
        }

        static getMyWorld(doc) {
            return _.WoD.getValueFromMainForm("wod_post_world", doc);
        }

        static getMyGroup(doc) {
            return _.WoD.getValueFromMainForm("gruppe_name", doc);
        }

        static getMyGroupId(doc) {
            return _.WoD.getValueFromMainForm("gruppe_id", doc);
        }

        static getMyHeroId(doc) {
            return _.WoD.getValueFromMainForm("session_hero_id", doc);
        }

        static getMyHeroName(doc) {
            return _.WoD.getValueFromMainForm("heldenname", doc);
        }

        static getMyUserName(doc) {
            return _.WoD.getValueFromMainForm("spielername", doc);
        }

        static getMyStufe(doc) {
            return _.WoD.getValueFromMainForm("stufe", doc);
        }

        /**
         * z.B. "Heute 12:13" => "12.12.2024 12:13"
         */
        static getTimeString(wodTimeString, dateFormatter) {
            if (!dateFormatter) dateFormatter = _.util.formatDate;
            if (wodTimeString.includes("Heute")) {
                wodTimeString = wodTimeString.replace("Heute", dateFormatter(new Date()));
            } else if (wodTimeString.includes("Gestern")) {
                const date = new Date();
                date.setDate(date.getDate() - 1);
                wodTimeString = wodTimeString.replace("Gestern", dateFormatter(date));
            }
            return wodTimeString;
        }

        static getTimestampFromString(wodTimeString) {
            return _.util.parseStandardTimeString(this.getTimeString(wodTimeString));
        }

    }

    /**
     * Hilfsmethoden für den BBCode-Export (Z.B. lässt sich ein DOM-Element exportieren)
     */
    static BBCodeExporter = class {
        static hatClassName(node, className) {
            return node.classList && node.classList.contains(className);
        }

        static getStyle(el, property, defaultSize) {
            if (!el.tagName) return defaultSize;
            return window.getComputedStyle(el, null).getPropertyValue(property);
        }

        static toBBCode(node, defaultSize) {
            defaultSize = this.getStyle(node, "font-size", defaultSize);

            if (node.classList && node.classList.contains("bbignore")) return "";
            var result = this.toBBCodeRaw(node, defaultSize);
            console.log(result)
            if (result.length !== 3) {
                console.log("Interner Fehler: Keine Array-Länge von 3 zurückgegeben", node);
            }
            if (result[1].trim() !== "" && !result[1].includes("[table") && !result[1].includes("[tr") && !result[1].includes("[td") && !result[1].includes("[th") && !result[0].includes("[img")) {
                if (node.style && node.style.textAlign === "center") {
                    result[0] = result[0] + "[center]";
                    result[2] = "[/center]" + result[2];
                }
                if (node.style && node.style.fontStyle === "italic") {
                    result[0] = result[0] + "[i]";
                    result[2] = "[/i]" + result[2];
                }
                if (this.getStyle(node, "font-weight") === "700") {
                    result[0] = result[0] + "[b]";
                    result[2] = "[/b]" + result[2];
                }
                let fontSize = this.getStyle(node, "font-size", defaultSize);
                if (fontSize) {
                    fontSize = fontSize.replace("px", "");
                    result[0] = result[0] + "[size=" + (Math.round(fontSize) - 2) + "]";
                    result[2] = "[/size]" + result[2];
                }
                if (node.style && node.style.color && !this.hatClassName(node, "bbignoreColor")) {
                    result[0] = result[0] + "[color=" + node.style.color + "]";
                    result[2] = "[/color]" + result[2];
                }
            }
            return result.join("");
        }

        static toBBCodeRaw(node, defaultSize) {
            switch (node.tagName) {
                case "TABLE":
                    return ["[table" + (node.border ? " border=" + node.border : "") + "]", this.toBBCodeArray(node.childNodes, defaultSize), "[/table]"];
                case "TR":
                    return ["[tr]", this.toBBCodeArray(node.childNodes, defaultSize), "[/tr]"];
                case "TD":
                    if (node.colSpan > 1) {
                        return ["[td colspan=" + node.colSpan + "]", this.toBBCodeArray(node.childNodes, defaultSize), "[/td]"];
                    }
                    return ["[td]", this.toBBCodeArray(node.childNodes, defaultSize), "[/td]"];
                case "TH":
                    if (node.colSpan > 1) {
                        return ["[th colspan=" + node.colSpan + "]", this.toBBCodeArray(node.childNodes, defaultSize), "[/th]"];
                    }
                    return ["[th]", this.toBBCodeArray(node.childNodes, defaultSize), "[/th]"];
                case "DIV":
                case "SPAN":
                    return ["", this.toBBCodeArray(node.childNodes, defaultSize), ""];
                case "IMG":
                    return ["[img]", node.src, "[/img]"];
                case "SELECT":
                    return ["", "", ""];
                case "A":
                    if (node.href.startsWith("http")) {
                        if (node.classList.contains("rep_monster")) {
                            return ["", "[beast:" + decodeURIComponent(node.href.match(/\/npc\/(.*?)&/)[1].replaceAll("+", " ")) + "]", ""];
                        } else if (node.href.includes("item.php")) {
                            const urlParams = new URLSearchParams(node.href);
                            return ["", "[item:" + decodeURIComponent(urlParams.get("name")) + "]", ""];
                        } else if (node.href.includes("/skill/")) {
                            return ["", "[skill:" + decodeURIComponent(node.href.match(/\/skill\/(.*?)&/)[1].replaceAll("+", " ")) + "]", ""];
                        } else if (node.href.includes("/item/")) {
                            return ["", "[item:" + decodeURIComponent(node.href.match(/\/item\/(.*?)&/)[1].replaceAll("+", " ")) + "]", ""];
                        } else {
                            return ["[url=" + node.href + "]", this.toBBCodeArray(node.childNodes, defaultSize), "[/url]"];
                        }
                    }
                    return ["", this.toBBCodeArray(node.childNodes, defaultSize), ""];
                case "THEAD":
                case "TBODY": // ignore it
                    return ["", this.toBBCodeArray(node.childNodes, defaultSize), ""];
                case "BR":
                    return ["", "\n", ""];
                case "B":
                    return ["[b]", this.toBBCodeArray(node.childNodes, defaultSize), "[/b]"];
                default:
                    if (typeof node.tagName === 'undefined') {
                        return ["", node.textContent.replaceAll("\n", ""), ""];
                    } else {
                        console.error("Unbekannter TagName gefunden: '" + node.tagName + "'");
                    }
            }
        }

        static toBBCodeArray(childNodes, defaultSize) {
            return _.util.arrayMap(childNodes, a => this.toBBCode(a, defaultSize)).join("");
        }
    }

    static UI = class {
        static createButton(htmlContent, callback) {
            const button = document.createElement("span");
            button.classList.add("nowod");
            button.innerHTML = htmlContent;
            button.style.fontSize = "12px";
            button.style.cursor = "pointer";
            button.onclick = callback;
            return button;
        }

        static createContentTable(contentArray, headerArray) {
            const table = document.createElement("table");
            table.classList.add("content_table");
            const tbody = document.createElement("tbody");
            table.append(tbody);
            if (headerArray) {
                const tr = document.createElement("tr");
                tr.classList.add("header");
                tbody.append(tr);
                for (const cur of headerArray) {
                    const td = document.createElement("th");
                    tr.append(td);
                    td.style.textAlign = "center";
                    td.innerHTML = cur;
                }
            }
            let row = true;
            for (const curLine of contentArray) {
                const tr = document.createElement("tr");
                tr.classList.add("row" + (row ? 0 : 1));
                row = !row;
                tbody.append(tr);
                for (const cur of curLine) {
                    const td = document.createElement("td");
                    tr.append(td);
                    td.innerHTML = cur;
                }
            }
            return table;
        }

        static createTable(contentArray, headerArray) {
            const table = document.createElement("table");
            const tbody = document.createElement("tbody");
            table.append(tbody);
            if (headerArray) {
                const tr = document.createElement("tr");
                tr.classList.add("header");
                tbody.append(tr);
                for (const cur of headerArray) {
                    const td = document.createElement("th");
                    tr.append(td);
                    td.style.textAlign = "center";
                    if (typeof cur === "object") {
                        td.append(cur);
                    } else {
                        td.innerHTML = cur;
                    }
                }
            }
            let row = true;
            for (const curLine of contentArray) {
                const tr = document.createElement("tr");
                tr.classList.add("row" + (row ? 0 : 1));
                row = !row;
                tbody.append(tr);
                for (const cur of curLine) {
                    const td = document.createElement("td");
                    tr.append(td);
                    if (typeof cur === "object") {
                        td.append(cur);
                    } else {
                        td.innerHTML = cur;
                    }
                }
            }
            return table;
        }

        static async useJQueryUI() {
            return new Promise((result, reject) => {
                const jQueryUI = document.createElement("script");
                jQueryUI.type = "text/javascript";
                jQueryUI.src = "/wod/javascript/jquery/js/jquery-ui-1.8.21.custom.min.js";
                jQueryUI.onload = r => result();
                jQueryUI.onerror = e => reject(e);
                document.head.append(jQueryUI);

                const css = document.styleSheets[0];

                function addRule(rule) {
                    css.insertRule(rule, css.cssRules.length);
                }

                addRule(".ui-datepicker {background-color:black;}");
                addRule(".ui-datepicker .ui-datepicker-header {\n" +
                    "    background: #339999;\n" +
                    "    color: #ffffff;\n" +
                    "    font-family:'Times New Roman';\n" +
                    "    border-width: 1px 0 0 0;\n" +
                    "    border-style: solid;\n" +
                    "    border-color: #111;\n" +
                    "}");
                addRule(".ui-datepicker .ui-datepicker-title {\n" +
                    "    text-align: center;\n" +
                    "    font-size: 15px;\n" +
                    "\n" +
                    "}");
                addRule(".ui-datepicker .ui-datepicker-prev {\n" +
                    "    float: left;\n" +
                    "    cursor: pointer;\n" +
                    "    background-position: center -30px;\n" +
                    "}");
                addRule(".ui-datepicker .ui-datepicker-next {\n" +
                    "    float: right;\n" +
                    "    cursor: pointer;\n" +
                    "    background-position: center 0px;\n" +
                    "}");
            });
        }
    }

    /**
     * Allgemeine nicht WoD-spezifische Hilfsmethoden.
     */
    static util = class {
        static getWindowPage() {
            var pathname = window.location.pathname.split("/");
            return pathname[pathname.length - 1];
        }

        static getSpace(object) {
            return JSON.stringify(object).length;
        }

        static fromBytesToMB(count) {
            return Math.ceil(10 * count / 1024 / 1024) / 10 + " MB";
        }

        static fromBytesToDynamic(count) {
            count = count / 1024;
            if (count < 1024) Math.ceil(10 * count) / 10 + " KB";
            return Math.ceil(10 * count / 1024) / 10 + " MB";
        }

        static arrayMap(list, fn) {
            var result = Array();
            for (var i = 0, l = list.length; i < l; i++) {
                result.push(fn(list[i]));
            }
            return result;
        }

        static arrayRemove(list, value) {
            var index = list.indexOf(value);
            if (index > -1) {
                list.splice(index, 1);
            }
        }

        static formatDate(date) {
            if (typeof date === "number") date = new Date(date);
            var result = "";
            var a = date.getDate();
            if (a < 10) result += "0";
            result += a + ".";
            a = date.getMonth() + 1;
            if (a < 10) result += "0";
            result += a + ".";
            result += (date.getFullYear());
            return result;
        }

        static formatDateAndTime(date) {
            if (typeof date === "number") date = new Date(date);
            var result = "";
            var a = date.getDate();
            if (a < 10) result += "0";
            result += a + ".";
            a = date.getMonth() + 1;
            if (a < 10) result += "0";
            result += a + ".";
            result += (date.getFullYear());
            result += " ";
            a = date.getHours();
            if (a < 10) result += "0";
            result += a + ":";
            a = date.getMinutes();
            if (a < 10) result += "0";
            result += a;
            return result;
        }

        /**
         * z.B. "22.01.2024 12:13" => 17234663464
         */
        static parseStandardTimeString(timeString) {
            const matches = timeString.match(/(\d*)\.(\d*)\.(\d*) (.*)/);
            return Date.parse(matches[3] + "-" + matches[2] + "-" + matches[1] + " " + matches[4]);
        }

        /**
         * z.B. "22.01.2024" => 17234663464
         */
        static parseStandardDateString(timeString) {
            const matches = timeString.match(/(\d*)\.(\d*)\.(\d*)/);
            return Date.parse(matches[3] + "-" + matches[2] + "-" + matches[1]);
        }

        /**
         * Erzeugt aus dem übergebenen HTMLString ein Document, welches dann auch
         * .getElementsById und .getElementyByName enthält.
         */
        static getDocumentFor(fullHtmlString) {
            const doc = document.implementation.createHTMLDocument();
            doc.documentElement.innerHTML = fullHtmlString;
            return doc;
        }

        static JSONstringify(data) {
            _.util.JSONstringifyCount(data);
            let result = "{";
            for (const [key, value] of Object.entries(data)) {
                if (result.length > 1) result += ",";
                result += '"' + key + '":' + _.util.JSONstringifyArray(value);
            }
            result += "}";
            return result;
        }

        static JSONstringifyArray(data) {
            let result = "[";
            for (var indx = 0; indx < data.length - 1; indx++) {
                result += _.util.JSONstringifyOriginal(data[indx], null, 4) + ",";
            }
            result += _.util.JSONstringifyOriginal(data[data.length - 1], null, 4) + "]";
            return result;
        }

        static JSONstringifyOriginal(arg1, arg2, arg3) {
            try {
                return JSON.stringify(arg1, arg2, arg3); // JSON.stringify(arg1, arg2, arg3);
            } catch (e) {
                console.log(e.message, arg1);
            }
        }

        static JSONstringifyCount(data) {
            console.log("Stringify", data);
            let result = 0;
            for (const [key, value] of Object.entries(data)) {
                let temp = _.util.JSONstringifyArrayCount(value);
                console.log(key + ": " + temp);
                result += temp;
            }
            console.log("StringifyCount", data, result);
            return result;
        }

        static JSONstringifyArrayCount(data) {
            let result = 0;
            for (var indx = 0; indx < data.length - 1; indx++) {
                result += _.util.JSONstringifyOriginalCount(data[indx], null, 4);
            }
            result += _.util.JSONstringifyOriginalCount(data[data.length - 1], null, 4);
            return result;
        }

        static JSONstringifyOriginalCount(arg1, arg2, arg3) {
            try {
                const result = JSON.stringify(arg1, arg2, arg3).length;
                //console.log(arg1.id+ ": " + result);
                return result; // JSON.stringify(arg1, arg2, arg3);
            } catch (e) {
                console.log(e.message, arg1);
            }
        }
    }
}

_ = demawiRepository;