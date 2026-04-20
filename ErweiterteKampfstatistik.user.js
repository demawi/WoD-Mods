// ==UserScript==
// @name           [WoD] Erweiterte Kampfstatistik
// @version        0.21.23
// @author         demawi
// @namespace      demawi
// @description    Erweitert die World of Dungeons Kampfstatistiken
//
// @match          *://*.world-of-dungeons.de/wod/spiel/*report.php*
// @match          *://*.world-of-dungeons.de/wod/spiel/*combat_report.php*
// @match          *://*.world-of-dungeons.de/wod/spiel/event/play.php*
// @match          *://*.world-of-dungeons.de/wod/spiel/event/eventlist.php*
// @match          *://*.world-of-dungeons.de/wod/spiel/hero/skill.php*
// @match          *://world-of-dungeons.de/*
// @require        repo/DemawiRepository.js
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

    const _ = demawiRepository;

    class Mod {
        static modname = "KampfberichtStatistiken";
        static version = GM.info.script.version;
        static dbname = "wodDB";
        static forumLink = "/wod/spiel/forum/viewtopic.php?pid=16698430";

        static thisReport;
        static thisLevelDatas; // Array der Level über welche die Auswertung gefahren wird

        static async recalculateStats() {
            this.startMod2();
        }

        static async startMod() {
            const indexedDb = await _.WoDStorages.tryConnectToMainDomain(Mod.dbname);
            if (!indexedDb) return;
            await MyStorage.initMyStorage(indexedDb);

            const view = _.WoD.getView();
            demawiRepository.startMod();
            switch (view) {
                case _.WoD.VIEW.SKILL:
                    await _.WoDSkillsDb.onSkillPage();
                    break;
                case _.WoD.VIEW.REPORT_OVERVIEW:
                    this.createStub();
                    break;
                case _.WoD.VIEW.REPORT: // Statistik, Gegenstände oder Kampfbericht
                case _.WoD.VIEW.EVENTLIST: // Abenteuer
                case _.WoD.VIEW.PLAY: // Abenteuer
                    await this.onReportSite();
                    break;
            }
        }

        static createStub() {
            unsafeWindow.statExecuter = async function (...args) {
                console.log(GM.info.script.name + " wird aufgerufen");
                await Mod.startMod2(...args);
            }
        }

        static async onReportSite() {
            this.createStub();
            const _this = this;
            setTimeout(async function () {
                await _this.startMod2();
            }, 100);
        }

        /**
         * Einstiegspunkt der Anwendung. Falls von externer Mod aufgerufen wird, sollten die Parameter entsprechend gesetzt werden.
         * @param kampfbericht   ob es ich um eine Kampfberichtseite handelt
         * @param kampfstatistik ob es sich um die Kampfstatistik-Seite handelt
         * @param dbReportSource Entität aus der "reportArchiveSources"-Datenbank
         */
        static async startMod2(kampfbericht, kampfstatistik, dbReportSource) {
            this.thisReport = undefined;
            this.thisLevelDatas = undefined;
            const _this = this;
            if (dbReportSource && dbReportSource.levels) {
                await this.syncWithReportSources(dbReportSource);
                await Mod.startMod2(kampfbericht, kampfstatistik); // ohne Report nochmal aufrufen
                return;
            }
            if (WoD.istSeite_AbenteuerUebungsplatz()) {
                let [levelData, errors] = await _.ReportParser.parseKampfbericht(document, true);
                if (levelData) {
                    OutputAnchor.init();
                    Mod.thisLevelDatas = [levelData];
                    let roundCount = levelData.areas.reduce((sum, area) => sum + area.rounds.length, 0);
                    let hinweisText = roundCount + " Runden";
                    OutputAnchor.setTitleMessage(hinweisText);
                    await OutputAnchor.reportMissingSkillInfos([levelData]);
                }
            }

            const reportView = _.WoD.getReportView(true);
            if (kampfbericht || reportView === "fight") { // Einzelseite
                OutputAnchor.init();
                OutputAnchor.runSafe(async function () {
                    // cur_rep_id für Dungeons, report bei Schlachten
                    const reportData = _.WoD.getFullReportBaseData();
                    const reportId = reportData.reportId;
                    _this.thisReport = await MyStorage.getReportStatsDB().getValue(reportId);
                    console.log("ReportId: ", reportId, _this.thisReport);

                    var [levelData, levelNr, errors] = await _this.readKampfberichtAndStoreIntoReport(document, _this.thisReport, reportId);
                    OutputAnchor.reportWarnings(errors);
                    if (levelData) {
                        await OutputAnchor.reportMissingSkillInfos([levelData], true);
                        let roundCount = levelData.areas.reduce((sum, area) => sum + area.rounds.length, 0);

                        var hinweisText = roundCount + " Runden";
                        if (levelData.areas.length > 0) {
                            hinweisText += " [" + _.util.arrayMap(levelData.areas, area => area.rounds.length).join(", ") + "]";
                        }
                        const reportProgress = Mod.getReportProgress();
                        if (reportProgress.missingReports.length > 0) {
                            hinweisText += ". Es fehlen noch die Reports für folgende Level: " + reportProgress.missingReports.join(", ") + " (Bitte entsprechende Level aufrufen)";
                        }
                        OutputAnchor.setTitleMessage(hinweisText);
                        Mod.thisLevelDatas = [];
                        Mod.thisLevelDatas[levelNr - 1] = levelData;
                        await MyStorage.getReportStatsDB().setValue(_this.thisReport);
                    }
                });
            }
            if (kampfstatistik || reportView === "stats") { // Statistikseite (keine Zwischenspeicherung nur Anzeige)
                OutputAnchor.init();
                OutputAnchor.runSafe(async function () {
                    const reportData = _.WoD.getFullReportBaseData();
                    const reportId = reportData.reportId;
                    _this.thisReport = await MyStorage.getReportStatsDB().getValue(reportId);
                    await _this.#invalidateOldCache(_this.thisReport);

                    // Holen und Speichern der erreichten Level
                    const successStats = _.WoDParser.retrieveSuccessInformationOnStatisticPage(document, _this.thisReport.success);
                    _this.thisReport.maxLevels = Math.min(successStats.levels[0] + 1, successStats.levels[1]);
                    await MyStorage.getReportStatsDB().setValue(_this.thisReport);

                    console.log("ReportId: ", reportId, _this.thisReport);

                    if (_this.thisReport.levelCount) {
                        const reportProgress = Mod.getReportProgress();

                        var hinweisText = reportProgress.roundCount + " Runden (" + reportProgress.allRoundNumbers.join(", ") + ")";
                        if (reportProgress.foundReportCount < reportProgress.levelCount) {
                            hinweisText += ". Es fehlen noch die Reports für folgende Level: " + reportProgress.missingReports.join(", ") + " (Bitte entsprechende Level aufrufen)";
                        }
                        OutputAnchor.setTitleMessage(hinweisText);
                        Mod.thisLevelDatas = _this.thisReport.levelDatas;
                        await OutputAnchor.reportMissingSkillInfos(_this.thisReport.levelDatas);

                    } else {
                        OutputAnchor.setTitleMessage("Es fehlen noch alle Level-Reports!" + " (Bitte entsprechende Level aufrufen)", true);
                    }
                    const settings = await MySettings.getFresh();
                    if (!settings.get(MySettings.SETTING.LAST_VALIDATION) || new Date(settings.get(MySettings.SETTING.LAST_VALIDATION)) < new Date().setDate(new Date().getDate() - 1)) {
                        console.log("Check ReportStats-Validation")
                        MyStorage.maintenanceAllReports(); // no await, blockiert aber ja dennoch die Anwendung
                        settings.set(MySettings.SETTING.LAST_VALIDATION, new Date().getTime());
                        await settings.save();
                    }
                });
            }
        }

        static async #invalidateOldCache(report) {
            const levelDatas = (report.levelDatas || []).slice(0);
            for (let i = 0, l = levelDatas.length; i < l; i++) {
                const levelData = levelDatas[i];
                if (levelData && (!levelData.dv || levelData.dv !== _.ReportParser.reportDataVersion)) {
                    delete report.levelDatas[i];
                }
            }
        }

        /**
         * Lädt aus den Report-Quellen fehlende Level-Statistiken in die ReportStat-Datenbank.
         */
        static async syncWithReportSources(dbReportSource) {
            const reportId = dbReportSource.reportId;
            const statReport = await MyStorage.getReportStatsDB().getValue(reportId);
            let changed = false;
            for (let i = 0, l = dbReportSource.levels.length; i < l; i++) {
                if ((!statReport.levelDatas || !statReport.levelDatas[i]) && dbReportSource.levels[i]) {
                    const doc = _.util.getDocumentFor(dbReportSource.levels[i]);
                    await this.readKampfberichtAndStoreIntoReport(doc, statReport, reportId);
                    changed = true;
                }
            }
            if (changed) {
                console.log("syncWithReportSources: Sourcen wurden gecached!");
                await MyStorage.getReportStatsDB().setValue(statReport);
            }
        }

        static async readKampfberichtAndStoreIntoReport(container, report, reportId) {
            var levelNr;
            if (reportId.endsWith("S")) {
                levelNr = 1;
                report.levelCount = 1;
            } else { // Dungeon
                levelNr = container.getElementsByName("current_level")[0].value;
                let navigationBar = container.getElementsByClassName("navigation levels")[0];
                if (navigationBar) report.levelCount = navigationBar.querySelectorAll("input").length;
            }
            console.log("Read Kampfbericht: " + reportId + " lvl" + levelNr);
            const [levelData, errors] = await _.ReportParser.parseKampfbericht(container, true);
            if (false) {
                const [levelData2, errors2] = await _.ReportParser.parseKampfbericht(container, false);
                console.log("AAAAAAAAAAAAAAAAA " + JSON.stringify(levelData).length);
                console.log("BBBBBBBBBBBBBBBBB " + JSON.stringify(levelData2).length, levelData2);
                const zip = new JSZip();
                zip.file("abc", JSON.stringify(levelData2));
                zip.generateAsync({
                    type: "blob", compression: "DEFLATE",
                    compressionOptions: {
                        level: 9
                    }
                }).then(function (content) {
                    console.log("CCCCCCCCCCCCCCCCCC", content);
                }).catch(error => console.error("Zip-Erro: ", error));
            }

            report.id = reportId;
            if (!report.levelDatas) {
                report.levelDatas = [];
            }
            report.levelDatas[levelNr - 1] = levelData;
            report.ts = new Date().getTime(); // reportData.ts;
            return [levelData, levelNr, errors];
        }

        static getReportProgress() {
            var foundReportCount = 0;
            var missingReports = Array();
            var allRoundNumbers = Array();
            var roundCount = 0;
            var areaCount = 0;
            var levelCount = 0;
            var levelDatas;

            if (Mod.thisReport) {
                levelCount = Mod.thisReport.maxLevels || Mod.thisReport.levelCount;
                levelDatas = Mod.thisReport.levelDatas;
                console.log("ThisReport: ", Mod.thisReport);

                for (var i = 0, l = levelCount; i < l; i++) {
                    if (levelDatas.length > i) {
                        const levelData = levelDatas[i];
                        if (levelData) {
                            const thisLevelRoundCount = levelData.areas.reduce((sum, area) => sum + area.rounds.length, 0);
                            const curAreaCount = Object.keys(levelData.areas).length;
                            const areaRoundCounts = Array();
                            levelData.areas.forEach(area => areaRoundCounts.push(area.rounds.length));
                            allRoundNumbers[i] = (curAreaCount > 1 ? "[" + areaRoundCounts.join(", ") + "]" : "" + thisLevelRoundCount);
                            roundCount += thisLevelRoundCount;
                            areaCount += curAreaCount;
                            foundReportCount++;
                            continue;
                        }
                        allRoundNumbers[i] = "x";
                    } else {
                        allRoundNumbers[i] = "x";
                    }
                    missingReports.push(i + 1);
                }
            }
            return {
                levelDatas: levelDatas,
                levelCount: levelCount,
                foundReportCount: foundReportCount,
                missingReports: missingReports,
                allRoundNumbers: allRoundNumbers,
                roundCount: roundCount,
            }
        }

    }

    class OutputAnchor {
        static #outerAnchor;
        static #foundError;
        static #warnings = [];
        static #headerMessage;
        static #preContent;
        static #content;
        static #collapsible;
        static #warningMessage;

        // erzeugt den Punkt wo wir uns mit der UI ranhängen können
        static init() {
            if (this.#outerAnchor) this.#outerAnchor.remove();

            // Ausgabe
            let headings = document.getElementsByTagName("h2");
            if (WoD.istSeite_AbenteuerUebungsplatz()) { // im Abenteuer
                headings = document.getElementsByTagName("h1");
            }
            this.#outerAnchor = document.createElement("div");
            this.#outerAnchor.classList.add("nowod");
            const collapsibleContainer = document.createElement("div");
            collapsibleContainer.hidden = true;

            const header = document.createElement("div");
            this.#headerMessage = document.createElement("span");
            this.#headerMessage.innerHTML = " ...";
            this.#warningMessage = document.createElement("span");
            const title = document.createElement("span");
            title.innerHTML = "Erweiterte Kampfstatistiken: ";
            header.append(title);
            header.append(this.#headerMessage);
            this.#preContent = document.createElement("div");
            this.#content = document.createElement("div");
            var firstClick = true;
            const _this = this;
            this.#collapsible = util.createCollapsible("20px", true, function (hide) {
                collapsibleContainer.hidden = hide;
                if (_this.#foundError) {
                    _this.#content.innerHTML = _this.getHTMLFromError(_this.#foundError);
                } else if (firstClick) {
                    firstClick = false;
                    if (_this.#warnings.length > 0) {
                        for (const warning of _this.#warnings) {
                            const msgElem = document.createElement("div");
                            msgElem.innerHTML = _this.getHTMLFromWarning(warning);
                            _this.#content.append(msgElem);
                        }
                    }
                    const resultAnchor = document.createElement("div");
                    _this.#content.appendChild(resultAnchor);
                    const view = new QueryModel.StatQuery("heroes", "attack", []);
                    const initialStatView = new Viewer.StatView(view, true, false);
                    new Viewer.StatTable(initialStatView, Mod.thisLevelDatas, resultAnchor);
                    _this.#content.append(_this.createWurfrechner());
                    _this.#content.append(document.createElement("br"));
                }
            });

            headings[0].parentNode.insertBefore(this.#outerAnchor, headings[0].nextSibling);
            this.#outerAnchor.append(header);
            this.#outerAnchor.append(collapsibleContainer);
            header.append(this.#collapsible);
            header.append(this.#warningMessage);
            this.#collapsible.style.display = "none";
            collapsibleContainer.append(this.#preContent);
            collapsibleContainer.append(this.#content);
        }

        static createWurfrechner() {
            const wurfrechner = [];
            wurfrechner.push("Wurfrechner:");
            const eingabeAWavg = this.createNummerneingabe();
            eingabeAWavg.placeholder = "AW-avg";
            wurfrechner.push(eingabeAWavg);
            const eingabeAWmin = this.createNummerneingabe();
            eingabeAWmin.placeholder = "AW-min";
            wurfrechner.push(eingabeAWmin);
            const eingabeAWmax = this.createNummerneingabe();
            eingabeAWmax.placeholder = "AW-max";
            wurfrechner.push(eingabeAWmax);
            wurfrechner.push(" > ");
            const eingabePWavg = this.createNummerneingabe();
            eingabePWavg.placeholder = "PW-avg";
            wurfrechner.push(eingabePWavg);
            const eingabePWmin = this.createNummerneingabe();
            eingabePWmin.placeholder = "PW-min";
            wurfrechner.push(eingabePWmin);
            const eingabePWmax = this.createNummerneingabe();
            eingabePWmax.placeholder = "PW-max";
            wurfrechner.push(eingabePWmax);
            const resultat = document.createElement("div");
            wurfrechner.push(resultat);
            const berechnen = function (ev) {
                const elem = ev.target;
                if (elem.value > 999) elem.value = 999;
                let awAVG = Number(eingabeAWavg.value);
                let pwAVG = Number(eingabePWavg.value);
                if (!(awAVG > 0) || !(pwAVG > 0)) {
                    resultat.innerHTML = "";
                    return;
                }
                let result = _.Dices.winsOver2(awAVG, Number(eingabeAWmin.value) || 0, Number(eingabeAWmax.value) || 0, pwAVG, Number(eingabePWmin.value) || 0, Number(eingabePWmax.value) || 0);
                result = 100 * result;
                resultat.innerHTML = "Trefferwahrscheinlichkeit: " + result + " %";
            }
            eingabeAWavg.addEventListener("change", berechnen);
            eingabeAWmin.addEventListener("change", berechnen);
            eingabeAWmax.addEventListener("change", berechnen);
            eingabePWavg.addEventListener("change", berechnen);
            eingabePWmin.addEventListener("change", berechnen);
            eingabePWmax.addEventListener("change", berechnen);
            return _.UI.createTable([wurfrechner]);
        }

        static createNummerneingabe() {
            const result = document.createElement("input");
            result.type = "text";
            result.size = 4;
            result.maxLength = 3;
            return result;
        }

        static getHTMLFromError(error) {
            const zeileUndSpalte = error.stack.match(/:(\d+:\d+)/)[1];
            return error + " v" + Mod.version + " -> " + zeileUndSpalte + "Forum <a target='_blank' href='" + Mod.forumLink + "'>Link ins Forum</a>"
                + "<br>Wer selber nachschauen möchte: der Error inklusive Link wurde auch in die Entwicklerkonsole geschrieben";
        }

        static getHTMLFromWarning(error) {
            const zeileUndSpalte = error.stack.match(/:(\d+:\d+)/)[1];
            return error + " v" + Mod.version + " -> " + zeileUndSpalte + "Forum <a target='_blank' href='" + Mod.forumLink + "'>Link ins Forum</a>"
                + "<br>Wer selber nachschauen möchte: der Error inklusive Link wurde auch in die Entwicklerkonsole geschrieben";
        }

        static reportWarnings(warnings) {
            for (const warning of warnings) {
                this.#warnings.push(warning);
            }
        }

        static async reportMissingSkillInfos(levelDatas, canRefresh) {
            const missingSkillInfos = {
                skills: [],
                noskills: [],
            };

            const copyOver = function (from, to) {
                if (from) {
                    for (const [key, list] of Object.entries(from)) {
                        const toList = to[key] || [];
                        toList.concat(list);
                        to[key] = toList;
                    }
                }
            }

            for (const levelData of levelDatas) {
                const missingSkillInfosFromLevel = levelData && levelData.missingSkillInfos;
                if (missingSkillInfosFromLevel) {
                    copyOver(missingSkillInfosFromLevel.skills, missingSkillInfos.skills);
                    copyOver(missingSkillInfosFromLevel.noskills, missingSkillInfos.noskills);
                }
            }
            if (Object.keys(missingSkillInfos.skills).length === 0 && Object.keys(missingSkillInfos.noskills).length === 0) return;
            let count = 0;
            const userInfoPanel = document.createElement("div");
            const title = document.createElement("div");
            title.innerHTML = "Benutzerdefinierte Fertigkeits-Informationen: (bitte anklicken oder ergänzen)";
            title.title = "Zu einigen Aktionen konnten nicht automatische alle Informationen bestimmt werden.";
            userInfoPanel.append(title);
            if (missingSkillInfos.skills) {
                for (const [skillName, list] of Object.entries(missingSkillInfos.skills)) {
                    const aHref = _.WoD.createSkillLink(skillName, win => {
                        let count = 0;
                        const interval = setInterval(async function () {
                            count++;
                            const skill = await _.WoDSkillsDb.getSkill(skillName);
                            if (skill) {
                                const img = document.createElement("img");
                                img.src = _.UI.WOD_SIGNS.YES;
                                aHref.append(img);
                                clearInterval(interval);
                            } else if (count > 100) {
                                clearInterval(interval);
                            }
                        }, 100);
                    }, "statViewItem");
                    aHref.style.display = "block";
                    userInfoPanel.append(aHref);
                    count++;
                }
            }
            if (missingSkillInfos.noskills) {
                const unknownSkillDb = _.WoDStorages.getSkillsUnknownDb();
                const tableContent = [];
                for (const [noSkillId, list] of Object.entries(missingSkillInfos.noskills)) {
                    const unknownEntry = await unknownSkillDb.getValue(noSkillId);
                    //console.log("DDDD", unknownEntry);
                    const angriffstypContainer = document.createElement("span");
                    let createAngriffsartSelect;
                    const wurfContainer = document.createElement("span");
                    let createWurfSelect;
                    let fehlend = false;

                    // 1: automatisch abgeleitet (konstant)
                    // 2: vom Benutzer gesetzt
                    // 0: unbestimmt
                    const typType = (unknownEntry.auto && unknownEntry.auto.typ) ? 1 : ((unknownEntry.user && unknownEntry.user.typ) ? 2 : 0);
                    const typValue = unknownEntry.typ;
                    const typSelect = document.createElement("select");
                    typSelect.innerHTML = "<option></option>";
                    for (const cur of Object.values(_.WoDSkillsDb.TYP)) {
                        if (cur === "Verschlechterung") continue;
                        let text = cur;
                        if (cur === "Angriff") text = "Angriff / Verschlechterung";
                        let selected = typValue === cur ? "selected" : "";
                        typSelect.innerHTML += "<option " + selected + " value='" + cur + "'>" + text + "</option>";
                    }
                    typSelect.onchange = async function () {
                        createAngriffsartSelect();
                        createWurfSelect();
                        const userBestimmung = unknownEntry.user || (unknownEntry.user = {});
                        unknownEntry.typ = userBestimmung.typ = typSelect.value;
                        await _.WoDStorages.getSkillsUnknownDb().setValue(unknownEntry);
                    }
                    if (typType === 1) {
                        typSelect.disabled = true;
                        typSelect.title = "Wurde automatisch bestimmt";
                    } else {
                        typSelect.title = "";
                    }
                    if (!typValue) fehlend = true;

                    createAngriffsartSelect = function () {
                        angriffstypContainer.innerHTML = "";
                        const angriffstypValue = unknownEntry.angriffstyp;
                        if (_.WoDSkillsDb.isAngriff(unknownEntry.typ)) {
                            const angriffstypType = (unknownEntry.auto && unknownEntry.auto.angriffstyp) ? 1 : ((unknownEntry.user && unknownEntry.user.angriffstyp) ? 2 : 0);
                            const angriffstypSelect = document.createElement("select");
                            angriffstypSelect.innerHTML = "<option></option>";
                            for (const cur of Object.values(_.WoDSkillsDb.ANGRIFFSTYP)) {
                                let selected = angriffstypValue === cur ? "selected" : "";
                                angriffstypSelect.innerHTML += "<option " + selected + ">" + cur + "</option>";
                            }
                            if (angriffstypType === 1) {
                                angriffstypSelect.disabled = true;
                                angriffstypSelect.title = "Wurde automatisch bestimmt";
                            }
                            angriffstypSelect.onchange = async function () {
                                const userBestimmung = unknownEntry.user || (unknownEntry.user = {});
                                unknownEntry.angriffstyp = userBestimmung.angriffstyp = angriffstypSelect.value;
                                await _.WoDStorages.getSkillsUnknownDb().setValue(unknownEntry);
                            }
                            angriffstypContainer.append(angriffstypSelect);
                            if (!angriffstypValue) fehlend = true;
                        }
                    }
                    createAngriffsartSelect();

                    createWurfSelect = function () {
                        wurfContainer.innerHTML = "";
                        if (_.WoDSkillsDb.isAngriff(unknownEntry.typ) && !unknownEntry.wurf) { // Würfe scheinen nicht ermittelt werden zu können.
                            const wurfSelect = document.createElement("input");
                            wurfSelect.type = "text";
                            const value = unknownEntry.user && unknownEntry.user.wurf;
                            if (value) wurfSelect.value = value;
                            wurfSelect.size = 4;
                            wurfSelect.maxLength = 5;
                            wurfContainer.append(wurfSelect);
                            wurfSelect.onchange = function () {
                                // TODO: speichern
                            }
                            if (!value) fehlend = true;
                        }
                    }
                    createWurfSelect();

                    const identifier = document.createElement("div");
                    identifier.innerHTML = noSkillId;
                    const wholeTable = document.createElement("table");
                    //wholeTable.style.width = "100%";
                    wholeTable.style.display = "none";
                    for (const cur of list) {
                        const tr = document.createElement("tr");
                        tr.innerHTML = cur.line;
                        tr.className = "row0";
                        wholeTable.append(tr);
                    }
                    identifier.onclick = function () {
                        wholeTable.style.display = (wholeTable.style.display === "none" ? "" : "none");
                    }
                    tableContent.push([identifier, typSelect, angriffstypContainer, wurfContainer]);
                    tableContent.push([{data: wholeTable, colSpan: 4}]);
                    if (fehlend) count++;
                }
                const table = _.UI.createTable(tableContent)
                //table.style.width = "100%";
                userInfoPanel.append(table);
            }
            userInfoPanel.className = "message_info";
            this.#preContent.append(userInfoPanel);
            if (canRefresh) {
                const reloadButton = _.UI.createRealButton("Aktualisieren", function () {
                    Mod.recalculateStats();
                });
                _.Libs.betterInput(reloadButton);
                userInfoPanel.append(reloadButton);
            }
            if (count) { // Warnung nur anzeigen, wenn wirklich noch was fehlt
                this.#warningMessage.innerHTML = _.UI.SIGNS.WARN + "<sup style='font-size:0.6em;'>" + count + "</sup>";
                this.#warningMessage.title = "Es konnten nicht alle Informationen zu den Fertigkeiten bestimmt werden!";
            }
        }

        static setTitleMessage(titleMessage, preventCollapsible) {
            this.#headerMessage.innerHTML = titleMessage;
            this.#collapsible.style.display = preventCollapsible ? "none" : "";
        }

        static logRuntimeError(error) {
            this.setTitleMessage("<span title='" + error + "'>️" + _.UI.SIGNS.ERROR + " Ein Fehler ist aufgetreten, es konnten diesmal leider keine Statistiken erstellt werden!</span>");
            this.#foundError = error;
            if (error.additionals) {
                console.error("Ein Fehler wurde abgefangen!", error, ...error.additionals);
            } else {
                console.error("Ein Fehler wurde abgefangen!", error);
            }
        }

        /**
         * führt die Funktion in einem gesicherten Kontext aus, um aufkommende Fehler abzufangen und konform anzuzeigen
         * jeglicher Code sollte in diesem Kontext laufen
         */
        static runSafe(asyncFunction) {
            try {
                const thisObject = this;
                const functionResult = asyncFunction()
                if (functionResult && functionResult.catch) {
                    functionResult.catch(error => {
                        thisObject.logRuntimeError(error);
                    });
                }
            } catch (error) {
                this.logRuntimeError(error);
            }
        }
    }

    class SearchEngine {

        static DEBUG_INDIRECT = false;
        static DEBUG_INDIRECT_VERBOSE = false;
        static DEBUG_INDIRECT_TRACE = false;
        static DEBUG_OWNER = false;

        static debugIndirect(...args) {
            if (this.DEBUG_INDIRECT) {
                console.log("[EKS][indirekt]", ...args);
            }
        }

        static debugIndirectVerbose(...args) {
            if (this.DEBUG_INDIRECT && this.DEBUG_INDIRECT_VERBOSE) {
                console.log("[EKS][indirekt][verbose]", ...args);
            }
        }

        static createStat() {
            return {
                result: {
                    0: 0,
                    1: 0,
                    2: 0,
                    3: 0,
                },
                value: 0,
                directValue: 0,
                indirectValue: 0,
                companionValue: 0,
                ruestung: 0,
                resistenz: 0,
                actions: Array(),
                actionsHelden: Array(),
                actionsMonster: Array(),
                targets: Array(),
            }
        }

        static findFirstHeldenLevel(levelDataArray) {
            for (const level of levelDataArray) {
                if (level) return level;
            }
        }

        static getStat(previousStats, queryFilter, id, subDomain, typeInitialize) {
            if (subDomain === "sub") {
                var subIds = previousStats.subIds;
                if (!subIds) {
                    subIds = {};
                    previousStats.subIds = subIds;
                }
                subIds[id] = true;
            }
            if (queryFilter && queryFilter.selection && !queryFilter.selection.includes(id)) return;
            var curObject = previousStats;
            if (subDomain) {
                var subDomainEntry = previousStats[subDomain];
                if (!subDomainEntry) {
                    subDomainEntry = {};
                    // Um immer die gleichen Reihenfolge anzulegen
                    if (typeInitialize === "herounit") {
                        let levelDataArray = previousStats.statRoot.levelDataArray;
                        this.findFirstHeldenLevel(levelDataArray).areas[0].rounds[0].helden.forEach(held => {
                            subDomainEntry[held.id.name] = this.createStat();
                        });
                    } else if (typeInitialize === "pos") {
                        subDomainEntry["Vorne"] = this.createStat();
                        subDomainEntry["Linke Seite"] = this.createStat();
                        subDomainEntry["Rechte Seite"] = this.createStat();
                        subDomainEntry["Zentrum"] = this.createStat();
                        subDomainEntry["Hinten"] = this.createStat();
                        subDomainEntry["Im Rücken"] = this.createStat();
                    } else if (typeInitialize === "skillType") {
                        subDomainEntry["Nahkampf"] = this.createStat();
                        subDomainEntry["Zauber"] = this.createStat();
                        subDomainEntry["Fernkampf"] = this.createStat();
                        subDomainEntry["Sozial"] = this.createStat();
                        subDomainEntry["Hinterhalt"] = this.createStat();
                        subDomainEntry["Explosion"] = this.createStat();
                        subDomainEntry["Verschrecken"] = this.createStat();
                    }
                    previousStats[subDomain] = subDomainEntry;
                }
                curObject = subDomainEntry;
            }
            var result = curObject[id];
            if (!result) {
                result = this.createStat()
                curObject[id] = result;
            }
            return result;
        }

        static addDmgStats = function (from, toStat) {
            toStat.value += from.value;
            if (from.type === "indirekt") {
                toStat.indirectValue += from.value;
            } else {
                toStat.directValue += from.value;
            }
            toStat.ruestung += from.ruestung;
            toStat.resistenz += from.resistenz;
        };

        static getCompanionDamageValue(damage) {
            if (!damage || damage === true) return 0;
            const value = Number(damage.value);
            if (!Number.isFinite(value)) return 0;
            return value;
        }

        static addUnitStats(stats, unit) {
            var unitStats = stats.units;
            if (!unitStats) {
                unitStats = [];
                stats.units = unitStats;
            }
            if (!unitStats.includes(unit)) unitStats.push(unit);
        }

        static addUnitId(action, unit) {
            if (unit.id.isHero) {
                unit.id.id = unit.id.name;
            } else {
                unit.id.id = unit.id.name + "_" + (unit.idx || 1) + "_" + action.level.nr + "_" + action.area.nr;
            }
        }

        static addTargetDmgStats = function (toStat, action, target, damage, hadDmgType, damageIndexFinal, companionDamageValue) {
            const isSyntheticCompanionOwnerAction = !!(action && action.syntheticCompanionOwnerAction);
            if (!isSyntheticCompanionOwnerAction && (hadDmgType || damageIndexFinal === 0)) {
                if (!toStat.targets.includes(target)) {
                    if (target.typ === "Parade") {
                        toStat.result[target.result]++;
                    }
                    toStat.targets.push(target);
                }
            }
            // actions: me on me, me on groupy, groupy on me, me on enemy, enemy on me
            if (!isSyntheticCompanionOwnerAction) {
                if (!toStat.actions.includes(action)) {
                    toStat.actions.push(action);
                }
                if (action.unit.id.isHero) {
                    if (!toStat.actionsHelden.includes(action)) {
                        toStat.actionsHelden.push(action);
                    }
                } else {
                    if (!toStat.actionsMonster.includes(action)) {
                        toStat.actionsMonster.push(action);
                    }
                }
            }
            if (damage !== true && !!damage) {
                SearchEngine.addDmgStats(damage, toStat); // gesamtschaden
                SearchEngine.addDmgStats(damage, SearchEngine.getStat(toStat, null, damage.type, "byDmgType"));
            }
            if (companionDamageValue > 0 && toStat.actionUnit && _.ReportParser.isUnitEqual(toStat.actionUnit, action.unit)) {
                toStat.companionValue += companionDamageValue;
            }
        }

        static createActionClassification(curStats, subStats, action, target, statTarget, queryFilterSpec) {
            switch (queryFilterSpec) {
                case "unit":
                    subStats.actionClassification = function (curAction) {
                        let curSettings = curStats.actionClassification(curAction);
                        return {
                            fromMe: curSettings.fromMe && _.ReportParser.isUnitEqual(statTarget.unit, curAction.unit),
                            atMe: curSettings.atMe && !!util.arraySearch(curAction.targets, target => _.ReportParser.isUnitEqual(statTarget.unit, target.unit)),
                            cmp: "unit", // nur fürs debugging
                        }
                    }
                    break;
                default:
                    subStats.actionClassification = curStats.actionClassification;
            }
        }

        static FilterKriterien = {
            "position": {
                name: "Position",
                apply: (statRoot, curStats, queryFilter, action, target, statTarget) => {
                    return SearchEngine.getStat(curStats, queryFilter, statTarget.unit.pos, "sub", "pos");
                }
            },
            "enemy_position": {
                name: "Gegner-Position",
                apply: (statRoot, curStats, queryFilter, action, target, statTarget) => {
                    return SearchEngine.getStat(curStats, queryFilter, statTarget.unit.pos, "sub", "pos");
                }
            },
            "unit": {
                name: "Einheit",
                apply: (statRoot, curStats, queryFilter, action, target, statTarget) => {
                    let subStats = SearchEngine.getStat(curStats, queryFilter, SearchEngine.getDisplayUnitName(statTarget.unit), "sub", statTarget.unit.id.isHero ? "herounit" : null);
                    if (!subStats) return false;
                    const unit = statTarget.unit;
                    if (!subStats.unit || (!subStats.unit.typeRef && unit.typeRef)) {
                        subStats.unit = unit;
                    }
                    const title = SearchEngine.getDisplayUnitTitle(unit);
                    const hasLink = ("" + title).indexOf("<a") !== -1;
                    const hadLink = subStats.title && ("" + subStats.title).indexOf("<a") !== -1;
                    if (!subStats.title || hasLink || !hadLink) {
                        subStats.title = title;
                    }

                    if (!unit.id.isHero) {
                        var unitCount = subStats.unitCount;
                        if (!unitCount) {
                            unitCount = {};
                            subStats.unitCount = unitCount;
                        }
                        unitCount[unit.id.id] = true;
                    }
                    if (_.ReportParser.isUnitEqual(unit, action.unit)) {
                        subStats.actionUnit = unit;
                    }
                    return subStats;
                }
            },
            "enemy_unit": {
                name: "Gegner-Einheit",
                apply: (statRoot, curStats, queryFilter, action, target, statTarget) => {
                    let subStats = SearchEngine.getStat(curStats, queryFilter, SearchEngine.getDisplayUnitName(statTarget.unit), "sub", statTarget.unit.id.isHero ? "herounit" : null);
                    if (!subStats) return false;
                    const unit = statTarget.unit;
                    if (!subStats.unit || (!subStats.unit.typeRef && unit.typeRef)) {
                        subStats.unit = unit;
                    }
                    const title = SearchEngine.getDisplayUnitTitle(unit);
                    const hasLink = ("" + title).indexOf("<a") !== -1;
                    const hadLink = subStats.title && ("" + subStats.title).indexOf("<a") !== -1;
                    if (!subStats.title || hasLink || !hadLink) {
                        subStats.title = title;
                    }

                    if (!unit.id.isHero) {
                        var unitCount = subStats.unitCount;
                        if (!unitCount) {
                            unitCount = {};
                            subStats.unitCount = unitCount;
                        }
                        unitCount[unit.id.id] = true;
                    }
                    if (_.ReportParser.isUnitEqual(unit, action.unit)) {
                        subStats.actionUnit = unit;
                    }
                    return subStats;
                }
            },
            "skillType": {
                name: "AngriffsTyp",
                apply: (statRoot, curStats, queryFilter, action, target, statTarget) => {
                    return SearchEngine.getStat(curStats, queryFilter, statTarget.skill.angriffstyp, "sub", "skillType");
                }
            },
            "skillName": {
                name: "Fertigkeit",
                apply: (statRoot, curStats, queryFilter, action, target, statTarget) => {
                    if (!statTarget || !statTarget.skill) return;
                    if (statRoot.wantHeroes !== !!statTarget.unit.id.isHero) return;
                    let subStats = SearchEngine.getStat(curStats, queryFilter, statTarget.skill.name, "sub", "skillName");
                    subStats.title = statTarget.skill.typeRef;
                    return subStats;
                }
            },
            "skill_active": {
                name: "Fertigkeit(Aktiv)",
                apply: (statRoot, curStats, queryFilter, action, target, statTarget) => {
                    if (!statTarget || !statTarget.skill) return;
                    if (statRoot.wantHeroes !== !!statTarget.unit.id.isHero) return;
                    console.log("isso", action, curStats.actionClassification(action));
                    if (!curStats.actionClassification(action).fromMe) return;
                    let subStats = SearchEngine.getStat(curStats, queryFilter, statTarget.skill.name, "sub", "skillName");
                    if (!subStats) return;
                    subStats.title = statTarget.skill.typeRef;
                    return subStats;
                }
            },
            "level": {
                name: "Level",
                apply: (statRoot, curStats, queryFilter, action, target, statTarget) => {
                    let subStats = SearchEngine.getStat(curStats, queryFilter, "Level " + action.level.nr, "sub", "level");
                    if (!subStats) return false;
                    const areas = action.level.areas;
                    subStats.title = "Level " + action.level.nr + "<br>(" + action.level.roundCount + " Runden)" + (action.area.nr === 1 ? "" : "<br>(" + areas.length + " Kämpfe)");
                    return subStats;
                }
            },
            "fight": {
                name: "Kampf",
                apply: (filterCfg, curStats, queryFilter, action, target, statTarget) => {
                    let subStats = SearchEngine.getStat(curStats, queryFilter, action.level.nr + "_" + action.area.nr, "sub", "fight");
                    if (!subStats) return false;
                    subStats.title = "Kampf " + action.level.nr + "." + action.area.nr + "<br>(" + action.area.rounds.length + " Runden)";
                    return subStats;
                }
            },
            "items": {
                name: "Gegenstände",
                apply: (statRoot, curStats, queryFilter, action, target, statTarget) => {
                    let subStats = SearchEngine.getStat(curStats, queryFilter, _.util.arrayMap(statTarget.skill.items, a => a.name).join(", "), "sub", "items");
                    if (!subStats) return false;
                    subStats.title = _.util.arrayMap(statTarget.skill.items, a => a.srcRef).join(", ");
                    return subStats;
                }
            },
            "dmgType": {
                name: "Schadensart",
                apply: (statRoot, curStats, queryFilter, action, target, statTarget, damage) => {
                    statRoot.hadDmgType = true;
                    let subStats = SearchEngine.getStat(curStats, queryFilter, damage === true ? "Ohne Schaden" : damage.type, "sub", "dmgType");
                    if (!subStats) return false;
                    return subStats;
                }
            },

        }

        static normalizeEffectSourceName(name) {
            let result = ("" + (name || "")).trim().toLowerCase();
            result = result.replace(/ß/g, "ss");
            if (result.normalize) {
                result = result.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            }
            result = result.replace(/[^a-z0-9]+/g, " ").trim();
            return result;
        }

        static getUnitKey(unit) {
            if (!unit || !unit.id) return "?";
            return (unit.id.name || "?") + "|" + (unit.id.idx || 1) + "|" + (!!unit.id.isHero ? "h" : "m");
        }

        static getTargetUnitKey(unit) {
            if (!unit || !unit.id) return "?";
            const id = unit.id;
            return (id.name || "?") + "|" + (id.idx || 1) + "|" + (!!id.isHero ? "h" : "m");
        }

        static getUnitOwnerName(unit) {
            if (!unit) return null;
            if (unit.id && unit.id.ownerName) return unit.id.ownerName;
            if (unit.id && unit.id.ownerId && unit.id.ownerId.name) return unit.id.ownerId.name;
            if (unit.ownerName) return unit.ownerName;
            if (unit.ownerId && unit.ownerId.name) return unit.ownerId.name;
            return null;
        }

        static getDisplayUnitName(unit) {
            const baseName = unit && unit.id && unit.id.name ? unit.id.name : "?";
            const ownerName = this.getUnitOwnerName(unit);
            if (!ownerName || ownerName === baseName) return baseName;
            return baseName + " (gehört " + ownerName + ")";
        }

        static isLikelyMyHero(unit) {
            if (!unit || !unit.id || !unit.id.isHero) return false;
            const myHeroNode = document.querySelector("a.rep_myhero");
            if (!myHeroNode) return false;
            const myHeroName = (myHeroNode.textContent || "").trim();
            const unitName = (unit.id.name || "").trim();
            return !!myHeroName && unitName === myHeroName;
        }

        static getDisplayUnitTitle(unit) {
            const ownerName = this.getUnitOwnerName(unit);
            const baseName = unit && unit.id && unit.id.name ? unit.id.name : "?";
            const ownerSuffix = ownerName && ownerName !== baseName ? " <span style='font-size:10px;color:#b8b8b8;'>(gehört " + ownerName + ")</span>" : "";
            if (unit && unit.typeRef) return unit.typeRef + ownerSuffix;
            const cssClass = unit && unit.id && unit.id.className
                ? unit.id.className
                : (unit && unit.id && unit.id.isHero ? (this.isLikelyMyHero(unit) ? "rep_myhero" : "rep_hero") : "rep_monster");
            return "<span class='" + cssClass + "'>" + this.getDisplayUnitName(unit) + "</span>" + ownerSuffix;
        }

        static getScopedUnitKey(level, area, unit) {
            return (level && level.nr ? level.nr : "?") + "|" + (area && area.nr ? area.nr : "?") + "|" + this.getTargetUnitKey(unit);
        }

        static getCompanionUnitKey(unit) {
            return this.getTargetUnitKey(unit);
        }

        static isSummonAction(action) {
            if (!action || !action.skill) return false;
            const skillType = ("" + (action.skill.typ || "")).toLowerCase();
            const skillName = ("" + (action.skill.name || "")).toLowerCase();
            return skillType === "ruft helfer" || skillName === "ruft helfer";
        }

        static registerCompanionOwners(companionOwnerByUnitKey, action) {
            if (!this.isSummonAction(action) || !action || !action.unit) return;
            (action.targets || []).forEach(target => {
                if (!target || !target.unit) return;
                if (_.ReportParser.isUnitEqual(target.unit, action.unit)) return;
                const scopedKey = this.getScopedUnitKey(action.level, action.area, target.unit);
                const companionKey = this.getCompanionUnitKey(target.unit);
                companionOwnerByUnitKey[scopedKey] = action.unit;
                companionOwnerByUnitKey[companionKey] = action.unit;
                target.unit.ownerId = {
                    name: action.unit.id && action.unit.id.name,
                    idx: action.unit.id && action.unit.id.idx,
                    isHero: action.unit.id && action.unit.id.isHero,
                };
                target.unit.ownerName = action.unit.id && action.unit.id.name;
                if (this.DEBUG_OWNER && target.unit && target.unit.id && /d\u00fcsterwolf/i.test(target.unit.id.name || "")) {
                    console.log("[EKS][owner] register", {
                        unit: target.unit.id && target.unit.id.name,
                        scopedKey: scopedKey,
                        companionKey: companionKey,
                        owner: target.unit.ownerName,
                        level: action.level && action.level.nr,
                        area: action.area && action.area.nr,
                    });
                }
            });
        }

        static resolveCompanionOwner(companionOwnerByUnitKey, action, round) {
            if (!action || !action.unit) return null;
            const ownerId = (action.unit.ownerId && action.unit.ownerId.name) ? action.unit.ownerId : (action.unit.id && action.unit.id.ownerId && action.unit.id.ownerId.name ? action.unit.id.ownerId : null);
            if (ownerId) {
                if (round && round.unitLookup) {
                    const resolved = round.unitLookup(ownerId, true) || {id: ownerId};
                    if (this.DEBUG_OWNER && action.unit && action.unit.id && /d\u00fcsterwolf/i.test(action.unit.id.name || "")) {
                        console.log("[EKS][owner] resolve-direct", {
                            unit: action.unit.id && action.unit.id.name,
                            owner: ownerId.name,
                            resolved: resolved && resolved.id && resolved.id.name,
                            level: action.level && action.level.nr,
                            area: action.area && action.area.nr,
                        });
                    }
                    return resolved;
                }
                return {id: ownerId};
            }
            const scopedKey = this.getScopedUnitKey(action.level, action.area, action.unit);
            const companionKey = this.getCompanionUnitKey(action.unit);
            const resolved = companionOwnerByUnitKey[scopedKey] || companionOwnerByUnitKey[companionKey] || null;
            if (this.DEBUG_OWNER && action.unit && action.unit.id && /d\u00fcsterwolf/i.test(action.unit.id.name || "")) {
                console.log("[EKS][owner] resolve-map", {
                    unit: action.unit.id && action.unit.id.name,
                    scopedKey: scopedKey,
                    companionKey: companionKey,
                    owner: resolved && resolved.id && resolved.id.name,
                    level: action.level && action.level.nr,
                    area: action.area && action.area.nr,
                });
            }
            return resolved;
        }

        static parseHpLossFromWirkung(effect) {
            if (!effect || !effect.name) return 0;
            if (!/Heilung\s+Hitpoints/i.test("" + effect.name)) return 0;
            const match = ("" + (effect.wirkung || "")).match(/([-+]?\d+(?:[\.,]\d+)?)/);
            if (!match) return 0;
            const parsed = Number(match[1].replace(",", "."));
            if (!Number.isFinite(parsed) || parsed >= 0) return 0;
            return -parsed;
        }

        static registerActionEffectSources(effectSourceHistory, action) {
            const isEventAction = !!(action && (action.event || (action.skill && action.skill.event)));
            if (!action || !action.unit || isEventAction) return;
            const sourceNames = [];
            if (action.skill && action.skill.name) sourceNames.push(action.skill.name);
            ((action.skill && action.skill.items) || []).forEach(item => {
                if (item && item.name) sourceNames.push(item.name);
            });
            const unitKey = this.getUnitKey(action.unit);
            const targetKeys = [];
            (action.targets || []).forEach(target => {
                if (target && target.unit) {
                    const targetKey = this.getTargetUnitKey(target.unit);
                    if (!targetKeys.includes(targetKey)) targetKeys.push(targetKey);
                }
            });
            if (targetKeys.length === 0) return;
            sourceNames.forEach(sourceName => {
                const key = this.normalizeEffectSourceName(sourceName);
                if (!key) return;
                const byTarget = effectSourceHistory[key] || (effectSourceHistory[key] = {});
                targetKeys.forEach(targetKey => {
                    const map = byTarget[targetKey] || (byTarget[targetKey] = {});
                    map[unitKey] = action.unit;
                });
            });
        }

        static registerRoundEffectSources(effectSourceHistory, round) {
            const allActions = [];
            ["vorrunde", "runde", "initiative"].forEach(actionType => {
                (round.actions[actionType] || []).forEach(action => allActions.push(action));
            });
            allActions.forEach(action => this.registerActionEffectSources(effectSourceHistory, action));
        }

        static getRoundStatusUnit(round, targetUnit) {
             const units = [];
             (round.helden || []).forEach(unit => units.push(unit));
             (round.monster || []).forEach(unit => units.push(unit));
             const targetIdx = targetUnit && targetUnit.id && targetUnit.id.idx;
             const targetName = targetUnit && targetUnit.id && targetUnit.id.name;
             const targetOwnerName = this.getUnitOwnerName(targetUnit);
             const targetSide = targetUnit && targetUnit.id && targetUnit.id.isHero;
             const matchesOwner = unit => {
                 if (!targetOwnerName) return false;
                 if (!unit || !unit.id) return false;
                 const unitOwnerName = this.getUnitOwnerName(unit);
                 if (unitOwnerName && unitOwnerName === targetOwnerName) return true;
                 if (unit.id.ownerId && unit.id.ownerId.name && unit.id.ownerId.name === targetOwnerName) return true;
                 return false;
             };
             if (targetIdx !== undefined && targetIdx !== null && targetIdx !== "") {
                 const exact = util.arraySearch(units, unit => {
                     return unit && unit.id && unit.id.name === targetName && ("" + unit.id.idx) === ("" + targetIdx);
                 });
                 if (exact) return exact;
             }
             if (targetOwnerName) {
                 const ownerExact = util.arraySearch(units, unit => {
                     if (!unit || !unit.id || unit.id.name !== targetName) return false;
                     if (targetSide !== undefined && !!unit.id.isHero !== !!targetSide) return false;
                     if (!matchesOwner(unit)) return false;
                     if (targetIdx !== undefined && targetIdx !== null && targetIdx !== "") {
                         return ("" + unit.id.idx) === ("" + targetIdx);
                     }
                     return true;
                 });
                 if (ownerExact) return ownerExact;
             }
             const unitEqual = util.arraySearch(units, unit => _.ReportParser.isUnitEqual(unit, targetUnit));
             if (unitEqual) return unitEqual;

             // Fallback: auch nach einer toten/abwesenden Unit mit gleichen Namen suchen (für persistente Effekte)
             // Dies ist wichtig, wenn eine Unit gestorben ist, aber ihre Effekte noch wirken
             if (targetName && !targetUnit.id.ownerId) {
                 const deadUnit = util.arraySearch(units, unit => {
                     if (!unit || !unit.id) return false;
                     if (unit.id.name !== targetName) return false;
                     if (targetSide !== undefined && !!unit.id.isHero !== !!targetSide) return false;
                     return true;
                 });
                 if (deadUnit) return deadUnit;
             }
             return null;
         }

        static isWhiteStatusActive(unit) {
            if (!unit) return false;
            const zustandClass = ("" + (unit.zustandClass || "")).toLowerCase();
            if (zustandClass.includes("rep_wounds_none")) return true;
            if (zustandClass.includes("rep_status_msg")) return false;

            const zustand = ("" + (unit.zustand || "")).trim().toLowerCase();
            if (!zustand) return false;
            if (/bewusstlos|zerst\u00f6rt|tot|versteckt|au\u00dfer\s+gefecht|kampfunf\u00e4hig/.test(zustand)) return false;
            return /bereit\s+zum\s+kampf|angriffslustig|kerngesund/.test(zustand);
        }

        static isUnitStillInFight(unit) {
            if (!unit) return false;
            const zustandClass = ("" + (unit.zustandClass || "")).toLowerCase();
            if (zustandClass.includes("rep_status_msg")) return false;
            const zustand = ("" + (unit.zustand || "")).trim().toLowerCase();
            if (!zustand) return false;
            return !/bewusstlos|zerst\u00f6rt|tot|versteckt|au\u00dfer\s+gefecht|kampfunf\u00e4hig/.test(zustand);
        }

        static resolveHpLossContributors(round, targetUnit, effectSourceHistory) {
             const statusUnit = this.getRoundStatusUnit(round, targetUnit);
             let sourceList = [];

             if (statusUnit && statusUnit.fx && statusUnit.fx.length > 0) {
                 // Normal case: Unit hat aktive Effekte in der aktuellen Runde
                 sourceList = statusUnit.fx;
             } else if (effectSourceHistory && Object.keys(effectSourceHistory).length > 0) {
                 // Fallback: Unit ist tot oder nicht in der Runde,aber hat noch Effekte von vorherigen Runden
                 const targetKey = this.getTargetUnitKey(targetUnit);
                 for (const sourceKey of Object.keys(effectSourceHistory)) {
                     const byTarget = effectSourceHistory[sourceKey];
                     if (byTarget && byTarget[targetKey] && Object.keys(byTarget[targetKey]).length > 0) {
                         // Es gibt bereits registrierte Contributors für diese Quelle und dieses Ziel
                         // Das bedeutet, dieser Effekt war in vorherigen Runden aktiv und sollte weiterwirken
                         sourceList.push({
                             quelle: sourceKey,
                             fx: [{name: "Persistent", wirkung: "-1"}],
                         });
                     }
                 }
             }

             if (!sourceList || sourceList.length === 0) {
                 return {
                     contributors: [],
                     knownWeight: 0,
                     totalWeight: 0,
                     debugSources: [],
                     sourceRejectSummary: {},
                     contributorRejectSummary: {},
                 };
             }
             const allUnits = [];
             (round.helden || []).forEach(unit => allUnits.push(unit));
             (round.monster || []).forEach(unit => allUnits.push(unit));
             const allUnitKeys = {};
             allUnits.forEach(unit => {
                 allUnitKeys[this.getUnitKey(unit)] = unit;
             });
             const weights = {};
            let totalWeight = 0;
            const debugSources = [];
            const sourceRejectSummary = {};
            const contributorRejectSummary = {};
             const addReason = (summary, reason) => {
                 if (!reason) return;
                 summary[reason] = (summary[reason] || 0) + 1;
             };
             for (const sourceEntry of sourceList) {
                if (!sourceEntry || !sourceEntry.quelle || !sourceEntry.fx) {
                    addReason(sourceRejectSummary, "SOURCE_ENTRY_INVALID");
                    continue;
                }
                let hpLossValue = 0;
                sourceEntry.fx.forEach(effect => {
                    hpLossValue += this.parseHpLossFromWirkung(effect);
                });
                if (!(hpLossValue > 0)) {
                    addReason(sourceRejectSummary, "HPLOSS_NON_POSITIVE");
                    continue;
                }
                totalWeight += hpLossValue;

                const sourceKey = this.normalizeEffectSourceName(sourceEntry.quelle);
                const targetKey = this.getTargetUnitKey(targetUnit);
                const byTarget = effectSourceHistory[sourceKey];
                let contributors = (byTarget && byTarget[targetKey]) ? Object.values(byTarget[targetKey]) : [];
                let usedFallback = false;
                if (contributors.length === 0 && byTarget && targetUnit && targetUnit.id) {
                    // Fallback: gleiche Ziel-Einheit ohne idx-Zwang (Name+Seite), falls idx in Event/Action abweicht.
                    const targetName = (targetUnit.id.name || "").toLowerCase();
                    const targetSide = !!targetUnit.id.isHero ? "h" : "m";
                    const matchingKeys = Object.keys(byTarget).filter(curKey => {
                        const parts = ("" + curKey).split("|");
                        if (parts.length < 3) return;
                        const keyName = (parts[0] || "").toLowerCase();
                        const keySide = parts[2];
                        return keyName === targetName && keySide === targetSide;
                    });
                    if (matchingKeys.length === 1) {
                        contributors = Object.values(byTarget[matchingKeys[0]] || {});
                        usedFallback = contributors.length > 0;
                    }
                }
                const sourceDebug = {
                    source: sourceEntry.quelle,
                    normalizedSource: sourceKey,
                    hpLossValue: hpLossValue,
                    effects: (sourceEntry.fx || []).map(effect => ({
                        name: effect && effect.name,
                        wirkung: effect && effect.wirkung,
                        parsedHpLoss: this.parseHpLossFromWirkung(effect),
                    })),
                    targetKey: targetKey,
                    usedFallback: usedFallback,
                    candidateCount: contributors.length,
                    acceptedCount: 0,
                    rejectedCount: 0,
                    contributorDecisions: [],
                    matchedContributors: contributors.map(unit => unit.id && unit.id.name),
                };
                debugSources.push(sourceDebug);
                if (contributors.length === 0) {
                    addReason(sourceRejectSummary, "NO_HISTORY_FOR_SOURCE_TARGET");
                    sourceDebug.reason = "NO_HISTORY_FOR_SOURCE_TARGET";
                    continue;
                }

                const acceptedContributors = [];
                contributors.forEach(unit => {
                    if (_.ReportParser.isUnitEqual(unit, targetUnit)) {
                        sourceDebug.rejectedCount++;
                        sourceDebug.contributorDecisions.push({
                            unit: unit && unit.id && unit.id.name,
                            unitKey: this.getUnitKey(unit),
                            accepted: false,
                            reason: "REJECT_SELF_DAMAGE",
                        });
                        addReason(contributorRejectSummary, "REJECT_SELF_DAMAGE");
                        return; // Selbstschaden nicht zurechnen
                    }
                     const unitKey = this.getUnitKey(unit);
                     if (!allUnitKeys[unitKey]) {
                         sourceDebug.rejectedCount++;
                         sourceDebug.contributorDecisions.push({
                             unit: unit && unit.id && unit.id.name,
                             unitKey: unitKey,
                             accepted: false,
                             reason: "REJECT_NOT_IN_ROUND",
                         });
                         addReason(contributorRejectSummary, "REJECT_NOT_IN_ROUND");
                         return; // Nur Einheiten aus dieser Runde (auch tote)
                     }
                    acceptedContributors.push(unit);
                    sourceDebug.acceptedCount++;
                    sourceDebug.contributorDecisions.push({
                        unit: unit && unit.id && unit.id.name,
                        unitKey: unitKey,
                        accepted: true,
                        reason: "ACCEPT",
                    });
                });
                if (acceptedContributors.length === 0) {
                    addReason(sourceRejectSummary, "NO_ELIGIBLE_CONTRIBUTORS");
                    continue;
                }
                const contributionPerSource = hpLossValue / acceptedContributors.length;
                acceptedContributors.forEach(unit => {
                    const unitKey = this.getUnitKey(unit);
                    const current = weights[unitKey] || {unit: unit, weight: 0};
                    current.weight += contributionPerSource;
                    weights[unitKey] = current;
                });
            }
            const contributors = Object.values(weights);
            let knownWeight = 0;
            contributors.forEach(cur => knownWeight += cur.weight || 0);
            return {
                contributors: contributors,
                knownWeight: knownWeight,
                totalWeight: totalWeight,
                debugSources: debugSources,
                sourceRejectSummary: sourceRejectSummary,
                contributorRejectSummary: contributorRejectSummary,
            };
        }

        static splitHpLossDamageByContributors(damageValue, contributionContext) {
            if (!(damageValue > 0) || !contributionContext || !contributionContext.contributors || contributionContext.contributors.length === 0) return [];
            const contributors = contributionContext.contributors;
            const knownWeight = contributionContext.knownWeight || 0;
            const totalWeight = contributionContext.totalWeight || 0;
            if (!(knownWeight > 0) || !(totalWeight > 0)) return [];

            const assignableDamage = Math.min(damageValue, knownWeight);
            if (!(assignableDamage > 0)) return [];

            if (contributors.length === 1) {
                return [{
                    unit: contributors[0].unit,
                    value: assignableDamage,
                }];
            }

            // Faire Verteilung: erwarteter Marginalbeitrag über alle Reihenfolgen.
            // Das ist die Shapley-Verteilung für v(S)=min(assignableDamage, sum(capacity)).
            const n = contributors.length;
            if (n > 16) { // Sicherheitsfallback bei sehr vielen Quellen
                const resultFallback = [];
                let assignedFallback = 0;
                for (let i = 0; i < n; i++) {
                    const contributor = contributors[i];
                    let value;
                    if (i === n - 1) {
                        value = assignableDamage - assignedFallback;
                    } else {
                        value = assignableDamage * ((contributor.weight || 0) / knownWeight);
                        assignedFallback += value;
                    }
                    if (value > 0) {
                        resultFallback.push({unit: contributor.unit, value: value});
                    }
                }
                return resultFallback;
            }

            const factorial = [1];
            for (let i = 1; i <= n; i++) factorial[i] = factorial[i - 1] * i;
            const nFact = factorial[n];
            const capacities = contributors.map(cur => Math.max(0, Number(cur.weight) || 0));
            const subsetCount = 1 << n;
            const subsetSum = new Array(subsetCount).fill(0);
            for (let mask = 1; mask < subsetCount; mask++) {
                const lsb = mask & -mask;
                const idx = Math.log2(lsb) | 0;
                subsetSum[mask] = subsetSum[mask ^ lsb] + capacities[idx];
            }

            const values = new Array(n).fill(0);
            for (let i = 0; i < n; i++) {
                for (let mask = 0; mask < subsetCount; mask++) {
                    if (mask & (1 << i)) continue;
                    const s = this.popCount(mask);
                    const coeff = (factorial[s] * factorial[n - s - 1]) / nFact;
                    const vWithout = Math.min(assignableDamage, subsetSum[mask]);
                    const vWith = Math.min(assignableDamage, subsetSum[mask] + capacities[i]);
                    values[i] += coeff * (vWith - vWithout);
                }
            }

            const result = [];
            for (let i = 0; i < n; i++) {
                const value = values[i];
                if (value > 0) {
                    result.push({
                        unit: contributors[i].unit,
                        value: value,
                    });
                }
            }
            this.debugIndirect("Split", {
                requestedDamage: damageValue,
                assignableDamage: assignableDamage,
                cappedToKnownWeight: assignableDamage < damageValue,
                knownWeight: knownWeight,
                totalWeight: totalWeight,
                contributors: contributors.map((cur, idx) => ({
                    unit: cur.unit && cur.unit.id && cur.unit.id.name,
                    weight: capacities[idx],
                    share: values[idx],
                })),
            });
            return result;
        }

        static popCount(num) {
            let count = 0;
            while (num) {
                num &= (num - 1);
                count++;
            }
            return count;
        }

        static doQuery(statQuery, levelDataArray) {
            const wantHeroes = statQuery.side === "heroes";
            const wantDefense = statQuery.type === "defense";
            const wantAll = statQuery.type === "all";

            function doAnalysis(stats, filter, action, target, damage, damageIndexFinal, companionDamageValue) {
                const statRoot = {
                    hadDmgType: false,
                    levelDataArray: levelDataArray,
                    wantHeroes: wantHeroes,
                }

                function applyFilter(curStats, queryFilter, action, target, statTarget) {
                    curStats.statRoot = statRoot;
                    const filterKriterium = SearchEngine.FilterKriterien[queryFilter.spec];
                    if (!filterKriterium) {
                        throw _.util.error("StatQuery-Filter ist nicht valide: '" + queryFilter.spec + "'");
                    }
                    const subStats = filterKriterium.apply(statRoot, curStats, queryFilter, action, target, statTarget, damage);
                    if (!subStats) return subStats;
                    SearchEngine.createActionClassification(curStats, subStats, action, target, statTarget, queryFilter.spec);
                    if (!subStats.actionUnit && curStats.actionUnit) {
                        subStats.actionUnit = curStats.actionUnit;
                    }
                    subStats.filterType = queryFilter.spec;
                    return subStats;
                }

                const execFilter = function (curStats, filters) {
                    if (!filters || filters.length === 0) {
                        SearchEngine.addTargetDmgStats(curStats, action, target, damage, statRoot.hadDmgType, damageIndexFinal, companionDamageValue);
                        return true;
                    }

                    const queryFilter = filters[0];
                    const curFilter = queryFilter.spec;
                    var statTarget;
                    var secondStatTarget;
                    if (curFilter.startsWith("skillType") || curFilter.startsWith("skill") || curFilter.startsWith("skillName")) { // attackType und skill sind immer auf der aktiven Unit
                        statTarget = action;
                    } else if (wantAll) {
                        if (wantHeroes) {
                            statTarget = action.unit.id.isHero ? action : null;
                            if (target) secondStatTarget = target.unit.id.isHero ? target : null;
                        } else {
                            statTarget = action.unit.id.isHero ? null : action;
                            if (target) secondStatTarget = target.unit.id.isHero ? null : target;
                        }
                    } else if (curFilter.startsWith("enemy_")) {
                        statTarget = wantDefense ? action : target;
                    } else {
                        statTarget = wantDefense ? target : action;
                    }

                    const tail = filters.slice(1);
                    if (statTarget) {
                        let subStats = applyFilter(curStats, queryFilter, action, target, statTarget);
                        if (subStats) {
                            SearchEngine.addTargetDmgStats(curStats, action, target, damage, statRoot.hadDmgType, damageIndexFinal, companionDamageValue);
                            execFilter(subStats, tail);
                        }
                    }
                    if (secondStatTarget) {
                        let subStats = applyFilter(curStats, queryFilter, action, target, secondStatTarget);
                        if (subStats) {
                            SearchEngine.addTargetDmgStats(curStats, action, target, damage, statRoot.hadDmgType, damageIndexFinal, companionDamageValue);
                            execFilter(subStats, tail);
                        }
                    }
                }
                execFilter(stats, filter);
            }

            var stats = this.createStat();
            const companionOwnerByUnitKey = {};
            const indirectAttributionByContributor = {};
            const indirectAttributionTrace = [];


            var filter = statQuery.filter; // position, attackType, fertigkeit, units
            for (var levelNr = 1, levelCount = levelDataArray.length; levelNr <= levelCount; levelNr++) {
                const finalLevelNr = levelNr;
                const level = levelDataArray[levelNr - 1];
                if (!level) continue;
                level.nr = levelNr;
                level.roundCount = LevelData.getRoundCount(level);
                if (!level) continue;
                const areas = level.areas;
                for (var areaNr = 1, areaCount = areas.length; areaNr <= areaCount; areaNr++) {
                    const area = areas[areaNr - 1];
                    area.nr = areaNr;
                    const finalAreaNr = areaNr;
                    const effectSourceHistory = {};

                    const rounds = area.rounds;
                    for (var roundNr = 0, l = rounds.length; roundNr < l; roundNr++) {
                        var round = rounds[roundNr];
                        round.nr = roundNr + 1;
                        let actionForStats = Array();
                        if (wantAll) {
                            stats.actionClassification = function (curAction) {
                                return {
                                    fromMe: wantHeroes === !!curAction.unit.id.isHero,
                                    atMe: wantHeroes === !!curAction.unit.id.isHero,
                                    fromGroup: wantHeroes === !!curAction.unit.id.isHero,
                                    atGroup: wantHeroes === !!curAction.unit.id.isHero,
                                    cmp: "floor", // nur fürs debugging
                                }
                            }
                            if (wantHeroes) {
                                round.helden.forEach(unit => {
                                    var action = {
                                        name: this.getDisplayUnitName(unit),
                                        unit: unit,
                                        fertigkeit: null,
                                        targets: [],
                                        level: level,
                                        area: area,
                                        round: round,
                                        type: "init",
                                        src: "<tr><td></td><td>" + this.getDisplayUnitName(unit) + " tritt in die Runde mit " + unit.hp + " HP und " + unit.mp + " MP ein</td></tr>",
                                    };

                                    doAnalysis(stats, filter, action);
                                });
                            }
                            (round.actions.vorrunde || []).forEach(action => {
                                action.type = "vorrunde";
                                actionForStats.push(action);
                            });

                            (round.actions.regen || []).forEach(action => {
                                action.type = "regen";
                                actionForStats.push(action);
                            });

                            (round.actions.initiative || []).forEach(action => {
                                action.type = "initiative";
                                actionForStats.push(action);
                            });

                            (round.actions.runde || []).forEach(action => {
                                action.type = "action";
                                actionForStats.push(action);
                            });
                        } else {
                            round.actions.runde.forEach(action => {
                                action.type = "action";
                                actionForStats.push(action);
                            });
                        }

                        actionForStats.forEach(action => {
                            var isHero = action.unit.id.isHero;
                            action.level = level;
                            action.area = area;
                            action.round = round;
                            this.registerCompanionOwners(companionOwnerByUnitKey, action);
                            const companionOwnerUnit = this.resolveCompanionOwner(companionOwnerByUnitKey, action, round);

                            if (wantAll || (wantHeroes && !wantDefense && isHero) || (!wantHeroes && wantDefense && isHero) || (!wantHeroes && !wantDefense && !isHero) || (wantHeroes && wantDefense && !isHero)) {
                                SearchEngine.addUnitId(action, action.unit);
                                action.targets.forEach(target => {
                                    if (statQuery.type === "attack" || statQuery.type === "defense") {
                                        const isHpLossEvent = !!((action.event && action.event.kind === "hploss") || (action.skill && action.skill.event && action.skill.name === "hploss"));
                                        if (target.typ !== "Parade" && !isHpLossEvent) { // Es wurde eine Verteidigungs-Probe gewürfelt
                                            return;
                                        }
                                    }
                                    SearchEngine.addUnitId(action, target.unit);
                                    stats.actionClassification = function (curAction) {
                                        return {
                                            fromMe: wantHeroes === !!curAction.unit.id.isHero,
                                            atMe: !!util.arraySearch(curAction.targets, target => wantHeroes === !!target.unit.id.isHero),
                                            fromGroup: wantHeroes === !!curAction.unit.id.isHero,
                                            atGroup: wantHeroes === !!util.arraySearch(action.targets, target => _.ReportParser.isUnitEqual(curAction.unit, target.unit)),
                                            cmp: "nxt", // nur fürs debugging
                                        }
                                    }

                                    var damages = target.damage; // nur bei "true" wird die action auch gezählt
                                    if (!damages || damages.length === 0) damages = [true];
                                    for (var damageIndex = 0, damageLength = damages.length; damageIndex < damageLength; damageIndex++) {
                                        const damage = damages[damageIndex];
                                        doAnalysis(stats, filter, action, target, damage, damageIndex);
                                        const companionDamageValue = this.getCompanionDamageValue(damage);
                                        if (companionOwnerUnit && companionDamageValue > 0) {
                                            const ownerAction = Object.assign({}, action, {unit: companionOwnerUnit});
                                            ownerAction.syntheticCompanionOwnerAction = true;
                                            doAnalysis(stats, filter, ownerAction, target, true, damageIndex, companionDamageValue);
                                        }
                                    }
                                });
                            }
                        });

                        if (!wantAll && (statQuery.type === "attack" || statQuery.type === "defense")) {
                            const expectedTargetIsHero = statQuery.type === "attack" ? !wantHeroes : wantHeroes;
                            const hpLossEvents = (round.actions.regen || []).filter(action => action && action.event && action.event.kind === "hploss");
                            hpLossEvents.forEach(lossAction => {
                                const targetUnit = (lossAction.targets && lossAction.targets[0] && lossAction.targets[0].unit) || lossAction.unit;
                                const targetName = targetUnit && targetUnit.id && targetUnit.id.name;
                                const targetIdx = targetUnit && targetUnit.id && targetUnit.id.idx;
                                const targetKey = SearchEngine.getTargetUnitKey(targetUnit);
                                if (!targetUnit || !targetUnit.id) {
                                    SearchEngine.debugIndirectVerbose("TargetDecision", {
                                        level: level.nr,
                                        area: area.nr,
                                        round: round.nr,
                                        target: targetName,
                                        targetIdx: targetIdx,
                                        targetKey: targetKey,
                                        decision: "SKIP",
                                        reason: "TARGET_INVALID",
                                    });
                                    return;
                                }
                                if (!!targetUnit.id.isHero !== expectedTargetIsHero) {
                                    SearchEngine.debugIndirectVerbose("TargetDecision", {
                                        level: level.nr,
                                        area: area.nr,
                                        round: round.nr,
                                        target: targetName,
                                        targetIdx: targetIdx,
                                        targetKey: targetKey,
                                        targetIsHero: !!targetUnit.id.isHero,
                                        expectedTargetIsHero: expectedTargetIsHero,
                                        decision: "SKIP",
                                        reason: "WRONG_TARGET_SIDE",
                                    });
                                    return;
                                }

                                const hpLossValue = Number(lossAction.event.value || lossAction.event.loss || 0);
                                if (!(hpLossValue > 0)) {
                                    SearchEngine.debugIndirectVerbose("TargetDecision", {
                                        level: level.nr,
                                        area: area.nr,
                                        round: round.nr,
                                        target: targetName,
                                        targetIdx: targetIdx,
                                        targetKey: targetKey,
                                        decision: "SKIP",
                                        reason: "HPLOSS_NOT_POSITIVE",
                                    });
                                    return;
                                }

                                const contributionContext = SearchEngine.resolveHpLossContributors(round, targetUnit, effectSourceHistory);
                                if (!contributionContext) {
                                    SearchEngine.debugIndirectVerbose("TargetDecision", {
                                        level: level.nr,
                                        area: area.nr,
                                        round: round.nr,
                                        target: targetName,
                                        targetIdx: targetIdx,
                                        targetKey: targetKey,
                                        decision: "SKIP",
                                        reason: "NO_CONTRIBUTION_CONTEXT",
                                    });
                                    return;
                                }
                                const attributions = SearchEngine.splitHpLossDamageByContributors(hpLossValue, contributionContext);
                                SearchEngine.debugIndirect("Event", {
                                    level: level.nr,
                                    area: area.nr,
                                    round: round.nr,
                                    target: targetName,
                                    hpLoss: hpLossValue,
                                    assignableDamage: Math.min(hpLossValue, contributionContext.knownWeight || 0),
                                    totalWeight: contributionContext.totalWeight,
                                    knownWeight: contributionContext.knownWeight,
                                    knownRatio: contributionContext.totalWeight > 0 ? (contributionContext.knownWeight / contributionContext.totalWeight) : 0,
                                    sources: contributionContext.debugSources,
                                    sourceRejectSummary: contributionContext.sourceRejectSummary,
                                    contributorRejectSummary: contributionContext.contributorRejectSummary,
                                    attributions: attributions.map(cur => ({
                                        unit: cur.unit && cur.unit.id && cur.unit.id.name,
                                        value: cur.value,
                                    })),
                                });
                                if (SearchEngine.DEBUG_INDIRECT_TRACE) {
                                    const sourceList = (contributionContext.debugSources || [])
                                        .filter(src => src && src.hpLossValue > 0)
                                        .map(src => (src.source || src.normalizedSource || "?") + "=" + src.hpLossValue)
                                        .join(" | ");
                                    if (attributions.length === 0) {
                                        SearchEngine.debugIndirect("Attribution", {
                                            level: level.nr,
                                            area: area.nr,
                                            round: round.nr,
                                            target: targetName,
                                            targetIdx: targetIdx,
                                            hpLoss: hpLossValue,
                                            contributor: null,
                                            value: 0,
                                            sources: sourceList,
                                            reason: "NO_ATTRIBUTIONS",
                                        });
                                    }
                                }
                                if (attributions.length === 0) return;

                                const syntheticTarget = {
                                    unit: targetUnit,
                                    damage: [{
                                        value: hpLossValue,
                                        ruestung: 0,
                                        resistenz: 0,
                                        type: "indirekt",
                                    }],
                                };

                                attributions.forEach((attribution, attributionIdx) => {
                                    if (SearchEngine.DEBUG_INDIRECT_TRACE) {
                                        const contributorName = attribution.unit && attribution.unit.id && attribution.unit.id.name;
                                        const contributorKey = SearchEngine.getUnitKey(attribution.unit);
                                        const contributorSourceHits = (contributionContext.debugSources || [])
                                            .filter(src => {
                                                const decisions = src && src.contributorDecisions ? src.contributorDecisions : [];
                                                return !!util.arraySearch(decisions, decision => decision && decision.accepted && decision.unitKey === contributorKey);
                                            })
                                            .map(src => ({
                                                source: src.source || src.normalizedSource || "?",
                                                hpLossValue: src.hpLossValue || 0,
                                            }));
                                        indirectAttributionByContributor[contributorKey] = indirectAttributionByContributor[contributorKey] || {
                                            contributor: contributorName,
                                            value: 0,
                                        };
                                        indirectAttributionByContributor[contributorKey].value += Number(attribution.value || 0);
                                        const sourceList = (contributionContext.debugSources || [])
                                            .filter(src => src && src.hpLossValue > 0)
                                            .map(src => (src.source || src.normalizedSource || "?") + "=" + src.hpLossValue)
                                            .join(" | ");
                                        const traceRow = {
                                            level: level.nr,
                                            area: area.nr,
                                            round: round.nr,
                                            target: targetName,
                                            targetIdx: targetIdx,
                                            hpLoss: hpLossValue,
                                            assignableDamage: Math.min(hpLossValue, contributionContext.knownWeight || 0),
                                            contributor: contributorName,
                                            contributorKey: contributorKey,
                                            value: Number(attribution.value || 0),
                                            sources: sourceList,
                                            sourceHits: contributorSourceHits,
                                            splitContributors: (contributionContext.contributors || []).map(cur => ({
                                                unit: cur.unit && cur.unit.id && cur.unit.id.name,
                                                weight: cur.weight,
                                            })),
                                        };
                                        indirectAttributionTrace.push(traceRow);
                                        SearchEngine.debugIndirect("Attribution", traceRow);
                                    }
                                    const virtualAction = {
                                        unit: attribution.unit,
                                        targets: [syntheticTarget],
                                        level: level,
                                        area: area,
                                        round: round,
                                        type: "regen",
                                        syntheticCompanionOwnerAction: true,
                                        src: "<tr><td></td><td>" + SearchEngine.getDisplayUnitName(attribution.unit) + " - Persistenter Effekt verursacht " + Math.round(attribution.value) + " indirekten Schaden</td></tr>",
                                    };
                                    const isHero = virtualAction.unit.id.isHero;
                                    if (!(wantAll || (wantHeroes && !wantDefense && isHero) || (!wantHeroes && wantDefense && isHero) || (!wantHeroes && !wantDefense && !isHero) || (wantHeroes && wantDefense && !isHero))) {
                                        return;
                                    }
                                    SearchEngine.addUnitId(virtualAction, virtualAction.unit);
                                    SearchEngine.addUnitId(virtualAction, targetUnit);
                                    stats.actionClassification = function (curAction) {
                                        return {
                                            fromMe: wantHeroes === !!curAction.unit.id.isHero,
                                            atMe: !!util.arraySearch(curAction.targets, target => wantHeroes === !!target.unit.id.isHero),
                                            fromGroup: wantHeroes === !!curAction.unit.id.isHero,
                                            atGroup: wantHeroes === !!util.arraySearch(virtualAction.targets, target => _.ReportParser.isUnitEqual(curAction.unit, target.unit)),
                                            cmp: "nxt",
                                        }
                                    }
                                    const attributedDamage = {
                                        value: attribution.value,
                                        ruestung: 0,
                                        resistenz: 0,
                                        type: "indirekt",
                                    };
                                    doAnalysis(stats, filter, virtualAction, syntheticTarget, attributedDamage, attributionIdx);
                                    const companionOwnerUnit = this.resolveCompanionOwner(companionOwnerByUnitKey, virtualAction, round);
                                    const companionDamageValue = this.getCompanionDamageValue(attributedDamage);
                                    if (companionOwnerUnit && companionDamageValue > 0) {
                                        const ownerAction = Object.assign({}, virtualAction, {unit: companionOwnerUnit});
                                        ownerAction.syntheticCompanionOwnerAction = true;
                                        doAnalysis(stats, filter, ownerAction, syntheticTarget, true, attributionIdx, companionDamageValue);
                                    }
                                });
                            });
                        }

                        SearchEngine.registerRoundEffectSources(effectSourceHistory, round);
                    }
                }
            }
            if (SearchEngine.DEBUG_INDIRECT_TRACE) {
                const totals = Object.values(indirectAttributionByContributor)
                    .sort((a, b) => (b.value || 0) - (a.value || 0));
                SearchEngine.debugIndirect("AttributionSummary", totals);
                SearchEngine.debugIndirect("AttributionTraceCount", {
                    rows: indirectAttributionTrace.length,
                });
                const atrixRows = indirectAttributionTrace.filter(row => {
                    const contributor = (row && row.contributor ? row.contributor : "").toLowerCase();
                    return contributor.indexOf("atrix") !== -1;
                });
                if (atrixRows.length > 0) {
                    const atrixByRound = {};
                    atrixRows.forEach(row => {
                        const key = (row.level || "?") + "." + (row.area || "?") + ".R" + (row.round || "?");
                        atrixByRound[key] = (atrixByRound[key] || 0) + Number(row.value || 0);
                    });
                    SearchEngine.debugIndirect("AttributionAtrix", {
                        total: atrixRows.reduce((sum, row) => sum + Number(row.value || 0), 0),
                        byRound: atrixByRound,
                        rows: atrixRows,
                    });
                    atrixRows.forEach(row => {
                        const sourceHits = (row.sourceHits || [])
                            .map(src => (src.source || "?") + "=" + (src.hpLossValue || 0))
                            .join(", ");
                        SearchEngine.debugIndirect("AttributionAtrixLine", "L" + (row.level || "?")
                            + " A" + (row.area || "?")
                            + " R" + (row.round || "?")
                            + " target=" + (row.target || "?")
                            + "#" + (row.targetIdx || "?")
                            + " value=" + (row.value || 0)
                            + " basis=" + (row.assignableDamage || 0) + "/" + (row.hpLoss || 0)
                            + " sources=[" + sourceHits + "]"
                            + " split=[" + (row.splitContributors || []).map(cur => (cur.unit || "?") + ":" + (cur.weight || 0)).join(", ") + "]");
                    });
                }
            }
            return stats;
        }
    }

    class QueryModel {
        static attackFilterType = {
            level: "Level",
            fight: "Kampf",
            skillType: "AngriffsTyp",
            position: "Position",
            unit: "Einheit",
            skillName: "Fertigkeit",
            items: "Gegenstände",
            dmgType: "Schadensart",

            enemy_unit: "Gegner-Einheit",
            enemy_position: "Gegner-Position",
        }
        static FilterTypes = {
            "attack": this.attackFilterType,
            "defense": this.attackFilterType,
            "all": {
                level: "Level",
                fight: "Kampf",
                position: "Position",
                unit: "Einheit",
                skillName: "Fertigkeit",
                skill_active: "Fertigkeit(Aktiv)",
            }
        }

        // helden <-> monster
        // action <-> target
        // action.unit.position
        // z.B. monster, target.unit.position
        static StatQuery = class {
            side; // "heroes" oder "monsters"
            type; // 1: für Angriff, 2: für Verteidigung
            filter; // Array von QueryFilter
            possibleFilter;

            constructor(side, type, filter) {
                this.side = side;
                this.type = type;
                this.filter = filter;
            }
        }

        static QueryFilter = class QueryFilter {
            spec; // FilterTypes ["units", "fertigkeit", "attackType", "positions", "gegner:units", "gegner:fertigkeit", "gegner:attackType", "gegner:positions"] auf welchem Attribut von Seite A oder B (mit "t:"-prefix) soll aggregiert werden
            selection; // um nur gewisse Werte einzuschließen (whitelist)

            constructor(spec, selection) {
                this.spec = spec;
                this.selection = selection;
            }
        }

    }

    class Viewer {

        static StatView = class StatView {
            query; // type StatQuery
            result; // type StatSearch, enthält auch den StatQuery
            spalten; // type Array
            showRootStat; // type Boolean soll auch alles zusammen gezählt werden
            initialFolded;

            constructor(statQuery, showRootStat, initialFolded) {
                this.query = statQuery;
                this.showRootStat = showRootStat;
                this.initialFolded = initialFolded;
            }
        }

        static TableViewType = class TableViewType {
            center(text, tooltip) {
                let titleAttribute = "";
                if (tooltip) {
                    const escaped = ("" + tooltip)
                        .replace(/&/g, "&amp;")
                        .replace(/'/g, "&#39;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;");
                    titleAttribute = " title='" + escaped + "'";
                }
                return "<td style='text-align:center;vertical-align:middle;'" + titleAttribute + ">" + text + "</td>";
            }
        }

        // Alle Aktionen (Angriffe, Heilungen, Wirkungen, Paraden)
        static TableViewAlleAktionen = class extends Viewer.TableViewType {
            columns = Array();

            constructor(statView) {
                super();
                const center = this.center;
                const Column = Viewer.Column;
                this.columns.push(new Column("Aktionen", center("Aktionen<br>(Aktiv:Passiv)"), stat => {
                    let aktivaActions = stat.actions;
                    aktivaActions = util.arrayFilter(aktivaActions, action => action.type !== "init");
                    aktivaActions = util.arrayFilter(aktivaActions, action => stat.actionClassification(action).fromMe);

                    let passivaActions = stat.actions;
                    passivaActions = util.arrayFilter(passivaActions, action => action.type !== "init");
                    passivaActions = util.arrayFilter(passivaActions, action => {
                        //console.log("Hero ", action, stat.actionClassification(action));
                        return stat.actionClassification(action).atMe;
                    });

                    return center(aktivaActions.length + ":" + passivaActions.length);
                }));
                this.columns.push(new Column("HP", center("HP<br>Rundenbeginn<br>(min-max)"), stat => {
                    const hps = Array();
                    util.arrayFilter(stat.actions, action => action.type === "init" && stat.actionClassification(action).fromMe).forEach(action => {
                        hps.push(action.unit.hp);
                    });
                    if (hps.length === 0) return center("-");
                    const min = util.arrayMin(hps);
                    const max = util.arrayMax(hps);
                    return center("" + min + " - " + max + "");
                }));
                this.columns.push(new Column("MP", center("MP<br>Rundenbeginn<br>(min-max)"), stat => {
                    const hps = Array();
                    util.arrayFilter(stat.actions, action => action.type === "init" && stat.actionClassification(action).fromMe).forEach(action => {
                        hps.push(action.unit.mp);
                    });
                    if (hps.length === 0) return center("-");
                    const min = util.arrayMin(hps);
                    const max = util.arrayMax(hps);
                    return center("" + min + " - " + max + "");
                }));
                this.columns.push(new Column("Aktionsarten", center("Aktiva<br>(Angriff / Heilung / Buff)"), stat => {
                    let actions = stat.actions;
                    actions = util.arrayFilter(actions, action => action.type !== "init");
                    actions = util.arrayFilter(actions, action => stat.actionClassification(action).fromMe);

                    let heal = util.arrayFilter(actions, action => action.skill.typ === "Heilung").length;
                    let wirkung = util.arrayFilter(actions, action => action.skill.typ === "Verbesserung" || action.skill.typ === "Ruft Helfer").length;
                    return center((actions.length - heal - wirkung) + " / " + heal + " / " + wirkung);
                }));
                this.columns.push(new Column("Aktionsarten", center("Passiva<br>(Parade / Geheilt / Gebufft)"), stat => {
                    let actions = stat.actions;
                    actions = util.arrayFilter(actions, action => action.type !== "init");
                    actions = util.arrayFilter(actions, action => stat.actionClassification(action).atMe);
                    let heal = util.arrayFilter(actions, action => action.skill.typ === "Heilung").length;
                    let wirkung = util.arrayFilter(actions, action => action.skill.typ === "Verbesserung" || action.skill.typ === "Ruft Helfer").length;
                    return center((actions.length - heal - wirkung) + " / " + heal + " / " + wirkung);
                }));
            }
        }

        // Nur Angriffe und Paraden (keine Heilung oder Wirkungen)
        static TableViewAngriffVerteidigung = class extends Viewer.TableViewType {
            columns = Array();

            constructor(statView) {
                super();
                const center = this.center;
                const mitVorzeichen = this.mitVorzeichen;
                const Column = Viewer.Column;
                const isDefense = statView.query.type === "defense";
                if (isDefense) {
                    this.columns.push(new Column("Verteidigungs Aktionen", center("Verteidigungs<br>Aktionen"), dmgStat => center(dmgStat.actions.length)));
                    this.columns.push(new Column("Erfolgreich", center("Erfolgreich<br>verteidigt"), dmgStat => center(dmgStat.result[0] + ":" + this.gesamtErfolge(dmgStat))));
                } else {
                    this.columns.push(new Column("Angriffs Aktionen", center("Angriffs<br>Aktionen"), dmgStat => center(dmgStat.actions.length)));
                    this.columns.push(new Column("Erfolgreich", center("Erfolgreich<br>angegriffen"), dmgStat => center(this.gesamtErfolge(dmgStat) + ":" + dmgStat.result[0])));
                }
                this.columns.push(new Column("Erfolge", center("normal / gut / krit"), dmgStat => this.center(dmgStat.result[1] + " / " + dmgStat.result[2] + " / " + dmgStat.result[3])));
                let dmgTitle;
                if (isDefense) {
                    dmgTitle = "Eingehend";
                } else {
                    dmgTitle = "Ausgehend";
                }
                const outDamageColumn = new Column(isDefense ? "Eingehender Direktschaden" : "Ausgehender Direktschaden", center(dmgTitle + "<br>(Ø)"), dmgStat => {
                    const dmgs = Array();
                    dmgStat.targets.forEach(target => {
                        let targetDmg = 0;
                        (target.damage || []).forEach(damage => {
                            targetDmg += damage.value + damage.ruestung + damage.resistenz;
                        });
                        dmgs.push(targetDmg);
                    })
                    const min = util.arrayMin(dmgs);
                    const max = util.arrayMax(dmgs);
                    const gesamtDamage = this.gesamtDamage(dmgStat);
                    const gesamtErfolge = this.gesamtErfolge(dmgStat);
                    var result = gesamtDamage;
                    if (gesamtErfolge > 0 && gesamtDamage > 0) {
                        const avgDamage = gesamtDamage / gesamtErfolge;
                        result += "<br>" + "(" + util.round(avgDamage, 2) + ")";
                        result += "<br>" + "(" + min + " - " + max + ")";
                    }
                    return center(result);
                });
                outDamageColumn.headerGroup = "Direkter Schaden";
                this.columns.push(outDamageColumn);

                const directDamageColumn = new Column("Effektiv", center("Effektiv<br>(Ø)<br>(min-max)"), dmgStat => {
                    const [min, max] = this.minMaxDamageByType(dmgStat, false);
                    let maxView = max;
                    const gesamtErfolge = this.gesamtErfolge(dmgStat);
                    var result = dmgStat.directValue;
                    if (gesamtErfolge > 0 && dmgStat.directValue > 0) {
                        let avgDamage = dmgStat.directValue / gesamtErfolge;
                        avgDamage = util.round(avgDamage, 2);
                        if (statView.query.type === "defense") { // in Abhängigkeit der MaxHealth der Einheit setzen
                            if (avgDamage > 20) avgDamage = "<span style='color:red'>" + avgDamage + "</span>";
                            else if (avgDamage > 10) avgDamage = "<span style='color:orange'>" + avgDamage + "</span>";
                            if (maxView > 20) maxView = "<span style='color:red'>" + maxView + "</span>";
                            else if (maxView > 10) maxView = "<span style='color:orange'>" + maxView + "</span>";
                        }
                        result += "<br>" + "(" + avgDamage + ")";
                        result += "<br>" + "(" + min + " - " + maxView + ")";
                    }
                    return center(result);
                });
                directDamageColumn.headerGroup = "Direkter Schaden";
                this.columns.push(directDamageColumn);

                const armorColumn = new Column("Rüstung", center("Rüstung"), dmgStat => center(mitVorzeichen(-dmgStat.ruestung)));
                armorColumn.headerGroup = "Direkter Schaden";
                this.columns.push(armorColumn);

                const resistColumn = new Column("Resistenz", center("Resistenz"), dmgStat => center(mitVorzeichen(-dmgStat.resistenz)));
                resistColumn.headerGroup = "Direkter Schaden";
                this.columns.push(resistColumn);

                this.columns.push(new Column("Indirekter Schaden", center("Indirekter<br>Schaden", "Schaden aus HP-Regenerations-Debuffs (z.B. durch Vergiftungen/Verbrennungen)"), dmgStat => {
                    return center(dmgStat.indirectValue);
                }));
                this.columns.push(new Column("Gefährtenschaden", center("Gefährten-<br>schaden"), dmgStat => {
                    return center(dmgStat.companionValue || 0);
                }));
                this.columns.push(new Column("Gesamtschaden", center("Gesamtschaden", "Summe aus direktem Schaden, indirektem Schaden und Gefährtenschaden."), dmgStat => {
                    return center(dmgStat.directValue + dmgStat.indirectValue + (dmgStat.companionValue || 0));
                }));

                const awColumn = new Column("Angriffswürfe", center("AW Ø<br>(min-max)"), dmgStat => {
                    var aw = Array(); // Angriffswerte
                    dmgStat.actions.forEach(action => {
                        if (!action.skill || !Array.isArray(action.skill.wuerfe)) {
                            return;
                        }
                        action.skill.wuerfe.forEach(wurf => aw.push(Number(wurf.value)));
                    });
                    aw = util.arrayFilter(aw, cur => Number.isFinite(cur));
                    if (aw.length === 0) return center("-");
                    return center(util.arrayAvg(aw, null, 2) + "<br>(" + util.arrayMin(aw) + " - " + util.arrayMax(aw) + ")");
                });
                const pwColumn = new Column("Paradewürfe", center("PW Ø<br>(min-max)"), dmgStat => {
                    var pw = Array(); // Paradewerte
                    dmgStat.targets.forEach(target => {
                        if (target.skill && target.skill.wurf !== undefined) {
                            pw.push(Number(target.skill.wurf));
                        }
                    });
                    pw = util.arrayFilter(pw, cur => Number.isFinite(cur));
                    if (pw.length === 0) return center("-");
                    return center(util.arrayAvg(pw, null, 2) + "<br>(" + util.arrayMin(pw) + " - " + util.arrayMax(pw) + ")");
                });
                if (isDefense) {
                    this.columns.push(pwColumn);
                    this.columns.push(awColumn);
                } else {
                    this.columns.push(awColumn);
                    this.columns.push(pwColumn);
                }
                this.columns.push(new Column("Schadensarten", center("Schadensarten<br>Schaden / Rüstung / Resistenz"), dmgStat => {
                    if (dmgStat.byDmgType) {
                        return "<td>" + this.getDmgTypeTable(dmgStat.byDmgType) + "</td>";
                    }
                    return "<td></td>";
                }));
            }

            mitVorzeichen = nummer => {
                if (nummer === 0) return "x";
                if (nummer < 0) return nummer;
                if (nummer > 0) return "+" + nummer;
            };

            gesamtDamage(dmgStat) {
                return dmgStat.value + dmgStat.ruestung + dmgStat.resistenz;
            }

            gesamtErfolge(dmgStat) {
                return dmgStat.result[1] + dmgStat.result[2] + dmgStat.result[3];
            }

            minMaxDamageByType(dmgStat, wantIndirect) {
                const dmgs = Array();
                dmgStat.targets.forEach(target => {
                    let targetDmg = 0;
                    (target.damage || []).forEach(damage => {
                        const isIndirect = damage.type === "indirekt";
                        if (wantIndirect === isIndirect) {
                            targetDmg += damage.value;
                        }
                    });
                    if (targetDmg > 0) dmgs.push(targetDmg);
                });
                if (dmgs.length === 0) return [0, 0];
                return [util.arrayMin(dmgs), util.arrayMax(dmgs)];
            }

            getDmgTypeTable(specificArray) {
                const table = document.createElement("table");
                table.width = "100%";
                for (const [dmgType, dmgStat] of Object.entries(specificArray)) {
                    table.innerHTML += "<tr><td width=50%>" + dmgType + "</td>" + this.center(dmgStat.value) + this.center(this.mitVorzeichen(-dmgStat.ruestung)) + this.center(this.mitVorzeichen(-dmgStat.resistenz)) + "</tr>";
                }
                return table.outerHTML;
            }

        }

        static TableViewRenderer = class TableViewRenderer {
            static maxColspan = 10;

            static views = {
                "attack": Viewer.TableViewAngriffVerteidigung,
                "defense": Viewer.TableViewAngriffVerteidigung,
                "all": Viewer.TableViewAlleAktionen, // HP/MP am Anfang der Runde, MP-Verbrauch
            }

            static renderColumnTable(table, statView) {
                const tableView = new this.views[statView.query.type](statView);
                const tbody = table.tagName === "TBODY" ? table : (table.getElementsByTagName("tbody")[0] || table);
                const tableElement = tbody.parentElement || table;
                const thead = tableElement.tHead || tableElement.getElementsByTagName("thead")[0];
                if (!thead) {
                    throw _.util.error("Kein thead für die Statistiktabelle gefunden!", tableElement);
                }

                var switcher = true;
                const hasHeaderGroups = util.arraySearch(tableView.columns, column => !!column.headerGroup);

                if (hasHeaderGroups) {
                    const groupName = "Direkter Schaden";
                    const groupColumns = util.arrayFilter(tableView.columns, column => column.headerGroup === groupName);

                    const createHeaderCell = (headerHtml) => {
                        const tmp = document.createElement("tr");
                        tmp.innerHTML = headerHtml;
                        const cell = tmp.firstElementChild;
                        if (!cell || cell.tagName !== "TD") {
                            throw _.util.error("Header-Zelle muss immer mit <td anfangen!", headerHtml);
                        }
                        return cell;
                    };

                    const topHeader = document.createElement("tr");
                    topHeader.className = "row0";
                    const bottomHeader = document.createElement("tr");
                    bottomHeader.className = "row0";

                    const leading = createHeaderCell("<td colspan=" + this.maxColspan + "></td>");
                    leading.rowSpan = 2;
                    topHeader.append(leading);

                    let groupHeaderAdded = false;
                    for (const column of tableView.columns) {
                        const curHeader = column.header;
                        if (!curHeader || !curHeader.startsWith("<td")) {
                            throw _.util.error("Header-Zelle muss immer mit <td anfangen!", column.id, curHeader);
                        }

                        if (column.headerGroup === groupName) {
                            if (!groupHeaderAdded) {
                                const groupHeader = document.createElement("td");
                                groupHeader.colSpan = groupColumns.length;
                                groupHeader.style.textAlign = "center";
                                groupHeader.style.verticalAlign = "middle";
                                groupHeader.innerHTML = groupName;
                                groupHeader.title = "Direkter Schaden aus normalen Treffern; aufgeteilt in Effektiv, Ruestung und Resistenz.";
                                topHeader.append(groupHeader);
                                groupHeaderAdded = true;
                            }
                            bottomHeader.append(createHeaderCell(curHeader));
                        } else {
                            const headerCell = createHeaderCell(curHeader);
                            headerCell.rowSpan = 2;
                            topHeader.append(headerCell);
                        }
                    }

                    thead.append(topHeader);
                    thead.append(bottomHeader);
                } else {
                    const header = document.createElement("tr");
                    header.className = "row0";

                    header.innerHTML = "<td colspan=" + this.maxColspan + "></td>"
                    for (const column of tableView.columns) {
                        const curHeader = column.header;
                        if (!curHeader || !curHeader.startsWith("<td")) {
                            throw _.util.error("Header-Zelle muss immer mit <td anfangen!", column.id, curHeader);
                        }
                        header.innerHTML += curHeader;
                    }
                    thead.append(header);
                }

                function addLine(statView, prefix, statResult) {
                    const line = document.createElement("tr");
                    switcher = !switcher;
                    line.className = switcher ? "row0" : "row1";
                    line.innerHTML += convertPrefix(prefix, statResult);
                    for (const column of tableView.columns) {
                        const columnResult = column.cellRenderer(statResult);
                        if (!columnResult.startsWith("<td")) {
                            throw _.util.error("Zelleneintrag muss immer mit <td anfangen!", column.id, columnResult);
                        }
                        line.innerHTML += columnResult;
                    }
                    table.append(line);
                    line.style.cursor = "pointer";
                    var opened = false;
                    var addTR;
                    line.onclick = function () {
                        opened = !opened;
                        const myIndex = util.getMyIndex(line);

                        if (opened) {
                            const openFunction = async function () {
                                const tr = document.createElement("tr");
                                addTR = tr;
                                const td = document.createElement("td");
                                td.style.backgroundColor = "#505050";
                                td.colSpan = 100;
                                tr.append(td);
                                const table = document.createElement("table");
                                table.style.width = "100%";
                                table.style.borderCollapse = "collapse";
                                td.append(table);
                                const tbody = document.createElement("tbody");
                                table.append(tbody);

                                var curLevelNr;
                                var curAreaNr;
                                var actionTR;
                                var curRoundNr;
                                statResult.actions.forEach(action => {
                                    var border = "";
                                    if (curLevelNr !== action.level.nr || curAreaNr !== action.area.nr) {
                                        var style = "";
                                        curLevelNr = action.level.nr;
                                        curAreaNr = action.area.nr;
                                        curRoundNr = null;
                                        tbody.innerHTML += "<tr><td colspan=100 style='font-style: italic;padding-top:5px;color:lightgray;'>Level " + curLevelNr + " Kampf " + curAreaNr + "</td></tr>";
                                        tbody.innerHTML += "<tr style='border-top: 1px solid black;" + style + "font-style: italic;height:10px;'><td colspan=100></td></tr>";
                                    } else {
                                        border = "12px solid transparent";
                                    }
                                    actionTR = document.createElement("tr");
                                    actionTR.innerHTML = action.src || "<td></td><td>[Action ohne Details]</td>";
                                    const roundTd = document.createElement("td");
                                    roundTd.style.width = "1px";
                                    if (curRoundNr !== action.round.nr) {
                                        curRoundNr = action.round.nr;
                                        roundTd.innerHTML = "R" + curRoundNr;
                                    }
                                    roundTd.style.color = "lightgray";
                                    roundTd.style.fontStyle = "italic";
                                    actionTR.insertBefore(roundTd, actionTR.children[0]);
                                    if (action.type === "vorrunde") {
                                        actionTR.children[1].innerHTML = "Vorrunde";
                                    }
                                    actionTR.children[0].style.paddingLeft = "10px";
                                    actionTR.children[0].style.paddingRight = "10px";
                                    actionTR.style.borderTop = border;
                                    tbody.append(actionTR);
                                });
                                actionTR.style.borderBottom = "12px solid transparent";
                                util.addNode(line.parentElement, tr, myIndex + 1);
                                line.style.cursor = "pointer";
                            }
                            if (statResult.actions.length > 150) {
                                line.style.cursor = "wait";
                                setTimeout(openFunction, 50);
                            } else {
                                openFunction();
                            }

                        } else {
                            addTR.parentElement.removeChild(addTR);
                            addTR = null;
                        }

                    }
                }

                function addLine2(statView, id, statResult) {
                    if (id === "") id = "Gesamt";
                    if (!statResult.title && statResult.unit) {
                        statResult.title = SearchEngine.getDisplayUnitTitle(statResult.unit);
                    }
                    if (statResult.actions.length > 0 || (Number(statResult.companionValue || 0) > 0)) {
                        addLine(statView, id === "" ? "" : (id + ""), statResult, statResult.byDmgType);
                    }
                }

                function connect(a, b) {
                    return a + " -> " + b;
                }

                function stepper(statView, title, curResult) {
                    if (curResult.sub) {
                        if (title !== "" || statView.showRootStat) {
                            addLine2(statView, title, curResult);
                        }
                        for (const [id, dmg] of Object.entries(curResult.sub)) {
                            stepper(statView, connect(title, id), dmg);
                        }
                    } else {
                        addLine2(statView, title, curResult);
                    }
                }

                function convertPrefix(prefix, dmgStat) {
                    var prefixSplit = prefix.split(" -> ");
                    const fillerColor = "#616D7E";

                    var filler = "";
                    for (var i = 1, l = prefixSplit.length; i < l; i++) {
                        if (fillerColor) {
                            filler += "<td style='background-color:" + fillerColor + ";border-right-style: hidden;'>&nbsp;</td>";
                        } else {
                            filler += "<td style='border-right-style: hidden;'>&nbsp;</td>";
                        }
                    }
                    var unitCount = dmgStat.unitCount;
                    if (unitCount) {
                        unitCount = Object.keys(unitCount).length;
                        if (unitCount > 1) {
                            unitCount = " (" + unitCount + ")";
                        } else {
                            unitCount = "";
                        }
                    } else {
                        unitCount = "";
                    }
                    prefix = dmgStat.title ? (dmgStat.title + unitCount) : prefixSplit[prefixSplit.length - 1];
                    return filler + "<td colspan=" + (11 - prefixSplit.length) + " style='text-align:left;vertical-align:middle;'>" + prefix + "</td>";
                }

                stepper(statView, "", statView.result);
            }

        }


        static Column = class Column {
            id;
            header;
            cellRenderer;

            constructor(id, header, cellRenderer) {
                this.id = id;
                this.header = header;
                this.cellRenderer = cellRenderer;
            }

        }

        static StatTable = class StatTable {
            statView;
            anchor;
            levelDatas;
            collapsed;

            constructor(statView, levelDatas, anchor) {
                this.statView = statView;
                this.anchor = anchor;
                this.levelDatas = levelDatas;
                this.collapsed = statView.initialFolded;
                this.refresh();
            }

            // Löscht den alten Table und erstellt den neuen
            refresh() {
                this.statView.result = SearchEngine.doQuery(this.statView.query, this.levelDatas);
                this.statView.query.possibleFilter = QueryModel.FilterTypes[this.statView.query.type];

                //Löscht die vorangelegten Einträge, welche keine Treffer hatten
                function resultClearance(subResult) {
                    if (!subResult) return;
                    for (const [id, entry] of Object.entries(subResult)) {
                        if (!entry.filterType) {
                            delete subResult[id];
                        } else {
                            resultClearance(entry.sub);
                        }
                    }
                }

                resultClearance(this.statView.result.sub);

                const child = this.anchor.children[0];
                if (child) this.anchor.removeChild(child);

                const table = document.createElement("table");
                table.style.minWidth = "600px";
                table.className = "content_table";
                table.border = 1;
                const thead = document.createElement("thead");
                table.append(thead);
                const tbody = document.createElement("tbody");
                table.append(tbody);

                const thisObject = this;

                function fillHead(thead) {
                    const outerTR = document.createElement("tr");
                    outerTR.classList.add("row0");
                    thead.append(outerTR);
                    const tableWrapTD = document.createElement("td");
                    tableWrapTD.colSpan = 100;
                    outerTR.append(tableWrapTD);
                    const headerTable = document.createElement("table");
                    headerTable.style.width = "100%";
                    tableWrapTD.append(headerTable);


                    const headerTableTr = document.createElement("tr");
                    headerTable.append(headerTableTr);
                    const headerTh = thisObject.createHeader();
                    headerTableTr.append(headerTh);

                    const right = document.createElement("th");
                    right.style.position = "relative";
                    headerTableTr.append(right);

                    return right;
                }

                const rightTH = fillHead(thead);
                rightTH.style.textAlign = "right";
                rightTH.style.verticalAlign = "top";


                const infoHeader = document.createElement("span");
                infoHeader.style.whiteSpace = "nowrap";
                infoHeader.style.marginRight = "5px";
                rightTH.append(infoHeader);
                //infoHeader.style.position = "absolute";
                //infoHeader.style.right = "7px";
                //infoHeader.style.top = "7px";
                infoHeader.innerHTML += "<a target='_blank' href='" + Mod.forumLink + "' style='font-size:12px;color:darkgrey;' class='bbignoreColor' onmouseenter=\"return wodToolTip(this, 'Hier gehts zum Foren-Post der Anwendung')\">" + Mod.version + " </a>";

                // 🔗📌📍
                const info = document.createElement("span");
                var infoTipp = "Über die Elemente im Header lässt sich die Ausgabe der Statistiken steuern. Mit jeder Änderung wird dabei die Ausgabe direkt aktualisiert.<br><ul>";
                infoTipp += "<li>Mit einem Klick auf 'Helden' lässt sich dieses auf 'Monster' ändern.</li>";
                infoTipp += "<li>Mit einem Klick auf 'Angriff' lässt sich dieses auf 'Verteidigung' ändern.</li>";
                infoTipp += "<li>Mit einem Klick auf den Verbindungsstrich dazwischen lässt sich beides gleichzeitig ändern.</li>";
                infoTipp += "<li>Mit einem Klick auf das Plus-Zeichen öffnet sich eine Auswahlliste, nach der man das aktuelle Ergebnis weiterhin aufschlüsseln möchte. Dies lässt sich mehrfach wiederholen.</li>";
                infoTipp += "<li>Hat man bereits mehr als eine Aufschlüsselung hinzugefügt, kann man über das Anklicken von '>' die benachbarten Aufschlüsselungen miteinander tauschen lassen.</li>";
                infoTipp += "<li>Hat man eine Aufschlüsselung bereits hinzugefügt, kann man diese anklicken, um die getätigte Auswahl zu ändern. Entfernen lässt sie sich indem man den leeren Wert auswählt.</li>";
                infoTipp += "<li>Einige Aufschlüsselungen (z.B. 'Position', leider aber noch nicht alle) erlauben durch einen Klick darauf und der folgenden Auswahl '+Einschränken' diese weiter einzuschränken (z.B. nur 'Vorne' und 'Zentrum')</li>";
                infoTipp += "<li>Das Eingabe-Element welches sich dort öffnet ist eine übliche Multiple Auswahlliste. Zusammen mit der Strg-Taste lassen sich hier mehrere Werte auswählen.</li>";
                infoTipp += "</ul>";
                info.innerHTML = "<span class='bbignore'><img alt='' height='14px' border='0' src='/wod/css/skins/skin-8/images/icons/inf.gif'></span>";
                _.WoD.addTooltip(info, infoTipp);
                infoHeader.append(info);

                const toBBCodeButtonContainer = document.createElement("span");
                infoHeader.append(toBBCodeButtonContainer);
                toBBCodeButtonContainer.style.width = "20px";
                toBBCodeButtonContainer.style.height = "100%";
                toBBCodeButtonContainer.style.display = "inline-block";

                const toBBCodeButton = document.createElement("span");
                toBBCodeButton.style.fontSize = "12px";
                toBBCodeButton.style.cursor = "copy";
                toBBCodeButton.innerHTML = "[bb]";
                toBBCodeButton.style.marginLeft = "2px";
                toBBCodeButton.style.color = "darkgrey";
                toBBCodeButton.classList.add("bbignore");
                _.WoD.addTooltip(toBBCodeButton, 'Einfach anklicken und der BBCode wird in die Zwischenablage kopiert. Dann einfach mit Strg+V irgendwo reinkopieren.');

                //toBBCodeButton.title = "Einfach anklicken und der BBCode wird in die Zwischenablage kopiert. Dann einfach mit Strg+V irgendwo reinkopieren."

                const toBBCodeDone = document.createElement("img");
                toBBCodeDone.src = _.UI.WOD_SIGNS.YES;
                toBBCodeDone.style.height = "10px";
                toBBCodeDone.style.display = "block";
                toBBCodeDone.style.margin = "auto";
                toBBCodeDone.style.position = "relative";
                toBBCodeDone.style.top = "2px";
                toBBCodeDone.classList.add("bbignore");


                toBBCodeButtonContainer.append(toBBCodeButton);
                toBBCodeButton.onclick = function () {
                    unsafeWindow.wodToolTipHide(toBBCodeButton);
                    toBBCodeButtonContainer.removeChild(toBBCodeButton);
                    toBBCodeButtonContainer.append(toBBCodeDone);

                    setTimeout(function () {
                        toBBCodeButtonContainer.removeChild(toBBCodeDone);
                        toBBCodeButtonContainer.append(toBBCodeButton);
                    }, 1500);
                    navigator.clipboard.writeText(_.BBCodeExporter.toBBCode(table));
                }

                this.anchor.appendChild(table);
                if (this.statView.query.side && this.statView.query.type) {
                    const statView = this.statView;
                    console.log("StatView", statView, Mod.thisLevelDatas);
                    if (!statView.result) {
                        tbody.innerHTML = "<td>Es konnte kein Ergebnis ermittelt werden!";
                        return;
                    }
                    Viewer.TableViewRenderer.renderColumnTable(tbody, statView);
                    if (this.collapsed) {
                        for (var i = 1, l = tbody.children.length; i < l; i++) {
                            const cur = tbody.children[i];
                            cur.hidden = true;
                        }
                    }
                }
            }

            getSelectionsFor(queryFilter, curStatResult) {
                const resultMap = {};
                curStatResult.forEach(a => {
                    if (a.subIds) {
                        Object.keys(a.subIds).forEach(b => {
                            resultMap[b] = true;
                        });
                    }
                })
                return Object.keys(resultMap).sort();
            }

            createMultiSelectionFor(queryFilter, options, fnCallbackOnYes, fnCallbackOnNo) {
                const multiSelectionContainer = document.createElement("div");
                const multiSelection = document.createElement("select");
                multiSelectionContainer.append(multiSelection);
                multiSelection.multiple = "multiple";
                multiSelection.size = options.length;
                options.forEach(curOpt => {
                    var selected = queryFilter.selection && queryFilter.selection.includes(curOpt);
                    multiSelection.innerHTML += "<option " + (selected ? "selected" : "") + ">" + curOpt + "</option>";
                });
                multiSelectionContainer.style.position = "absolute";
                multiSelectionContainer.style.left = "0px";
                multiSelectionContainer.style.top = "0px";
                multiSelectionContainer.style.zIndex = 1;
                const multiSelectionButtonBar = document.createElement("div");
                multiSelectionContainer.append(multiSelectionButtonBar);
                const yesButtonDiv = document.createElement("div");
                yesButtonDiv.style.display = "inline-block";
                yesButtonDiv.style.width = "50%";
                const yesButton = util.createImgButton("20px", _.UI.WOD_SIGNS.YES, function () {
                    multiSelectionContainer.parentElement.removeChild(multiSelectionContainer);
                    var result = [];
                    var options = multiSelection.options;
                    for (var i = 0, l = options.length; i < l; i++) {
                        const opt = options[i];
                        if (opt.selected) {
                            result.push(opt.value || opt.text);
                        }
                    }
                    fnCallbackOnYes(result);
                });
                yesButton.style.margin = "auto";
                yesButton.style.display = "block";
                const noButtonDiv = document.createElement("span");
                noButtonDiv.style.width = "50%";
                noButtonDiv.style.display = "inline-block";
                const noButton = util.createImgButton("20px", "/wod/css/img/smiley/no.png", function () {
                    multiSelectionContainer.parentElement.removeChild(multiSelectionContainer);
                    fnCallbackOnNo();
                });
                noButton.style.margin = "auto";
                noButton.style.display = "block";
                yesButtonDiv.append(yesButton);
                noButtonDiv.append(noButton);
                multiSelectionButtonBar.append(yesButtonDiv);
                multiSelectionButtonBar.append(noButtonDiv);
                return multiSelectionContainer;
            }

            getFilterDisplayLabel(query, queryFilter) {
                let result = SearchEngine.FilterKriterien[queryFilter.spec].name;
                if (queryFilter.selection) {
                    result += " (" + queryFilter.selection.join(", ") + ")";
                }
                return result;
            }

            createHeader() {
                const thisObject = this;
                const query = this.statView.query;
                const th = document.createElement("th");
                th.colSpan = 100;
                th.style.textAlign = "left";
                th.className = "row0";

                // Helden - Monster
                const sideElement = document.createElement("span");
                sideElement.style.cursor = "pointer";
                if (query.side === "heroes") {
                    sideElement.innerHTML = "Helden";
                } else {
                    sideElement.innerHTML = "Monster";
                }
                sideElement.onclick = function () {
                    if (query.side === "heroes") {
                        query.side = "monster";
                    } else {
                        query.side = "heroes";
                    }
                    thisObject.refresh();
                }
                th.append(sideElement);

                // Switch-Both-Element
                const switchElement = document.createElement("span");
                switchElement.innerHTML = " - ";
                switchElement.style.cursor = "pointer";
                switchElement.onclick = function () {
                    if (query.side === "heroes") {
                        query.side = "monster";
                    } else {
                        query.side = "heroes";
                    }
                    if (query.type === "attack") {
                        query.type = "defense";
                    } else {
                        query.type = "attack";
                    }
                    thisObject.refresh();
                }
                th.append(switchElement);

                // Attack - Verteidigung
                const typeElement = document.createElement("span");
                const [typeSelectContainer, typeSelectInput] = util.createSelectableElement(typeElement, [["attack", "Angriff"], ["defense", "Verteidigung"], ["all", "Alle Aktionen"]]);
                typeSelectInput.value = query.type;
                typeSelectInput.onchange = function (value) {
                    query.type = typeSelectInput.value;
                    query.possibleFilter = QueryModel.FilterTypes[query.type];
                    // die ggf. nicht mehr möglichen Filter aussortieren
                    for (var i = 0, l = query.filter.length; i < l; i++) {
                        const curFilter = query.filter[i];
                        if (!query.possibleFilter[curFilter.spec]) {
                            delete query.filter[i];
                            i--;
                        }
                    }
                    thisObject.refresh();
                }
                typeElement.style.cursor = "pointer";
                if (query.type === "attack") {
                    typeElement.innerHTML = "Angriff";
                } else if (query.type === "defense") {
                    typeElement.innerHTML = "Verteidigung";
                } else {
                    typeElement.innerHTML = "Alle Aktionen";
                }
                th.append(typeSelectContainer);
                th.append(util.span(" "));

                // Filter-Bar
                const filterEinschraenken = "+Einschränken";
                const filterBar = document.createElement("span");
                filterBar.style.fontSize = "12px";
                th.append(filterBar);

                if (query.filter.length > 0) {
                    var nextStatResult = Array();
                    nextStatResult.push(this.statView.result);
                    var curStatResult
                    for (var i = 0, l = query.filter.length; i < l; i++) {
                        curStatResult = nextStatResult;
                        nextStatResult = Array();
                        const curQueryFilter = query.filter[i];
                        const finalI = i;
                        const allPossibleSelections = thisObject.getSelectionsFor(curQueryFilter, curStatResult);
                        curStatResult.forEach(stat => {
                            if (stat.sub) {
                                Object.values(stat.sub).forEach(nextSub => {
                                    nextStatResult.push(nextSub);
                                });
                            }
                        });
                        var selectOptions = [''];
                        if (allPossibleSelections && allPossibleSelections.length > 0) {
                            selectOptions.push(filterEinschraenken);
                        }
                        for (const [filterSpec, filterName] of Object.entries(query.possibleFilter)) {
                            if (filterSpec === curQueryFilter.spec || !util.arraySearch(query.filter, qFilter => qFilter.spec === filterSpec)) {
                                selectOptions.push([filterSpec, filterName]);
                            }
                        }

                        const labelElement = document.createElement("a");
                        labelElement.href = "javascript:";
                        labelElement.innerHTML = thisObject.getFilterDisplayLabel(query, curQueryFilter);
                        const [containerElement, selectInput] = util.createSelectableElement(labelElement, selectOptions);

                        selectInput.onchange = function (a) {
                            if (selectInput.value === filterEinschraenken) {
                                containerElement.append(thisObject.createMultiSelectionFor(curQueryFilter, allPossibleSelections, function (values) {
                                    if (values.length === 0) {
                                        delete curQueryFilter.selection;
                                    } else {
                                        curQueryFilter.selection = values;
                                    }
                                    thisObject.refresh();
                                }, function () { // Filter Löschen
                                    //selectInput.value = curQueryFilter.spec;
                                    delete curQueryFilter.selection;
                                    thisObject.refresh();
                                }));
                            } else {
                                if (selectInput.value === "") {
                                    query.filter.splice(finalI, 1);
                                } else {
                                    query.filter[finalI] = new QueryModel.QueryFilter(selectInput.value);
                                }
                                thisObject.refresh();
                            }
                        }
                        selectInput.value = curQueryFilter.spec;

                        if (filterBar.children.length > 0) {
                            const navi = document.createElement("span");
                            navi.innerText = " > ";
                            navi.style.cursor = "pointer";
                            filterBar.append(navi);
                            navi.onclick = function () { // vertauschen der beiden anhängigen Filter
                                const temp = query.filter[finalI];
                                query.filter[finalI] = query.filter[finalI - 1];
                                query.filter[finalI - 1] = temp;
                                thisObject.refresh();
                            };
                        }


                        filterBar.append(containerElement);
                    }
                }
                th.append(util.span(" "));

                // Add-Filter-Bar
                var addOptions = [''];
                for (const [filterSpec, filterName] of Object.entries(query.possibleFilter)) {
                    if (!util.arraySearch(query.filter, qFilter => qFilter.spec === filterSpec)) {
                        addOptions.push([filterSpec, filterName]);
                    }
                }

                const addElement = document.createElement("img");
                addElement.src = "/wod/css//skins/skin-8/images/icons/steigern_enabled.gif";
                addElement.style.height = "16px";
                addElement.classList.add("bbignore");
                const [selectContainer, selectInput] = util.createSelectableElement(addElement, addOptions);

                selectInput.onchange = function (a) {
                    if (selectInput.value !== "") {
                        query.filter.push(new QueryModel.QueryFilter(selectInput.value));
                    }
                    thisObject.refresh();
                }

                th.append(selectContainer);

                const collapsible = util.createCollapsible("20px", thisObject.collapsed, function (hide) {
                    thisObject.collapsed = hide;
                    if (curTable.children.length > 1) {
                        for (var i = 1, l = curTable.children.length; i < l; i++) {
                            const cur = curTable.children[i];
                            cur.hidden = hide;
                        }
                    }
                });
                collapsible.style.paddingLeft = "10px";
                //th.append(collapsible);

                return th;
            }


        }
    }

    class WoD {

        //  testet, ob wir uns auf dem Abenteuer-Übungsplatz befinden
        static istSeite_AbenteuerUebungsplatz() {
            var result = false;
            var heading = document.getElementsByTagName("h1")[0];
            var text = heading.textContent;
            if (text.indexOf("Abenteuer Übungsplatz der Akademie Trutz und Wehr") !== -1) result = true;
            return result;
        }

    }

    class LevelData {
        static getRoundCount(levelData) {
            return levelData.areas.reduce((sum, area) => sum + area.rounds.length, 0);
        }
    }

    class StatReport {
        static async load(reportId) {
            return await MyStorage.getReportStatsDB().getValue(reportId);
        }

        static async save(report) {
            await MyStorage.getReportStatsDB().setValue(report);
        }

    }

    class MySettings {
        static SETTING = {
            LAST_VALIDATION: "lastValidation",
        }
        static SEASONS_ACTIVATED = false;
        static #settingsDef = {
            modName: Mod.modname,
            defaultSettings: {
                [this.SETTING.LAST_VALIDATION]: new Date().getTime(),
            },
        }

        static #settingsHandler;

        static async get() {
            return this.#settingsHandler;
        }

        static async getFresh() {
            return this.#settingsHandler = await _.Settings.getHandler(this.#settingsDef);
        }

    }

    class MyStorage {

        static async initMyStorage(indexedDb) {
            this.indexedDb = indexedDb;
            this.indexedDbLocal = _.Storages.IndexedDb.getDb(Mod.dbname, "WoDStats+");
            await this.initThisStorage(this.indexedDb);
        }

        static async initThisStorage(indexedDb) {
            const adjust = function (objStore) {
                let resultGetValue = objStore.getValue;
                objStore.getValue = async function (dbObjectId) {
                    let result = await resultGetValue.call(objStore, dbObjectId);
                    if (!result) result = {reportId: dbObjectId};
                    return result;
                }
                let resultSetValue = objStore.setValue;
                objStore.setValue = async function (dbObject) {
                    await resultSetValue.call(objStore, dbObject);
                }
                return objStore;
            }
            this.reportStats = adjust(indexedDb.createObjectStorage("reportStats", "reportId"));
        }

        /**
         * @returns {_.Storages.ObjectStorage}
         */
        static getReportStatsDB() {
            return this.reportStats;
        }

        static async maintenanceAllReports() {
            const reportStatsDB = this.getReportStatsDB();
            let compareDate = new Date();
            compareDate.setDate(compareDate.getDate() - 8); // x-Tage lang vorhalten
            for (const reportId of await reportStatsDB.getAllKeys({
                index: ["ts"],
                keyMatchBefore: [compareDate.getTime()],
            })) {
                await reportStatsDB.deleteValue(reportId);
            }
        }

    }

    class util {

        static addNode(parent, element, index) {
            if (!(index > -1) || index >= parent.children.length) parent.append(element);
            parent.insertBefore(element, parent.children[index]);
        }

        static getMyIndex(element) {
            return Array.prototype.indexOf.call(element.parentElement.children, element);
        }

        static arrayFilter(array, predicate) {
            var result = Array();
            for (var i = 0, l = array.length; i < l; i++) {
                const cur = array[i];
                if (predicate(cur)) result.push(cur);
            }
            return result;
        }

        static arraySearch(array, predicate) {
            for (var i = 0, l = array.length; i < l; i++) {
                const cur = array[i];
                if (predicate(cur)) return cur;
            }
        }

        static createElementFromHTML(htmlString) {
            var div = document.createElement('div');
            div.innerHTML = htmlString.trim();
            return div.firstChild;
        }

        static cloneElement(elem) {
            return this.createElementFromHTML(elem.outerHTML);
        }

        static span(html) {
            const result = document.createElement("span");
            result.innerHTML = html;
            return result;
        }

        static round(num, digits) {
            const correction = Math.pow(10, digits);
            return Math.round((num + Number.EPSILON) * correction) / correction;
        }

        static arrayMin(array, fn) {
            if (!fn) fn = a => a;
            var result = Number.MAX_SAFE_INTEGER;
            array.forEach(action => {
                const cur = Number(fn(action));
                if (cur < result) {
                    result = cur;
                }
            });
            return result;
        }

        static arrayMax(array, fn) {
            if (!fn) fn = a => a;
            var result = Number.MIN_SAFE_INTEGER;
            array.forEach(action => {
                const cur = Number(fn(action));
                if (cur > result) {
                    result = cur;
                }
            });
            return result;
        }

        static arrayAvg(array, fn, roundingDigits) {
            if (!fn) fn = a => a;
            var result = 0;
            array.forEach(action => {
                result += Number(fn(action));
            });
            result = result / array.length;
            if (roundingDigits) {
                result = this.round(result, roundingDigits);
            }
            return result;
        }

        static searchHref(parentElement, name) {
            const hrefs = parentElement.getElementsByTagName("a");
            for (var i = 0, l = hrefs.length; i < l; i++) {
                const href = hrefs[i];
                if (href.innerText === name) {
                    return href;
                }
            }
        }

        static createImgButton(height, url, fnCallback) {
            const result = document.createElement("img");
            result.style.height = height;
            result.src = url;
            result.onclick = fnCallback;
            return result;
        }

        static createSelectableElement(labelElement, selections) {
            const containerElement = document.createElement("span");
            containerElement.style.whiteSpace = "nowrap";
            containerElement.style.position = "relative";
            var selectOptions = "";
            for (const cur of selections) {
                if (typeof cur === 'string') {
                    selectOptions += "<option value='" + cur + "'>" + cur + "</option>";
                } else {
                    selectOptions += "<option value='" + cur[0] + "'>" + cur[1] + "</option>";
                }
            }
            const selectInput = document.createElement("select");
            selectInput.innerHTML = selectOptions;
            containerElement.append(selectInput);
            containerElement.append(labelElement);
            selectInput.style.width = "100%";
            selectInput.style.position = "absolute";
            selectInput.style.left = "0px";
            selectInput.style.opacity = 0.0;
            selectInput.style.cursor = "pointer";
            return [containerElement, selectInput];
        }

        static createCollapsible(height, initialCollapsed, fnCallback) {
            const collapsible = document.createElement("img");
            collapsible.style.height = height;
            collapsible.style.cursor = "pointer";
            collapsible.classList.add("bbignore");
            var collapsed = initialCollapsed;

            function updateCollapserSrc() {
                if (collapsed) {
                    collapsible.src = "/wod/css/skins/skin-8/images/page/navigate_right.png"
                } else {
                    collapsible.src = "/wod/css/skins/skin-8/images/page/navigate_down.png";
                }
            }

            updateCollapserSrc();
            collapsible.onclick = function () {
                collapsed = !collapsed;
                updateCollapserSrc();
                OutputAnchor.runSafe(function () {
                    fnCallback(collapsed);
                })
            }
            return collapsible;
        }

        static forEach(array, fn) {
            for (var i = 0, l = array.length; i < l; i++) {
                fn(array[i]);
            }
        }

    }

    Mod.startMod();

})();

