// ==UserScript==
// @name           [WoD] Kampfbericht Archiv
// @namespace      demawi
// @description    Lässt einen die Seiten der Kampfberichte direkt downloaden
// @version        0.1
// @include        http*://*/wod/spiel/*dungeon/report.php*
// @require        https://raw.githubusercontent.com/demawi/WoD-Mods/refs/heads/master/repo/DemawiRepository.js?version=1.0.3
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
    const _util = demawiRepository.import("util");
    const _UI = demawiRepository.import("UI");
    const _File = demawiRepository.import("File");

    class Mod {
        static dbname = "wodDB";

        static async startMod() {
            console.log("StartMod: KampfberichtArchiv!");
            const title = document.getElementsByTagName("h1")[0];
            if (title.textContent.trim() === "Kampfberichte") {
                _UI.useJQueryUI(); // wird fürs Archiv genutzt
                await MainPage.start();
                const zip = await _File.getJSZip();
                console.log("ZIPPER: ", zip);
            } else {
                await this.getReportSiteInformation();
            }
        }

        /**
         * Einzelseite eines Reports wurde aufgerufen. Bestimmen und speichern der Informationen.
         */
        static async getReportSiteInformation() {
            const title = document.getElementsByTagName("h1")[0];
            title.appendChild(_UI.createButton(" 💾", () => {
                util.htmlExport();
            }));

            const reportData = WoD.getFullReportBaseData();
            var thisReport = await MyStorage.getFullReport(reportData.reportId);
            console.log("Current Report ", reportData.reportId, thisReport);
            if (!thisReport) thisReport = reportData;
            if (title.textContent.trim().startsWith("Kampfstatistik")) {
                thisReport.statistik = util.getPlainMainContent().documentElement.outerHTML;
                thisReport.success = this.retrieveSuccessInformation(document);
            } else if (title.textContent.trim().startsWith("Übersicht Gegenstände")) {
                thisReport.gegenstaende = util.getPlainMainContent().documentElement.outerHTML;
            } else if (title.textContent.trim().startsWith("Kampfbericht")) {
                const form = document.getElementsByName("the_form")[0];
                const levelNr = form.current_level.value;

                let navigationLevels = document.getElementsByClassName("navigation levels")[0];
                if (navigationLevels) {
                    let successReport = thisReport.success;
                    if (!successReport) {
                        successReport = {};
                        thisReport.success = successReport;
                    }
                    successReport[1] = (navigationLevels.children.length - 1);
                }
                if (!thisReport.levels) thisReport.levels = [];
                thisReport.levels[levelNr - 1] = util.getPlainMainContent().documentElement.outerHTML;
            }
            await MyStorage.setFullReport(thisReport);
        }

        static retrieveSuccessInformation(doc) {
            const title = doc.getElementsByTagName("h2")[0].textContent.split(/-(.*)/)[1].trim();
            const tables = doc.querySelectorAll(".content_table");
            const table = tables[tables.length - 1];
            let expElements = table.querySelector("tr:nth-child(2)").querySelectorAll("td");
            let levelElements = table.querySelector("tr:nth-child(5)").querySelectorAll("td");
            let roomElements = table.querySelector("tr:nth-child(6)").querySelectorAll("td");
            const groupSize = levelElements.length - 2;
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

            return {
                levels: [maxSuccessLevel, maxLevel],
                rooms: [finishedRooms, fullRooms],
                members: [fullSuccessMembers, groupSize],
            }
        }
    }

    class SearchQuery {
        dateMin;
        dateMax;
        groupSelection;
        dungeonSelection;
        maxResults = 100;

        constructor() {
            this.dateMax;
            this.dateMin;
            this.groupSelection = [_WoD.getMyGroup()];
            this.dungeonSelection = [];
        }
    }

    class MainPage {
        static wodContent; // Kampfbericht-Inhalt
        static anchor; // hier wird der SeitenInhalt eingebettet
        static title;

        static async migrate() {
            console.log("Start success migration");
            for (const report of await MyStorage.reportSources.getAll()) {
                if (report.statistik) {
                    const doc = _util.getDocumentFor(report.statistik);
                    report.success = Mod.retrieveSuccessInformation(doc);
                } else if (report.levelCount) {
                    report.success = {
                        levels: [null, report.levelCount],
                    };
                }
                if (report.statistik) {
                    report.title = WoD.getDungeonTitle(_util.getDocumentFor(report.statistik));
                }
                delete report.levelCount;
                await MyStorage.reportSources.setValue(report);
            }
            console.log("Start success migration finished!");
        }

        static async start() {
            //this.migrate(); return;
            // MyStorage.recreateSourcesMeta(); return;
            this.title = document.getElementsByTagName("h1")[0];
            const wodContent = document.getElementsByClassName("content_table")[0];
            this.anchor = document.createElement("div");
            wodContent.parentElement.insertBefore(this.anchor, wodContent);
            wodContent.parentElement.removeChild(wodContent);
            this.anchor.append(wodContent);
            this.wodContent = wodContent;

            const thisObject = this;

            this.archivButton = _UI.createButton(" 📦", async function () {
                thisObject.title.removeChild(thisObject.archivButton);
                thisObject.title.innerHTML = "Kampfberichte - Archiv";
                await ArchivSearch.showArchiv(thisObject.anchor);
                thisObject.title.appendChild(thisObject.wodContentButton);
            });
            this.statisticsButton = _UI.createButton(" 📊", async function () {
                thisObject.title.innerHTML = "Kampfberichte - Statistik";
                await MainPage.showStatistics();
                thisObject.title.appendChild(thisObject.wodContentButton);
            });
            this.wodContentButton = _UI.createButton(" ↩", async function () {
                thisObject.title.innerHTML = "Kampfberichte";
                await MainPage.showWodOverview();
                thisObject.title.appendChild(thisObject.archivButton);
                thisObject.title.appendChild(thisObject.statisticsButton);
            });
            delete this.wodContentButton.style.fontSize;

            thisObject.title.appendChild(thisObject.archivButton);
            thisObject.title.appendChild(thisObject.statisticsButton);

            await this.completeDungeonInformations(false);
        }

        static async showWodOverview() {
            this.anchor.removeChild(this.anchor.children[0]);
            this.anchor.append(this.wodContent);
        }

        static async showStatistics() {
            this.anchor.removeChild(this.anchor.children[0]);
            const statTable = document.createElement("div");
            const dungeonStats = {};
            for (const report of await MyStorage.getReportDBMeta().getAll()) {
                let dungeonStat = dungeonStats[report.title];
                if (!dungeonStat) {
                    dungeonStat = {};
                    dungeonStats[report.title] = dungeonStat;
                }
                const success = report.success;
                if (!success) continue;
                const members = success.members;
                if (!members) continue;
                if (members[0] === members[1]) {
                    let full = dungeonStat.full || 0;
                    full++;
                    dungeonStat.full = full;
                } else if (Number(members[0]) === 0) {
                    let wipe = dungeonStat.wipe || 0;
                    wipe++;
                    dungeonStat.wipe = wipe;
                } else {
                    let part = dungeonStat.part || 0;
                    part++;
                    dungeonStat.part = part;
                }
            }
            for (const dungeonName of Object.keys(dungeonStats).sort()) {
                const dungeonStat = dungeonStats[dungeonName];

            }
            this.anchor.append(statTable);
        }

        /**
         * Erweitert den Dungeon-Table um eine weitere Spalte und liefert die Informationen welcher Content bereits aufgerufen wurde.
         * @param isArchiv ob dies ein Archiv-Aufruf ist oder nicht.
         */
        static async completeDungeonInformations(isArchiv) {
            const reportDBMeta = await MyStorage.getReportDBMeta();
            const tbody = document.getElementsByClassName("content_table")[0].children[0];
            const ueberschriftArchiv = document.createElement("th");
            ueberschriftArchiv.innerHTML = "Archiviert (fehlend)";
            ueberschriftArchiv.style.width = "40px";
            const ueberschriftSpeicher = document.createElement("th");
            ueberschriftSpeicher.innerHTML = "Speicher";
            ueberschriftSpeicher.style.width = "40px";
            const ueberschriftAktionen = document.createElement("th");
            ueberschriftAktionen.innerHTML = "Aktionen";
            ueberschriftAktionen.style.width = "40px";
            const ueberschriftErfolg = document.createElement("th");
            ueberschriftErfolg.title = "Wie weit die Gruppe levelmäßig vorgedrungen ist";
            ueberschriftErfolg.innerHTML = "Level";
            ueberschriftErfolg.style.width = "40px";
            const ueberschriftZiel = document.createElement("th");
            ueberschriftZiel.title = "Anteil der Charaktere die es erfolgreich bis ans Ende geschafft haben";
            ueberschriftZiel.innerHTML = "Ziel";
            ueberschriftZiel.style.width = "40px";
            const ueberschriftFortschritt = document.createElement("th");
            ueberschriftFortschritt.title = "Anteil aller erfolgreich besuchten Räume";
            ueberschriftFortschritt.innerHTML = "%";
            ueberschriftFortschritt.style.width = "10px";
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
                if (!reportId) continue;
                let thisReport = await reportDBMeta.getValue(reportId);
                if (!thisReport) {
                    thisReport = {
                        reportId: reportId,
                        title: curTR.children[1].textContent.trim(),
                        time: _WoD.getTimeString(curTR.children[0].textContent.trim()),
                        gruppe: _WoD.getMyGroup(),
                        gruppe_id: _WoD.getMyGroupId(),
                        world: _WoD.getMyWorld(),
                    }
                    await MyStorage.setFullReport(thisReport);
                }

                const archiviertTD = document.createElement("td");
                archiviertTD.style.textAlign = "center";
                archiviertTD.style.width = "40px";
                const archiviertSpeicherTD = document.createElement("td");
                archiviertSpeicherTD.style.textAlign = "center";
                archiviertSpeicherTD.style.width = "40px";
                const hatDatensaetze = thisReport.statistik || thisReport.gegenstaende || thisReport.levels;
                const archiviertAktionenTD = document.createElement("td");
                archiviertAktionenTD.style.textAlign = "center";
                archiviertAktionenTD.style.width = "40px";
                archiviertAktionenTD.style.padding = "0px";
                archiviertAktionenTD.style.fontSize = "18px";
                if(hatDatensaetze) {
                    const favoritButton = _UI.createButton("⭐", function() {

                    });
                    favoritButton.style.position = "relative";
                    favoritButton.style.top = "-2px";
                    favoritButton.style.fontSize = null;
                    favoritButton.title = "Datensatz favorisieren";
                    archiviertAktionenTD.append(favoritButton);
                    const deleteButton = _UI.createButton("🌋", function () { // ❌

                    });
                    deleteButton.style.position = "relative";
                    deleteButton.style.top = "-2px";
                    deleteButton.style.fontSize = null;
                    deleteButton.title = "Löschen der Berichte. Die bereits geholten Meta-Daten bleiben erhalten."; // was für Daten? auch Meta-Daten? oder nur Sources?
                    archiviertAktionenTD.append(deleteButton);
                }
                const colorGreen = "rgb(62, 156, 62)";
                const colorRed = "rgb(203, 47, 47)";
                const colorYellow = "rgb(194, 194, 41)";
                if (!thisReport || !hatDatensaetze) {
                    archiviertTD.style.backgroundColor = colorRed;
                    archiviertTD.innerHTML += "<span style='white-space: nowrap'>Fehlt komplett</span>";
                } else {
                    if (hatDatensaetze && thisReport.space) {
                        archiviertSpeicherTD.innerHTML = Math.ceil(10 * thisReport.space / 1024 / 1024) / 10 + " MB";
                    }
                    var haben = 0;
                    var brauchen = 0;
                    const fehlend = [];
                    if (thisReport && thisReport.statistik) {
                        haben++;
                    } else {
                        brauchen++;
                        fehlend.push("S");
                    }
                    if (thisReport && thisReport.gegenstaende) {
                        haben++;
                    } else {
                        brauchen++;
                        fehlend.push("G");
                    }
                    if (!thisReport || !thisReport.success) {
                        brauchen++;
                        fehlend.push("Lx");
                    } else {
                        let maxLevel = thisReport.success.levels[1];
                        let successLevels = thisReport.success.levels[0];
                        if (successLevels) maxLevel = successLevels;
                        for (var li = 0, ll = maxLevel; li < ll; li++) {
                            if (thisReport.levels && thisReport.levels[li]) {
                                haben++;
                            } else {
                                brauchen++;
                                fehlend.push("L" + (li + 1))
                            }
                        }
                    }
                    if (brauchen === 0) {
                        archiviertTD.style.backgroundColor = colorGreen;
                        archiviertTD.innerHTML += "Komplett";
                    } else {
                        archiviertTD.style.backgroundColor = colorYellow;
                        archiviertTD.innerHTML += "<span style='white-space: nowrap'>" + fehlend.join(" ") + "</span>";
                    }
                }

                const erfolgTD = document.createElement("td");
                erfolgTD.style.textAlign = "center";
                erfolgTD.style.width = "40px";
                const zielTD = document.createElement("td");
                zielTD.style.textAlign = "center";
                zielTD.style.width = "40px";
                const fortschrittTD = document.createElement("td");
                fortschrittTD.style.textAlign = "center";
                fortschrittTD.style.width = "40px";
                if (thisReport && thisReport.success && thisReport.success.rooms) {
                    const members = thisReport.success.members;
                    if (members[0] === members[1]) {
                        curTR.style.backgroundColor = colorGreen;
                    } else if (members[0] > 0) {
                        curTR.style.backgroundColor = colorYellow;
                    } else {
                        curTR.style.backgroundColor = colorRed;
                    }
                    const rooms = thisReport.success.rooms;
                    const levels = thisReport.success.levels;
                    const successRate = Math.round(100 * rooms[0] / rooms[1]);
                    zielTD.innerHTML = members[0] + "/" + members[1];
                    fortschrittTD.innerHTML = successRate + "%";
                    erfolgTD.innerHTML = levels[0] + "/" + levels[1];
                }
                curTR.append(erfolgTD);
                curTR.append(zielTD);
                curTR.append(fortschrittTD);
                curTR.append(archiviertTD);
                if (isArchiv) {
                    curTR.append(archiviertAktionenTD);
                    curTR.append(archiviertSpeicherTD);
                }
            }
            tbody.children[0].append(ueberschriftErfolg);
            tbody.children[0].append(ueberschriftZiel);
            tbody.children[0].append(ueberschriftFortschritt);
            tbody.children[0].append(ueberschriftArchiv);
            if (isArchiv) {
                tbody.children[0].append(ueberschriftAktionen);
                tbody.children[0].append(ueberschriftSpeicher);
            }
        }
    }

    class ArchivSearch {
        static archivView;
        static searchResultAnchor;

        static searchQuery;
        static dungeonSelect;
        static groupSelect;

        static async query() {
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
            const dungeonTH = document.createElement("th");
            trHead.append(dungeonTH);
            dungeonTH.innerText = "Dungeon";
            th = document.createElement("th");
            trHead.append(th);
            th.innerText = "";
            const allReports = await MyStorage.getReportDBMeta().getAll();
            allReports.reverse();
            let switcher = false;
            const thisObject = this;
            const dungeonsFound = {};
            const groupsFoundPrimary = {};
            const dungeonsFoundPrimary = {};
            const primaryDate = new Date();
            primaryDate.setDate(primaryDate.getDate() - 14);
            const groupsFound = {};
            let count = 0;
            const maxResults = ArchivSearch.searchQuery.maxResults;
            for (const reportMeta of allReports) {
                if (!thisObject.isValidDate(reportMeta)) continue;
                groupsFound[reportMeta.gruppe] = true;
                if (thisObject.isValidDate(reportMeta, primaryDate)) {
                    groupsFoundPrimary[reportMeta.gruppe] = true;
                }
                if (!thisObject.isValidGroup(reportMeta)) continue;
                dungeonsFound[reportMeta.title] = true;
                if (thisObject.isValidDate(reportMeta, primaryDate)) {
                    dungeonsFoundPrimary[reportMeta.title] = true;
                }
                if (!thisObject.isValidDungeon(reportMeta)) continue;
                if (maxResults && count >= maxResults) continue;
                count++;
                const report = await MyStorage.getFullReport(reportMeta.reportId);
                if(!report) {
                    console.error("ReportSources not found: "+reportMeta.reportId);
                }
                switcher = !switcher;
                const tr = document.createElement("tr");
                tr.className = switcher ? "row0" : "row1";
                tbody.append(tr);
                const dateTD = document.createElement("td");
                tr.append(dateTD);
                dateTD.innerText = report.time;
                const nameTD = document.createElement("td");
                tr.append(nameTD);
                nameTD.innerText = report.title;
                const actionsTD = document.createElement("td");
                tr.append(actionsTD);
                ArchivSearch.createReportActions(report, actionsTD);
            }
            dungeonTH.innerText = "Dungeon (" + count + ")";
            this.updateDungeonSelector(dungeonsFound, dungeonsFoundPrimary);
            this.updateGroupSelector(groupsFound, groupsFoundPrimary);
            return table;
        }

        static getErweiterteKampfstatistikExecuter() {
            return unsafeWindow.statExecuter || function () {
            }
        }

        static updateDungeonSelector(dungeonsFound, dungeonsFoundPrimary) {
            this.searchQuery.dungeonSelection.slice(0).forEach(name => {
                if (!dungeonsFound[name]) _util.arrayRemove(this.searchQuery.dungeonSelection, name);
            });
            let selected = this.searchQuery.dungeonSelection.length === 0 ? "selected" : "";
            this.dungeonSelect.innerHTML = "<option value='' " + selected + ">" + "</option>";

            if (Object.keys(dungeonsFoundPrimary).length > 0) {
                this.dungeonSelect.innerHTML += "<option disabled>⎯⎯⎯⎯⎯⎯⎯⎯⎯ In den letzten 14 Tagen besucht ⎯⎯⎯⎯⎯⎯⎯⎯⎯</option>";
                for (const dungeonName of Object.keys(dungeonsFoundPrimary).sort()) {
                    const selected = this.searchQuery.dungeonSelection.includes(dungeonName) ? "selected" : "";
                    this.dungeonSelect.innerHTML += "<option value='" + dungeonName + "' " + selected + ">" + dungeonName + "</option>";
                }
                this.dungeonSelect.innerHTML += "<option disabled>⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯</option>";
            }
            for (const dungeonName of Object.keys(dungeonsFound).sort()) {
                if (dungeonsFoundPrimary[dungeonName]) continue;
                const selected = this.searchQuery.dungeonSelection.includes(dungeonName) ? "selected" : "";
                this.dungeonSelect.innerHTML += "<option value='" + dungeonName + "' " + selected + ">" + dungeonName + "</option>";
            }
        }

        static updateGroupSelector(groupsFound, groupsFoundPrimary) {
            this.searchQuery.groupSelection.slice(0).forEach(name => {
                if (!groupsFound[name]) _util.arrayRemove(this.searchQuery.groupSelection, name);
            });
            let selected = this.searchQuery.groupSelection.length === 0 ? "selected" : "";
            this.groupSelect.innerHTML = "<option value='' " + selected + ">" + "</option>";

            if (Object.keys(groupsFoundPrimary).length > 0) {
                this.groupSelect.innerHTML += "<option disabled>⎯⎯⎯⎯⎯⎯⎯⎯⎯ In den letzten 14 Tagen aktiv ⎯⎯⎯⎯⎯⎯⎯⎯⎯</option>";
                for (const dungeonName of Object.keys(groupsFoundPrimary).sort()) {
                    const selected = this.searchQuery.groupSelection.includes(dungeonName) ? "selected" : "";
                    this.groupSelect.innerHTML += "<option value='" + dungeonName + "' " + selected + ">" + dungeonName + "</option>";
                }
                this.groupSelect.innerHTML += "<option disabled>⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯</option>";
            }
            for (const dungeonName of Object.keys(groupsFound).sort()) {
                if (groupsFoundPrimary[dungeonName]) continue;
                const selected = this.searchQuery.groupSelection.includes(dungeonName) ? "selected" : "";
                this.groupSelect.innerHTML += "<option value='" + dungeonName + "' " + selected + ">" + dungeonName + "</option>";
            }
        }

        static isValidDate(report, dateMin) {
            dateMin = dateMin || this.searchQuery.dateMin;
            const dateMax = this.searchQuery.dateMax;

            const reportTime = _util.parseStandardTimeString(report.time);
            if (dateMax) {
                if (dateMax <= reportTime) return false;
            }
            if (dateMin >= reportTime) return false;
            return true;
        }

        static isValidGroup(report) {
            const groupSelector = this.searchQuery.groupSelection;
            if (groupSelector.length > 0) {
                if (!groupSelector.includes(report.gruppe)) return false;
            }
            return true;
        }

        static isValidDungeon(report) {
            const dungeonSelector = this.searchQuery.dungeonSelection;
            if (dungeonSelector.length > 0) {
                if (!dungeonSelector.includes(report.title)) return false;
            }
            return true;
        }

        static async showArchiv() {
            MainPage.anchor.removeChild(MainPage.anchor.children[0]);
            let created = false;
            if (!this.archivView) {
                created = true;
                this.archivView = document.createElement("div");
                this.searchQuery = new SearchQuery();
                const letzteDungeonZeile = MainPage.wodContent.querySelector("table tr:last-child td");
                //this.searchQuery.dateMax = new Date(_util.parseStandardTimeString(letzteDungeonZeile.textContent));
                this.searchResultAnchor = document.createElement("div");
                const searchTable = this.createSearchTable();
                this.archivView.append(searchTable);
                this.archivView.append(this.searchResultAnchor);
                // TODO: Aktionen für Kampfberichte (Favorit, Löschen, Speichern-Alles)
                // TODO: Erreichte Vollständigkeit des Dungeons anzeigen 12/12 geschafft zu 2/12 geschafft etc.
                // TODO: Statistik-Anzeige aller Dungeons der Gruppe: Erstbesuch-Datum. Anzahl erfolgreicher Durchläufe. Anzahl semi-erfolgreicher Durchläufe. Anzahl nicht erfolgreicher Durchläufe.
            }
            MainPage.anchor.append(this.archivView);
            this.updateSearch();
        }

        static createSearchTable() {
            const searchTable = document.createElement("div");
            searchTable.id = "orders";
            const content = [];
            const dateMinInput = this.createDatePicker();
            if (this.searchQuery.dateMin) dateMinInput.value = _util.formatDateAndTime(this.searchQuery.dateMin);
            const dateMaxInput = this.createDatePicker();
            if (this.searchQuery.dateMax) dateMaxInput.value = _util.formatDateAndTime(this.searchQuery.dateMax);
            const datumRow = document.createElement("div");
            datumRow.append(dateMinInput);
            datumRow.append(_UI.createButton("❌", function() {
                if(dateMinInput.value.trim() !== "") {
                    dateMinInput.value = "";
                    thisObject.searchQuery.dateMin = null;
                    ArchivSearch.updateSearch();
                }
            }));
            datumRow.append(" - ");
            datumRow.append(dateMaxInput);
            datumRow.append(_UI.createButton("❌", function() {
                if(dateMaxInput.value.trim() !== "") {
                    dateMaxInput.value = "";
                    thisObject.searchQuery.dateMax = null;
                    ArchivSearch.updateSearch();
                }
            }));
            dateMinInput.onchange = function () {
                try {
                    thisObject.searchQuery.dateMin = new Date(_util.parseStandardDateString(dateMinInput.value));
                } catch (e) {
                    thisObject.searchQuery.dateMin = null;
                }
                ArchivSearch.updateSearch();
            }
            dateMaxInput.onchange = function () {
                try {
                    thisObject.searchQuery.dateMax = new Date(_util.parseStandardDateString(dateMaxInput.value));
                    thisObject.searchQuery.dateMax.setDate(thisObject.searchQuery.dateMax.getDate() + 1);
                } catch (e) {
                    thisObject.searchQuery.dateMax = null;
                }
                ArchivSearch.updateSearch();
            }
            content.push(["Zeitraum", datumRow]);
            const thisObject = this;
            this.groupSelect = document.createElement("select");
            this.groupSelect.onchange = async function () {
                thisObject.searchQuery.groupSelection = [];
                var options = thisObject.groupSelect.selectedOptions;
                for (var i = 0, l = options.length; i < l; i++) {
                    const opt = options[i];
                    const value = opt.value || opt.text;
                    if (value === "") continue;
                    thisObject.searchQuery.groupSelection.push(value);
                }
                ArchivSearch.updateSearch();
            }
            content.push(["Gruppe", this.groupSelect]);
            this.dungeonSelect = document.createElement("select");
            this.dungeonSelect.onchange = async function () {
                thisObject.searchQuery.dungeonSelection = [];
                var options = thisObject.dungeonSelect.selectedOptions;
                for (var i = 0, l = options.length; i < l; i++) {
                    const opt = options[i];
                    const value = opt.value || opt.text;
                    if (value === "") continue;
                    thisObject.searchQuery.dungeonSelection.push(value);
                }
                console.log("Updated dungeon selection ", thisObject.searchQuery.dungeonSelection)
                ArchivSearch.updateSearch();
            }
            content.push(["Dungeon", this.dungeonSelect]);
            content.push(["Max. Ergebnisse", ArchivSearch.searchQuery.maxResults]);

            searchTable.append(_UI.createTable(content));

            if (false) {
                const button = document.createElement("input");
                button.type = "button";
                button.value = "Aktualisieren";
                button.onclick = async function () {
                    await ArchivSearch.updateSearch();
                };
                searchTable.append(button);
            }
            return searchTable;
        }

        static async updateSearch() {
            const resultTable = await ArchivSearch.query();
            this.searchResultAnchor.innerHTML = "";
            this.searchResultAnchor.append(resultTable);
            await MainPage.completeDungeonInformations(true);
        }

        static createDatePicker() {
            const input = document.createElement("input");
            input.type = "text";
            $(input).datepicker({
                dateFormat: "dd.mm.yy",
            });
            input.size = 8;
            return input;
        }

        static async showSite(report, reportSiteHTML, kampfbericht, kampfstatistik) {
            MainPage.anchor.removeChild(MainPage.anchor.children[0]);
            const doc = _util.getDocumentFor(reportSiteHTML);
            const mainContent = doc.getElementById("main_content");
            const temp = document.createElement("div");
            temp.innerHTML = mainContent.outerHTML;
            MainPage.anchor.append(temp);
            MainPage.title.scrollIntoView();
            const statExecuter = this.getErweiterteKampfstatistikExecuter();
            if (statExecuter) await statExecuter(kampfbericht, kampfstatistik);
            const inputs = temp.getElementsByTagName("input");
            for (var i = 0, l = inputs.length; i < l; i++) {
                const input = inputs[i];
                if (input.name !== "disabled") {
                    input.onclick = function (e) {
                        e.stopPropagation();
                        e.preventDefault();
                        switch (input.value) {
                            case "Übersicht":
                                ArchivSearch.showArchiv();
                                break;
                            case "Statistik":
                                ArchivSearch.showSite(report, report.statistik, false, true);
                                break;
                            case "Gegenstände":
                                ArchivSearch.showSite(report, report.gegenstaende);
                                break;
                            case "Bericht":
                                ArchivSearch.showSite(report, report.levels[0], true, false);
                                break;
                            default:
                                const matches = input.value.match(/Level.*(\d+)/);
                                if (matches) {
                                    ArchivSearch.showSite(report, report.levels[matches[1] - 1], true, false);
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
                ArchivSearch.showSite(report, report.statistik, false, true);
            }

            const statistik = document.createElement("input");
            result.append(statistik);
            statistik.value = "Statistik";
            statistik.type = "submit";
            statistik.className = "button clickable";
            statistik.onclick = function (e) {
                e.preventDefault();
                ArchivSearch.showSite(report, report.statistik, false, true);
            }

            const gegenstaende = document.createElement("input");
            result.append(gegenstaende);
            gegenstaende.value = "Gegenstände";
            gegenstaende.type = "submit";
            gegenstaende.className = "button clickable";
            gegenstaende.onclick = function (e) {
                e.preventDefault();
                ArchivSearch.showSite(report, report.gegenstaende);
            }

            const bericht = document.createElement("input");
            result.append(bericht);
            bericht.value = "Bericht";
            bericht.type = "submit";
            bericht.className = "button clickable";
            bericht.onclick = function (e) {
                e.preventDefault();
                ArchivSearch.showSite(report, report.levels[0], true, false);
            }

            return result;
        }

    }

    class MyStorage {
        static adjustMeta = function (objStore) {
            const thisObject = this;

            const resultSetValue = objStore.setValue;
            objStore.setValue = async function (report) {
                report.space = _util.getSpace(report);
                await resultSetValue.call(objStore, report);
                await thisObject.reportSourcesMeta.setValue(thisObject.getMetaFor(report));
            }

            const resultDeleteValue = objStore.deleteValue;
            objStore.deleteValue = async function (dbObjectId) {
                await resultDeleteValue.call(objStore, dbObjectId);
                await thisObject.reportSourcesMeta.deleteValue(dbObjectId);
            }
            return objStore;
        }
        static getMetaFor = function (report) {
            const meta = {
                reportId: report.reportId,
                time: report.time,
                title: report.title,
                gruppe: report.gruppe,
                gruppe_id: report.gruppe_id,
                world: report.world,
                gegenstaende: !!report.gegenstaende,
                statistik: !!report.statistik,
                success: report.success,
                space: report.space,
            };
            if (report.levels) {
                const metaLevels = [];
                for (const levelNr in report.levels) {
                    metaLevels.push(!!report.levels[levelNr]);
                }
                meta.levels = metaLevels;
            }
            return meta;
        }

        static indexedDb = new Storages.IndexedDb("WoDReportArchiv", Mod.dbname);
        static reportSources = this.adjustMeta(this.indexedDb.createObjectStore("reportSources", "reportId"));
        static reportSourcesMeta = this.indexedDb.createObjectStore("reportSourcesMeta", "reportId");

        static async getFullReport(reportId) {
            return await this.reportSources.getValue(reportId);
        }

        static async setFullReport(report) {
            return await this.reportSources.setValue(report);
        }

        static getReportDBMeta() {
            return this.reportSourcesMeta;
        }

        static async recreateSourcesMeta() {
            console.log("recreateSourcesMeta...");
            for (const report of await this.reportSourcesMeta.getAll()) {
                await this.reportSourcesMeta.deleteValue(report.reportId);
            }

            for (const report of await this.reportSources.getAll()) {
                await this.reportSourcesMeta.setValue(this.getMetaFor(report));
            }
            console.log("recreateSourcesMeta finished!");
        }

    }

    class WoD {
        // Types: Dungeon/Quest, Schlacht-Report, Duell (Solo, Gruppe, Duell)
        // wod/spiel/clanquest/combat_report.php?battle=8414&report=59125 (battle scheint nicht relevant zu sein!? Seite kann auch so aufgerufen werden)
        // wod/spiel/tournament/duell.php
        static getFullReportBaseData(doc) {
            doc = doc || document;
            const form = doc.getElementsByName("the_form")[0];
            const titleSplit = doc.getElementsByTagName("h2")[0].textContent.split(/-(.*)/);
            const title = titleSplit[1].trim();
            const timeString = _WoD.getTimeString(titleSplit[0].trim());
            return {
                reportId: form["report_id[0]"].value,
                world: _WoD.getMyWorld(),
                time: timeString,
                title: title, // Bei einem Dungeon z.B. der Dungeonname
                gruppe: _WoD.getMyGroup(),
                gruppe_id: _WoD.getMyGroupId(),
            };
        }

        static getDungeonTitle(doc) {
            return doc.getElementsByTagName("h2")[0].textContent.split(/-(.*)/)[1].trim();
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