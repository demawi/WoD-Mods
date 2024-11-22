// ==UserScript==
// @name           [WoD] Kampfbericht Archiv
// @namespace      demawi
// @description    Lässt einen die Seiten der Kampfberichte direkt downloaden
// @version        0.1
// @include        http*://*.world-of-dungeons.de/wod/spiel/*dungeon/report.php*
// @include        http*://*/wod/spiel/*dungeon/report.php*
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
        static dbname = "wodKampfberichtArchiv"

        static async startMod() {
            const title = document.getElementsByTagName("h1")[0];
            if (title.textContent.trim() === "Kampfberichte") {
                const reportDB = await MyStorage.getReportDB();
                const tbody = document.getElementsByClassName("content_table")[0].children[0];
                console.log("tbody", tbody.children.length);
                for (var i = 1, l = tbody.children.length; i < l; i++) {
                    const curTR = tbody.children[i];
                    const inputs = curTR.getElementsByTagName("input");
                    var reportId;
                    for (var k = 0, kl = inputs.length; k < kl; k++) {
                        const curInput = inputs[k];
                        if (curInput.name.startsWith("report_id")) {
                            reportId = curInput.value;
                            break;
                        }
                    }
                    const thisReport = await reportDB.getValue(reportId);

                    const reportStatus = document.createElement("td");
                    curTR.append(reportStatus);

                    if (!thisReport) {
                        reportStatus.innerHTML += "Fehlt komplett";
                    } else {
                        var haben = 0;
                        var brauchen = 0;
                        if (thisReport && thisReport.statistik) {
                            haben++;
                        } else {
                            brauchen++;
                            reportStatus.innerHTML += " S";
                        }
                        if (thisReport && thisReport.gegenstaende) {
                            haben++;
                        } else {
                            brauchen++;
                            reportStatus.innerHTML += " G";
                        }
                        if (!thisReport || !thisReport.levels) {
                            brauchen++;
                            reportStatus.innerHTML += " Lx";
                        } else {
                            for (var li = 0, ll = thisReport.levelCount; li < ll; li++) {
                                if (thisReport.levels[li]) {
                                    haben++;
                                } else {
                                    brauchen++;
                                    reportStatus.innerHTML += " L" + (li + 1);
                                }
                            }
                        }
                        if (brauchen === 0) {
                            reportStatus.innerHTML += "Komplett";
                        }
                    }
                }
            } else {
                const button = document.createElement("span");
                button.classList.add("nowod");
                button.innerHTML = " 💾";
                button.style.fontSize = "12px";
                button.style.cursor = "pointer";
                button.onclick = function () {
                    util.htmlExport();
                }
                title.appendChild(button);

                const reportData = WoD.getFullReportData();
                const reportDB = await MyStorage.getReportDB();
                var thisReport = await reportDB.getValue(reportData.reportId);
                console.log("Current Report ", reportData.reportId, thisReport);
                if (!thisReport) thisReport = reportData;
                if (title.textContent.trim().startsWith("Kampfstatistik")) {
                    thisReport.statistik = util.getPlainMainContent().outerHTML;
                } else if (title.textContent.trim().startsWith("Übersicht Gegenstände")) {
                    thisReport.gegenstaende = util.getPlainMainContent().outerHTML;
                } else if (title.textContent.trim().startsWith("Kampfbericht")) {
                    const form = document.getElementsByName("the_form")[0];
                    const levelNr = form.current_level.value;
                    thisReport.levelCount = document.getElementsByClassName("navigation levels")[0].children.length - 1;
                    if (!thisReport.levels) thisReport.levels = [];
                    thisReport.levels[levelNr - 1] = util.getPlainMainContent().outerHTML;
                }
                reportDB.setValue(reportData.reportId, thisReport);

                if (false) { // data dump
                    const allData = await reportDB.getAllData();
                    console.log("allData", allData);
                    for (const [id, metaInfo] of Object.entries(allData)) {
                        const bigData = await reportDB.getValue(id);
                        console.log("ReportData", id, metaInfo, bigData);
                    }
                }
            }
        }
    }

    class Storages {

        static IndexedDb = class {
            storageId;
            connection;
            key;
            indizes;

            static async create(storageId, key, indizes) {
                const result = new Storages.IndexedDb(storageId, key, indizes);
                await result.openDB();
                return result;
            }

            constructor(storageId, key, indizes) {
                this.storageId = storageId;
                this.key = key;
                this.indizes = indizes;
            }

            async openDB() {
                const thisObject = this;
                return new Promise((resolve, reject) => {
                    var request = indexedDB.open(Mod.dbname, 3);
                    request.onsuccess = function (event) {
                        console.log("DBconnect success", event);
                        thisObject.connection = event.target.result;
                        resolve();
                    }
                    request.onerror = function (event) {
                        console.log("DBconnect error", event);
                        reject();
                    }
                    request.onblocked = function () {
                        console.log("DBconnect blocked", event);
                        alert("Please close all other tabs with this site open!");
                        reject();
                    }
                    request.onupgradeneeded = async function (event) {
                        console.log("DBconnect upgradeneeded", event);
                        await thisObject.onupgradeneeded(event);
                        resolve();
                    }
                });
            }

            async setValue(id, dbObject) {
                const thisObject = this;
                return new Promise((resolve, reject) => {
                    let transaction = thisObject.connection.transaction(this.storageId, "readwrite");
                    let objectStore = transaction.objectStore(this.storageId);
                    let request = objectStore.put(dbObject);
                    request.onsuccess = function (event) {
                        console.log("DBObject save success")
                        resolve();
                    };
                    request.onerror = function (event) {
                        console.log("DBObject save error", event);
                        reject();
                    }
                });
            }

            async getValue(dbObjectId) {
                const thisObject = this;
                return new Promise((resolve, reject) => {
                    let transaction = thisObject.connection.transaction(this.storageId, "readwrite");
                    let objectStore = transaction.objectStore(this.storageId);
                    const request = objectStore.get(dbObjectId);

                    request.onsuccess = function (event) {
                        const result = event.target.result;
                        resolve(result);
                    };
                });
            }

            async onupgradeneeded(event) {
                const oDb = event.target.result;
                this.useDb(oDb);
                if (event.oldVersion === 0) {
                    try {
                        let reportStore = oDb.createObjectStore(this.storageId, {
                            keyPath: this.key
                        });
                        this.indizes.forEach(index => {
                            reportStore.createIndex(index, index);
                        })
                    } catch (exception) {
                        console.warn("objectStoreStatusReportList", exception);
                    }
                }
            }

            useDb(oDb) {
                // Make sure to add a handler to be notified if another page requests a version
                // change. We must close the database. This allows the other page to upgrade the database.
                // If you don't do this then the upgrade won't happen until the user close the tab.
                oDb.onversionchange = function (event) {
                    console.log("onversionchange close db");
                    oDb.close();
                    console.log("db versionschange", event);
                    alert("A new version of this page is ready. Please reload!");
                };

                oDb.onsuccess = function (event) {
                    console.log("db success", event);
                };

                oDb.onError = function (event) {
                    console.warn("db error", event);
                };
            }

        }

    }

    class MyStorage {
        static reports;

        static async getReportDB() {
            if (!this.reports) this.reports = await Storages.IndexedDb.create("reports", "reportId", ["world", "time", "title", "gruppe", "gruppe_id"]);
            return this.reports;
        }

    }

    class WoD {
        // Types: Dungeon/Quest, Schlacht-Report, Duell (Solo, Gruppe, Duell)
        // wod/spiel/clanquest/combat_report.php?battle=8414&report=59125 (battle scheint nicht relevant zu sein!? Seite kann auch so aufgerufen werden)
        // wod/spiel/tournament/duell.php
        static getFullReportData() {
            const form = document.getElementsByName("the_form")[0];
            const titleSplit = document.getElementsByTagName("h2")[0].textContent.split("-");
            var timeString = titleSplit[0].trim();
            if (timeString.includes("Heute")) {
                timeString = timeString.replace("Heute", util.formatDate(new Date()));
            } else if (timeString.includes("Gestern")) {
                const date = new Date();
                date.setDate(date.getDate() - 1);
                timeString = timeString.replace("Gestern", util.formatDate(date));
            }
            return {
                reportId: form["report_id[0]"].value,
                world: form.wod_post_world.value, // wod_post_world = "WA";
                time: timeString,
                title: titleSplit[1].trim(), // Bei einem Dungeon z.B. der Dungeonname
                gruppe: form.gruppe_name.value,
                gruppe_id: form.gruppe_id.value,
            };
        }


        static getInformation(name) {
            return document.getElementsByName(name)[0];
        }

        static getReportIdPlain() {
            return getInformation("report_id[0]") || getInformation("report");
        }

        static getReportId() {
            var reportId = document.getElementsByName("report_id[0]")[0];
            if (reportId) {
                return "dungeon_" + reportId.value;
            }
            reportId = document.getElementsByName("report")[0];
            if (reportId) {
                return "schlacht_" + reportId.value;
            }
        }
    }

    class util {

        static getWindowPage() {
            var pathname = window.location.pathname.split("/");
            var pageSection = pathname[pathname.length - 2];
            return pathname[pathname.length - 1];
        }

        static formatDate(date) {
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

            return myDocument.documentElement;
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