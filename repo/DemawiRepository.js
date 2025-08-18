/**
 * Allgemeine und WoD-spezifische Klassen und Hilfsmethoden.
 */
class demawiRepository {

    static version = "1.1.9";
    /**
     * Änderungen für das Subpackage CSProxy+Storages+WindowManager (CSProxy + alles was direkt oder reingereicht genutzt werden soll inkl. derer Abhängigkeiten...).
     * Da dieses nur einmalig im Responder ausgeführt wird. Erwarten alle Skripte, die diesen nutzen hier die gleiche Funktionalität.
     */
    static csProxyV = "1.2";

    /**
     * Erlaubt Skript-übergreifende Markierungen am 'window'-Objekt.
     */
    static WindowManager = class {

        static isMarked(tag, win) {
            win = win || unsafeWindow;
            return win._demrep && win._demrep[tag];
        }

        static getMark(tag, win) {
            win = win || unsafeWindow;
            return win._demrep && win._demrep[tag];
        }

        static mark(tag, value, win) {
            value = value || true;
            win = win || unsafeWindow;
            (win._demrep || (win._demrep = {}))[tag] = value;
        }

        /**
         * Führt die Funktion (pro 'tagId') in diesem unsafeWindow nur einmalig aus, auch wenn mehrere Mods diese aufrufen.
         * Das Resultat wird über ein Promise an alle ausgeliefert.
         */
        static async onlyOnce(tagId, asyncFunction) {
            let functionMark = this.getMark(tagId);
            if (functionMark) return functionMark;
            functionMark = new Promise((resolve, reject) => {
                resolve(asyncFunction());
            });
            this.mark(tagId, functionMark);
            return functionMark;
        }

        static getRootWindow(win) {
            win = win || unsafeWindow || window;
            if (win.opener) return this.getRootWindow(win.opener);
            if (win.top && win.top !== win) return this.getRootWindow(win.top);
            return win;
        }

        /**
         *
         * @param doc
         * @param callback
         */
        static addRevisitListener(win, callback) {
            let triggered = true;
            const handleRevisit = function (evt) {
                if (triggered) {
                    triggered = false;
                    setTimeout(() => {
                        triggered = true;
                    }, 100);
                    callback(evt);
                }
            }
            win.document.addEventListener("visibilitychange", evt => {
                if (document.visibilityState === "visible") {
                    handleRevisit(evt);
                }
            });
            win.addEventListener("focus", handleRevisit);
        }
    }

    /**
     * Indexed-DB Framework.
     * Direkte Nutzung sowie auch Cross-Site-Proxy-Nutzung.
     */
    static Storages = class {

        static ORDER = {
            NEXT: "next",
            NEXTUNIQUE: "nextunique",
            PREV: "prev",
            PREVUNIQUE: "prevunique",
        }

        static MATCHER = {
            NUMBER: {
                ANY: ["anynumber"], // muss eindeutig auch nach Clonung identifizierbar sein, wird deshalb als Objekt abgelegt.
                MIN: Number.MIN_VALUE,
                MAX: Number.MAX_VALUE,
            },
            STRING: {
                ANY: ["anystring"], // muss eindeutig auch nach Clonung identifizierbar sein, wird deshalb als Objekt abgelegt.
                MIN: "",
                MAX: "\uffff",
            },
        }

        static IndexedDbProxy = class IndexedDbProxy {

            static #indexDbCache = {};

            static getDb(dbname, modname, idbFactory) {
                let result = this.#indexDbCache[dbname];
                if (result) return result;
                if (!modname) throw new Error("Datenbank muss einmalig zuvor durchd die Mod definiert werden: '" + dbname + "' Bisher angesprochen: " + JSON.stringify(this.#indexDbCache));
                result = new IndexedDbProxy(dbname, modname, idbFactory);
                this.#indexDbCache[dbname] = result;
                return result;
            }

            csProxy; // Cross-Site Database
            objectStores = {};
            longQuery = 1000; // wenn ein Query länger als diese Zeit (in msecs) benötigt, wird eine Warning ausgegeben

            constructor(dbname, modname, csProxyPromise) {
                this.modname = modname;
                this.dbname = dbname;
                const _this = this;
                this.csProxyResolver = csProxyPromise.then(csProxy => {
                    _this.csProxy = csProxy;
                    delete _this.csProxyResolver;
                });
            }

            async executeProxyCall(...args) {
                if (this.csProxy) return this.csProxy.exec(...args);
                else {
                    const _this = this;
                    return this.csProxyResolver.then(() => {
                        _this.csProxy.exec(...args);
                    });
                }
            }

            async executeProxyIteration(iterationFn, ...args) {
                if (this.csProxy) return this.csProxy.execIteration(iterationFn, ...args);
                else {
                    const _this = this;
                    return this.csProxyResolver.then(() => {
                        _this.csProxy.execIteration(iterationFn, ...args);
                    });
                }
            }

            createObjectStorage(storageId, key, indizes) {
                const objectStore = new _.Storages.ObjectStorageProxy(storageId, key, indizes);
                objectStore.indexedDb = this;
                const _this = this;
                this.executeProxyCall(async function (modname, dbname, storageId, key, indizes) {
                    await _.Storages.IndexedDb.getDb(dbname, modname).createObjectStorage(storageId, key, indizes);
                }, _this.modname, _this.dbname, storageId, key, indizes);

                this.objectStores[storageId] = objectStore;
                return objectStore;
            }

            async cloneTo(dbNameTo) {
                await this.executeProxyCall(async function (dbNameFrom, dbNameTo) {
                    await _.Storages.IndexedDb.getDb(dbNameFrom, "").cloneTo(dbNameTo);
                }, this.dbname, dbNameTo);
            }

            async deleteObjectStorage(storageId) {
                await this.executeProxyCall(async function (dbName, storageId) {
                    await _.Storages.IndexedDb.getDb(dbName, "").deleteObjectStorage(storageId);
                }, this.dbname, storageId);
            }

        }

        static ObjectStorageProxy = class {

            storageId;
            key;
            indizes;
            indexedDb;

            constructor(storageId, key, indizes) {
                this.storageId = storageId;
                this.key = key;
                this.indizes = indizes;
            }

            async getValue(dbObjectId) {
                return this.indexedDb.executeProxyCall(async function (storageId, dbname, dbObjectId) {
                    return await _.Storages.IndexedDb.getDb(dbname).getObjectStorage(storageId).getValue(dbObjectId);
                }, this.storageId, this.indexedDb.dbname, dbObjectId);
            }

            async setValue(dbObject) {
                return this.indexedDb.executeProxyCall(async function (storageId, dbname, dbObject) {
                    return await _.Storages.IndexedDb.getDb(dbname).getObjectStorage(storageId).setValue(dbObject);
                }, this.storageId, this.indexedDb.dbname, dbObject);
            }

            async deleteValue(dbObjectId) {
                return this.indexedDb.executeProxyCall(async function (storageId, dbname, dbObjectId) {
                    return await _.Storages.IndexedDb.getDb(dbname).getObjectStorage(storageId).deleteValue(dbObjectId);
                }, this.storageId, this.indexedDb.dbname, dbObjectId);
            }

            async count(query) {
                return this.indexedDb.executeProxyCall(async function (storageId, dbname, query) {
                    return await _.Storages.IndexedDb.getDb(dbname).getObjectStorage(storageId).count(query);
                }, this.storageId, this.indexedDb.dbname, query);
            }

            async getAll(query, iterationFnOpt) {
                const dbName = this.indexedDb.dbname;
                const storageId = this.storageId;
                if (!iterationFnOpt) {
                    return this.indexedDb.executeProxyCall(async function (storageId, dbname, query) {
                        return await _.Storages.IndexedDb.getDb(dbname).getObjectStorage(storageId).getAll(query);
                    }, storageId, dbName, query);
                }
                return this.indexedDb.executeProxyIteration(iterationFnOpt, async function (storageId, dbname, query) {
                    await _.Storages.IndexedDb.getDb(dbname).getObjectStorage(storageId).getAll(query, async function (a) {
                        return await respondIteration(data, a);
                    });
                    respondFinished(data);
                }, storageId, dbName, query);
            }

            async getAllKeys(query, iterationFnOpt) {
                const dbName = this.indexedDb.dbname;
                const storageId = this.storageId;
                if (!iterationFnOpt) {
                    return this.indexedDb.executeProxyCall(async function (storageId, dbname, queryOpt) {
                        return await _.Storages.IndexedDb.getDb(dbname).getObjectStorage(storageId).getAllKeys(queryOpt);
                    }, storageId, dbName, query);
                }
                return await this.indexedDb.executeProxyIteration(iterationFnOpt, async function (storageId, dbname, queryOpt) {
                    await _.Storages.IndexedDb.getDb(dbname).getObjectStorage(storageId).getAllKeys(queryOpt, async function (a) {
                        return await respondIteration(data, a);
                    });
                    respondFinished(data);
                }, storageId, dbName, query);
            }
        }

        static IndexedDb = class IndexedDb {

            static #indexDbCache = {};
            static staticInstanceId = 1;

            static getDb(dbname, modname, idbFactory) {
                let result = this.#indexDbCache[dbname];
                if (result) return result;
                if (!modname) throw new Error("Datenbank muss einmalig zuvor durchd die Mod definiert werden: '" + dbname + "' Bisher angesprochen: " + JSON.stringify(this.#indexDbCache));
                result = new IndexedDb(dbname, modname, idbFactory);
                this.#indexDbCache[dbname] = result;
                return result;
            }

            modname;
            dbname;
            idbFactory;
            objectStores = {};
            objectStoresToDelete = [];
            dbConnection;
            instanceId;
            requestIdx = 1; // only for debugging
            debug = false;
            longQuery = 1000; // wenn ein Query länger als diese Zeit (in msecs) benötigt, wird eine Warning ausgegeben

            constructor(dbname, modname, idbFactory) {
                this.modname = modname;
                this.dbname = dbname;
                this.idbFactory = idbFactory || indexedDB;
                this.instanceId = this.constructor.staticInstanceId++;
            }

            /**
             * Prüft, ob der ObjectStore existiert. Wenn er dies tut, wird dieser zurückgeliefert.
             */
            async getObjectStorageChecked(storageId) {
                let result = this.getObjectStorage(storageId);
                if (result) return result;
                const dbConnection = await this.getConnection();
                if (dbConnection.objectStoreNames.contains(storageId)) {
                    return this.#addObjectStorage(storageId);
                }
            }

            getObjectStorage(storageId) {
                return this.objectStores[storageId];
            }

            #addObjectStorage(storageId, key, indizes, readonly) {
                const objectStore = new demawiRepository.Storages.ObjectStorage(storageId, key, indizes, readonly);
                objectStore.indexedDb = this;
                this.objectStores[storageId] = objectStore;
                return objectStore;
            }

            /**
             * Sofern nicht vorhanden wird der Object-Store erstellt.
             * @returns {Promise<demawiRepository.Storages.ObjectStorage>}
             */
            createObjectStorage(storageId, key, indizes) {
                let readonly = false;
                if (indizes === true) {
                    indizes = null;
                    readonly = true;
                }
                let objectStore = this.objectStores[storageId];
                if (!objectStore) {
                    objectStore = this.#addObjectStorage(storageId, key, indizes, readonly);
                    if (this.dbConnection && !this.#areAllObjectStoresSynced(this.dbConnection)) {
                        this.forceReconnect("create object store " + storageId);
                    } // kein instant-reconnect, da sich evtl. noch andere Object-Stores registrieren
                }
                return objectStore;
            }

            /**
             * @returns {Promise<DOMStringList>}
             */
            async getObjectStoreNames() {
                const dbConnection = await this.getConnection();
                return dbConnection.objectStoreNames;
            }

            deleteObjectStorage(storageId) {
                this.objectStoresToDelete.push(storageId);
                if (this.dbConnection) this.forceReconnect("delete object " + storageId);
            }

            async doesObjectStorageExist(objectStore) {
                let dbConnection = await this.getConnection();
                return dbConnection.objectStoreNames.contains(objectStore.storageId);
            }

            closeConnection(grund, event) {
                if (this.debug) console.log("Close connection", grund, event);
                if (this.dbConnection) {
                    this.#closeGivenConnection(this.dbConnection);
                    delete this.dbConnection;
                }
            }

            /**
             * Die Datenbank-Definition hat sich irgendwo geändert (ObjectStores, Indizes), wir wollen bei
             * der nächsten Nutzung eine sync durchführen.
             */
            forceReconnect(grund) {
                // Die Definition hat sich geändert, es müssen nochmal die Definitionen überprüft werden
                this.closeConnection("reportDbHasChanged " + grund);
            }

            #closeGivenConnection(dbConnection, requestOpt) {
                if (requestOpt) {
                    delete requestOpt.onsuccess;
                    delete requestOpt.onerror;
                    delete requestOpt.onblocked;
                    delete requestOpt.onupgradeneeded;
                }
                delete dbConnection.onversionchange;
                dbConnection.close();
            }

            /**
             * @return IDBDatabase
             */
            async getConnection(...args) {
                if (args.length > 0) {
                    if (this.debug) console.log("ForceUpgradeGrund: ", ...args);
                    return await this.#dbConnect(true);
                }
                if (this.dbConnection) return this.dbConnection;
                return await this.#dbConnect(false);
            }

            /**
             * Wrapped {this.#dbConnectIntern}. Es können damit nur maximal gleichzeitige ConnectionProzesse aktiv sein einmal für forceUpgrade=false und einmal für forceUpgrade=true
             * @returns {Promise<*>}
             */
            async #dbConnect(forceUpgrade) {
                const _this = this;
                const connectProcesses = this.connectProcesses || (this.connectProcesses = {});
                // Wenn ein forcierter Prozess aussteht, wollen wir uns auch als forceUpgrade=false primär an diesen anhängen, da wir eh das Update abwarten müssen
                const connectProcess = connectProcesses[true] || connectProcesses[forceUpgrade] || (connectProcesses[forceUpgrade] = this.#dbConnectIntern(forceUpgrade).then(con => {
                    if (_this.dbConnection) _this.closeConnection("Neue Connection erstellt");
                    _this.dbConnection = con;
                    // Wir oder eine andere Instanz (Seite oder Mod) hat einen VersionChange getriggert, insofern invalidieren wir vorsichtshalber unsere Verbindung.
                    _this.dbConnection.onversionchange = function (event) {
                        _this.closeConnection("onversion change", event);
                    };
                    delete connectProcesses[forceUpgrade];
                    return con;
                }));
                return await connectProcess;
            }

            /**
             * @returns IDBDatabase
             */
            async #dbConnectIntern(forceUpgrade, tracingId) {
                let version;
                if (forceUpgrade) {
                    if (this.dbConnection) version = this.dbConnection.version + 1;
                    else version = new Date().getTime();
                }

                if (this.debug) tracingId = tracingId || [];
                const _this = this;
                const requestId = this.requestIdx++;
                return new Promise((resolve, reject) => {
                    let request = _this.idbFactory.open(_this.dbname, version);
                    request.idx = requestId;
                    if (_this.debug) {
                        tracingId.push(request.idx);
                        console.log("Request-Open[" + _this.instanceId + ":" + request.idx + "]: " + _this.modname + " " + _this.dbname + ":" + version + " ", tracingId, _this.dbConnection);
                    }
                    // console.log("request created " + request.idx + "_" + version);
                    request.onsuccess = function (event) {
                        if (_this.debug) console.log("Request-success[" + _this.instanceId + ":" + request.idx + "]: " + _this.modname + " " + _this.dbname + ":" + version, tracingId);
                        let dbConnection = event.target.result; // type: IDBDatabase
                        let needNewStores = !_this.#areAllObjectStoresSynced(dbConnection);
                        if (needNewStores) {
                            _this.#closeGivenConnection(dbConnection, request);
                            resolve(_this.#dbConnectIntern(true, tracingId)); // force upgrade
                        } else {
                            resolve(event.target.result);
                        }
                    }
                    // z.B. "AbortError: The connection was closed."
                    request.onerror = function (event) {
                        if (_this.debug) console.log("Request-error[" + _this.instanceId + ":" + request.idx + "]: " + _this.modname + " " + _this.dbname + ":" + version, tracingId, event);
                        // console.log("DBconnect error", event);
                        resolve(_this.#dbConnectIntern(undefined, tracingId));
                    }
                    request.onblocked = function (event) {
                        console.warn("Request-blocked[" + _this.instanceId + ":" + request.idx + "]: " + _this.modname + " " + _this.dbname + ":" + version, tracingId);
                        // hier heißt es abwarten.. kann immer noch successen
                    }
                    request.onupgradeneeded = async function (event) {
                        if (_this.debug) console.log("Request-upgradeneed[" + _this.instanceId + ":" + request.idx + "]: " + _this.modname + " " + _this.dbname + ":" + version, tracingId);
                        const dbConnection = event.target.result;
                        const tx = event.target.transaction;
                        await _this.#syncDatabase(dbConnection, tx);
                    }
                });
            }

            /**
             * synchronisiert die Datenbank mit den gewünschten ObjectStore-Definitionen
             * wird innerhalb eines onupgradeneedevents ausgeführt
             * @param dbConnection @type IDBDatabase
             * @param dbTransaction @type IDBTransaction
             */
            async #syncDatabase(dbConnection, dbTransaction) {
                if (this.debug) console.log("[" + this.dbname + "]: syncDatabase...", this);
                let thingsDone = 0;
                try {
                    this.objectStoresToDelete.slice().forEach((storageId, idx) => {
                        if (dbConnection.objectStoreNames.contains(storageId)) {
                            thingsDone++;
                            if (this.debug) console.log("Lösche Objectstore " + this.dbname + "." + storageId);
                            dbConnection.deleteObjectStore(storageId);
                        }
                        this.objectStoresToDelete.splice(idx, 1);
                    });
                    Object.values(this.objectStores).forEach(objectStoreDef => {
                        if (objectStoreDef.readonly) return;
                        const storageId = objectStoreDef.storageId;
                        let dbStore;
                        // Ensure dbStore exists
                        if (dbConnection.objectStoreNames.contains(storageId)) {
                            dbStore = dbTransaction.objectStore(storageId);
                        } else {
                            // create complete new object store (IDBObjectStore)
                            thingsDone++;
                            if (this.debug) console.log("Erstelle nicht vorhandenen Object-Store: ", storageId);
                            dbStore = dbConnection.createObjectStore(objectStoreDef.storageId, {
                                keyPath: objectStoreDef.primaryKey,
                            });
                        }
                        if (objectStoreDef.indizesToDelete) {
                            for (const indexName of objectStoreDef.indizesToDelete) {
                                if (dbStore.indexNames.contains(indexName)) {
                                    thingsDone++;
                                    if (this.debug) console.log("[" + this.dbname + "|" + storageId + "] Entferne Index: " + indexName);
                                    dbStore.deleteIndex(indexName);
                                }
                            }
                        }
                        // Ensure indizes exists
                        if (objectStoreDef.indizesToEnsure) {
                            for (const [indexName, keyPath] of Object.entries(objectStoreDef.indizesToEnsure)) {
                                if (!dbStore.indexNames.contains(indexName)) {
                                    thingsDone++;
                                    if (this.debug) console.log("[" + this.dbname + "|" + storageId + "] Füge neuen Index hinzu: " + indexName + " => ", keyPath);
                                    dbStore.createIndex(indexName, keyPath);
                                }
                            }
                        }
                        delete objectStoreDef.indizesToDelete;
                        delete objectStoreDef.indizesToEnsure;
                    });
                } catch (exception) {
                    console.error("syncDatabase konnte nicht durchgeführt werden!", exception);
                    throw exception;
                }
                return true;
            }

            /**
             * @param dbConnection type: IDBDatabase
             * @return boolean: ob die Object-Stores entsprechend ihrer Definition installiert/deinstalliert sind.
             */
            #areAllObjectStoresSynced(dbConnection) {
                if (this.objectStoresToDelete.length > 0) return false;
                const installedNames = dbConnection.objectStoreNames; // Array
                for (const objectStore of Object.values(this.objectStores)) {
                    if (objectStore.readonly) continue;
                    if (!installedNames.contains(objectStore.storageId)) return false;
                }
                return true;
            }

            /**
             * Kopiert die aktuelle Datenbank komplett in eine andere Datenbank.
             * @param dbTo kann eine Instanz von IndexedDb/IndexedDbProxy sein oder einfach ein Name. Der Name wird für die lokale origin-Datenbank verwendet.
             * @returns {Promise<void>}
             */
            async cloneTo(dbTo) {
                dbTo = typeof dbTo === "string" ? demawiRepository.Storages.IndexedDb.getDb(dbTo, this.modname) : dbTo;
                const dbName = dbTo.dbname;
                console.log("Clone '" + this.dbname + "' to '", dbName);
                const dbConnectionFrom = await this.getConnection();
                const objectStoreNames = dbConnectionFrom.objectStoreNames; // Array
                for (const objectStoreName of objectStoreNames) {
                    const readFrom = await this.getObjectStorageChecked(objectStoreName);
                    const writeTo = await dbTo.createObjectStorage(objectStoreName, await readFrom.getPrimaryKey());
                    const objectCount = await readFrom.count();
                    console.log("Clone '" + this.dbname + "' to '" + dbName + "'... " + objectStoreName + "... (" + objectCount + " objects)");
                    await readFrom.getAll(false, async cur => {
                        await writeTo.setValue(cur);
                    })
                }
                console.log("Clone " + this.dbname + " to " + dbTo + "... finished!");
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
        }

        static ObjectStorage = class {
            indexedDb;
            storageId;
            primaryKey;
            readonly;
            // ChangeManagement...
            indizesToEnsure; // indexName => keyPath, werden nur einmalig geprüft
            indizesToDelete; // indexNames

            constructor(storageId, primaryKey, indizes, readonly) {
                this.storageId = storageId;
                this.primaryKey = primaryKey;
                this.indizesToEnsure = indizes;
                this.readonly = readonly;
            }

            /**
             * @returns {Promise<IDBObjectStore|*>}
             */
            async connect(withWrite) {
                let connection = await this.indexedDb.getConnection();
                let transaction = connection.transaction(this.storageId, withWrite ? "readwrite" : "readonly");
                let objectStore = transaction.objectStore(this.storageId);
                if (!this.#areAllIndicesSynced(objectStore)) {
                    // Es sind nicht alle Indizes installiert, wir forcieren ein update und machen alles nochmal
                    await this.indexedDb.getConnection("[" + this.indexedDb.dbname + "." + this.storageId + "} Indizes müssen gesynced werden", this.indizesToDelete, this.indizesToEnsure);
                    return await this.connect(withWrite);
                }
                return objectStore;
            }

            /**
             * Aktuell nur Installation ohne Check auf den keyPath
             */
            #areAllIndicesSynced(dbObjectStore) {
                if (this.indizesToDelete) return false;
                if (!this.indizesToEnsure) return true;
                for (const [indexName, keyPath] of Object.entries(this.indizesToEnsure)) {
                    if (!dbObjectStore.indexNames.contains(indexName)) return false;
                }
                delete this.indizesToEnsure; // wird nur einmalig geprüft
                return true;
            }

            async setValue(dbObject) {
                const thisObject = this;
                return new Promise(async (resolve, reject) => {
                    const objectStore = await thisObject.connect(true);
                    //console.log("SetValue: " + dbObject.id, dbObject, objectStore.keyPath, objectStore);
                    const request = objectStore.put(dbObject);
                    request.onsuccess = function (event) {
                        resolve();
                    };
                    request.onerror = function (event) {
                        reject();
                    }
                });
            }

            ensureIndex(indexName, keyPath, myDebug) {
                const indizesToEnsure = this.indizesToEnsure || (this.indizesToEnsure = {});
                indizesToEnsure[indexName] = keyPath;
                if (myDebug) this.indexedDb.forceReconnect("Ensure Index " + indexName, keyPath);
            }

            deleteIndex(indexName, myDebug) {
                if (!this.indizesToDelete) this.indizesToDelete = [];
                this.indizesToDelete.push(indexName);
                if (myDebug) this.indexedDb.forceReconnect("Delete Index " + indexName);
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
                    const objectStore = await thisObject.connect(false);
                    const request = objectStore.get(dbObjectId);
                    request.onsuccess = function (event) {
                        const result = event.target.result;
                        if (result) resolve(cloneInto(result, {})); // für FF benötigt, damit auch wenn man nur lokal auf die DB zugreift kein Cross-Origin-Problem auftritt
                        else resolve(result);
                    };
                    request.onerror = function (event) {
                        console.log("getValue-error");
                    }
                    request.onblocked = function () {
                        console.log("getValue-blocked")
                    }
                    request.onupgradeneeded = function () {
                        console.log("getValue-onupgradeneeded")
                    }
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
            async count(query) { // TODO: with query
                const _this = this;
                return new Promise(async (resolve, reject) => {
                    const connection = await _this.indexedDb.getConnection();
                    const transaction = connection.transaction(this.storageId, "readonly");
                    const objectStore = transaction.objectStore(this.storageId);
                    const [target, keyRange] = await this.constructor.QueryOps.getTargetAndKeyRange(_this, objectStore, query);
                    const request = target.count(keyRange);
                    request.onsuccess = function (event) {
                        const result = event.target.result;
                        resolve(result);
                    };
                });
            }

            async getPrimaryKey() {
                if (this.primaryKey) return this.primaryKey;
                const thisObject = this;
                this.primaryKey = await new Promise(async (resolve, reject) => {
                    const connection = await thisObject.indexedDb.getConnection();
                    const transaction = connection.transaction(this.storageId, "readonly");
                    const objectStore = transaction.objectStore(this.storageId);
                    resolve(objectStore.keyPath);
                });
                return this.primaryKey;
            }

            async getMissingEntries(indexName) {
                const connection = await this.indexedDb.getConnection();
                const transaction = connection.transaction(this.storageId, "readonly");
                const objectStore = transaction.objectStore(this.storageId);
                const index = objectStore.index(indexName);
                const indexKeys = await this.constructor.QueryOps.awaitRequest(index.getAllKeys());
                const objectStoreKeys = await this.constructor.QueryOps.awaitRequest(objectStore.getAllKeys());
                return objectStoreKeys.filter(k => !indexKeys.includes(k));
            }

            /**
             * @param queryOpt Sofern angegeben hat queryOpt folgende Struktur. Es lässt sich damit über die Datenbank filtern und auch sortieren.
             * {
             *     index: ["ts", "item.loc"], // Angabe der Indizes über die eingeschränkt oder sortiert werden soll, sofern ein solcher Index noch nicht vorhanden ist, wird er adHoc erstellt.
             *     order: "prev", // ein String Wert aus ORDER, sortiert die Ergebnisse, bzw. kann mit den "unique"-Parametern auch Einträge überspringen. Sortiert wird abhängig von der Reihenfolge im angegebenen Index.
             *     keyMatch: [_Storages.MATCHER.NUMBER.ANY, "Ahnenforschung"], // [IDBKeyRange|Array] der Array definiert Matches mit der gleichen Länge wie der Index-Array. Es können aber auch Wildcards aus _Storages.Matcher genutzt werden.
             *     keyMatchAfter: [1, "Ahnenforschung"] // [Array] wird als lowerBound verwendet. Sofern die untere Schranke nicht bekannt ist, können auch Wildcards verwendet werden.
             *     keyMatcheTo: [1231233, "Balesh"], // [Array] wird als upperBound verwendet. Sofern die obere Schranke nicht bekannt ist, können auch Wildcards verwendet werden.
             *     keyMatchAfterOpen: true, // schließt den angegebenen Wert an der unteren Grenze aus (z.B. Ahnenforschung wäre dann selbst nicht mit dabei)
             *     keyMatchBeforeOpen: true, // schließt den angegebenen Wert an der oberen Grenze aus (z.B. Balesh wäre dann selbst nicht mit dabei)
             *     limit: 20,             // [int] eine Limitierung der Ergebnisse
             *     batchSize: 100,        // [int] default:100 wie viele Objekte maximal gleichzeitig aus der Datenbank geholt werden, wird dieses angegeben muss eine iterationFn angegeben werden
             * }
             * @param iterationFnOpt @type Function(object, idx): die Objekte werden der Reihe nach in die Methode reingereicht, bei false wird die Schleife abgebrochen oder bei gesetztem query-limit
             *                    die Funktion darf mittlerweile auch async sein. Dann wird allerdings die Batch-Search verwendet. Abhängig von der BatchSize werden x-Objekte jeweils geholt und diese dann reingereicht.
             *                    Danach wird erneut eine Transaktion aufgebaut für den nächsten Batch.
             * @return wenn iteration nicht gesetzt wird, wird ein Array der Objekte zurückgeliefert
             *         wenn iteration gesetzt ist, werden die Objekte einem nach dem anderen in die iteration-Funktion reingereicht iteration(object, idx), der Rückgabewert von getAll ist dann nicht gesetzt.
             */
            async getAll(queryOpt, iterationFnOpt) {
                return this.constructor.QueryOps.doSearch(this, queryOpt, iterationFnOpt, "getAll");
            }

            /**
             * Liefert ein Array über alle vorhandenen Objekte.
             */
            async getAllKeys(queryOpt, iterationFnOpt) {
                return this.constructor.QueryOps.doSearch(this, queryOpt, iterationFnOpt, "getAllKeys");
            }

            // für readonly objectstores, kann man hierüber abfragen, ob der ObjectStore auch existiert
            async exists() {
                return await this.indexedDb.doesObjectStorageExist(this);
            }

            async copyTo(toObjectStore) {
                await this.getAll(false, async object => {
                    await toObjectStore.setValue(object);
                })
            }

            async cloneTo(toObjectStore, overwrite) {
                console.log("Clone objectstore '" + this.storageId + "' to '" + toObjectStore.storageId + "'...");
                if (!overwrite && (await toObjectStore.getAllKeys()).length !== 0) {
                    console.error("Zielobjectstore '" + toObjectStore.storageId + "' ist nicht leer!");
                    return;
                }
                console.log("Clone objectstore '" + this.storageId + "' to '" + toObjectStore.storageId + "'... starte...");
                await this.copyTo(toObjectStore);
                console.log("Clone objectstore '" + this.storageId + "' to '" + toObjectStore.storageId + "'... finished!");
            }

            /**
             * Die erste Anfrage wird standard-gemäß der query.batchSize (default = 100) ausgeführt.
             * Für nachfolgende Anfragen wird der Query angepasst und
             * für Vorwärtssuche: keyMatchAfter und keyMatchAfterOpen
             * für Rückwartssuche: keyMatchBefore und keyMatchBeforeOpen
             * gesetzt.
             * Abhängig der query.batchSize wird den Unteranfragen ein entsprechendes query.limit mitgegeben.
             */
            static BatchSearch = class BatchSearch {
                objectStorage;
                idbObjectStore;
                idbTarget;
                query;
                iteration;
                retrieveFnName; // getAll oder getAllKeys
                batchSize;
                limit;
                alreadyFetched = 0;
                indexKeyPath; // indexKeyPath für die 2,3... Suche
                pointerName; // keyMatchAfter oder keyMatchBefore, je nachdem in welcher Richtung der ObjectStore durchgegangen wird.
                idx = 1;

                constructor(objectStorage, idbObjectStore, idbTarget, query, iteration, retrieveFnName) {
                    if (retrieveFnName !== "getAll") throw new Error("Für den Batch-Search wird bisher nur 'getAll' unterstützt");
                    this.objectStorage = objectStorage;
                    this.idbObjectStore = idbObjectStore;
                    this.idbTarget = idbTarget;
                    this.query = query;
                    this.iteration = iteration;
                    this.limit = this.query.limit || Number.MAX_VALUE;
                    this.retrieveFnName = retrieveFnName;
                    this.batchSize = query.batchSize || 20;
                    delete query.batchSize; // für die Subanfragen selbst soll keine Batch-Search verwendet werden
                }

                async batchIt() {
                    await (a => {
                    })(); // erst die nachfolgenden Debug-Werte ändern wenn wir wirklich dran sind.
                    const debug = this.query.debug;
                    if (debug === 2) this.query.debug = 1;
                    else delete this.query.debug;
                    while (await this.#run() !== true) ;
                    this.query.debug = debug;
                    delete this.query.subQueryId;
                    if (this.query.debug) console.log("Batch-Query fertig!");
                }

                async #run() {
                    this.query.limit = Math.min(this.batchSize, this.limit);
                    const results = await this.objectStorage[this.retrieveFnName](this.query);
                    this.query.subQueryId = "BatchSearch#" + this.idx++;
                    if (this.query.debug) console.log("Batch-query: ", this.query, results.length);
                    for (let i = 0, l = results.length; i < l; i++) {
                        if (await this.iteration(results[i], this.alreadyFetched + i) === false) return true;
                    }
                    this.alreadyFetched += results.length;
                    this.limit -= results.length;
                    // Limit erreicht oder Anzahl der Resulstate weniger als erwartet=keine weiteren Ergebnisse aus der Datenbank
                    if (this.query.limit < 0 || results.length < this.batchSize) return true;

                    if (!this.indexKeyPath) { // wird nur einmalig nach dem ersten Request durchgeführt
                        if (this.idbObjectStore === this.idbTarget) {
                            this.indexKeyPath = this.idbObjectStore.keyPath;
                        } else {
                            let primaryKey = this.idbObjectStore.keyPath;
                            if (typeof primaryKey === "string") primaryKey = [primaryKey];
                            let indexDef = this.idbTarget.keyPath;
                            if (typeof indexDef === "string") indexDef = [indexDef];
                            for (const cur of primaryKey) {
                                if (!indexDef.includes(cur)) indexDef.push(cur);
                            }
                            this.indexKeyPath = indexDef;
                            this.query.index = indexDef;
                        }
                        if (!this.query.order || this.query.order.startsWith("next")) {
                            this.query.keyMatchAfterOpen = true;
                            this.pointerName = "keyMatchAfter";
                            if (this.query.keyMatch) this.query.keyMatchBefore = this.query.keyMatch;
                        } else {
                            this.query.keyMatchBeforeOpen = true;
                            this.pointerName = "keyMatchBefore";
                            if (this.query.keyMatch) this.query.keyMatchAfter = this.query.keyMatch;
                        }
                        delete this.query.keyMatch;
                        if (this.query.debug) console.log("Batch-query Index wurde ggf. angepasst ", this.query);
                    }
                    // TODO: funktioniert nur bei "getAll". Bei "getAllKeys" könnten wir den Pointer nicht neu setzen
                    this.query[this.pointerName] = await this.constructor.getValuesFor(results[results.length - 1], this.indexKeyPath);
                }

                static async getValuesFor(dataStoreObject, keyPath) {
                    if (typeof keyPath === "string") return this.#getValueFromObject(dataStoreObject, keyPath);
                    const result = [];
                    for (const cur of keyPath) {
                        result.push(this.#getValueFromObject(dataStoreObject, cur));
                    }
                    return result;
                }

                static #getValueFromObject(object, pathToValue) {
                    return pathToValue.split('.').reduce((previous, current) => previous[current], object);
                }
            }

            static QueryOps = class QueryOps {

                static async getTargetAndKeyRange(objectStorage, objectStore, query) {
                    query = query || {};
                    let target = objectStore;
                    if (query.index) target = await objectStorage.constructor.TargetOps.getQueryTarget(objectStorage, target, query);
                    const keyRange = await this.getOptionalKeyRange(objectStorage, target, query);
                    return [target, keyRange];
                }

                static async getOptionalKeyRange(objectStorage, target, query) {
                    let keyRange;
                    if (query.keyMatch || query.keyMatchAfter || query.keyMatchBefore) {
                        keyRange = await this.#getQueryKeyRange(objectStorage, target, query, query.keyMatch, query.keyMatchAfter, query.keyMatchBefore, query.keyMatchAfterOpen, query.keyMatchBeforeOpen);
                    }
                    return keyRange;
                }

                /**
                 * @param retrieveFnName was wird als Resultat erwartet nur die Primärschlüssel oder die Objekte selbst.
                 * @returns {Promise<any>}
                 */
                static async doSearch(objectStorage, query, iterationOpt, retrieveFnName) {
                    const ignoreWarning = query === false;
                    query = query || {};
                    const startTime = new Date().getTime();
                    const isGetAllKeys = retrieveFnName === "getAllKeys";
                    const dbName = objectStorage.indexedDb.dbname;
                    const storageId = objectStorage.storageId;
                    query.db = [dbName, storageId, retrieveFnName];
                    if (!ignoreWarning && !isGetAllKeys && !iterationOpt && Object.keys(query) <= 1) {
                        console.warn(retrieveFnName + " ohne Parameter kann bei großen Datenbanken zu Problemen führen ", query);
                    }
                    const connection = await objectStorage.indexedDb.getConnection();
                    const transaction = connection.transaction(storageId, "readonly");
                    const idbObjectStore = transaction.objectStore(storageId);
                    let target = idbObjectStore;
                    /**
                     * In bestimmten Fällen müssen wir eine Suchanfrage an einer bestimmten Stelle wiederaufnehmen, weil wir es nicht in einer einzigen Transaktion abhandeln können.
                     * - Gesetzte query.batchSize: hier rufen wir öfter hintereinander die Suchanfrage auf, um nur eine bestimmte maximale Anzahl an Objekten gleichzeitig aus dem Store in der Hand zu haben
                     * - Asynchrone 'iterationOpt': eine asynchrone Verarbeitung führt automatisch dazu, dass eine Such-Transaktion endet.
                     * Für die Wiederaufnahme muss auf jeden Fall auch der primäre Schlüssel im Index mit enthalten sein (der Index wir mit fehlenden PrimaryKeys angereichert).
                     * Für diese beiden Fälle wird die BatchSearch-Klasse verwendet, wo die eigentliche Anfrage durch Subanfragen mit entsprechendem gesteuertem query.limit durchgeführt wird.
                     */
                    const needReconnectable = query.batchSize || (iterationOpt && _.util.isAsyncFunction(iterationOpt));
                    // Zuerst versuchen wir das Ziel zu bekommen
                    if (query.index) target = await objectStorage.constructor.TargetOps.getQueryTarget(objectStorage, target, query);


                    let resultPromise;
                    let isMainBatch;
                    if (needReconnectable && !query.noBatch) {
                        isMainBatch = true;
                        if (query.debug) console.log("SearchType: Batch", target.keyPath, _.util.cloneObject(query));
                        resultPromise = new objectStorage.constructor.BatchSearch(objectStorage, idbObjectStore, target, query, iterationOpt, retrieveFnName).batchIt();
                    } else {
                        const keyRange = await this.getOptionalKeyRange(objectStorage, target, query);
                        if (iterationOpt && isGetAllKeys) { // Wird aktuell immer komplett abgefragt
                            if (query.order) throw new Error("getAllKeys wird aktuell nicht mit 'query.order' unterstützt!");
                            if (query.debug) console.log("SearchType: " + retrieveFnName, _.util.cloneObject(query), target, keyRange);
                            resultPromise = this.awaitRequest(target[retrieveFnName](keyRange));
                        } else if (iterationOpt) {
                            if (query.debug) console.log("SearchType: openCursorIteration", _.util.cloneObject(query), target, keyRange);
                            resultPromise = this.#openCursorIteration(target.openCursor(keyRange, query.order), iterationOpt, query.limit, retrieveFnName, keyRange, query);
                        } else if (query.order) {
                            if (query.debug) console.log("SearchType: openCursor", _.util.cloneObject(query), target, keyRange);
                            resultPromise = this.#openCursorFetch(target.openCursor(keyRange, query.order), query.limit, retrieveFnName, keyRange, query);
                        } else {
                            if (query.debug) console.log("SearchType: " + retrieveFnName, _.util.cloneObject(query), target, keyRange);
                            resultPromise = this.awaitRequest(target[retrieveFnName](keyRange, query.limit));
                        }
                    }
                    resultPromise = resultPromise.then(a => {
                        const queryTime = new Date().getTime() - startTime;
                        if (!isMainBatch && queryTime > (query.longQuery || objectStorage.indexedDb.longQuery)) {
                            console.warn("Query dauert länger als 1sec: ", queryTime / 1000 + " secs", query);
                        } else if (query.debug === 1) {
                            console.log("QueryTime: ", queryTime / 1000 + " secs", query);
                        }
                        return a;
                    });
                    if (iterationOpt && isGetAllKeys) { // Wird aktuell immer komplett abgefragt
                        resultPromise.then(async result => {
                            for (const cur of result) {
                                if (await iterationOpt(result) === false) break;
                            }
                        })
                    }
                    return resultPromise;
                }

                /**
                 * Ersetzt potenzielle Wildcards durch minimals/maximalst mögliche (String-/Number-) Werte und liefert eine {IDBKeyRange}-Definition zurück.
                 * keyRangeSingle muss alleine angegeben werden. Ansonsten können keyRangeFromOpt und keyRangeToOpt zusammen oder nur einer von beiden angegeben werden.
                 * @returns {IDBKeyRange}
                 *
                 * Key-Match-Regeln zur Optimierung:
                 * 1. Feste Werte (lower-Wert=upper-Wert) sollten immer an den Anfang des keyMatch-Arrays.
                 * 2. Danach folgt, das was weiter am meisten den Suchbereich einschränkt. (Ausser wir wollen anders sortieren)
                 * 3. Erst möglichst spät die Wildcards. (Ausser wir wollen anders sortieren)
                 * Bzgl. Optimierung und Suchreihenfolge muss ggf. abgewägt werden.
                 */
                static async #getQueryKeyRange(objectStorage, target, query, keyMatch, keyMatchAfter, keyMatchBefore, keyMatchAfterOpen, keyMatchBeforeOpen) {
                    if (query.keyMatch instanceof IDBKeyRange) return keyMatch;
                    if (keyMatch && typeof keyMatch === "string") keyMatch = [keyMatch];
                    if (keyMatchAfter && typeof keyMatchAfter === "string") keyMatchAfter = [keyMatchAfter];
                    if (keyMatchBefore && typeof keyMatchBefore === "string") keyMatchBefore = [keyMatchBefore];
                    let hasWildcards = false;
                    if (keyMatch) {
                        hasWildcards = keyMatch.filter(a => typeof a === "object").length > 0;
                        if (!hasWildcards) return IDBKeyRange.only(keyMatch);
                        keyMatchAfter = keyMatch;
                        keyMatchBefore = keyMatch;
                    } else {
                        if (keyMatchAfter) hasWildcards = keyMatchAfter.filter(a => typeof a === "object").length > 0;
                        if (!hasWildcards && keyMatchBefore) hasWildcards = keyMatchBefore.filter(a => typeof a === "object").length > 0;
                    }

                    if (hasWildcards) {
                        const lowerBound = []; // Wildcards werden mit den minimalst möglichen Werten gefüllt
                        const upperBound = []; // Wildcards werden mit den maximalst möglichen Werten gefüllt
                        for (let i = 0, l = (keyMatchAfter || keyMatchBefore).length; i < l; i++) {
                            const low = keyMatchAfter && keyMatchAfter[i];
                            const high = keyMatchBefore && keyMatchBefore[i];
                            if (low !== undefined) {
                                if (typeof low !== "object") {
                                    lowerBound.push(low);
                                } else if (this.#checkWildcard(low, _.Storages.MATCHER.NUMBER.ANY)) {
                                    lowerBound.push(_.Storages.MATCHER.NUMBER.MIN);
                                } else if (this.#checkWildcard(low, _.Storages.MATCHER.STRING.ANY)) {
                                    lowerBound.push(_.Storages.MATCHER.STRING.MIN);
                                } else { // exakt match
                                    throw new Error("Wert kann nicht in eine KeyRange aufelöst werden ", low);
                                }
                            }
                            if (high !== undefined) {
                                if (typeof high !== "object") {
                                    upperBound.push(high);
                                } else if (this.#checkWildcard(high, _.Storages.MATCHER.NUMBER.ANY)) {
                                    upperBound.push(_.Storages.MATCHER.NUMBER.MAX);
                                } else if (this.#checkWildcard(high, _.Storages.MATCHER.STRING.ANY)) {
                                    upperBound.push(_.Storages.MATCHER.STRING.MAX);
                                } else { // exakt match
                                    throw new Error("Wert kann nicht in eine KeyRange aufelöst werden ", high);
                                }
                            }
                        }
                        return this.#toIDBKeyRange(target, lowerBound.length > 0 ? lowerBound : undefined, upperBound.length > 0 ? upperBound : undefined, keyMatchAfterOpen, keyMatchBeforeOpen);
                    } else { // no wildcards, die Arrays werden 1:1 übernommen
                        return this.#toIDBKeyRange(target, keyMatchAfter, keyMatchBefore, keyMatchAfterOpen, keyMatchBeforeOpen);
                    }
                }

                static #checkWildcard(value, againstWildcard) {
                    return Array.isArray(value) && value[0] === againstWildcard[0];
                }

                static #toIDBKeyRange(target, keyMatchAfter, keyMatchBefore, keyMatchAfterOpen, keyMatchBeforeOpen) {
                    if (typeof target.keyPath === "string") {
                        if (keyMatchAfter) keyMatchAfter = keyMatchAfter[0];
                        if (keyMatchBefore) keyMatchBefore = keyMatchBefore[0];
                    }
                    if (keyMatchAfter) {
                        if (keyMatchBefore) {
                            return IDBKeyRange.bound(keyMatchAfter, keyMatchBefore, keyMatchAfterOpen, keyMatchBeforeOpen);
                        } else {
                            return IDBKeyRange.lowerBound(keyMatchAfter, keyMatchAfterOpen);
                        }
                    } else {
                        return IDBKeyRange.upperBound(keyMatchBefore, keyMatchBeforeOpen);
                    }
                }

                /**
                 * Sammelt das ganze Resultat in einem Array und liefert dieses einmalig aus.
                 */
                static async #openCursorFetch(request, limit, retrieveFnName, keyRange, query) {
                    limit = limit || Number.MAX_VALUE;
                    const _this = this;
                    return new Promise((result, reject) => {
                        const results = [];
                        let idx = 0;
                        request.onsuccess = function (event) {
                            const cursor = event.target.result;
                            if (!cursor || idx >= limit) {
                                result(results);
                            } else {
                                const value = _this.#getResultForCursor(cursor, keyRange, retrieveFnName);
                                if (value) {
                                    results.push(value);
                                    idx++;
                                }
                                cursor.continue();
                            }
                        };
                    });
                }

                /**
                 * Ruft die iterations-Methode auf, sollte diese 'false' zurückliefern wird die Schleife abgebrochen.
                 * Ansonsten wird bis zum optionalen limit oder bis zum Ende weitergemacht.
                 */
                static async #openCursorIteration(request, iteration, limit, retrieveFnName, keyRange, query) {
                    limit = limit || Number.MAX_VALUE;
                    const _this = this;
                    return new Promise((result, reject) => {
                        let idx = 0;
                        request.onsuccess = function (event) {
                            const cursor = event.target.result;
                            // können kein await auf die Iteration setzen, da ansonsten die Transaktion des Cursors beendet wird.
                            if (!cursor || idx >= limit || _this.#checkIteration(iteration, cursor, keyRange, retrieveFnName, idx) === false) {
                                result(); // just finish promise
                            } else {
                                idx++;
                                cursor.continue();
                            }
                        };
                    });
                }

                static #checkIteration(fn, cursor, keyRange, retrieveFnName, idx) {
                    const value = this.#getResultForCursor(cursor, keyRange, retrieveFnName);
                    if (!value) return;
                    const result = fn(value, idx);
                    if (result instanceof Promise) throw new Error("Eine Nicht-Async Iterations-Funktion darf kein Promise liefern!");
                    return result;
                }

                static #getResultForCursor(cursor, keyRange, retrieveFnName) {
                    if (keyRange && !this.#isCursorInMultiRange(cursor, keyRange)) return;
                    if (retrieveFnName === "getAll") return cursor.value;
                    if (retrieveFnName === "getAllKeys") return cursor.primaryKey;
                    if (retrieveFnName === "cursor") return cursor;
                }

                /**
                 * Prüft, ob auch wirklich jeder Key-Parameter insich in der angeforderten Range ist.
                 * Die IndexDb prüft generell nur 1-dimensional, wo z.B. (1,0) in Range(lower=[0,1], upper=[1,1]) enthalten ist, obwohl wir uns für den zweiten Parameter lediglich die "1" anfordern.
                 * Hier trifft bereits der erste Parameter die Entscheidung, dass es enthalten ist, der zweite wird gar nicht erst geprüft.
                 */
                static #isCursorInMultiRange(cursor, keyRange) {
                    if (!cursor.key.entries) return true; // cursor.key ist kein array insofern ist der key nur 1-dimensional, hier müssen wir nichts prüfen.
                    const cursorKeyEntries = cursor.key.entries();
                    if (cursorKeyEntries.length === 1) return true;
                    if (keyRange.lower) {

                        if (keyRange.lowerOpen) {
                            for (const [idx, curKey] of cursorKeyEntries) {
                                if (curKey <= keyRange.lower[idx]) return false;
                            }
                        } else {
                            for (const [idx, curKey] of cursorKeyEntries) {
                                if (curKey < keyRange.lower[idx]) return false;
                            }
                        }
                    }

                    if (keyRange.upper) {
                        if (keyRange.upperOpen) {
                            for (const [idx, curKey] of cursorKeyEntries) {
                                if (curKey >= keyRange.upper[idx]) return false;
                            }
                        } else {
                            for (const [idx, curKey] of cursorKeyEntries) {
                                if (curKey > keyRange.upper[idx]) return false;
                            }
                        }
                    }
                    return true;
                }

                static awaitRequest(idbRequest) {
                    return new Promise((resolve, reject) => {
                        idbRequest.onsuccess = function (event) {
                            resolve(event.target.result);
                        };
                    })
                }
            }

            static TargetOps = class TargetOps {

                /**
                 * Gibt das idbTarget (idbObjectStore oder idbIndex) zurück, auf dem die Anfrage arbeiten kann.
                 * Sofern kein geeigneter Index gefunden werden kann, wird adHoc ein neuer dafür angelegt.
                 * index: ["world", "gruppe_id", "loc.name", "world_season"]
                 * sortBy "gruppe_id"
                 * @param objectStorage die aktuelle ObjectStoragen-Instanz
                 * @param idbObjectStore die aktuelle Verbindung zum ObjectStore
                 * @param query die aktuelle Suchanfrage.
                 */
                static async getQueryTarget(objectStorage, idbObjectStore, query) {
                    let indexDef = query.index;
                    if (typeof indexDef === "string" && idbObjectStore.indexNames[indexDef]) {
                        return idbObjectStore.index(indexDef);
                    }
                    return await this.#findTarget(objectStorage, idbObjectStore, indexDef);
                }

                static getKeyPathArray(def) {
                    if (typeof def === "string") return [def];
                    return def;
                }

                static async #findTarget(objectStorage, objectStore, keyPath) {
                    if (this.isKeyPathEquals(objectStore.keyPath, keyPath)) {
                        return objectStore;
                    }
                    for (const indexName of objectStore.indexNames) {
                        const curIndex = objectStore.index(indexName);
                        if (this.isKeyPathEquals(curIndex.keyPath, keyPath)) {
                            return curIndex;
                        }
                    }
                    // nichts gefunden wir legen einen neuen index an
                    return await this.#createAdHocIndex(objectStorage, objectStore, keyPath);
                }

                static isKeyPathEquals(keyPath1, keyPath2) {
                    if (typeof keyPath1 === "string") keyPath1 = [keyPath1];
                    if (typeof keyPath2 === "string") keyPath2 = [keyPath2];
                    return _.util.arraysEqual(keyPath1, keyPath2);
                }

                /**
                 * Sucht nach einem noch freien Namen und legt diesen dann mit der Keypath-Definition an
                 */
                static async #createAdHocIndex(objectStorage, objectStore, keyPath) {
                    let i = 1;
                    while (true) {
                        const curIndexName = "" + i;
                        if (!objectStore.indexNames.contains(curIndexName)) {
                            return await this.#createAndGetNewIndex(objectStorage, objectStore, curIndexName, keyPath);
                        }
                        i++;
                    }
                }

                static async #createAndGetNewIndex(objectStorage, objectStore, indexName, keyPath) {
                    if (objectStorage.indexedDb.debug) console.log(objectStorage.storageId + " Folgender Index wird AdHoc erstellt: ", keyPath);
                    //throw new Error("Indizes können gerade nicht adHoc angelegt werden!");
                    objectStorage.ensureIndex(indexName, keyPath);
                    const idbObjectStore = await objectStorage.connect(); // den Objectstorage das Upgrade ausführen lassen
                    return idbObjectStore.index(indexName);
                }
            }
        }
    }

    /**
     * Cross-Site Proxy, um origin-übergreifend auf origin-geeichte Inhalte zuzugreifen (wie z.B. indexedDB).
     * Hierzu zählen 3 Teile...
     * 1) Das Wrappen der Ursprungsanwendung in ein Iframe, damit 2) nur einmalig aufgerufen werden muss. (Methode: .ensureIframeWrap)
     * 2) Das Einbinden von zusätzlichen Iframes, um Code in einer andereren Domain auszuführen. (Methode: .actAsCSProxyResponder)
     * 3) Die eigentliche Steuerungseinheit zur Nutzung in der Anwendung, welches den Code auf 2) injizieren kann. (Methode: .getProxyFor(responderHttp))
     */
    static CSProxy = class CSProxy {

        static #supported = ["Tampermonkey", "Greasemonkey", "Violentmonkey"];

        /**
         * Greasemonkey hat mehrere gravierende Probleme mit dem Ausführen eines User-Scriptes für ein iframe, daher wird dieses für die Nutzung ausgenommen.
         */
        static cantProxy() {
            return GM.info.scriptHandler === "Greasemonkey";
        }

        static dbMode;

        /**
         * 4 Modes:
         * - Script-Execution with Local-Domain (cant proxy)
         * - Script-Execution with Proxy-Domain
         * - No Script-Exection with Local-Domain (react as proxy for that domain)
         * - Nothing at all
         *
         * @return  [boolean, String] [scriptExecution, witchDbToUse]
         *                                              witchDbToUse "p"=proxy, "l"=local
         */
        static async check() {
            if (!this.#supported.includes(GM.info.scriptHandler)) {
                alert(GM.info.script.name + "\nScriptEngine: '" + GM.info.scriptHandler + "' wird aktuell nicht unterstützt.\nBitte kontaktiere den Entwickler für eine entsprechende Unterstützung.");
                return [false];
            }
            if (this.cantProxy()) {
                this.dbMode = "local";
                return [true, "l"];
            }
            if (window.origin.endsWith("//world-of-dungeons.de")) { // Main-Domain-Check, hier wird generell kein weiterer Script-Code ausgeführt
                if (window.location.href.includes("csProxyV=")) { // With ProxyMarker
                    this.actAsCSProxyResponder();
                    return [false, "l"];
                } else return [false];
            }

            if (await this.ensureIframeWrap()) return [false];

            const rootWindow = _.WindowManager.getRootWindow();
            const usedVersion = _.WindowManager.getMark("demRepV", rootWindow);
            const installedBy = _.WindowManager.getMark("demRepM", rootWindow);
            // Seite wurde von einer Mainframe-URL aufgerufen, wo generell kein DB-Mainframe istalliert wird, insofern bringt auch ein Reload nichts.
            if (usedVersion === undefined) {
                console.warn(GM.info.script.name + ": Über das Hauptfenster'" + rootWindow.location.href + "' wird keine Datenbank-Verbindung hergestellt, deswegen können wir auch hier nicht auf die Datenbank zugreifen!");
                return [false];
            }
            // Sicherstellen, dass die aktuelle Version im Haupfenster läuft (wg. MyMod.start()), was im CS-Iframe läuft bekommen wir von hier aus allerdings nicht mit.
            // TODO: ggf. dem Iframe nen Parameter mit der csProxyVersion mitgeben, damit dort sichergestellt werden kann, dass die aktuelle Version läuft!?
            if (GM.info.script.name === installedBy) _.WindowManager.mark("csProxyInstallerVisited", true); // auf dem aktuellen Iframe-Window nicht auf dem Root
            if (usedVersion !== _.version) { // Die Version hat sich geändert, alles nochmal laden.
                // Fall 1: Mod hat sich nach dem ersten Laden der Seite aktualisiert
                // Fall 2: Mehrere Mods, nur einer hat sich aktualisiert, der andere läuft hier dann immer auf einen Fehler
                console.log("Versionchange: reload");
                if (window.opener) { // Popup muss geschlossen werden!? damit es erneut geöffnet werden kann
                    console.error("Fehler: wir sind in einem Popup, aber die installierte DB-Proxy-Version unterscheidet sich zu der aktuell vom Skript genutzten Version: '" + usedVersion + "' by '" + installedBy + "' vs. '" + _.version + "' by '" + GM.info.script.name + "' RootWindow:" + rootWindow + " window-Opener:" + window.opener);
                    //window.close();
                }

                // nur die vorherige Mod stößt den Reload an, damit es bei Versionsunterschieden (z.B. eine Mod ist nicht aktuell) nicht zu Dauerschleifen kommt.
                if (GM.info.script.name === installedBy) rootWindow.location.reload();
                else {
                    // damit der eigentlich Mod Zeit für den Reload hat, warten wir hier bis wir weiteres unternehmen
                    // kann aber natürlich auch passieren, wenn eine Seite aufgerufen wird, wo die Mod, die den Proxy installiert hat nicht zur Ausführung kommt.
                    setTimeout(function () {
                        if (_.WindowManager.getMark("csProxyInstallerVisited")) {
                            // Der Installer hat scheinbar wirklich noch eine andere Version
                            alert(GM.info.script.name + ": falsche Version erkannt!" + "\n\nMainDomainProxy-Version: " + usedVersion + "\nwurde von " + installedBy + " installiert!" + "\n\n" + GM.info.script.name + " erwartet Version " + _.version + "\n\nAlle demawi-Mods müssen auf der gleichen Version laufen bzw. aktuell sein!\n");
                        } else {
                            // Der Installer wird auf dieser Seite nicht aufgerufen: wir laden die Seite neu
                            if (!_.WindowManager.getMark("csProxyReload")) {
                                _.WindowManager.mark("csProxyReload", true);
                                rootWindow.location.reload();
                            }
                        }
                    }, 3000);
                }
                return [false];
            }
            this.dbMode = "www";
            return [true, "p"];
        }

        /**
         * nur wenn iframe-wrap noch nicht erstellt wurde
         * (Same-origin) Popups sollten das iframe ihres parents nutzen.
         */
        static async ensureIframeWrap() {
            const isLogin = document.getElementById("WodLoginBox");
            if (!isLogin && window.top === window && !window.opener) { // keinLogin und benötigt Wrap => wrap
                await this.#ensureIframeWrapDoIt();
                return true;
            } else if (isLogin) {
                if (window.top !== window) { // Login und Wrap gefunden => unwrap
                    window.top.location.href = window.location.href;
                }
                return true;
            }
        }

        static async #ensureIframeWrapDoIt() {
            if (document.querySelector("#innerMainframe")) return;
            console.log("Iframe-Wrap wurde erstellt!");
            _.WindowManager.mark("demRepV", _.version);
            _.WindowManager.mark("demRepM", GM.info.script.name);
            const innerMainframe = document.createElement("iframe");
            innerMainframe.style.width = "100%";
            innerMainframe.style.height = "100%";
            innerMainframe.style.position = "absolute";
            innerMainframe.style.border = "0px";
            innerMainframe.style.zIndex = 100;
            innerMainframe.id = "innerMainframe";

            const rootBody = document.body;
            rootBody.style.overflow = "hidden";
            rootBody.style.margin = "0px";
            rootBody.insertBefore(innerMainframe, rootBody.children[0]);

            await _.MyMod.init();

            const rebuildPageOnce = function () {
                // Elemente lieber nicht entfernen, da ansonsten Seiten-Skripte ins Leere laufen und die Konsole spammen z.B. bei der Dungeon-Ansicht die Progress-Bar
                //while (cur = document.head.children[0]) cur.remove();
                //while (cur = rootBody.children[1])  cur.remove();
                for (let i = 0, l = document.head.children.length; i < l; i++) {
                    const cur = document.head.children[i];
                    if (cur.tagName === "LINK") {
                        cur.remove();
                        i--;
                        l--;
                    }
                }
                for (const cur of rootBody.children) {
                    if (cur !== innerMainframe) cur.style.display = "none";
                }
                const theForm = document.getElementsByName("the_form")[0];
                if (theForm) theForm.remove(); // Damit es nicht zu Verwechselungen kommt
                innerMainframe.removeEventListener("load", rebuildPageOnce);
            }
            innerMainframe.addEventListener("load", rebuildPageOnce);

            _.IFrameCapture.captureIt(innerMainframe, (win, doc) => _.MyMod.startMod(win, doc), (win, doc) => _.MyMod.revisit(win, doc));
            innerMainframe.src = window.location.href;
        }

        /**
         * Führt den übergebenen Code aus und sendet das Ergebnis an das parent-Window zurück
         */
        static actAsCSProxyResponder() {
            if (_.WindowManager.getMark("actAsCSProxyResponder")) return;
            _.WindowManager.mark("actAsCSProxyResponder", 1);
            const parentOrigin = document.referrer || parent.origin; // document.referrer funktioniert auf chrome, parent.origin wirft dort eine Exception funktioniert aber auf Firefox
            const log = document.referrer ? console.log : window.top.console.log;
            const errorlogger = document.referrer ? console.error : window.top.console.error;
            const parentWindow = window.opener || window.parent; // window.opener bei window.open(), ansonsten für iframe
            const myOrigin = window.location.origin;

            document.body.innerHTML = "Dieses Fenster dient als Kommunikationsschnittstelle:<br><b>" + parentOrigin + " => " + myOrigin + "</b><br>Es schließt sich mit dem Hauptfenster";

            const respond = function (data, result) {
                delete data.exec;
                if (data.debug) log("CSProxy[" + myOrigin + "] antwortet", data, result);
                data = cloneInto(data, {});
                data.result = result;
                if (data.debug) log("CSProxy[" + myOrigin + "] antwortet2", data, result);
                parentWindow.postMessage(data, parentOrigin);
            }

            const iterators = {};
            const finishIteration = function (data) {
                delete iterators[data.id];
                if (data.debug) log("CSProxy[" + myOrigin + "] beendet die Iteration: " + data.id);
            }

            // Code der während der Schleife für die Auslieferung des Teilresultats aufgerufen wird.
            const respondIteration = function (data, result) {
                respond(data, result);
                return new Promise((resolve, reject) => {
                    iterators[data.id] = resolve;
                });
            }
            // Code der nach Schleifenende aufgerufen wird. Sofern die Iteration vorzeitig beendet wurde ist hier nichts mehr zu tun.
            const respondFinished = function (data) {
                if (iterators[data.id]) {
                    respond(data);
                    finishIteration(data);
                }
            }

            // eval muss hier ausgeführt werden, damit der injizierte Code auch auf respondIteration und respondFinished zugreifen kann
            window.addEventListener("message", async event => {
                    const data = event.data;
                    if (typeof data !== "object") return;
                    if (data.debug) log("CSProxy[" + myOrigin + "] hat Befehl empfangen", data, data.exec);
                    if (!data.id) respond(data);
                    if (data.type !== "iteration") {
                        const dataExec = data.exec;
                        if (dataExec) {
                            respond(data, await eval(dataExec));
                        }
                    } else { // type === "iteration"
                        const idx = data.idx;
                        delete data.idx;
                        let finished = false;
                        if (!idx) { // start
                            iterators[data.id] = () => {
                            }; // muss vorhanden sein, damit respondFinish auch ohne Resultate abschließen kann
                            await eval(data.exec);
                        } else if (idx === 1) { // continue
                            iterators[data.id]();
                        } else if (idx === -1) { // stop
                            iterators[data.id](false);
                            finishIteration(data);
                        }
                    }
                },
                false,
            );

            log("CSProxy-Responder[" + myOrigin + "] wurde erstellt: '" + parentOrigin + "' => '" + window.location.origin + "'");

            // Dem parent melden dass wir bereit sind (es wird keine data.id geliefert)
            try {
                parentWindow.postMessage({origin: myOrigin}, parentOrigin);
            } catch (e) {
                errorlogger("Fehler bei der PostMessage vom CSProxy", e);
            }
        }

        /**
         * Prüft, ob das Skript auch Zugriff auf die entsprechende URL hat, um den Responder zu installieren.
         */
        static #checkScriptAccess(responderHttp) {
            for (const curInclude of GM.info.script.matches) {
                if (responderHttp.match("^" + curInclude.replaceAll(".", "\\.").replaceAll("?", ".").replaceAll("*", ".*") + "$")) {
                    return true;
                }
            }
            return false;
        }

        /**
         * @param responderHttp welche bei Aufruf Messenger.actAsResponder ausführt. (z.B. "https://world-of-dungeons.de/wod/spiel/news/"). Die Url wird noch durch einen Suchparameter (messengerId=X) erweitert.
         */
        static async getProxyFor(responderHttp, debug) {
            const targetUrl = new URL(responderHttp);
            targetUrl.searchParams.append("csProxyV", _.csProxyV); // Marker, dass es sich hier um den CS-Proxy handelt
            if (!this.#checkScriptAccess(responderHttp)) {
                console.error(GM.info.script.name + " kann nicht mit '" + responderHttp + "' kommunizieren. ", GM.info.script.includes);
                throw Error(GM.info.script.name + " kann nicht mit '" + responderHttp + "' kommunizieren. " + JSON.stringify(GM.info.script.includes));
            }

            const rootWindow = _.WindowManager.getRootWindow();

            let messengerId = rootWindow.messengerId;
            if (!messengerId) messengerId = rootWindow.messengerId = 1;
            else {
                rootWindow.messengerId++;
                messengerId = rootWindow.messengerId;
            }
            const csProxy = new CSProxy(messengerId, targetUrl, debug);
            const messageListener = async (event) => {
                const data = event.data;
                if (data.mid === csProxy.messengerId) {
                    await csProxy.onMessage(data);
                } else if (data.origin) {
                    await csProxy.onMessage(data);
                }
            };
            rootWindow.addEventListener("message", messageListener, false);
            window.addEventListener("unload", function () {
                rootWindow.removeEventListener("message", messageListener);
            });

            return csProxy.onReady;
        }

        iframe;
        targetWindow;
        targetOrigin;
        myOrigin;
        comLink = {}; // für jede Kommunikation wird ein Promise erstellt, welches erfüllt wird, wenn die Kommunkation abgeschlossen ist
        iterations = {};
        id = 1;
        onReady;
        onReadyResolver;
        messengerId;
        debug;

        constructor(messengerId, targetUrl, debug) {
            this.debug = debug;
            this.messengerId = messengerId;
            this.targetUrl = targetUrl;
            this.myOrigin = window.location.origin;
            this.targetOrigin = targetUrl.origin;
            this.targetWindow = this.getTargetWindow(targetUrl);
            let resolver;
            const promise = new Promise((resolve, reject) => {
                resolver = resolve;
            });
            this.onReadyResolver = resolver;
            this.onReady = promise;

            // Falls wir das Target Window wiederverwenden triggern wir hiermit den Proxy nochmal eine Initial-Nachricht zu senden ansonsten macht er es eh von sich aus
            this.postMessage({});
        }

        async onMessage(data) {
            if (this.debug) console.log("Sender[" + this.messengerId + "] empfängt", data);
            const id = data.id;
            if (id === undefined) { // Responder meldet Bereitschaft, wir geben somit den Messenger frei.
                if (this.onReadyResolver) {
                    if (this.debug) console.log("Sender[" + this.messengerId + "] ist sendebereit!");
                    this.onReadyResolver(this);
                }
                return;
            }
            if (data.type !== "iteration") {
                this.comLink[id](data.result);
                delete this.comLink[id];
            } else { // type === "iteration"
                let stop = false;
                if (data.result === undefined) stop = true; // wenn der Datenlieferant abbricht
                else if (await this.iterations[id](data.result) === false) { // wenn wir selbst abbrechen
                    stop = true;
                    this.postMessage({
                        id: id,
                        type: "iteration",
                        idx: -1, // Abbruch
                    })
                }
                if (stop) {
                    if (this.debug) console.log("Sender beendet die Iteration: " + id);
                    delete this.iterations[id];
                    this.comLink[id]();
                } else {
                    this.postMessage({
                        id: id,
                        type: "iteration",
                        idx: 1, // +1
                    })
                }
            }
        }

        /**
         * Die 'execFn' muss eine Funktion erzeugen, die fortlaufend aufgerufen wird um den nächsten Datensatz zu liefern.
         */
        async execIteration(iteration, execFn, ...vars) {
            const id = this.#createId();
            this.iterations[id] = iteration;
            return this.execIntern(execFn, {id: id, type: "iteration"}, ...vars);
        }

        async exec(execFn, ...vars) {
            return await this.execIntern(execFn, undefined, ...vars);
        }

        async execIntern(execFn, dataOpt, ...vars) {
            const data = dataOpt || {
                id: this.#createId(),
            }
            let args = JSON.stringify(vars);
            args = args.substring(1, args.length - 1);
            data.exec = "(" + execFn.toString() + ")(" + args + ")";

            let promiseResolver;
            const promise = new Promise((resolve, reject) => {
                promiseResolver = resolve;
            });
            this.comLink[data.id] = promiseResolver;
            this.postMessage(data);
            return promise;
        }

        postMessage(data) {
            if (this.debug) {
                console.log("Sender[" + this.messengerId + "] sendet..", data, data.exec);
                data.debug = true;
            }
            data.mid = this.messengerId;
            this.targetWindow.postMessage(data, this.targetOrigin);
        }

        #createId() {
            return this.id++;
        }

        #openWindow(window, mainUnsafeWindow, responderUrl) {
            const targetWindow = _.Window.open(window, mainUnsafeWindow, responderUrl.toString());
            window.focus();
            window.addEventListener("beforeunload", function () {
                targetWindow.close();
            });
            return targetWindow;
        }

        getTargetWindow(responderUrl) {
            const mainWindow = _.WindowManager.getRootWindow();

            let iframe = mainWindow.document.querySelector("iframe[src^='" + responderUrl.origin + "'][src*='csProxyV=']");
            if (iframe) { // Wiederverwendung
                if (this.debug) console.log("ProxyTarget: Reuse iframe window found");
                return iframe.contentWindow;
            }
            // Neu erstellen
            if (this.debug) console.log("ProxyTarget: Create iframe");
            iframe = _.Libs.loadViaIFrame(responderUrl.toString(), mainWindow.document);
            return iframe.contentWindow;

        }
    }

    /**
     * Beobachtet ein innerFrame. Wenn sich die URL ändert wird neuer Titel und URL ins Hauptfenster übernommen.
     * Auch Popups, die im innerFrame per window.open aufgerufen werden, werden beobachtet.
     * Die onLoadFn-Callback Methode wird immer mit den entsprechenden window und document aufgerufen.
     */
    static IFrameCapture = class IFrameCapture {

        static addLoadingIndicator(win, doc) {
            const loadingWrapper = doc.createElement("div");
            loadingWrapper.style.position = "fixed";
            loadingWrapper.style.top = "40px";
            loadingWrapper.style.left = 0;
            loadingWrapper.style.right = 0;
            loadingWrapper.style.margin = "auto";
            loadingWrapper.style.width = "20px";
            loadingWrapper.style.height = "20px";
            loadingWrapper.style.display = "none";

            loadingWrapper.style.overflow = "hidden";
            loadingWrapper.style.zIndex = "10000";

            const loadingIndicator = _.UI.createSpinner();
            loadingWrapper.append(loadingIndicator);
            doc.body.append(loadingWrapper);
            return loadingWrapper;
        }

        static async captureIt(iframeOrPopup2Capture, onLoadFn, onRevisitFn, isPopup) {
            const _this = this;
            const captureLoadFn = async function (evt) {
                const win = isPopup ? iframeOrPopup2Capture : iframeOrPopup2Capture.contentWindow;
                const doc = win.document;
                _.Libs.addCSSDirect("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css", doc);
                const loadingIndicator = _this.addLoadingIndicator(win, win.document); // preloaded
                if (!isPopup) {
                    // Titel und Url ins Hauptfenster übernehmen
                    document.title = win.document.title; // rootDocument!

                    win.addEventListener("beforeunload", function () {
                        loadingIndicator.style.display = "";
                    });
                    win.addEventListener("unload", function () {
                        console.clear();
                        setTimeout(function () {
                            const newUrl = win.location.href;
                            window.history.replaceState({}, "", newUrl); // rootWindow
                        }, 0);
                    });
                } else {
                    // Da wir beim Popup direkt auf dem Window den load-Eventlistener haben, wird dieser nach einem unload abgeräumt
                    win.addEventListener("unload", function () {
                        setTimeout(function () {
                            win.addEventListener("load", captureLoadFn);
                        }, 0);
                    });
                }

                // Popup-Catcher
                const original = win.open;
                win.open = function (...args) {
                    const popup = original(...args);
                    _.IFrameCapture.captureIt(popup, onLoadFn, onRevisitFn, true);
                    return popup;
                }

                // Cross-Site Navigation im Iframe muss unter allen Umständen abgefangen werden, da ansonsten root und iframe nicht mehr kommunizieren können.
                const navigation = win.navigation;
                if (navigation) { // für Chromium nicht für FF
                    navigation.addEventListener("navigate", function (ev) {
                        if (!ev.destination.url.startsWith(document.location.origin)) {
                            ev.preventDefault();
                            ev.stopPropagation();
                            window.location.href = ev.destination.url;
                        }
                    })
                } else {
                    const wrappedDocument = win.document;
                    // Sicherstellen, dass alle Iframe-Navigationen die ausserhalb der Origin liegen über target="_top" abgewickelt werden. Zuvor gesetzt "_blank" wäre auch ok.
                    for (const cur of wrappedDocument.querySelectorAll("a[href^='http']:not([href^='" + wrappedDocument.location.origin + "'])")) {
                        if (!cur.target) cur.target = "_top";
                    }
                }
                win.focus();
                _.WindowManager.addRevisitListener(win, evt => {
                    onRevisitFn(win, win.document, evt);
                });
                await onLoadFn(win, win.document, evt);
            };
            iframeOrPopup2Capture.addEventListener("load", captureLoadFn);
        }
    }

    static MyMod = class MyMod {

        static #nextDungeonTimeEarly;
        static #nextDungeonTimeReal;
        static #everyPageRuns;

        static async startMod(win, doc) {
            for (const runnable of Object.values(this.#everyPageRuns)) {
                // console.log("RUN", runnable);
                eval(runnable);
            }
            this.handleNextDungeon(win, doc);
            const view = _.WoD.getView(win);
            win.console.log("[WoD] MAIN_FRAME: " + view);
            await _.WoDWorldDb.placeSeasonElem(doc);
            switch (view) {
                case _.WoD.VIEW.MY_HEROES:
                    await _.WoDWorldDb.onMeineHeldenAnsicht(doc);
                    break;
                case _.WoD.VIEW.SKILL:
                    await _.WoDSkillsDb.onSkillPage(doc);
                    break;
            }
        }

        /**
         * Es muss eine isolierte Funktion übergeben werden, diese wird im MyMod.startMod - Kontext ausgeführt.
         * Es muss somit "win" und "doc" verwendet werden.
         */
        static onEveryPage(id, execFn) {
            const everyPageRuns = _.WindowManager.getMark("MyModRunnables", _.WindowManager.getRootWindow());
            everyPageRuns[id] = "(" + execFn.toString() + ")()";
        }

        static handleNextDungeon(win, doc) {
            const nextDungeonSpan = doc.querySelector("#gadgetNextdungeonTime");
            if (nextDungeonSpan) {
                this.nextDungeonTimeEarly = _.WoD.getNaechsteDungeonZeit(true, doc);
                this.nextDungeonTimeReal = _.WoD.getNaechsteDungeonZeit(false, doc);
            }
        }

        static async revisit(win, doc, evt) {
            this.nextDungeonTimeDirty(win, doc);
        }

        static nextDungeonTimeDirty(win, doc) {
            if (!this.#nextDungeonTimeEarly) return;
            const now = new Date().getTime();
            let warning;

            if (now > this.#nextDungeonTimeReal) {
                warning = "Der Dungeon-Run hat bereits stattgefunden!";
            } else {
                const nextDungeonTimeEarly = _.WoD.getNaechsteDungeonZeit(true, doc);
                const nextDungeonTimeReal = _.WoD.getNaechsteDungeonZeit(false, doc);
                if (now > this.#nextDungeonTimeEarly) {
                    if (nextDungeonTimeEarly === nextDungeonTimeReal) {
                        warning = "Der Dungeon-Run hat bereits stattgefunden!";
                    } else {
                        warning = "Der Dungeon-Run hat evtl. bereits stattgefunden!"; // falls woanders auf den Button gedrückt wurde.
                    }
                }
            }

            if (warning) {
                const elem = doc.getElementById("gadgetNextdungeonTime");
                if (!elem.parentElement.getElementsByClassName("outdatedMarker").length) {
                    const div = doc.createElement("div");
                    div.innerHTML = warning;
                    div.style.color = "red";
                    div.className = "outdatedMarker";
                    elem.parentElement.append(div);
                }
            }
        }

        static async init() {
            const messengerPromise = _.CSProxy.getProxyFor("https://world-of-dungeons.de/wod/spiel/impressum/contact.php", false);
            const indexedDb = _.WoDStorages.initWodDbProxy("wodDBMain", "___", messengerPromise);
            await messengerPromise;

            this.#everyPageRuns = {};
            _.WindowManager.mark("MyModRunnables", this.#everyPageRuns, _.WindowManager.getRootWindow());
        }

    }

    /**
     * TODO: Anzeige an der Oberfläche
     */
    static Migration = class Migration {

        static start(text) {
            return new _.Migration(text);
        }

        text;

        constructor(text) {
            this.text = text;
        }

        progress(cur, to) {

        }

        failure(text) {
        }

        end() {
        }
    }

    static Settings = class Settings {
        static async getHandler(settingsDef) {
            const settingsHandler = new _.Settings(settingsDef);
            await settingsHandler.load();
            return settingsHandler;
        }

        settingsDef;
        data;

        constructor(settingsDef) {
            this.settingsDef = settingsDef;
        }

        get(id) {
            this.#ensureId(id);
            return this.data[id];
        }

        set(id, value) {
            this.#ensureId(id);
            this.data[id] = value;
        }

        delete(id) {
            this.#ensureId(id);
            delete this.data[id];
        }

        #ensureId(id) {
            if (!(id in this.settingsDef.defaultSettings)) {
                const msg = "[" + this.settingsDef.modName + "] hat Setting '" + id + "' nicht definiert!";
                console.error(msg, this.settingsDef);
                throw new Error(msg);
            }
        }

        async load() {
            const modName = this.settingsDef.modName;
            this.data = await _.WoDStorages.getSettingsDb().getValue(modName) || {name: modName};
            let changed = false;
            for (const [key, value] of Object.entries(this.settingsDef.defaultSettings || {})) {
                if (!(key in this.data)) {
                    this.data[key] = value;
                    changed = true;
                }
            }
            // TODO: überprüfen, ob ggf. überflüssige Werte vorhanden sind!?
            if (changed) this.save();
        }

        async save() {
            await _.WoDStorages.getSettingsDb().setValue(this.data);
        }

    }

    static SettingsPage = class {
        static addHeader(settingTable, ueberschriftTxt, descTxt, infoTxt) {
            const ueberschrift = document.createElement("h2");
            ueberschrift.style.fontStyle = "italic";
            ueberschrift.style.textDecoration = "underline";
            ueberschrift.style.marginBottom = "2px";
            ueberschrift.innerHTML = ueberschriftTxt;
            if (infoTxt) {
                ueberschrift.innerHTML += " 🛈";
                ueberschrift.title = infoTxt;
            }
            settingTable.append(ueberschrift);
            const description = document.createElement("div");
            description.innerHTML = descTxt.replaceAll("\n", "<br>");
            description.style.fontStyle = "italic";
            description.style.fontSize = "12px";
            description.style.marginBottom = "10px";
            settingTable.append(description);
        }
    }

    /**
     * Hier finden sich gemeinsam genutzte Datenbanken und Datenoperation.
     *
     * WoD-DBs:
     * Inhaber:
     * ItemDatenbank (wodDB.items[w], wodDB.itemSources[w])
     * KampfberichtArchiv (wodDB.reportSources[w], wodDB.reportSourcesMeta[w])
     * ErweiterteKampfstatistik (wodDB.reportStats[w])
     *
     * Lesend:
     *
     */
    static WoDStorages = class {

        static async useLocalDomain(modDbName) {
            return this.initWodDb("___", modDbName);
        }

        static async tryConnectToMainDomain(modDbName, debug) {
            const [scriptExecution, dbType] = await _.CSProxy.check();

            if (scriptExecution) {
                if (dbType === "l") { // cant proxy
                    return this.initWodDb("___", modDbName);
                } else if (dbType === "p") {
                    const messengerPromise = _.CSProxy.getProxyFor("https://world-of-dungeons.de/wod/spiel/impressum/contact.php", false);
                    const indexedDb = this.initWodDbProxy(modDbName + "Main", "___", messengerPromise);
                    await messengerPromise;
                    return indexedDb;
                }
            } else { // proxy
                if (dbType === "l") this.initWodDb("___", modDbName + "Main");
            }
        }

        static #indexedDb;

        /**
         * Gibt die initial definierte WoD-Datenbank zurück.
         */
        static getWodDb() {
            if (!this.#indexedDb) throw new Error("WoD-Datenbank wurde noch nicht definiert!");
            return this.#indexedDb;
        }

        static initWodDb(modname, dbname) {
            if (this.#indexedDb) throw new Error("WoDStorages wurden bereits initial definiert!");
            return this.#indexedDb = _.Storages.IndexedDb.getDb(dbname, modname);
        }

        static initWodDbProxy(dbname, modname, messengerPromise) {
            if (this.#indexedDb) throw new Error("WoDStorages wurden bereits initial definiert!");
            return this.#indexedDb = _.Storages.IndexedDbProxy.getDb(dbname, modname, messengerPromise);
        }

        static getItemIndexDb() {
            return this.getCreateObjectStore("itemIndex", "id");
        }

        static getItemDb() {
            return this.getCreateObjectStore("item", "id");
        }

        static getItemSourcesDb() {
            return this.getCreateObjectStore("itemSources", "id");
        }

        static getLootDb() {
            return this.getCreateObjectStore("itemLoot", "id");
        }

        static getSettingsDb() {
            return this.getCreateObjectStore("settings", "name");
        }

        static getSkillsDb() {
            return this.getCreateObjectStore("skill", "id");
        }

        /**
         * Informationen über die Locations (Dungeons, Schlachten). Z.B. Erkennung der Dungeonversion.
         */
        static getLocationDb() {
            return this.getCreateObjectStore("location", "name");
        }

        static getSkillsSourceDb() {
            return this.getCreateObjectStore("skillSources", "id");
        }

        static getWorldDb() {
            return this.getCreateObjectStore("world", "id");
        }

        /**
         * Einträge in Kampfberichten, die keinen Skill aber einen Effekt enthalten,
         * können über diese Datenbank spezifiziert werden.
         */
        static getSkillsUnknownDb() {
            return this.getCreateObjectStore("skillUnknown", "id");
        }

        /**
         * Liefert den Object-Store, wenn er noch nicht existiert, wird er angelegt.
         */
        static getCreateObjectStore(name, key, indizes) {
            return this.getWodDb().createObjectStorage(name, key, indizes);
        }

        /**
         * Liefert den Object-Store nur, wenn er bereits existiert
         */
        static async #getObjectStoreIfExists(storageId) {
            return await this.getWodDb().getObjectStorageChecked(storageId);
        }

    }

    /**
     * Speichert gruppenunabhängige sowie gruppenabhängige Loots.
     * TODO: Dungeonversion hinzufügen. Was passiert wenn nachträglich sich eine Version ändert.
     * TODO: Problem: exakt gleicher Timestamp? gruppe_id mit anhängen!
     * TODO: Tombola-Loot
     * ------------------ Konkrete Reports ------------------
     * : werden bei Bedarf gekürzt
     * group: { // wird gelöscht, wenn die GruppenSaison explizit abgeschlossen wird
     *     [groupSeasonId]: { // "WA345545#1"
     *         [timestamp]: { // 1734374743
     *             count: 2,
     *             loc: "Das Bergwerk",
     *             locv: <optionale DungeonVersion>,
     *         }
     *     }
     * },
     * loot: {
     *      [worldtimestamp|unterscheider]: { // WA1734374743|gruppenId
     *          loc: "Das Bergwerk",
     *          locv: <optionale DungeonVersion>,
     *          stufe: 13,  // gesicherte Stufe
     *          stufe_: 12, // ungesicherte Stufe
     *          ts: <timestamp>,
     *          world: "WA",
     *      }
     * },
     * ------------------ Zusammenfassungen ------------------
     * : werden nie gekürzt
     * locs: { // Locations wo es überall gedroppt ist.
     *     [locName]: {
     *          versions: {
     *              [versionNr]: <timestamp> // wann zuletzt gesehen
     *          };
     *          ts: <timestamp>, // wann zuletzt gesehen
     *     }
     * },
     * stufen: {
     *     [stufeNr]: {
     *         safe: <timestamp>, // wann in diser Form zuletzt reported
     *         unsafe: <timestamp>, // wann in dieser Form zuletzt reported
     *     }
     * }
     */
    static WoDLootDb = class {

        static MAX_LOOT_ENTRIES = 50;

        static async getValue(itemId) {
            itemId = itemId.toLowerCase();
            return await _.WoDStorages.getLootDb().getValue(itemId);
        }

        static async isDungeonUnique(itemId) {
            itemId = itemId.toLowerCase();
            const itemLoot = await this.getValue(itemId);
            const count = Object.keys(itemLoot.locs).length;
            return count === 1;
        }

        static async getLootedDungeonUniques(locationName, world, worldSeasonNr, quelleId) {
            const result = {};
            for (const item of await _.WoDStorages.getLootDb().getAll(false)) { // skip warning, sollte in Zukunft aber effizienter gelöst werden
                const locNames = Object.keys(item.locs);
                if (locNames.length === 1 && locNames[0] === locationName) { // is DungeonUnique
                    const quellSeasonId = this.#getQuellSeasonId(world, worldSeasonNr, quelleId);
                    result[item.name] = "X" + quellSeasonId;
                    const quellLoot = item.quelle[quellSeasonId];
                    if (quellLoot) {
                        let count = 0;
                        for (const loot of Object.values(quellLoot)) {
                            count += loot.count;
                        }
                        result[item.name] = count;
                    }
                }
            }
            return result;
        }

        static async getLootedBefore(itemName, timestampInMinutes, world, worldSeasonNr, quelleId) {
            const worldSeasonQuellId = quelleId ? this.#getQuellSeasonId(world, worldSeasonNr, quelleId) : world + worldSeasonNr;
            const itemId = itemName.toLowerCase();
            const lootDef = await _.WoDLootDb.getValue(itemId);
            const groupsDef = lootDef.quelle;
            if (!groupsDef) return 0;
            const groupDef = groupsDef[worldSeasonQuellId];
            if (!groupDef) return 0;
            let count = 0;
            for (const [ts, def] of Object.entries(groupDef)) {
                if (Number(ts) < timestampInMinutes) count += def.count;
            }
            return count;
        }

        static async reportLootTombola(itemName, timestampInMinutes, stufe, anzahl, quelle) {
            itemName = itemName.toLowerCase();
            const world = _.WoD.getMyWorld();
            const worldSeason = _.WoD.getMyWorldSeasonNr();
            const item = await this.#getLootItem(itemName);

            const locationName = "Tombola";
            const itemLoot = item.loot || (item.loot = {});
            const reportedLoot = itemLoot[world + timestampInMinutes + "|Tombola"] = {
                count: anzahl,
                loc: locationName,
                season: worldSeason,
            }
            if (stufe) reportedLoot.stufe = stufe;
            if (quelle) reportedLoot.quelle = quelle;
            // Allgemeins .locs
            const locationLoot = item.locs[locationName] || (item.locs[locationName] = {});
            locationLoot.ts = timestampInMinutes;

            await this.#storeItem(item);
        }

        /**
         * Wenn die Stufe direkt aus dem Kampfbericht-Level kommt.
         * @param quelleId z.B. Gruppe_id od. "Tombola"
         */
        static async reportLootSafe(itemName, count, locationName, locationVersion, timestampInMinutes, world, worldSeasonNr, stufe, quelleId, quelleText) {
            return await this.#addLoot(itemName, count, locationName, locationVersion, timestampInMinutes, world, worldSeasonNr, stufe, undefined, quelleId, quelleText);
        }

        /**
         * Wenn die Stufe nur über den eingeloggten User kommt.
         * @param quelleId z.B. Gruppe_id od. "Tombola"
         */
        static async reportLootUnsafe(itemName, count, locationName, locationVersion, timestampInMinutes, world, worldSeasonNr, stufe, quelleId, quelleText) {
            return await this.#addLoot(itemName, count, locationName, locationVersion, timestampInMinutes, world, worldSeasonNr, undefined, stufe, quelleId, quelleText);
        }

        static async #getLootItem(itemName) {
            const itemLootStore = _.WoDStorages.getLootDb();
            const key = itemName.toLowerCase();
            return await itemLootStore.getValue(key) || {
                id: key,
                name: itemName,
                quelle: {},
                locs: {},
                stufen: {}
            };
        }

        /**
         * Für den allgemeinen Loot interessiert uns nur, ob etwas gedroppt ist aber nicht wieviel.
         * Für die Gruppe interessiert uns auch die Menge.
         * Da wir immer zu einer ID abspeichern, kann ein Loot auch mehrfach reported werden ohne dass er mehrfach gespeichert wird.
         *
         * @param count hier die genaue Menge wie viel von dem Item gelootet wurde, kann auch 0 sein, nur um den allgemeinen Drop zu verzeichnen. Der count wird nur für den Gruppen/Saisonloot verwendet.
         * @param heldenstufeGesichert die Stufe aus den Kampfberichten
         * @param heldenstufeUngesichert die Stufe des eingeloggten Nutzers
         * @param quelleId falls wir mehr brauchen als welt+timestamp. Z.B. gruppen_id, "Tombola"
         * @param quelleText z.B. Name der Gruppe
         */
        static async #addLoot(itemName, count, locationName, locationVersion, timestampInMinutes, world, worldSeasonNr, heldenstufeGesichert, heldenstufeUngesichert, quelleId, quelleText) {
            if (!worldSeasonNr || typeof worldSeasonNr !== "number") {
                console.error("WorldSeasonNr wurde beim Loot nicht übermittelt!", itemName);
                return;
            }
            if (!heldenstufeGesichert && !heldenstufeUngesichert) {
                console.error("Heldestufe wurde beim Loot nicht übermittelt!", itemName);
                return;
            }
            const item = await this.#getLootItem(itemName);

            // Allgemeiner Loot: Timestamp => World, LocationName, Stufe(Stufe_)... Cut-Off
            const lootTable = item.loot || (item.loot = {});
            let lootId = world + timestampInMinutes;
            if (quelleId) lootId += "|" + quelleId;
            const curLoot = lootTable[lootId] || (lootTable[lootId] = {});
            if (curLoot.season && curLoot.season !== worldSeasonNr) {
                // Saison hat sich geändert, wir löschen den Loot aus der vorherigen Saison wieder
                this.#removeFromSeasonLoot(item, world, curLoot.season, timestampInMinutes, quelleId);
            }
            curLoot.season = worldSeasonNr;
            curLoot.loc = locationName;
            curLoot.quelle = quelleText;
            curLoot.quelleId = quelleId;
            curLoot.count = count;
            if (locationVersion) curLoot.locv = locationVersion;
            this.#setNumberValue(curLoot, "stufe", curLoot.stufe || heldenstufeGesichert);
            if (curLoot.stufe) {
                delete curLoot.stufe_;
            } else {
                this.#setNumberValue(curLoot, "stufe_", curLoot.stufe_ || heldenstufeUngesichert);
            }

            this.#addToSeasonLoot(item, world, worldSeasonNr, timestampInMinutes, locationName, locationVersion, count, quelleId);

            // Allgemeins .locs
            const locationLoot = item.locs[locationName] || (item.locs[locationName] = {});
            locationLoot.ts = timestampInMinutes;
            if (locationVersion) {
                const versionLoot = locationLoot[locationVersion] || (locationLoot[locationVersion] = {});
                versionLoot.ts = timestampInMinutes;
            }

            // Allgemeine .stufen
            const stufenLoot = item.stufen[heldenstufeGesichert || heldenstufeUngesichert] || (item.stufen[heldenstufeGesichert || heldenstufeUngesichert] = {});
            if (heldenstufeGesichert) {
                stufenLoot.safe = timestampInMinutes;
                delete stufenLoot.unsafe;
            } else if (!stufenLoot.safe) {
                stufenLoot.unsafe = timestampInMinutes;
            }

            // Allgemeine Tage
            const dayInYearId = _.util.formatDate(new Date(timestampInMinutes * 60000)).replaceAll(".", "").substring(0, 4);
            const dayInYearLoot = item.days || (item.days = {});
            dayInYearLoot[dayInYearId] = timestampInMinutes;

            await this.#storeItem(item);
            return item;
        }

        /**
         * Inkl. item.loot - Cut-Off
         */
        static async #storeItem(item) {
            const itemLootStore = await _.WoDStorages.getLootDb();
            const lootTable = item.loot || (item.loot = {});
            const entries = Object.keys(lootTable);
            if (entries.length > this.MAX_LOOT_ENTRIES) {
                // da immer nur ein Loot reported wird, brauchen wir auch nur maximal einen löschen.
                let keyToDelete;
                let minTimestamp = Number.MAX_VALUE;
                for (const cur of entries) {
                    const curTs = Number(cur.match(/^\D+(\d+)[|]?.*$/)[1]);
                    if (curTs < minTimestamp) {
                        keyToDelete = cur;
                        minTimestamp = curTs;
                    }
                }
                delete lootTable[keyToDelete];
            }
            await itemLootStore.setValue(item);
        }

        static #getQuellSeasonId(world, worldSeasonNr, quelleId) {
            return world + worldSeasonNr + "|" + quelleId;
        }

        static #addToSeasonLoot(item, world, worldSeasonNr, timestamp, locationName, locationVersion, count, quelleId) {
            if (count > 0) {
                const quellLootTable = item.quelle || (item.quelle = {});
                this.#addToLoot(quellLootTable, world + worldSeasonNr, timestamp, locationName, locationVersion, count);
                this.#addToLoot(quellLootTable, this.#getQuellSeasonId(world, worldSeasonNr, quelleId), timestamp, locationName, locationVersion, count);
            }
        }

        static #removeFromSeasonLoot(item, world, worldSeasonNr, timestamp, quelleId) {
            const quellLootTable = item.quelle || (item.quelle = {});
            this.#removeFromLoot(quellLootTable, world + worldSeasonNr, timestamp);
            this.#removeFromLoot(quellLootTable, this.#getQuellSeasonId(world, worldSeasonNr, quelleId), timestamp);
        }

        static #addToLoot(quellLootTable, quellSeasonId, timestamp, locationName, locationVersion, count) {
            const groupLoot = quellLootTable[quellSeasonId] || (quellLootTable[quellSeasonId] = {});
            const curGroupLoot = groupLoot[timestamp] || (groupLoot[timestamp] = {});
            curGroupLoot.loc = locationName;
            if (locationVersion) curGroupLoot.locv = locationVersion;
            curGroupLoot.count = count;
        }

        static #removeFromLoot(quellLootTable, quellSeasonId, timestamp) {
            const groupLoot = quellLootTable[quellSeasonId] || (quellLootTable[quellSeasonId] = {});
            delete groupLoot[timestamp];
            if (Object.keys(groupLoot).length === 0) delete quellLootTable[quellSeasonId];
        }

        static #setNumberValue(obj, property, value) {
            value = Number(value);
            if (!isNaN(value)) obj[property] = value;
        }
    }

    /**
     * Funktionalitäten um die WeltSaison zu tracken und liefern zu können.
     */
    static WoDWorldDb = class {

        /**
         * Muss bei Ansicht der "Meine Helden"-Übersicht aufgerufen werden, damit die Welt-Saison getrackt werden kann.
         */
        static async onMeineHeldenAnsicht(doc) {
            doc = doc || document;
            const title = doc.querySelector("h1");
            if (title.textContent.trim() === "Meine Helden") {
                const myWorld = _.WoD.getMyWorld();
                const playerName = _.WoD.getMyUserName();
                const meineHelden = _.MyHeroesView.getIdStufenMap();
                if (!myWorld || Object.keys(meineHelden).length <= 0) return;
                await this.getWorldSeason(myWorld, meineHelden, true, playerName, true); // report World-Season
            }
        }

        static async placeSeasonElem(doc) {
            doc = doc || document;
            const nameElem = doc.querySelector(".hero_full");
            if (nameElem) {
                if (nameElem.getElementsByClassName("wodSeason").length) return;
                nameElem.style.position = "relative";
                const seasonElem = await this.createSeasonElem();
                seasonElem.style.fontSize = "120%";
                seasonElem.style.position = "absolute";
                seasonElem.style.top = "0px";
                seasonElem.style.right = "0px";
                seasonElem.style.zIndex = "100";
                nameElem.parentElement.append(seasonElem);
            }
        }

        static async createSeasonElem(seasonNr, doc) {
            seasonNr = seasonNr || await _.WoD.getMyWorldSeasonNr();
            doc = doc || document;
            const seasonElem = doc.createElement("sup");
            seasonElem.classList.add("nowod");
            seasonElem.classList.add("wodSeason");
            seasonElem.style.position = "relative";
            seasonElem.style.opacity = "0.7";
            seasonElem.style.fontSize = "60%";
            seasonElem.style.display = "inline-block";
            seasonElem.style.color = "white";
            seasonElem.style.verticalAlign = "middle";
            seasonElem.style.cursor = "help";
            seasonElem.innerHTML = "<span style='position:relative; opacity: 0.7; top:-0.2em;'>🌐</span>"; // 📅🗓⏰🕗📆🌍
            seasonElem.title = "Die aktuelle Welt-Saisonnummer: " + seasonNr + "\nFalls diese nach einem Weltneustart falsch sein sollte, hat die Automatik nicht funktioniert. Dann bitte in den Kampfberichte-Archiv-Einstellungen eine neue Saison erzwingen.";

            const innerElem = doc.createElement("span");
            innerElem.style.display = "inline-block";
            innerElem.style.position = "absolute";
            innerElem.style.height = "100%";
            innerElem.style.width = "100%";
            innerElem.style.textAlign = "center";
            innerElem.style.left = "0px";
            innerElem.innerHTML = seasonNr;
            innerElem.style.marginTop = "auto";
            innerElem.style.marginBottom = "auto";
            seasonElem.append(innerElem);

            return seasonElem;
        }

        static async getCurrentWorldSeasonNr(doc) {
            const heroId = _.WoD.getMyHeroId(doc);
            if (!heroId) return; // ohne heroId kein Resultat
            const worldId = _.WoD.getMyWorld(doc);
            const heroStufe = _.WoD.getMyStufe(doc);
            const playerName = _.WoD.getMyUserName(doc);
            return await this.getWorldSeasonNr(worldId, {[heroId]: heroStufe}, document === doc, playerName);
        }

        static #createNewWorldSeason(myheroIdsMitStufen) {
            const now = new Date().getTime();
            return {time: [now, now], myheroes: myheroIdsMitStufen};
        }

        static async getWorldSeasonNr(worldId, myheroIdsMitStufen, aktualisiereZeit, playerName) {
            const [season, seasonNr] = await this.getWorldSeason(worldId, myheroIdsMitStufen, aktualisiereZeit, playerName, false);
            return seasonNr;
        }

        static async forceNewSeason() {
            const worldId = _.WoD.getMyWorld();
            const heroId = _.WoD.getMyHeroId();
            const heroStufe = _.WoD.getMyStufe();
            const worldDb = _.WoDStorages.getWorldDb();
            const world = await worldDb.getValue(worldId);
            world.seasons.push(this.#createNewWorldSeason({[heroId]: heroStufe}));
            await worldDb.setValue(world);
        }

        static worldSeasonAlerted = false;
        static worldResetFallback = false;

        /**
         * Playername kann im Forum nicht ermittelt werden und ist somit undefined
         * @returns {Promise<({season, seasonNr: number[]}|number)[]|*[]>}
         */
        static async getWorldSeason(worldId, myheroIdsMitStufen, aktualisiereZeit, playerName, istHeldenAnsichtUebermittlung) {
            const worldDb = _.WoDStorages.getWorldDb();
            let world = await worldDb.getValue(worldId);
            const now = new Date().getTime();
            if (!world) {
                const newSeason = this.#createNewWorldSeason(myheroIdsMitStufen);
                world = {id: worldId, seasons: [newSeason], player: playerName};
                await worldDb.setValue(world);
                return [newSeason, 1];
            }

            let [foundSeasonNr, foundSeason] = this.#findMatchingWorldSeason(world.seasons, myheroIdsMitStufen);
            if (foundSeason) {
                this.#copyOver(myheroIdsMitStufen, foundSeason.myheroes);
                if (aktualisiereZeit) foundSeason.time[1] = now;
                if (playerName) world.player = playerName;
                await worldDb.setValue(world);
                return [foundSeason, foundSeasonNr];
            } else { // Welt-Reset entdeckt
                if (!istHeldenAnsichtUebermittlung) { // World-Reset vorerst verhindern, das geht dann nur über die "Meine Helden"-Seite.
                    if (!this.worldSeasonAlerted && _.WoD.getView() !== _.WoD.VIEW.MY_HEROES) {
                        alert("Es wurde ein noch unbekannter Held in der Saison erkannt. Zur vollständigen Saisonbestimmung bitte einmalig die 'Meine Helden'-Seite aufrufen!");
                        this.worldSeasonAlerted = true;
                    }
                    const lastSeasonNr = world.seasons.length;
                    return [world.seasons[lastSeasonNr], lastSeasonNr];
                }

                console.log("World-Reset entdeckt !!!!!", worldId, myheroIdsMitStufen, aktualisiereZeit, playerName, world);
                let confirm;
                if (playerName && world.player !== playerName) {
                    confirm = window.confirm(GM.info.script.name + ": Der Spielername hat sich geändert '" + world.player + "' => '" + playerName + "'!!\n\nFür den neuen Spieler konnte keine laufende Saison ermittelt werden.\nSoll eine neue Saison angelegt werden? (Aktuelle Saison: " + world.seasons.length + ")");
                } else {
                    confirm = window.confirm(GM.info.script.name + ": Ein World-Rest wurde entdeckt, wollen sie die neue Saison starten? (Aktuelle Saison: " + world.seasons.length + ")");
                }
                if (confirm) {
                    const newSeason = this.#createNewWorldSeason(myheroIdsMitStufen);
                    world.seasons.push(newSeason);
                    await worldDb.setValue(world);
                    return [newSeason, world.seasons.length];
                }
            }
        }

        static #copyOver(from, to) {
            for (const [key, value] of Object.entries(from)) {
                if (value > 0) to[key] = value;
            }
        }

        static #findMatchingWorldSeason(seasons, myheroIdsMitStufen) {
            for (let i = seasons.length - 1; i >= 0; i--) {
                const season = seasons[i];
                let foundMatching = false;
                for (const [heroId, aktuelleHeldenStufe] of Object.entries(myheroIdsMitStufen)) {
                    const letzteHeldenStufe = season.myheroes[heroId];
                    if (letzteHeldenStufe) {
                        if (aktuelleHeldenStufe < letzteHeldenStufe) return []; // Gleiche ID aber wengier Stufe => Welt-Reset gefunden
                        else foundMatching = true;
                    }
                }
                if (foundMatching) return [i + 1, season];
            }
            return [];
        }

    }

    static WoDItemDb = class {

        /**
         * Items können dennoch Unique für einen bestimmten Bereich sein
         * siehe z.B. Abgrund-Quest-Uniques oder auf bestimmte Stufen begrenzt
         */
        static GENERATOR_ITEMS = [
            [
                ["", "Gut", "Sehr gut", "Perfekt", "Göttlich"], // Stufe
                ["Amulett", "Armreif", "Gürtel", "Ring", "Talisman", "Umhang"],
                ["der göttlichen Strafe", "des Armbrustschützen", "des Bücherwurms", "des Giftmischers", "des strahlenden Anführers", "des magischen Flusses", "der magischen Markierung",
                    "des wilden Tieres", "des überragenden Ringers", "der Mannigfaltigkeit", "des meisterlichen Messerwerfers", "des Keulenschwingers", "des Kräutersammlers", "des listenreichen Kämfpers",
                    "des meisterlichen Schrotes", "des Meisters mit der Schlinge", "des Ritualisten", "des Schwertmeisters", "des primitiven Affen", "des Spaßmachers", "des Seilschwingers", "des Stabfechters",
                    "des meisterlichen Speerträgers", "des göttlichen Segens", "des Duellanten", "des Axtkämpfers", "der Tarnung", "der überragenden Schildparade", "des Alchemisten", "des Blasrohrschützen",
                    "des bösen Blickes", "des Duellschützen", "des geborenen Spötters", "des Heilers", "der Einschüchterung", "der flinken Klinge", "der magischen Verteidigung"]
            ],
            [ // Waffen Generator
                ["", "Einfach", "Gut", "Verbessert", "Perfekt", "Sagenhaft"], // Stufe, aber: Äxte haben z.B. statt diesem Präfix eigene Namen
                ["Flammend", "Frostig", "Smaragd", "Vipern", "Quarz", "Runenbeschrieben", "Ursprünglich", "Leicht", "Magisch", "Gut"], // zweiter Präfix, Parierdolch hat hier z.B. auch "Gut" ist aber keine "Stufe"
                ["", "des Hasses", "der Geschwindigkeit", "der Gewandtheit", "der Vitalität", "mit Perlmutt", "mit Smaragd"],
            ],
            [
                ["Gesegnet"],
                ["Armband"],
                ["der göttlichen Gnade", "der Heilkunst", "der Lebensenergie", "der Magieresistenz", "der Manaregeneration", "der Raserei", "der Zuversicht", "des abgehärteten Kämpen", "des Formwandlers",
                    "des inneren Fokus", "des Kräuterkundigen", "des Magus", "des Naturzauberers", "des ruhmreichen Feldherren", "des Schutz wider der Elemente", "des Widerstandes"]
            ],
            [ // Szepter und Streitkolben
                ["Normal", "Gesegnet", "Geweiht", "Geheiligt", "Göttergeschmiedet"],
                ["Demosan-", "Lion-"],
                [],
            ],
            [ // Barbar Lendenschurz
                ["Blutiger"],
                [],
                ["des Berserkers"],
            ],
            [ // Felle (z.B. "Handschuhe aus edlem Luchsfell" (Vollständig)
                ["Handschuhe", "Mütze", "Weste"],
                ["schäbig", "", "gut", "edlem"], // Stufe
                ["Bärenfell", "Luchsfell", "Jaguarfell", "Wolfsfell", "Pantherfell", "Kaninchenfell"],
            ],
            [ // Gebetsstab / Seherstab mit Suffix (für Prohpet)
                ["Vergessen", "", "Gesegnet", "Geweiht", "Geheiligt", "Göttergeschmiedet"],
                ["Aiara-", "Akbeth-", "Rashon-"],
                ["", "aus Giftranken", "aus Glutborke", "des Hirten", "des Orakels", "des Richters"],
            ],
            [ // der Mannigfaltigkeit
                ["Gut", "Sehr gut", "Perfekt", "Göttlich"], // Stufe
                ["Amulett", "Gürtel", "Talisman", "Umhang", "Stirnband"],
                ["der Mannigfaltigkeit"],
            ],
            [ // Schmuck: Bronze bis Platin
                ["Bronze-", "Silber-", "Gold-", "Platin-"], // Stufe
                ["Armreif", "Halskette", "Ring", "Ohrring", "Schmuckgürtel"],
                ["der Mannigfaltigkeit", "mit kleinem Rubin", "mit kleinem Saphir"],
            ],
            [ // Stufe 29 Generator
                ["Leicht", "Verstärkt", "Gesegnet"], // Stufe
                ["Nicolit-Beinschienen", "Nicolit-Panzerhandschuhe", "Nicolit-Panzerstiefel"],
                ["des furchtlosen Kriegers", "des weisen Magiers", "des standhaften Beschützers", "der helfenden Hand"]
            ],
            [ // Abgrund-Quest: Muschellamellen
                ["Abweisende", "Kantige", "Passgenaue"], // Typ
                [""], // "Magma/Tiefen"
                ["der Aufmerksamkeit", "der Austrahlung", "der Durchsetzungsstärke", "der Geistesgegenwart", "der Geschwindikeit", "der Gesundheit", "der Gewandheit", "der Kraft"],
            ],
            [ // Abgrund-Quest: Quallenseide
                ["Passgenaue", "Strahlende"], // Typ
                [""], // "Magma/Tiefen"
                ["der Aufmerksamkeit", "der Austrahlung", "der Durchsetzungsstärke", "der Geistesgegenwart", "der Geschwindikeit", "der Gesundheit", "der Gewandheit", "der Kraft"],
            ],
            [ // Abgrund-Quest-Perlen
                ["Große", "Pulsierend"], // Typ
                ["blauschimmernd", "grünschimmernd", "rotschimmernd", "goldschimmernd"],
                ["Kanjalperle", "Perle"],
            ],
            [ // Mönch-Generator
                ["", "Leicht", "Magisch", "Robust"],
                ["Stirnband", "Haube", "Kappe"],
                ["des unbeirrbaren Kriegers", "des Assassinen", "der totalen Abstinenz"],
            ]
        ];

        static isGeneratorItem(itemName) {
        }

        static async getItem(itemName) {
            return await _.WoDStorages.getItemDb().getValue(itemName.toLowerCase());
        }

        static async setItem(item) {
            await _.WoDStorages.getItemDb().setValue(item);
        }

        /**
         * Wird für geparste als auch für Source-Items gleichermaßen genutzt.
         */
        static createItem(itemName, doc, silent) {
            doc = doc || document;
            if (!this.isValidItemName(itemName)) {
                if (!silent) {
                    console.error("ItemName ist nicht korrekt: '" + itemName + "'");
                    throw new Error("ItemName ist nicht korrekt: '" + itemName + "'"); // TODO: nur temorär aktiv!?
                }
                return;
            }
            const now = new Date().getTime();
            return {
                id: itemName.toLowerCase(),
                name: itemName,
                ts: now,
                data: 0,
                world: {
                    [_.WoD.getMyWorld(doc)]: {
                        ts: now,
                        valid: 1,
                    }
                }
            }
        }

        static isVGName(itemName) {
            return !!itemName.match(/\(\d+\/\d+\)/);
        }

        static getItemVGBaseName(itemName) {
            const myMatch = itemName.match(/^(.*) \(\d+\/\d+\)$/);
            if (!myMatch) return;
            return myMatch[1];
        }

        /**
         * @return [vgBaseName, amount, max]
         */
        static getItemVGInfos(itemName) {
            const myMatch = itemName.match(/^(.*) \((\d+)\/(\d+)\)$/);
            if (!myMatch) return [];
            return [myMatch[1], myMatch[2], myMatch[3]];
        }

        static isValidItemName(itemName) {
            if (itemName.length < 1) return false;
            return !!itemName.match(/^[\p{Letter}0-9 ():,'.+?!-]*$/u);
        }

        static couldBeValid(itemIndex, myWorldId) {
            const myWorldInfo = itemIndex.world && itemIndex.world[myWorldId];
            if (!myWorldInfo) return true;
            return myWorldInfo.valid;
        }
    }

    static WoDLocationDb = class {

        static createLocation(locationName) {
            return {
                name: locationName,
                versions: [],
            }
        }

        /**
         * @param baseLocationName
         * @param dungeonId sofern vorhanden z.B. über den Kampfkonfig-Konfiguratione
         * @param questName
         */
        static async reportLocationId(baseLocationName, dungeonId, questName) {
            const locationDb = _.WoDStorages.getLocationDb();
            let location = await locationDb.getValue(baseLocationName);
            if (!location) location = this.createLocation(baseLocationName);
            if (!location.id) {
                location.id = dungeonId;
                if (questName) location.quest = questName;
                await locationDb.setValue(location);
            }
        }

        static async getVersionCount(baseLocName, location) {
            location = location || await _.WoDStorages.getLocationDb().getValue(baseLocName);
            if (!location || !location.versions) return 0;
            return Object.keys(location.versions).length;
        }

        static async hasMoreThanOneVersion(baseLocName, location) {
            return await this.getVersionCount(baseLocName, location) > 1;
        }

        static async getFullLocName(baseLocName, versionNr) {
            const location = await _.WoDStorages.getLocationDb().getValue(baseLocName);
            let locName = baseLocName;
            if (await this.hasMoreThanOneVersion(baseLocName, location)) {
                if (versionNr) locName += " (v" + versionNr + ")";
                else locName += " (v?)";
                let prefix = location.quest;
                if (!prefix) prefix = location.schlacht;
                if (prefix) locName = prefix + ": " + locName;
            }
            return locName;
        }
    }

    static WoDSkillsDb = class {
        static #skillDataVersion = 3;

        static TYP = {
            ANGRIFF: "Angriff",
            VERSCHLECHTERUNG: "Verschlechterung",
            HEILUNG: "Heilung",
            VERBESSERUNG: "Verbesserung",
            RUFT_HELFER: "Ruft Helfer",
            INITIATIVE: "Initiative",
        }

        static ANGRIFFSTYP = {
            NAHKAMPF: "Nahkampf",
            FERNKAMPF: "Fernkampf",
            ZAUBER: "Zauber",
            SOZIAL: "Sozial",
            FALLE_ENTSCHAERFEN: "Falle entschärfen",
            FALLE_AUSLOESEN: "Falle auslösen",
            NATURGEWALT: "Naturgewalt",
            KRANKHEIT: "Krankheit",
            VERSCHRECKEN: "Verschrecken",
            HINTERHALT: "Hinterhalt",
            EXPLOSION: "Explosion",
        }

        static async getSkill(skillName) {
            const skill = await _.WoDStorages.getSkillsDb().getValue(skillName.toLowerCase());
            if (skill && skill.dv === this.#skillDataVersion) return skill;
            return null;
        }

        static async getSkillWithDirectLoad(skillName) {
            let skill = await _.WoDStorages.getSkillsDb().getValue(skillName.toLowerCase());
            if (skill && skill.dv === this.#skillDataVersion) return skill;
            // ad-hoc load
            const content = await _.util.loadViaXMLRequest(this.getSkillUrlAlsPopup(skillName));
            const doc = await _.util.getDocumentFor(content);
            return this.onSkillPageDirect(doc);
        }

        static isAngriff(skillTyp) {
            return skillTyp === _.WoDSkillsDb.TYP.ANGRIFF || skillTyp === _.WoDSkillsDb.TYP.VERSCHLECHTERUNG;
        }

        static async onSkillPage(doc) {
            const _this = this;
            return _.WindowManager.onlyOnce("onSkillPage", async function () {
                return await _this.onSkillPageDirect(doc);
            });
        }

        static async onSkillPageDirect(doc, content) {
            doc = doc || document;
            const skillName = doc.getElementsByTagName("h1")[0].textContent.trim().substring(11).trim();
            const now = new Date().getTime();
            const skill = {
                id: skillName.toLowerCase(),
                name: skillName,
                dv: this.#skillDataVersion,
                world: _.WoD.getMyWorld(doc),
                ts: now
            };
            this.#parseSkillBeschreibung(doc, skill);
            if (!skill.typ) {
                console.warn("Skill '" + skillName + "' kann nicht bestimmt werden", doc);
                return;
            }
            content = doc.getElementsByClassName("main_content")[0].outerHTML;
            const skillSource = {
                id: skillName.toLowerCase(),
                src: content,
                world: _.WoD.getMyWorld(doc),
                ts: now
            };
            console.log("Skill wurde der Datenbank hinzugefügt", skillSource, skill);
            await _.WoDStorages.getSkillsSourceDb().setValue(skillSource);
            await _.WoDStorages.getSkillsDb().setValue(skill);
            return skill;
        }

        static getSkillUrlAlsPopup(skillName) {
            return "/wod/spiel/hero/skill.php?IS_POPUP=1&name=" + _.util.fixedEncodeURIComponent(skillName);
        }

        /**
         * TODO: Auswirkungen werden noch nicht erfasst
         */
        static #parseSkillBeschreibung(doc, skill) {
            for (const entryTR of doc.querySelectorAll(".content_table tr:nth-child(2) > td:nth-child(2) tr")) {
                const key = entryTR.children[0].textContent.trim();
                let value = entryTR.children[1].textContent.trim();
                switch (key) {
                    case "Typ":
                        // Aktive Angriffe: Angriff, Verschlechterung
                        // Aktive Sonstiges: Heilung, Verbesserung, Ruft Helfer, Initiative
                        // Passiv: Parade
                        skill.typ = value;
                        break;
                    case "Verwendbar":
                        const verwendung = (skill.verwendung = {});
                        const vr = value.includes("in Vorrunde");
                        if (vr) verwendung.vr = 1;
                        const hr = value.includes("in Runde");
                        if (hr) verwendung.hr = 1;
                        const heilung = (value === "zur Heilung");
                        if (heilung) verwendung.h = 1;
                        const parade = (value === "als Parade");
                        if (parade) verwendung.p = 1;
                        break;
                    case "Angriffstyp": // bei typ = Angriff, Parade, Verschlechterung
                        // Nahkampf, Fernkampf, Zauber, Sozial, Falle entschärfen, Verschrecken, Falle auslösen, Naturgewalt, Krankheit
                        skill.angriffstyp = value;
                        break;
                    case "Fertigkeitenklasse":
                        if (value !== "-") skill.klasse = value;
                        break;
                    case "Gegenstand":
                        if (value !== "-") skill.item = value;
                        break;
                    case "Initiative": // Initiativewurf
                        skill.iw = value;
                        break;
                    case "Angriff": // Angriffswurf
                        skill.aw = value;
                        break;
                    case "Parade": // Paradewurf
                        skill.pw = value;
                        break;
                    case "Schaden": // Schadenswurf
                        skill.dmgw = value;
                        break;
                    case "Heilung": // Heilungswurf
                        skill.hw = value;
                        break;
                    case "Mana-Kosten":
                        if (value !== "-") {
                            skill.manabasis = Number(value.match(/\((\d*)\)/)[1]);
                        }
                        break;
                    case "Gewinn an HP":
                        skill.gainHP = value;
                        break;
                    case "Gewinn an MP":
                        skill.gainMP = value;
                        break;
                    case "Finaler Wirkbonus":
                    case "Finaler Wirkbonus:":
                        skill.wirkbonus = value;
                        break;
                    case "Ziel":
                        skill.target = value;
                        break;
                    case "Max. betroffene Helden":
                    case "Max. betroffene Gegner":
                        skill.range = value;
                        break;
                    case "Verlust an HP": // z.B. "Zellteilung"
                        skill.hpLoss = value;
                        break;
                    case "Designed by":
                        // ignorieren
                        break;
                    default:
                        console.warn("Unbekannte Fertigkeitkategorie gefunden, welche aktuell nicht verarbeitet wird: '" + key + "'", skill);
                        alert("Unbekannte Fertigkeitkategorie gefunden, welche aktuell nicht verarbeitet wird: '" + key + "' (" + skill.name + ")");
                        break;
                }
            }
            const classInfo = doc.getElementById("classinfo");
            if (classInfo) {
                skill.classInfo = {};
                const tds = classInfo.querySelectorAll("td");
                for (const td of tds) {
                    let fertigkeitType;
                    let klasse;
                    for (const cur of td.childNodes) {
                        switch (cur.tagName) {
                            case "H3":
                                switch (cur.textContent.trim().replace(" für:", "")) {
                                    case "Basisfertigkeit":
                                        fertigkeitType = "bf";
                                        break;
                                    case "Nebenfertigkeit":
                                        fertigkeitType = "nf";
                                        break;
                                    case "Klassenfremde Fertigkeit":
                                        fertigkeitType = "kf";
                                        break;
                                }
                                break;
                            case undefined:
                                klasse = cur.textContent.trim();
                                break;
                            case "SPAN":
                                const lvl = Number(cur.textContent.match(/ (\d*)\)/)[1]);
                                skill.classInfo[klasse] = {
                                    type: fertigkeitType,
                                    lvl: lvl,
                                }
                                break;
                        }
                    }
                }
            }
        }

    }

    /**
     * Hilfemethoden um allgemeine Informationen von WoD zu erhalten (Name, Gruppe etc.)
     */
    static WoD = class {

        static worldNames = {
            "WA": "Algarion",
            "WB": "Barkladesh",
            "WC": "Cartegon",
            "WD": "Darakesh",
            // Sandkasten??
            // Xerasia
        }

        static worldIds = Object.fromEntries(Object.entries(this.worldNames).map(([a, b]) => [a, b.toLowerCase()]).map(a => a.reverse()))

        // mit Abkürzungen
        static KLASSEN = {
            "Barbar": "Bb",
            "Barde": "Bd",
            "Dieb": "Di",
            "Gaukler": "Ga",
            "Gelehrter": "Ge",
            "Gestaltwandler": "Gw",
            "Gladiator": "Gl",
            "Hasardeur": "Ha",
            "Jäger": "Jä",
            "Klingenmagier": "Km",
            "Magier": "Ma",
            "Mönch": "Mö",
            "Paladin": "Pa",
            "Prophet": "Ph",
            "Priester": "Pr",
            "Quacksalber": "Qu",
            "Ritter": "Ri",
            "Schamane": "Sm",
            "Schütze": "Sü",
        }

        static VOELKER = {
            "Bergzwerg": "BZ",
            "Dinturan": "Di",
            "Gnerk": "Gne",
            "Gnom": "Gno",
            "Grenzländer": "GL",
            "Halbling": "HL",
            "Hügelzwerg": "HZ",
            "Kerasi": "Ke",
            "Mag-Mor-Elf": "MME",
            "Nebelwicht": "Ne",
            "Rashani": "Ra",
            "Tirem-Ag-Elf": "TAE",
            "Waldmensch": "Wa",
        }

        static VIEW = {
            TOMBOLA: "tombola",
            NEWS: "news",
            ITEMS_GEAR: "gear",
            DUNGEONS: "dungeons",
            QUEST: "quest",
            MY_HEROES: "myHeroes",
            MOVE: "move",
            ITEM: "item",
            REPORT_OVERVIEW: "report_overview",
            REPORT: "report",
            REPORT_ITEMS: "report_items", // subsite from REPORT
            REPORT_STATS: "report_stats", // subsite from REPORT
            REPORT_COMBAT: "report_combat", // subsite from REPORT
            SKILL: "skill",
            ITEMS_STORE: "storage",
            EVENTLIST: "eventlist",
            PLAY: "play",
            HERO_CLASS: "heroClass",
        }

        static #viewCache;

        static getView(win) {
            if (win) return this.#getViewIntern(win);
            if (this.#viewCache) return this.#viewCache;
            this.#viewCache = this.#getViewIntern();
            return this.#viewCache;
        }

        static #getViewIntern(win) {
            win = win || window;
            const pathname = win.location.pathname;
            if (pathname.includes("/item/")) return this.VIEW.ITEM;
            if (pathname.includes("/skill/")) return this.VIEW.SKILL;

            const page = _.util.getWindowPage(win);
            switch (page) {
                case "tombola.php":
                    return this.VIEW.TOMBOLA;
                case "": // Login-/News-Page
                case "news.php":
                    return this.VIEW.NEWS;
                case "items.php":
                    const view = _.WoD.getItemsView(win);
                    if (view === "") return this.VIEW.ITEMS_STORE;
                    return view;
                case "dungeon.php":
                    return this.VIEW.DUNGEONS;
                case "new_quest.php":
                case "quests.php":
                    return this.VIEW.QUEST;
                case "heroes.php":
                    return this.VIEW.MY_HEROES;
                case "move.php":
                    return this.VIEW.MOVE;
                case "item.php":
                    return this.VIEW.ITEM;
                case "combat_report.php": // Schlacht
                case "report.php": // Dungeon
                    const title = win.document.getElementsByTagName("h1")[0];
                    if (title.textContent.trim().startsWith("Kampfberichte")) {
                        return this.VIEW.REPORT_OVERVIEW;
                    } else {
                        return this.VIEW.REPORT; // Statistik, Gegenstände oder Kampfbericht
                    }
                case "skill.php":
                    return this.VIEW.SKILL;
                case "eventlist.php":
                    return this.VIEW.EVENTLIST;
                case "play.php":
                    return this.VIEW.PLAY;
                case "class.php":
                    return this.VIEW.HERO_CLASS;
            }
        }


        static #reportViewCache;

        static getReportView(silent) {
            if (this.#reportViewCache) return this.#reportViewCache;
            this.#reportViewCache = this.#getReportViewIntern(silent);
            return this.#reportViewCache;
        }

        static #getReportViewIntern(silent) {
            const title = document.getElementsByTagName("h1")[0].textContent.trim();
            if (title.startsWith("Kampfstatistik")) return "stats";
            if (title.startsWith("Übersicht Gegenstände")) return "items";
            if (title.startsWith("Kampfbericht:")) return "fight";
            if (title.startsWith("Kampfberichte")) return "overview";
            if (!silent) {
                console.error("Report-Seite konnte nicht ermittelt werden!", title);
                throw new Error("Report-Seite konnte nicht ermittelt werden!");
            }
        }

        /**
         * Wird am Element die Id setzen. Mouseover, mouseout, mousemove events werden vom wodToolTip überschrieben.
         */
        static addTooltip(elem, fnOrHtml, updateable) {
            let tooltip;
            if (typeof fnOrHtml === "string") {
                tooltip = fnOrHtml;
                fnOrHtml = undefined;
            }

            elem.onmouseenter = async function () {
                if (fnOrHtml) tooltip = await fnOrHtml();
                if (tooltip) {
                    if (elem.id) delete unsafeWindow.wodToolTipContent[elem.id];
                    unsafeWindow.wodToolTip(elem, tooltip);
                    if (updateable && typeof fnOrHtml === "function") {
                        elem.onmouseenter = async function (ev) {
                            unsafeWindow.wodToolTipContent[elem.id] = await fnOrHtml();
                        };
                    }
                }
            }
        }

        /**
         * Nutzt zur Sicherheit die letzte "the_form" des Dokumentes, falls Seiten aus dem Archiv angezeigt werden.
         */
        static getMainForm(doc, first) {
            const forms = (doc || document).getElementsByName("the_form");
            if (first) return forms[0];
            return forms[forms.length - 1];
        }

        static getValueFromMainForm(valueType, doc, first) {
            const form = _.WoD.getMainForm(doc, first);
            return form && form[valueType] && form[valueType].value;
        }

        static getMyWorld(doc) {
            return _.WoD.getValueFromMainForm("wod_post_world", doc) || this.getMyWorldFromUrl(doc);
        }


        static getMyWorldFromUrl(doc) {
            let worldName = window.location.hostname;
            worldName = worldName.substring(0, worldName.indexOf("."));
            return this.worldIds[worldName];
        }

        /**
         * Ermittelt den Gruppennamen auf den Seiten des Kampfberichts.
         */
        static isReallyMyGroupOnReportSite() {
            const myGroupName = this.getMyGroupName();
            let statGroupName = document.querySelector("h1").textContent.match(/.*:\s(.*)+/)[1];
            return myGroupName === statGroupName;
        }

        static isInAdminViewMode(doc) {
            return !!this.getValueFromMainForm("set_gruppe_id", doc);
        }

        static getMyGroupName(doc) {
            return this.getValueFromMainForm("gruppe_name", doc);
        }

        static getCurrentGroupName(doc) {
            doc = doc || document;
            if (!this.isInAdminViewMode(doc)) return this.getMyGroupName(doc);
            // Admin-Mode-Fallback
            if (this.getView() === this.VIEW.REPORT) {
                return doc.querySelector("h1").textContent.match(/.*:\s(.*)+/)[1];
            }
            return undefined;
        }

        static getCurrentGroupId(doc) {
            return this.getValueFromMainForm("set_gruppe_id", doc) || this.getValueFromMainForm("gruppe_id", doc);
        }

        static getMyHeroId(doc) {
            doc = doc || document;
            return this.getValueFromMainForm("session_hero_id", doc) || this.getMyHeroIdFromUrl(doc) || this.getHeroIdByFallback2(doc);
        }

        static getMyHeroIdFromUrl(doc) {
            return this.getMyHeroIdFromGivenUrl(new URL(window.location.href));
        }

        static getMyHeroIdFromGivenUrl(url) {
            return url.searchParams.get("session_hero_id");
        }

        static getHeroIdByFallback2(doc) {
            doc = doc || document;
            return this.getMyHeroIdFromGivenUrl(new URL(doc.querySelector(".prevHeroLink").href, document.baseURI));
        }

        /**
         * Gibt das gesichert erste Vorkommen der session_hero_id zurück
         */
        static getMyHeroIdFirst(doc) {
            return _.WoD.getValueFromMainForm("session_hero_id", doc, true) || this.getMyHeroIdFromUrl(doc);
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

        static getCurrentReportLevel(doc) {
            return Number(_.WoD.getValueFromMainForm("current_level", doc));
        }

        static async getMyWorldSeasonNr(doc) {
            return await _.WoDWorldDb.getCurrentWorldSeasonNr(doc);
        }

        static getNaechsterDungeonName() {
            let elem = document.getElementById("gadgetNextdungeonTime");
            if (!elem) return;
            elem = elem.parentElement.getElementsByTagName("a")[0];
            if (!elem) return;
            return elem.textContent.trim();
        }

        /**
         * @returns {number}
         */
        static getNaechsteDungeonZeit(early, doc) {
            doc = doc || document;
            const timeString = this.getNaechsteDungeonZeitString(early, doc);
            if (!timeString) return;
            if (timeString.toLowerCase() === "sofort") return new Date().getTime();
            // TODO: wie ist das beim Tageswechsel?
            return _.WoD.getTimestampFromString(timeString);
        }

        // Kann auch "Morgen 01:16" sein odera auch "sofort"
        static getNaechsteDungeonZeitString(early, doc) {
            doc = doc || document;
            let elem = doc.getElementById("gadgetNextdungeonTime");
            if (!elem) return;
            const curTime = elem.textContent;
            if (!early) return curTime;
            const earlierButton = elem.parentElement.querySelector("input");
            if (!earlierButton) return curTime;
            return earlierButton.value;
        }

        /**
         * "gear": Ausrüstung
         * "groupcellar": Schatzkammer
         * "groupcellar_2": Gruppenlager
         * "cellar": Keller
         * "": Lager
         */
        static getItemsView(win) {
            win = win || window;
            let view = new URL(win.location.href).searchParams.get("view");
            if (!view) view = this.getValueFromMainForm("view", win.document);
            return view;
        }

        static getAllHeroIds(node) {
            node = node || document;
            let result = {};
            for (const cur of document.querySelectorAll(".content_table a[href*=\"/profile.php\"]")) {
                const id = new URL(cur.href).searchParams.get("id");
                if (result[id]) break;
                result[id] = true;
                if (Object.keys(result).length >= 12) break;
            }
            result = Object.keys(result).map(a => Number(a));
            return result;
        }

        /**
         * z.B. "Heute 12:13" => "12.12.2024 12:13", sowie auch "Morgen", "Gestern" und "sofort"
         */
        static getTimeString(wodTimeString, dateFormatter) {
            if (!dateFormatter) dateFormatter = _.util.formatDate;
            if (wodTimeString.includes("Heute")) {
                wodTimeString = wodTimeString.replace("Heute", dateFormatter(new Date()));
            } else if (wodTimeString.includes("Gestern")) {
                const date = new Date();
                date.setDate(date.getDate() - 1);
                wodTimeString = wodTimeString.replace("Gestern", dateFormatter(date));
            } else if (wodTimeString.includes("Morgen")) {
                const date = new Date();
                date.setDate(date.getDate() + 1);
                wodTimeString = wodTimeString.replace("Morgen", dateFormatter(date));
            } else if (wodTimeString.toLowerCase() === "sofort") {
                wodTimeString = _.util.formatDateAndTime(new Date());
            } else if (!wodTimeString.includes(".")) { // nur Uhrzeit
                wodTimeString = dateFormatter(new Date()) + " " + wodTimeString;
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
            let schlachtName;
            let reportIdSuffix = "";
            if (form["report_id[0]"]) {
                reportId = form["report_id[0]"].value;
            } else if (form["report"]) {
                reportId = form["report"].value;
                schlachtName = "Unbekannte Schlacht";
                reportIdSuffix = "S";
                let schlachtLink = doc.querySelector("h1 a[href*='/clanquest/']");
                if (!schlachtLink) schlachtLink = doc.querySelector("h2 a[href*='/clanquest/']");
                if (schlachtLink) schlachtName = schlachtLink.textContent.trim();
            } else if (form["DuellId"]) {
                reportId = form["DuellId"].value;
                reportIdSuffix = "D";
            }

            let ts;
            let locName;
            if (this.getReportType(doc) === "Duell") throw new Error("Duelle werden hier noch nicht unterstützt!");
            const titleSplit = doc.getElementsByTagName("h2")[0].textContent.split(/-(.*)/);
            locName = titleSplit[1].trim().replaceAll("Eure Gruppe vs. ", "");
            ts = this.getTimestampFromString(titleSplit[0].trim()) / 60000;

            const myWorld = this.getMyWorld(doc);
            return {
                reportId: myWorld + reportId + reportIdSuffix, // um mehrere Welten zu unterstützen sollte diese ID verwendet werden
                id: reportId,
                world: myWorld,
                ts: ts, // zu welchem Zeitpunkt der Dungeon stattgefunden hat
                loc: { // Bei einem Dungeon z.B. der Dungeonname
                    name: locName,
                    schlacht: schlachtName, // Name der Schlacht
                },
                gruppe: this.getCurrentGroupName(doc),
                gruppe_id: this.getCurrentGroupId(doc),
                stufe: this.getMyStufe(doc),
            }
        }

        static getItemUrl(itemName) {
            return "/wod/spiel/hero/item.php?IS_POPUP=1&name=" + _.util.fixedEncodeURIComponent(itemName);
        }

        static createSkillLink(skillName, onclickPromise, fixId) {
            return this.createWoDPopupLink(skillName, "/wod/spiel/hero/skill.php", {name: skillName}, onclickPromise, fixId);
        }

        static createItemLink(itemName, instanceId, onclickPromise) {
            const searchParams = {
                name: itemName,
            };
            if (instanceId) searchParams.instanceId = instanceId;
            return this.createWoDPopupLink(itemName, "/wod/spiel/hero/item.php", searchParams, onclickPromise);
        }

        static createWoDPopupLink(anzeigeName, url, searchParams, windowCallback, fixId) {
            const myUrl = new URL(url, document.baseURI);
            if (searchParams) {
                for (const [key, value] of Object.entries(searchParams)) {
                    myUrl.searchParams.append(key, value);
                }
            }
            myUrl.searchParams.append("is_popup", 1);
            const result = document.createElement("a");
            url = myUrl.pathname + myUrl.search;
            result.href = url;
            result.innerHTML = anzeigeName;
            result.target = "_blank";
            const _this = this;
            result.onclick = function () {
                const win = _this.wodPopup(url, undefined, undefined, fixId);
                if (win && windowCallback) windowCallback(win);
                return false;
            }
            return result;
        }

        /**
         * Kopie der wo()-Funktion
         */
        static wodPopup(url, w, h, id) {
            var location = "location=1,statusbar=1,toolbar=1,"
            if (this.isInternUrl(url)) {
                location = "location=0,statusbar=0,toolbar=0,"
                var found = url.search(/is_popup/)
                if (found === -1) url = this.appendGetParam(url, 'is_popup=1')
            }

            if (typeof id == 'undefined') {
                const day = new Date();
                id = day.getTime();
            }

            if (typeof w == 'undefined' || w === 0) {
                w = 8 * screen.width / 10

                if (w > 900)
                    w = 900
            } else if (w <= 100) {
                w = w * screen.width / 100
            }

            if (typeof h == 'undefined' || h === 0)
                h = 8 * screen.height / 10

            else if (h <= 100) {
                h = h * screen.height / 100
            }

            const x = (screen.width - w) / 2
            const y = (screen.height - h) / 2

            var n = window.open(url,
                id,
                location + "scrollbars=1,menubar=0,resizable=1,width=" + w + ",height=" + h + ",left = " + x + ",top = " + y)

            // n==null kann bei Popupblockern passieren, der Browser gibt aber einen Hinweis
            if (n !== null && typeof (n) != 'undefined') {
                n.focus();
            }
            return n;
        }

        static isInternUrl(url) {
            var start = url.substring(0, 1);
            return start === '/' || start === '.';
        }

        static appendGetParam(url, param) {

            const qmark_index = url.indexOf('?')
            if (qmark_index < 0)
                return url + '?' + param

            let anchor = ''
            const anchor_index = url.indexOf('#')

            if (anchor_index > 0) {
                anchor = url.substr(anchor_index)
                url = url.substr(0, anchor_index)
            }

            if (url[url.length - 1] !== '&')
                url = url + '&'

            return url + param + anchor
        }
    }

    static WoDParser = class {

        static getHeroIdFromHref(aElem) {
            return Number(new URL(aElem.href, document.baseURI).searchParams.get("id"));
        }


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
            const allHeadlines = doc.querySelectorAll(".rep_status_headline");
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
                                helden[this.getHeroIdFromHref(curA)] = held;
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
         *         gold: 123, // erhaltenes Gold
         *         exceed: trueOpt, // optional, wenn der User seine Anzahl an Gegenständen überschritten hatten
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
            for (const memberHead of headers) {
                const member = {};
                const id = this.getHeroIdFromHref(memberHead.querySelector("a")); // aufgrund von "../" am Anfang gibts hier keine Absolute location aus .href zurück.
                result[id] = member;
                member.name = memberHead.textContent;
                member.equip = [];
                let memberTable = memberHead.nextElementSibling;
                if (memberTable.tagName !== "TABLE") memberTable = memberTable.nextElementSibling;
                const memberTableUeberschriften = memberTable.querySelectorAll("h3");
                const equipped = memberTableUeberschriften[0].nextElementSibling.querySelectorAll("tr");
                for (let i = 1, l = equipped.length; i < l; i++) { // erst ab Zeile 1
                    const tr = equipped[i];
                    const item = {};
                    member.equip.push(item);
                    item.name = tr.children[1].textContent.trim();
                    const itemA = tr.querySelector("a");
                    let href = itemA.href;
                    if (!href.includes("?")) { // Fehler von WoD, manchmal wird kein Fragezeichen Initial verwendet
                        href = href.replace("&", "?");
                    }
                    item.id = new URL(href).searchParams.get("id");
                    if (itemA.classList.contains("item_unique")) item.unique = true;
                    for (const img of tr.querySelectorAll("img")) {
                        const gemMatch = img.src.match(/gem_(.*)\.png/);
                        if (gemMatch && gemMatch[1] !== "0") item.gems = (item.gems || "") + gemMatch[1];
                        const mgemMatch = img.src.match(/mgem_(.*)\.png/); // gibt es das wirklich?
                        if (mgemMatch) item.mgems = (item.mgems || "") + mgemMatch[1];
                    }

                    let hpMatch = (tr.children[2].textContent.trim() + tr.children[3].textContent.trim()).match(/(\d*)\/(\d*)\((.*)\)/);
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
                                member.gold = Number(goldMatch[1]);
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
                                    item = {keeped: 1}; // keeped
                                    if (!member.loot) member.loot = [];
                                    member.loot.push(item);
                                    item.name = tr.querySelector("a").textContent.trim();
                                    let splitter = tr.children[4].textContent.split("/");
                                    if (splitter.length > 1) item.vg = Number(splitter[0]);
                                } else if (tr.children[1].textContent.startsWith("wurde von")) {
                                    delete item.keeped;
                                }
                            }
                            break;
                    }
                }
            }
            console.log("Übersicht Gegenstände", result);
            return result;
        }

        static updateSuccessInformationsInSchlachtFromBattleReport(doc, success) {
            doc = doc || document;
            success = success || {};
            const gewonnen = doc.getElementsByClassName("rep_room_end")[0].textContent === "Die Angreifer haben gesiegt!";
            success.rooms = [gewonnen ? 1 : 0, 1];
            success.levels = [gewonnen ? 1 : 0, 1];

            const lastActionHeroes = this.getLastHeroTableOnKampfbericht(doc);
            if (!lastActionHeroes) console.log("Cant find lastAction Heroes: ", doc);
            const heroTags = lastActionHeroes.querySelectorAll(".rep_hero, .rep_myhero, .rep_myotherheros");
            let countHeroes = 0;
            let countHeroesSuccess = 0;
            for (const heroTag of heroTags) {
                countHeroes++;
                if (heroTag.parentElement.parentElement.parentElement.children[6].textContent !== "bewusstlos") {
                    countHeroesSuccess++;
                }
            }
            success.members = [countHeroesSuccess, countHeroes];
            return success;
        }

        static getLocationNameFromReport(doc) {
            doc = doc || document;
            return doc.getElementsByTagName("h2")[0].textContent.split(/-(.*)/)[1].trim();
        }

        /**
         * In Schlachten gibt es keine Level etc. auszulesen. Hier müssen die Success-Informationen aus dem vorherigen
         * Stand unbedingt beibehalten werden. Member-Success wird hier z.B. durch den eigentlichen Kampfbericht gesetzt.
         */
        static retrieveSuccessInformationOnStatisticPage(doc, previousSuccess) {
            const locName = this.getLocationNameFromReport(doc);
            const tables = doc.querySelectorAll(".content_table table"); // hat noch nen inner-table
            const table = tables[tables.length - 1];
            const memberNameElements = table.querySelector("tr:nth-child(1)").children;
            const xpElements = table.querySelector("tr:nth-child(2)").children;
            const groupSize = xpElements.length - 2;
            if (_.WoD.isSchlacht(doc)) {
                previousSuccess = previousSuccess || {};
                if (!previousSuccess.levels) previousSuccess.levels = [undefined, 1];
                if (!previousSuccess.rooms) previousSuccess.rooms = [undefined, 1];
                if (!previousSuccess.members) previousSuccess.members = [undefined, groupSize];
                return previousSuccess;
            }
            if (locName === "Atreanijsh") { // Erfolg kann nicht anhand der Statistik ermittelt werden, sondern muss aus den Leveln kommen.

            }

            let xpSum = 0;
            for (const curXpElem of xpElements) {
                const i = Number(curXpElem.textContent);
                if (!isNaN(i)) xpSum += i;
            }
            let xps;
            if (xpSum > 0) xps = xpSum;

            const levelElements = table.querySelector("tr:nth-child(5)").children;
            const roomElements = table.querySelector("tr:nth-child(6)").children;
            let finishedRooms = 0;
            let fullRooms = 0;
            let fullSuccessMembers = 0;
            let maxSuccessLevel = 0;
            let maxLevel;

            const getSucceededNumbers = function (roomsSucceeded, roomsCount, levelsSucceeded, levelCount) {
                if (locName === "Offene Rechnung" || locName === "Bühne frei!") {
                    if (roomsSucceeded > 0) {
                        roomsSucceeded++;
                        levelsSucceeded++;
                    }
                } else if (locName === "Das Schloss in den Wolken") {
                    // wenn Altes Goldstück in neues Goldstück eingetauscht wird: Level 9 als Belohnungslevel wird nicht gezählt
                    if (levelsSucceeded === 8 && levelCount === 9 && roomsSucceeded === 9 && roomsCount === 10) {
                        roomsSucceeded++;
                        levelsSucceeded++;
                    }
                }
                return [roomsSucceeded, levelsSucceeded];
            }
            const kos = {};

            for (let i = 1, l = levelElements.length - 1; i < l; i++) {
                const memberName = memberNameElements[i].textContent.trim();
                const roomsElement = roomElements[i];
                const roomSplit = roomsElement.textContent.split("/");
                fullRooms += Number(roomSplit[1]);
                const levelElement = levelElements[i];
                const levelSplit = levelElement.textContent.split("/");

                let curFinishedRoom = Number(roomSplit[0]);
                let curSuccessLevel = Number(levelSplit[0]);
                [curFinishedRoom, curSuccessLevel] = getSucceededNumbers(curFinishedRoom, Number(roomSplit[1]), curSuccessLevel, Number(levelSplit[1]));
                if (curSuccessLevel > maxSuccessLevel) maxSuccessLevel = curSuccessLevel;
                if (!maxLevel) maxLevel = Number(levelSplit[1]);
                if (curSuccessLevel >= maxLevel) fullSuccessMembers++;
                else kos[memberName] = curSuccessLevel;
                finishedRooms += curFinishedRoom;
            }

            const result = {
                levels: [maxSuccessLevel, maxLevel],
                rooms: [finishedRooms, fullRooms],
                members: [fullSuccessMembers, groupSize],
            };
            if (Object.keys(kos).length > 0) result.ko = kos;
            if (xps) result.xp = xps;
            return result;
        }

        /**
         * Versucht soweit alle Elemente die nicht zum Main-Content gehören rauszufiltern.
         * Wir greifen nicht alleinig den Main_Content ab, um auch CSS und "the_form" etc. mit zu bekommen
         * Stellt sicher, dass alle URLs relativ zur Domain definiert sind.
         */
        static getPlainMainContent(doc) {
            doc = doc || document;
            const myDocument = doc.cloneNode(true);

            let gadgetTable = myDocument.querySelector("#gadgettable tbody");
            if (gadgetTable) { // existiert in nem Popup nicht
                _.util.forEachSafe(gadgetTable.children, curTR => {
                    if (!curTR.querySelector("div#main_content")) {
                        curTR.remove();
                    } else { //
                        _.util.forEachSafe(curTR.children, curTD => {
                            if (!curTD.querySelector("div#main_content")) {
                                curTD.remove();
                            }
                        });
                    }
                });
            }
            gadgetTable = myDocument.querySelector("#gadgettable-center-gadgets");
            if (gadgetTable) { // existiert in nem Popup nicht
                _.util.forEachSafe(gadgetTable.children, curTR => {
                    if (!curTR.querySelector("div#main_content")) {
                        curTR.remove();
                    }
                });
            }

            if (myDocument.querySelector("#gadgettable-left-td")) {
                throw new Error("Bereinigung fehlgeschlagen!")
            }

            const removeClassNodes = function (node, className) {
                for (const cur of node.querySelectorAll("." + className + ":not(." + className + " ." + className + ")")) {
                    cur.remove();
                }
            }
            removeClassNodes(myDocument.documentElement, "nowod");
            removeClassNodes(myDocument.documentElement, "tutorial");
            removeClassNodes(myDocument.documentElement, "intro_open");

            const tooltip = myDocument.getElementsByClassName("tooltip")[0];
            if (tooltip) tooltip.remove();

            // Stellt sicher, dass auch immer der Pfad mit bei einer URL-Angabe mit dabei ist.
            // Wenn die Datei exportiert wird, wird die Pfadangabe ja ebenfalls "vergessen".
            this.ensureAllUrlsHavePathname(myDocument);
            for (const aElem of myDocument.querySelectorAll("a")) {
                const onclick = aElem.getAttribute("onclick")
                if (onclick && onclick.startsWith("return wo(")) {
                    aElem.setAttribute("onclick", "return wo(this.href);");
                }
            }
            return myDocument;
        }

        /**
         * Stellt sicher, dass alle gängigen URLs relativ zur Domain definiert sind.
         */
        static ensureAllUrlsHavePathname(myDocument) {
            const pathName = window.location.pathname;
            const path = pathName.substring(0, pathName.lastIndexOf("/"));
            this.rewriteAllUrls(myDocument, url => {
                if (!url) return url;
                if (url === "") return "";
                if (url.startsWith("http") || url.startsWith("/") || url.startsWith("data:") || url.startsWith("#")) return url;
                // Übrig bleiben alle relativ definierten Pfade. Hier müssen wir den Pfad auch anhängen
                return path + "/" + url;
            })
        }

        static rewriteAllUrls(myDocument, converter) {
            for (const cur of myDocument.getElementsByTagName("a")) {
                const value = converter(cur.getAttribute("href"));
                if (value) cur.href = value;
            }

            for (const cur of myDocument.getElementsByTagName("img")) {
                const value = converter(cur.getAttribute("src"));
                if (value) cur.src = value;
            }

            for (const cur of myDocument.getElementsByTagName("script")) {
                const value = converter(cur.getAttribute("src"));
                if (value) cur.src = value;
            }

            for (const cur of myDocument.getElementsByTagName("link")) {
                const value = converter(cur.getAttribute("href"));
                if (value) cur.href = value;
            }
        }
    }

    static MyHeroesView = class {

        /**
         * id -> Stufe
         */
        static getIdStufenMap() {
            const helden = {};
            const trs = document.querySelectorAll("#main_content .content_table tr");
            for (let i = 1, l = trs.length; i < l; i++) {
                const curTR = trs[i];
                const heroId = Number(new URL(curTR.children[0].querySelector("a").href, document.baseURI).searchParams.get("id"));
                helden[heroId] = Number(curTR.children[2].textContent);
            }
            return helden;
        }

        static getFullInformation() {
            const helden = {};
            const trs = document.querySelectorAll("#main_content .content_table tr");
            for (let i = 1, l = trs.length; i < l; i++) {
                const curHero = {};
                const curTR = trs[i];
                const aElemns = curTR.querySelectorAll("a");
                const heroAElem = aElemns[0];
                curHero.id = Number(new URL(heroAElem.href, document.baseURI).searchParams.get("id"));
                helden[curHero.id] = curHero;
                curHero.name = heroAElem.textContent;
                curHero.active = heroAElem.classList.contains("hero_active");
                curHero.klasse = aElemns[1].textContent;
                curHero.stufe = Number(curTR.children[2].textContent);
                const dungeonTD = curTR.children[4];
                const mouseOverMatch = ("" + dungeonTD.onmouseover).match(/wodToolTip\(this,'(.*)'\)/);
                if (mouseOverMatch) curHero.nextDungeon = mouseOverMatch[1];
                curHero.nextDungeonTime = _.WoD.getTimestampFromString(dungeonTD.textContent.trim());
            }
            return helden;
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
                            return ["", "[npc:" + decodeURIComponent(node.href.match(/\/npc\/(.*?)&/)[1].replaceAll("+", " ")) + "]", ""];
                        } else if (node.href.includes("item.php")) {
                            const urlParams = new URL(node.href).searchParams;
                            console.log("Found URL-Params", node.href, new URL(node.href).searchParams, new URL(node.href).searchParams.get("name"), decodeURIComponent(new URL(node.href).searchParams));
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

        static #alreadyLoaded = {};

        static async useJQueryUI() {
            if (_.WindowManager.getMark("jQueryUI-CSS")) return;
            _.WindowManager.mark("jQueryUI-CSS", true);
            const css = document.styleSheets[0];

            function addCssRule(rule) {
                css.insertRule(rule, css.cssRules.length);
            }

            // datepicker
            addCssRule(".ui-datepicker {background-color:black;}");
            addCssRule(".ui-datepicker .ui-datepicker-header {\n" +
                "    background: #339999;\n" +
                "    color: #ffffff;\n" +
                "    font-family:'Times New Roman';\n" +
                "    border-width: 1px 0 0 0;\n" +
                "    border-style: solid;\n" +
                "    border-color: #111;\n" +
                "}");
            addCssRule(".ui-datepicker .ui-datepicker-title {\n" +
                "    text-align: center;\n" +
                "    font-size: 15px;\n" +
                "\n" +
                "}");
            addCssRule(".ui-datepicker .ui-datepicker-prev {\n" +
                "    float: left;\n" +
                "    cursor: pointer;\n" +
                "    background-position: center -30px;\n" +
                "}");
            addCssRule(".ui-datepicker .ui-datepicker-next {\n" +
                "    float: right;\n" +
                "    cursor: pointer;\n" +
                "    background-position: center 0px;\n" +
                "}");

            // select2
            _.Libs.addCSS("https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/css/select2.min.css");
            let standardSelect = document.createElement("select");
            standardSelect.style.display = "none";
            document.body.append(standardSelect);

            // Farben aus dem Skin übernehmen
            standardSelect = $(standardSelect);
            const bg = standardSelect.css('background-color');
            const c = standardSelect.css('color');
            standardSelect.remove();
            addCssRule('.select2-selection, .select2-dropdown { background: ' + bg + ' !important; } ');
            addCssRule('.select2-selection span { color: ' + c + ' !important; } ');
            addCssRule('.select2-dropdown li[aria-selected="true"] { background-color: rgba(255, 255, 255, 0.25) !important; } ');
            addCssRule('.select2-results__option { padding: 0px !important; padding-left: 5px !important; min-height:20px !important;} ');
            addCssRule('.button_image_info { width: 20px; } ');
            addCssRule('.select2-container--default .select2-selection--single { border-color: #999999 !important;}')
            //addRule('.select2-selection__rendered { font-size: 14px; } ');
            addCssRule('.select2-results__options { max-height: ' + (window.screen.height * 0.4) + 'px !important; } ');
            addCssRule('.select2-container, .select2-selection--single, .select2-selection__rendered, .select2-selection__arrow { height: 20px !important; line-height: 20px !important; } ');
            addCssRule('.button_image_info { margin-top: -5px; } ');

            $(document).on('select2:open', () => {
                document.querySelector('.select2-search__field').focus();
            });
        }

        static betterInput(inputElement) {
            this.useJQueryUI();
            inputElement.style.margin = "0px";
            inputElement.style.padding = "0px";
            inputElement.style.paddingLeft = "8px";
            inputElement.style.paddingRight = "8px";
            inputElement.style.borderRadius = "4px";
            if (inputElement.type === "button") inputElement.style.height = "21px";
            else inputElement.style.height = "20px";
            inputElement.style.fontWeight = "normal";
            inputElement.style.fontSize = "14px";
        }

        static betterSelect(selectField, cfg) {
            cfg = cfg || {};
            cfg.dropdownAutoWidth = true;
            cfg.width = "auto";
            setTimeout(function () {
                $(selectField).select2(cfg);
            }, 0);
        }

        static betterSelect2(selectField, cfg) {
            cfg = cfg || {};
            cfg.dropdownAutoWidth = true;
            setTimeout(function () {
                $(selectField).select2(cfg).parent().find(".select2-container").each(function () {
                    $(this).width($(this).width() * 1.05 + 10);
                });
            }, 0);
        }

        static addCSS(url) {
            let searchUrl = url;
            const idx = searchUrl.indexOf("?");
            if (idx > -1) searchUrl = searchUrl.substring(0, idx);
            if (this.#alreadyLoaded[searchUrl]) return;
            this.#alreadyLoaded[searchUrl] = this.addCSSDirect(url);
        }

        static addCSSDirect(url, doc) {
            doc = doc || document;
            const result = doc.createElement("link");
            result.rel = "stylesheet";
            result.type = "text/css";
            result.href = url;
            doc.head.append(result);
            return result;
        }

        static removeCSS(url) {
            const idx = url.indexOf("?");
            if (idx > -1) url = url.substring(0, idx);
            const loaded = this.#alreadyLoaded[url];
            if (loaded) {
                document.head.removeChild(loaded);
                delete this.#alreadyLoaded[url];
                return true;
            }
            return false;
        }

        static loadViaIFrame(url, doc) {
            doc = doc || document;
            const iframe = doc.createElement("iframe");
            iframe.style.display = "none";
            doc.body.append(iframe);
            iframe.src = url; // src muss als letztes gesetzt werden
            return iframe;
        }

        static async loadViaIFrameAndWaitForIt(url, id, name) {
            return new Promise((resolve, reject) => {
                const iframe = document.createElement("iframe");
                if (id) iframe.id = id;
                if (name) iframe.name = name;
                iframe.onload = function () {
                    if (iframe.src === url) {
                        console.log("IframeResolved ", iframe.src, iframe.contentWindow.location);
                        resolve(iframe);
                    }
                }
                iframe.style.display = "none";
                document.body.append(iframe);
                iframe.src = url; // src muss als letztes gesetzt werden
            })
        }

        static async loadViaInjection(url) {
            if (this.#alreadyLoaded[url]) return false;
            const thisObject = this;
            return new Promise((result, reject) => {
                const lib = document.createElement("script");
                lib.type = "text/javascript";
                lib.src = url;
                lib.onload = function (e) {
                    thisObject.#alreadyLoaded[url] = true;
                    result(true);
                }
                lib.onerror = e => reject(e);
                document.head.append(lib);
            });
        }

        static async evalViaXMLRequest(url) {
            if (this.#alreadyLoaded[url]) return false;
            const responseText = await _.util.loadViaXMLRequest(url);
            this.#alreadyLoaded[url] = true;
            unsafeWindow.eval(responseText);
            return true;
        }
    }

    static WoDUI = class {
        static addTitleButtonBar(buttonContentArray) {
            const wodTitle = document.getElementsByTagName("h1")[0];
            const buttonBar = document.createElement("sup");

            const wodOriginalContent = document.createElement("div");
            const titleParent = wodTitle.parentElement;
            const titleIdx = Array.prototype.indexOf.call(titleParent.childNodes, wodTitle);
            for (let i = titleIdx + 1, l = titleParent.childNodes.length; i < l; i++) {
                wodOriginalContent.append(titleParent.childNodes[i]);
                i--;
                l--;
            }
            const contentAnchor = document.createElement("div");
            titleParent.append(contentAnchor);
            contentAnchor.append(wodOriginalContent);
            wodTitle.append(buttonBar);

            let currentButton = buttonContentArray[0].button;
            currentButton.style.display = "none";

            for (const buttonDef of buttonContentArray) {
                const button = buttonDef.button;
                const content = buttonDef.content;
                button.onclick = async function () {
                    contentAnchor.innerHTML = "";
                    currentButton.style.display = "";
                    button.style.display = "none";
                    currentButton = button;
                    if (content) {
                        contentAnchor.append(await content());
                    } else {
                        contentAnchor.append(wodOriginalContent);
                    }
                    if(buttonDef.title) wodTitle.childNodes[0].nodeValue = buttonDef.title;
                }
                buttonBar.append(button);
            }

            return [wodOriginalContent, contentAnchor];
        }
    }

    static UI = class {

        static SIGNS = {
            WARN: "⚠️",
            ERROR: "💥", // ☠
            MISSING: "�",
            DELETE: "❌",
            SETTINGS: "⚙",
        }

        static COLORS = {
            GREEN: "rgb(62, 156, 62)",
            RED: "rgb(203, 47, 47)",
            YELLOW: "rgb(194, 194, 41)",
        }

        static WOD_SIGNS = {
            YES: "/wod/css/img/smiley/yes.png", // grüner Haken
            NO: "/wod/css/img/smiley/no.png", // rotes X
        }

        static createSpinner() {
            const spinner = document.createElement("i");
            spinner.className = "fa fa-spinner fa-spin";
            return spinner;
        }

        static addDeleteButtonForSelect(selectInput, deleteValue) {
            if (deleteValue === undefined) deleteValue = "";
            const container = selectInput.parentElement;
            const deleteButton = _.UI.createButton("<span style='font-size:0.8em'> ❌</span>", async function () {
                selectInput.value = deleteValue;
                selectInput.dispatchEvent(new Event("change"));
            })
            const anchor = document.createElement("span");
            anchor.style.display = "inline-block";
            anchor.style.position = "absolute";
            anchor.style.height = "100%";

            deleteButton.style.display = "none";
            container.addEventListener("mouseenter", function () {
                if (selectInput.options[selectInput.selectedIndex].text !== "") deleteButton.style.display = "";
            });
            container.addEventListener("mouseleave", function () {
                deleteButton.style.display = "none";
            });
            container.style.position = "relative";
            this.insertAfter(anchor, selectInput);
            anchor.append(deleteButton);
            deleteButton.style.position = "relative";
            deleteButton.style.left = "-17px";
            deleteButton.style.top = "4px";
            return deleteButton;
        }

        static createElem(type, innerHTML) {
            const result = document.createElement(type);
            result.innerHTML = innerHTML;
            return result;
        }

        static createButton(htmlContent, callback) {
            const button = document.createElement("span");
            button.classList.add("nowod");
            button.innerHTML = htmlContent;
            if (!button.style.fontSize) button.style.fontSize = "12px";
            button.style.cursor = "pointer";
            button.onclick = callback;
            return button;
        }

        static createCheckBox(supplier, consumer) {
            const result = document.createElement("input");
            result.type = "checkbox";
            result.checked = supplier();
            result.onchange = async function () {
                await consumer(result.checked);
            }
            return result;
        }

        static createRealButton(htmlContent, callback) {
            const button = document.createElement("input");
            button.type = "button";
            button.classList.add("nowod");
            button.value = htmlContent;
            if (!button.style.fontSize) button.style.fontSize = "12px";
            button.style.cursor = "pointer";
            button.onclick = callback;
            return button;
        }

        static createContentTable(contentArray, headerArray) {
            const table = this.createTable(contentArray, headerArray);
            table.classList.add("content_table");
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
                    if (!cur) continue;
                    if (cur.tagName) {
                        td.style.textAlign = "center";
                        td.innerHTML = "";
                        td.append(cur);
                    } else if (typeof cur === "object") {
                        for (const [key, value] of Object.entries(cur)) {
                            if (value === undefined) continue;
                            if (key === "data") {
                                if (value.tagName) td.append(value);
                                else td.innerHTML = value;
                            } else td[key] = cur[key];
                        }
                    } else {
                        td.style.textAlign = "center";
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
                    if (!cur) continue;
                    if (cur.tagName) {
                        td.innerHTML = "";
                        td.append(cur);
                    } else if (typeof cur === "object") {
                        for (const [key, value] of Object.entries(cur)) {
                            if (value === undefined) continue;
                            if (key === "data") {
                                if (value.tagName) td.append(value);
                                else td.innerHTML = value;
                            } else td[key] = cur[key];
                        }
                    } else td.innerHTML = cur;

                }
            }
            return table;
        }

        static swapElements(elem1, elem2) {
            var parent2 = elem2.parentNode;
            var next2 = elem2.nextSibling;
            if (next2 === elem1) { // special case for obj1 is the next sibling of obj2
                parent2.insertBefore(elem1, elem2);
            } else {
                elem1.parentNode.insertBefore(elem2, elem1);
                if (next2) parent2.insertBefore(elem1, next2);
                else parent2.appendChild(elem1);
            }
        }

        static insertAfter(newElement, child) {
            const parent = child.parentNode;
            const next = child.nextSibling;
            if (next) parent.insertBefore(newElement, next);
            else parent.appendChild(newElement);
        }

        static insertAtIndex(parent, child, idx) {
            const target = parent.children[idx];
            if (!target) parent.append(child);
            else parent.insertBefore(child, target);
        }
    }

    /**
     * Hilfemethoden für Down- und Uploads
     */
    static File = class {

        static async getJSZip() {
            await _.Libs.evalViaXMLRequest("https://raw.githubusercontent.com/demawi/WoD-Mods/refs/heads/master/libs/jszip.min.js")
            return new JSZip();
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

    static Dices = class Dices {

        /**
         * Ermittelt aus Avg,Min,Max Würfen die Basis und den Mittleren Wurf und erstellt damit die Wahrscheinlichkeit.
         */
        static winsOver2(avgAW, minAW, maxAW, avgPW, minPW, maxPW) {
            const [awBasis, aw] = this.getValues(avgAW, minAW, maxAW);
            const [pwBasis, pw] = this.getValues(avgPW, minPW, maxPW);
            return this.winsOver(aw, awBasis, pw, pwBasis);
        }

        static winsOver(aw, basisAW, pw, basisPW) {
            const [distr1, dices1] = this.distr(aw, basisAW);
            const [distr2, dices2] = this.distr(pw, basisPW);
            console.log(this.toString(dices1) + " > " + this.toString(dices2));
            return this.greaterThan(distr1, distr2);
        }

        /**
         * In einem Format, welches auch direkt für anydice.com verwendet werden kann.
         */
        static toString(dices) {
            let result = "";
            for (const curDices of dices) {
                if (result.length > 0) result += " + ";
                result += curDices[0] + "d" + curDices[1] + "-" + curDices[0];
            }
            return result;
        }

        /**
         * Versucht aus übergebenen Mittel-, Minimal- und Maximalwert den Offset und den Würfelmittelwert zu bestimmen.
         */
        static getValues(avgAW, minAW, maxAW) {
            avgAW = Math.round(avgAW);
            minAW = Math.round(minAW);
            maxAW = Math.round(maxAW);
            const val1 = avgAW - minAW;
            const val2 = maxAW - avgAW;
            const basis = avgAW - Math.max(val1, val2);
            return [basis, Math.round((avgAW - basis))];
        }

        /**
         * Holt sich für den Mittelwert die verwendeten WoD-Würfel und erstellt darüber kombinatorisch die genaue Verteilung für die jeweiligen erwürfelbaren Zahlen.
         * Da für WoD berechnet wird, werden hier standardmäßig XdY-X Würfel verwendet, also mit 0 als Minimum.
         * Die Distribution selbst ist dabei eine Object-Map von Zahl -> Anzahl der Kombinationen.
         * Als zweites Objekt im Rückgabe-Array werden die verwendeten Würfel zurückgegeben.
         */
        static distr(mittelwert, offset) {
            offset = offset || 0;
            const dices = this.getWoDDices(mittelwert);
            console.log("Avg: " + (offset + mittelwert) + " Min: " + offset + " Max: " + (offset + dices.map(dicesX => dicesX[0] * (dicesX[1] - 1)).reduce((a, b) => a + b, 0)) + " Wurf: " + mittelwert + " Dices: " + this.toString(dices));
            let result = {[offset]: 0};
            for (const curDices of dices) {
                for (let i = 0, l = curDices[0]; i < l; i++) { // W15 = 0-14, daher von 0 bis i<l
                    result = this.#addTo(result, curDices[1]);
                }
            }
            return [result, dices];
        }

        static #addTo(distr, dX) {
            const newResult = {};
            const addToResult = function (newValue, oldCount) {
                const myValue = newResult[newValue] || 0;
                newResult[newValue] = myValue + oldCount;
            }
            for (let i = 0; i < dX; i++) {
                for (const [oldValue, oldCount] of Object.entries(distr)) {
                    addToResult(Number(oldValue) + i, oldCount || 1);
                }
            }
            return newResult;
        }

        /**
         * Liefert die Würfel die für den entsprechenden Mittelwert verwendet werden.
         */
        static getWoDDices(mittelwert) {
            let countNo1 = 0;
            let wX = 0;
            let wRest = 0;

            const wXMittelwert = Math.floor(mittelwert / 6);
            if (wXMittelwert <= 7) {
                wX = 15;
                countNo1 = Math.floor(mittelwert / 7);
            } else {
                countNo1 = 6;
                wX = Math.floor(mittelwert / countNo1) * 2 + 1;
            }
            wRest = (mittelwert - countNo1 * Math.floor(wX / 2)) * 2;
            if (wRest > 0) wRest++;
            const dices = [];
            if (countNo1 > 0) dices.push([countNo1, wX]);
            if (wRest > 0) dices.push([1, wRest]);
            return dices;
        }

        /**
         * Liefert die Wahrscheinlichkeit, mit der 'distr1' einen höheren Wurf als 'distr2' landet.
         */
        static greaterThan(distr1, distr2) {
            let wins = 0;
            let loses = 0;
            for (const [key1, value1] of Object.entries(distr1)) {
                const key1Value = Number(key1);
                let curWins = 0;
                let curLoses = 0;
                for (const [key2, value2] of Object.entries(distr2)) {
                    const key2Value = Number(key2);
                    if (key1Value > key2Value) curWins += value2;
                    else curLoses += value2;
                }
                wins += value1 * curWins;
                loses += value1 * curLoses;
            }
            return wins / (wins + loses);
        }
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

    }

    static Mod = class {

        static start(zusatz) {
            if (!window.location.href.includes("silent=true")) {
                const mode = _.CSProxy.dbMode || "local";
                console.log(GM.info.script.name + " (" + GM.info.script.version + " repo:" + demawiRepository.version + (mode ? " dbMode:" + mode : "") + ")" + (zusatz ? " " + zusatz : ""));
            }
        }

        /**
         * Prüfen, ob eine lokale Datei eingebunden wird: dann wissen wir der Entwickler sitzt vor dem Rechner :)
         */
        static isLocalTest() {
            return GM.info.scriptMetaStr.includes("file://");
        }

    }

    /**
     * Allgemeine nicht WoD-spezifische Hilfsmethoden.
     */
    static util = class {

        static localeComparator = (a, b) => a.localeCompare(b);

        static async wait(msecs) {
            return new Promise((resolve, reject) => {
                setTimeout(resolve, msecs);
            });
        }

        static isAsyncFunction(fn) {
            return fn.constructor.name === "AsyncFunction"
        }

        // Sicher für concurrent modification
        static async forEachSafe(array, fn) {
            const newArray = Array();
            for (var i = 0, l = array.length; i < l; i++) {
                newArray.push(array[i]);
            }
            for (const cur of newArray) {
                if (this.isAsyncFunction(fn)) {
                    await fn(cur);
                } else {
                    fn(cur);
                }
            }
        }

        static async loadViaXMLRequest(url) {
            var xmlHttp = new XMLHttpRequest();
            xmlHttp.open("GET", url, false); // false for synchronous request
            xmlHttp.send(null);
            if (xmlHttp.status !== 200) return;
            return xmlHttp.responseText;
        }

        static async loadHTMLDocument(url) {
            const responseText = await this.loadViaXMLRequest(url);
            if (!responseText) return;
            return this.getDocumentFor(responseText);
        }

        static cloneObject(obj) {
            return JSON.parse(JSON.stringify(obj));
        }

        static getWindowPage(win) {
            win = win || window;
            var pathname = win.location.pathname.split("/");
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

        static arraysEqual(a, b) {
            if (a === b) return true;
            if (a == null || b == null) return false;
            if (a.length !== b.length) return false;

            // If you don't care about the order of the elements inside
            // the array, you should sort both arrays here.
            // Please note that calling sort on an array will modify that array.
            // you might want to clone your array first.

            for (let i = 0; i < a.length; ++i) {
                if (a[i] !== b[i]) return false;
            }
            return true;
        }

        static deepEqual(x, y) {
            const _this = this;
            return (x && y && typeof x === 'object' && typeof y === 'object') ?
                (Object.keys(x).length === Object.keys(y).length) &&
                Object.keys(x).reduce(function (isEqual, key) {
                    return isEqual && _this.deepEqual(x[key], y[key]);
                }, true) : (x === y);
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

        static html2Text(html) {
            const span = document.createElement("span");
            span.innerHTML = html;
            return span.textContent.trim();
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

        static fixedEncodeURIComponent(str) {
            return encodeURIComponent(str).replace(/[!'()*]/g, function (c) {
                return '%' + c.charCodeAt(0).toString(16);
            });
        }
    }

    // Liest den Kampfbericht ein und erstellt die Datenstruktur auf der Anfragen gestellt werden können.
    // Grobe Struktur: Report -> Level -> Kampf -> (Vor-)Runde -> Aktion -> Ziel -> Auswirkung
    static ReportParserDataVersion = 8;
    static ReportParser = function () {

        let warnings;
        const addWarning = function (msg, ...args) {
            warnings.push(_.util.error(msg, ...args));
            console.warn(msg, ...args);
        }
        let withSources = true;
        let _container;
        let missingSkillInfos = {};
        const requestSkillInfoFromUser = function (skillOrIdentifier, fertigkeit, actionTR) {
            const skillRequest = {
                line: actionTR.innerHTML,
                wuerfe: fertigkeit.wuerfe, // muss ggf. auch die Wurfhöhe vom User bestimmt werden oder kann dieses evtl. durch die Parade-Würfe eingegrenzt werden?
            };
            let path;
            if (typeof skillOrIdentifier === "string") {
                path = missingSkillInfos.noskills || (missingSkillInfos.noskills = {});
                path = path[skillOrIdentifier] || (path[skillOrIdentifier] = []);
            } else {
                path = missingSkillInfos.skills || (missingSkillInfos.skills = {});
                const skillName = skillOrIdentifier.textContent.trim();
                path = path[skillName] || (path[skillName] = []);
            }
            path.push(skillRequest);
        }

        class UnitId {
            name;

            constructor(name, index, isHero, isEreignis) {
                this.name = name;
                if (index) this.idx = index;
                if (isHero) this.isHero = 1;
                if (isEreignis) this.isEreignis = 1;
            }

            static findAny(elem, sichUnitId) {
                if (sichUnitId && sichUnitId.id) throw new Error("Hier wurde keine UnitId verwendet", sichUnitId);
                const unitHref = elem.querySelector("a[href*=\"/hero/\"]") || elem.querySelector("a[href*=\"/npc/\"]");
                if (!unitHref) {
                    for (const curNode of elem.childNodes) {
                        if (!curNode.tagName && curNode.textContent === "sich") return sichUnitId;
                    }
                }
                return ReportParser.getUnitIdFromElement(unitHref);
            }

        }

        class Round {
            helden;
            monster;
            actions; // aufgeteilt in vorrunde, regen, initiative, runde

            async load(nr, roundTR) {
                let statusTables = roundTR.getElementsByClassName("rep_status_table"); // üblicherweise sollten es immer 2 sein, nur am Ende des Kampfes dann 4
                if (statusTables.length !== 2 && statusTables.length !== 4) {
                    addWarning("Es wurden keine zwei StatusTable in einer Runde gefunden: " + statusTables.length)
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
                            (await ActionParser.parse(this, currentActionTR, actionTD, targetTD)).forEach(a => runde.push(a));
                        } else { // Runden-Aktion
                            (await ActionParser.parse(this, currentActionTR, actionTD, targetTD)).forEach(a => vorrunde.push(a));
                        }
                    }
                }
                this.actions = {
                    initiative: initiative,
                    vorrunde: vorrunde,
                    regen: regen,
                    runde: runde,
                };
                delete this.heldenSpawns;
                delete this.monsterSpawns;
            }

            spawnUnit(execUnit, newUnitId, node) {
                let spawnArray;
                if (execUnit.isHero) {
                    spawnArray = this.heldenSpawns = this.heldenSpawns || (this.heldenSpawns = []);
                } else {
                    spawnArray = this.monsterSpawns = this.monsterSpawns || (this.monsterSpawns = []);
                }
                const unit = this.unknownUnit(newUnitId);
                if (withSources) {
                    unit.srcRef = node.innerHTML;
                    unit.typeRef = node.outerHTML;
                }
                spawnArray.push(unit);
                return unit;
            }

            emptyRound() {
                return {
                    initiative: Array(),
                    vorrunde: Array(),
                    regen: Array(),
                    runde: Array(),
                };
            }

            unknownUnit(unitId) {
                return {
                    id: unitId,
                    stufe: "?",
                    pos: "Unbekannt",
                    hp: "?",
                    mp: "?",
                    zustand: "?",
                }
            }

            //Einen Lookup ausführen, damit die Unit auch immer alle möglichen Information (z.B. Position) trägt.
            unitLookup(unitId, returnNullIfUnknown) {
                if (unitId.isEreignis) return unitId;
                let lookupUnit = ReportParser.unitSearch(unitId, this.helden);
                if (!lookupUnit) lookupUnit = ReportParser.unitSearch(unitId, this.monster);
                if (!lookupUnit && this.heldenSpawns) lookupUnit = ReportParser.unitSearch(unitId, this.heldenSpawns);
                if (!lookupUnit && this.monsterSpawns) lookupUnit = ReportParser.unitSearch(unitId, this.monsterSpawns);
                if (!lookupUnit) {
                    if (returnNullIfUnknown) return null;
                    // gespawnt ohne vorher angekündigt worden zu sein
                    // addWarning("Unit konnte nicht in der aktuellen Runde gefunden werden!", unitId);
                    return this.unknownUnit(unitId);
                }
                return lookupUnit;
            }
        }

        class Target {
            // type;
            // skill;
            // wirkung; // z.B. bei direkter Heilung
            //result; // 0:Fehlschlag, 1:Erfolg, 2: Guter Erfolg, 3: Kritischer Erfolg
            // damage = []; // Achtung: hier wird auch der Overkill nicht abgezogen. Ist also evtl. mehr Schaden angezeigt als überhaupt HP beim Gegner noch vorhanden wären. Gilt das aber auch beim Heilen!?

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
                    this.typ = "Parade";
                    const pwMatch = strLine.match(/(\(|\/)(\d+)(\)|\/)/); // Eine Zahl wo vorher ( od. / kommt und nachher ) oder /
                    if (pwMatch) {
                        this.skill = {wurf: pwMatch[2]};
                    } else {
                        console.log("Keine Parade", strLine);
                    }
                } else {
                    var matching = strLine.match(/\+(\d*) HP/)
                    if (matching) { // Single Target Heal
                        this.typ = "Heilung";
                        this.wirkung = {
                            what: "HP",
                            value: matching[1],
                        }
                    }
                }
            }

            addDamage(damage) {
                if (!this.damage) this.damage = [];
                this.damage.push(damage);
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
                    const mouseoverText = damageLineElement.getAttribute("onmouseover");
                    if (mouseoverText) {
                        const dmgVorher = mouseoverText.match(/verursacht: <b>(\d*)<\/b>/)[1];
                        let dmgNachher = mouseoverText.match(/Anfälligkeit.* <b>(\d*)<\/b>/);
                        if (dmgNachher) {
                            dmgNachher = dmgNachher[1];
                        } else {
                            dmgNachher = mouseoverText.match(/Unempfindlichkeit.* <b>(\d*)<\/b>/)[1];
                            if (dmgNachher) dmgNachher = -Number(dmgNachher);
                        }
                        this.resistenz = Number(dmgVorher) - Number(dmgNachher) - this.ruestung;
                    }
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
                addWarning("DamageType kann nicht bestimmt werden: " + stringLine);
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
                    const temp = {
                        quelle: quelle,
                    };
                    const wirkungen = thisObject.#getWirkungenFromMouseOverString(nodeCollector);
                    if (wirkungen) temp.fx = wirkungen;
                    result.push(temp);
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
                var statusTRs = statusTable.children[0].children;
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
                        pos: tds[3].innerText.trim(),
                        hp: tds[4].innerText.trim(),
                        mp: tds[5].innerText.trim(),
                        zustand: tds[6].innerText.trim(),
                    }
                    if (withSources) {
                        unit.srcRef = srcRef;
                        unit.typeRef = typeRef;
                    }
                    if (unitLink) {
                        const wirkungen = Wirkung.getWirkungenFromElement(unitLink.parentElement, true)
                        if (wirkungen) unit.fx = wirkungen;
                    }
                    if (unit.pos !== "") {
                        result.push(unit);
                    }
                }
                return result;
            }
        }

        class Action {
            static HAT_ANGRIFFSTYP = {
                "Angriff": true,
                "Verschlechterung": true,
                "Verbesserung": false,
                "Parade": true,
                "Heilung": false,
                "Ruft Helfer": false,
            }

            unit;
            skill;
            targets;

            constructor(unit) {
                this.unit = unit;
            }

        }

        /**
         * Eine Aktion in der Runde
         */
        class ActionParser {

            /**
             * Gibt eine Liste von Actions zurück.
             */
            static async parse(curRound, actionTR, actionTD, targetTD) {
                const [fertigkeit, actionUnit] = await this.actionParse(curRound, actionTD, targetTD);
                const targets = this.parseTargets(curRound, actionUnit, targetTD, fertigkeit);

                // Action
                const myAction = new Action();
                myAction.unit = actionUnit;
                myAction.skill = fertigkeit;
                myAction.targets = targets;
                if (withSources) myAction.src = actionTR.outerHTML;
                return [myAction];
            }

            static parseTargets(curRound, actionUnit, targetTD, fertigkeit) {
                // Parse Targets
                var curTargetUnit;
                var currentTarget;
                var currentLine = [];
                var lineNr = 0;
                const targets = [];

                const istRuftHelfer = fertigkeit.typ === _.WoDSkillsDb.TYP.RUFT_HELFER;

                function addTarget() {
                    var line = _.util.arrayMap(currentLine, a => a.textContent).join("");
                    currentTarget = new Target(line);
                    currentTarget.unit = curTargetUnit;
                    targets.push(currentTarget);
                }

                for (const curElement of targetTD.childNodes) {
                    const unitId = ReportParser.getUnitIdFromElement(curElement, actionUnit.id);
                    if (unitId) {
                        lineNr = 1;
                        if (istRuftHelfer) {
                            curTargetUnit = curRound.spawnUnit(actionUnit, unitId, curElement);
                        } else {
                            curTargetUnit = curRound.unitLookup(unitId);
                        }
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
                            if (curElement.tagName && (curElement.tagName === "A" || curElement.querySelector("a"))) { // Schaden an einem Gegenstand
                                lineNr = -1; // solange ignorieren bis eine neue Entität kommt
                            } else {
                                const damage = new Damage(curElement);
                                currentTarget.addDamage(damage);
                            }
                        } else {
                            currentLine.push(curElement);
                        }
                    }
                }
                if (lineNr === 1) {
                    addTarget();
                }
                return targets;
            }

            /**
             * Holt aus dem 'actionTD' die Informationen heraus.
             * Unit: wer führt die Aktion aus
             */
            static async actionParse(curRound, actionTD, targetTD) {
                const fertigkeit = {
                    items: [],
                };

                // Unit bestimmen
                let actionUnit;
                const unitNode = actionTD.querySelector("a[href*=\"/hero/\"], a[href*=\"/npc/\"]");
                if (unitNode) {
                    actionUnit = curRound.unitLookup(ReportParser.getUnitIdFromElement(unitNode));
                } else {
                    actionUnit = {
                        name: "Ereignis",
                        id: {
                            name: "Ereignis",
                        },
                        isEreignis: 1,
                        pos: "Umgebung",
                    }
                    fertigkeit.unit = actionUnit;
                }

                // Verwendete Gegenstände bestimmen
                for (const curNode of actionTD.querySelectorAll("a[href*=\"/item/\"]")) {
                    const item = {
                        name: curNode.textContent.trim(),
                    };
                    const wirkungen = Wirkung.getWirkungenFromElement(curNode);
                    if (wirkungen) item.fx = wirkungen;
                    if (withSources) item.srcRef = curNode.outerHTML;
                    fertigkeit.items.push(item);
                }

                // HP/MP-Gain/Loss bestimmen
                for (const curNode of actionTD.querySelectorAll(".rep_gain, .rep_loss")) {
                    let mpGain = curNode.textContent.match(/(.*) MP/);
                    if (mpGain) {
                        fertigkeit.mpGain = Number(mpGain[1]);
                    } else {
                        let hpGain = curNode.textContent.match(/(.d*) HP/);
                        if (hpGain) {
                            fertigkeit.hpGain = Number(hpGain[1]);
                        } else {
                            addWarning("Rep_Gain/Rep_Loss kann nicht aufgelöst werden '" + curNode.textContent + "'", curNode);
                        }
                    }
                }

                // Manakosten bestimmen
                const manaCostNode = actionTD.querySelector(".rep_mana_cost");
                if (manaCostNode) fertigkeit.mp = manaCostNode.textContent.match(/(\d*) MP/)[1];

                // Würfe bestimmen
                const wuerfe = Array();
                this.bestimmeWuerfe(actionTD, wuerfe);
                fertigkeit.wuerfe = wuerfe;

                // Fertigkeit .name .typ .angriffsart bestimmen
                let requestedSkillInfoFromUser; // entweder skillLink-Element oder unknownSkillIdentifier-String
                const actionSkillA = actionTD.querySelector("a[href*=\"/skill/\"]");
                if (actionSkillA) {
                    fertigkeit.name = actionSkillA.textContent.trim();
                    const wirkungen = Wirkung.getWirkungenFromElement(actionSkillA);
                    if (wirkungen) fertigkeit.fx = wirkungen;
                    if (withSources) fertigkeit.typeRef = actionSkillA.outerHTML;
                    this.bestimmeFertigkeitFromText(fertigkeit, actionTD);
                    if (!fertigkeit.typ) {
                        const dbSkill = await _.WoDSkillsDb.getSkill(fertigkeit.name);
                        if (!dbSkill) {
                            const typ = this.getFertigkeitTypFromTarget(targetTD, actionUnit, curRound);
                            if (typ && !_.WoDSkillsDb.isAngriff(typ)) {
                                fertigkeit.typ = typ;
                            } else {
                                requestedSkillInfoFromUser = actionSkillA;
                            }
                        } else {
                            if (dbSkill.typ) fertigkeit.typ = dbSkill.typ;
                            if (dbSkill.angriffstyp) fertigkeit.angriffstyp = dbSkill.angriffstyp;
                        }
                    }
                }

                if (!requestedSkillInfoFromUser && this.actionSkillIstUnvollstaendig(fertigkeit)) {
                    const unknownIdentifier = await this.bestimmeFertigkeitFromTarget(curRound, fertigkeit, actionTD, actionUnit, targetTD);
                    if (fertigkeit.typ === _.WoDSkillsDb.TYP.VERSCHLECHTERUNG) fertigkeit.typ = _.WoDSkillsDb.TYP.ANGRIFF;
                    /**
                     * immer an den User weitergeben, damit auch bereits eingetragene Informationen nachträglich noch geändert werden können.
                     * Ausserhalb muss dann entschieden werden, was wirklich noch fehlt.
                     */
                    requestedSkillInfoFromUser = unknownIdentifier;
                }

                if (requestedSkillInfoFromUser) requestSkillInfoFromUser(requestedSkillInfoFromUser, fertigkeit, actionTD.parentElement);

                return [fertigkeit, actionUnit];
            }


            static actionSkillIstUnvollstaendig(skill) {
                return !skill.typ || (_.WoDSkillsDb.isAngriff(skill.typ) && !skill.angriffstyp);
            }

            static actionSkillIstUnvollstaendigWuerfe(skill) {
                return _.WoDSkillsDb.isAngriff(skill.typ) && !skill.wuerfe;
            }

            static isAngriff(targetTD) {
                const text = targetTD.textContent;
                return text.includes(": Erfolg") || text.includes(": guter Erfolg") || text.includes(": kritischer Erfolg") || text.includes(": Fehlschlag");
            }

            static isHeilung(targetTD) {
                const text = targetTD.textContent;
                return text.match(/\+ \d* HP/) || text.match(/\+ \d* MP/);
            }

            static getFertigkeitTypFromTarget(targetTD, actionUnit, curRound) {
                if (this.isAngriff(targetTD)) {
                    return _.WoDSkillsDb.TYP.ANGRIFF; // kann ANGRIFF oder VERSCHLECHTERUNG sein!!
                } else if (this.isHeilung(targetTD)) {
                    return _.WoDSkillsDb.TYP.HEILUNG;
                } else {
                    const targetUnitId = UnitId.findAny(targetTD, actionUnit && actionUnit.id);
                    if (targetUnitId) {
                        const unitLookup = curRound.unitLookup(targetUnitId, true);
                        if (!unitLookup) return _.WoDSkillsDb.TYP.RUFT_HELFER; // Units die vorher noch nicht bekannt waren spawnen
                        else return _.WoDSkillsDb.TYP.VERBESSERUNG; // Eine bereits bekannte Unit würde verbessert werden
                    }
                }
            }

            /**
             * Die Informationen konnten nicht über actionTD abgeleitet werden, wir versuchen es nun über das Target.
             * Für die Aktion legen wir eine Identifikation in der skillUnknown-DB, welche dann zur Not auch später vom Benutzer noch befüllt werden kann.
             */
            static async bestimmeFertigkeitFromTarget(curRound, fertigkeit, actionTD, actionUnit, targetTD) {
                const unknownIdentifier = this.getIdentifierOfTheUnknown(actionTD);
                const unknownSkillDb = _.WoDStorages.getSkillsUnknownDb();
                const unknownEntry = await unknownSkillDb.getValue(unknownIdentifier) || {id: unknownIdentifier};
                if (unknownEntry.typ) fertigkeit.typ = unknownEntry.typ;
                if (unknownEntry.angriffstyp) fertigkeit.angriffstyp = unknownEntry.angriffstyp;
                //console.log("UnknownEntry: ", unknownIdentifier, unknownEntry, fertigkeit, actionTD);
                unknownEntry.wurf = !!fertigkeit.wuerfe;

                // TODO: weiter definieren in welchem Dungeon und in welchem Level, gab es nen variablen Wurf oder ist der auch unbekannt?

                // Check 1: Erst suchen wir, ob ein Parade-Skill anwgewendet wurde.
                const targetSkillA = targetTD.querySelector("a[href*=\"/skill/\"]"); // Skill aus dem Target zur automatischen Ableitung
                if (targetSkillA) {
                    const paradeSkill = await _.WoDSkillsDb.getSkill(targetSkillA.textContent);
                    // Verschlechterung wird ebenfalls auf Angriff gemappt!!!
                    if (paradeSkill) {
                        const autoBestimmung = unknownEntry.auto || (unknownEntry.auto = {});
                        fertigkeit.typ = unknownEntry.typ = autoBestimmung.typ = _.WoDSkillsDb.TYP.ANGRIFF;
                        fertigkeit.angriffstyp = unknownEntry.angriffstyp = autoBestimmung.angriffstyp = paradeSkill.angriffstyp;
                    } else {
                        return targetSkillA; // um weitermachen zu können brauchen wir die Information über den Skill
                    }
                }
                if (!fertigkeit.typ) { // Kein Skill in der Action und auch nicht im Target.
                    /**
                     * evtl. können wir zumindest ableiten, ob es sich um einen Angriff oder einen Buff handelt.
                     */
                    const typ = this.getFertigkeitTypFromTarget(targetTD, actionUnit, curRound);
                    if (typ) {
                        const autoBestimmung = unknownEntry.auto || (unknownEntry.auto = {});
                        fertigkeit.typ = unknownEntry.typ = autoBestimmung.typ = typ;
                    }
                }
                if (!unknownEntry.where) unknownEntry.where = {};
                const reportData = _.WoD.getFullReportBaseData(_container);
                const founding = reportData.loc.name + "|" + _.WoD.getCurrentReportLevel(_container) + "|" + reportData.reportId;
                unknownEntry.where[founding] = 1;
                await unknownSkillDb.setValue(unknownEntry);
                return unknownIdentifier;
            }

            static bestimmeFertigkeitFromText(fertigkeit, actionTD) {
                for (const curNode of actionTD.childNodes) {
                    switch (curNode.tagName) {
                        case "":
                        case undefined:
                            const curText = curNode.textContent;
                            if (curText.includes("heilt mittels")) {
                                fertigkeit.typ = _.WoDSkillsDb.TYP.HEILUNG;
                            } else if (curText.includes("greift per Fernkampf an")) {
                                fertigkeit.typ = _.WoDSkillsDb.TYP.ANGRIFF;
                                fertigkeit.angriffstyp = _.WoDSkillsDb.ANGRIFFSTYP.FERNKAMPF;
                            } else if (curText.includes("greift im Nahkampf an")) {
                                fertigkeit.typ = _.WoDSkillsDb.TYP.ANGRIFF;
                                fertigkeit.angriffstyp = _.WoDSkillsDb.ANGRIFFSTYP.NAHKAMPF;
                            } else if (curText.includes("greift magisch an")) {
                                fertigkeit.typ = _.WoDSkillsDb.TYP.ANGRIFF;
                                fertigkeit.angriffstyp = _.WoDSkillsDb.ANGRIFFSTYP.ZAUBER;
                            } else if (curText.includes("greift sozial an")) {
                                fertigkeit.typ = _.WoDSkillsDb.TYP.ANGRIFF;
                                fertigkeit.angriffstyp = _.WoDSkillsDb.ANGRIFFSTYP.SOZIAL;
                            } else if (curText.includes("greift hinterhältig an")) {
                                fertigkeit.typ = _.WoDSkillsDb.TYP.ANGRIFF;
                                fertigkeit.angriffstyp = _.WoDSkillsDb.ANGRIFFSTYP.HINTERHALT;
                            } else if (curText.includes("wirkt als Naturgewalt auf")) {
                                fertigkeit.typ = _.WoDSkillsDb.TYP.ANGRIFF;
                                fertigkeit.angriffstyp = _.WoDSkillsDb.ANGRIFFSTYP.NATURGEWALT;
                            } else if (curText.includes("wird ausgelöst auf")) {
                                fertigkeit.typ = _.WoDSkillsDb.TYP.ANGRIFF;
                                fertigkeit.angriffstyp = _.WoDSkillsDb.ANGRIFFSTYP.FALLE_AUSLOESEN;
                            } else if (curText.includes("erwirkt eine Explosion gegen")) {
                                fertigkeit.typ = _.WoDSkillsDb.TYP.ANGRIFF;
                                fertigkeit.angriffstyp = _.WoDSkillsDb.ANGRIFFSTYP.EXPLOSION;
                            } else if (curText.includes("ruft herbei mittels")) {
                                fertigkeit.typ = _.WoDSkillsDb.TYP.RUFT_HELFER;
                            } else if (curText.includes(" verseucht ")) {
                                fertigkeit.typ = _.WoDSkillsDb.TYP.ANGRIFF;
                                fertigkeit.angriffstyp = _.WoDSkillsDb.ANGRIFFSTYP.KRANKHEIT;
                            } else if (false && curText.includes(" entschärft ")) {
                                fertigkeit.typ = _.WoDSkillsDb.TYP.ANGRIFF;
                                fertigkeit.angriffstyp = _.WoDSkillsDb.ANGRIFFSTYP.FALLE_ENTSCHAERFEN;
                            }
                            break;
                        default:
                            break;
                    }
                }
            }


            static getIdentifierOfTheUnknown(actionTD) {
                const definitionElem = actionTD.cloneNode(true);
                this.removeNonIdentifiableElements(definitionElem);
                return definitionElem.textContent.replace(/ ?\(.*\) ?/g, "").replaceAll("\n", "").trim(); // Alle Klammer+inhalte beseitigen.
            }

            static removeNonIdentifiableElements(definitionElem) {
                for (let i = 0; i < definitionElem.childNodes.length; i++) {
                    const cur = definitionElem.childNodes[i];
                    if (cur.tagName === "A" && (cur.href.includes("/npc/") || cur.href.includes("/hero/"))) {
                        //definitionElem.replaceChild(document.createTextNode("XY"), cur);
                    } else if (cur.tagName === "SPAN") {
                        if (cur.childElementCount <= 0) {
                            definitionElem.removeChild(cur);
                            i--;
                        } else {
                            this.removeNonIdentifiableElements(cur);
                        }
                    } else if (cur.tagName) {
                        definitionElem.removeChild(cur);
                        i--;
                    }
                }
            }

            static bestimmeWuerfe(actionTD, wuerfe) {
                for (const curNode of actionTD.childNodes) {
                    switch (curNode.tagName) {
                        case "":
                        case undefined: {
                            let text = curNode.textContent.trim();
                            if (text.length < 2) break;

                            const textArray = text.trim().split("/");
                            textArray.forEach(curText => {
                                    curText = curText.trim();
                                    let wurfMatcher = curText.match(/^(\D*)?(\d+)[.)]?(\D*)?$/);
                                    if (wurfMatcher) { // wurf
                                        let wo = wurfMatcher[1];
                                        if (wo && wo.endsWith(":")) {
                                            wo = wo.replace(":", "").trim();
                                        }
                                        const entry = {
                                            value: wurfMatcher[2]
                                        };
                                        if (wo) entry.dest = wo;
                                        wuerfe.push(entry);
                                    }
                                }
                            )
                            break;
                        }
                    }
                }


            }

        }

        class ReportParser {

            static reportDataVersion = demawiRepository.ReportParserDataVersion;

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

            static async parseKampfbericht(container, activateSources) {
                const startTime = new Date().getTime();
                warnings = [];
                withSources = activateSources;
                _container = container;
                missingSkillInfos = {};

                const roundContentTable = this.#getContentTable(container);
                const areas = Array();
                let curArea;
                const result = {};
                result.dv = _.ReportParserDataVersion;

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
                    const rcChildren = roundContentTable.children;
                    const tbody = rcChildren[rcChildren.length - 1];
                    for (const roundTR of tbody.children) {
                        if (roundTR.getElementsByClassName("rep_round_headline")[0].innerText === "Runde 1") {
                            closeArea(curArea);
                            curArea = {rounds: Array()};
                            areas.push(curArea);
                        }
                        const round = new Round();
                        await round.load(curArea.rounds.length + 1, roundTR);
                        curArea.rounds.push(round);
                    }
                    closeArea(curArea);
                }
                result.areas = areas;
                if (warnings.length > 0) result.warnings = warnings;
                console.log("Parsed Report in " + Math.round((new Date().getTime() - startTime) / 10) / 100 + " secs. With sources: " + withSources, result);

                if (Object.keys(missingSkillInfos).length > 0) result.missingSkillInfos = missingSkillInfos;
                return [result, warnings];
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
                if (unitId.id) throw new Error("Hier wurde keine UnitId genutzt!", unitId);
                if (!unitArray) return;
                for (const curUnit of unitArray) {
                    if (curUnit.id.name === unitId.name && curUnit.id.idx === unitId.idx) {
                        return curUnit;
                    } else {
                        if (this.unitNameOhneGestalt(curUnit.id.name) === this.unitNameOhneGestalt(unitId.name) && curUnit.id.idx === unitId.idx) { // evtl. Gestaltwechsel!? z.B. "Dunkles Erwachen"
                            return curUnit;
                        }
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
                    return new UnitId("Ereignis", undefined, false, true);
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

    static ItemParserDataVersion = 5;
    static ItemParser = class {

        /**
         *
         * @returns {(string|number)[]}
         */
        static getItemNameFromElement(aElement) {
            const curHref = aElement.href;
            var itemName;
            var index = curHref.indexOf("item.php?");
            let type;
            if (index > 0) { // Ingame Referenz
                itemName = curHref.match(/name=(.*?)&/);
                type = 1;
            } else { // Forum-Referenz
                index = curHref.indexOf("/item/");
                if (index > 0) {
                    itemName = curHref.match(/item\/(.*?)&/);
                    type = 2;
                }
            }
            if (!itemName) return [];
            itemName = decodeURIComponent(itemName[1].replaceAll("+", " "));
            if (!_.WoDItemDb.isValidItemName(itemName)) {
                console.warn("Nicht korrekten ItemNamen entdeckt: '" + itemName + "'");
                return [];
            }
            return [itemName, type];
        }

        static getItemIndexDB() {
            return _.WoDStorages.getItemIndexDb();
        }

        static getItemSourceDB() {
            return _.WoDStorages.getItemSourcesDb();
        }

        static getItemDB() {
            return _.WoDStorages.getItemDb();
        }

        static async reportNonExistingItem(itemName) {
            let itemIndex = await this.getItemIndexDB().getValue(itemName.toLowerCase());
            if (!itemIndex) {
                itemIndex = _.WoDItemDb.createItem(itemName, document, true);
                if (!itemIndex) { // no valid name
                    await this.getItemSourceDB().deleteValue(itemName.toLowerCase());
                    return;
                }
            }
            const now = new Date().getTime();
            itemIndex.ts = now;
            const myWorld = _.WoD.getMyWorld();
            if (myWorld) {
                const worldInfos = itemIndex.world[myWorld] || (itemIndex.world[myWorld] = {});
                worldInfos.ts = now;
                worldInfos.valid = 0;
            }
            let foundValid = false;
            for (const curWorldInfo of Object.values(itemIndex.world)) {
                if (curWorldInfo.valid) {
                    foundValid = true;
                    break;
                }
            }
            await this.getItemIndexDB().setValue(itemIndex);
        }

        static async onItemPage(doc) {
            if (doc) return await this.#onItemPage(doc);
            const _this = this;
            return _.WindowManager.onlyOnce("onItemPage", async function () {
                return await _this.#onItemPage();
            });
        }

        static async #onItemPage(doc) {
            doc = doc || document;
            let link = doc.getElementById("link");
            if (!link) {
                if (doc.documentElement.textContent.includes("Der Gegenstand existiert nicht")) {
                    const itemName = doc.querySelector("form input[name='name']").value;
                    console.log("Gegenstand existiert nicht '" + itemName + "'");
                    await this.reportNonExistingItem(itemName.trim());
                }
                return;
            }
            const all = doc.getElementsByTagName("h1")[0];
            const itemName = all.getElementsByTagName("a")[0].childNodes[0].textContent.trim();
            if (this.hasSetOrGemBonus(link)) {
                console.log("Set oder gem-boni entdeckt! Item wird nicht für die Datenbank verwendet!");
                return itemName;
            }

            const itemSourcesDB = this.getItemSourceDB();
            const itemDB = this.getItemDB();
            const itemIndexDB = this.getItemIndexDB();

            const itemIndex = await itemIndexDB.getValue(itemName.toLowerCase()) || _.WoDItemDb.createItem(itemName, doc);
            const myWorld = _.WoD.getMyWorld(doc);
            const now = new Date().getTime();
            itemIndex.ts = now;
            itemIndex.data = 1;
            itemIndex.world[myWorld] = {
                valid: 1,
                ts: now,
            }

            const itemSource = await itemSourcesDB.getValue(itemName.toLowerCase()) || {
                id: itemIndex.id,
            };
            itemSource.world = myWorld;
            itemSource.ts = now;
            delete itemSource.details; // nur für alte Versionen
            delete itemSource.link; // nur für alte Versionen
            delete itemSource.nodata; // nur für alte Versionen
            itemSource.src = _.WoDParser.getPlainMainContent(doc).querySelector(".main_content").innerHTML;
            await itemSourcesDB.setValue(itemSource);
            await itemIndexDB.setValue(itemIndex);

            // Daten-Übernahme
            const item = await this.parseSourceItem(itemSource, itemName);
            await itemDB.setValue(item);
            console.log("[" + _.getModName() + "]: Gegenstand der ItemDB hinzugefügt: ", itemSource, item);

            // Maintenance: Auf alte dataversions prüfen
            const needRewrite = await _.WoDStorages.getItemDb().getAllKeys({
                index: ["dv"],
                keyMatchBefore: [_.ItemParserDataVersion],
                keyMatchBeforeOpen: true,
            });
            if (needRewrite.length > 0) {
                const migration = _.Migration.start("Items werden neu geschrieben", needRewrite.length);
                console.log("Migrate to itemdataversion " + _.ItemParserDataVersion + " for " + needRewrite.length + " entries...");
                for (const curItemId of needRewrite) {
                    const sourceItem = await itemSourcesDB.getValue(curItemId);
                    if (sourceItem) {
                        //const curItem = await this.getItemDB().getValue(curItemId);
                        const item = await this.parseSourceItem(sourceItem);
                        await itemDB.setValue(item);
                    }
                }
                migration.end();
                console.log("Migrate to itemdataversion " + _.ItemParserDataVersion + " for " + needRewrite.length + " entries... Finished!");
            }
            return itemName;
        }

        static hasSetOrGemBonus(linkElement) {
            return linkElement.getElementsByClassName("gem_bonus_also_by_gem").length > 0 || linkElement.getElementsByClassName("gem_bonus_only_by_gem").length > 0;
        }

        static async parseSourceItem(itemSource, itemName) {
            const item = await this.getItemDB().getValue(itemSource.id) || _.WoDItemDb.createItem(itemName);
            item.ts = itemSource.ts;
            item.world = itemSource.world;
            await this.#writeItemData(item, itemSource);
            return item;
        }

        // nimmt die Rohdaten (.details/.link) aus dem Objekt und schreibt die abgeleiteten Daten
        static async #writeItemData(item, itemSource) {
            const itemHTMLElement = document.createElement("div");
            itemHTMLElement.innerHTML = itemSource.src;

            const einschraenkungAnwendungen = this.#findRestriction(itemSource.src, /Die Anwendungen dieses Gegenstandes beziehen sich nur auf die Anwendung des Gegenstandes als (.*)\./);
            const einschraenkungWirkungen = this.#findRestriction(itemSource.src, /Die Boni auf den Betroffenen wirken nur bei Anwendung dieses Gegenstandes als (.*)\./) || this.#findRestriction(itemSource.src, /Die Auswirkungen auf den Betroffenen des Gegenstandes beziehen sich ausschließlich auf die Nutzung als (.*)\./);
            const resetPoint = itemSource.src.includes("Vorsicht: Resetpunkt benötigt, um diesen Gegenstand abzulegen!");
            if (resetPoint) item.needReset = 1;

            try {
                this.writeItemData(item, itemHTMLElement);
                this.writeItemDataEffects(item, itemHTMLElement);
                item.dv = _.ItemParserDataVersion;

                if (einschraenkungAnwendungen) { // Gegenstandsklasse
                    console.log("Einschränkung Anwendungen:", einschraenkungAnwendungen);
                    item.data.anw.onlyFor = einschraenkungAnwendungen;
                }
                if (einschraenkungWirkungen) { // Gegenstandsklasse
                    console.log("Einschränkung Wirkung:", einschraenkungWirkungen);
                    item.effects.target.onlyFor = einschraenkungWirkungen;
                }

            } catch (error) {
                console.log(error);
                //alert(error);
                throw error;
            }
        }

        static #findRestriction(src, matching) {
            let result = src.match(matching);
            if (!result) return;
            const elem = document.createElement("div");
            elem.innerHTML = result[1];
            return elem.textContent.trim();
        }

        static writeItemData(item, itemHTMLElement) {
            const div = itemHTMLElement.querySelector("#details");
            const data = {};
            item.data = data;
            const tableTRs = div.querySelectorAll('tr');
            for (const tr of tableTRs) {
                const kategorie = _.util.html2Text(tr.children[0].innerHTML.split("<br>")[0]);
                switch (kategorie) {
                    case "Besonderheiten":
                        var besonderheiten = tr.children[1].textContent.trim();
                        if (besonderheiten === "Veredelungen") {
                            data.veredelung = true;
                        } else {
                            var matches = besonderheiten.match(/(.\d*)x veredelbar/);
                            if (!matches) {
                                console.error("Unbekannte Besonderheit entdeckt", item.name, besonderheiten);
                                alert("Unbekannte Besonderheit entdeckt");
                            }
                            data.slots = matches[1];
                        }
                        break;
                    case "Heldenklassen":
                        var heldenklassen = tr.children[1].textContent.trim();
                        var typ;
                        var def;
                        if (heldenklassen.startsWith("ausschließlich für")) {
                            typ = "nur";
                            def = Array();
                            for (const klasse of tr.children[1].getElementsByTagName("span")) {
                                def.push(klasse.textContent.trim());
                            }
                        } else if (heldenklassen.startsWith("nicht für")) {
                            typ = "nicht";
                            def = Array();
                            for (const klasse of tr.children[1].getElementsByTagName("span")) {
                                def.push(klasse.textContent.trim());
                            }
                        } else if (heldenklassen.startsWith("für alle")) {
                            typ = "alle";
                        }
                        data.klasse = {
                            typ: typ,
                            def: def,
                        }
                        break;
                    case "Voraussetzungen":
                        let bedingungen = {};
                        let freieBedingungen = Array();
                        for (const elem of tr.children[1].childNodes) {
                            if (elem.tagName === "BR") continue;
                            let line = elem.textContent.trim();
                            if (line === "") continue;
                            const matches = line.trim().match(/^(.*) (ab|bis) (\d*)$/);
                            if (matches) {
                                bedingungen[matches[1]] = {
                                    comp: matches[2],
                                    value: matches[3],
                                };
                            } else {
                                freieBedingungen.push(line);
                            }
                        }
                        data.bedingungen = bedingungen;
                        data.bedingungen2 = freieBedingungen;
                        break;
                    case "Gegenstandsklasse": {
                        const gegenstandsklassen = Array();
                        for (const a of tr.children[1].getElementsByTagName("a")) {
                            gegenstandsklassen.push(a.textContent.trim());
                        }
                        data.gegenstandsklassen = gegenstandsklassen;
                        break;
                    }
                    case "Wirkung": {
                        const value = tr.children[1].textContent.trim();
                        if (value !== "-") {
                            const matches = value.match(/(Stufe \d*,\d*)?[\n]?(.*)/);
                            let stufe = matches[1];
                            if (stufe) stufe = stufe.match(/Stufe (\d*).*/)[1];
                            let type = matches[2];
                            if (type) type = type.trim();
                            if (type === "") type = null;
                            data.wirkung = {
                                type: type,
                                value: stufe,
                            }
                        }
                        break;
                    }
                    case "Anwendungen insgesamt": {
                        const value = tr.children[1].textContent.trim();
                        if (value !== "unbegrenzt") {
                            data.isVG = true;
                            data.anw = data.anw || {};
                            data.anw.dungeon = Number(value);
                        }
                        break;
                    }
                    case "Anwendungen pro Dungeon": {
                        const value = tr.children[1].textContent.trim();
                        if (value !== "unbegrenzt") {
                            data.anw = data.anw || {};
                            data.anw.dungeon = Number(value);
                        }
                        break;
                    }
                    case "Anwendungen pro Kampf": {
                        const value = tr.children[1].textContent.trim();
                        if (value !== "unbegrenzt") {
                            data.anw = data.anw || {};
                            data.anw.kampf = Number(value);
                        }
                        break;
                    }
                    case "Fertigkeiten": {
                        const fertigkeiten = Array();
                        for (const a of tr.children[1].getElementsByTagName("a")) {
                            fertigkeiten.push(a.textContent.trim());
                        }
                        data.fertigkeiten = fertigkeiten;
                        break;
                    }
                    case "Wo getragen?":
                        data.trageort = tr.children[1].textContent.trim();
                        break;
                }
            }
        }

        static writeItemDataEffects(item, itemHTMLElement) {
            const div = itemHTMLElement.querySelector("#link");
            if (this.hasSetOrGemBonus(div)) {
                item.irregular = true;
            } else {
                delete item.irregular;
            }
            item.effects = {};
            var currentOwnerContext;
            var currentBoniContext;
            var tableType;
            var ownerType;

            function getBoniContext(ctxName) {
                var result = currentOwnerContext[ctxName];
                if (!result) {
                    result = [];
                    currentOwnerContext[ctxName] = result;
                }
                return result;
            }

            for (var i = 0, l = div.children.length; i < l; i++) {
                const cur = div.children[i];
                if (cur.tagName === "H2") {
                    ownerType = this.getOwnerType(cur.textContent.trim());
                    currentOwnerContext = item.effects[ownerType];
                    if (!currentOwnerContext) {
                        currentOwnerContext = {};
                        item.effects[ownerType] = currentOwnerContext;
                    }
                } else if (cur.tagName === "H3") {
                    tableType = this.getType(cur.textContent.trim());
                    currentBoniContext = getBoniContext(tableType);
                } else if (cur.className === "content_table") {
                    const tableTRs = cur.querySelectorAll('tr.row0, tr.row1');
                    switch (tableType) {
                        case "schaden":
                        case "ruestung":
                        case "anfaelligkeit": // 3-Spalten Standard
                            this.addBoni(currentBoniContext, tableTRs, curTR => {
                                const boni = {
                                    damageType: curTR.children[0].textContent.trim(),
                                    attackType: curTR.children[1].textContent.trim(),
                                    bonus: curTR.children[2].textContent.trim(),
                                }
                                if (curTR.children.length > 3) boni.dauer = curTR.children[3].textContent.trim();
                                if (curTR.children.length > 4) boni.bemerkung = curTR.children[4].textContent.trim();
                                return boni;
                            });
                            break;
                        case "eigenschaft":
                        case "angriff":
                        case "parade":
                        case "wirkung":
                        case "beute": // 2-Spalten-Standard
                            this.addBoni(currentBoniContext, tableTRs, curTR => {
                                const boni = {
                                    type: curTR.children[0].textContent.trim(),
                                    bonus: curTR.children[1].textContent.trim(),
                                }
                                if (curTR.children.length > 2) boni.dauer = curTR.children[2].textContent.trim();
                                if (curTR.children.length > 3) boni.bemerkung = curTR.children[3].textContent.trim();
                                return boni;
                            });
                            break;
                        case "fertigkeit":
                            for (const curTR of tableTRs) {
                                var type = curTR.children[0].textContent.trim();
                                var targetContext;
                                if (type.startsWith("alle Fertigkeiten der Klasse")) {
                                    targetContext = getBoniContext("talentklasse");
                                    type = type.substring(29);
                                } else {
                                    targetContext = currentBoniContext;
                                }
                                const skill = {
                                    type: type,
                                    bonus: curTR.children[1].textContent.trim(),
                                }
                                if (curTR.children.length > 2) skill.dauer = curTR.children[2].textContent.trim();
                                if (curTR.children.length > 3) skill.bemerkung = curTR.children[3].textContent.trim();
                                targetContext.push(skill);
                            }
                            break;
                        default:
                            console.error("Unbekannter Boni-TableType: '" + tableType + "'");
                            alert("Unbekannter Boni-TableType: '" + tableType + "'");
                    }

                }
            }
        }

        static addBoni(currentBoniContext, tableTRs, fn) {
            tableTRs.forEach(b => {
                currentBoniContext.push(fn(b));
            });
        }

        static getType(text) {
            switch (text) {
                case 'Boni auf Eigenschaften':
                    return "eigenschaft";
                case 'Boni auf Paraden':
                    return "parade";
                case 'Boni auf Schaden':
                    return "schaden";
                case 'Boni auf Rüstung':
                    return "ruestung";
                case 'Boni auf den Rang von Fertigkeiten':
                    return "fertigkeit";
                case 'Boni auf Angriffe':
                    return "angriff";
                case 'Boni auf die Wirkung von Fertigkeiten':
                    return "wirkung";
                case 'Boni auf die Anfälligkeit gegen Schäden':
                    return "anfaelligkeit";
                case 'Boni auf Beute aus Dungeonkämpfen':
                    return "beute";
                default:
                    console.error("Unbekannte H3-Item Überschrift: '" + text + "'");
                    alert("Unbekannte H3-Item Überschrift: '" + text + "'");
            }
        }

        static getOwnerType(text) {
            switch (text) {
                case 'Auswirkungen auf den Betroffenen des Gegenstands':
                    return 'target';
                case 'Auswirkungen auf den Besitzer des Gegenstands':
                    return 'owner';
                case 'Auswirkungen auf den Betroffenen der Fertigkeit':
                    return 'target';
                case 'Auswirkungen auf den Besitzer der Fertigkeit':
                    return 'owner';
                case 'Vor- und Nachteile':
                    return 'owner';
                case 'Auswirkungen auf den Betroffenen des Sets':
                    return "target";
                default:
                    if (text.includes('Diese Boni wirken zurzeit auf ')) {
                        return 'owner';
                    }
                    console.error("Unbekannte H2-Item Überschrift: '" + text + "'");
                    alert("Unbekannte H2-Item Überschrift: '" + text + "'");
            }
        }

    }

    static import(type) {
        return this[type];
    }

    static startMod(zusatz) {
        _.Mod.start(zusatz);
    }

    static getModName() {
        return GM.info.script.name;
    }

}

class OptionImpl {

    static EMPTY_OPTION = new OptionImpl();

    static create(elem) {
        if (!this.isDefined(elem)) return this.EMPTY_OPTION;
        return new OptionImpl(elem);
    }

    static isDefined(value) {
        return value !== undefined && value !== null;
    }

    static isIterable(value) {
        return value.length !== undefined && typeof value !== "string";
    }

    constructor(value) {
        this.value = value;
    }

    get() {
        return this.value;
    }

    foreach(fn) {
        if (!OptionImpl.isDefined(this.value)) return OptionImpl.EMPTY_OPTION;
        if (OptionImpl.isIterable(this.value)) {
            for (const cur of this.value) fn(cur);
        } else {
            fn(this.value);
        }
    }

    map(fn) {
        if (!OptionImpl.isDefined(this.value)) return OptionImpl.EMPTY_OPTION;
        if (OptionImpl.isIterable(this.value)) {
            const result = [];
            for (const cur of this.value) {
                result.push(fn(cur));
            }
            return OptionImpl.create(result);
        }
        return OptionImpl.create(fn(this.value));
    }

    flatMap(fn) {
        if (!OptionImpl.isDefined(this.value)) return OptionImpl.EMPTY_OPTION;
        if (OptionImpl.isIterable(this.value)) {
            const result = [];
            for (const cur of this.value) {
                result.push(fn(cur).elem);
            }
            return OptionImpl.create(result);
        }
        return fn(this.value);
    }
}

// Für alle freigegeben auch im unsafeWindow
Opt = function (value) {
    return OptionImpl.create(value);
}

// nur zur internen Nutzung
const _ = demawiRepository;
unsafeWindow.demawiRepository = (function () {
    return demawiRepository;
})();