// ==UserScript==
// @name           [WoD] Erweiterte Kampfstatistik
// @author         demawi
// @namespace      demawi
// @description    Erweitert die World of Dungeons Kampfstatistiken
// @version        0.21.0.4
// @include        http*://*.world-of-dungeons.de/wod/spiel/*dungeon/report.php*
// @include        http*://*/wod/spiel/*dungeon/report.php*
// @include        http*://*.world-of-dungeons.de/*combat_report.php*
// @include        http*://*/wod/spiel/*dungeon/combat_report.php*
// @include        http*://*/wod/spiel/event/play.php*
// @include        http*://*/wod/spiel/event/eventlist.php*
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

    const _ = {
        Storages: demawiRepository.import("Storages"),
        WoDStorages: demawiRepository.import("WoDStorages"),
        WoDSkillsDb: demawiRepository.import("WoDSkillsDb"),
        BBCodeExporter: demawiRepository.import("BBCodeExporter"),
        WoD: demawiRepository.import("WoD"),
        WoDParser: demawiRepository.import("WoDParser"),
        ReportParser: demawiRepository.import("ReportParser"),
        util: demawiRepository.import("util"),
        Libs: demawiRepository.import("Libs"),
        UI: demawiRepository.import("UI"),
        Dices: demawiRepository.import("Dices"),
        CSProxy: demawiRepository.import("CSProxy"),
        Settings: demawiRepository.import("Settings"),
    }

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

        /**
         * Einstiegspunkt der Anwendung. Falls von externer Mod aufgerufen wird, sollten die Parameter entsprechend gesetzt werden.
         * @param kampfbericht   ob es ich um eine Kampfberichtseite handelt
         * @param kampfstatistik ob es sich um die Kampfstatistik-Seite handelt
         * @param dbReportSource Entität aus der "reportArchiveSources"-Datenbank
         */
        static async startMod() {
            const indexedDb = await _.WoDStorages.tryConnectToMainDomain(Mod.dbname);
            if (!indexedDb) return;
            await MyStorage.initMyStorage(indexedDb);

            await demawiRepository.startMod();
            unsafeWindow.statExecuter = async function (...args) {
                console.log(GM.info.script.name + " wird aufgerufen");
                await Mod.startMod2(...args);
            }
            const _this = this;
            setTimeout(async function () {
                await _this.startMod2();
            }, 100);
        }

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
                    console.log("DDDD", unknownEntry);
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
                                unknownEntry.angrifsstyp = userBestimmung.angrifsstyp = angriffstypValue.value;
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

        static createStat() {
            return {
                result: {
                    0: 0,
                    1: 0,
                    2: 0,
                    3: 0,
                },
                value: 0,
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
            toStat.ruestung += from.ruestung;
            toStat.resistenz += from.resistenz;
        };

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

        static addTargetDmgStats = function (toStat, action, target, damage, hadDmgType, damageIndexFinal) {
            if (hadDmgType || damageIndexFinal === 0) {
                if (!toStat.targets.includes(target)) {
                    toStat.result[target.result]++;
                    toStat.targets.push(target);
                }
            }
            // actions: me on me, me on groupy, groupy on me, me on enemy, enemy on me
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
            if (damage !== true && !!damage) {
                SearchEngine.addDmgStats(damage, toStat); // gesamtschaden
                SearchEngine.addDmgStats(damage, SearchEngine.getStat(toStat, null, damage.type, "byDmgType"));
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
                    let subStats = SearchEngine.getStat(curStats, queryFilter, statTarget.unit.id.name, "sub", statTarget.unit.id.isHero ? "herounit" : null);
                    if (!subStats) return false;
                    const unit = statTarget.unit;
                    subStats.unit = unit;
                    subStats.title = unit.typeRef;

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
                    let subStats = SearchEngine.getStat(curStats, queryFilter, statTarget.unit.id.name, "sub", statTarget.unit.id.isHero ? "herounit" : null);
                    if (!subStats) return false;
                    const unit = statTarget.unit;
                    subStats.unit = unit;
                    subStats.title = unit.typeRef;

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

        static doQuery(statQuery, levelDataArray) {
            const wantHeroes = statQuery.side === "heroes";
            const wantDefense = statQuery.type === "defense";
            const wantAll = statQuery.type === "all";

            function doAnalysis(stats, filter, action, target, damage, damageIndexFinal) {
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
                        SearchEngine.addTargetDmgStats(curStats, action, target, damage, statRoot.hadDmgType, damageIndexFinal);
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
                            SearchEngine.addTargetDmgStats(curStats, action, target, damage, statRoot.hadDmgType, damageIndexFinal, true);
                            execFilter(subStats, tail);
                        }
                    }
                    if (secondStatTarget) {
                        let subStats = applyFilter(curStats, queryFilter, action, target, secondStatTarget);
                        if (subStats) {
                            SearchEngine.addTargetDmgStats(curStats, action, target, damage, statRoot.hadDmgType, damageIndexFinal, true);
                            execFilter(subStats, tail);
                        }
                    }
                }
                execFilter(stats, filter);
            }

            var stats = this.createStat();


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
                                        name: unit.id.name,
                                        unit: unit,
                                        fertigkeit: null,
                                        targets: [],
                                        level: level,
                                        area: area,
                                        round: round,
                                        type: "init",
                                        src: "<tr><td></td><td>" + unit.id.name + " tritt in die Runde mit " + unit.hp + " HP und " + unit.mp + " MP ein</td></tr>",
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

                            if (wantAll || (wantHeroes && !wantDefense && isHero) || (!wantHeroes && wantDefense && isHero) || (!wantHeroes && !wantDefense && !isHero) || (wantHeroes && wantDefense && !isHero)) {
                                SearchEngine.addUnitId(action, action.unit);
                                action.targets.forEach(target => {
                                    if (statQuery.type === "attack" || statQuery.type === "defense") {
                                        if (target.typ !== "Parade") { // Es wurde eine Verteidigungs-Probe gewürfelt
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
                                    }
                                });
                            }
                        });
                    }
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
            center(text) {
                return "<td style='text-align:center;vertical-align:middle;'>" + text + "</td>";
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
                    dmgTitle = "Eingehender<br>Schaden";
                } else {
                    dmgTitle = "Ausgehender<br>Schaden";
                }
                this.columns.push(new Column("Gesamtschaden", center(dmgTitle + "<br>(Ø)"), dmgStat => {
                    const dmgs = Array();
                    dmgStat.targets.forEach(target => {
                        (target.damage || []).forEach(damage => {
                            dmgs.push(damage.value + damage.ruestung + damage.resistenz);
                        });
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
                }));
                this.columns.push(new Column("Direkter Schaden", center("Direkter<br>Schaden<br>(Ø)<br>(min-max)"), dmgStat => {
                    const dmgs = Array();
                    dmgStat.targets.forEach(target => {
                        (target.damage || []).forEach(damage => {
                            dmgs.push(damage.value);
                        });
                    })
                    const min = util.arrayMin(dmgs);
                    let max = util.arrayMax(dmgs);
                    const gesamtErfolge = this.gesamtErfolge(dmgStat);
                    var result = dmgStat.value;
                    if (gesamtErfolge > 0 && dmgStat.value > 0) {
                        let avgDamage = dmgStat.value / gesamtErfolge;
                        avgDamage = util.round(avgDamage, 2);
                        if (statView.query.type === "defense") { // in Abhängigkeit der MaxHealth der Einheit setzen
                            if (avgDamage > 20) avgDamage = "<span style='color:red'>" + avgDamage + "</span>";
                            else if (avgDamage > 10) avgDamage = "<span style='color:orange'>" + avgDamage + "</span>";
                            if (max > 20) max = "<span style='color:red'>" + max + "</span>";
                            else if (max > 10) max = "<span style='color:orange'>" + max + "</span>";
                        }
                        result += "<br>" + "(" + avgDamage + ")";
                        result += "<br>" + "(" + min + " - " + max + ")";
                    }
                    return center(result);
                }));
                this.columns.push(new Column("Rüstung", center("Rüstung"), dmgStat => center(mitVorzeichen(-dmgStat.ruestung))));
                this.columns.push(new Column("Resistenz", center("Resistenz"), dmgStat => center(mitVorzeichen(-dmgStat.resistenz))));

                const awColumn = new Column("Angriffswürfe", center("AW Ø<br>(min-max)"), dmgStat => {
                    var aw = Array(); // Angriffswerte
                    dmgStat.actions.forEach(action => {
                        if (!action.skill || !action.skill.wuerfe) {
                            console.error("Fertigkeit oder Wurf nicht gefunden: ", action);
                        }
                        action.skill.wuerfe.forEach(wurf => aw.push(Number(wurf.value)));
                    });
                    return center(util.arrayAvg(aw, null, 2) + "<br>(" + util.arrayMin(aw) + " - " + util.arrayMax(aw) + ")");
                });
                const pwColumn = new Column("Paradewürfe", center("PW Ø<br>(min-max)"), dmgStat => {
                    var pw = Array(); // Paradewerte
                    dmgStat.targets.forEach(target => {
                        pw.push(Number(target.skill.wurf));
                    });
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

                var switcher = true;
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
                table.append(header);

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
                                    actionTR.innerHTML = action.src;
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
                    if (statResult.actions.length > 0) {
                        addLine(statView, id === "" ? "" : (id + ""), statResult, statResult.byDmgType);
                    }
                }

                function connect(a, b) {
                    if (a === "") return b;
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