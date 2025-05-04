// ==UserScript==
// @name           [WoD] Kampfbericht Archiv
// @namespace      demawi
// @description    Lässt einen die Seiten der Kampfberichte direkt downloaden
// @version        0.10
// @include        https://*/wod/spiel/*dungeon/report.php*
// @include        https://*/wod/spiel/clanquest/combat_report.php*
// @include        https://*/wod/spiel/clanquest/move.php*
// @require        https://raw.githubusercontent.com/demawi/WoD-Mods/refs/heads/master/repo/DemawiRepository.js?version=1.0.4
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

    const _Storages = demawiRepository.import("Storages");
    const _WoD = demawiRepository.import("WoD");
    const _WoDGroupDb = demawiRepository.import("WoDGroupDb");
    const _WoDParser = demawiRepository.import("WoDParser");
    const _WoDLootDb = demawiRepository.import("WoDLootDb");
    const _util = demawiRepository.import("util");
    const _UI = demawiRepository.import("UI");
    const _File = demawiRepository.import("File");
    const _Libs = demawiRepository.import("Libs");

    class Mod {
        static dbname = "wodDB";
        static modname = "KampfberichtArchiv";

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

            const reportData = _WoD.getFullReportBaseData();
            const reportMeta = await MyStorage.reportArchive.getValue(reportData.reportId) || reportData;
            if (!reportMeta.group_season) {
                const heroIds = WoD.getAllHeroIds();
                const groupId = _WoD.getMyGroupId();
                const groupName = _WoD.getMyGroupName();
                reportMeta.group_season = await _WoDGroupDb.getSeasonForGroup(groupId, groupName, heroIds);
            }
            if (!reportMeta.schlacht) reportMeta.schlacht = reportData.schlacht; // kommt evtl. nachträglich erst herein
            if (!reportMeta.stufe) reportMeta.stufe = reportData.stufe;
            const reportSource = await MyStorage.getSourceReport(reportData.reportId) || {reportId: reportData.reportId};
            console.log("Current Report ", reportData, reportMeta, reportSource);

            if (title.textContent.trim().startsWith("Kampfstatistik")) {
                reportSource.statistik = util.getPlainMainContent().documentElement.outerHTML;
                reportMeta.statistik = true;
                reportMeta.success = _WoDParser.retrieveSuccessInformationOnStatisticPage(document, reportMeta.success);
            } else if (title.textContent.trim().startsWith("Übersicht Gegenstände")) {
                reportSource.gegenstaende = util.getPlainMainContent().documentElement.outerHTML;
                reportMeta.gegenstaende = true;
                const memberList = _WoDParser.parseKampfberichtGegenstaende();
                const reportExt = await MyStorage.putToExt(reportSource.reportId, memberList);
                await MyStorage.submitLoot(reportMeta, reportExt);
                if ((await Settings.get()).lootSummary) await ItemLootSummary.einblenden(memberList);
            } else if (title.textContent.trim().startsWith("Kampfbericht")) {
                const form = _WoD.getMainForm();
                const levelNr = _WoD.isSchlacht() ? 1 : form.current_level.value;
                let navigationLevels = document.getElementsByClassName("navigation levels")[0];
                if (navigationLevels) {
                    let successReport = reportMeta.success;
                    if (!successReport) {
                        successReport = {};
                        reportMeta.success = successReport;
                    }
                    if (!reportMeta.success.levels) reportMeta.success.levels = {};
                    reportMeta.success.levels[1] = navigationLevels.children.length - 1;
                }
                if (!reportSource.levels) reportSource.levels = [];
                if (!reportMeta.levels) reportMeta.levels = [];
                reportSource.levels[levelNr - 1] = util.getPlainMainContent().documentElement.outerHTML;
                reportMeta.levels[levelNr - 1] = true;

                const heldenListe = _WoDParser.getHeldenstufenOnKampfbericht();
                if (heldenListe) {
                    const reportExt = await MyStorage.putToExt(reportMeta.reportId, heldenListe);
                    await MyStorage.submitLoot(reportMeta, reportExt);
                }

                if (_WoD.isSchlacht()) {
                    const gewonnen = document.getElementsByClassName("rep_room_end")[0].textContent === "Die Angreifer haben gesiegt!";
                    let success = reportMeta.success || {};
                    success.rooms = [gewonnen ? 1 : 0, 1];
                    success.levels = [gewonnen ? 1 : 0, 1];
                    reportMeta.success = success;

                    const lastActionHeroes = _WoDParser.getLastHeroTableOnKampfbericht();
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
                }
            }
            reportMeta.space = _util.getSpace(reportSource);
            await MyStorage.reportArchive.setValue(reportMeta);
            await MyStorage.setSourceReport(reportSource);

            if (Report.isVollstaendig(reportMeta)) await AutoFavorit.recheckAutoFavoritenForReport(reportMeta);
        }

    }

    class FilterQuery {
        static FAVORIT_MANUELL = "Manuell";
        static FAVORIT_AUTO_ALL = "Auto (gruppenübergreifend)";
        static FAVORIT_AUTO_GROUP = "Auto (Je Gruppe)";

        dateMin;
        dateMax;
        nurFavoriten = [];
        typeSelection = [];
        worldSelection;
        groupSelection;
        dungeonSelection;
        maxResults = 100;

        constructor() {
            this.dateMax;
            this.dateMin;
            this.worldSelection = [_WoD.getMyWorld()];
            this.groupSelection = [_WoD.getMyGroupName()];
            this.dungeonSelection = [];
        }
    }

    class MainPage {
        static wodContent; // Kampfbericht-Inhalt
        static anchor; // hier wird der SeitenInhalt eingebettet
        static title;
        static COLOR_GREEN = "rgb(62, 156, 62)";
        static COLOR_RED = "rgb(203, 47, 47)";
        static COLOR_YELLOW = "rgb(194, 194, 41)";
        static PAGE_TYPE_STAT = "Statistik";
        static PAGE_TYPE_ITEMS = "Items";
        static PAGE_TYPE_REPORT = "Berichtseite";

        static async recreateReporting() {
            console.log("recreateReporting...");
            return;
            for (const report of await MyStorage.reportArchive.getAll()) {
                await MyStorage.reportArchive.deleteValue(report.reportId);
            }

            for (const report of await MyStorage.reportSourcesMeta.parse()) {
                await MyStorage.reportArchive.setValue(report);
            }
            console.log("recreateReporting finished!");
        }

        static async migrate() {
            console.log("Start migration");

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
                await MyStorage.reportArchive.setValue(report);
            }
            for (const report of await MyStorage.reportArchive.getAll()) {
                delete report.locVersionGuess;
                const result = await Report.getVersion(report);
            }
            console.log("resyncVersions finished!");
        }

        static async recallVersions() {
            console.log("recallVersions...");
            for (const report of await MyStorage.reportArchive.getAll()) {
                const result = await Report.getVersion(report);
            }
            console.log("recallVersions finished!");
        }

        static async checkMaintenance() {
            const settings = await Settings.get();

            // Zuerst Auto-Favoriten erst dann Löschen
            if (settings.updateAutoFavoritAll) {
                await AutoFavorit.checkAutoFavoritenForTagName(AutoFavorit.TAG_ALL, !settings.autoFavoritAll);
                delete settings.updateAutoFavoritAll;
                await Settings.save();
            }
            if (false && settings.updateAutoFavoritAllSeason) {
                //await AutoFavorit.checkAutoFavoriten(AutoFavorit.TAG_ALL_SEASON, !settings.autoFavoritAllSeason);
                delete settings.updateAutoFavoritAllSeason;
                await Settings.save();
            }
            if (settings.updateAutoFavoritGroup) {
                await AutoFavorit.checkAutoFavoritenForTagName(AutoFavorit.TAG_GROUP, !settings.autoFavoritGroup);
                delete settings.updateAutoFavoritGroup;
                await Settings.save();
            }
            if (false && settings.updateAutoFavoritGroupSeason) {
                //await AutoFavorit.checkAutoFavoriten(AutoFavorit.TAG_GROUP_SEASON, !settings.autoFavoritGroupSeason);
                delete settings.updateAutoFavoritGroupSeason;
                await Settings.save();
            }
            if (settings.autoLoeschen && !settings.autoLoeschenDate || new Date(settings.autoLoeschenDate) < new Date().setDate(new Date().getDate() - 1)) {
                console.log("Auto Löschen wird ausgeführt!");
                settings.autoLoeschenDate = new Date().getTime();
                await Settings.save();
            }
        }

        static async rewriteExt() {
            for (const reportSource of await MyStorage.reportArchiveSources.getAll()) {
                if (reportSource.gegenstaende) {
                    const doc = _util.getDocumentFor(reportSource.gegenstaende);
                    const memberList = _WoDParser.parseKampfberichtGegenstaende(doc);
                    await MyStorage.putToExt(reportSource.reportId, memberList);
                }
                if (reportSource.levels && reportSource.levels[0]) {
                    const doc = _util.getDocumentFor(reportSource.levels[0]);
                    const helden = _WoDParser.getHeldenstufenOnKampfbericht(doc);
                    if (helden) await MyStorage.putToExt(reportSource.reportId, helden);
                }
            }
        }

        static async syncReportExtToItemLoot() {
            for (const reportExt of await MyStorage.reportArchiveExt.getAll()) {
                const report = await MyStorage.reportArchive.getValue(reportExt.reportId);
                await MyStorage.submitLoot(report, reportExt);
            }
        }

        static async onKampfberichteSeite() {
            //await MyStorage.indexedDb.cloneTo("wodDB_Backup3");
            //await this.rewriteExt();
            //await MyStorage.indexedDb.deleteObjectStore("items");
            // await this.resyncVersions();
            // await AutoFavorit.checkAutoFavoriten();
            // await Maintenance.recalculateSpace();
            // await Maintenance.rewriteSourceFoundingsToMeta();
            // await Maintenance.syncCheck();
            // await this.recallVersions();
            // await this.syncCheck();
            // this.migrate(); return;
            // this.recreateReporting(); return;
            // MyStorage.reportRealSources.cloneTo(MyStorage.reportArchiveSources); return;

            await this.checkMaintenance();
            this.title = document.getElementsByTagName("h1")[0];
            const wodContent = document.getElementsByClassName("content_table")[0];
            this.anchor = document.createElement("div");
            wodContent.parentElement.insertBefore(this.anchor, wodContent);
            wodContent.parentElement.removeChild(wodContent);
            this.anchor.append(wodContent);
            this.wodContent = wodContent;

            const thisObject = this;

            const buttons = {};

            buttons.archivButton = _UI.createButton(" 📦", async function () {
                thisObject.title.innerHTML = "Kampfberichte - Archiv";
                await ArchivSearch.showArchiv(thisObject.anchor);
                thisObject.title.appendChild(buttons.wodContentButton);
                thisObject.title.appendChild(buttons.statisticsButton);
                thisObject.title.appendChild(buttons.settingButton);
            });
            buttons.archivButton.title = "Archiv anzeigen";
            buttons.statisticsButton = _UI.createButton(" 📊", async function () {
                thisObject.title.innerHTML = "Kampfberichte - Statistiken";
                await MainPage.showStatistics();
                thisObject.title.appendChild(buttons.wodContentButton);
                thisObject.title.appendChild(buttons.archivButton);
                thisObject.title.appendChild(buttons.settingButton);
            });
            buttons.statisticsButton.title = "Statistik anzeigen";
            buttons.wodContentButton = _UI.createButton(" ↩", async function () {
                thisObject.title.innerHTML = "Kampfberichte";
                await MainPage.showWodOverview();
                thisObject.title.appendChild(buttons.archivButton);
                thisObject.title.appendChild(buttons.statisticsButton);
                thisObject.title.appendChild(buttons.settingButton);
            });
            buttons.wodContentButton.title = "Zurück zu den Kampfberichten";
            buttons.settingButton = _UI.createButton(" ⚙", async function () {
                thisObject.title.innerHTML = "Kampfberichte - Archiv-Einstellungen";
                await MainPage.showSettings();
                thisObject.title.appendChild(buttons.wodContentButton);
                thisObject.title.appendChild(buttons.archivButton);
                thisObject.title.appendChild(buttons.statisticsButton);
            });
            buttons.settingButton.style.fontSize = "14px";
            buttons.settingButton.title = "Einstellungen anzeigen";

            delete buttons.wodContentButton.style.fontSize;

            thisObject.title.appendChild(buttons.archivButton);
            thisObject.title.appendChild(buttons.statisticsButton);
            thisObject.title.appendChild(buttons.settingButton);

            ArchivSearch.preInit();
            await this.completeDungeonInformations(false, this.wodContent);
            _Libs.useJQueryUI().then(a => ArchivSearch.loadArchivView()); // preload
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
                ["Anzahl Meta-Daten", await MyStorage.reportArchive.count()],
                ["Anzahl Quell-Berichte", await MyStorage.reportArchiveSources.count()],
                ["Belegter Speicher durch Quell-Berichte", _util.fromBytesToMB(memorySpace)],
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
            this.anchor.append(await SettingsPage.create()); // wird jedes Mal neu erstellt
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
            ueberschriftArchiv.innerHTML = "Archiv";
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
                        gruppe: _WoD.getMyGroupName(),
                        gruppe_id: _WoD.getMyGroupId(),
                        world: _WoD.getMyWorld(),
                    }
                    await MyStorage.reportArchive.setValue(reportMeta);
                }
                // TODO: Spezial: zerstörte Gegenstände einblenden!?
                const reportExt = await MyStorage.reportArchiveExt.getValue(reportMeta.reportId);
                if (reportExt && reportExt.members) {
                    for (const [member, items] of Object.entries(reportExt.members)) {
                        if (items.equip) {
                            for (const curEquip of items.equip) {
                                if (curEquip.hp && curEquip.hp[0] === 0) {
                                    //console.log("Zerstörtes Item: " + new Date(reportMeta.ts), curEquip.name + " (" + member + ")");
                                }
                            }
                        }
                    }
                }

                // console.log("Report: ", new Date(reportMeta.ts), reportMeta);

                const getTitle = async function (report) {
                    let result = report.title;
                    if (await Report.hasMoreThanOneVersion(reportMeta)) {
                        const versionNr = await Report.getVersion(reportMeta);
                        if (versionNr) result += " (v" + versionNr + ")";
                        else result += " (v?)";
                    }
                    return result;
                }
                if (await Report.hasMoreThanOneVersion(reportMeta)) {
                    const nameTD = curTR.children[1];
                    const title = await getTitle(reportMeta);
                    if (nameTD.textContent !== title) {
                        nameTD.innerHTML = title;
                    }
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
                    let updateLoeschenButton;
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
                            await updateLoeschenButton(curReportMeta);
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
                            await util.htmlExportFullReportAsZip(reportId);
                        });
                        saveButton.style.position = "relative";
                        saveButton.style.top = "-2px";
                        saveButton.style.fontSize = null;
                        saveButton.title = "Zum Exportieren aller geladener Berichte."; // was für Daten? auch Meta-Daten? oder nur Sources?
                        archiviertAktionenTD.append(saveButton);
                    }

                    if (isArchiv) {
                        const reportToString = async function (report) {
                            return "- " + await getTitle(report) + "\n        [" + report.gruppe + "; " + _util.formatDateAndTime(new Date(report.ts)) + "]";
                        }
                        const deleteButton = _UI.createButton("🌋", async function () {
                            const confirmation = confirm("Es wird folgender Datensatz gelöscht: \n" + await reportToString(reportMeta));
                            if (confirmation) {
                                await Report.deleteSources(reportMeta.reportId);
                                await ArchivSearch.updateSearch();
                            }
                        });
                        deleteButton.style.position = "relative";
                        deleteButton.style.top = "-2px";
                        deleteButton.style.fontSize = null;
                        deleteButton.title = "Löschen der Quell-Berichte. Die ermittelten Meta-Daten bleiben erhalten."; // was für Daten? auch Meta-Daten? oder nur Sources?
                        archiviertAktionenTD.append(deleteButton);
                        updateLoeschenButton = async function (curReportMeta) {
                            curReportMeta = curReportMeta || await MyStorage.reportArchive.getValue(reportId);
                            const isBlocked = curReportMeta.fav || (curReportMeta.favAuto && curReportMeta.favAuto.length > 0);
                            if (isBlocked) {
                                deleteButton.style.visibility = "hidden";
                            } else {
                                deleteButton.style.visibility = "";
                            }
                            curReportMeta.fav = !curReportMeta.fav;
                        }
                        await updateLoeschenButton(reportMeta);
                    }
                }

                if (!hatDatensaetze) {
                    archiviertTD.style.backgroundColor = MainPage.COLOR_RED;
                    archiviertAktionenTD.style.backgroundColor = MainPage.COLOR_RED;
                    archiviertSpeicherTD.style.backgroundColor = MainPage.COLOR_RED;
                    archiviertTD.innerHTML += "<span style='white-space: nowrap'>Fehlt komplett</span>";
                } else {
                    if (reportMeta.space) {
                        archiviertSpeicherTD.innerHTML = _util.fromBytesToMB(reportMeta.space);
                    }
                    const fehlend = Report.getMissingReportSites(reportMeta);
                    if (fehlend.length === 0) {
                        archiviertTD.style.backgroundColor = MainPage.COLOR_GREEN;
                        archiviertSpeicherTD.style.backgroundColor = MainPage.COLOR_GREEN;
                        archiviertAktionenTD.style.backgroundColor = MainPage.COLOR_GREEN;
                        archiviertTD.innerHTML += "Komplett ";
                        archiviertTD.style.whiteSpace = "nowrap";
                        archiviertTD.style.position = "relative";
                        for (const curTag of [AutoFavorit.TAG_ALL, AutoFavorit.TAG_GROUP, AutoFavorit.TAG_ALL_SEASON, AutoFavorit.TAG_GROUP_SEASON]) {
                            if (reportMeta.favAuto && reportMeta.favAuto.includes(curTag)) {
                                const favoritAuto = document.createElement("span");
                                favoritAuto.innerHTML = "★";
                                favoritAuto.title = AutoFavorit.TAG_DESC[curTag];
                                favoritAuto.style.cursor = "default";
                                favoritAuto.style.color = AutoFavorit.TAG_COLORS[curTag];
                                archiviertTD.append(favoritAuto);
                            }
                        }
                    } else {
                        archiviertTD.style.backgroundColor = MainPage.COLOR_YELLOW;
                        archiviertSpeicherTD.style.backgroundColor = MainPage.COLOR_YELLOW;
                        archiviertAktionenTD.style.backgroundColor = MainPage.COLOR_YELLOW;
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
                if (reportMeta && reportMeta.success && reportMeta.success.levels) {
                    const members = reportMeta.success.members;
                    const rooms = reportMeta.success.rooms;
                    const levels = reportMeta.success.levels;
                    if (members) {
                        if (members[0] === members[1]) {
                            curTR.style.backgroundColor = MainPage.COLOR_GREEN;
                            successWin++;
                        } else if (members[0] > 0) {
                            curTR.style.backgroundColor = MainPage.COLOR_YELLOW;
                            successTie++;
                        } else {
                            curTR.style.backgroundColor = MainPage.COLOR_RED;
                            successLose++;
                        }
                    } else if (reportMeta.success.levels) {
                        if (levels[0] > -1) {
                            if (levels[0] !== levels[1]) {
                                curTR.style.backgroundColor = MainPage.COLOR_RED;
                                successLose++;
                            } else {
                                curTR.style.backgroundColor = "lightgreen";
                            }
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
                    erfolgTD.innerHTML = (levels[0] > -1 ? levels[0] : "?") + "/" + levels[1];
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

    class SettingsPage {

        static async create() {
            const settings = await Settings.get(true);
            const settingTable = document.createElement("div");
            await this.createAutoFavorit(settingTable, settings);
            await this.createLoeschautomatik(settingTable, settings);
            await this.createLootSummary(settingTable, settings);
            return settingTable;
        }

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

        static async createLoeschautomatik(settingTable, settings) {
            this.addHeader(settingTable, "Löschautomatik", "Es werden standardmäßig nur die Quell-Berichte und nicht die ermittelten Meta-Daten gelöscht. Die Löschung wird einmal täglich beim Aufrufen der 'Kampfberichte'-Seite durchgeführt.");

            const tableContent = [];

            const autoLoeschenTageLabel = document.createElement("span");
            autoLoeschenTageLabel.innerHTML = "Anzahl Tage:";
            const autoLoeschenTage = this.createTextBox(() => {
                    return settings.autoLoeschenTage || 14;
                },
                async function (value) {
                    try {
                        value = Math.round(Number(value));
                    } catch (e) {
                    }
                    settings.autoLoeschenTage = value;
                    await Settings.save();
                });
            autoLoeschenTage.size = 4;

            let updateVisibility;
            const autoLoeschen = this.createCheckBox(() => settings.autoLoeschen,
                async function (value) {
                    settings.autoLoeschen = value;
                    if (!value) {
                        delete settings.autoLoeschenDate;
                    }
                    await Settings.save();
                    updateVisibility();
                });
            updateVisibility = async function () {
                if (autoLoeschen.checked) {
                    autoLoeschenTageLabel.style.display = "";
                    autoLoeschenTage.style.display = "";
                } else {
                    autoLoeschenTageLabel.style.display = "none";
                    autoLoeschenTage.style.display = "none";
                }
            }
            await updateVisibility();
            tableContent.push(["Automatisches Löschen:", autoLoeschen]);
            tableContent.push([autoLoeschenTageLabel, autoLoeschenTage]);

            const result = _UI.createTable(tableContent)
            settingTable.append(result);
        }

        static async createLootSummary(settingTable, settings) {
            this.addHeader(settingTable, "Sonstiges", "");
            const tableContent = [];

            const lootSummaryCheckbox = this.createCheckBox(() => settings.lootSummary,
                async function (value) {
                    settings.lootSummary = value;
                    await Settings.save();
                });

            tableContent.push(["Zusammenfassung Gegenstandsseite: ", lootSummaryCheckbox])

            const autoFavoritTable = _UI.createTable(tableContent);
            settingTable.append(autoFavoritTable);
        }

        static async createAutoFavorit(settingTable, settings) {
            this.addHeader(settingTable, "Auto-Favorit", "Durch das Setzen eines Datensatzes als Favorit, wird dieser Datensatz vom Löschen ausgenommen. Die Änderung tritt beim nächsten Aufruf der 'Kampfberichte'-Seite in Kraft.", "Auswahlkriterien sind pro Dungeonversion: \n1. Größere Anzahl an Mitglieder die das Ziel erreicht haben\n2. Größere Anzahl erreichter Level\n3. Größere Anzahl an erfolgreichen Räumen\n4. Der Datensatz mit dem neueren Datum");

            const tableContent = [];

            const autoLoeschenFavoritLabelAll = document.createElement("span");
            autoLoeschenFavoritLabelAll.innerHTML = "Auto-Favoriten <b>gruppenunabhängig</b> markieren:";
            autoLoeschenFavoritLabelAll.title = "Unabhängig von einer Gruppe wird jeweils ein Dungeon markiert.";
            console.log("settings.autoFavoritAll", settings.autoFavoritAll);
            const autoLoeschenFavoritAll = this.createCheckBox(() => settings.autoFavoritAll,
                async function (value) {
                    settings.autoFavoritAll = value;
                    settings.updateAutoFavoritAll = true;
                    await Settings.save();
                });
            autoLoeschenFavoritAll.title = "Es wird generell nur je ein Dungeon markiert.";
            const autoLoeschenFavoritAllSeason = this.createCheckBox(() => settings.autoFavoritAllSeason,
                async function (value) {
                    settings.autoFavoritAllSeason = value;
                    settings.updateAutoFavoritAllSeason = true;
                    await Settings.save();
                });
            autoLoeschenFavoritAllSeason.title = "Pro Saison wird genau je ein Dungeon markiert.";

            const autoLoeschenFavoritLabelGroup = document.createElement("span");
            autoLoeschenFavoritLabelGroup.innerHTML = "Auto-Favoriten <b>pro Gruppe</b> markieren:";
            autoLoeschenFavoritLabelGroup.title = "Für jede Gruppe wird je ein Dungeon markiert.";
            const autoLoeschenFavoritGroup = this.createCheckBox(() => settings.autoFavoritGroup,
                async function (value) {
                    settings.autoFavoritGroup = value;
                    settings.updateAutoFavoritGroup = true;
                    await Settings.save();
                });
            autoLoeschenFavoritGroup.title = "Für jede Gruppe wird generell nur je ein Dungeon markiert.";
            const autoLoeschenFavoritGroupSeason = this.createCheckBox(() => settings.autoFavoritGroupSeason,
                async function (value) {
                    settings.autoFavoritGroupSeason = value;
                    settings.updateAutoFavoritGroupSeason = true;
                    await Settings.save();
                });
            autoLoeschenFavoritGroupSeason.title = "Für jede Gruppe in jeder Saison wird je ein Dungeon markiert.";
            const getFavoritCheckBox = function (checkbox, tagName) {
                const wrapper = document.createElement("span");
                wrapper.append(checkbox);
                wrapper.title = checkbox.title;
                const descr = document.createElement("span");
                descr.innerHTML = "★";
                descr.style.color = AutoFavorit.TAG_COLORS[tagName];
                wrapper.append(descr);
                return wrapper;
            }

            tableContent.push([autoLoeschenFavoritLabelAll, getFavoritCheckBox(autoLoeschenFavoritAll, AutoFavorit.TAG_ALL), Settings.SEASONS_ACTIVATED ? getFavoritCheckBox(autoLoeschenFavoritAllSeason, AutoFavorit.TAG_ALL_SEASON) : ""]);
            tableContent.push([autoLoeschenFavoritLabelGroup, getFavoritCheckBox(autoLoeschenFavoritGroup, AutoFavorit.TAG_GROUP), Settings.SEASONS_ACTIVATED ? getFavoritCheckBox(autoLoeschenFavoritGroupSeason, AutoFavorit.TAG_GROUP_SEASON) : ""]);
            const autoFavoritTable = _UI.createTable(tableContent, Settings.SEASONS_ACTIVATED ? ["", "Saisonübergreifend", "pro Saison"] : "");
            settingTable.append(autoFavoritTable);
        }

        static createTextBox(supplier, consumer) {
            const result = document.createElement("input");
            result.type = "text";
            result.value = supplier();
            result.onchange = async function () {
                await consumer(result.value);
            }
            return result;
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
    }

    class ItemLootSummary {

        static async einblenden(memberList) {
            const eingesammeltPre = {};
            const beschaedigtPre = [];
            const verlorenPre = {};
            const vgsPre = {};
            let gold = 0;
            let gesamtschaden = 0;
            const messages = [];

            for (const [member, items] of Object.entries(memberList)) {
                gold += items.gold;
                const lootToList = items.ko ? verlorenPre : eingesammeltPre;
                if (items.exceed) messages.push([member + " hat seine Lagerkapazität überschritten! (" + items.exceed + ")", MainPage.COLOR_RED]);
                if (items.full) messages.push([member + " konnte aufgrund eines vollen Rucksacks nicht mehr alles einsammeln!", MainPage.COLOR_YELLOW]);
                for (const curItem of (items.loot || [])) {
                    const item = lootToList[curItem.name] || (lootToList[curItem.name] = {from: []});
                    item.from.push(member);
                    if (curItem.vg) item.vg = item.vg || 0 + curItem.vg;
                    if (curItem.unique) item.unique = true;
                }
                for (const curEquip of items.equip) {
                    if (curEquip.hp && curEquip.hp[2]) {
                        beschaedigtPre.push({item: curEquip, owner: member});
                        gesamtschaden += curEquip.hp[2];
                    }
                    if (curEquip.vg) {
                        const memberVGs = vgsPre[member] || (vgsPre[member] = {});
                        const item = memberVGs[curEquip.name + (curEquip.gems || "")] || (memberVGs[curEquip.name + (curEquip.gems || "")] = {
                            name: curEquip.name,
                            id: curEquip.id,
                            vg: [0, 0, 0],
                        });
                        item.vg[0] += curEquip.vg[0];
                        item.vg[1] += curEquip.vg[0];
                        if (curEquip.vg[2]) {
                            item.vg[2] += Number(curEquip.vg[2]);
                            item.vg[1] += -Number(curEquip.vg[2]);
                        }
                    }
                }
            }
            messages.push(["Gesammeltes Gold: " + gold + ", im Durchschnitt: " + (Math.round(10 * gold / Object.keys(memberList).length) / 10)]);

            const title = document.querySelector("h2");

            const summaryContainer = document.createElement("div");
            summaryContainer.classList.add("nowod");
            for (const warning of messages) {
                const entry = document.createElement("div");
                entry.style.display = "table";
                entry.innerHTML = warning[0];
                if (warning[1]) entry.style.backgroundColor = warning[1];
                summaryContainer.append(entry);
            }

            let [eingesammeltData, eingesammeltCount] = this.getItemLootAndDropTable(eingesammeltPre, true);
            summaryContainer.append(this.flowLayout(_UI.createContentTable(eingesammeltData, ["Anzahl", "eingesammelte Items: " + eingesammeltCount])));

            let [verlorenData, verlorenCount] = this.getItemLootAndDropTable(verlorenPre);
            summaryContainer.append(this.flowLayout(_UI.createContentTable(verlorenData, ["Anzahl", "verlorene Items: " + verlorenCount])));

            let [data, count] = this.getItemDamageTable(beschaedigtPre);
            summaryContainer.append(this.flowLayout(_UI.createContentTable(data, ["Held", "HP", gesamtschaden, "beschädigte Items: " + count])));

            [data, count] = this.getItemUsedTable(vgsPre);
            summaryContainer.append(this.flowLayout(_UI.createContentTable(data, ["Held", {
                data: "Anw.",
                title: "Übrig/Mitgenommen (Verbraucht)"
            }, "", "verwendete VGs: " + count])));

            title.parentElement.insertBefore(summaryContainer, title.nextSibling);
        }

        static getFullItemNode(itemName, instanceId, destroyed, remainHPPicture, debug) {
            let finding;
            if (instanceId) {
                const searchFor = "&id=" + instanceId;
                finding = document.querySelector(".content_table a[href*=\"" + searchFor + "\"]");
            } else {
                const searchFor = "/item/" + _util.fixedEncodeURIComponent(itemName).replaceAll("%20", "+");
                finding = document.querySelector(".content_table a[href*=\"" + searchFor + "\"]:not([href*=\"&id=\"])");
            }
            if (!finding) {
                console.log("Cant find: ", itemName, instanceId, destroyed, debug);
                return itemName;
            }
            const newNode = finding.parentElement.cloneNode(true);
            const infoImg = newNode.querySelector("img[src*=\"inf.gif\"]");
            if (infoImg) infoImg.parentElement.removeChild(infoImg); // Dies ist ein Gruppengegenstand entfernen
            const aHref = newNode.querySelector("a");
            if (destroyed) aHref.classList.add("item_destroyed");
            else aHref.classList.remove("item_destroyed");
            if (!remainHPPicture) newNode.removeChild(newNode.children[0]);
            return newNode;
        }

        static flowLayout(div) {
            div.style.display = "inline-flex";
            div.style.fontSize = "90%";
            div.style.padding = "5px";
            div.style.border = 0;
            return div;
        }

        static getItemUsedTable(preData) {
            const result = [];
            for (const [member, items] of Object.entries(preData).sort(([a, a1], [b, b1]) => a.localeCompare(b))) {
                let namePrinted = false;
                for (const [itemIdentifier, item] of Object.entries(items).sort(([a, a1], [b, b1]) => a1.name.localeCompare(b1.name))) {
                    if (item.vg[2] === 0) continue;
                    const used = item.vg[0] + "/" + item.vg[1] + " (" + item.vg[2] + ")";
                    const used1 = item.vg[0] + "/" + item.vg[1];
                    const used2 = item.vg[2];
                    const itemNode = this.getFullItemNode(item.name, item.id, item.vg[0] === 0);
                    const desc = itemNode.innerHTML;
                    const color = item.vg[0] === 0 ? MainPage.COLOR_RED : (item.vg[0] < -item.vg[2] ? MainPage.COLOR_YELLOW : "");
                    result.push([namePrinted ? "" : member, {
                        data: used1,
                        style: "text-align:center;background-color:" + color
                    }, {
                        data: used2,
                        style: "text-align:center;background-color:" + color
                    }, desc]);
                    namePrinted = true;
                }
            }
            return [result, result.length];
        }

        static getItemDamageTable(beschaedigtPre) {
            const result = [];
            let lastOwner;
            for (const entry of beschaedigtPre.sort((a, b) => {
                let result = a.owner.localeCompare(b.owner);
                if (result !== 0) return result;
                return a.item.name.localeCompare(b.item.name);
            })) {
                const item = entry.item;
                let hp = item.hp[0] + "/" + item.hp[1] + " (" + item.hp[2] + ")";
                let hp1 = item.hp[0] + "/" + item.hp[1];
                let hp2 = item.hp[2];
                const itemNode = this.getFullItemNode(item.name, item.id, item.hp[0] === 0, true, item);
                itemNode.children[0].style.width = "15px";
                itemNode.children[0].style.height = "15px";
                let desc = itemNode.innerHTML;
                let held = lastOwner !== entry.owner ? entry.owner : "";
                const color = item.hp[0] === 0 ? MainPage.COLOR_RED : (item.hp[0] < 7 ? MainPage.COLOR_YELLOW : "");
                result.push([held, {data: hp1, style: "text-align:center;background-color:" + color}, {
                    data: hp2,
                    style: "text-align:center;background-color:" + color
                }, desc]);
                lastOwner = entry.owner;
            }
            return [result, beschaedigtPre.length];
        }

        static getItemLootAndDropTable(eingesammeltPre, gesammelt) {
            const eingesammelt = [];
            let eingesammeltCount = 0;
            let firstVG = true;
            for (const [itemName, entry] of Object.entries(eingesammeltPre).sort(([a, a2], [b, b2]) => {
                let result = ((a2.vg / a2.vg) || 0) - ((b2.vg / b2.vg) || 0); // Nicht Verbrauchsgegenstände zuerst
                if (result !== 0) return result;
                result = (a2.unique && 1 || 0) - (b2.unique && 1 || 0);
                if (result !== 0) return result;
                return a.localeCompare(b);
            })) {
                eingesammeltCount += entry.from.length;
                let anzahl = entry.vg ? entry.vg : (entry.from.length > 1 ? entry.from.length : "");
                const itemLink = this.getFullItemNode(itemName, entry.id);
                const ownerAnzeige = gesammelt && !entry.vg && !entry.unique;
                let addStyle = "";
                if (firstVG && entry.vg) {
                    addStyle = "border-top: 3px solid white;"
                    firstVG = false;
                }
                let name = itemLink.innerHTML + (ownerAnzeige ? " (" + entry.from.join(", ") + ")" : "");
                eingesammelt.push([{data: anzahl, style: "text-align:center;" + addStyle}, {
                    data: name,
                    style: addStyle
                }]);
            }
            return [eingesammelt, eingesammeltCount];
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

        static preInit() {
            this.archivView = document.createElement("div");
        }

        static AUSWAHL_BEVORZUGT = 8;

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
            primaryDate.setDate(primaryDate.getDate() - ArchivSearch.AUSWAHL_BEVORZUGT);
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
                this.dungeonSelect.innerHTML += "<option disabled>⎯⎯⎯⎯⎯⎯⎯⎯⎯ In den letzten " + ArchivSearch.AUSWAHL_BEVORZUGT + " Tagen aktiv ⎯⎯⎯⎯⎯⎯⎯⎯⎯</option>";
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
                this.groupSelect.innerHTML += "<option disabled>⎯⎯⎯⎯⎯⎯⎯⎯⎯ In den letzten " + ArchivSearch.AUSWAHL_BEVORZUGT + " Tagen aktiv ⎯⎯⎯⎯⎯⎯⎯⎯⎯</option>";
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
                this.worldSelect.innerHTML += "<option disabled>⎯⎯⎯⎯⎯⎯⎯⎯⎯ In den letzten " + ArchivSearch.AUSWAHL_BEVORZUGT + " Tagen aktiv ⎯⎯⎯⎯⎯⎯⎯⎯⎯</option>";
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
            const favoritSelector = this.searchQuery.nurFavoriten;
            if (favoritSelector.length === 0) return true;
            if (favoritSelector.includes(FilterQuery.FAVORIT_AUTO_GROUP) && !(report.favAuto && report.favAuto.includes(AutoFavorit.TAG_GROUP))) return false;
            if (favoritSelector.includes(FilterQuery.FAVORIT_AUTO_ALL) && !(report.favAuto && report.favAuto.includes(AutoFavorit.TAG_ALL))) return false;
            if (favoritSelector.includes(FilterQuery.FAVORIT_MANUELL) && !report.fav) return false;
            return true;
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
            this.searchQuery = new FilterQuery();
            const maxResults = (await Settings.get()).maxResults;
            if (maxResults !== undefined) {
                this.searchQuery.maxResults = maxResults;
            } else {
                this.searchQuery.maxResults = 100;
            }
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

            this.nurFavoritenSelect = document.createElement("select");
            this.nurFavoritenSelect.onchange = async function () {
                thisObject.searchQuery.nurFavoriten = [];
                var options = thisObject.nurFavoritenSelect.selectedOptions;
                for (var i = 0, l = options.length; i < l; i++) {
                    const opt = options[i];
                    const value = opt.value || opt.text;
                    if (value === "") continue;
                    thisObject.searchQuery.nurFavoriten.push(value);
                }
                ArchivSearch.updateSearch();
            }
            this.nurFavoritenSelect.innerHTML += "<option></option>";
            this.nurFavoritenSelect.innerHTML += "<option>" + FilterQuery.FAVORIT_MANUELL + "</option>";
            this.nurFavoritenSelect.innerHTML += "<option>" + FilterQuery.FAVORIT_AUTO_ALL + "</option>";
            this.nurFavoritenSelect.innerHTML += "<option>" + FilterQuery.FAVORIT_AUTO_GROUP + "</option>";
            content.push(["Favoriten", this.nurFavoritenSelect]);

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
            const maxResultsInput = document.createElement("input");
            maxResultsInput.type = "text";
            maxResultsInput.size = 4;
            maxResultsInput.value = ArchivSearch.searchQuery.maxResults;
            maxResultsInput.onchange = async function (e) {
                try {
                    let newValue;
                    if (maxResultsInput.value === "") {
                        newValue = "";
                    } else {
                        newValue = Number(maxResultsInput.value);
                        if (isNaN(newValue)) throw new Errror("Not a number");
                    }
                    ArchivSearch.searchQuery.maxResults = newValue;
                    const settings = await Settings.get();
                    settings.maxResults = newValue;
                    await Settings.save();
                    ArchivSearch.updateSearch();
                } catch (e) { // reset
                    maxResultsInput.value = ArchivSearch.searchQuery.maxResults;
                }
            }
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

        static async showPage(reportSource, reportSiteHTML, pageType) {
            MainPage.anchor.removeChild(MainPage.anchor.children[0]);
            const doc = _util.getDocumentFor(reportSiteHTML);
            const mainContent = doc.getElementsByClassName("main_content")[0];
            const temp = document.createElement("div");
            temp.innerHTML = mainContent.outerHTML;
            MainPage.anchor.append(temp);
            MainPage.title.scrollIntoView();
            const statExecuter = this.getErweiterteKampfstatistikExecuter();
            if (statExecuter) {
                const dbSourceReport = await MyStorage.reportArchiveSources.getValue(reportSource.reportId);
                await statExecuter(pageType === MainPage.PAGE_TYPE_REPORT, pageType === MainPage.PAGE_TYPE_STAT, dbSourceReport);
            }
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
                            addOnclick(reportSource.statistik ? a => ArchivSearch.showPage(reportSource, reportSource.statistik, MainPage.PAGE_TYPE_STAT) : null);
                            break;
                        case "Gegenstände":
                            addOnclick(reportSource.gegenstaende ? a => ArchivSearch.showPage(reportSource, reportSource.gegenstaende, MainPage.PAGE_TYPE_ITEMS) : null);
                            break;
                        case "Bericht":
                            const level = reportSource.levels && reportSource.levels[0];
                            addOnclick(level ? a => ArchivSearch.showPage(reportSource, level, MainPage.PAGE_TYPE_REPORT) : null);
                            break;
                        default:
                            const matches = input.value.match(/Level.*(\d+)/);
                            if (matches) {
                                const level = reportSource.levels && reportSource.levels[matches[1] - 1];
                                addOnclick(level ? a => ArchivSearch.showPage(reportSource, level, MainPage.PAGE_TYPE_REPORT) : null);
                            }
                            break;
                    }
                }
            }

            if (pageType === MainPage.PAGE_TYPE_ITEMS) {
                const reportExt = await MyStorage.reportArchiveExt.getValue(reportSource.reportId);
                const members = reportExt && reportExt.members;
                if (members) ItemLootSummary.einblenden(members);
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
                if (reportSource.statistik) ArchivSearch.showPage(reportSource, reportSource.statistik, MainPage.PAGE_TYPE_STAT);
            }

            const gegenstaende = document.createElement("input");
            result.append(gegenstaende);
            gegenstaende.value = "Gegenstände";
            gegenstaende.type = "submit";
            gegenstaende.className = reportMeta.gegenstaende ? "button clickable" : "button_disabled";
            gegenstaende.onclick = async function (e) {
                e.preventDefault();
                const reportSource = await getReportSource();
                if (reportSource.gegenstaende) ArchivSearch.showPage(reportSource, reportSource.gegenstaende, MainPage.PAGE_TYPE_ITEMS);
            }

            const bericht = document.createElement("input");
            result.append(bericht);
            bericht.value = "Bericht";
            bericht.type = "submit";
            bericht.className = reportMeta.levels ? "button clickable" : "button_disabled";
            bericht.onclick = async function (e) {
                e.preventDefault();
                const reportSource = await getReportSource();
                if (reportSource.levels) ArchivSearch.showPage(reportSource, reportSource.levels[0], MainPage.PAGE_TYPE_REPORT);
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
            for (const lv of this.getMissingReportSitesLevel(report, onlyFullSuccess)) {
                fehlend.push(lv);
            }
            return fehlend;
        }

        static isVollstaendigLevel(report, onlyFullSuccess) {
            if (!report.levels || !report.success) return false;
            return this.getMissingReportSitesLevel(report, onlyFullSuccess).length === 0;
        }

        static getMissingReportSitesLevel(report, onlyFullSuccess) {
            const fehlend = [];
            if (report.success && report.success[1]) {
                delete report.success[1];
                MyStorage.reportArchive.setValue(report);
            }
            if (!report || !report.success || !report.levels || !report.success.levels) {
                fehlend.push("Lx");
            } else {
                let maxLevel = report.success.levels[1];
                const successLevels = report.success.levels[0];
                if (!onlyFullSuccess && successLevels !== undefined) maxLevel = Math.min(successLevels + 1, maxLevel); // evtl. nicht erfolgreich, dann müssen auch nicht alle angefordert sein
                for (var i = 0, l = maxLevel; i < l; i++) {
                    if (!report.levels[i]) fehlend.push("L" + (i + 1));
                }
            }
            return fehlend;
        }

        static async getVersion(report, reportSourceOpt) {
            return (await this.getVersions(report, reportSourceOpt)).join(" | ");
        }

        static async getVersions(report, reportSourceOpt) {
            if (report.locVersion) return [report.locVersion];
            if (report.schlacht) return [1];
            // Es muss mindestens der letzte Level auch besucht worden sein.
            if (!report || !report.success || !report.levels || !report.success.levels) return [];
            if (report.locVersionId) return await Location.guessVersionById(report.title, report.locVersionId, report);

            if (!Report.isVollstaendigLevel(report)) return [];
            const reportSource = reportSourceOpt || await MyStorage.reportArchiveSources.getValue(report.reportId);
            if (!reportSource) return [];
            const versionIdArray = this.getVersionIdArray(report, reportSource);
            if (versionIdArray[versionIdArray.length - 1] === "X_X") {
                // Unvollständiger Dungeon wir haben nicht alle Level: wir versuchen zu raten
                report.locVersionId = versionIdArray;
                await MyStorage.reportArchive.setValue(report);
                return await Location.guessVersionById(report.title, versionIdArray, report);
            }
            // wir haben alle Level geladen
            const versionNr = await Location.getVersionById(report.title, versionIdArray);
            report.locVersion = versionNr;
            await MyStorage.reportArchive.setValue(report);
            return [versionNr];
        }

        /**
         * @return ein Array mit Titeln der einzelnen Level. Sofern nicht komplett alle Level des Dungeons erreicht wurden, wird am
         * Ende ein Platzhalter eingeührt.
         */
        static getVersionIdArray(report, reportSource) {
            const versionId = [];
            for (let i = 0, l = Math.min(report.success.levels[0] + 1, report.success.levels[1]); i < l; i++) {
                const level = reportSource.levels[i];
                const doc = _util.getDocumentFor(level);
                const navLevels = doc.getElementsByClassName("navigation levels")[0];
                const ueberschrift = navLevels.parentElement.getElementsByTagName("h3")[0].textContent;
                versionId.push(ueberschrift);
            }
            if (report.success.levels[1] > versionId.length) {
                versionId.push("X_X"); // Markierung, dass es noch keine finale Versionskennzeichnung ist
            }
            return versionId;
        }

        static async hasMoreThanOneVersion(report) {
            const location = await MyStorage.location.getValue(report.title);
            if (!location || !location.versions) return false;
            return Object.keys(location.versions).length > 1;
        }

        static async deleteSources(reportId) {
            await MyStorage.reportArchiveSources.deleteValue(reportId);
            const report = await MyStorage.reportArchive.getValue(reportId);
            delete report.statistik;
            delete report.gegenstaende;
            delete report.levels;
            delete report.space;
            await MyStorage.reportArchive.setValue(report);
            if (report.favAuto) await AutoFavorit.recheckAutoFavoritenForReport(report);
        }

    }

    /**
     * Markiert entsprechende reports mit
     * .favAuto = ["group"]
     */
    class AutoFavorit {

        static TAG_GROUP = "group";
        static TAG_ALL = "all";
        static TAG_GROUP_SEASON = "groupSeason";
        static TAG_ALL_SEASON = "allSeason";

        static TAG_COLORS = {
            [this.TAG_ALL]: "orange",
            [this.TAG_GROUP]: "lightblue",
            [this.TAG_ALL_SEASON]: "black",
            [this.TAG_GROUP_SEASON]: "magenta",
        }

        static description = "\nEs wird von der Anwendung her pro Gruppe mit maximal möglicher Mitgliederanzahl, pro Dungeon und pro Dungeonversion jeweils der letzte Datensatz hiermit markiert. Diese Datensätze sind standardmäßig von der automatischen Löschung ausgenommen.";

        static TAG_DESC = {
            [this.TAG_GROUP]: "Auto-Favorit pro Gruppe." + this.description,
            [this.TAG_ALL]: "Auto-Favorit gruppenübergreifend." + this.description,
            [this.TAG_GROUP_SEASON]: "Auto-Favorit pro Saison." + this.description,
            [this.TAG_ALL_SEASON]: "Auto-Favorit gruppenübergreifend pro Saison." + this.description,
        }

        /**
         * Überprüft alle Dungeon Auto-Favoriten.
         */
        static async checkAutoFavoritenForTagName(specificTagName, deactivated) {
            console.log("checkAutoFavoriten... " + (specificTagName ? "[" + specificTagName + "]" : "") + " " + (deactivated ? "deaktiviert" : "aktiviert"));
            await this.#checkAllAutoFavoritenOn(await MyStorage.reportArchive.getAll(), specificTagName, deactivated);
            console.log("checkAutoFavoriten finished! " + (specificTagName ? "[" + specificTagName + "]" : ""));
        }

        /**
         * Überprüft den Auto-Favoriten für den angegebenen Dungeon und Gruppe.
         */
        static async recheckAutoFavoritenForReport(report) {
            const reports = (await MyStorage.reportArchive.getAll()).filter(current => current.title === report.title);
            await this.#checkAllAutoFavoritenOn(reports);
        }

        /**
         * Überprüft alle Dungeon Auto-Favoriten für die übergebenen Reports.
         */
        static async #checkAllAutoFavoritenOn(reports, specificTagName, deactivated) {
            if (specificTagName) { // Ein bestimmter AutoFavorit soll nochmal überprüft werden. Z.B. bei einer Änderung der Einstellung.
                await this.#checkAutoFavoritenIntern(reports, specificTagName, deactivated);
            } else { // Ein Report hat sich geändert, nur wenn AutoFavoriten aktiviert sind müssen wir hier auch checken
                if ((await Settings.get()).autoFavoritGroup) await this.#checkAutoFavoritenIntern(reports, AutoFavorit.TAG_GROUP);
                if ((await Settings.get()).autoFavoritAll) await this.#checkAutoFavoritenIntern(reports, AutoFavorit.TAG_ALL);
            }
        }

        static async #domainGroup(report) {
            const myVersions = await Report.getVersions(report);
            if (!myVersions || myVersions.length === 0) return [];
            const result = [];
            for (const version of myVersions) {
                result.push(report.gruppe_id + ";" + report.title + ";" + version); // pro Gruppe, Dungeonname und Version
            }
            return result;
        }

        static async #domainAll(report) {
            const myVersions = await Report.getVersions(report);
            if (!myVersions || myVersions.length === 0) return [];
            const result = [];
            for (const version of myVersions) {
                result.push(report.title + ";" + version); // pro Gruppe, Dungeonname und Version
            }
            return result;
        }

        static #domains = {
            "group": this.#domainGroup,
            "all": this.#domainAll,
        }

        /**
         * Auto-Favoriten abhängig von der getAutoFavoritIds-Methode.
         * @param reports
         * @param tagName autoFavorit-tagName
         * @param asyncMapperMethod (report) -> Identifier
         */
        static async #checkAutoFavoritenIntern(reports, tagName, deactivated) {
            if (deactivated) {
                console.log("Lösche alle Favoriten Tags für '" + tagName + "'", reports.length);
                for (const report of reports) {
                    if (report.favAuto && report.favAuto.includes(tagName)) {
                        _util.arrayRemove(report.favAuto, tagName);
                        if (report.favAuto.length === 0) delete report.favAuto;
                        await MyStorage.reportArchive.setValue(report);
                    }
                }
                return;
            }

            const asyncMapperMethod = this.#domains[tagName];
            const favorites = {};
            const _ids = {};
            for (const report of reports) {
                const ids = await asyncMapperMethod(report);
                _ids[report.reportId] = ids;
                if (!Report.isVollstaendigLevel(report)) continue; // nur Reports, wo alle erreichten Level gespeichert wurden
                if (!ids) continue;
                for (const id of ids) {
                    const lastFavorit = favorites[id];
                    if (lastFavorit) {
                        favorites[id] = this.#checkPrefer(lastFavorit, report);
                    } else {
                        favorites[id] = report;
                    }
                }
            }
            for (const report of reports) {
                const ids = _ids[report.reportId];
                let sollAutoFavorit = false;
                for (const id of ids) {
                    if (favorites[id] && (favorites[id].reportId === report.reportId)) {
                        sollAutoFavorit = true;
                        break;
                    }
                }

                const istAutoFavorit = !!(report.favAuto && report.favAuto.includes(tagName));
                if (istAutoFavorit !== sollAutoFavorit) {
                    if (sollAutoFavorit) {
                        report.favAuto = report.favAuto || [];
                        report.favAuto.push(tagName);
                    } else {
                        _util.arrayRemove(report.favAuto, tagName);
                        if (report.favAuto.length === 0) delete report.favAuto;
                    }
                    await MyStorage.reportArchive.setValue(report);
                }
            }
        }

        /**
         * Welcher der beiden Report überwiegt als Auto-Favorit?
         */
        static #checkPrefer(report1, report2) {
            // Größere Memberzahl gewinnt
            if (report1.success.members && report2.success.members) {
                const members1 = report1.success.members[1];
                const members2 = report2.success.members[1];
                if (members1 !== members2) return members1 > members2 ? report1 : report2;
            }
            // Größere Levelzahl gewinnt
            const levels1 = report1.success.levels[0];
            const levels2 = report2.success.levels[0];
            if (levels1 !== levels2) return levels1 > levels2 ? report1 : report2;
            // Größere Anzahl an geschafften Räumen gewinnt
            if (report1.success.rooms && report2.success.rooms) {
                const success1 = Report.getSuccessRoomRate(report1);
                const success2 = Report.getSuccessRoomRate(report2);
                if (success1 !== success2) return success1 > success2 ? report1 : report2;
            }
            // Der neuere Report gewinnt
            return report1.ts > report2.ts ? report1 : report2;
        }
    }

    /**
     * Hier werden u.a. die verschiedenen Versionen eines Dungeons gespeichert.
     */
    class Location {

        static async getVersionById(locationName, versionIdArray) {
            const location = await MyStorage.location.getValue(locationName) || {name: locationName};
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
                await MyStorage.location.setValue(location);
                return result;
            }
        }

        /**
         * Der Dungeon wurde nicht vollständig abgeschlossen. Alle absolvierten Level sind aber lückenlos gespeichert.
         * Wir versuchen die Version zu erraten.
         */
        static async guessVersionById(locationName, incompleteVersionIdArray, debugReport) {
            const location = await MyStorage.location.getValue(locationName) || {name: locationName};
            const versions = location.versions || (location.versions = {});
            const versionIdString = this.getVersionIdString(incompleteVersionIdArray);
            const results = [];
            const matchingVersions = this.getMatchingVersions(location, versionIdString, false, debugReport);
            if (matchingVersions.length === 0) {
                const newVersionNr = Object.keys(versions).length + 1;
                versions[versionIdString] = newVersionNr;
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

        static async addNewVersion(location) {
            const newVersionNr = Object.keys(versions).length + 1;
            versions[versionIdString] = newVersionNr;
            await MyStorage.location.setValue(location);
            results.push(newVersionNr);
        }

        static getMatchingVersions(location, versionIdString, fullqualifiedPath, debugReport) {
            const versionIdStringCleaned = versionIdString.replaceAll(/\|X_X$/g, "|");
            fullqualifiedPath = !versionIdString.match(/\|X_X$/g);
            const results = [];
            for (const [id, versionNr] of Object.entries(location.versions)) {
                if (this.isMatching(versionIdString, versionIdStringCleaned, id, fullqualifiedPath, debugReport)) results.push([id, versionNr]);
            }
            return results;
        }

        /**
         * 4. Fälle:
         * 1) wir haben einen vollständige Pfad und treffen auf einen vollständige Pfad => es muss exakt sein
         * 2) wir haben einen vollständigen Pfad und treffen auf einen unvollständigen Pfad => der vorhandene Pfad wird erweitert
         * 3) wir haben einen unvollständigen Pfad und treffen auf einen vollständigen Pfad => wir liefern ihn unverändert zurück
         * 4) wir haben einen unvollständigen Pfad und treffen auf einen unvollständigen Pfad => wenn es der einzige ist, erweitern wir ihn
         */
        static isMatching(curId, curIdCleaned, id, fullqualifiedPath, debugReport) {
            const istUnvollstaendig = id.match(/\|X_X$/g);
            const cleanedVersionId = id.replaceAll(/\|X_X$/g, "|");
            if (fullqualifiedPath) {
                if (istUnvollstaendig) {
                    if (curIdCleaned.startsWith(cleanedVersionId)) {
                        return true;
                    }
                } else {
                    if (id === curIdCleaned) {
                        return true;
                    }
                }
            } else {
                if (cleanedVersionId.startsWith(curIdCleaned) || curIdCleaned.startsWith(cleanedVersionId)) {
                    return true;
                }
            }
            return false;
        }

        static getVersionIdString(versionIdArray) {
            return versionIdArray.join("|");
        }

    }

    class Settings {
        static SEASONS_ACTIVATED = false;
        static #cache;
        static DEFAULT_SETTING = {
            autoLoeschen: false,
            autoLoeschenTage: 14,
            autoFavoritAll: true,
            autoFavoritGroup: true,
            maxResults: 100,
            lootSummary: true,
        }

        static async get(fresh) {
            if (!this.#cache || fresh) {
                this.#cache = await MyStorage.settings.getValue(Mod.modname);
                if (!this.#cache) this.#cache = {name: Mod.modname};
                for (const [key, value] of Object.entries(this.DEFAULT_SETTING)) {
                    if (!(key in this.#cache)) this.#cache[key] = value;
                }
                await this.save();
            }
            return this.#cache;
        }

        static async save() {
            await MyStorage.settings.setValue(this.#cache);
        }
    }

    class MyStorage {
        static indexedDb = new _Storages.IndexedDb("WoDReportArchiv", Mod.dbname);
        /**
         * Meta-Daten für einen Kammpfbericht
         */
        static reportArchive = this.indexedDb.createObjectStore("reportArchive", "reportId");
        /**
         * Erweiterte Daten für einen Kampfbericht. Z.B. Informationen der Gegenstandsseite (Equip + Loot)
         */
        static reportArchiveExt = this.indexedDb.createObjectStore("reportArchiveExt", "reportId");
        /**
         * Quell-Dateien der Kampfberichte
         */
        static reportArchiveSources = this.indexedDb.createObjectStore("reportArchiveSources", "reportId");
        /**
         * Informationen über die Locations (Dungeons, Schlachten). Z.B. Erkennung der Dungeonversion.
         */
        static location = this.indexedDb.createObjectStore("location", "name");
        /**
         * Einstellungen dieser Mod.
         */
        static settings = this.indexedDb.createObjectStore("settings", "name");

        static getReportDBMeta() {
            return this.reportArchive;
        }

        static async getSourceReport(reportId) {
            return await this.reportArchiveSources.getValue(reportId);
        }

        static async setSourceReport(report) {
            await this.reportArchiveSources.setValue(report);
        }

        static async putToExt(reportId, memberList) {
            const reportExt = await this.reportArchiveExt.getValue(reportId) || {reportId: reportId, members: {}};
            for (const [name, entry] of Object.entries(memberList)) {
                const member = reportExt.members[name] || (reportExt.members[name] = {});
                for (const [entryKey, entryValue] of Object.entries(entry)) {
                    member[entryKey] = entryValue;
                }
            }
            await this.reportArchiveExt.setValue(reportExt);
            return reportExt;
        }

        static async submitLoot(report, reportExt) {
            for (const member of Object.values(reportExt.members)) {
                if (member.loot) {
                    for (const item of member.loot) {
                        if (member.stufe) {
                            await _WoDLootDb.addLootSafe(item.name, report.title, report.ts, report.world, member.stufe);
                        } else {
                            if (report.stufe) {
                                await _WoDLootDb.addLootUnsafe(item.name, report.title, report.ts, report.world, report.stufe);
                            } else {
                                console.error("Keine Stufe gefunden: ", report, reportExt);
                            }
                        }
                    }
                }
            }
        }

    }

    class WoD {

        static getAllHeroIds() {
            let result = {};
            for (const cur of document.querySelectorAll(".content_table a[href*=\"/profile.php\"]")) {
                const id = new URL(cur.href).searchParams.get("id");
                if (result[id]) break;
                result[id] = true;
                if (Object.keys(result).length >= 12) break;
            }
            result = Object.keys(result);
            console.log("HeorIds: ", result);
            return result;
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
            const zip = await _Libs.getJSZip();
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
            const downloadFileName = reportMeta.gruppe + "_" + reportMeta.title + "_" + _util.formatDateAndTime(new Date(reportMeta.ts)).replaceAll(".", "_") + ".zip";
            zip.generateAsync({type: "blob"}).then(function (content) {
                console.log("File '" + downloadFileName + "' is ready!");
                _File.forDownload(downloadFileName, content);
            }).catch(error => console.error("Zip-Erro: ", error));
        }

    }

    Mod.startMod();

})();