class demawi {

    static version = 1

    static import(type, version) {
        return demawi[type];
    }

    static Storages = class {

        static IndexedDb = class {
        dbname;
        objectStores = [];
        dbConnection;
        static requestIdx = 0; // only for debugging

        constructor(dbname) {
            this.dbname = dbname;
        }

        createObjectStore(storageId, key, indizes) {
            let readonly = false;
            if (indizes === true) {
                indizes = null;
                readonly = true;
            }
            let objectStore = new Storages.ObjectStorage(storageId, key, indizes, readonly);
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
                thisObject.dbConnection.close();
                alert("Die IndexDB hat sich geändert! Bitte die Seite einmal neuladen!");
            };
            return this.dbConnection;
        }

        async dbConnect(version) {
            const thisObject = this;
            return new Promise((resolve, reject) => {
                var request = indexedDB.open(thisObject.dbname, version);
                request.idx = Storages.IndexedDb.requestIdx++;
                console.log("request created " + request.idx + "_" + version);
                request.onsuccess = function (event) {
                    let dbConnection = event.target.result;
                    console.log("DBconnect success", event);
                    let needNewStores = !thisObject.areAllObjectStoresSynced(dbConnection);
                    if (needNewStores) {
                        dbConnection.close();
                        console.log("Need Database to sync " + needNewStores);
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
                    alert("Please close all other tabs with this site open!");
                    reject();
                }
                request.onupgradeneeded = async function (event) {
                    console.log("DBconnect upgradeneeded", event);
                    let dbConnection = event.target.result;
                    await thisObject.syncObjectStores(dbConnection);
                    dbConnection.close();
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