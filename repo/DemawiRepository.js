class demawiRepository {

    static version = 1

    static import(type, version) {
        return this[type];
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
                    const readTo = new demawiRepository.Storages.ObjectStorage(objectStoreName, objectStoreFrom.keyPath, null, false);
                    readTo.indexedDb = dbTo;
                    objectStoresRead.push(readFrom);
                    objectStoresWrite.push(readTo);
                }
                for (var i = 0, l = objectStoresRead.length; i < l; i++) {
                    let readFrom = objectStoresRead[i];
                    let writeTo = objectStoresWrite[i];
                    for (const cur of await readFrom.getAll()) {
                        await writeTo.setValue(cur);
                    }
                }
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

            async delete(dbObjectId) {
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

}