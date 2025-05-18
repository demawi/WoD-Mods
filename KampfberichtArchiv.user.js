// ==UserScript==
// @name           [WoD] Kampfbericht Archiv
// @author         demawi
// @namespace      demawi
// @description    Lässt einen die Seiten der Kampfberichte direkt downloaden
// @version        0.11.2
// @include        https://*/wod/spiel/*dungeon/report.php*
// @include        https://*/wod/spiel/clanquest/combat_report.php*
// @include        https://*/wod/spiel/clanquest/move.php*
// @include        https://*/wod/spiel/hero/item.php*
// @include        https://*/wod/spiel/settings/heroes.php*
// @include        https://*/wod/spiel/dungeon/dungeon.php*
// @include        https://*/wod/spiel/hero/items.php*
// @include        https://*/wod/spiel/news/news.php*
// @include        https://*/wod/spiel/rewards/tombola.php*
// @include        http*://*.world-of-dungeons.de*
// @require        repo/DemawiRepository.js?version=1.0.4
// @require        libs/jszip.min.js
// @require        https://code.jquery.com/jquery-3.7.1.min.js
// @require        https://code.jquery.com/ui/1.14.1/jquery-ui.js
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
    const _WoDStorages = demawiRepository.import("WoDStorages");
    const _WoDWorldDb = demawiRepository.import("WoDWorldDb");
    const _WoDParser = demawiRepository.import("WoDParser");
    const _WoDLootDb = demawiRepository.import("WoDLootDb");
    const _util = demawiRepository.import("util");
    const _UI = demawiRepository.import("UI");
    const _File = demawiRepository.import("File");
    const _Libs = demawiRepository.import("Libs");
    const _Settings = demawiRepository.import("Settings");
    const _ItemParser = demawiRepository.import("ItemParser");

    class Mod {
        static dbname = "wodDB";
        static modname = "KampfberichtArchiv";

        static async startMod() {
            demawiRepository.startMod();
            _WoDWorldDb.placeSeasonElem();
            const page = _util.getWindowPage();
            console.log("Page: '" + page + "'")
            switch (page) {
                case "tombola.php":
                    await TombolaLoot.onTombolaPage();
                    break;
                case "": // Login-/News-Page
                case "news.php":
                    await TombolaLoot.onNewsPage();
                    break;
                case "items.php":
                    const view = new URL(window.location.href).searchParams.get("view");
                    if (!view || view === "gear") await Ausruestung.start();
                    break;
                case "dungeon.php":
                    await DungeonAuswahl.start();
                    break;
                case "heroes.php":
                    await _WoDWorldDb.onMeineHeldenAnsicht();
                    break;
                case "move.php":
                    await this.onMovePage();
                    break;
                case "item.php":
                    await _ItemParser.onItemPage();
                    await ItemFunde.start();
                    break;
                case "report.php":
                    const title = document.getElementsByTagName("h1")[0];
                    if (title.textContent.trim() === "Kampfberichte") {
                        await ArchivView.onKampfberichteSeite();
                    } else {
                        await this.onReportSite();
                    }
                    break;
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
                            const locName = boldElements[0].textContent + " vs. " + boldElements[1].textContent;
                            const searchParams = new URL(aElem.href).searchParams;
                            const reportId = _WoD.getMyWorld() + searchParams.get("report");
                            const battleId = searchParams.get("battle");
                            let tsMsecs = undefined;
                            for (const h2 of roundX.getElementsByTagName("h2")) {
                                const text = h2.textContent;
                                if (text.startsWith("Runde")) {
                                    const timeString = text.substring(text.indexOf("(") + 1, text.indexOf(")"));
                                    tsMsecs = _WoD.getTimestampFromString(timeString);
                                }
                            }
                            const win = boldElements[2].textContent === "Angreifer";
                            const report = await MyStorage.reportArchive.getValue(reportId) || {
                                reportId: reportId,
                                loc: {
                                    name: locName,
                                },
                                ts: tsMsecs / 60000,
                                success: {
                                    levels: [win ? 1 : 0, 1],
                                }
                            };
                            report.loc.schlacht = schlachtName;
                            report.ts = tsMsecs / 60000;
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

            const reportData = _WoD.getFullReportBaseData();
            const reportMeta = await MyStorage.reportArchive.getValue(reportData.reportId) || reportData;
            reportMeta.world_season = await _WoD.getMyWorldSeasonNr(); // sollte immer aufgerufen werden, damit sich auch die Saison-Zeit der Gruppe aktualsiert

            title.append(await _WoDWorldDb.createSeasonElem(reportMeta.world_season));

            const berichtsseiteSpeichernButton = _UI.createButton(" 💾", () => {
                util.htmlExport();
            });
            berichtsseiteSpeichernButton.title = "Einzelne Seite exportieren";
            berichtsseiteSpeichernButton.classList.add("nowod");
            title.appendChild(berichtsseiteSpeichernButton);
            if (document.getElementsByClassName("paginator").length > 0) {
                const warning = document.createElement("span");
                warning.style.fontSize = "16px";
                warning.innerHTML = "<br>⚠️ Dieser Level wird nicht vollständig auf einer Seite angezeigt und kann entsprechend nicht vollständig gespeichert werden. Bitte die Anzahl angezeigter Einträge entsprechend hochsetzen, so dass der Level vollständig auf einer Seite angezeigt wird. ⚠️"
                warning.classList.add("nowod");
                title.appendChild(warning);
            }

            if (reportData.loc.schlacht) reportMeta.loc.schlacht = reportData.loc.schlacht; // kommt evtl. nachträglich erst herein
            if (!reportMeta.stufe) reportMeta.stufe = reportData.stufe; // Stufe nur setzen, wenn noch nicht vorhanden.
            if (!reportMeta.srcs) reportMeta.srcs = {};
            const reportSource = await MyStorage.getSourceReport(reportData.reportId) || {
                reportId: reportData.reportId,
                srcs: {},
            };
            console.log("Current Report ", reportData, reportMeta, reportSource);

            if (title.textContent.trim().startsWith("Kampfstatistik")) {
                reportSource.stats = WoD.getPlainMainContent().documentElement.outerHTML;
                reportMeta.srcs.stats = true;
                reportMeta.success = _WoDParser.retrieveSuccessInformationOnStatisticPage(document, reportMeta.success);
            } else if (title.textContent.trim().startsWith("Übersicht Gegenstände")) {
                reportSource.items = WoD.getPlainMainContent().documentElement.outerHTML;
                reportMeta.srcs.items = true;
                const memberList = _WoDParser.parseKampfberichtGegenstaende();
                const reportLoot = await MyStorage.putToLoot(reportSource.reportId, memberList);
                await MyStorage.submitLoot(reportMeta, reportLoot);
                if ((await MySettings.get()).lootSummary) await ItemLootSummary.einblenden(reportLoot, reportMeta);
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
                if (!reportMeta.srcs.levels) reportMeta.srcs.levels = [];
                reportSource.levels[levelNr - 1] = WoD.getPlainMainContent().documentElement.outerHTML;
                reportMeta.srcs.levels[levelNr - 1] = true;

                const heldenListe = _WoDParser.getHeldenstufenOnKampfbericht();
                if (heldenListe) { // da wir hier jetzt auch die Stufe der Helden haben, bringen wir auch von hier den Loot ein.
                    const reportLoot = await MyStorage.putToLoot(reportMeta.reportId, heldenListe);
                    await MyStorage.submitLoot(reportMeta, reportLoot);
                }
                if (_WoD.isSchlacht()) reportMeta.success = _WoDParser.updateSuccessInformationsInSchlachtFromBattleReport(document, reportMeta.success);
                ReportView.changeView(reportMeta);
            }
            reportMeta.srcs.space = _util.getSpace(reportSource);
            delete reportMeta.loc.v_; // eine evtl. vorherige vorläufige VersionsId löschen
            await MyStorage.reportArchive.setValue(reportMeta);
            await MyStorage.reportArchiveSources.setValue(reportSource);

            await Location.getVersions(reportMeta, reportSource);
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

    class ArchivView {
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

            for (const report of await MyStorage.reportSourcesMeta.getAll()) {
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

        /**
         * Location.versions müssten auch zurückgesetzt werden
         */
        static async resyncVersions() {
            console.log("resyncVersions...");
            for (const location of await MyStorage.location.getAll()) {
                location.versions = [];
                await MyStorage.location.setValue(location);
            }
            for (const report of await MyStorage.reportArchive.getAll()) {
                delete report.loc.v;
                delete report.loc.v_;
                delete report.versions;
                await Report.getVersion(report);
                await MyStorage.reportArchive.setValue(report);
            }
            console.log("resyncVersions finished!");
        }

        static async checkMaintenance() {
            const settings = await MySettings.get();

            // Zuerst Auto-Favoriten erst dann Löschen
            if (settings.updateAutoFavoritAll) {
                await AutoFavorit.checkAutoFavoritenForTagName(AutoFavorit.TAG_ALL, !settings.autoFavoritAll);
                delete settings.updateAutoFavoritAll;
                await MySettings.save();
            }
            if (false && settings.updateAutoFavoritAllSeason) {
                //await AutoFavorit.checkAutoFavoriten(AutoFavorit.TAG_ALL_SEASON, !settings.autoFavoritAllSeason);
                delete settings.updateAutoFavoritAllSeason;
                await MySettings.save();
            }
            if (settings.updateAutoFavoritGroup) {
                await AutoFavorit.checkAutoFavoritenForTagName(AutoFavorit.TAG_GROUP, !settings.autoFavoritGroup);
                delete settings.updateAutoFavoritGroup;
                await MySettings.save();
            }
            if (false && settings.updateAutoFavoritGroupSeason) {
                //await AutoFavorit.checkAutoFavoriten(AutoFavorit.TAG_GROUP_SEASON, !settings.autoFavoritGroupSeason);
                delete settings.updateAutoFavoritGroupSeason;
                await MySettings.save();
            }
            if (settings.autoLoeschen && !settings.autoLoeschenDate || new Date(settings.autoLoeschenDate) < new Date().setDate(new Date().getDate() - 1)) {
                console.log("Auto Löschen wird ausgeführt!");
                settings.autoLoeschenDate = new Date().getTime();
                await MySettings.save();
            }
        }

        /**
         * Löscht reportArchive.success - Information und schreibt sie neu.
         */
        static async rewriteSuccessInformation() {
            for (const reportSource of await MyStorage.reportArchiveSources.getAll()) {
                const report = await MyStorage.reportArchive.getValue(reportSource.reportId);
                delete report.success;
                console.log("Bearbeite: ", report.reportId);
                if (reportSource.stats) {
                    const doc = _util.getDocumentFor(reportSource.stats);
                    report.success = _WoDParser.retrieveSuccessInformationOnStatisticPage(doc);
                }
                if (reportSource.levels && reportSource.levels[0]) {
                    const doc = _util.getDocumentFor(reportSource.levels[0]);
                    if (_WoD.isSchlacht(doc)) report.success = _WoDParser.updateSuccessInformationsInSchlachtFromBattleReport(doc, report.success);
                }
                await MyStorage.reportArchive.setValue(report);
            }
        }

        static async rewriteReportArchiveItems() {
            for (const reportSource of await MyStorage.reportArchiveSources.getAll()) {
                if (reportSource.items) {
                    const doc = _util.getDocumentFor(reportSource.items);
                    const memberList = _WoDParser.parseKampfberichtGegenstaende(doc);
                    await MyStorage.putToLoot(reportSource.reportId, memberList);
                }
                if (reportSource.levels && reportSource.levels[0]) {
                    const doc = _util.getDocumentFor(reportSource.levels[0]);
                    const helden = _WoDParser.getHeldenstufenOnKampfbericht(doc);
                    if (helden) await MyStorage.putToLoot(reportSource.reportId, helden);
                }
            }
        }

        static async syncReportArchiveItems2ItemLoot() {
            for (const reportExt of await MyStorage.reportArchiveItems.getAll()) {
                const report = await MyStorage.reportArchive.getValue(reportExt.reportId);
                await MyStorage.submitLoot(report, reportExt);
            }
        }

        static async rewriteSeasonIds() {
            for (const report of await MyStorage.reportArchive.getAll()) {
                delete report.group_season;
                report.world_season = 1;
                await MyStorage.reportArchive.setValue(report);
            }
        }

        static async resyncSourcesToReports() {
            for (const report of await MyStorage.reportArchive.getAll()) {
                delete report.srcs;
                delete report.space;
                const reportSource = await MyStorage.reportArchiveSources.getValue(report.reportId);
                if (reportSource) {
                    const srcs = {};
                    if (reportSource.stats) srcs.stats = true;
                    if (reportSource.items) srcs.items = true;
                    if (reportSource.levels) {
                        srcs.levels = [];
                        for (const cur of reportSource.levels) {
                            srcs.levels.push(cur ? true : undefined);
                        }
                    }
                    if (Object.entries(srcs).length > 0) {
                        srcs.space = JSON.stringify(reportSource).length;
                        report.srcs = srcs;
                    }
                }
                await MyStorage.reportArchive.setValue(report);
            }
        }

        static async onKampfberichteSeite() {
            //await MyStorage.indexedDb.cloneTo("wodDB_Backup4");
            //await this.resyncSourcesToReports();

            if (false) {
                console.log("AAAAAAAAAAA", (await MyStorage.reportArchive.getAll({
                    index: "locName",
                    keyRange: IDBKeyRange.only("Ahnenforschung"),
                })).length);
            }

            //await this.syncReportLootToItemLoot();

            //await MyStorage.indexedDb.deleteObjectStore("teest");


            await this.checkMaintenance();
            this.title = document.getElementsByTagName("h1")[0];
            const seasonNr = await _WoD.getMyWorldSeasonNr();

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
                await ArchivView.showStatistics();
                thisObject.title.appendChild(buttons.wodContentButton);
                thisObject.title.appendChild(buttons.archivButton);
                thisObject.title.appendChild(buttons.settingButton);
            });
            buttons.statisticsButton.title = "Statistik anzeigen";
            buttons.wodContentButton = _UI.createButton(" ↩", async function () {
                thisObject.title.innerHTML = "Kampfberichte";
                const seasonNr = await _WoD.getMyWorldSeasonNr();
                await ArchivView.showWodOverview();
                thisObject.title.appendChild(buttons.archivButton);
                thisObject.title.appendChild(buttons.statisticsButton);
                thisObject.title.appendChild(buttons.settingButton);
            });
            buttons.wodContentButton.title = "Zurück zu den Kampfberichten";
            buttons.settingButton = _UI.createButton(" ⚙", async function () {
                thisObject.title.innerHTML = "Kampfberichte - Archiv-Einstellungen";
                await ArchivView.showSettings();
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
            _Libs.useJQueryUI().then(a => ArchivSearch.loadArchivView());
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
                const locName = report.loc.name;
                let dungeonStat = dungeonStats[locName];
                if (!dungeonStat) {
                    dungeonStat = {space: 0};
                    dungeonStats[locName] = dungeonStat;
                    const location = await MyStorage.location.getValue(locName);
                    dungeonStat.versions = location && location.versions ? Object.keys(location.versions).length : 0;
                }
                if (report.srcs) {
                    console.log(report.srcs.space);
                    memorySpace += report.srcs.space;
                    dungeonStat.space = (dungeonStat.space || 0) + report.srcs.space;
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
                dungeonTableModell.push([dungeonName, dungeonStat.versions, (dungeonStat.full || 0) + (dungeonStat.part || 0) + (dungeonStat.wipe || 0), dungeonStat.full || 0, dungeonStat.part || 0, dungeonStat.wipe || 0, _util.fromBytesToMB(dungeonStat.space)]);
            }
            statTable.append(_UI.createContentTable(dungeonTableModell, ["Dungeon", "Versionen", "Gesamt", "Erfolg", "Teilerfolg", "Misserfolg", "Speicher"]));
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
                        loc: {
                            name: curTR.children[1].textContent.trim(),
                        },
                        ts: _WoD.getTimestampFromString(curTR.children[0].textContent.trim()) / 60000,
                        gruppe: _WoD.getMyGroupName(),
                        gruppe_id: _WoD.getMyGroupId(),
                        world: _WoD.getMyWorld(),
                    }
                    await MyStorage.reportArchive.setValue(reportMeta);
                }
                await DungeonAuswahl.addDungeonStats(curTR.children[1], reportMeta.loc.name);
                const reportExt = await MyStorage.reportArchiveItems.getValue(reportMeta.reportId);
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

                const getFullLocName = async function (report) {
                    let locName = report.loc.name;
                    if (await Location.hasMoreThanOneVersion(reportMeta)) {
                        const versionNr = await Report.getVersion(reportMeta);
                        if (versionNr) locName += " (v" + versionNr + ")";
                        else locName += " (v?)";
                    }
                    return locName;
                }
                if (await Location.hasMoreThanOneVersion(reportMeta)) {
                    const nameTD = curTR.children[1];
                    const locName = await getFullLocName(reportMeta);
                    if (nameTD.textContent !== locName) {
                        if (locName.includes("v?")) nameTD.title = "Version wird erst bestimmt, wenn alle Level eingelesen wurden";
                        nameTD.innerHTML = locName;
                    }
                }

                const archiviertTD = document.createElement("td");
                archiviertTD.style.textAlign = "center";
                archiviertTD.style.width = "40px";
                const archiviertSpeicherTD = document.createElement("td");
                archiviertSpeicherTD.style.textAlign = "center";
                archiviertSpeicherTD.style.width = "40px";
                const hatDatensaetze = !!reportMeta.srcs;
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
                            return "- " + await getFullLocName(report) + "\n        [" + report.gruppe + "; " + _util.formatDateAndTime(new Date(report.ts * 60000)) + "]";
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
                    archiviertTD.style.backgroundColor = ArchivView.COLOR_RED;
                    archiviertAktionenTD.style.backgroundColor = ArchivView.COLOR_RED;
                    archiviertSpeicherTD.style.backgroundColor = ArchivView.COLOR_RED;
                    archiviertTD.innerHTML += "<span style='white-space: nowrap'>Fehlt komplett</span>";
                } else {
                    if (reportMeta.space) {
                        archiviertSpeicherTD.innerHTML = _util.fromBytesToMB(reportMeta.space);
                    }
                    const fehlend = Report.getMissingReportSites(reportMeta);
                    if (fehlend.length === 0) {
                        archiviertTD.style.backgroundColor = ArchivView.COLOR_GREEN;
                        archiviertSpeicherTD.style.backgroundColor = ArchivView.COLOR_GREEN;
                        archiviertAktionenTD.style.backgroundColor = ArchivView.COLOR_GREEN;
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
                        archiviertTD.style.backgroundColor = ArchivView.COLOR_YELLOW;
                        archiviertSpeicherTD.style.backgroundColor = ArchivView.COLOR_YELLOW;
                        archiviertAktionenTD.style.backgroundColor = ArchivView.COLOR_YELLOW;
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
                            curTR.style.backgroundColor = ArchivView.COLOR_GREEN;
                            successWin++;
                        } else if (members[0] > 0) {
                            curTR.style.backgroundColor = ArchivView.COLOR_YELLOW;
                            successTie++;
                        } else {
                            curTR.style.backgroundColor = ArchivView.COLOR_RED;
                            successLose++;
                        }
                    } else if (levels) {
                        if (levels[0] > -1) {
                            if (levels[0] !== levels[1]) {
                                curTR.style.backgroundColor = ArchivView.COLOR_RED;
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
            const settings = await MySettings.get(true);
            const settingTable = document.createElement("div");
            await this.createAutoFavorit(settingTable, settings);
            await this.createLoeschautomatik(settingTable, settings);
            await this.createSonstiges(settingTable, settings);
            await this.createExperteneinstellungen(settingTable, settings);
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
                    await MySettings.save();
                });
            autoLoeschenTage.size = 4;

            let updateVisibility;
            const autoLoeschen = this.createCheckBox(() => settings.autoLoeschen,
                async function (value) {
                    settings.autoLoeschen = value;
                    if (!value) {
                        delete settings.autoLoeschenDate;
                    }
                    await MySettings.save();
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

        static async createSonstiges(settingTable, settings) {
            this.addHeader(settingTable, "Sonstiges", "");
            const tableContent = [];

            const lootSummaryCheckbox = this.createCheckBox(() => settings.lootSummary,
                async function (value) {
                    settings.lootSummary = value;
                    await MySettings.save();
                });

            tableContent.push(["Zusammenfassung Gegenstandsseite: ", lootSummaryCheckbox]);

            const autoFavoritTable = _UI.createTable(tableContent);
            settingTable.append(autoFavoritTable);
        }

        static async createExperteneinstellungen(settingTable, settings) {
            this.addHeader(settingTable, "Experteneinstellungen", "Die Funktionalitäten hier bitte nur mit Bedacht nutzen.");
            const tableContent = [];

            const anlegenNeueGruppenSaison = document.createElement("input");
            anlegenNeueGruppenSaison.type = "button";
            anlegenNeueGruppenSaison.value = "Neue Weltsaison erzwingen";
            anlegenNeueGruppenSaison.title = "Nach jedem Weltneustart sollte sich die Weltsaisons-Nummer auf der Helden-Ansicht um eins erhöhen. Sollte die Automatik nicht greifen. Bitte hierüber eine neue SaisonNr vergeben lassen";
            anlegenNeueGruppenSaison.onclick = async function () {
                const confirmation = window.confirm("Wollen sie wirklich eine neue WeltSaisonNr vergeben?\n\nDanach bitte die Helden-Ansicht aufrufen, damit alle Helden für die neue Saison registriert werden");
                if (confirmation) {
                    await _WoDWorldDb.forceNewSeason();
                    await ArchivView.showSettings();
                }
            }

            let text = "";
            const worldSeasonNr = await await _WoDWorldDb.getCurrentWorldSeasonNr();
            if (worldSeasonNr) text = "#" + worldSeasonNr;
            else text = "Bitte nochmal die Heldenansicht aufrufen!";

            tableContent.push(["Aktuelle Weltsaison: " + text, worldSeasonNr ? anlegenNeueGruppenSaison : ""]);

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
                    await MySettings.save();
                });
            autoLoeschenFavoritAll.title = "Es wird generell nur je ein Dungeon markiert.";
            const autoLoeschenFavoritAllSeason = this.createCheckBox(() => settings.autoFavoritAllSeason,
                async function (value) {
                    settings.autoFavoritAllSeason = value;
                    settings.updateAutoFavoritAllSeason = true;
                    await MySettings.save();
                });
            autoLoeschenFavoritAllSeason.title = "Pro Saison wird genau je ein Dungeon markiert.";

            const autoLoeschenFavoritLabelGroup = document.createElement("span");
            autoLoeschenFavoritLabelGroup.innerHTML = "Auto-Favoriten <b>pro Gruppe</b> markieren:";
            autoLoeschenFavoritLabelGroup.title = "Für jede Gruppe wird je ein Dungeon markiert.";
            const autoLoeschenFavoritGroup = this.createCheckBox(() => settings.autoFavoritGroup,
                async function (value) {
                    settings.autoFavoritGroup = value;
                    settings.updateAutoFavoritGroup = true;
                    await MySettings.save();
                });
            autoLoeschenFavoritGroup.title = "Für jede Gruppe wird generell nur je ein Dungeon markiert.";
            const autoLoeschenFavoritGroupSeason = this.createCheckBox(() => settings.autoFavoritGroupSeason,
                async function (value) {
                    settings.autoFavoritGroupSeason = value;
                    settings.updateAutoFavoritGroupSeason = true;
                    await MySettings.save();
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

            tableContent.push([autoLoeschenFavoritLabelAll, getFavoritCheckBox(autoLoeschenFavoritAll, AutoFavorit.TAG_ALL), MySettings.SEASONS_ACTIVATED ? getFavoritCheckBox(autoLoeschenFavoritAllSeason, AutoFavorit.TAG_ALL_SEASON) : ""]);
            tableContent.push([autoLoeschenFavoritLabelGroup, getFavoritCheckBox(autoLoeschenFavoritGroup, AutoFavorit.TAG_GROUP), MySettings.SEASONS_ACTIVATED ? getFavoritCheckBox(autoLoeschenFavoritGroupSeason, AutoFavorit.TAG_GROUP_SEASON) : ""]);
            const autoFavoritTable = _UI.createTable(tableContent, MySettings.SEASONS_ACTIVATED ? ["", "Saisonübergreifend", "pro Saison"] : "");
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

        static async einblenden(reportLoot, reportMeta) {
            reportMeta = reportMeta || await MyStorage.reportArchive.getValue(reportLoot.reportId);
            const memberList = reportLoot.members;
            const eingesammeltPre = {};
            const beschaedigtPre = [];
            const verlorenPre = {};
            const vgsPre = {};
            let gold = 0;
            let gesamtschaden = 0;
            const messages = [];

            for (const [memberId, items] of Object.entries(memberList)) {
                const memberName = items.name;
                gold += items.gold || 0;
                const lootToList = items.ko ? verlorenPre : eingesammeltPre;
                if (items.exceed) messages.push([memberName + " hat seine Lagerkapazität überschritten! (" + items.exceed + ")", ArchivView.COLOR_RED]);
                if (items.full) messages.push([memberName + " konnte aufgrund eines vollen Rucksacks nicht mehr alles einsammeln!", ArchivView.COLOR_YELLOW]);
                for (const curItem of (items.loot || [])) {
                    const item = lootToList[curItem.name] || (lootToList[curItem.name] = {from: []});
                    item.from.push(memberName);
                    if (curItem.vg) item.vg = (item.vg || 0) + curItem.vg;
                    if (curItem.unique) item.unique = true;
                }
                for (const curEquip of items.equip) {
                    if (curEquip.hp && curEquip.hp[2]) {
                        beschaedigtPre.push({item: curEquip, owner: memberName});
                        gesamtschaden += curEquip.hp[2];
                    }
                    if (curEquip.vg) {
                        const memberVGs = vgsPre[memberName] || (vgsPre[memberName] = {});
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

            let [eingesammeltData, eingesammeltCount, eingesammeltEindeutig] = await this.getItemLootAndDropTable(reportMeta, eingesammeltPre, true);
            let curColor = eingesammeltEindeutig > 0 ? "background-color:rgb(62, 156, 62, 0.5);" : "";
            summaryContainer.append(this.flowLayout(_UI.createContentTable(eingesammeltData, [{
                data: "",
                style: curColor,
            }, {data: "#", style: curColor},
                {
                    data: "eingesammelte Items: " + (eingesammeltEindeutig === eingesammeltCount ? eingesammeltEindeutig : eingesammeltEindeutig + " / " + eingesammeltCount),
                    title: eingesammeltEindeutig === eingesammeltCount ? undefined : "Unterschiedliche / Gesamt",
                    style: eingesammeltEindeutig === eingesammeltCount ? curColor : "cursor:help;" + curColor,
                }])));

            let [verlorenData, verlorenCount, verlorenCountEindeutig] = await this.getItemLootAndDropTable(reportMeta, verlorenPre, false);
            curColor = verlorenCount > 0 ? "background-color:rgb(194, 194, 41, 0.5);" : "";
            summaryContainer.append(this.flowLayout(_UI.createContentTable(verlorenData, [{
                data: "",
                style: curColor,
            }, {data: "#", style: curColor},
                {
                    data: "verlorene Items: " + (verlorenCount === verlorenCountEindeutig ? verlorenCount : verlorenCountEindeutig + " / " + verlorenCount),
                    title: verlorenCount === verlorenCountEindeutig ? undefined : "Unterschiedliche / Gesamt",
                    style: verlorenCount === verlorenCountEindeutig ? curColor : "cursor:help;" + curColor,
                }])));

            let [data, count] = this.getItemDamageTable(beschaedigtPre);
            curColor = count > 0 ? "background-color:rgb(203, 47, 47, 0.5);" : "";
            summaryContainer.append(this.flowLayout(_UI.createContentTable(data, [{
                data: "Held",
                style: curColor,
            }, {data: "HP", style: curColor}, {
                data: gesamtschaden,
                style: curColor,
            }, {data: "beschädigte Items: " + count, style: curColor}])));

            [data, count] = this.getItemUsedTable(vgsPre);
            curColor = count > 0 ? "background-color:rgb(255, 255, 255, 0.5);" : "";
            summaryContainer.append(this.flowLayout(_UI.createContentTable(data, [{data: "Held", style: curColor}, {
                data: "Anw.",
                title: "Übrig/Mitgenommen (Verbraucht)",
                style: "cursor: help;" + curColor,
            }, {data: "", style: curColor}, {data: "verwendete VGs: " + count, style: curColor}])));

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

        static flowLayout(div, add) {
            div.style.display = "inline-flex";
            div.style.fontSize = "90%";
            div.style.padding = "5px";
            div.style.border = 0;
            if (add) this.copyTo(add, div);
            return div;
        }

        static copyTo(obj1, obj2) {
            for (const [key, value] of Object.entries(obj1)) {
                if (typeof value === "object") {
                    const value2 = obj2[key];
                    this.copyTo(value, value2);
                } else {
                    obj2[key] = value;
                }
            }
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
                    const color = item.vg[0] === 0 ? ArchivView.COLOR_RED : (item.vg[0] < -item.vg[2] ? ArchivView.COLOR_YELLOW : "");
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
                const color = item.hp[0] === 0 ? ArchivView.COLOR_RED : (item.hp[0] < 7 ? ArchivView.COLOR_YELLOW : "");
                result.push([held, {data: hp1, style: "text-align:center;background-color:" + color}, {
                    data: hp2,
                    style: "text-align:center;background-color:" + color
                }, desc]);
                lastOwner = entry.owner;
            }
            return [result, beschaedigtPre.length];
        }

        static async getItemLootAndDropTable(reportMeta, eingesammeltPre, gesammelt) {
            const eingesammelt = [];
            let eingesammeltCount = 0;
            let firstVG = true;
            let hatteNichtVGs = false;
            for (const [itemName, entry] of Object.entries(eingesammeltPre).sort(([a, a2], [b, b2]) => {
                let result = ((a2.vg / a2.vg) || 0) - ((b2.vg / b2.vg) || 0); // Nicht Verbrauchsgegenstände zuerst
                if (result !== 0) return result;
                result = (a2.unique && 1 || 0) - (b2.unique && 1 || 0);
                if (result !== 0) return result;
                return a.localeCompare(b);
            })) {
                eingesammeltCount += entry.from.length;
                hatteNichtVGs = hatteNichtVGs || !entry.vg;
                const anzahl = document.createElement("span");
                const curCount = entry.vg || entry.from.length;
                anzahl.innerHTML = curCount > 1 ? curCount : "";
                const [markers, itemsLootedBefore] = await this.createMarkers(itemName, reportMeta);
                const itemsLootedInSum = itemsLootedBefore + (gesammelt ? (curCount || 1) : 0);
                const itemLink = this.getFullItemNode(itemName, entry.id);
                const ownerAnzeige = gesammelt && !entry.vg && !entry.unique;
                let addStyle = "";
                if (firstVG && entry.vg && hatteNichtVGs) {
                    addStyle = "border-top: 3px solid white;"
                    firstVG = false;
                }
                let name = itemLink.innerHTML + (ownerAnzeige ? " (" + entry.from.join(", ") + ")" : (entry.from.length > 1 ? " (" + entry.from.length + "x" + ")" : ""));
                eingesammelt.push([{data: markers, style: addStyle}, {
                    data: anzahl,
                    style: "text-align:center;cursor:help;" + addStyle,
                    title: "Bisher in der Saison gelootet: " + itemsLootedInSum,
                }, {
                    data: name,
                    style: "cursor:help;" + addStyle,
                    title: "Bisher in der Saison gelootet: " + itemsLootedInSum,
                }]);
            }
            return [eingesammelt, eingesammeltCount, eingesammelt.length];
        }

        static async createMarkers(itemName, reportMeta) {
            const elem = document.createElement("span");
            const dungeonUnique = await _WoDLootDb.isDungeonUnique(itemName);
            const lootedBeforeInWorldSeason = await _WoDLootDb.getLootedBefore(itemName, reportMeta.ts, reportMeta.world, reportMeta.world_season); // aktuell nicht auf die gruppe beschränkt
            if (dungeonUnique) elem.append(this.createMarker("✨", "Wurde bisher nur in diesem Dungeon gedroppt")); // 🌟
            if (lootedBeforeInWorldSeason === 0) elem.append(this.createMarker("🥇", "Wurde zuvor in dieser Saison auf dieser Welt noch nicht gelootet"));
            return [elem, lootedBeforeInWorldSeason];
        }

        static createMarker(text, title) {
            const result = document.createElement("span");
            result.innerHTML = text;
            if (title) {
                result.title = title;
                result.style.cursor = "help";
            }
            return result;
        }
    }

    class Ausruestung {
        static async start() {
            const naechsterDungeonName = _WoDParser.getNaechsterDungeonName();
            if (!naechsterDungeonName) return;
            // const ausruestungsTabelleKomplett = document.querySelectorAll("table:has(table #ausruestungstabelle_0):not(table:has(table table #ausruestungstabelle_0))")[0];
            const ausruestungsTabelle = document.querySelector("#ausruestungstabelle_2").parentElement.parentElement;

            let lastKey;
            for (const cur of await MyStorage.reportArchive.getAll({
                index: ["loc.name"],
                keyRange: [naechsterDungeonName],
                order: "prev",
                limit: 1,
            })) {
                lastKey = cur.reportId;
            }
            if (!lastKey) return;
            const items = await MyStorage.reportArchiveItems.getValue(lastKey);
            if (!items) return;
            const myHeroId = _WoD.getMyHeroId();
            const myItems = items.members[myHeroId];
            if (!myItems) return;
            const vgInfos = {};
            for (const item of myItems.equip) {
                if (item.vg) {
                    const vgInfo = vgInfos[item.name] || (vgInfos[item.name] = {
                        used: 0,
                        count: 0
                    });
                    vgInfo.used += item.vg[2] || 0;
                    vgInfo.count += item.vg[0] || 0;
                }
            }
            const genutzteGegenstaende = [];
            for (const [itemName, vgInfo] of Object.entries(vgInfos)) {
                if (vgInfo.used < 0) {
                    genutzteGegenstaende.push([{
                        data: vgInfo.used + " / " + (vgInfo.count - vgInfo.used),
                        style: "text-align:center;"
                    }, itemName]);
                }
            }
            if (genutzteGegenstaende.length === 0) genutzteGegenstaende.push([undefined, "Es wurde nichts verbraucht"]);
            const table = _UI.createContentTable(genutzteGegenstaende, ["#", "Beim letzten Besuch in diesem Dungeons verbraucht"]);
            table.classList.add("nowod");
            //ausruestungsTabelleKomplett.parentElement.insertBefore(table, ausruestungsTabelleKomplett);
            ausruestungsTabelle.append(table);
            table.style.marginTop = "10px";
            table.style.marginBottom = "10px";
        }
    }

    class DungeonAuswahl {
        static async start() {
            const start = new Date().getTime();
            const dungeonTRs = document.querySelectorAll(".content_table > tbody > tr:not([id*=\"desc\"])");
            const gruppeId = _WoD.getMyGroupId();
            const world = _WoD.getMyWorld();
            const worldSeasonNr = await _WoD.getMyWorldSeasonNr();
            for (const tr of dungeonTRs) {
                const dungeonName = tr.children[0].textContent.trim();
                const [misserfolg, teilerfolg, erfolg] = await this.getSuccessLevelAndRatesForGroup(world, gruppeId, dungeonName, worldSeasonNr);
                tr.style.backgroundColor = erfolg ? ArchivView.COLOR_GREEN : (teilerfolg ? ArchivView.COLOR_YELLOW : (misserfolg ? ArchivView.COLOR_RED : ""));
                await this.addDungeonStats(tr.children[1], dungeonName);
            }
        }

        static async addDungeonStats(elem, dungeonName) {
            const thisObject = this;

            _WoD.addTooltip(elem, async function () {
                const world = _WoD.getMyWorld();
                const worldSeasonNr = await _WoD.getMyWorldSeasonNr();
                const gruppeId = _WoD.getMyGroupId();
                let title = await thisObject.getErfolgstext("Gruppenerfolge (aktuelle Saison)", thisObject.getSuccessLevelAndRatesForGroup(world, gruppeId, dungeonName, worldSeasonNr));
                const gruppenErfolg = await thisObject.getErfolgstext("Gruppenerfolge (Gesamt)", thisObject.getSuccessLevelAndRatesForGroup(world, gruppeId, dungeonName));
                title += "<br>" + gruppenErfolg;
                let lootedDungeonUniquesText = "";
                const lootedDungeonUniques = Object.entries(await _WoDLootDb.getLootedDungeonUniques(dungeonName, world, worldSeasonNr, gruppeId));
                for (const [itemName, count] of lootedDungeonUniques) {
                    lootedDungeonUniquesText += "<br>" + itemName + ": " + (count > 0 ? "✅ " + count : "❌");
                }
                title += "<br><br><b>DungeonUniques (" + lootedDungeonUniques.length + "):</b>" + lootedDungeonUniquesText;
                return title;
            }, true);
        }

        static async getErfolgstext(prefix, promise) {
            const [misserfolg, teilerfolg, erfolg] = await promise;
            return prefix + ": " + erfolg + " / " + teilerfolg + " / " + misserfolg;
        }

        static async getSuccessLevelAndRatesForGroup(world, gruppeId, dungeonName, worldSeasonNrOpt) {
            let result = [0, 0, 0];
            for (const report of await MyStorage.reportArchive.getAll({
                index: ["world", "gruppe_id", "loc.name", "world_season"], // index: "wgls",
                keyRange: [world, gruppeId, dungeonName, worldSeasonNrOpt ? worldSeasonNrOpt : _Storages.MATCHER.NUMBER.ANY],
            })) {
                const cur = Report.getSuccessLevel(report);
                if (cur !== undefined) {
                    result[cur + 1] += 1;
                }
            }
            return result;
        }

    }

    class TombolaLoot {
        static async onNewsPage() {
            for (const cur of document.querySelectorAll(".tombola_winner tr")) {
                const itemA = cur.querySelector("a[href*=\"/item.php?\"]");
                if (itemA) {
                    const tsMsecs = _WoD.getTimestampFromString(cur.children[0].textContent);
                    const itemName = itemA.textContent.trim();
                    await this.putToLoot(itemA, tsMsecs);
                    await _WoDLootDb.reportLootTombola(itemName, tsMsecs / 60000);
                }
            }
        }

        static async onTombolaPage() {
            const itemA = document.querySelector(".content_block a");
            if (itemA) {
                await this.putToLoot(itemA, new Date().getTime(), _WoD.getMyStufe());
            }
        }

        static async putToLoot(itemA, tsMsecs, stufe) {
            const itemName = itemA.textContent.trim();
            await _WoDLootDb.reportLootTombola(itemName, tsMsecs / 60000);
        }
    }

    class ItemFunde {

        /**
         * Zusatz für die Gegenstandsseite
         */
        static async start() {
            const hints = document.getElementsByClassName("hints")[0];
            if (!hints) return;
            const all = document.getElementsByTagName("h1")[0];
            const itemName = all.getElementsByTagName("a")[0].childNodes[0].textContent.trim();
            if (!itemName) return;
            const item = await _.WoDLootDb.getValue(itemName);
            const loot = (item && item.loot) || [];

            const header = ["Ort", "Zeit", "Von", "Stufe", "Welt", "Gelootet"];
            let content = [];
            const entries = Object.entries(loot);
            for (const [key, value] of entries) {
                const matcher = key.match(/^(\D+)(\d+)[|]?.*$/);
                const world = matcher[1];
                const ts = Number(matcher[2]) * 60000; // Timestamp ist in Minuten gespeichert
                content.push([value.loc, ts, value.quelle ? value.quelle : {
                    data: "-",
                    style: "text-align:center;"
                }, value.stufe ? {
                    data: value.stufe,
                    style: "text-align:center;",
                } : (value.stufe_ === undefined ? {
                    data: "-",
                    style: "text-align:center;"
                } : {data: "(" + value.stufe_ + ")", style: "text-align:center;"}), {
                    data: world,
                    style: "text-align:center"
                }, {
                    data: (value.count || "0"),
                    style: "text-align:center;"
                }]);
            }
            content.sort((a, b) => {
                return b[1] - a[1];
            });
            for (const value of content) {
                value[1] = _util.formatDateAndTime(new Date(value[1]));
            }
            const table = _UI.createContentTable(content, header);
            table.classList.add("nowod");
            table.style.marginLeft = "15px";
            const lootUeberschrift = document.createElement("h3");
            lootUeberschrift.classList.add("nowod");
            lootUeberschrift.style.marginLeft = "15px";
            lootUeberschrift.innerHTML = "Sichtungen <span style='font-size:10px'>(maximal " + _WoDLootDb.MAX_LOOT_ENTRIES + ")</span>";
            hints.parentElement.insertBefore(lootUeberschrift, hints);
            hints.parentElement.insertBefore(table, hints);
            if (entries.length > 1) {
                const aggregateInfos = [];
                let stufeMin = Number.MAX_VALUE;
                let stufeMax = 0;
                for (const cur of Object.keys(item.stufen)) {
                    const curNr = Number(cur);
                    if (curNr < stufeMin) stufeMin = curNr;
                    if (curNr > stufeMax) stufeMax = curNr;
                }
                aggregateInfos.push(["Stufe (min-max):", stufeMin + "-" + stufeMax]);
                aggregateInfos.push(["Unterschiedliche Dungeons:", Object.entries(item.locs).length]);
                const aggregateTable = _UI.createContentTable(aggregateInfos);
                aggregateTable.classList.add("nowod");
                aggregateTable.style.marginLeft = "15px";
                hints.parentElement.insertBefore(aggregateTable, table);
            }
        }
    }

    class ArchivSearch {
        static #loadingSymbol = "🌍 ";

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

            //const allReports = await MyStorage.getReportDBMeta().getAll("next", maxResults ? maxResults : undefined);
            //allReports.sort((a, b) => b.ts - a.ts);
            let switcher = false;
            const thisObject = this;
            let primaryDate = new Date();
            primaryDate.setDate(primaryDate.getDate() - ArchivSearch.AUSWAHL_BEVORZUGT);
            primaryDate = primaryDate.getTime() / 60000;
            const groupsFound = {};
            const groupsFoundPrimary = {};
            const worldsFound = {};
            const worldsFoundPrimary = {};
            const dungeonsFound = {};
            const dungeonsFoundPrimary = {};
            const maxResults = ArchivSearch.searchQuery.maxResults;
            let count = 0;
            await MyStorage.getReportDBMeta().getAll({
                index: "ts",
                order: "prev",
            }, async function (reportMeta, idx) {
                if (!thisObject.isValidDate(reportMeta)) return;
                if (!thisObject.isValidFavorit(reportMeta)) return;
                if (!thisObject.isValidType(reportMeta)) return;
                worldsFound[reportMeta.world] = true;
                if (thisObject.isValidDate(reportMeta, primaryDate)) worldsFoundPrimary[reportMeta.world] = true;
                if (!thisObject.isValidWorld(reportMeta)) return;
                groupsFound[reportMeta.gruppe] = true;
                if (thisObject.isValidDate(reportMeta, primaryDate)) groupsFoundPrimary[reportMeta.gruppe] = true;
                if (!thisObject.isValidGroup(reportMeta)) return;
                const locNameFull = await thisObject.getFullLocationName(reportMeta);
                dungeonsFound[reportMeta.loc.name] = locNameFull;
                if (thisObject.isValidDate(reportMeta, primaryDate)) dungeonsFoundPrimary[reportMeta.loc.name] = locNameFull;
                if (!thisObject.isValidDungeon(reportMeta)) return;
                count++;
                switcher = !switcher;
                const tr = document.createElement("tr");
                tr.className = switcher ? "row0" : "row1";
                tbody.append(tr);
                const dateTD = document.createElement("td");
                tr.append(dateTD);
                dateTD.innerText = _util.formatDateAndTime(reportMeta.ts * 60000);
                dateTD.style.textAlign = "center";
                const nameTD = document.createElement("td");
                tr.append(nameTD);
                nameTD.innerText = await thisObject.getFullLocationName(reportMeta);
                const actionsTD = document.createElement("td");
                tr.append(actionsTD);
                actionsTD.style.textAlign = "center";
                ArchivSearch.createReportActions(reportMeta, actionsTD, idx);
                if (maxResults && count >= maxResults) return false;
            });
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

        static getQuestFor(locName) {
            for (const [groupName, groupEntries] of Object.entries(this.quests)) {
                if (groupEntries.includes(locName)) return groupName;
            }
        }

        /**
         * Erweitert den loc.name durch den Quest- oder Schlachtbezeichner
         */
        static async getFullLocationName(reportMeta) {
            const loc = reportMeta.loc;
            if (loc.schlacht) return loc.schlacht + ": " + loc.name.replaceAll("Eure Gruppe vs. ", "");
            const groupName = this.getQuestFor(loc.name);
            if (groupName) return groupName + ": " + loc.name;
            return loc.name;
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
                for (const [locName, locNameFull] of Object.entries(dungeonsFoundPrimary).sort((a, b) => a[1].localeCompare(b[1]))) {
                    const selected = this.searchQuery.dungeonSelection.includes(locName) ? "selected" : "";
                    this.dungeonSelect.innerHTML += "<option value=\"" + locName + "\" " + selected + ">" + locNameFull + "</option>";
                }
                this.dungeonSelect.innerHTML += "<option disabled>⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯</option>";
            }
            for (const [locName, locNameFull] of Object.entries(dungeonsFound).sort((a, b) => a[1].localeCompare(b[1]))) {
                if (dungeonsFoundPrimary[locName]) continue;
                const selected = this.searchQuery.dungeonSelection.includes(locName) ? "selected" : "";
                this.dungeonSelect.innerHTML += "<option value=\"" + locName.replaceAll("'", "\'") + "\" " + selected + ">" + locNameFull + "</option>";
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
                    this.groupSelect.innerHTML += "<option value=\"" + dungeonName + "\" " + selected + ">" + dungeonName + "</option>";
                }
                this.groupSelect.innerHTML += "<option disabled>⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯</option>";
            }
            for (const dungeonName of Object.keys(groupsFound).sort()) {
                if (groupsFoundPrimary[dungeonName]) continue;
                const selected = this.searchQuery.groupSelection.includes(dungeonName) ? "selected" : "";
                this.groupSelect.innerHTML += "<option value=\"" + dungeonName + "\" " + selected + ">" + dungeonName + "</option>";
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
            if (dateMax && dateMax <= reportTime) return false;
            if (dateMin && dateMin >= reportTime) return false;
            return true;
        }

        static isValidType(report) {
            if (this.searchQuery.typeSelection.length === 0) return true;
            const locName = report.loc.name;
            let type;
            if (report.loc.schlacht) {
                type = "Schlacht";
            } else {
                const questName = this.getQuestFor(locName);
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
                if (!dungeonSelector.includes(report.loc.name)) return false;
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
            const maxResults = (await MySettings.get()).maxResults;
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
            ArchivView.anchor.removeChild(ArchivView.anchor.children[0]);
            ArchivView.anchor.append(this.archivView);
            if (this.scrollY) window.scroll(0, this.scrollY);
        }

        static createSearchTable() {
            const searchTable = document.createElement("div");
            searchTable.id = "orders";
            const content = [];
            const dateMinInput = this.createDatePicker();
            if (this.searchQuery.dateMin) dateMinInput.value = _util.formatDateAndTime(this.searchQuery.dateMin * 60000);
            const dateMaxInput = this.createDatePicker();
            if (this.searchQuery.dateMax) dateMaxInput.value = _util.formatDateAndTime(this.searchQuery.dateMax * 60000);
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
                    thisObject.searchQuery.dateMin = new Date(_util.parseStandardDateString(dateMinInput.value)).getTime() / 60000;
                } catch (e) {
                    thisObject.searchQuery.dateMin = null;
                }
                ArchivSearch.updateSearch();
            }
            dateMaxInput.onchange = function () {
                try {
                    thisObject.searchQuery.dateMax = new Date(_util.parseStandardDateString(dateMaxInput.value));
                    thisObject.searchQuery.dateMax.setDate(thisObject.searchQuery.dateMax.getDate() + 1);
                    thisObject.searchQuery.dateMax = thisObject.searchQuery.dateMax.getTime() / 60000;
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
            this.nurFavoritenSelect.innerHTML += "<option style='color:" + AutoFavorit.TAG_COLORS[AutoFavorit.TAG_ALL] + "'>" + FilterQuery.FAVORIT_AUTO_ALL + "</option>";
            this.nurFavoritenSelect.innerHTML += "<option style='color:" + AutoFavorit.TAG_COLORS[AutoFavorit.TAG_GROUP] + "'>" + FilterQuery.FAVORIT_AUTO_GROUP + "</option>";
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
                    const settings = await MySettings.get();
                    settings.maxResults = newValue;
                    await MySettings.save();
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
            await ArchivView.completeDungeonInformations(true, this.archivView);
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
            if (ArchivView.anchor.children[0] === this.archivView) {
                this.scrollY = window.scrollY;
            }
            ArchivView.anchor.removeChild(ArchivView.anchor.children[0]);
            const doc = _util.getDocumentFor(reportSiteHTML);
            const mainContent = doc.getElementsByClassName("main_content")[0];
            const temp = document.createElement("div");
            temp.innerHTML = mainContent.outerHTML;
            ArchivView.anchor.append(temp);
            ArchivView.title.scrollIntoView();
            const statExecuter = this.getErweiterteKampfstatistikExecuter();
            if (statExecuter) {
                const dbSourceReport = await MyStorage.reportArchiveSources.getValue(reportSource.reportId);
                if (pageType === ArchivView.PAGE_TYPE_REPORT || pageType === ArchivView.PAGE_TYPE_STAT) {
                    await statExecuter(pageType === ArchivView.PAGE_TYPE_REPORT, pageType === ArchivView.PAGE_TYPE_STAT, dbSourceReport);
                }
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
                            addOnclick(reportSource.stats ? a => ArchivSearch.showPage(reportSource, reportSource.stats, ArchivView.PAGE_TYPE_STAT) : null);
                            break;
                        case "Gegenstände":
                            addOnclick(reportSource.items ? a => ArchivSearch.showPage(reportSource, reportSource.items, ArchivView.PAGE_TYPE_ITEMS) : null);
                            break;
                        case "Bericht":
                            const level = reportSource.levels && reportSource.levels[0];
                            addOnclick(level ? a => ArchivSearch.showPage(reportSource, level, ArchivView.PAGE_TYPE_REPORT) : null);
                            break;
                        default:
                            const matches = input.value.match(/Level.*(\d+)/);
                            if (matches) {
                                const level = reportSource.levels && reportSource.levels[matches[1] - 1];
                                addOnclick(level ? a => ArchivSearch.showPage(reportSource, level, ArchivView.PAGE_TYPE_REPORT) : null);
                            }
                            break;
                    }
                }
            }

            if (pageType === ArchivView.PAGE_TYPE_ITEMS) {
                const reportExt = await MyStorage.reportArchiveItems.getValue(reportSource.reportId);
                if (reportExt) ItemLootSummary.einblenden(reportExt);
            }
            if (pageType === ArchivView.PAGE_TYPE_REPORT) {
                _Libs.addCSS("report.css?" + new Date().getTime());
                ReportView.changeView(await MyStorage.reportArchive.getValue(reportSource.reportId));
            } else {
                _Libs.removeCSS("report.css");
            }
        }

        static createReportActions(reportMeta, result, idx) {
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
            const realReportId = reportMeta.reportId.match(/\D*(\d*)/)[1];
            const reportIdInput = document.createElement("input");
            result.append(reportIdInput);
            reportIdInput.value = realReportId;
            reportIdInput.type = "hidden";
            reportIdInput.name = "report_id[" + idx + "]";

            const isDirectLoadable = document.querySelector("input[value=\"" + realReportId + "\"]");
            const reportMetaSource = reportMeta.srcs || {};
            const statistik = document.createElement("input");
            result.append(statistik);
            statistik.value = (!reportMetaSource.stats && isDirectLoadable ? this.#loadingSymbol : "") + "Statistik";
            statistik.type = "submit";
            if (isDirectLoadable) statistik.name = "stats[" + idx + "]";
            statistik.className = reportMetaSource.stats || isDirectLoadable ? "button clickable" : "button_disabled";
            statistik.onclick = async function (e) {
                if (reportMetaSource.stats) {
                    e.preventDefault();
                    const reportSource = await getReportSource();
                    if (reportSource && reportSource.stats) await ArchivSearch.showPage(reportSource, reportSource.stats, ArchivView.PAGE_TYPE_STAT);
                }
            }

            const gegenstaende = document.createElement("input");
            result.append(gegenstaende);
            gegenstaende.value = (!reportMetaSource.items && isDirectLoadable ? this.#loadingSymbol : "") + "Gegenstände";
            gegenstaende.type = "submit";
            if (isDirectLoadable) gegenstaende.name = "items[" + idx + "]";
            gegenstaende.className = reportMetaSource.items || isDirectLoadable ? "button clickable" : "button_disabled";
            gegenstaende.onclick = async function (e) {
                if (reportMetaSource.items) {
                    e.preventDefault();
                    const reportSource = await getReportSource();
                    if (reportSource && reportSource.items) await ArchivSearch.showPage(reportSource, reportSource.items, ArchivView.PAGE_TYPE_ITEMS);
                }
            }

            const bericht = document.createElement("input");
            result.append(bericht);
            bericht.value = (!reportMetaSource.levels && isDirectLoadable ? this.#loadingSymbol : "") + "Bericht";
            bericht.type = "submit";
            if (isDirectLoadable) bericht.name = "details[" + idx + "]";
            bericht.className = reportMetaSource.levels || isDirectLoadable ? "button clickable" : "button_disabled";
            bericht.onclick = async function (e) {
                if (reportMetaSource.levels) {
                    e.preventDefault();
                    const reportSource = await getReportSource();
                    if (reportSource && reportSource.levels) await ArchivSearch.showPage(reportSource, reportSource.levels[0], ArchivView.PAGE_TYPE_REPORT);
                }
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
         * Aktualisiert .stats, .items, .levels
         */
        static async rewriteSourceFoundingsToMeta() {
            console.log("rewriteSourceFoundingsToMeta... start");
            for (const report of await MyStorage.reportArchive.getAll()) {
                const reportSource = await MyStorage.reportArchiveSources.getValue(report.reportId) || {};
                report.srcs.stats = !!reportSource.stats;
                report.srcs.items = !!reportSource.items;
                if (!reportSource.levels) {
                    delete report.srcs.levels;
                } else {
                    report.srcs.levels = [];
                    for (let i = 0, l = reportSource.levels.length; i < l; i++) {
                        report.srcs.levels[i] = !!reportSource.levels[i];
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
                if (!!reportMeta.srcs.stats !== !!reportSource.stats) {
                    console.error("ReportMeta-Fehler: " + reportId + " Statistik: " + !!reportMeta.srcs.stats + " != " + !!reportSource.stats);
                    failures++;
                }
                if (!!reportMeta.srcs.items !== !!reportSource.items) {
                    console.error("ReportMeta-Fehler: " + reportId + " Gegenstände: " + !!reportMeta.srcs.items + " != " + !!reportSource.items);
                    failures++;
                }
                if (!!reportMeta.srcs.levels !== !!reportSource.levels) {
                    console.error("ReportMeta-Fehler: " + reportId + " LevelsExist: " + !!reportMeta.srcs.levels.length + " != " + !!reportSource.levels.length);
                    failures++;
                } else if (reportMeta.srcs.levels) {
                    if (reportMeta.srcs.levels.length !== reportSource.levels.length) {
                        console.error("ReportMeta-Fehler: " + reportId + " LevelLength: " + !!reportMeta.srcs.levels.length + " != " + !!reportSource.levels.length);
                        failures++;
                    }
                    for (let i = 0, l = reportMeta.srcs.levels.length; i < l; i++) {
                        const levelSource = reportSource.levels[i];
                        const levelMeta = reportMeta.srcs.levels[i];
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

        /**
         * @return 1: für Erfolg, 0: für Teilerfolg, -1: für Misserfolg
         */
        static getSuccessLevel(reportMeta) {
            if (reportMeta && reportMeta.success && reportMeta.success.levels) {
                const members = reportMeta.success.members;
                const levels = reportMeta.success.levels;
                if (members) {
                    if (members[0] === members[1]) {
                        return 1;
                    } else if (members[0] > 0) {
                        return 0;
                    } else {
                        return -1;
                    }
                } else if (levels) {
                    if (levels[0] > -1) {
                        if (levels[0] !== levels[1]) {
                            return -1;
                        } else {
                            return 0;
                        }
                    }
                }
            }
        }

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
            if (!report.srcs || !report.srcs.stats || !report.srcs.items || !report.srcs.levels || !report.success) return false;
            return this.getMissingReportSites(report, onlyFullSuccess).length === 0;
        }

        static getMissingReportSites(report, onlyFullSuccess) {
            const fehlend = [];
            if (!report.srcs || !report.srcs.stats) fehlend.push("S");
            if (!report.srcs || !report.srcs.items) fehlend.push("G");
            for (const lv of this.getMissingReportSitesLevel(report, onlyFullSuccess)) {
                fehlend.push(lv);
            }
            return fehlend;
        }

        static isVollstaendigLevel(report, onlyFullSuccess) {
            if (!report.srcs || !report.srcs.levels || !report.success) return false;
            return this.getMissingReportSitesLevel(report, onlyFullSuccess).length === 0;
        }

        static getMissingReportSitesLevel(report, onlyFullSuccess) {
            const fehlend = [];
            if (report.success && report.success[1]) {
                delete report.success[1];
                MyStorage.reportArchive.setValue(report);
            }
            if (!report || !report.success || !report.srcs || !report.srcs.levels || !report.success.levels) {
                fehlend.push("Lx");
            } else {
                let maxLevel = report.success.levels[1];
                const successLevels = report.success.levels[0];
                if (!onlyFullSuccess && successLevels !== undefined) maxLevel = Math.min(successLevels + 1, maxLevel); // evtl. nicht erfolgreich, dann müssen auch nicht alle angefordert sein
                for (var i = 0, l = maxLevel; i < l; i++) {
                    if (!report.srcs.levels[i]) fehlend.push("L" + (i + 1));
                }
            }
            return fehlend;
        }

        static async getVersion(report, reportSourceOpt) {
            return (await Location.getVersions(report, reportSourceOpt)).join(" | ");
        }

        static async deleteSources(reportId) {
            await MyStorage.reportArchiveSources.deleteValue(reportId);
            const report = await MyStorage.reportArchive.getValue(reportId);
            delete report.srcs;
            await MyStorage.reportArchive.setValue(report);
            if (report.favAuto) await AutoFavorit.recheckAutoFavoritenForReport(report);
        }

    }

    class ReportView {
        static changeView(report) {
            const navigationLevel1 = document.querySelector(".navigation.levels");
            if (!navigationLevel1) return; // z.B. bei Schlachten der Fall
            const firstAnchor = document.createElement("a");
            firstAnchor.id = "1";
            navigationLevel1.parentElement.insertBefore(firstAnchor, navigationLevel1);
            const success = report.success;
            console.log("ReportView.changeView Success: ", success);
            if (!success) return;
            const haveFullSuccessInformations = success.levels[0] !== undefined;

            const content = [];
            const lineBefore = [""];
            const line = [];
            const line2 = [""];
            const line3 = [""];
            let kosAdded = false;
            let needSomeLoading = false;
            const getKos = function (levelNr) {
                if (!success.ko) return [];
                const result = [];
                for (const [name, inLevelNr] of Object.entries(success.ko)) {
                    if (levelNr === inLevelNr + 1) result.push(name);
                }
                return result;
            }
            for (let i = 0, l = navigationLevel1.children.length; i < l; i++) {
                const curButton = navigationLevel1.children[0];
                line.push(curButton);
                navigationLevel1.removeChild(curButton);
                const levelNr = i;
                if (levelNr >= 1) {
                    let levelWithContent = undefined;
                    if (haveFullSuccessInformations) {
                        levelWithContent = true;
                        const successMarker = document.createElement("div");
                        successMarker.style.height = "100%";
                        let koMarker;
                        if (success.levels[0] < levelNr) {
                            if (success.levels[0] === levelNr - 1) {
                                successMarker.style.backgroundColor = ArchivView.COLOR_RED;
                            } else {
                                levelWithContent = false;
                                curButton.style.opacity = 0.2;
                            }
                        } else {
                            const kos = getKos(levelNr);
                            if (kos.length === 0) {
                                successMarker.style.backgroundColor = ArchivView.COLOR_GREEN;
                            } else {
                                successMarker.style.backgroundColor = ArchivView.COLOR_YELLOW;
                                koMarker = document.createElement("div");
                                for (const ko of kos) {
                                    if (koMarker.innerHTML.length > 0) koMarker.innerHTML += "<br>";
                                    koMarker.innerHTML += ko;
                                }
                                kosAdded = true;
                            }
                        }
                        line2.push({data: successMarker, style: "height:5px"});
                        line3.push(koMarker ? {data: koMarker, style: "vertical-align:top"} : "");
                    }
                    const loadingText = report.srcs.levels[levelNr - 1] ? "" : (levelWithContent === undefined ? "▼?" : (levelWithContent ? "▼" : ""));
                    const needLoading = loadingText ? {
                        data: loadingText,
                        style: "font-size: 12px;cursor:help;",
                        title: "Dieser Level wurde noch nicht angeschaut" + (levelWithContent ? "" : ". Da die Statistikseite noch nicht aufgerufen wurde, wissen wir aber auch nicht, ob er überhaupt existiert."),
                    } : "";
                    if (needLoading !== "") needSomeLoading = true;
                    lineBefore.push(needLoading);
                }
            }
            navigationLevel1.innerHTML = "";
            if (needSomeLoading) content.push(lineBefore);
            content.push(line);
            content.push(line2);
            if (kosAdded) content.push(line3);
            navigationLevel1.style.textAlign = "center";
            const table = _UI.createTable(content);
            table.style.borderSpacing = "2px";
            table.style.margin = "auto";
            navigationLevel1.append(table);

            // Make it sticky. Innerhalb eines Tables geht das nur mit dem thead.
            const nextElementSiblingStyle = navigationLevel1.nextElementSibling.style;
            nextElementSiblingStyle.marginTop = "0";
            nextElementSiblingStyle.paddingTop = "0";
            const contentTable = navigationLevel1.parentElement.parentElement.parentElement.parentElement;
            const thead = document.createElement("thead");
            thead.style.position = "sticky";
            thead.style.top = "0px";
            contentTable.prepend(thead);
            const theadTR = document.createElement("tr");
            theadTR.classList.add("row0");
            thead.append(theadTR);
            const theadTD = document.createElement("td");
            theadTR.append(theadTD);
            navigationLevel1.parentElement.removeChild(navigationLevel1);
            theadTD.append(navigationLevel1);
            navigationLevel1.style.marginBottom = "4px";
            navigationLevel1.style.paddingBottom = "0";
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
            const locName = report.loc.name;
            const reports = (await MyStorage.reportArchive.getAll({
                index: ["loc.name"],
                keyRange: [locName],
            }));
            await this.#checkAllAutoFavoritenOn(reports);
        }

        /**
         * Überprüft alle Dungeon Auto-Favoriten für die übergebenen Reports.
         */
        static async #checkAllAutoFavoritenOn(reports, specificTagName, deactivated) {
            if (specificTagName) { // Ein bestimmter AutoFavorit soll nochmal überprüft werden. Z.B. bei einer Änderung der Einstellung.
                await this.#checkAutoFavoritenIntern(reports, specificTagName, deactivated);
            } else { // Ein Report hat sich geändert, nur wenn AutoFavoriten aktiviert sind müssen wir hier auch checken
                if ((await MySettings.get()).autoFavoritGroup) await this.#checkAutoFavoritenIntern(reports, AutoFavorit.TAG_GROUP);
                if ((await MySettings.get()).autoFavoritAll) await this.#checkAutoFavoritenIntern(reports, AutoFavorit.TAG_ALL);
            }
        }

        static async #domainGroup(report) {
            const myVersions = await Location.getVersions(report);
            if (!myVersions || myVersions.length === 0) return [];
            const result = [];
            for (const version of myVersions) {
                result.push(report.gruppe_id + ";" + report.loc.name + ";" + version); // pro Gruppe, Dungeonname und Version
            }
            return result;
        }

        static async #domainAll(report) {
            const myVersions = await Location.getVersions(report);
            if (!myVersions || myVersions.length === 0) return [];
            const result = [];
            for (const version of myVersions) {
                result.push(report.loc.name + ";" + version); // pro Gruppe, Dungeonname und Version
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

    class Location {

        static async getVersionCount(locationName) {
            const location = await MyStorage.location.getValue(locationName);
            if (!location || !location.versions) return 0;
            return Object.keys(location.versions).length;
        }

        static async hasMoreThanOneVersion(report) {
            return await this.getVersionCount(report.loc.name) > 1;
        }

        /**
         * Wenn für ein vorhandenen Index 'undefined' angelegt wird, gilt dieses als Wildcard.
         * Aktuelle Annahme, die komplette Anzahl an Leveln wurde bereits bestimmt.
         */
        static createVersionId(report, reportSource) {
            const successLevels = report.success.levels;
            if (!successLevels[1]) throw new Error("Die maximale Anzahl an Leveln wurde noch nicht bestimmt!");
            const versionId = [];
            let isComplete = true;
            for (let i = 0, l = successLevels[1]; i < l; i++) {
                const level = reportSource.levels[i];
                if (level) {
                    const doc = _util.getDocumentFor(level);
                    const geschafft = !doc.getElementsByName("goto_last_level")[0];
                    // In Leveln die nicht erreicht wurden, werden wird keine Klasse "navigation levels" angelegt
                    if (geschafft) {
                        const navLevels = doc.getElementsByClassName("navigation levels")[0];
                        const ueberschrift = navLevels.parentElement.getElementsByTagName("h3")[0].textContent;
                        versionId.push(ueberschrift);
                    } else {
                        versionId.push(undefined);
                        isComplete = false;
                    }
                } else {
                    versionId.push(undefined);
                    isComplete = false;
                }
            }
            if (report.loc.name === "Atreanijsh") {
                let geloest = 0;
                let interlude = 0;
                let nix = 0;
                for (let i = 0, l = versionId.length; i < l; i++) {
                    let cur = versionId[i];
                    if (cur.includes("- gelöst")) geloest++;
                    else if (cur.includes("- Interlude")) interlude++;
                    else nix++;
                    cur = cur.replace(" - gelöst", "");
                    versionId[i] = cur;
                }
                if (nix) { // kein gelöst, kein Interlude, d.h. man hätte weiter kommen können
                    versionId.push(undefined);
                    isComplete = false;
                }
            }
            //console.log("Created VersionId", versionId, isComplete);
            return [versionId, isComplete];
        }

        static async getVersions(report, reportSourceOpt) {
            const loc = report.loc;
            if (loc.v) return [loc.v];
            if (loc.schlacht) return [1];
            if (!report || !report.success || !report.srcs.levels || !report.success.levels) return [];

            let versionId;
            let isComplete;

            if (loc.v_) { // Vorläufige Versionszweisung prüfen ob sie noch aktuell sein kann. Ist sie sofern keine weitere Version hinzugefügt wurde
                const versionCount = await Location.getVersionCount(loc.name);
                if (loc.v_.cnt === versionCount) return loc.v_.vs; // es ist keine weitere Version hinzugekommen
                versionId = loc.v_.vId;
                isComplete = false;
            } else {
                const reportSource = reportSourceOpt || await MyStorage.reportArchiveSources.getValue(report.reportId);
                if (!reportSource) return [];
                [versionId, isComplete] = Location.createVersionId(report, reportSource);
            }

            const versions = await this.getMatchingVersions(loc.name, versionId);
            if (isComplete) {
                loc.v = versions[0]; // es kann hier nur eine Version geben
                delete loc.v_;
                await MyStorage.reportArchive.setValue(report);
            } else {
                const versionCount = await Location.getVersionCount(loc.name);
                /**
                 * Sollten neue Versionen hinzugefügt werden, muss anhand der versionId erneut gesucht werden.
                 */
                loc.v_ = { // Vorläufige Versionszuweisung
                    vId: versionId,
                    cnt: versionCount,
                    vs: versions,
                }
                await MyStorage.reportArchive.setValue(report);
            }
            return versions;
        }

        static async getMatchingVersions(locationName, versionId) {
            const debug = locationName === "ddDas Geheimnis von Semarkesh";
            const location = await MyStorage.location.getValue(locationName) || {name: locationName};
            const versions = location.versions || (location.versions = []);
            const result = [];
            let needUpdate = false;
            for (const [curMatchingIndex, curNeedUpdate] of this.#findMatchingVersions(versions, versionId, debug)) {
                needUpdate = needUpdate || curNeedUpdate;
                result.push(curMatchingIndex + 1);
            }
            if (result.length > 0) {
                if (needUpdate) await MyStorage.location.setValue(location);
                return result;
            }
            // keine Version gefunden wir legen eine neue an
            versions.push(versionId);
            await MyStorage.location.setValue(location);
            return [versions.length];
        }

        static #findMatchingVersions(versions, versionId, debug) {
            const result = [];
            for (let i = 0, l = versions.length; i < l; i++) {
                const cur = versions[i];
                const matches = this.#isMatching(cur, versionId, undefined, debug);
                if (debug) console.log("isMatching: ", matches, cur, versionId);
                if (matches) { // wenn die Version weiter spezifiziert definiert wurde
                    if (typeof matches === "object") {
                        versions[i] = matches;
                        result.push([i, true]);
                    } else {
                        result.push([i, false]);
                    }
                }
            }
            return result;
        }

        static #isMatching(versionId1, versionId2, mergedVersionIdArray, debug) {
            if (versionId1.length !== versionId2.length) return false;
            let length = versionId1.length;
            if (versionId2.length > length) length = versionId2.length;
            let last1;
            let last2;
            let changed = false;
            for (let i = 0; i < length; i++) {
                const value1 = this.#getIt(versionId1, i, last1);
                const value2 = this.#getIt(versionId2, i, last2);
                if (value1 === false || value2 === false) return false;
                if (value1 !== undefined && value2 !== undefined && value1 !== value2) return false;
                last1 = value1;
                last2 = value2;
                if (value1 !== undefined) {
                    if (mergedVersionIdArray) mergedVersionIdArray.push(value1);
                } else {
                    changed = true;
                    if (mergedVersionIdArray) mergedVersionIdArray.push(value2);
                }
            }
            if (changed && !mergedVersionIdArray) {
                // nochmal Aufrufen um diesmal auch den Spezifikations-Array mit aufzubauen, der im Normalfall nicht angelegt wird
                mergedVersionIdArray = this.#isMatching(versionId1, versionId2, []);
            }
            return changed ? mergedVersionIdArray : true;
        }

        static #getIt(versionIdArray, idx, last) {
            if (idx >= versionIdArray.length) { // Out of bounds
                if (last === undefined) return undefined; // return Wildcard
                return false;
            }
            return versionIdArray[idx];
        }

    }

    class MySettings {
        static SEASONS_ACTIVATED = false;
        static #settingsDef = {
            modName: Mod.modname,
            defaultSettings: {
                autoLoeschen: false,
                autoLoeschenTage: 14,
                autoFavoritAll: true,
                autoFavoritGroup: true,
                maxResults: 100,
                lootSummary: true,
            },
        }

        static async get(fresh) {
            return _Settings.get(this.#settingsDef, fresh);
        }

        static async save() {
            await _Settings.save(this.#settingsDef);
        }
    }

    class MyStorage {
        static checkValidReportId = function (objStore) {
            if (!objStore) return;
            let resultGetValue = objStore.getValue;
            objStore.getValue = async function (dbObjectId) {
                // darf auch nicht mit einer Nummer starten
                if (dbObjectId.includes("undefined") || dbObjectId.match(/^\d.*/)) throw new Error("Die ID ist nicht valide! " + dbObjectId);
                return await resultGetValue.call(objStore, dbObjectId);
            }
            let resultSetValue = objStore.setValue;
            objStore.setValue = async function (dbObject) {
                if (dbObject.reportId.includes("undefined")) throw new Error("Die ID ist nicht valide! " + dbObject.reportId);
                await resultSetValue.call(objStore, dbObject);
            }
            let resultDeleteValue = objStore.deleteValue;
            objStore.deleteValue = async function (dbObjectId) {
                if (dbObjectId.includes("undefined")) throw new Error("Die ID ist nicht valide! " + dbObjectId);
                await resultDeleteValue.call(objStore, dbObjectId);
            }
            return objStore;
        }

        static indexedDb = new _Storages.IndexedDb("WoDReportArchiv", Mod.dbname);

        /**
         * Meta-Daten für einen Kammpfbericht
         */
        static reportArchive = this.checkValidReportId(this.indexedDb.createObjectStore("reportArchive", "reportId", {
            ts: "ts",
            locName: "loc.name",
            //wgls: ["world", "gruppe_id", "loc.name", "world_season"],
        }));
        static {
            if (false) {
                this.reportArchive.deleteIndex("wgls");
                this.reportArchive.deleteIndex("1");
                this.reportArchive.deleteIndex("2");
                this.reportArchive.deleteIndex("3");
                this.reportArchive.deleteIndex("4");
                this.reportArchive.deleteIndex("5");
            }
        }
        /**
         * Erweiterte Daten für einen Kampfbericht. Z.B. Informationen der Gegenstandsseite (Equip + Loot)
         * Resultat aus WoDParser.parseKampfberichtGegenstaende
         */
        static reportArchiveItems = this.indexedDb.createObjectStore("reportArchiveItems", "reportId");
        /**
         * Quell-Dateien der Kampfberichte
         */
        static reportArchiveSources = this.indexedDb.createObjectStore("reportArchiveSources", "reportId");
        /**
         * Informationen über die Locations (Dungeons, Schlachten). Z.B. Erkennung der Dungeonversion.
         */
        static location = this.indexedDb.createObjectStore("location", "name");

        static getReportDBMeta() {
            return this.reportArchive;
        }

        static async getSourceReport(reportId) {
            return await this.reportArchiveSources.getValue(reportId);
        }

        static async setSourceReport(report) {
            await this.reportArchiveSources.setValue(report);
        }

        static async putToLoot(reportId, memberList) {
            const reportExt = await this.reportArchiveItems.getValue(reportId) || {reportId: reportId, members: {}};
            for (const [name, entry] of Object.entries(memberList)) {
                const member = reportExt.members[name] || (reportExt.members[name] = {});
                for (const [entryKey, entryValue] of Object.entries(entry)) {
                    member[entryKey] = entryValue;
                }
            }
            await this.reportArchiveItems.setValue(reportExt);
            return reportExt;
        }

        static async submitLoot(report, reportLoot) {
            const loots = {};
            for (const member of Object.values(reportLoot.members)) {
                if (member.loot) {
                    for (const item of member.loot) {
                        const cur = loots[item.name] || (loots[item.name] = {});
                        cur.stufe = cur.stufe || member.stufe;
                        if (!member.ko) cur.count = (cur.count || 0) + (item.vg || 1); // nur Loot zählen
                    }
                }
            }

            for (const [itemName, itemDef] of Object.entries(loots)) {
                if (itemDef.stufe) {
                    await _WoDLootDb.reportLootSafe(itemName, itemDef.count, report.loc.name, report.loc.v, report.ts, report.world, report.world_season, itemDef.stufe, report.gruppe_id, report.gruppe);
                } else {
                    await _WoDLootDb.reportLootUnsafe(itemName, itemDef.count, report.loc.name, report.loc.v, report.ts, report.world, report.world_season, report.stufe, report.gruppe_id, report.gruppe);
                }
            }
        }

    }

    class WoD {
        /**
         * Holt den Content und formatiert zusätzlich das Datum noch um
         */
        static getPlainMainContent() {
            const titleFormatter = function (doc) {
                const titleElem = doc.getElementsByTagName("h2")[0];
                const titleSplit = titleElem.textContent.split(/-(.*)/);
                const title = titleSplit[1].trim();
                const absoluteTime = _WoD.getTimeString(titleSplit[0].trim());
                titleElem.innerHTML = absoluteTime + " - " + title;
            }
            return util.getPlainMainContent(titleFormatter);
        }
    }

    class util {

        static forEach(array, fn) {
            for (var i = 0, l = array.length; i < l; i++) {
                fn(array[i]);
            }
        }

        static hatClassName(node, className) {
            return node.classList && node.classList.contains(className);
        }

        /**
         * Versucht soweit alle Elemente die nicht zum Main-Content gehören rauszufiltern.
         * Wir greifen nicht alleinig den Main_Content ab, um auch CSS und "the_form" etc. mit zu bekommen
         * Stellt sicher, dass alle URLs relativ zur Domain definiert sind.
         */
        static getPlainMainContent(functionAfterClone) {
            const myDocument = document.cloneNode(true);

            const remove = node => {
                if (node) node.parentElement.removeChild(node);
            }

            const gadgetTable = myDocument.querySelector("#gadgettable tbody");
            if (gadgetTable) { // existiert in nem Popup nicht
                _util.forEachSafe(gadgetTable.children, curTR => {
                    if (!curTR.querySelector("div#main_content")) {
                        remove(curTR);
                    } else { //
                        _util.forEachSafe(curTR.children, curTD => {
                            if (!curTD.querySelector("div#main_content")) remove(curTD);
                        });
                    }
                });
            }

            const removeClassNodes = function (node, className) {
                for (const cur of node.querySelectorAll("." + className + ":not(." + className + " ." + className + ")")) {
                    remove(cur);
                }
            }
            removeClassNodes(myDocument.documentElement, "nowod");
            removeClassNodes(myDocument.documentElement, "tutorial");
            removeClassNodes(myDocument.documentElement, "intro_open");

            const tooltip = myDocument.getElementsByClassName("tooltip")[0];
            if (tooltip) remove(tooltip);

            // Stellt sicher, dass auch immer der Pfad mit bei einer URL-Angabe mit dabei ist.
            // Wenn die Datei exportiert wird, wird die Pfadangabe ja ebenfalls "vergessen".
            this.ensureAllUrlsHavePathname(myDocument);

            if (functionAfterClone) functionAfterClone(myDocument);
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
            const myDocument = WoD.getPlainMainContent();

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
                _util.forEachSafe(myDocument.getElementsByName(buttonName), a => buttonReplaceWithElement(a, text, href));
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
            const zip = new JSZip();
            const reportSources = await MyStorage.getSourceReport(reportId);
            const reportMeta = await MyStorage.reportArchive.getValue(reportId);

            function addHTML(filename, wodData) {
                const myDocument = _util.getDocumentFor(wodData);
                const exportData = util.getHtmlForExport(myDocument);
                zip.file(filename, exportData);
            }

            if (reportSources.stats) addHTML("Statistik.html", reportSources.stats);
            if (reportSources.items) addHTML("Gegenstaende.html", reportSources.items);
            if (reportSources.levels) {
                for (let i = 0, l = reportSources.levels.length; i < l; i++) {
                    const level = reportSources.levels[i];
                    addHTML("Level" + (i + 1) + ".html", level);
                }
            }
            const downloadFileName = reportMeta.gruppe + "_" + reportMeta.loc.name + "_" + _util.formatDateAndTime(new Date(reportMeta.ts)).replaceAll(".", "_") + ".zip";
            zip.generateAsync({type: "blob"}).then(function (content) {
                console.log("File '" + downloadFileName + "' is ready!");
                _File.forDownload(downloadFileName, content);
            }).catch(error => console.error("Zip-Erro: ", error));
        }

    }

    try {
        Mod.startMod();
    } catch (e) {
        console.error(e);
        throw e;
    }

})();