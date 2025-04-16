// ==UserScript==
// @name           [WoD] Kampfbericht Archiv
// @namespace      demawi
// @description    Lässt einen die Seiten der Kampfberichte direkt downloaden
// @version        0.1
// @include        http*://*.world-of-dungeons.de/wod/spiel/*dungeon/report.php*
// @include        http*://*/wod/spiel/*dungeon/report.php*
// @require        https://raw.githubusercontent.com/demawi/WoD-Mods/refs/heads/master/repo/DemawiRepository.js
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

    const Storages = demawiRepository.import("Storages");
    const _WoD = demawiRepository.import("WoD");

    class Mod {
        static dbname = "wodDB";

        static async startMod() {
            const title = document.getElementsByTagName("h1")[0];
            if (title.textContent.trim() === "Kampfberichte") {
                MainPage.start();
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
                    thisReport.statistik = util.getPlainMainContent().documentElement.outerHTML;
                } else if (title.textContent.trim().startsWith("Übersicht Gegenstände")) {
                    thisReport.gegenstaende = util.getPlainMainContent().documentElement.outerHTML;
                } else if (title.textContent.trim().startsWith("Kampfbericht")) {
                    const form = document.getElementsByName("the_form")[0];
                    const levelNr = form.current_level.value;

                    let navigationLevels = document.getElementsByClassName("navigation levels")[0];
                    if (navigationLevels) {
                        thisReport.levelCount = (navigationLevels.children.length - 1);
                    }
                    if (!thisReport.levels) thisReport.levels = [];
                    thisReport.levels[levelNr - 1] = util.getPlainMainContent().documentElement.outerHTML;
                }
                reportDB.setValue(thisReport);

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

    class MainPage {
        static anchor;
        static wodContent;
        static title;
        static statExecuter

        static async start() {
            const title = document.getElementsByTagName("h1")[0];
            const wodContent = document.getElementsByClassName("content_table")[0];
            const anchor = document.createElement("div");
            this.anchor = anchor;
            wodContent.parentElement.insertBefore(this.anchor, wodContent);
            wodContent.parentElement.removeChild(wodContent);
            this.anchor.append(wodContent);
            this.wodContent = wodContent;

            const thisObject = this;
            const button = document.createElement("span");
            button.classList.add("nowod");
            button.innerHTML = " (Archiv)";
            button.style.fontSize = "12px";
            button.style.cursor = "pointer";
            button.onclick = async function () {
                console.log("contains: " + anchor.contains(wodContent))
                if (anchor.contains(wodContent)) {
                    if(!thisObject.statExecuter) {
                        thisObject.statExecuter = unsafeWindow.statExecuter || function () {}
                    }
                    await MainPage.showOverview();
                    //title.innerText = "Kampfberichte-Archiv";
                } else {
                    MainPage.showWodOverview();
                    //title.innerText = "Kampfberichte";
                }
            }
            title.appendChild(button);
            this.title = title;

            await this.fillOutCompletion();
        }

        static async createTable() {
            const table = document.createElement("table");
            table.style.width = "100%";
            table.classList.add("content_table");
            const tbody = document.createElement("tbody");
            table.append(tbody);
            const trHead = document.createElement("tr");
            trHead.className = "header";
            tbody.append(trHead);
            let th = document.createElement("th");
            trHead.append(th);
            th.innerText = "Datum";
            th = document.createElement("th");
            trHead.append(th);
            th.innerText = "Dungeon";
            const allReports = await MyStorage.getReportDB().getAll();
            allReports.reverse();
            let switcher = false;
            allReports.forEach(a => {
                //if(a.gruppe !== "Freizeit-Helden") return;
                switcher = !switcher;
                const tr = document.createElement("tr");
                tr.className = switcher ? "row0" : "row1";
                tbody.append(tr);
                const dateTD = document.createElement("td");
                tr.append(dateTD);
                dateTD.innerText = a.time;
                const nameTD = document.createElement("td");
                tr.append(nameTD);
                nameTD.innerText = a.title;
                const actionsTD = document.createElement("td");
                tr.append(actionsTD);
                MainPage.createReportActions(a, actionsTD);
            });
            return table;
        }

        static async showOverview() {
            this.anchor.removeChild(this.anchor.children[0]);
            this.anchor.append(await MainPage.createTable());
            await this.fillOutCompletion();
        }

        static async showWodOverview() {
            this.anchor.removeChild(this.anchor.children[0]);
            this.anchor.append(this.wodContent);
        }

        static async showSite(report, reportSiteHTML, kampfbericht, kampfstatistik) {
            this.anchor.removeChild(this.anchor.children[0]);
            console.log("AnchorLength" + this.anchor.children.length);
            const temp = document.createElement("div");
            temp.innerHTML = reportSiteHTML;
            this.anchor.append(temp);
            this.title.scrollIntoView();
            console.log("statE", this.statExecuter);
            if (this.statExecuter) {
                await this.statExecuter(kampfbericht, kampfstatistik);
            }
            const inputs = temp.getElementsByTagName("input");
            for (var i = 0, l = inputs.length; i < l; i++) {
                const input = inputs[i];
                if (input.name !== "disabled") {
                    input.onclick = function (e) {
                        e.stopPropagation();
                        e.preventDefault();
                        switch (input.value) {
                            case "Übersicht":
                                MainPage.showOverview();
                                break;
                            case "Statistik":
                                MainPage.showSite(report, report.statistik, false, true);
                                break;
                            case "Gegenstände":
                                MainPage.showSite(report, report.gegenstaende);
                                break;
                            case "Bericht":
                                MainPage.showSite(report, report.levels[0], true, false);
                                break;
                            default:
                                const matches = input.value.match(/Level.*(\d+)/)
                                if (matches) {
                                    MainPage.showSite(report, report.levels[matches[1] - 1], true, false);
                                }
                                break;
                        }
                    }
                }
            }

        }

        static createReportActions(report, result) {
            const reportId = document.createElement("input");
            result.append(reportId);
            reportId.value = report.reportId;
            reportId.type = "hidden";
            reportId.name = "report_id[0]";
            reportId.onclick = function (e) {
                e.preventDefault();
                MainPage.showSite(report, report.statistik, false, true);
            }

            const statistik = document.createElement("input");
            result.append(statistik);
            statistik.value = "Statistik";
            statistik.type = "submit";
            statistik.className = "button clickable";
            statistik.onclick = function (e) {
                e.preventDefault();
                MainPage.showSite(report, report.statistik, false, true);
            }

            const gegenstaende = document.createElement("input");
            result.append(gegenstaende);
            gegenstaende.value = "Gegenstände";
            gegenstaende.type = "submit";
            gegenstaende.className = "button clickable";
            gegenstaende.onclick = function (e) {
                e.preventDefault();
                MainPage.showSite(report, report.gegenstaende);
            }

            const bericht = document.createElement("input");
            result.append(bericht);
            bericht.value = "Bericht";
            bericht.type = "submit";
            bericht.className = "button clickable";
            bericht.onclick = function (e) {
                e.preventDefault();
                MainPage.showSite(report, report.levels[0], true, false);
            }

            return result;
        }

        static async fillOutCompletion() {
            console.log("fillOutCompletion", document.getElementsByClassName("content_table")[0]);
            const reportDB = await MyStorage.getReportDB();
            const tbody = document.getElementsByClassName("content_table")[0].children[0];
            let curTR;
            for (var i = 1, l = tbody.children.length; i < l; i++) {
                curTR = tbody.children[i];
                const inputs = curTR.getElementsByTagName("input");
                var reportId;
                for (var k = 0, kl = inputs.length; k < kl; k++) {
                    const curInput = inputs[k];
                    if (curInput.name.startsWith("report_id")) {
                        reportId = curInput.value;
                        break;
                    }
                }
                console.log("reportId", reportId);
                if(!reportId) continue;
                const thisReport = await reportDB.getValue(reportId);

                const reportStatus = document.createElement("td");
                curTR.append(reportStatus);
                //console.log("fillout: ", reportId, thisReport, curTR);

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
        }
    }

    class MyStorage {
        static indexedDb = new Storages.IndexedDb("WoDReportArchiv", Mod.dbname);
        static reports = this.indexedDb.createObjectStore("reports", "reportId");

        static getReportDB() {
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
            const timeString = _WoD.getTimeString(titleSplit[0].trim());
            return {
                reportId: form["report_id[0]"].value,
                world: _WoD.getMyWorld(),
                time: timeString,
                title: titleSplit[1].trim(), // Bei einem Dungeon z.B. der Dungeonname
                gruppe: _WoD.getMyGroup(),
                gruppe_id: _WoD.getMyGroupId(),
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

        // Versucht soweit alle Elemente die nicht zum Main-Content gehören rauszufiltern.
        static getPlainMainContent() {
            const myDocument = document.cloneNode(true);

            const remove = node => {
                if (node) node.parentElement.removeChild(node);
            }
            remove(myDocument.getElementById("gadgettable-left-td")); // existiert in nem Popup nicht
            remove(myDocument.getElementById("gadgettable-right-td")); // existiert in nem Popup nicht
            const mainContent = myDocument.getElementsByClassName("gadget main_content lang-de")[0];
            if (mainContent) { // existiert in nem Popup nicht
                util.forEachSafe(mainContent.parentElement.children, cur => {
                    if (cur !== mainContent) remove(cur);
                });
            }
            remove(myDocument.getElementsByClassName("gadget popup")[0]);

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

            function createNewButton(text, href) {
                const newButton = document.createElement("a");
                newButton.classList = "button clickable";
                newButton.value = text;
                newButton.innerText = text;
                newButton.href = href;
                return newButton;
            }

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
                if (a.parentElement.children[0].textContent === "Übersicht") { // im Popup gibt es keine Übersicht
                    buttonReplaceWithElement(a.parentElement.children[0], "Übersicht", "../");
                } else {
                    a.parentElement.insertBefore(createNewButton("Übersicht", "../"), a.parentElement.children[0]);
                }
            });
            buttonReplace("stats[0]", "Statistik", "Statistik.html");
            buttonReplace("items[0]", "Gegenstände", "Gegenstaende.html");
            buttonReplace("details[0]", "Bericht", "Level1.html");
            for (var i = 1; i <= 12; i++) {
                buttonReplace("level[" + i + "]", "Level " + i, "Level" + i + ".html");
            }

            var fileName;

            var curElement = myDocument.getElementsByName("current_level")[0];
            console.log(myDocument);
            if (curElement) {
                fileName = "Level" + curElement.value;
            } else {
                curElement = myDocument.getElementsByName("disabled")[0];
                if (!curElement) curElement = myDocument.getElementsByClassName("button_disabled")[0];
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