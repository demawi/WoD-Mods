// ==UserScript==
// @name           [WoD] Kampfbericht Archiv
// @namespace      demawi
// @description    Lässt einen die Seiten der Kampfberichte direkt downloaden
// @version        0.1
// @grant          GM.getValue
// @grant          GM.setValue
// @grant          GM.deleteValue
// @include        http*://*.world-of-dungeons.de/wod/spiel/*dungeon/report.php*
// @include        http*://*/wod/spiel/*dungeon/report.php*
// @include        http*://*.world-of-dungeons.de/*combat_report.php*
// @include        http*://*/wod/spiel/*dungeon/combat_report.php*
// ==/UserScript==
// *************************************************************
// *** WoD-Erweiterte Kammpfstatistik                        ***
// *** Dieses Script ist Freeware                            ***
// *** Wer es verbessern will, moege dies tun, aber bitte    ***
// *** nicht meinen Namen entfernen.                         ***
// *** Danke! demawi                                         ***
// *************************************************************

(function () {
    'use strict';

    class Mod {
        static async startMod() {
            await MyStorage.getReports();
            const title = document.getElementsByTagName("h1")[0];
            if (title.textContent.trim() !== "Kampfberichte") {
                const button = document.createElement("span");
                button.classList.add("nowod");
                button.innerHTML = " 💾";
                button.style.fontSize = "12px";
                button.style.cursor = "pointer";
                button.onclick = function () {
                    unsafeWindow.alksfhsdf();
                    util.htmlExport();
                }
                title.appendChild(button);
            }
        }
    }

    class Storages {
        // Speichert alle Daten ein einer Map und sich selbst auf die enstsprechende StorageId auf den root.
        static Standard = class {
            storageId;
            storageType;
            allData;

            static async checkInstalledType(db) {
                const installedType = await db.getInstalledStorageType();
                console.log("StorageType: " + installedType + " Wanted type: " + db.storageType);
                if (installedType) {
                    if (db.getStorageType() !== installedType && !(await db.#handleTypeChange())) {
                        throw new Error("Falscher Datenbank-Typ! Installiert wurde '" + installedType + "' genutzt werden möchte '" + db.storageType + "'");
                    }
                } else { // missing InstalledStorageType
                    await GM.setValue("_" + db.storageId + "Type", db.storageType);
                }
            }

            static async create(storageId, type) {
                const db = new Storages.Standard(true, storageId, type);
                await this.checkInstalledType(db);
                return db;
            }

            /**
             * @protected
             */
            constructor(token, storageId, type) {
                if (token !== true) throw new Error("Klasse darf nur über eine statische Create-Methode aufgerufen werden");
                this.storageId = storageId;
                this.storageType = type || "Standard";
            }

            getStorageType() {
                return this.storageType;
            }

            async getInstalledStorageType() {
                return await GM.getValue("_" + this.storageId + "Type");
            }

            // Prüft ob der Datenbank-Typ migriert werden kann. Führt dieses durch und liefert true oder false;
            async #handleTypeChange() {
                return false;
            }

            async ensureDBisLoaded() {
                if (!this.allData) {
                    this.allData = await GM.getValue(this.storageId);
                    if (!this.allData) { // initial
                        this.allData = {};
                        await GM.setValue("_" + this.storageId + "Type", this.storageType);
                        await GM.setValue(this.storageId, this.allData);
                    }
                    this[this.storageId] = this.allData;
                }
            }

            async setValue(id, data) {
                this.ensureDBisLoaded();
                if (data) {
                    this.allData[id] = data;
                    await GM.setValue(this.storageId, this.allData);
                } else if (this.allData[id]) { // delete
                    delete this.allData[id];
                    await GM.setValue(this.storageId, this.allData);
                }
            }

            async getValue(id, defaultValue) {
                this.ensureDBisLoaded();
                return this.allData[id] || defaultValue;
            }

            async get() {
                this.ensureDBisLoaded();
                return this.data;
            }
        }

        // Die eigentlichen Daten werden direkt auf den Root geschrieben und nur MetaDaten ins Archiv.
        static Indexed = class extends Storages.Standard {
            rootContextPrefix;
            metaInfoFn;

            static async create(storageId, rootContextPrefix, metaInfoFn) {
                const db = new Storages.Indexed(true, storageId, rootContextPrefix, metaInfoFn);
                await this.checkInstalledType(db);
                return db;
            }

            /**
             * @protected
             */
            constructor(token, storageId, rootContextPrefix, metaInfoFn) {
                super(token, storageId, "Indexed");
                this.rootContextPrefix = rootContextPrefix;
                this.metaInfoFn = metaInfoFn || (() => {
                });
            }

            async setValue(id, data) {
                if (data) {
                    const metaInfo = this.metaInfoFn(data);
                    metaInfo.time = new Date().getTime();
                    super.setValue(id, metaInfo);
                    await GM.setValue(this.rootContextPrefix + "_" + id, data);
                } else {
                    super.setValue(id);
                    await GM.deleteValue(this.rootContextPrefix + "_" + id);
                }
            }

            async getValue(id, defaultValue) {
                return await GM.getValue(this.rootContextPrefix + "_" + id);
            }

        }

        // Speichert einzig direkt auf den Root mit einem entsprechenden Prefix
        static Direct = class {
            rootContextPrefix;

            constructor(storageId, rootContextPrefix) {
                this.rootContextPrefix = rootContextPrefix;
            }

            async setValue(id, data) {
                await GM.setValue(this.rootContextPrefix + "_" + id, data);
            }

            async getValue(id, defaultValue) {
                return await GM.getValue(this.rootContextPrefix + "_" + id);
            }

        }


    }

    class MyStorage {
        static reports;

        static async getReports() {
            if (!this.reports) this.reports = await Storages.Standard.create("reports");
            return this.reports;
        }
    }



    class util {

        static forEach(array, fn) {
            for (var i = 0, l = array.length; i < l; i++) {
                fn(array[i]);
            }
        }

        // Sicher für concurrent modification
        static forEachSafe(array, fn) {
            const newArray = Array();
            for (var i = 0, l = array.length; i < l; i++) {
                newArray.push(array[i]);
            }
            newArray.forEach(a => fn(a));
        }

        static hatClassName(node, className) {
            return node.classList && node.classList.contains(className);
        }

        static getPlainMainContent() {
            const myDocument = document.cloneNode(true);

            const remove = node => node.parentElement.removeChild(node);
            remove(myDocument.getElementById("gadgettable-left-td"));
            remove(myDocument.getElementById("gadgettable-right-td"));
            const mainContent = myDocument.getElementsByClassName("gadget main_content lang-de")[0];
            util.forEachSafe(mainContent.parentElement.children, cur => {
                if (cur !== mainContent) remove(cur);
            });

            const removeNoWodNodes = node => {
                util.forEachSafe(node.children, cur => {
                    if (cur.classList.contains("nowod")) {
                        remove(cur);
                    } else removeNoWodNodes(cur);
                });
            }
            removeNoWodNodes(myDocument.documentElement);

            const tooltip = myDocument.getElementsByClassName("tooltip")[0];
            if (tooltip) remove(tooltip);

            return myDocument;
        }

        static htmlExport() {
            const myDocument = this.getPlainMainContent();

            util.forEach(myDocument.getElementsByTagName("a"), a => {
                if (a.href.startsWith("http") && !a.href.includes("#")) {
                    a.href = new URL(a.href).href;
                }
            });

            util.forEach(myDocument.getElementsByTagName("img"), a => {
                a.src = new URL(a.src).href;
            });

            util.forEach(myDocument.getElementsByTagName("script"), a => {
                if (a.src) a.src = new URL(a.src).href;
            });

            util.forEach(myDocument.getElementsByTagName("link"), a => {
                if (a.href) a.href = new URL(a.href).href;
            });

            function buttonReplaceWithElement(element, text, href) {
                if (element) {
                    const newButton = document.createElement("a");
                    newButton.classList = element.classList;
                    newButton.value = element.value;
                    newButton.innerText = text;
                    newButton.href = href;
                    element.parentElement.replaceChild(newButton, element);
                }
            }

            function buttonReplace(buttonName, text, href) {
                util.forEachSafe(myDocument.getElementsByName(buttonName), a => buttonReplaceWithElement(a, text, href));
            }

            var mainNavigationButton = myDocument.getElementsByName("stats[0]")[0];
            if (!mainNavigationButton) {
                mainNavigationButton = myDocument.getElementsByName("items[0]")[0];
            }
            util.forEach(myDocument.getElementsByName(mainNavigationButton.name), a => {
                buttonReplaceWithElement(a.parentElement.children[0], "Übersicht", "../");
            });
            buttonReplace("stats[0]", "Statistik", "Statistik.html");
            buttonReplace("items[0]", "Gegenstände", "Gegenstaende.html");
            buttonReplace("details[0]", "Bericht", "Level1.html");
            for (var i = 1; i <= 12; i++) {
                buttonReplace("level[" + i + "]", "Level " + i, "Level" + i + ".html");
            }

            var fileName;

            var curElement = myDocument.getElementsByName("current_level")[0];
            if (curElement) {
                fileName = "Level" + curElement.value;
            } else {
                curElement = myDocument.getElementsByName("disabled")[0];
                fileName = curElement.value.replace("ä", "ae");
            }

            this.forDownload(fileName + ".html", myDocument.documentElement.outerHTML);
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

    }

    Mod.startMod();

})();