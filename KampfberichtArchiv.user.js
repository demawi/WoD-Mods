// ==UserScript==
// @name           [WoD] Kampfbericht Archiv
// @namespace      demawi
// @description    Lässt einen die Seiten der Kampfberichte direkt downloaden
// @version        0.1
// @include        https://*/wod/spiel/*dungeon/report.php*
// @include        https://*/wod/spiel/clanquest/combat_report.php*
// @include        https://*/wod/spiel/clanquest/move.php*
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
            const page = _util.getWindowPage();
            if (page === "move.php") { // Schlachtansicht
                await this.onMovePage();
            } else {
                const title = document.getElementsByTagName("h1")[0];
                if (title.textContent.trim() === "Kampfberichte") {
                    await MainPage.onKampfberichteSeite();
                } else {
                    await this.onReportSite();
                }
            }
        }

        /**
         * Wenn wir einen Bericht-Link finden, können wir auch gleich den Schlachtnamen dazu speichern.
         * Es werden alle "(Bericht)" auf einmal ins HTML eingebettet.
         */
        static async onMovePage() {
            const oldRound1 = document.getElementById("old_round_1");
            if (document.getElementById("old_round_1")) {
                const header = document.getElementsByTagName("h1")[0].getElementsByTagName("a")[0];
                const groupName = header.textContent;
                const groupId = new URL(header.href).searchParams.get("id");
                const schlachtName = document.getElementsByTagName("h2")[0].textContent.trim();
                for (const roundX of oldRound1.parentElement.children) {
                    for (const aElem of roundX.getElementsByTagName("a")) {
                        if (aElem.textContent === "(Bericht)") {
                            const boldElements = aElem.parentElement.getElementsByTagName("b");
                            const title = boldElements[0].textContent + " vs. " + boldElements[1].textContent;
                            const searchParams = new URL(aElem.href).searchParams;
                            const reportId = _WoD.getMyWorld() + searchParams.get("report");
                            const battleId = searchParams.get("battle");
                            let ts = undefined;
                            for (const h2 of roundX.getElementsByTagName("h2")) {
                                const text = h2.textContent;
                                if (text.startsWith("Runde")) {
                                    const timeString = text.substring(text.indexOf("(") + 1, text.indexOf(")"));
                                    ts = _WoD.getTimestampFromString(timeString);
                                }
                            }
                            console.log("Found report: " + reportId + " " + battleId + " '" + schlachtName + "'", new Date(ts));
                            const win = boldElements[2].textContent === "Angreifer";
                            const report = await MyStorage.reportArchive.getValue(reportId) || {
                                reportId: reportId,
                                title: title,
                                ts: ts,
                                success: {
                                    levels: [win ? 1 : 0, 1],
                                }
                            };
                            report.schlacht = schlachtName;
                            report.ts = ts;
                            report.world = _WoD.getMyWorld();
                            report.gruppe = groupName;
                            report.gruppe_id = groupId;
                            console.log("Save report: ", report);
                            await MyStorage.reportArchive.setValue(report);
                        }
                    }
                }
            }
        }

        /**
         * Einzelseite eines Reports wurde aufgerufen. Bestimmen und speichern der Informationen.
         */
        static async onReportSite() {
            const title = document.getElementsByTagName("h1")[0];
            const berichtsseiteSpeichernButton = _UI.createButton(" 💾", () => {
                util.htmlExport();
            });
            berichtsseiteSpeichernButton.title = "Einzelne Seite exportieren";
            title.appendChild(berichtsseiteSpeichernButton);
            if (document.getElementsByClassName("paginator").length > 0) {
                const warning = document.createElement("span");
                warning.style.fontSize = "16px";
                warning.innerHTML = "<br>⚠️ Dieser Level wird nicht vollständig auf einer Seite angezeigt und kann entsprechend nicht vollständig gespeichert werden. Bitte die Anzahl angezeigter Einträge entsprechend hochsetzen, so dass der Level vollständig auf einer Seite angezeigt wird. ⚠️"
                title.appendChild(warning);
            }

            const reportData = WoD.getFullReportBaseData();
            let reportMeta = await MyStorage.reportArchive.getValue(reportData.reportId) || reportData;
            if (!reportMeta.schlacht) reportMeta.schlacht = reportData.schlacht; // kommt evtl. nachträglich erst herein
            let reportSource = await MyStorage.getSourceReport(reportData.reportId) || {reportId: reportData.reportId};
            console.log("Current Report ", reportData, reportMeta, reportSource);

            if (title.textContent.trim().startsWith("Kampfstatistik")) {
                reportSource.statistik = util.getPlainMainContent().documentElement.outerHTML;
                reportMeta.statistik = true;
                reportMeta.success = this.retrieveSuccessInformation(document, reportMeta.success);
            } else if (title.textContent.trim().startsWith("Übersicht Gegenstände")) {
                reportSource.gegenstaende = util.getPlainMainContent().documentElement.outerHTML;
                reportMeta.gegenstaende = true;
            } else if (title.textContent.trim().startsWith("Kampfbericht")) {
                const form = document.getElementsByName("the_form")[0];
                const levelNr = WoD.isSchlacht() ? 1 : form.current_level.value;

                let navigationLevels = document.getElementsByClassName("navigation levels")[0];
                if (navigationLevels) {
                    let successReport = reportMeta.success;
                    if (!successReport) {
                        successReport = {};
                        reportMeta.success = successReport;
                    }
                    successReport[1] = (navigationLevels.children.length - 1);
                }
                if (!reportSource.levels) reportSource.levels = [];
                if (!reportMeta.levels) reportMeta.levels = [];
                reportSource.levels[levelNr - 1] = util.getPlainMainContent().documentElement.outerHTML;
                reportMeta.levels[levelNr - 1] = true;

                if (WoD.isSchlacht()) {
                    const gewonnen = document.getElementsByClassName("rep_room_end")[0].textContent === "Die Angreifer haben gesiegt!";
                    let success = reportMeta.success || {};
                    success.rooms = [gewonnen ? 1 : 0, 1];
                    success.levels = [gewonnen ? 1 : 0, 1];
                    reportMeta.success = success;

                    const allHeadlines = document.querySelectorAll(".rep_status_headline");
                    let lastHeroHeadline;
                    for (const curHeadline of allHeadlines) {
                        if (curHeadline.textContent === "Angreifer:") {
                            lastHeroHeadline = curHeadline;
                        }
                    }
                    const lastHeroTable = lastHeroHeadline.nextElementSibling;
                    const heroTags = lastHeroTable.querySelectorAll(".rep_hero, .rep_myhero, .rep_myotherheros");
                    let countHeroes = 0;
                    let countHeroesSuccess = 0;
                    for (const heroTag of heroTags) {
                        countHeroes++;
                        if (heroTag.parentElement.parentElement.parentElement.children[6].textContent !== "bewusstlos") {
                            countHeroesSuccess++;
                        }
                    }
                    success.members = [countHeroesSuccess, countHeroes];
                }
            }

            const space = _util.getSpace(reportSource);
            reportMeta.space = space;
            await MyStorage.reportArchive.setValue(reportMeta);
            await MyStorage.setSourceReport(reportSource);
        }

        static retrieveSuccessInformation(doc, success) {
            const title = doc.getElementsByTagName("h2")[0].textContent.split(/-(.*)/)[1].trim();
            const tables = doc.querySelectorAll(".content_table");
            const table = tables[tables.length - 1];
            let expElements = table.querySelector("tr:nth-child(2)").querySelectorAll("td");
            const groupSize = expElements.length - 2;
            if (WoD.isSchlacht()) {
                success = success || {};
                if (!success.levels) success.levels = [1, 1];
                if (!success.members) success.members = ["?", groupSize];
                return success;
            }
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
        nurFavoriten = false;
        typeSelection = [];
        worldSelection;
        groupSelection;
        dungeonSelection;
        maxResults = 100;

        constructor() {
            this.dateMax;
            this.dateMin;
            this.worldSelection = [_WoD.getMyWorld()];
            this.groupSelection = [_WoD.getMyGroup()];
            this.dungeonSelection = [];
        }
    }

    class MainPage {
        static wodContent; // Kampfbericht-Inhalt
        static anchor; // hier wird der SeitenInhalt eingebettet
        static title;


        static async recreateReporting() {
            console.log("recreateReporting...");
            return;
            for (const report of await MyStorage.reportArchive.getAll()) {
                await MyStorage.reportArchive.deleteValue(report.reportId);
            }

            for (const report of await MyStorage.reportSourcesMeta.getAll()) {
                await MyStorage.reportArchive.setValue(report);
            }
            console.log("recreateReporting finished!");
        }

        static async migrate() {
            console.log("Start migration");

            await Maintenance.checkAllAutoFavoriten();

            if (false) {
                for (const oldReportId of await MyStorage.reportArchive.getAllKeys()) {
                    const report = await MyStorage.reportArchive.getValue(oldReportId);
                    report.reportId = "WA" + oldReportId;
                    await MyStorage.reportArchive.setValue(report);
                    await MyStorage.reportArchive.deleteValue(oldReportId);
                }

                for (const oldReportId of await MyStorage.reportArchiveSources.getAllKeys()) {
                    const reportSource = await MyStorage.reportArchiveSources.getValue(oldReportId);
                    reportSource.reportId = "WA" + oldReportId;
                    await MyStorage.reportArchiveSources.setValue(reportSource);
                    await MyStorage.reportArchiveSources.deleteValue(oldReportId);
                }
            }

            console.log("Start migration finished!");
        }

        static async resyncVersions() {
            console.log("resyncVersions...");
            for (const report of await MyStorage.reportArchive.getAll()) {
                delete report.locVersionId;
                delete report.locVersion;
                delete report.locVersionGuess;
                await Report.getVersion(report);
            }
            for (const report of await MyStorage.reportArchive.getAll()) {
                delete report.locVersionGuess;
                const result = await Report.getVersion(report);
            }
            console.log("resyncVersions finished!");
        }

        static async onKampfberichteSeite() {
            //await Maintenance.recalculateSpace();
            // await Maintenance.rewriteSourceFoundingsToMeta();
            // await Maintenance.syncCheck();
            await this.resyncVersions();
            await Maintenance.checkAllAutoFavoriten();
            // await this.syncCheck();
            // this.migrate(); return;
            // this.recreateReporting(); return;
            // MyStorage.reportRealSources.cloneTo(MyStorage.reportArchiveSources); return;
            //MyStorage.indexedDb.cloneTo("wodDB"); return;

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
                thisObject.title.appendChild(thisObject.statisticsButton);
                thisObject.title.appendChild(thisObject.settingButton);
            });
            this.archivButton.title = "Archiv anzeigen";
            this.statisticsButton = _UI.createButton(" 📊", async function () {
                thisObject.title.innerHTML = "Kampfberichte - Statistiken";
                await MainPage.showStatistics();
                thisObject.title.appendChild(thisObject.wodContentButton);
                thisObject.title.appendChild(thisObject.archivButton);
            });
            this.statisticsButton.title = "Statistik anzeigen";
            this.wodContentButton = _UI.createButton(" ↩", async function () {
                thisObject.title.innerHTML = "Kampfberichte";
                await MainPage.showWodOverview();
                thisObject.title.appendChild(thisObject.archivButton);
                thisObject.title.appendChild(thisObject.statisticsButton);
            });
            this.wodContentButton.title = "Zurück zu den Kampfberichten";
            this.settingButton = _UI.createButton(" ⚙", async function () {
                thisObject.title.innerHTML = "Kampfberichte - Archiv-Einstellungen";
                await MainPage.showSettings();
                thisObject.title.appendChild(thisObject.wodContentButton);
                thisObject.title.appendChild(thisObject.archivButton);
                thisObject.title.appendChild(thisObject.statisticsButton);
            });
            this.settingButton.style.fontSize = "14px";
            this.settingButton.title = "Einstellungen anzeigen";


            delete this.wodContentButton.style.fontSize;

            thisObject.title.appendChild(thisObject.archivButton);
            thisObject.title.appendChild(thisObject.statisticsButton);

            await this.completeDungeonInformations(false, this.wodContent);
            _UI.useJQueryUI().then(a => ArchivSearch.loadArchivView()); // preload
        }

        static async showWodOverview() {
            this.anchor.removeChild(this.anchor.children[0]);
            this.anchor.append(this.wodContent);
        }

        static async showStatistics() {
            this.anchor.removeChild(this.anchor.children[0]);
            const statTable = document.createElement("div");
            const dungeonStats = {}; // DungeonName -> Voller Erfolg / Teilerfolg / Misserfolg
            let memorySpace = 0;
            for (const report of await MyStorage.getReportDBMeta().getAll()) {
                let dungeonStat = dungeonStats[report.title];
                if (!dungeonStat) {
                    dungeonStat = {};
                    dungeonStats[report.title] = dungeonStat;
                    const location = await MyStorage.location.getValue(report.title);
                    dungeonStat.versions = location && location.versions ? Object.keys(location.versions).length : 0;
                }
                if (report.space) {
                    memorySpace += report.space;
                    dungeonStat.space = (dungeonStat.space || 0) + report.space;
                }
                if (report.fav) dungeonStat.fav = (dungeonStat.fav || 0) + 1;
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
            statTable.append(_UI.createContentTable([
                ["Anzahl Berichte", await MyStorage.reportArchive.count()],
                ["Anzahl Datensätze", await MyStorage.reportArchiveSources.count()],
                ["Belegter Speicher", _util.fromBytesToMB(memorySpace)],
            ]));

            const dungeonTableModell = [];
            for (const dungeonName of Object.keys(dungeonStats).sort()) {
                const dungeonStat = dungeonStats[dungeonName];
                dungeonTableModell.push([dungeonName, dungeonStat.versions, (dungeonStat.fav || 0), (dungeonStat.full || 0) + (dungeonStat.part || 0) + (dungeonStat.wipe || 0), dungeonStat.full || 0, dungeonStat.part || 0, dungeonStat.wipe || 0, _util.fromBytesToMB(dungeonStat.space)]);
            }
            statTable.append(_UI.createContentTable(dungeonTableModell, ["Dungeon", "Versionen", "Favoriten", "Gesamt", "Erfolg", "Teilerfolg", "Misserfolg", "Speicher"]));
            this.anchor.append(statTable);
        }

        static async showSettings() {
            this.anchor.removeChild(this.anchor.children[0]);
            const settingTable = document.createElement("div");
            this.anchor.append(settingTable);
        }

        /**
         * Erweitert den Dungeon-Table um eine weitere Spalte und liefert die Informationen welcher Content bereits aufgerufen wurde.
         * @param isArchiv ob dies ein Archiv-Aufruf ist oder nicht.
         */
        static async completeDungeonInformations(isArchiv, mainNode) {
            const reportDBMeta = await MyStorage.getReportDBMeta();
            const table = mainNode.classList.contains("content_table") ? mainNode : mainNode.getElementsByClassName("content_table")[0];
            const tbody = table.children[0];
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
            ueberschriftZiel.title = "Anteil der Charaktere die es erfolgreich bis ans Ende geschafft haben. (Alle / Teilweise / Keiner)";
            ueberschriftZiel.innerHTML = "Erfolg";
            ueberschriftZiel.style.width = "40px";
            const ueberschriftFortschritt = document.createElement("th");
            ueberschriftFortschritt.title = "Anteil aller erfolgreich besuchten Räume";
            ueberschriftFortschritt.innerHTML = "%";
            ueberschriftFortschritt.style.width = "10px";
            let curTR;
            let successWin = 0;
            let successTie = 0;
            let successLose = 0;
            let space = 0;
            for (var i = 1, l = tbody.children.length; i < l; i++) {
                curTR = tbody.children[i];
                curTR.style.borderTop = "2px solid #404040";
                const inputs = curTR.getElementsByTagName("input");
                let inputReportId;
                for (var k = 0, kl = inputs.length; k < kl; k++) {
                    const curInput = inputs[k];
                    if (curInput.name.startsWith("report_id")) {
                        inputReportId = curInput.value;
                        break;
                    }
                }
                if (!inputReportId) continue;
                let reportId = inputReportId;
                if (reportId.match(/^(\d)*$/)) { // besteht nur aus nummern, die Welt fehlt noch
                    const myWorld = _WoD.getMyWorld();
                    reportId = myWorld + reportId;
                }
                let reportMeta = await reportDBMeta.getValue(reportId);
                if (!reportMeta) {
                    reportMeta = {
                        reportId: reportId,
                        title: curTR.children[1].textContent.trim(),
                        ts: _WoD.getTimestampFromString(curTR.children[0].textContent.trim()),
                        gruppe: _WoD.getMyGroup(),
                        gruppe_id: _WoD.getMyGroupId(),
                        world: _WoD.getMyWorld(),
                    }
                    await MyStorage.reportArchive.setValue(reportMeta);
                }
                if (await Report.hasMoreThanOneVersion(reportMeta)) {
                    const nameTD = curTR.children[1];
                    const versionNr = await Report.getVersion(reportMeta);
                    if (versionNr) nameTD.innerHTML += " (Version " + versionNr + ")";
                    else nameTD.innerHTML += " (Version ?)";
                }

                const archiviertTD = document.createElement("td");
                archiviertTD.style.textAlign = "center";
                archiviertTD.style.width = "40px";
                const archiviertSpeicherTD = document.createElement("td");
                archiviertSpeicherTD.style.textAlign = "center";
                archiviertSpeicherTD.style.width = "40px";
                const hatDatensaetze = reportMeta.statistik || reportMeta.gegenstaende || reportMeta.levels;
                const archiviertAktionenTD = document.createElement("td");
                archiviertAktionenTD.style.textAlign = "center";
                archiviertAktionenTD.style.width = "40px";
                archiviertAktionenTD.style.padding = "0px";
                archiviertAktionenTD.style.fontSize = "18px";
                archiviertAktionenTD.style.whiteSpace = "nowrap";
                if (hatDatensaetze) {
                    if (isArchiv) {
                        const updateFavorit = function (curReportMeta) {
                            const istFavorit = curReportMeta.fav;
                            if (istFavorit) {
                                favoritButton.innerHTML = "★";
                                favoritButton.style.color = "yellow";
                            } else {
                                favoritButton.innerHTML = "☆";
                                favoritButton.style.color = "white";
                            }
                        }
                        const favoritButton = _UI.createButton("", async function () {
                            const curReportMeta = await MyStorage.reportArchive.getValue(reportId);
                            curReportMeta.fav = !curReportMeta.fav;
                            updateFavorit(curReportMeta);
                            await MyStorage.reportArchive.setValue(curReportMeta);
                        });
                        updateFavorit(reportMeta);
                        favoritButton.style.position = "relative";
                        favoritButton.style.top = "-2px";
                        favoritButton.style.fontSize = "20px";
                        favoritButton.title = "Datensatz favorisieren";
                        archiviertAktionenTD.append(favoritButton);
                    }

                    if (isArchiv) {
                        const saveButton = _UI.createButton("💾", async function () {
                            console.log("saveButton clicked");
                            await util.htmlExportFullReportAsZip(reportId);
                        });
                        saveButton.style.position = "relative";
                        saveButton.style.top = "-2px";
                        saveButton.style.fontSize = null;
                        saveButton.title = "Zum Exportieren aller geladener Berichte."; // was für Daten? auch Meta-Daten? oder nur Sources?
                        archiviertAktionenTD.append(saveButton);
                    }

                    if (isArchiv) {
                        const deleteButton = _UI.createButton("🌋", function () {
                        });
                        deleteButton.style.position = "relative";
                        deleteButton.style.top = "-2px";
                        deleteButton.style.fontSize = null;
                        deleteButton.title = "Löschen der Berichte. Die Meta-Daten bleiben erhalten."; // was für Daten? auch Meta-Daten? oder nur Sources?
                        archiviertAktionenTD.append(deleteButton);
                    }
                }
                const colorGreen = "rgb(62, 156, 62)";
                const colorRed = "rgb(203, 47, 47)";
                const colorYellow = "rgb(194, 194, 41)";
                if (!hatDatensaetze) {
                    archiviertTD.style.backgroundColor = colorRed;
                    archiviertAktionenTD.style.backgroundColor = colorRed;
                    archiviertSpeicherTD.style.backgroundColor = colorRed;
                    archiviertTD.innerHTML += "<span style='white-space: nowrap'>Fehlt komplett</span>";
                } else {
                    if (reportMeta.space) {
                        archiviertSpeicherTD.innerHTML = _util.fromBytesToMB(reportMeta.space);
                    }
                    const fehlend = Report.getMissingReportSites(reportMeta);
                    if (fehlend.length === 0) {
                        archiviertTD.style.backgroundColor = colorGreen;
                        archiviertSpeicherTD.style.backgroundColor = colorGreen;
                        archiviertAktionenTD.style.backgroundColor = colorGreen;
                        archiviertTD.innerHTML += "Komplett";
                        archiviertTD.style.whiteSpace = "nowrap";
                        archiviertTD.style.position = "relative";
                        if (reportMeta.favAuto) {
                            const favoritAuto = document.createElement("span");
                            favoritAuto.innerHTML = " ★";
                            favoritAuto.style.color = "lightblue";
                            archiviertTD.append(favoritAuto);
                        }
                    } else {
                        archiviertTD.style.backgroundColor = colorYellow;
                        archiviertSpeicherTD.style.backgroundColor = colorYellow;
                        archiviertAktionenTD.style.backgroundColor = colorYellow;
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

                if (reportMeta && reportMeta.space) {
                    space += reportMeta.space;
                }
                if (reportMeta && reportMeta.success) {
                    const members = reportMeta.success.members;
                    const rooms = reportMeta.success.rooms;
                    const levels = reportMeta.success.levels;
                    if (members) {
                        if (members[0] === members[1]) {
                            curTR.style.backgroundColor = colorGreen;
                            successWin++;
                        } else if (members[0] > 0) {
                            curTR.style.backgroundColor = colorYellow;
                            successTie++;
                        } else {
                            curTR.style.backgroundColor = colorRed;
                            successLose++;
                        }
                    } else if (reportMeta.success.levels) {
                        if (levels[0] !== levels[1]) {
                            curTR.style.backgroundColor = colorRed;
                            successLose++;
                        } else {
                            curTR.style.backgroundColor = "lightgreen";
                        }
                    }
                    if (rooms) {
                        const successRate = Math.round(100 * rooms[0] / rooms[1]);
                        if (members) {
                            zielTD.innerHTML = members[0] + "/" + members[1];
                        } else {
                            zielTD.innerHTML = "?";
                        }
                        fortschrittTD.innerHTML = successRate + "%";
                        fortschrittTD.title = rooms[0] + "/" + rooms[1];
                    } else {
                        zielTD.innerHTML = "?";
                        fortschrittTD.innerHTML = "?";
                    }
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

            ueberschriftSpeicher.innerHTML = "Speicher<br>" + "<span style='white-space: nowrap; font-size:12px;'>" + _util.fromBytesToMB(space) + "</span>";
            ueberschriftZiel.innerHTML = "Erfolg<br>" + "<span style='white-space: nowrap; font-size:12px;'>(" + successWin + " / " + successTie + " / " + successLose + ")</span>";
        }

    }

    class ArchivSearch {
        static archivView; // Such-Tabelle und Result
        static searchResultAnchor;

        static searchQuery;
        static nurFavoritenSelect;
        static typeSelect;
        static worldSelect;
        static groupSelect;
        static dungeonSelect;

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
            th.style.maxWidth = "300px";
            trHead.append(th);
            th.innerText = "Berichte";
            const allReports = await MyStorage.getReportDBMeta().getAll();
            allReports.sort((a, b) => b.ts - a.ts);
            let switcher = false;
            const thisObject = this;
            const primaryDate = new Date();
            primaryDate.setDate(primaryDate.getDate() - 14);
            const groupsFound = {};
            const groupsFoundPrimary = {};
            const worldsFound = {};
            const worldsFoundPrimary = {};
            const dungeonsFound = {};
            const dungeonsFoundPrimary = {};
            let count = 0;
            const maxResults = ArchivSearch.searchQuery.maxResults;
            for (const reportMeta of allReports) {
                if (!thisObject.isValidDate(reportMeta)) continue;
                if (!thisObject.isValidFavorit(reportMeta)) continue;
                if (!thisObject.isValidType(reportMeta)) continue;
                worldsFound[reportMeta.world] = true;
                if (thisObject.isValidDate(reportMeta, primaryDate)) worldsFoundPrimary[reportMeta.world] = true;
                if (!thisObject.isValidWorld(reportMeta)) continue;
                groupsFound[reportMeta.gruppe] = true;
                if (thisObject.isValidDate(reportMeta, primaryDate)) groupsFoundPrimary[reportMeta.gruppe] = true;
                if (!thisObject.isValidGroup(reportMeta)) continue;
                const locationTitle = await this.getFullLocationTitle(reportMeta);
                dungeonsFound[reportMeta.title] = locationTitle;
                if (thisObject.isValidDate(reportMeta, primaryDate)) dungeonsFoundPrimary[reportMeta.title] = locationTitle;
                if (!thisObject.isValidDungeon(reportMeta)) continue;
                if (maxResults && count >= maxResults) continue;
                count++;
                switcher = !switcher;
                const tr = document.createElement("tr");
                tr.className = switcher ? "row0" : "row1";
                tbody.append(tr);
                const dateTD = document.createElement("td");
                tr.append(dateTD);
                dateTD.innerText = _util.formatDateAndTime(reportMeta.ts);
                dateTD.style.textAlign = "center";
                const nameTD = document.createElement("td");
                tr.append(nameTD);
                nameTD.innerText = await this.getFullLocationTitle(reportMeta);
                const actionsTD = document.createElement("td");
                tr.append(actionsTD);
                actionsTD.style.textAlign = "center";
                ArchivSearch.createReportActions(reportMeta, actionsTD);
            }
            dungeonTH.innerText = "Dungeon (" + count + ")";
            this.updateDungeonSelector(dungeonsFound, dungeonsFoundPrimary);
            this.updateGroupSelector(groupsFound, groupsFoundPrimary);
            this.updateWorldSelector(worldsFound, worldsFoundPrimary);
            return table;
        }

        static quests = {
            "Rhanines Auftrag": [
                "Ein Tumult im Dorf",
                "Auf dem Weg zum Bauernhof",
                "Der Bauernhof",
                "Der Weg in den Wald",
                "Zur Kultstätte",
            ],
            "Ein Anfang": [
                "Das Wirtshaus am Wegesrand",
                "Der zweite Besuch im Wirtshaus",
                "Ein Picknick im Wald",
                "Die Höhle unter dem Wirtshaus",
                "Eine Siegesfeier im Wald",
                "Auf der Jagd",
                "Die Waldgnome",
                "Das Grab der Gnolle",
                "Die Karte der Orks",
                "Im Hauptquartier der Orks",
            ],
            "Ein einfacher Botengang": [
                "Auf nach Tiefenfels",
                "Der verwunschene Wald",
                "Durch den alten Wehrgang",
                "Die Gruft im verwunschenen Wald",
                "Weiter durch den Wald",
                "In den klagenden Sümpfen",
                "Der Turm",
                "Das Rattennest",
            ],
            "Die Pläne des Technikus": [
                "Auf nach Rabenfurth",
                "Verfolgung der Rattenmenschen",
                "Die Rattengrube",
                "Weiter nach Rabenfurth",
                "Durch den Wald",
                "Die Flasche",
                "Eine Bergtour",
                "Ein alter Turm auf dem Berg",
                "Und weiter in den Wald der Wichtel",
                "Der Abstieg",
                "Die letzte Etappe",
            ],
            "Die Schlacht bei Kargash Peak": [
                "Der Weg zur Schlacht bei Kargash Peak",
                "Im Norden der Schlacht",
                "Im Norden der Schlacht (äußerer Ring)",
                "Im Norden der Schlacht (innerer Ring)",
                "Im Westen der Schlacht",
                "Im Westen der Schlacht (äußerer Ring)",
                "Im Westen der Schlacht (innerer Ring)",
                "Im Osten der Schlacht",
                "Im Osten der Schlacht (äußerer Ring)",
                "Im Osten der Schlacht (innerer Ring)",
                "Im Süden der Schlacht",
                "Im Süden der Schlacht (äußerer Ring)",
                "Im Süden der Schlacht (innerer Ring)",
                "Im Zentrum der Schlacht",
                "Die Höhle",
                "Dank an die Helden",
            ],
            "Die Stadt der Verdammten": [
                "Ankunft in Stahlheim",
                "Erkundung zum Gutshof des Verdammten",
                "Zirkus der verlorenen Kinder",
                "Das Herrenhaus",
                "Das alte Gericht",
                "Das Bergwerk",
                "Das Heldengrab",
                "Die Lehmgrube",
                "Die Knochenzwillinge",
                "Verlassen von Stahlheim",
            ],
            "Jenseits des Abgrunds": [
                "Ein Dorf in Nöten",
                "Der Tauchgang",
                "Marsch auf dem Meeresgrund",
                "Die Jagd auf den Oktopus",
                "Nur ein Tauchgang",
                "Marsch über den Meeresgrund",
                "In der Eingangshalle",
                "Lug und Trug im Labor",
                "Die Schleuse",
                "Der finstere Gang",
                "Das bläuliche Tor",
                "Das grünliche Tor",
                "Das sandfarbene Tor",
                "Das dunke Herz",
                "Zurück ins Labor",
                "Der leere Thron",
                "Ein unerwartetes Wiedersehen",
                "Nachwuchs",
                "Jagd auf die Schatzjäger",
                "Die Flucht",
            ],
        }

        static getQuestFor(title) {
            for (const [groupName, groupEntries] of Object.entries(this.quests)) {
                if (groupEntries.includes(title)) return groupName;
            }
        }

        static async getFullLocationTitle(reportMeta) {
            if (reportMeta.schlacht) return reportMeta.schlacht + ": " + reportMeta.title.replaceAll("Eure Gruppe vs. ", "");
            const groupName = this.getQuestFor(reportMeta.title);
            if (groupName) return groupName + ": " + reportMeta.title;
            return reportMeta.title;
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
                this.dungeonSelect.innerHTML += "<option disabled>⎯⎯⎯⎯⎯⎯⎯⎯⎯ In den letzten 14 Tagen aktiv ⎯⎯⎯⎯⎯⎯⎯⎯⎯</option>";
                for (const [dungeonName, title] of Object.entries(dungeonsFoundPrimary).sort((a, b) => a[1].localeCompare(b[1]))) {
                    const selected = this.searchQuery.dungeonSelection.includes(dungeonName) ? "selected" : "";
                    this.dungeonSelect.innerHTML += "<option value='" + dungeonName + "' " + selected + ">" + title + "</option>";
                }
                this.dungeonSelect.innerHTML += "<option disabled>⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯</option>";
            }
            for (const [dungeonName, title] of Object.entries(dungeonsFound).sort((a, b) => a[1].localeCompare(b[1]))) {
                if (dungeonsFoundPrimary[dungeonName]) continue;
                const selected = this.searchQuery.dungeonSelection.includes(dungeonName) ? "selected" : "";
                this.dungeonSelect.innerHTML += "<option value='" + dungeonName + "' " + selected + ">" + title + "</option>";
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

        static updateWorldSelector(worldsFound, worldsFoundPrimary) {
            this.searchQuery.worldSelection.slice(0).forEach(name => {
                if (!worldsFound[name]) _util.arrayRemove(this.searchQuery.worldSelection, name);
            });
            let selected = this.searchQuery.worldSelection.length === 0 ? "selected" : "";
            this.worldSelect.innerHTML = "<option value='' " + selected + ">" + "</option>";

            if (Object.keys(worldsFoundPrimary).length > 0) {
                this.worldSelect.innerHTML += "<option disabled>⎯⎯⎯⎯⎯⎯⎯⎯⎯ In den letzten 14 Tagen aktiv ⎯⎯⎯⎯⎯⎯⎯⎯⎯</option>";
                for (const worldId of Object.keys(worldsFoundPrimary).sort()) {
                    const selected = this.searchQuery.worldSelection.includes(worldId) ? "selected" : "";
                    this.worldSelect.innerHTML += "<option value='" + worldId + "' " + selected + ">" + (this.worldValues[worldId] || worldId) + "</option>";
                }
                this.worldSelect.innerHTML += "<option disabled>⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯</option>";
            }
            for (const dungeonName of Object.keys(worldsFound).sort()) {
                if (worldsFoundPrimary[dungeonName]) continue;
                const selected = this.searchQuery.worldSelection.includes(dungeonName) ? "selected" : "";
                this.worldSelect.innerHTML += "<option value='" + dungeonName + "' " + selected + ">" + dungeonName + "</option>";
            }
        }

        static worldValues = {
            "WA": "Algarion",
            "WB": "Barkladesh",
            "WC": "Cartegon",
            "WD": "Darakesh",
            // Sandkasten??
            // Xerasia
        }

        static isValidFavorit(report) {
            if (!this.searchQuery.nurFavoriten) return true;
            return !!this.searchQuery.nurFavoriten === !!report.fav;
        }

        static isValidDate(report, dateMin) {
            dateMin = dateMin || this.searchQuery.dateMin;
            const dateMax = this.searchQuery.dateMax;

            const reportTime = report.ts;
            if (dateMax && dateMax.getTime() <= reportTime) return false;
            if (dateMin && dateMin.getTime() >= reportTime) return false;
            return true;
        }

        static isValidType(report) {
            if (this.searchQuery.typeSelection.length === 0) return true;
            const title = report.title;
            let type;
            if (report.schlacht) {
                type = "Schlacht";
            } else {
                const questName = this.getQuestFor(title);
                if (questName) {
                    type = "Quest";
                } else {
                    type = "Dungeon";
                }
            }

            return this.searchQuery.typeSelection.includes(type);
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

        static isValidWorld(report) {
            const selector = this.searchQuery.worldSelection;
            if (selector.length > 0) {
                if (!selector.includes(report.world)) return false;
            }
            return true;
        }

        static async loadArchivView() {
            this.archivView = document.createElement("div");
            this.searchQuery = new SearchQuery();
            this.searchResultAnchor = document.createElement("div");
            const searchTable = this.createSearchTable();
            this.archivView.append(searchTable);
            this.archivView.append(this.searchResultAnchor);
            await this.updateSearch();
        }

        static async showArchiv() {
            MainPage.anchor.removeChild(MainPage.anchor.children[0]);
            MainPage.anchor.append(this.archivView);
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
            datumRow.append(_UI.createButton("❌", function () {
                if (dateMinInput.value.trim() !== "") {
                    dateMinInput.value = "";
                    thisObject.searchQuery.dateMin = null;
                    ArchivSearch.updateSearch();
                }
            }));
            datumRow.append(" - ");
            datumRow.append(dateMaxInput);
            datumRow.append(_UI.createButton("❌", function () {
                if (dateMaxInput.value.trim() !== "") {
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

            this.nurFavoritenSelect = document.createElement("input");
            this.nurFavoritenSelect.onchange = async function () {
                thisObject.searchQuery.nurFavoriten = thisObject.nurFavoritenSelect.checked;
                ArchivSearch.updateSearch();
            }
            this.nurFavoritenSelect.type = "checkbox";
            content.push(["Nur Favoriten?", this.nurFavoritenSelect]);

            this.typeSelect = document.createElement("select");
            this.typeSelect.innerHTML += "<option></option>";
            this.typeSelect.innerHTML += "<option>Dungeon</option>";
            this.typeSelect.innerHTML += "<option>Quest</option>";
            this.typeSelect.innerHTML += "<option>Schlacht</option>";
            this.typeSelect.onchange = async function () {
                thisObject.searchQuery.typeSelection = [];
                var options = thisObject.typeSelect.selectedOptions;
                for (var i = 0, l = options.length; i < l; i++) {
                    const opt = options[i];
                    const value = opt.value || opt.text;
                    if (value === "") continue;
                    thisObject.searchQuery.typeSelection.push(value);
                }
                ArchivSearch.updateSearch();
            }
            content.push(["Typ", this.typeSelect]);

            this.worldSelect = document.createElement("select");
            this.worldSelect.onchange = async function () {
                thisObject.searchQuery.worldSelection = [];
                var options = thisObject.worldSelect.selectedOptions;
                for (var i = 0, l = options.length; i < l; i++) {
                    const opt = options[i];
                    const value = opt.value || opt.text;
                    if (value === "") continue;
                    thisObject.searchQuery.worldSelection.push(value);
                }
                ArchivSearch.updateSearch();
            }
            content.push(["Welt", this.worldSelect]);

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

            const lastRow = document.createElement("span");
            const maxResultsInput = document.createElement("span");
            maxResultsInput.innerHTML = "" + ArchivSearch.searchQuery.maxResults;
            lastRow.append(maxResultsInput);
            const aktualisierenButton = document.createElement("input");
            aktualisierenButton.type = "button";
            aktualisierenButton.value = "Aktualisieren";
            aktualisierenButton.onclick = async function () {
                await ArchivSearch.updateSearch();
            };
            lastRow.append(aktualisierenButton);
            content.push(["Max. Ergebnisse", lastRow]);

            searchTable.append(_UI.createTable(content));


            return searchTable;
        }

        static async updateSearch() {
            const resultTable = await ArchivSearch.query();
            this.searchResultAnchor.innerHTML = "";
            this.searchResultAnchor.append(resultTable);
            await MainPage.completeDungeonInformations(true, this.archivView);
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
            const mainContent = doc.getElementsByClassName("main_content")[0];
            // console.log("ShowSite: ", report, doc.getElementsByClassName("main_content"));
            const temp = document.createElement("div");
            temp.innerHTML = mainContent.outerHTML;
            MainPage.anchor.append(temp);
            MainPage.title.scrollIntoView();
            const statExecuter = this.getErweiterteKampfstatistikExecuter();
            if (statExecuter) await statExecuter(kampfbericht, kampfstatistik);
            let inputs = temp.getElementsByTagName("input");
            for (const elem of inputs) {
                if (elem.value === "Statistik" && !elem.previousElementSibling) { // dies ist bei Popups der Fall
                    const uebersicht = document.createElement("input");
                    uebersicht.value = "Übersicht";
                    uebersicht.type = "button";
                    uebersicht.className = "button clickable";
                    elem.parentElement.insertBefore(uebersicht, elem);
                }
            }
            inputs = temp.getElementsByTagName("input");
            for (const input of inputs) {
                if (input.name !== "disabled") {
                    const addOnclick = function (fn) {
                        if (fn) {
                            input.onclick = function (e) {
                                e.stopPropagation();
                                e.preventDefault();
                                fn();
                            };
                        } else {
                            input.className = "button_disabled";
                            input.onclick = function (e) {
                                e.stopPropagation();
                                e.preventDefault();
                            };
                        }
                    }
                    switch (input.value) {
                        case "Übersicht":
                            addOnclick(a => ArchivSearch.showArchiv());
                            break;
                        case "Statistik":
                            addOnclick(report.statistik ? a => ArchivSearch.showSite(report, report.statistik, false, true) : null);
                            break;
                        case "Gegenstände":
                            addOnclick(report.gegenstaende ? a => ArchivSearch.showSite(report, report.gegenstaende) : null);
                            break;
                        case "Bericht":
                            const level = report.levels && report.levels[0];
                            addOnclick(level ? a => ArchivSearch.showSite(report, level, true, false) : null);
                            break;
                        default:
                            const matches = input.value.match(/Level.*(\d+)/);
                            if (matches) {
                                const level = report.levels && report.levels[matches[1] - 1];
                                addOnclick(level ? a => ArchivSearch.showSite(report, level, true, false) : null);
                            }
                            break;
                    }
                }
            }

        }

        static createReportActions(reportMeta, result) {
            let reportSource_;
            const getReportSource = async function () {
                if (!reportSource_) {
                    reportSource_ = await MyStorage.getSourceReport(reportMeta.reportId);
                    if (!reportSource_) console.error("ReportSources not found: " + reportMeta.reportId);
                }
                return reportSource_;
            }

            /**
             * Dieses versteckte Feld wird benötigt, damit die Tabelle genau wie der WoD-Report-Table aussieht und abgearbeitet werden kann.
             * Hier wird die Report-Id für die Zeile nämlich abgelegt.
             */
            const reportId = document.createElement("input");
            result.append(reportId);
            reportId.value = reportMeta.reportId;
            reportId.type = "hidden";
            reportId.name = "report_id[0]";

            const statistik = document.createElement("input");
            result.append(statistik);
            statistik.value = "Statistik";
            statistik.type = "submit";
            statistik.className = reportMeta.statistik ? "button clickable" : "button_disabled";
            statistik.onclick = async function (e) {
                e.preventDefault();
                const reportSource = await getReportSource();
                if (reportSource.statistik) ArchivSearch.showSite(reportSource, reportSource.statistik, false, true);
            }

            const gegenstaende = document.createElement("input");
            result.append(gegenstaende);
            gegenstaende.value = "Gegenstände";
            gegenstaende.type = "submit";
            gegenstaende.className = reportMeta.gegenstaende ? "button clickable" : "button_disabled";
            gegenstaende.onclick = async function (e) {
                e.preventDefault();
                const reportSource = await getReportSource();
                if (reportSource.gegenstaende) ArchivSearch.showSite(reportSource, reportSource.gegenstaende);
            }

            const bericht = document.createElement("input");
            result.append(bericht);
            bericht.value = "Bericht";
            bericht.type = "submit";
            bericht.className = reportMeta.levels ? "button clickable" : "button_disabled";
            bericht.onclick = async function (e) {
                e.preventDefault();
                const reportSource = await getReportSource();
                if (reportSource.levels) ArchivSearch.showSite(reportSource, reportSource.levels[0], true, false);
            }

            return result;
        }

    }

    class Maintenance {

        static async recalculateSpace() {
            console.log("recalculateSpace... start");
            for (const report of await MyStorage.reportArchive.getAll()) {
                const reportSource = await MyStorage.reportArchiveSources.getValue(report.reportId);
                const space = reportSource ? _util.getSpace(reportSource) : 0;
                if (report.space !== space) {
                    report.space = space;
                    await MyStorage.reportArchive.setValue(report);
                }
            }
            console.log("recalculateSpace... finished!");
        }

        /**
         * Aktualisiert .statistik, .gegenstaende, .levels
         */
        static async rewriteSourceFoundingsToMeta() {
            console.log("rewriteSourceFoundingsToMeta... start");
            for (const report of await MyStorage.reportArchive.getAll()) {
                const reportSource = await MyStorage.reportArchiveSources.getValue(report.reportId) || {};
                report.statistik = !!reportSource.statistik;
                report.gegenstaende = !!reportSource.gegenstaende;
                if (!reportSource.levels) {
                    delete report.levels;
                } else {
                    report.levels = [];
                    for (let i = 0, l = reportSource.levels.length; i < l; i++) {
                        report.levels[i] = !!reportSource.levels[i];
                    }
                }
                await MyStorage.reportArchive.setValue(report);
            }
            console.log("rewriteSourceFoundingsToMeta... finished!");
        }

        static async syncCheck() {
            console.log("Start sync check!");
            let failures = 0;
            for (const reportId of await MyStorage.reportArchive.getAllKeys()) {
                let reportSource = await MyStorage.reportArchiveSources.getValue(reportId);
                const reportMeta = await MyStorage.reportArchive.getValue(reportId);
                if (!reportSource) {
                    if (reportMeta.space && reportMeta.space > 0) {
                        console.log("ReportMeta-Fehler: " + reportId + " Space: " + reportMeta.space + " != 0");
                        failures++;
                    }
                    reportSource = {};
                } else {
                    const space = _util.getSpace(reportSource);
                    if (reportMeta.space !== space) {
                        console.error("ReportMeta-Fehler: " + reportId + " Space: " + reportMeta.space + " != " + space);
                        failures++;
                    }
                }
                if (!!reportMeta.statistik !== !!reportSource.statistik) {
                    console.error("ReportMeta-Fehler: " + reportId + " Statistik: " + !!reportMeta.statistik + " != " + !!reportSource.statistik);
                    failures++;
                }
                if (!!reportMeta.gegenstaende !== !!reportSource.gegenstaende) {
                    console.error("ReportMeta-Fehler: " + reportId + " Gegenstände: " + !!reportMeta.statistik + " != " + !!reportSource.statistik);
                    failures++;
                }
                if (!!reportMeta.levels !== !!reportSource.levels) {
                    console.error("ReportMeta-Fehler: " + reportId + " LevelsExist: " + !!reportMeta.levels.length + " != " + !!reportSource.levels.length);
                    failures++;
                } else if (reportMeta.levels) {
                    if (reportMeta.levels.length !== reportSource.levels.length) {
                        console.error("ReportMeta-Fehler: " + reportId + " LevelLength: " + !!reportMeta.levels.length + " != " + !!reportSource.levels.length);
                        failures++;
                    }
                    for (let i = 0, l = reportMeta.levels.length; i < l; i++) {
                        const levelSource = reportSource.levels[i];
                        const levelMeta = reportMeta.levels[i];
                        if (!!levelSource !== !!levelMeta) {
                            console.error("ReportMeta-Fehler: " + reportId + " Level: " + !!levelMeta + " != " + !!levelSource);
                            failures++;
                        }
                    }
                }
            }
            console.log("Sync check beendet! Fehler gefunden: " + failures);
        }

        /**
         * Überprüft alle Dungeon Auto-Favoriten.
         */
        static async checkAllAutoFavoriten() {
            await this.checkAutoFavoriten(await MyStorage.reportArchive.getAll());
        }

        /**
         * Überprüft den Auto-Favoriten für den angegebenen Dungeon und Gruppe.
         */
        static async updateAutoFavoritenFor(report) {
            const reports = (await MyStorage.reportArchive.getAll()).filter(current => current.title === report.title && current.gruppe_id === report.gruppe_id);
            await this.checkAutoFavoriten(reports);
        }

        /**
         * Auto-Favoriten pro Gruppe und Dungeon und Version.
         */
        static async checkAutoFavoriten(reports) {
            const favorites = {};
            const getIds = async function (report, debug) {
                const myVersions = await Report.getVersions(report);
                if (!myVersions || myVersions.length === 0) return [];
                const result = [];
                for (const version of myVersions) {
                    result.push(report.gruppe_id + ";" + report.title + ";" + version);
                }
                return result;
            }
            for (const report of reports) {
                if (!Report.isVollstaendig(report)) continue; // nur Reports, wo alle erreichten Level gespeichert wurden
                const ids = await getIds(report, true);
                if (!ids) continue;
                for (const id of ids) {
                    const lastFavorit = favorites[ids];
                    if (lastFavorit) {
                        favorites[ids] = this.checkPrefer(lastFavorit, report);
                    } else {
                        favorites[ids] = report;
                    }
                }
            }
            for (const report of reports) {
                const ids = await getIds(report);
                let isAutoFavorit = false;
                if (ids) {
                    for (const id of ids) {
                        if (favorites[ids] ? (favorites[ids].reportId === report.reportId) : false) {
                            isAutoFavorit = true;
                            break;
                        }
                    }
                }
                if (report.favAuto !== isAutoFavorit) {
                    if (isAutoFavorit) {
                        report.favAuto = true;
                    } else {
                        delete report.favAuto;
                    }
                    await MyStorage.reportArchive.setValue(report);
                }
            }
        }

        /**
         * Welcher der beiden Report überwiegt als Auto-Favorit?
         */
        static checkPrefer(report1, report2) {
            // Größere Memberzahl gewinnt
            const members1 = report1.success.members[1];
            const members2 = report2.success.members[1];
            if (members1 !== members2) return members1 > members2 ? report1 : report2;
            // Größere Levelzahl gewinnt
            const levels1 = report1.success.levels[1];
            const levels2 = report2.success.levels[1];
            if (levels1 !== levels2) return levels1 > levels2 ? report1 : report2;
            // Größere Anzahl an geschafften Räumen gewinnt
            const success1 = Report.getSuccessRoomRate(report1);
            const success2 = Report.getSuccessRoomRate(report2);
            if (success1 !== success2) return success1 > success2 ? report1 : report2;
            // Der neuere Report gewinnt
            return report1.ts > report2.ts ? report1 : report2;
        }

    }

    class Report {

        static getSuccessRoomRate(report) {
            if (!report.success || !report.success.rooms) return 0;
            return report.success.rooms[0] / report.success.rooms[1];
        }

        /**
         * Prüft, ob die Sourcen für den Dungeon vollständig vorhanden sind.
         * onlyFullSuccess 'true': es müssen alle Level geladen sein
         * onlyFullSuccess 'false': es müssen die Level geladen sein, die man auch erreicht hat.
         */
        static isVollstaendig(report, onlyFullSuccess) {
            if (!report.statistik || !report.gegenstaende || !report.levels || !report.success) return false;
            return this.getMissingReportSites(report, onlyFullSuccess).length === 0;
        }

        static getMissingReportSites(report, onlyFullSuccess) {
            const fehlend = [];
            if (!report.statistik) fehlend.push("S");
            if (!report.gegenstaende) fehlend.push("G");
            if (!report || !report.success || !report.levels) {
                fehlend.push("Lx");
            } else {
                let maxLevel = report.success.levels[1];
                let successLevels = report.success.levels[0];
                if (!onlyFullSuccess && successLevels) maxLevel = successLevels; // evtl. nicht erfolgreich, dann müssen auch nicht alle angefordert sein
                for (var i = 0, l = maxLevel; i < l; i++) {
                    if (!report.levels[i]) fehlend.push("L" + (i + 1));
                }
            }
            return fehlend;
        }

        static async getVersion(report) {
            return (await this.getVersions(report)).join(" | ");
        }

        static async getVersions(report) {
            if (report.locVersion) return [report.locVersion];
            if (report.schlacht) return [1];
            // Es muss mindestens der letzte Level auch besucht worden sein.
            if (!report || !report.success || !report.levels || !report.success.levels) return [];
            if (report.locVersionId) {
                const location = await MyStorage.location.getValue(report.title) || {name: report.title};
                return await Location.guessVersionById(location, report.locVersionId);
            }

            const reportSource = await MyStorage.reportArchiveSources.getValue(report.reportId);
            if (!reportSource) return [];
            const location = await MyStorage.location.getValue(report.title) || {name: report.title};
            if ((report.success.levels[1] > report.success.levels[0] + 1) || !this.isVollstaendig(report, true)) {
                // Unvollständiger Dungeon wir haben nicht alle Level: wir versuchen zu raten
                const versionId = this.getVersionId(report, reportSource);
                report.locVersionId = versionId;
                await MyStorage.reportArchive.setValue(report);
                return await Location.guessVersionById(location, versionId);
            }
            // wir haben alle Level geladen
            const versionNr = await Location.getVersionById(location, this.getVersionId(report, reportSource));
            report.locVersion = versionNr;
            await MyStorage.reportArchive.setValue(report);
            return [versionNr];
        }

        static getVersionId(report, reportSource) {
            const versionId = [];
            for (const level of reportSource.levels) {
                const doc = _util.getDocumentFor(level);
                const navLevels = doc.getElementsByClassName("navigation levels")[0];
                if (navLevels) {
                    const ueberschrift = navLevels.parentElement.getElementsByTagName("h3")[0].textContent;
                    versionId.push(ueberschrift);
                }
            }
            if (report.success.levels[1] > reportSource.levels.length) {
                versionId.push("X_X"); // Markierung, dass es noch keine finale Versionskennzeichnung ist
            }
            return versionId;
        }

        static async hasMoreThanOneVersion(report) {
            const location = await MyStorage.location.getValue(report.title);
            if (!location || !location.versions) return false;
            return Object.keys(location.versions).length > 1;
        }

    }

    class Location {

        static async getVersionById(location, versionIdArray) {
            const versions = location.versions || (location.versions = {});
            const versionIdString = this.getVersionIdString(versionIdArray);
            let result = versions[versionIdString];
            if (result) return result; // eindeutig zugewiesen

            const matchingVersions = this.getMatchingVersions(location, versionIdString, true);
            if (matchingVersions && matchingVersions.length > 0) {
                const preregistrationId = matchingVersions[0][0];
                const preregistrationNr = matchingVersions[0][1];
                if (versionIdString.length > preregistrationId.length) {
                    delete versions[preregistrationId];
                    versions[versionIdString] = preregistrationNr;
                    await MyStorage.location.setValue(location);
                }
                return preregistrationNr;
            } else {
                result = Object.keys(versions).length + 1;
                versions[versionIdString] = result;
                if (location.name === "Ahnenforschung") {
                    console.log("getVersionById-Add: ", result, versionIdArray, versionIdString);
                }
                await MyStorage.location.setValue(location);
                return result;
            }
        }

        /**
         * Wir haben nicht alle Level Daten aber wir versuchen aus den bekannten Versionen abzuleiten
         */
        static async guessVersionById(location, incompleteVersionIdArray) {
            const versions = location.versions || (location.versions = {});
            const versionIdString = this.getVersionIdString(incompleteVersionIdArray);
            const results = [];
            const matchingVersions = this.getMatchingVersions(location, versionIdString, false);
            if (matchingVersions.length === 0) {
                const newVersionNr = Object.keys(versions).length + 1;
                versions[versionIdString] = newVersionNr;
                if (location.name === "Ahnenforschung") {
                    console.log("guessVersionById-Add: ", newVersionNr, incompleteVersionIdArray, versionIdString);
                }
                await MyStorage.location.setValue(location);
                results.push(newVersionNr);
            } else if (matchingVersions.length === 1) {
                if (versionIdString.length > matchingVersions[0][0].length) {
                    delete versions[matchingVersions[0][0]];
                    versions[versionIdString] = matchingVersions[0][1];
                    await MyStorage.location.setValue(location);
                }
                results.push(matchingVersions[0][1]);
            } else {
                for (const [id, versionNr] of matchingVersions) {
                    results.push(versionNr);
                }
            }
            return results;
        }

        static getMatchingVersions(location, versionIdString, exactMatch) {
            versionIdString = versionIdString.replaceAll(/\|X_X$/g, "");
            const results = [];
            for (const [id, versionNr] of Object.entries(location.versions)) {
                const cleanedVersionId = id.replaceAll(/\|X_X$/g, "");
                if ((!exactMatch && (cleanedVersionId.startsWith(versionIdString) || versionIdString.startsWith(cleanedVersionId)))
                    || (exactMatch && versionIdString.startsWith(cleanedVersionId))) {
                    results.push([id, versionNr]);
                }
            }
            return results;
        }

        static getVersionIdString(versionIdArray) {
            return versionIdArray.join("|");
        }

    }

    class MyStorage {
        static indexedDb = new Storages.IndexedDb("WoDReportArchiv", Mod.dbname); // Mod.dbname
        static reportArchive = this.indexedDb.createObjectStore("reportArchive", "reportId");
        static reportArchiveSources = this.indexedDb.createObjectStore("reportArchiveSources", "reportId");
        static location = this.indexedDb.createObjectStore("location", "name");
        static locationGroup = this.indexedDb.createObjectStore("locationGroup", "name");

        // static deletelkshflsdf = this.indexedDb.deleteObjectStore("reportSources");

        static getReportDBMeta() {
            return this.reportArchive;
        }

        static async getSourceReport(reportId) {
            return await this.reportArchiveSources.getValue(reportId);
        }

        static async setSourceReport(report) {
            await this.reportArchiveSources.setValue(report);
        }

    }

    class WoD {
        static isSchlacht() {
            return _util.getWindowPage() === "combat_report.php";
        }

        // Types: Dungeon/Quest, Schlacht-Report, Duell (Solo, Gruppe, Duell)
        // wod/spiel/clanquest/combat_report.php?battle=8414&report=59125 (battle scheint nicht relevant zu sein!? Seite kann auch so aufgerufen werden)
        // wod/spiel/tournament/duell.php
        static getFullReportBaseData(doc) {
            doc = doc || document;
            const form = doc.getElementsByName("the_form")[0];
            const titleSplit = doc.getElementsByTagName("h2")[0].textContent.split(/-(.*)/);
            const title = titleSplit[1].trim();
            const ts = _WoD.getTimestampFromString(titleSplit[0].trim());
            let reportId;
            let schlacht;
            if (form["report_id[0]"]) {
                reportId = form["report_id[0]"].value;
            } else if (form["report"]) {
                reportId = form["report"].value;
                schlacht = "Unbekannte Schlacht";
                const schlachtLink = document.querySelector("h1 a");
                if (schlachtLink) schlacht = schlachtLink.textContent.trim();
            }
            const myWorld = _WoD.getMyWorld();
            return {
                reportId: myWorld + reportId,
                id: reportId,
                world: myWorld,
                ts: ts,
                title: title, // Bei einem Dungeon z.B. der Dungeonname
                gruppe: _WoD.getMyGroup(),
                gruppe_id: _WoD.getMyGroupId(),
                schlacht: schlacht,
            };
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

        /**
         * Versucht soweit alle Elemente die nicht zum Main-Content gehören rauszufiltern.
         * Stellt sicher, dass alle URLs relativ zur Domain definiert sind.
         */
        static getPlainMainContent() {
            const myDocument = document.cloneNode(true);

            const remove = node => {
                if (node) node.parentElement.removeChild(node);
            }
            remove(myDocument.getElementById("gadgettable-left-td")); // existiert in nem Popup nicht
            remove(myDocument.getElementById("gadgettable-right-td")); // existiert in nem Popup nicht
            let mainContent = myDocument.getElementsByClassName("gadget main_content")[0];
            if (mainContent) {
                util.forEachSafe(mainContent.parentElement.children, cur => {
                    if (cur !== mainContent) remove(cur);
                });
            }

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

            // Stellt sicher, dass auch immer der Pfad mit bei einer URL-Angabe mit dabei ist.
            // Wenn die Datei exportiert wird, wird die Pfadangabe ja ebenfalls "vergessen".
            this.ensureAllUrlsHavePathname(myDocument);

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
                if (url.startsWith("http") || url.startsWith("/") || url.startsWith("data:")) return url;
                // Übrig bleiben alle relativ definierten Pfade. Hier müssen wir den Pfad auch anhängen
                return path + "/" + url;
            })
        }

        /**
         * Stellt sicher, dass alle gängigen URLs absolut definiert sind.
         * Wenn man direkt .href und .src anspricht geben diese immer den vollen Pfad zurück.
         */
        static ensureAllUrlsAreAbsolute(myDocument) {
            util.forEach(myDocument.getElementsByTagName("a"), a => {
                const value = converter(a.getAttribute("href"));
                if (value) a.href = a.href;
            });

            util.forEach(myDocument.getElementsByTagName("img"), a => {
                const value = converter(a.getAttribute("src"));
                if (value) a.src = a.src;
            });

            util.forEach(myDocument.getElementsByTagName("script"), a => {
                const value = converter(a.getAttribute("src"));
                if (value) a.src = a.src;
            });

            util.forEach(myDocument.getElementsByTagName("link"), a => {
                const value = converter(a.getAttribute("href"));
                if (value) a.href = a.href;
            });
        }


        static rewriteAllUrls(myDocument, converter) {
            util.forEach(myDocument.getElementsByTagName("a"), a => {
                const value = converter(a.getAttribute("href"));
                if (value) a.href = value;
            });

            util.forEach(myDocument.getElementsByTagName("img"), a => {
                const value = converter(a.getAttribute("src"));
                if (value) a.src = value;
            });

            util.forEach(myDocument.getElementsByTagName("script"), a => {
                const value = converter(a.getAttribute("src"));
                if (value) a.src = value;
            });

            util.forEach(myDocument.getElementsByTagName("link"), a => {
                const value = converter(a.getAttribute("href"));
                if (value) a.href = value;
            });
        }

        static htmlExport() {
            const myDocument = this.getPlainMainContent();

            var fileName;
            var curElement = myDocument.getElementsByName("current_level")[0];
            if (curElement) {
                fileName = "Level" + curElement.value;
            } else {
                curElement = myDocument.getElementsByName("disabled")[0];
                if (!curElement) curElement = myDocument.getElementsByClassName("button_disabled")[0];
                fileName = curElement.value.replace("ä", "ae");
            }

            this.forDownload(fileName + ".html", this.getHtmlForExport(myDocument));
        }

        /**
         * Arbeitet den Knoten/das Dokument so um, dass es auch ausserhalb der WoD-Domain aufgerufen werden können.
         * Im speziellen werden hier auch die Links der Kampfbericht-Seite entsprechend umgebogen.
         */
        static getHtmlForExport(nodeOrDocument) {
            let myDocument = nodeOrDocument.cloneNode(true);

            // wir können ensureAllUrlsAreAbsolute scheinbar nicht nutzen, wenn man das Dokument on-the-fly aus einem String erzeugt.
            this.rewriteAllUrls(myDocument, url => {
                if (!url) return url;
                if (url === "") return "";
                if (url.startsWith("http") || url.startsWith("data:")) return url;
                if (url.startsWith("/")) return window.location.protocol + "//" + window.location.host + url;
                return window.location.protocol + "//" + window.location.host + "/wod/spiel/dungeon/" + url; // Annahme gilt nur für die Kampfberichte.
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
                if (a.parentElement.children[0].value === "Übersicht") { // im Popup gibt es keine Übersicht
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

            myDocument.documentElement.outerHTML
            if (myDocument.documentElement) {
                myDocument = myDocument.documentElement;
            }
            return myDocument.outerHTML;
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

        static async htmlExportFullReportAsZip(reportId) {
            const zip = await _File.getJSZip();
            const reportSources = await MyStorage.getSourceReport(reportId);
            const reportMeta = await MyStorage.reportArchive.getValue(reportId);

            function addHTML(filename, wodData) {
                const myDocument = _util.getDocumentFor(wodData);
                const exportData = util.getHtmlForExport(myDocument);
                zip.file(filename, exportData);
            }

            if (reportSources.statistik) addHTML("Statistik.html", reportSources.statistik);
            if (reportSources.gegenstaende) addHTML("Gegenstaende.html", reportSources.gegenstaende);
            if (reportSources.levels) {
                for (let i = 0, l = reportSources.levels.length; i < l; i++) {
                    const level = reportSources.levels[i];
                    addHTML("Level" + (i + 1) + ".html", level);
                }
            }
            console.log("will create zip", zip);
            const downloadFileName = reportMeta.gruppe + "_" + reportMeta.title + "_" + _util.formatDateAndTime(new Date(reportMeta.ts)).replaceAll(".", "_") + ".zip";
            zip.generateAsync({type: "blob"}).then(function (content) {
                console.log("File is ready!");
                _File.forDownload(downloadFileName, content);
            }).catch(error => console.error("Zip-Erro: ", error));
        }

    }

    Mod.startMod();

})();