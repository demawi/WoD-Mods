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
                console.log("Clone '" + this.dbname + "' to '" + dbNameTo + "'...");
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
                    for (const cur of await readFrom.parse()) {
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
             * Prüft, ob der ObjectStore existiert. Wenn er dies tut, wird dieser zurückgeliefert.
             */
            async getObjectStore(storageId) {
                const dbConnection = await this.getConnection();
                if (dbConnection.objectStoreNames.contains(storageId)) {
                    /**
                     * wird nicht den this.objectStores hinzugefügt, insofern brauchen wir auch keine weiteren Angaben über PrimaryKey und Indizes machen.
                     */
                    const result = new _.Storages.ObjectStorage(storageId);
                    result.indexedDb = this;
                    return result;
                }
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
                const objectStore = new demawiRepository.Storages.ObjectStorage(storageId, key, indizes, readonly);
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
                    // console.log("request created " + request.idx + "_" + version);
                    request.onsuccess = function (event) {
                        let dbConnection = event.target.result;
                        let needNewStores = !thisObject.areAllObjectStoresSynced(dbConnection);
                        // console.log("DBconnect success! (" + thisObject.dbname + ") Need update: " + needNewStores, event);
                        if (needNewStores) {
                            thisObject.closeConnection(request, dbConnection);
                            resolve(thisObject.dbConnect(new Date().getTime())); // force upgrade
                        } else {
                            resolve(event.target.result);
                        }
                    }
                    request.onerror = function (event) {
                        // console.log("DBconnect error", event);
                        reject();
                    }
                    request.onblocked = function () {
                        console.log("DBconnect blocked", request.idx, event);
                        alert("Die IndexDB hat sich geändert! (" + thisObject.modname + ") Bitte die Seite einmal neuladen! (blocked)");
                        reject();
                    }
                    request.onupgradeneeded = async function (event) {
                        console.log("DBconnect upgradeneeded [" + thisObject.dbname + "]", event);
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

            async cloneTo(toObjectStore, overwrite) {
                console.log("Clone objectstore '" + this.storageId + "' to '" + toObjectStore.storageId + "'...");
                if (!overwrite && await toObjectStore.getAllKeys().length !== 0) {
                    console.error("Zielobjectstore '" + toObjectStore.storageId + "' ist nicht leer!");
                    return;
                }
                console.log("Clone objectstore '" + this.storageId + "' to '" + toObjectStore.storageId + "'... starte...");
                await this.copyTo(toObjectStore);
                console.log("Clone objectstore '" + this.storageId + "' to '" + toObjectStore.storageId + "'... finished!");
            }
        }

        /**
         * Kopiert die Objekte von einem Object-Storage zu einem anderen.
         * Der Ziel-Storage muss dabei leer sein.
         */
        static async migrate(from, to) {
            if ((await this.to.parse()).length > 0) return; // nur migrieren wenn die Zieldatenbank leer ist
            const db = await this.from.parse();
            for (const report of db) {
                this.to.setValue(report);
            }
            console.log("Migration finished! " + db.length);
        }
    }

    /**
     * Hier finden sich gemeinsam genutzte Datenbanken und Datenoperation.
     */
    static WoDStorages = class {
        static #indexedDb;
        static #objectStores = {};

        static #getDb() {
            return this.#indexedDb || (this.#indexedDb = new _.Storages.IndexedDb("WoDReportArchiv", "wodDB"));
        }

        static async #getObjectStore(storageId) {
            let objectStore = this.#objectStores[storageId];
            if (objectStore === undefined) {
                objectStore = await this.#getDb().getObjectStore(storageId) || false;
                this.#objectStores[storageId] = objectStore;
            }
            return objectStore;
        }

        /**
         * Wenn die Stufe direkt aus dem Kampfbericht-Level kommt.
         */
        static async addLootSafe(itemName, locationName, timestamp, world, stufe) {
            await this.#addLoot(itemName, locationName, timestamp, world, stufe);
        }

        /**
         * Wenn die Stufe nur über den eingeloggten User kommt.
         */
        static async addLootUnsafe(itemName, locationName, timestamp, world, stufe) {
            await this.#addLoot(itemName, locationName, timestamp, world, undefined, stufe);
        }

        /**
         * @param heldenstufeGesichert die Stufe aus den Kampfberichten
         * @param heldenstufeUngesichert die Stufe des eingeloggten Nutzers
         */
        static async #addLoot(itemName, locationName, timestamp, world, heldenstufeGesichert, heldenstufeUngesichert) {
            const itemLootStore = await this.#getObjectStore("itemLoot");
            const key = itemName.toLowerCase();
            const item = await itemLootStore.getValue(key) || {id: key};
            const lootTable = item.loot || (item.loot = {});
            const curLoot = lootTable[timestamp] || (lootTable[timestamp] = {});
            curLoot.world = world;
            curLoot.loc = locationName;
            this.#setNumberValue(curLoot, "stufe", curLoot.stufe || heldenstufeGesichert);
            if (curLoot.stufe) {
                delete curLoot.stufe_;
            } else {
                this.#setNumberValue(curLoot, "stufe_", curLoot.stufe_ || heldenstufeUngesichert);
            }
            await itemLootStore.setValue(item);
        }

        static #setNumberValue(obj, property, value) {
            value = Number(value);
            if (!isNaN(value)) obj[property] = value;
        }

    }

    /**
     * Hilfemethoden um allgemeine Informationen von WoD zu erhalten (Name, Gruppe etc.)
     */
    static WoD = class {
        /**
         * Nutzt zur Sicherheit die letzte "the_form" des Dokumentes, falls Seiten aus dem Archiv angezeigt werden.
         */
        static getMainForm(doc) {
            const forms = (doc || document).getElementsByName("the_form");
            return forms[forms.length - 1];
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
            return Number(_.WoD.getValueFromMainForm("stufe", doc));
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

        static getReportType(doc) {
            doc = doc || document;
            const form = this.getMainForm(doc);
            if (form["DuellId"]) return "Duell"; // Helden
            if (form["report"]) return "Schlacht";
            if (form["report_id[0]"]) return "Dungeon";
            console.error("Unbekannter Report-Type", form);
            throw new Error("Unbekannter Report-Type");
        }

        static isSchlacht(doc) {
            return this.getReportType(doc) === "Schlacht";
        }

        // Types: Dungeon/Quest, Schlacht-Report, Duell (Solo, Gruppe, Duell)
        // wod/spiel/clanquest/combat_report.php?battle=8414&report=59125 (battle scheint nicht relevant zu sein!? Seite kann auch so aufgerufen werden)
        // wod/spiel/tournament/duell.php
        /**
         * Gibt die Basisinformationen auf einer Kampfberichtseite (Statistik, Gegenstände, Berichtseiten) in einem JS-Objekt wider.
         * Kann auch bei Schlachten oder Duellen genutzt werden.
         */
        static getFullReportBaseData(doc) {
            doc = doc || document;
            const form = this.getMainForm(doc);
            let reportId;
            let schlacht;
            if (form["report_id[0]"]) {
                reportId = form["report_id[0]"].value;
            } else if (form["report"]) {
                reportId = form["report"].value;
                schlacht = "Unbekannte Schlacht";
                const schlachtLink = doc.querySelector("h1 a");
                if (schlachtLink) schlacht = schlachtLink.textContent.trim();
            } else if (form["DuellId"]) {
                reportId = form["DuellId"].value;
            }

            let ts;
            let title;
            if (this.getReportType(doc) !== "Duell") {
                const titleSplit = doc.getElementsByTagName("h2")[0].textContent.split(/-(.*)/);
                title = titleSplit[1].trim();
                ts = this.getTimestampFromString(titleSplit[0].trim());
            }

            const myWorld = this.getMyWorld(doc);
            const result = {
                reportId: myWorld + reportId, // um mehrere Welten zu unterstützen sollte diese ID verwendet werden
                world: myWorld,
                ts: ts, // zu welchem Zeitpunkt der Dungeon stattgefunden hat
                title: title, // Bei einem Dungeon z.B. der Dungeonname
                gruppe: this.getMyGroup(doc),
                gruppe_id: this.getMyGroupId(doc),
                schlacht: schlacht, // Name der Schlacht
                stufe: this.getMyStufe(doc),
            }
            if (ts) result.ts = ts;
            if (title) result.title = title;
            return result;
        }
    }

    static WoDParser = class {

        static getFirstHeroTableOnKampfbericht(doc) {
            doc = doc || document;
            const allHeadlines = doc.querySelectorAll(".rep_status_headline");
            let firstHeroHeadline;
            for (const curHeadline of allHeadlines) {
                if (curHeadline.textContent === "Angreifer:") {
                    firstHeroHeadline = curHeadline;
                    break;
                }
            }
            return firstHeroHeadline && firstHeroHeadline.nextElementSibling;
        }

        static getLastHeroTableOnKampfbericht(doc) {
            doc = doc || document;
            const allHeadlines = document.querySelectorAll(".rep_status_headline");
            let lastHeroHeadline;
            for (const curHeadline of allHeadlines) {
                if (curHeadline.textContent === "Angreifer:") {
                    lastHeroHeadline = curHeadline;
                }
            }
            return lastHeroHeadline && lastHeroHeadline.nextElementSibling;
        }

        static getHeldenstufenOnKampfbericht(doc) {
            const firstActionHeroes = this.getFirstHeroTableOnKampfbericht(doc);
            if (firstActionHeroes) {
                const heroTDs = firstActionHeroes.querySelectorAll("td.hero");
                const heroAs = firstActionHeroes.querySelectorAll("a");
                if (heroTDs.length === heroAs.length) { // keiner bewusstlos, alle haben auch nen Link
                    const helden = {};
                    for (const curA of heroAs) {
                        if (curA.href.includes("/hero/")) { // keine NPCs
                            let upperTD = curA.parentElement;
                            if (upperTD.tagName !== "TD") upperTD = upperTD.parentElement; // evtl. mit BuffWrapper
                            const stufe = Number(upperTD.nextElementSibling.textContent);
                            if (stufe) { // wenn keine Stufe auch kein Held, evtl. nen Mentor
                                const held = {};
                                helden[curA.textContent.trim()] = held;
                                held.stufe = stufe;
                            }
                        }
                    }
                    return helden;
                }
            }
        }


        // Relevante Daten der Gegenstandsseite
        /**
         * {
         *  <heldname>:
         *     { // Member
         *         money: 123, // erhaltenes Gold
         *         exeed: trueOpt, // optional, wenn der User seine Anzahl an Gegenständen überschritten hatten
         *         full: trueOpt, // optional, wenn der Rucksack zu voll ist (gibts das?)
         *         ko: trueOpt, // wenn der Charakter bewusstlos geworden ist
         *         loot: [
         *              {
         *                  name: "<itemName>",
         *                  unique: trueOpt,
         *                  vg: 4, // die entsprechende Anzahl an Nutzungen
         *              }
         *         ],
         *         equip: [
         *              {
         *                  name: "<itemName>",
         *                  gems: "bxw",
         *                  mgems: "slkdfh", // gibts das überhaupt?
         *                  hp: [15, 25, -2], // dritter slot = Schaden
         *                  amount: [36, 100, -6], // dritter slot = Anzahl genutzt
         *              }
         *         ]
         *     }
         * {
         */
        static parseKampfberichtGegenstaende(doc) {
            doc = doc || document;
            const result = {};
            const headers = doc.querySelectorAll(".content_table h2");
            for (const head of headers) {
                const member = {};
                result[head.textContent] = member;
                member.equip = [];
                const memberTableUeberschriften = head.nextElementSibling.nextElementSibling.querySelectorAll("h3");
                const equipped = memberTableUeberschriften[0].nextElementSibling.querySelectorAll("tr");
                for (let i = 1, l = equipped.length; i < l; i++) {
                    const tr = equipped[i];
                    const item = {};
                    member.equip.push(item);
                    item.name = tr.children[1].textContent.trim();
                    const imgs = tr.querySelectorAll("img");
                    for (const img of tr.querySelectorAll("img")) {
                        const gemMatch = img.src.match(/gem_(.*)\.png/);
                        if (gemMatch && gemMatch[1] !== "0") item.gems = (item.gems || "") + gemMatch[1];
                        const mgemMatch = img.src.match(/mgem_(.*)\.png/); // gibt es das wirklich?
                        if (mgemMatch) item.mgems = (item.mgems || "") + mgemMatch[1];
                    }

                    let hpMatch = tr.children[2].textContent.match(/(\d*)\/(\d*) \((.*)\)/);
                    if (hpMatch) item.hp = [Number(hpMatch[1]), Number(hpMatch[2]), Number(hpMatch[3])];
                    else {
                        hpMatch = tr.children[2].textContent.match(/(\d*)\/(\d*)/);
                        if (hpMatch) item.hp = [Number(hpMatch[1]), Number(hpMatch[2])]; // no damage
                    }
                    let vgMatch = tr.children[4].textContent.match(/(\d*)\/(\d*) \((.*)\)/);
                    if (vgMatch) item.vg = [Number(vgMatch[1]), Number(vgMatch[2]), Number(vgMatch[3])];
                    else {
                        vgMatch = tr.children[4].textContent.match(/(\d*)\/(\d*)/);
                        if (vgMatch) item.vg = [Number(vgMatch[1]), Number(vgMatch[2])]; // nothing used
                    }
                }

                for (const current of memberTableUeberschriften[1].parentElement.children) {
                    switch (current.tagName) {
                        case "H3":
                            break;
                        case "P":
                            const text = current.textContent;
                            if (text.includes("nichts gefunden")) break; // einfach ignorieren
                            const goldMatch = text.match(/hat (\d*) gefunden\.$/);
                            if (goldMatch) {
                                member.money = goldMatch[1];
                                break;
                            }
                            if (text.includes("ist leider bewusstlos geworden")) {
                                member.ko = true;
                                break;
                            }
                            const itemExceedMatch = text.match(/^Deine Helden haben zusammen schon (\d*) /);
                            if (itemExceedMatch) {
                                member.exceed = itemExceedMatch[1];
                                break;
                            }
                            if (text.includes("Rucksack")) { // hab die Meldung noch nicht gesehen, aber es scheint als gäbe es sie
                                member.full = true;
                                break;
                            }
                            console.error("Unbekannter Eintrag bei 'Gefundene Gegenstände'", current);
                            break;
                        case "TABLE":
                            const trs = current.querySelectorAll("tr");
                            let item;
                            for (let i = 1, l = trs.length; i < l; i++) {
                                const tr = trs[i];
                                if (tr.children[0].textContent !== "") {
                                    item = {};
                                    if (!member.loot) member.loot = [];
                                    member.loot.push(item);
                                    item.name = tr.children[1].textContent.trim();
                                    let splitter = tr.children[4].textContent.split("/");
                                    if (splitter.length > 1) item.vg = Number(splitter[0]);
                                    if (tr.querySelector("a").classList.contains("item_unique")) item.unique = true;
                                }
                            }
                            break;
                    }
                }
            }
            //console.log("Übersicht Gegenstände", result);
            return result;
        }

        static retrieveSuccessInformationOnStatisticPage(doc, previousSuccess) {
            const title = doc.getElementsByTagName("h2")[0].textContent.split(/-(.*)/)[1].trim();
            const tables = doc.querySelectorAll(".content_table");
            const table = tables[tables.length - 1];
            let xpElements = table.querySelector("tr:nth-child(2)").querySelectorAll("td");
            const groupSize = xpElements.length - 2;
            if (_.WoD.isSchlacht()) {
                previousSuccess = previousSuccess || {};
                if (!previousSuccess.levels) previousSuccess.levels = [1, 1];
                if (!previousSuccess.members) previousSuccess.members = ["?", groupSize];
                return previousSuccess;
            }

            let xpSum = 0;

            xpElements.forEach(a => {
                const i = Number(a.textContent);
                if (!isNaN(i)) xpSum += i;
            });
            let xps;
            if (xpSum > 0) xps = xpSum;

            let levelElements = table.querySelector("tr:nth-child(5)").querySelectorAll("td");
            let roomElements = table.querySelector("tr:nth-child(6)").querySelectorAll("td");
            let finishedRooms = 0;
            let fullRooms = 0;
            let fullSuccessMembers = 0;
            let maxSuccessLevel = 0;
            let maxLevel;

            const getNumbers = function (maxSuccessLevel, finishedRooms) {
                if (title === "Offene Rechnung") {
                    if (maxSuccessLevel > 0) {
                        maxSuccessLevel++;
                        finishedRooms++;
                    }
                }
                return [maxSuccessLevel, finishedRooms];
            }

            for (let i = 1, l = levelElements.length - 1; i < l; i++) {
                const roomsElement = roomElements[i];
                const roomSplit = roomsElement.textContent.split("/");
                fullRooms += Number(roomSplit[1]);
                const levelElement = levelElements[i];
                const levelSplit = levelElement.textContent.split("/");

                let curFinishedRoom = Number(roomSplit[0]);
                let curSuccessLevel = Number(levelSplit[0]);
                [curFinishedRoom, curSuccessLevel] = getNumbers(curFinishedRoom, curSuccessLevel);
                if (curSuccessLevel > maxSuccessLevel) maxSuccessLevel = curSuccessLevel;
                if (!maxLevel) maxLevel = Number(levelSplit[1]);
                if (curSuccessLevel >= maxLevel) fullSuccessMembers++;

                finishedRooms += curFinishedRoom;
            }

            const result = {
                levels: [maxSuccessLevel, maxLevel],
                rooms: [finishedRooms, fullRooms],
                members: [fullSuccessMembers, groupSize],
            };
            if (xps) result.xp = xps;
            return result;
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

    static Libs = class {

        static jszip_loaded = false;

        static async getJSZip() {
            if (this.jszip_loaded) {
                return new JSZip();
            } else {
                this.jszip_loaded = true;
                await this.loadViaXMLRequest("https://raw.githubusercontent.com/demawi/WoD-Mods/refs/heads/master/libs/jszip.min.js")
                console.log("JSZip loaded: " + JSZip.version);
                return new JSZip();
            }
        }

        static async loadViaXMLRequest(url) {
            var xmlHttp = new XMLHttpRequest();
            xmlHttp.open("GET", url, false); // false for synchronous request
            xmlHttp.send(null);
            unsafeWindow.eval(xmlHttp.responseText);
        }

        static async loadViaInjection(url) {
            return new Promise((result, reject) => {
                const lib = document.createElement("script");
                lib.type = "text/javascript";
                lib.src = url;
                lib.onload = r => result();
                lib.onerror = e => reject(e);
                document.head.append(lib);
            });
        }

        static async useJQueryUI() {
            await this.loadViaInjection("/wod/javascript/jquery/js/jquery-ui-1.8.21.custom.min.js");

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

    }

    /**
     * Allgemeine nicht WoD-spezifische Hilfsmethoden.
     */
    static util = class {

        static cloneObject(obj) {
            return JSON.parse(JSON.stringify(obj));
        }

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

        static error(errorMsg, ...additionals) {
            const error = new Error(errorMsg);
            error.additionals = additionals;
            return error;
        }
    }

    // Liest den Kampfbericht ein und erstellt die Datenstruktur auf der Anfragen gestellt werden können.
    // Grobe Struktur: Report -> Level -> Kampf -> (Vor-)Runde -> Aktion -> Ziel -> Auswirkung
    static ReportParser = function () {

        class UnitId {
            name;
            index;
            isHero;
            isEreignis;

            constructor(name, index, isHero, isEreignis) {
                this.name = name;
                this.index = index;
                this.isHero = isHero;
                this.isEreignis = isEreignis;
            }
        }

        class Round {
            helden;
            monster;
            actions; // aufgeteilt in vorrunde, regen, initiative, runde

            constructor(nr, roundTR) {
                let statusTables = roundTR.getElementsByClassName("rep_status_table"); // üblicherweise sollten es immer 2 sein, nur am Ende des Kampfes dann 4
                if (statusTables.length !== 2 && statusTables.length !== 4) {
                    console.error("Es wurden keine zwei StatusTable in einer Runde gefunden: " + statusTables.length);
                }
                this.helden = GruppenStatus.parse(statusTables[0], true);
                this.monster = GruppenStatus.parse(statusTables[1], false);
                if (statusTables.length > 2) {
                    this.heldenEnd = GruppenStatus.parse(statusTables[2], true);
                    this.monsterEnd = GruppenStatus.parse(statusTables[3], true);
                }
                const repRoomEnd = roundTR.getElementsByClassName("rep_room_end")[0];
                if (repRoomEnd) this.success = repRoomEnd.textContent === "Die Angreifer haben gesiegt!";

                var initiative = Array();
                var vorrunde = Array();
                var regen = Array();
                var runde = Array();
                let actionsElement = roundTR.getElementsByTagName("table")[2].querySelectorAll("tr");
                for (const currentActionTR of actionsElement) { // Round-Action-TR
                    const currentActionTRlength = currentActionTR.children.length;
                    if (currentActionTRlength === 1) continue; // nothing to do <hr>

                    const iniTD = currentActionTR.children[0];
                    const hatInitiativeWurf = iniTD.textContent.trim() !== "";
                    if (currentActionTRlength === 2) { // Flucht z.B. "ist ein Feigling und flieht wegen Hitpointverlusts." oder "kann nichts tun", oder Regen/Initiative
                        const actionTD = currentActionTR.children[1];
                        const genutzterSkill = actionTD.querySelector("a[href*=\"/skill/\"]");

                        if (hatInitiativeWurf) {
                            if (!genutzterSkill) continue; // In der Runde: Initiative ohne Target => nur Beschreibendes
                            // Genutzter Skill aber kein Target: merkwürdig, aber kommt vor z.B. die Reise nach Keras Level 1. Dort wirkt der Skill z.B. auf die gesamte Gruppe, die als Target aber nicht ausgewiesen werden
                            continue;
                        }

                        if (genutzterSkill) { // Initiative

                        } else { // Regen

                        }
                    } else { // length == 3. Vorrunden- (ohne Initiative) oder Runden-Aktion (mit Initiative)
                        const actionTD = currentActionTR.children[1];
                        const targetTD = currentActionTR.children[2];
                        if (hatInitiativeWurf) { // Vorrunden-Aktion
                            Actions.parse(this, currentActionTR, iniTD, actionTD, targetTD).forEach(a => runde.push(a));
                        } else { // Runden-Aktion
                            Actions.parse(this, currentActionTR, null, actionTD, targetTD).forEach(a => vorrunde.push(a));
                        }
                    }
                }
                this.actions = {
                    initiative: initiative,
                    vorrunde: vorrunde,
                    regen: regen,
                    runde: runde,
                };
            }

            emptyRound() {
                return {
                    initiative: Array(),
                    vorrunde: Array(),
                    regen: Array(),
                    runde: Array(),
                };
            }

            //Einen Lookup ausführen, damit die Unit auch immer alle möglichen Information (z.B. Position) trägt.
            unitLookup(unitId) {
                var lookupUnit = ReportParser.unitSearch(unitId, this.helden);
                if (!lookupUnit) {
                    lookupUnit = ReportParser.unitSearch(unitId, this.monster);
                }
                if (!lookupUnit) {
                    console.error("Unit konnte nicht in der aktuellen Runde gefunden werden!", unitId);
                    return {
                        id: unitId,
                    };
                }
                return lookupUnit;
            }
        }

        class Target {
            type;
            fertigkeit;
            wirkung; // z.B. bei direkter Heilung
            result; // 0:Fehlschlag, 1:Erfolg, 2: Guter Erfolg, 3: Kritischer Erfolg
            damage = []; // Achtung: hier wird auch der Overkill nicht abgezogen. Ist also evtl. mehr Schaden angezeigt als überhaupt HP beim Gegner noch vorhanden wären. Gilt das aber auch beim Heilen!?

            constructor(strLine) {
                if (strLine.match(/: Fehlschlag/)) {
                    this.result = 0;
                } else if (strLine.match(/: kritischer Erfolg/)) {
                    this.result = 3;
                } else if (strLine.match(/: guter Erfolg/)) {
                    this.result = 2;
                } else if (strLine.match(/: Erfolg/)) {
                    this.result = 1;
                }
                if (this.result > -1) {
                    this.type = "Angriff";
                    const pwMatch = strLine.match(/(\(|\/)(\d+)(\)|\/)/); // Eine Zahl wo vorher ( od. / kommt und nachher ) oder /
                    if (pwMatch) {
                        this.fertigkeit = {wurf: pwMatch[2]};
                    } else {
                        console.log("Keine Parade", strLine);
                    }
                } else {
                    var matching = strLine.match(/\+(\d*) HP/)
                    if (matching) { // Single Target Heal
                        this.type = "Heilung";
                        this.wirkung = {
                            what: "HP",
                            value: matching[1],
                        }
                    }
                }
            }
        }

        class Damage {
            value;
            ruestung;
            resistenz;
            type;

            constructor(damageLineElement) {
                const stringLine = damageLineElement.textContent;
                var matching = stringLine.match(/^(\d*) \[\+(\d*)\]/);
                if (matching) {
                    this.value = Number(matching[1]);
                    this.ruestung = Number(matching[2]);
                    this.resistenz = 0;
                    this.type = this.getDamageType(stringLine);
                } else {
                    matching = stringLine.match(/^(\d*)/);
                    if (matching) {
                        this.value = Number(matching[1]);
                        this.ruestung = 0;
                        this.resistenz = 0;
                        this.type = this.getDamageType(stringLine);
                    } else {
                        throw new Error("Es kann kein Schaden ermittelt werden: " + stringLine);
                    }
                }
                if (damageLineElement.tagName === "SPAN") { // hat Anfälligkeit
                    const dmgVorher = damageLineElement.getAttribute("onmouseover").match(/verursacht: <b>(\d*)<\/b>/)[1];
                    let dmgNachher = damageLineElement.getAttribute("onmouseover").match(/Anfälligkeit.* <b>(\d*)<\/b>/);
                    if (dmgNachher) {
                        dmgNachher = dmgNachher[1];
                    } else {
                        dmgNachher = damageLineElement.getAttribute("onmouseover").match(/Unempfindlichkeit.* <b>(\d*)<\/b>/)[1];
                        dmgNachher = -Number(dmgNachher);
                    }
                    this.resistenz = Number(dmgVorher) - Number(dmgNachher) - this.ruestung;
                }
            }

            getDamageType(stringLine) {
                if (stringLine.includes("Hiebschaden"))
                    return "Hieb";
                else if (stringLine.includes("Schneidschaden"))
                    return "Schneid";
                else if (stringLine.includes("Stichschaden"))
                    return "Stich";
                else if (stringLine.includes("Feuer"))
                    return "Feuer";
                else if (stringLine.includes("Eisschaden"))
                    return "Eis";
                else if (stringLine.includes("Blitzschaden"))
                    return "Blitz";
                else if (stringLine.includes("psychologisch"))
                    return "Psychologisch";
                else if (stringLine.includes("Heiliger Schaden"))
                    return "Heilig";
                else if (stringLine.includes("Säureschaden"))
                    return "Säure";
                else if (stringLine.includes("Falle entschärfen"))
                    return "FalleEntschärfen";
                else if (stringLine.includes("Giftschaden"))
                    return "Gift";
                else if (stringLine.includes("Manaschaden"))
                    return "Mana";
                else if (stringLine.includes("Arkaner Schaden"))
                    return "Arkan";
                console.error("DamageType kann nicht bestimmt werden: " + stringLine);
                throw new Error("...");
                return "???";
            }
        }

        /**
         * Rang <Fertigkeit/Talentklasse>
         * Hitpoints   -5%
         * Schaden <Schadenart> +1,00/+1,00/+1,00 (Fernkampf) // Angriffsart ist optional
         * Erholung Manapoints
         * Heilung Hitpoints
         * Parade <Paradeart>      // Falle auslösen, Magisch
         * Geschicklichkeit
         * Angriff <Angriffsart>   // Falle entschärfen
         * Rüstung <Schadensart> +1,00/+1,00/+1,00 (Fernkampf) // Angriffsart ist optional
         */
        class Wirkung {
            name;
            wirkung;
            wann;

            constructor(name, wirkung, wann) {
                this.name = name.trim();
                this.wirkung = wirkung;
                this.wann = wann;
            }

            /**
             * Die Dauer wird nicht angezeigt, diese müsste durch die Boni in Verbindung mit der/des angewandten Fertigkeit/Gegenstand aufgelöst werden
             * @param href Fertigkeit oder Gegenstands-Element oder Unit
             * @returns {any[]}
             */
            static getWirkungenFromElement(href, multi) {
                let result = href.getAttribute("onmouseover");
                if (result) {
                    result = result.substring(result.indexOf("'") + 1, result.lastIndexOf("'"));
                    const elem = document.createElement("div");
                    elem.innerHTML = result;
                    result = multi ? this.#getMultiWirkungenFromMouseOverString(elem) : this.#getWirkungenFromMouseOverString(elem);
                    //console.log(!!multi + ": ", result, href);
                }
                return result;
            }

            /**
             * Auf einer Unit wird auch immer noch die Quelle von den Wirkungen mit angegeben.
             */
            static #getMultiWirkungenFromMouseOverString(elem) {
                let quelle;
                const thisObject = this;
                const nodeCollector = document.createElement("div");
                const result = [];
                const finishNode = function () {
                    result.push({
                        quelle: quelle,
                        wirkungen: thisObject.#getWirkungenFromMouseOverString(nodeCollector),
                    });
                }
                for (const curNode of elem.childNodes) {
                    if (curNode.tagName === "B") {
                        if (nodeCollector.innerHTML.length > 0) {
                            finishNode();
                            nodeCollector.innerHTML = "";
                        }
                        quelle = curNode.textContent.trim();
                        quelle = quelle.substring(0, quelle.length - 1);
                    } else {
                        nodeCollector.append(curNode.cloneNode(true));
                    }
                }
                finishNode();
                return result;
            }

            static #getWirkungenFromMouseOverString(elem) {
                const alleWirkungen = Array();
                let name;
                let wann;
                let nodeCollector = document.createElement("div");

                function finishWirkung() {
                    if (name) {
                        if (!name.startsWith("Dies ist ein")) { // Gruppengegenstand
                            alleWirkungen.push(new Wirkung(name, nodeCollector.textContent.trim(), wann));
                        }
                        nodeCollector.innerHTML = "";
                        name = undefined;
                    }
                }

                for (const curNode of elem.childNodes) {
                    if (curNode.tagName === "BR") {
                        finishWirkung();
                    } else if (!name) {
                        name = curNode.textContent;
                    } else {
                        const curText = curNode.textContent;
                        if (curText.includes("Runde")) {
                            wann = curText;
                        } else {
                            nodeCollector.append(curNode.cloneNode(true));
                        }
                    }
                }
                finishWirkung();

                return alleWirkungen;
            }
        }

        class GruppenStatus {

            static parse(statusTable, heldenJaNein) {
                var statusTRs = statusTable.children[0].children
                if (statusTRs[1].innerText.includes("keine kampfbereiten Gegner")) return;
                var result = Array();
                for (var i = 1, l = statusTRs.length; i < l; i++) { // ohne Header
                    var tds = statusTRs[i].children;
                    var srcRef = tds[1].innerHTML; // Mit aktuellen Wirkungen und Index. Helden wenn sie bewusstlos sind haben keinen Link mehr
                    var typeRef; // unabhängig von Wirkung und Index, sofern vorhanden einzig der Link
                    var unitLink = tds[1].getElementsByTagName("a");
                    if (unitLink) unitLink = unitLink[0];
                    if (unitLink) typeRef = unitLink.outerHTML;
                    const unit = {
                        id: ReportParser.getUnitIdFromElement(tds[1].childNodes[0], null, heldenJaNein, true),
                        stufe: tds[2].innerText.trim(),
                        position: tds[3].innerText.trim(),
                        hp: tds[4].innerText.trim(),
                        mp: tds[5].innerText.trim(),
                        zustand: tds[6].innerText.trim(),
                        srcRef: srcRef,
                        typeRef: typeRef,
                    }
                    if (unitLink) {
                        unit.wirkungen = Wirkung.getWirkungenFromElement(unitLink.parentElement, true);
                    }
                    if (unit.position !== "") {
                        result.push(unit);
                    }
                }
                return result;
            }
        }

        class Action {
            unit;
            fertigkeit;
            targets;
            src;

            constructor(unit) {
                this.unit = unit;
            }

        }

        class Actions {

            static parse(curRound, actionTR, initiativeTD, actionTD, targetTD) {
                var actionText = actionTD.innerText;
                var who;
                var wurf;
                var mp;
                const [fertigkeiten, unit] = this.actionParse(curRound, actionTD);
                // Parse Targets
                var curTargetUnit
                var currentTarget
                var currentLine = [];
                var lineNr = 0;
                var targets = [];

                function addTarget() {
                    var line = _.util.arrayMap(currentLine, a => a.textContent).join("");
                    currentTarget = new Target(line);
                    currentTarget.unit = curTargetUnit;
                    targets.push(currentTarget);
                }

                for (const curElement of targetTD.childNodes) {
                    const unitIdCheck = ReportParser.getUnitIdFromElement(curElement, unit.id);
                    if (unitIdCheck) {
                        lineNr = 1;
                        curTargetUnit = curRound.unitLookup(unitIdCheck);
                        currentLine.push(curElement);
                        currentTarget = null;
                    } else if (lineNr === -1) {
                        // ignorieren solange bis neue Entität kommt
                    } else if (curElement.tagName === "BR") {
                        if (lineNr === 1) { // Erste-Zeile beendet wir setzen das Target
                            addTarget();
                        }
                        currentLine = [];
                        lineNr++;
                    } else {
                        if (lineNr > 1) { // Nachfolgende DamageLines direkt auswerten
                            //console.log("here: "+currentTarget+" "+lineNr+" => "+curElement.textContent);
                            if (curElement.tagName === "A") { // Schaden an einem Gegenstand
                                lineNr = -1; // solange ignorieren bis eine neue Entität kommt
                            } else {
                                const damage = new Damage(curElement);
                                currentTarget.damage.push(damage);
                            }
                        } else {
                            currentLine.push(curElement);
                        }
                    }
                }
                if (lineNr === 1) {
                    addTarget();
                }

                // Action
                const actions = [];
                const myAction = new Action();
                myAction.unit = unit;
                myAction.targets = targets;
                myAction.src = actionTR.outerHTML;
                if (fertigkeiten.length === 1) {
                    myAction.fertigkeit = fertigkeiten[0];
                    actions.push(myAction);
                } else {
                    fertigkeiten.forEach(fertigkeit => {
                        const temp = _.util.cloneObject(myAction);
                        temp.fertigkeit = fertigkeiten[0];
                        actions.push(temp);
                    });
                }
                return actions;
            }

            static actionParse(curRound, actionTD) {
                const fertigkeit = {};
                const childNodes = actionTD.childNodes;
                const items = Array();
                var unit;
                const wuerfe = Array();
                for (const curNode of actionTD.childNodes) {
                    switch (curNode.tagName) {
                        case "IMG":
                            // z.B. Veredelungen => ignore
                            break;
                        case "A":
                            if (curNode.href.includes("/hero/") || curNode.href.includes("/npc/")) {
                                unit = curRound.unitLookup(ReportParser.getUnitIdFromElement(curNode));
                            } else if (curNode.href.includes("/skill/")) {
                                fertigkeit.name = curNode.textContent.trim();
                                fertigkeit.typeRef = curNode.outerHTML;
                                fertigkeit.wirkungen = Wirkung.getWirkungenFromElement(curNode);
                            } else if (curNode.href.includes("/item/")) {
                                items.push({
                                    name: curNode.textContent.trim(),
                                    srcRef: curNode.outerHTML,
                                    wirkungen: Wirkung.getWirkungenFromElement(curNode),
                                });
                            } else {
                                console.error("Unbekanntes A-Element in Action!", curNode.textContent, curNode);
                                throw Error("Unbekanntes A-Element in Action!");
                            }
                            break;
                        case "SPAN":
                            if (curNode.style.fontSize === "0.65em") {
                                //unitIdx = curNode.textContent;
                            } else if (curNode.className === "rep_mana_cost") {
                                fertigkeit.mp = curNode.textContent.match(/(\d*) MP/)[1];
                            } else if (curNode.className === "rep_gain") { // z.B. "Dunkles Erwachen"
                                let mpGain = curNode.textContent.match(/\.(\d*) MP/);
                                if (mpGain) {
                                    fertigkeit.mpGain = mpGain[1];
                                } else {
                                    let hpGain = curNode.textContent.match(/\.(\d*) HP/);
                                    if (hpGain) {
                                        fertigkeit.hpGain = hpGain[1];
                                    } else {
                                        _.util.error("Rep_Gain kann nicht aufgelöst werden", curNode.textContent);
                                    }
                                }
                            } else if (curNode.className === "rep_loss") { // z.B. "Dunkles Erwachen"
                                let mpGain = curNode.textContent.match(/\.(\d*) MP/);
                                if (mpGain) {
                                    fertigkeit.mpGain = -mpGain[1];
                                } else {
                                    let hpGain = curNode.textContent.match(/\.(\d*) HP/);
                                    if (hpGain) {
                                        fertigkeit.hpGain = -hpGain[1];
                                    } else {
                                        _.util.error("Rep_Loss kann nicht aufgelöst werden", curNode.textContent);
                                    }
                                }
                            } else if (curNode.getAttribute("onmouseover") && curNode.children[0].tagName === "A") { // Unit-Wrap z.B. für Helfer
                                unit = curRound.unitLookup(ReportParser.getUnitIdFromElement(curNode.children[0]));
                            } else {
                                console.error("Unbekanntes SPAN-Element in Action!", actionTD, curNode);
                                throw Error("Unbekanntes SPAN-Element in Action!");
                            }
                            break;
                        case "":
                        case undefined: {
                            let text = curNode.textContent.trim();
                            if (!unit) {
                                // only flavour text without unit reference
                                unit = {
                                    name: "? Ereignis",
                                    id: {
                                        name: "? Ereignis",
                                    },
                                    isHero: false,
                                    isEreignis: true,
                                }
                                fertigkeit.unit = unit;
                            }
                            if (text.length < 2) break; // skip

                            const textArray = text.trim().split("/");
                            textArray.forEach(curText => {
                                    curText = curText.trim();
                                    let wurfMatcher = curText.match(/^(\D*)?(\d+)[\.\)]?$/);
                                    if (curText.startsWith("ballert in die Menge") || curText.startsWith("wirft einen Stuhl") || curText.startsWith("schleudert einen Stuhl")) { // z.B. "Dunkles Erwachen"
                                        fertigkeit.type = "Fernkampf";
                                    } else if (curText.startsWith("Mit einem Fauchen taucht")) { // z.B. "Ahnenforschung"
                                        fertigkeit.type = "Fernkampf";
                                    } else if (curText.startsWith("Eine Flasche mit billigem Fusel nähert sich euch auf einer wirklich beeindruckenden Bahn. Kopf runter!")) { // "Offene Rechnung"
                                        fertigkeit.type = "Fernkampf";
                                        wuerfe.push({
                                            value: 100, // ??
                                        })
                                    } else if (curText.startsWith("zieht euch eins mit dem abgebrochenen Tischbein drüber") || curText.startsWith("haut daneben und erwischt fast einen Kollegen") || curText.startsWith("beißt mit ihren spitzen Zähnen zu und saugt von eurem Blut")) { // z.B. "Dunkles Erwachen"
                                        fertigkeit.type = "Nahkampf";
                                    } else if (curText.startsWith("Der Boden ist nass und glitschig") // z.B. "Rückkehr zum Zeughaus"
                                        || curText.startsWith("aus, sie dörrt Körper und Geist aus und lässt euch geschwächt zurück.") // Goldene Dracheneier
                                    ) {
                                        fertigkeit.type = "Naturgewalt";
                                    } else if (curText.startsWith("Die Lemmingflut hat diesen massiven Felsblock")) { // Reise nach Keras
                                        fertigkeit.type = "Naturgewalt";
                                        wuerfe.push({
                                            value: 100, // >53
                                        })
                                    } else if (curText.startsWith("auf sein Ziel und brüllt mit harter Stimme: DU gehörst mir!") || curText.startsWith("deutet mit seiner Waffe auf einen Gegner und brüllt mit harter Stimme: DU gehörst mir!") // "Sagenumwobener Zwergenstieg"
                                        || curText.startsWith("sind einfach überall!") || curText.startsWith("euch all eurer Kräfte.") // Goldene Dracheneier
                                    ) {
                                        fertigkeit.type = "Sozial";
                                        if (curText.startsWith("sind einfach überall!")) {
                                            wuerfe.push({
                                                value: 40,
                                            })
                                        }
                                    } else if (curText.startsWith("Ups - da ist wohl jemand untergetaucht und hat")) { // Offene Rechnung
                                        fertigkeit.type = "Krankheit";
                                    } else if (curText.startsWith("Oh je, was sind das nun wieder für")) {
                                        fertigkeit.type = "Sozial";
                                    } else if (curText.includes("Lass mich ziehen") // Eine Reise nach Keras
                                        || curText.includes("Was willst du überhaupt von mir?") // Eine Reise nach Keras
                                    ) {
                                        fertigkeit.type = "Zauber";
                                        wuerfe.push({
                                            value: 0, // ??
                                        })
                                    } else if (curText.includes("Der beschwerliche Aufstieg hat eure Stärksten")) { // Eine Reise nach Keras
                                        fertigkeit.type = "Zauber";
                                        wuerfe.push({
                                            value: 1000, // ??
                                        })
                                    } else if (curText.startsWith("verhilft dem Rentier zu besondern Fähigkeiten.")) {// Eine Reise nach Keras)
                                        fertigkeit.type = "Naturgewalt";
                                        wuerfe.push({
                                            value: 100, // >17
                                        })
                                    } else if (curText.startsWith("Borindasszas Unruhe erfaßt eure Gruppe")
                                        || curText.includes("streckt seine Linke in die Luft und ballt sie. Das hungrige Artefakt lässt einen Körper platzen und")
                                        || curText.includes("Eine Flasche mit warmem Glühwein. Dieses Getränk belebt und hält wohlig warm.") // Reise nach Keras
                                        || curText.includes("Resolut schiebt sich") // Hut ab!
                                    ) {
                                        fertigkeit.type = "Ereignis";
                                    } else if (curText.startsWith("Mit ungeahnter Wucht lösen sich Teile der schwarzen Substanz von Dnobs Körper und fliegen in alle Richtungen")) { // Herz der Schatten
                                        fertigkeit.type = "Fernkampf";
                                    } else if (curText.startsWith("versucht die aufgebrachten Gemüter zu")
                                        || curText.startsWith("Das Rentier geht eine innige Beziehung zu einem Helden ein") // Eine Reise nach Keras
                                        || curText.startsWith("Das Rentier erhält die innige Beziehung zu einem") // Eine Reise nach Keras
                                        || curText.includes("Räumt den Stein weg, ihr Narren") // Eine Reise nach Keras
                                        || curText.startsWith("Hargow braucht offenbar Platz um sich ausreichend um Xeron zu kümmern") // Eine Reise nach Keras
                                    ) {
                                        fertigkeit.type = "Wirkung";
                                    } else if (curText.startsWith("Weitere Menschen schließen sich der Gruppe an")) { // offene Rechnung, Herbeirufung
                                        fertigkeit.type = "Ereignis";
                                    } else if (curText.startsWith("Einer von euch war unvorsichtig genug")) {
                                        fertigkeit.type = "Falle";
                                        wuerfe.push({
                                            value: 70, // >67
                                        })
                                    }
                                    if (wurfMatcher) { // wurf
                                        let wo = wurfMatcher[1];
                                        if (wo && wo.endsWith(":")) {
                                            wo = wo.replace(":", "").trim();
                                        }
                                        wuerfe.push({
                                            value: wurfMatcher[2],
                                            dest: wo,
                                        })
                                    } else if (!fertigkeit.type) {
                                        curText = curText.replace("(", "").replace(")", "").trim();
                                        switch (curText) {
                                            case "auf":
                                            case "":
                                            case "Das": // z.B. "Urlaub in den Bergen"
                                            case "Der": // "Sagenumwobener Zwergenstieg"
                                            case "mit seiner Waffe deutet": // "Sagenumwobener Zwergenstieg"
                                            case "geht von": // Goldene Dracheneier
                                            case "Mit seinem": // Goldene Dracheneier
                                            case "entreißt": // Goldene Dracheneier
                                                break;
                                            case "ruft voller Schmerzen um Hilfe...": // z.B. Dungeon "Urlaub in den Bergen"
                                            case "hält sein Opfer fest gefangen und verursacht tiefe Wunden...": // z.B. Dungeon "Urlaub in den Bergen" (verursacht wohl Schaden)
                                            case "befindet sich in eurer Gefangenschaft - er wird kontrolliert von:": // z.B. Dungeon "Katz und Maus"
                                            case "wird getragen von": // z.B. Weißzahnturm Lvl4 wirkt auf 2 Charaktere
                                            // Debuff: "Den Alchemisten tragen"
                                            case "wirkt":
                                                fertigkeit.type = "Wirkung";
                                                break;
                                            case "heilt mittels":
                                                fertigkeit.type = "Heilung";
                                                break;
                                            case "greift per Fernkampf an":
                                                fertigkeit.type = "Fernkampf";
                                                break;
                                            case "greift im Nahkampf an":
                                                fertigkeit.type = "Nahkampf";
                                                break;
                                            case "greift magisch an":
                                                fertigkeit.type = "Zauber";
                                                break;
                                            case "greift sozial an":
                                                fertigkeit.type = "Sozial";
                                                break;
                                            case "greift hinterhältig an":
                                                fertigkeit.type = "Hinterhalt";
                                                break;
                                            case "verseucht":
                                                fertigkeit.type = "Krankheit";
                                                break;
                                            case "entschärft":
                                                fertigkeit.type = "Falle entschärfen";
                                                break;
                                            case "wirkt als Naturgewalt auf":
                                                fertigkeit.type = "Naturgewalt";
                                                break;
                                            case "wird ausgelöst auf":
                                                fertigkeit.type = "Falle";
                                                break;
                                            case "erwirkt eine Explosion gegen":
                                                fertigkeit.type = "Explosion";
                                                break;
                                            case "ruft herbei mittels":
                                                fertigkeit.type = "Herbeirufung";
                                                break;
                                            case "verschreckt":
                                                fertigkeit.type = "Verschrecken";
                                                break;
                                            default:
                                                console.error("Unbekannter Fertigkeits-Typ(1) ", "'" + curText + "'", actionTD);
                                                throw Error("Unbekannter Fertigkeits-Typ!(1)");
                                                break;
                                        }
                                    }
                                }
                            )
                            ;

                            break;
                        }
                        default:
                            console.error("Unbekannter Tag '" + curNode.tagName + "' Element in Action!", curNode);
                            throw Error("Unbekannter Tag '" + curNode.tagName + "' Element in Action!");
                            break;
                    }
                }
                fertigkeit.items = items;

                if (!fertigkeit.type) {
                    switch (fertigkeit.name) {
                        case "Stinkt gewaltig": // z.B. Manufaktur im verlassenden Tal
                            fertigkeit.type = "Krankheit";
                            break;
                        default:
                            console.error("Unbekannter Fertigkeits-Typ(2)", fertigkeit, actionTD);
                            fertigkeit.type = "Unbekannt: " + fertigkeit.name;
                            _.util.error("Unbekannter Fertigkeits-Typ", fertigkeit, actionTD);
                            break;
                    }
                }
                const fertigkeiten = Array();
                if (wuerfe.length <= 1) {
                    fertigkeit.wurf = wuerfe[0];
                    fertigkeiten.push(fertigkeit);
                } else {
                    wuerfe.forEach(wurf => {
                        const temp = _.util.cloneObject(fertigkeit);
                        temp.wurf = wurf;
                        fertigkeiten.push(temp);
                    })
                }
                return [fertigkeiten, unit];
            }

        }

        class ReportParser {

            static #getContentTable(container) {
                var contentTables = container.getElementsByClassName("content_table");
                {
                    for (let i = 0, l = contentTables.length; i < l; i++) {
                        var curContentTable = contentTables[i];
                        if (curContentTable.getElementsByClassName("rep_status_table").length > 0) {
                            return curContentTable;
                        }
                    }
                }
            }

            static readKampfbericht(container) {
                const roundContentTable = this.#getContentTable(container);
                const areas = Array();
                let curArea;
                const result = {};

                function closeArea(area) {
                    if (!area) return;
                    const lastRound = area.rounds[area.rounds.length - 1];
                    area.heldenEnd = lastRound.heldenEnd;
                    area.monsterEnd = lastRound.monsterEnd;
                    area.success = lastRound.success;
                    delete lastRound.heldenEnd;
                    delete lastRound.monsterEnd;
                    delete lastRound.success;
                }

                if (roundContentTable) {
                    var roundTRs = roundContentTable.children[0].children;
                    for (const roundTR of roundTRs) {
                        if (roundTR.getElementsByClassName("rep_round_headline")[0].innerText === "Runde 1") {
                            closeArea(curArea);
                            curArea = {rounds: Array()};
                            areas.push(curArea);
                        }
                        curArea.rounds.push(new Round(curArea.rounds.length + 1, roundTR));
                    }
                    closeArea(curArea);
                }
                result.areas = areas;
                console.log("Parsed Report: ", result);
                return result;
            }

            /**
             * Prüft nur auf gleiche Namen nicht auf Identität.
             */
            static isUnitEqual(unit1, unit2) {
                return unit1.id.name === unit2.id.name;
            }

            static isUnitClass(className) {
                return className && (className === "rep_hero" || className === "rep_monster" || className === "rep_myhero" || className === "rep_myotherheros");
            }

            /**
             * Allgemeine Methode, um eine Unit in einem Array zu finden
             */
            static unitSearch(unitId, unitArray) {
                if (!unitArray) return;
                for (var i = 0, l = unitArray.length; i < l; i++) {
                    const curUnit = unitArray[i];
                    if (curUnit.id.name === unitId.name && curUnit.id.index === unitId.index) {
                        return curUnit;
                    } else if (this.unitNameOhneGestalt(curUnit.id.name) === this.unitNameOhneGestalt(unitId.name) && curUnit.id.index === unitId.index) { // evtl. Gestaltwechsel!? z.B. "Dunkles Erwachen"
                        return curUnit;
                    }
                }
            }

            static unitNameOhneGestalt(unitName) {
                let matches = unitName.match(/\((.*gestalt)\)/);
                if (matches) {
                    return unitName.replace(" (" + matches[1] + ")", "");
                }
                return unitName;
            }

            //im Target kann auch "sich" stehen, das wird dann entsprechend durch die zusätzliche Angabe "unitId" ersetzt.
            static getUnitIdFromElement(element, unitId) {
                if (!element) { // Ereignis
                    return new UnitId("? Ereignis", undefined, false, true);
                }
                if (!element.tagName) {
                    if (element.textContent.includes("sich")) {
                        return unitId;
                    }
                    return;
                }
                if (element.tagName !== "A") {
                    const findElements = element.getElementsByTagName("A");
                    if (findElements.length > 0) {
                        element = findElements[0];
                    } else {
                        return;
                    }
                }
                var className = element.className;
                if (!this.isUnitClass(className)) return;

                var unitIndex;
                var sibling = element.nextSibling;
                var isHero = element.className !== "rep_monster";
                if (sibling && sibling.tagName === "SPAN") {
                    unitIndex = sibling.innerText;
                }
                return new UnitId(element.innerText, unitIndex, isHero);
            }
        }

        return ReportParser;
    }();
}

_ = demawiRepository;