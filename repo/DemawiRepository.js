class demawiRepository {

    static version = 1

    static import(type, version) {
        return this[type];
    }

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

        static createUploadForRead(callback) {
            const result = document.createElement("input");
            result.type = "file";
            result.onchange = function () {
                const file = result.files[0];
                const reader = new FileReader();
                reader.onload = function () {
                    callback(reader.result);
                };
                reader.readAsText(file);
            }
            return result;
        }
    }

    static Storages = class {

        static IndexedDb = class {
            modname;
            dbname;
            objectStores = [];
            dbConnection;
            static requestIdx = 0; // only for debugging

            constructor(modname, dbname) {
                this.modname = modname;
                this.dbname = dbname;
            }

            /**
             * Kopiert die aktuelle Datenbank auf den Zielort.
             * @param dbNameTo
             * @returns {Promise<void>}
             */
            async cloneTo(dbNameTo) {
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
            }

            async exportToJson() {
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

                        transaction.addEventListener('error', reject)

                        for (const storeName of idbDatabase.objectStoreNames) {
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
                                        if (
                                            idbDatabase.objectStoreNames.length ===
                                            Object.keys(exportObject).length
                                        ) {
                                            resolve(JSON.stringify(exportObject))
                                        }
                                    }
                                })
                        }
                    }
                })
            }

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

            // boolean: ob die Object-Stores entsprechend ihrer Definition installiert sind.
            areAllObjectStoresSynced(dbConnection) {
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

            // für readonly objectstores, kann man hierüber abfragen, ob der ObjectStore auch existiert
            async exists() {
                return await this.indexedDb.doesObjectStoreExist(this);
            }
        }
    }

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
                default:
                    if (typeof node.tagName === 'undefined') {
                        return ["", node.textContent.replaceAll("\n", ""), ""];
                    } else {
                        console.error("Unbekannter TagName gefunden: '" + node.tagName + "'");
                    }
            }
        }

        static toBBCodeArray(childNodes, defaultSize) {
            return demawiRepository.util.arrayMap(childNodes, a => this.toBBCode(a, defaultSize)).join("");
        }
    }

    static util = class {
        static arrayMap(list, fn) {
            var result = Array();
            for (var i = 0, l = list.length; i < l; i++) {
                result.push(fn(list[i]));
            }
            return result;
        }
    }

}