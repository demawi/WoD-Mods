// ==UserScript==
// @name           [WoD] Erweiterte Kampfstatistik
// @namespace      demawi
// @description    Erweitert die World of Dungeons Kampfstatistiken
// @version        0.18.5
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

(function() {
    'use strict';

    class Mod {
        static version = "0.19";
        static stand = "17.11.2024";
        static forumLink = "/wod/spiel/forum/viewtopic.php?pid=16698430";
        static currentReportDataVersion = 5;

        static thisReport;
        static thisLevelDatas; // Array der Level über welche die Auswertung gefahren wird
        static outputAnchor;
        static runSave;

        // Einstiegspunkt der Anwendung
        static async startMod() {
            if (WoD.istSeite_Kampfbericht()) { // Einzelseite
                Mod.outputAnchor = Mod.createOutputAnchor();
                Mod.runSave(async function () {
                    // cur_rep_id für Dungeons, report bei Schlachten
                    const reportId = WoD.getReportId();
                    await Storage.loadThisReport(reportId);

                    var levelData = ReportParser.readAndStoreKampfbericht(reportId);
                    if (levelData) {
                        var roundCount = levelData.roundCount;

                        var hinweisText = ": " + roundCount + " Runden";
                        const reportProgress = Mod.getReportProgress();
                        if (reportProgress.missingReports.length > 0) {
                            hinweisText += ". Es fehlen noch die Reports für folgende Level: " + reportProgress.missingReports.join(", ") + " (Bitte entsprechende Level aufrufen)";
                        }
                        Mod.outputAnchor.setTitle(hinweisText);
                        Mod.thisLevelDatas = [levelData];
                        await Storage.saveThisReport();
                    }
                });
            }
            if (WoD.istSeite_Kampfstatistik()) { // Übersichtsseite
                Mod.outputAnchor = Mod.createOutputAnchor();
                Mod.runSave(async function () {
                    const reportId = WoD.getReportId();
                    await Storage.loadThisReport(reportId);

                    if (Mod.thisReport.levelCount) {
                        const reportProgress = Mod.getReportProgress();

                        var hinweisText = ": " + reportProgress.roundCount + " Runden (" + reportProgress.allRoundNumbers.join(", ") + ")";
                        if (reportProgress.foundReportCount < reportProgress.levelCount) {
                            hinweisText += ". Es fehlen noch die Reports für folgende Level: " + reportProgress.missingReports.join(", ") + " (Bitte entsprechende Level aufrufen)";
                        }
                        Mod.outputAnchor.setTitle(hinweisText);
                        Mod.thisLevelDatas = Mod.thisReport.levelDatas;
                    } else {
                        Mod.outputAnchor.setTitle(": Es fehlen noch alle Level-Reports!" + " (Bitte entsprechende Level aufrufen)")
                    }
                    Storage.validateAllReports(); // no await
                });
            }
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
                levelCount = Mod.thisReport.levelCount;
                levelDatas = Mod.thisReport.levelDatas;

                for (var i = 0, l = levelCount; i < l; i++) {
                    if (levelDatas.length > i) {
                        const levelData = levelDatas[i];
                        if (levelData) {
                            const curAreaCount = Object.keys(levelData.areas).length;
                            const areaRoundCounts = Array();
                            levelData.areas.forEach(area => areaRoundCounts.push(area.rounds.length));
                            allRoundNumbers[i] = (curAreaCount > 1 ? "[" + areaRoundCounts.join(", ") + "]" : "" + levelData.roundCount);
                            roundCount += levelData.roundCount;
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

        // erzeugt den Punkt wo wir uns mit der UI ranhängen können
        static createOutputAnchor() {
            // Ausgabe
            var headings = document.getElementsByTagName("h2");
            var content = document.createElement("div");
            content.classList.add("nowod");
            content.hidden = true;
            var header = document.createElement("div");
            header.classList.add("nowod");
            header.innerHTML = "Erweiterte Kampfstatistiken";
            var firstClick = true;
            var foundError;
            const collapsible = util.createCollapsible("20px", true, function (hide) {
                content.hidden = hide;
                if (foundError) {
                    const zeileUndSpalte = foundError.stack.match(/:(\d+:\d+)/)[1]
                    content.innerHTML = foundError + " v" + Mod.version + " -> " + zeileUndSpalte + "Forum <a target='_blank' href='" + Mod.forumLink + "'>Link ins Forum</a>"
                        + "<br>Wer selber nachschauen möchte: der Error inklusive Link wurde auch in die Entwicklerkonsole geschrieben";
                } else if (firstClick) {
                    firstClick = false;
                    const anchor = document.createElement("div");
                    content.appendChild(anchor);
                    const view = new QueryModel.StatQuery("heroes", "attack", []);
                    const initialStatView = new Viewer.StatView(view, true, false);
                    new Viewer.StatTable(initialStatView, Mod.thisLevelDatas, anchor);
                    content.append(document.createElement("br"));
                }
            });
            headings[0].parentNode.insertBefore(header, headings[0].nextSibling);
            headings[0].parentNode.insertBefore(content, header.nextSibling);

            function setTitle(titleMessage) {
                header.innerHTML = "Erweiterte Kampfstatistiken" + titleMessage;
                header.append(collapsible);
            }

            function logError(error) {
                setTitle("<span title='" + error + "'>⚠️ Ein Fehler ist aufgetreten, es konnten diesmal leider keine Statistiken erstellt werden!</span>");
                foundError = error;
                if (error.additionals) {
                    console.error("Ein Fehler wurde abgefangen!", error, ...error.additionals);
                } else {
                    console.error("Ein Fehler wurde abgefangen!", error);
                }
            }

            // führt die Funktion in einem gesicherten Kontext aus, um aufkommende Fehler abzufangen und konform anzuzeigen
            // jeglicher Code sollte in diesem Kontext laufen
            Mod.runSave = function (asyncFunction) {
                try {
                    const functionResult = asyncFunction()
                    if (functionResult && functionResult.catch) {
                        functionResult.catch(error => {
                            logError(error);
                        });
                    }
                } catch (error) {
                    logError(error);
                }
            }
            return {
                setTitle: setTitle
            };
        }
    }

    class SearchEngine {
        static StatSearch(statQuery, levelDataArray) {
            var createStat = () => {
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
                    targets: Array(),
                }
            };
            var addDmgStats = function (from, toStat) {
                toStat.value += from.value;
                toStat.ruestung += from.ruestung;
                toStat.resistenz += from.resistenz;
            };
            var getStat = function (previousStats, queryFilter, id, subDomain, typeInitialize) {
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
                            levelDataArray[0].areas[0].rounds[0].helden.forEach(held => {
                                subDomainEntry[held.id.name] = createStat();
                            });
                        } else if (typeInitialize === "position") {
                            subDomainEntry["Vorne"] = createStat();
                            subDomainEntry["Linke Seite"] = createStat();
                            subDomainEntry["Rechte Seite"] = createStat();
                            subDomainEntry["Zentrum"] = createStat();
                            subDomainEntry["Hinten"] = createStat();
                            subDomainEntry["Im Rücken"] = createStat();
                        } else if (typeInitialize === "attackType") {
                            subDomainEntry["Nahkampf"] = createStat();
                            subDomainEntry["Zauber"] = createStat();
                            subDomainEntry["Fernkampf"] = createStat();
                            subDomainEntry["Sozial"] = createStat();
                            subDomainEntry["Hinterhalt"] = createStat();
                            subDomainEntry["Explosion"] = createStat();
                        }
                        previousStats[subDomain] = subDomainEntry;
                    }
                    curObject = subDomainEntry;
                }
                var result = curObject[id];
                if (!result) {
                    result = createStat()
                    curObject[id] = result;
                }
                return result;
            }
            var addTargetDmgStats = function (target, toStat, fromAction, damage, hadDmgType, damageIndexFinal, inBetweenCalc) {
                if (hadDmgType || damageIndexFinal === 0) {
                    if (!toStat.targets.includes(target)) {
                        toStat.result[target.result]++;
                        toStat.targets.push(target);
                    }
                    if (!toStat.actions.includes(fromAction)) {
                        toStat.actions.push(fromAction);
                    }
                }
                if (damage !== true) {
                    addDmgStats(damage, toStat); // gesamtschaden
                    addDmgStats(damage, getStat(toStat, null, damage.type, "byDmgType"));
                }
            }
            var stats = createStat();

            const wantHeroes = statQuery.side === "heroes";
            const wantOffense = statQuery.type === "attack";
            var filter = statQuery.filter; // position, attackType, fertigkeit, units
            for (var levelNr = 1, levelCount = levelDataArray.length; levelNr <= levelCount; levelNr++) {
                const finalLevelNr = levelNr;
                const levelData = levelDataArray[levelNr - 1];
                if (!levelData) continue;
                const areas = levelData.areas;
                for (var areaNr = 1, areaCount = areas.length; areaNr <= areaCount; areaNr++) {
                    const area = areas[areaNr - 1];
                    const finalAreaNr = areaNr;

                    const rounds = area.rounds;
                    for (var roundNr = 0, l = rounds.length; roundNr < l; roundNr++) {
                        var round = rounds[roundNr];
                        round.actions.runde.forEach(action => {
                            var isHero = action.unit.id.isHero;
                            // console.log(myStats);
                            // a. Wir wollen Helden und deren Offensive: es muss ein Held angreifen.
                            // b. Wir wollen Monster und die Defensive: es muss ein Held angreifen.
                            // c. Wir wollen Monster und die Offensive: es muss ein Monster angreifen.
                            // d. Wir wollen Helden und die Defensive: es muss ein Monster angreifen.
                            if ((wantHeroes && wantOffense && isHero) || (!wantHeroes && !wantOffense && isHero) || (!wantHeroes && wantOffense && !isHero) || (wantHeroes && !wantOffense && !isHero)) {
                                action.targets.forEach(target => {
                                    if (target.type !== "Angriff") {
                                        console.log("target.type " + target.type);
                                        return;
                                    }

                                    var damages = target.damage; // nur bei "true" wird die action auch gezählt
                                    if (damages.length === 0) damages = [true];
                                    var firstDamage = true;
                                    for (var damageIndex = 0, damageLength = damages.length; damageIndex < damageLength; damageIndex++) {
                                        const damage = damages[damageIndex];
                                        const damageIndexFinal = damageIndex;

                                        var hadDmgType = false;
                                        const execFilter = function (curStats, filters) {
                                            if (!filters || filters.length === 0) {
                                                addTargetDmgStats(target, curStats, action, damage, hadDmgType, damageIndexFinal);
                                                return true;
                                            }
                                            const queryFilter = filters[0];
                                            const curFilter = queryFilter.spec;
                                            var actionTarget;
                                            if (curFilter.startsWith("attackType") || curFilter.startsWith("skill")) { // attackType ist immer auf der aktiven Unit
                                                actionTarget = action;
                                            } else if (curFilter.startsWith("enemy_")) {
                                                actionTarget = wantOffense ? target : action;
                                            } else {
                                                actionTarget = wantOffense ? action : target;
                                            }
                                            var subStats;
                                            if (curFilter.endsWith("position")) {
                                                subStats = getStat(curStats, queryFilter, actionTarget.unit.position, "sub", "position");
                                                if (!subStats) return false;
                                            } else if (curFilter.endsWith("unit")) {
                                                subStats = getStat(curStats, queryFilter, actionTarget.unit.id.name, "sub", actionTarget.unit.id.isHero ? "herounit" : null);
                                                if (!subStats) return false;
                                                const unit = actionTarget.unit;
                                                subStats.unit = unit;
                                                subStats.title = unit.typeRef;

                                                if (!unit.id.isHero) {
                                                    // anhand des Names wird eh schon aufgeschlüsselt, hier benötigen wir die restlichen Informationen
                                                    const id = finalLevelNr + "_" + finalAreaNr + "_" + unit.index || 1;
                                                    if (id) {
                                                        var unitCount = subStats.unitCount;
                                                        if (!unitCount) {
                                                            unitCount = {};
                                                            subStats.unitCount = unitCount;
                                                        }
                                                        unitCount[id] = true;
                                                    }
                                                }
                                            } else if (curFilter.endsWith("attackType")) {
                                                subStats = getStat(curStats, queryFilter, actionTarget.fertigkeit.type, "sub", "attackType");
                                                if (!subStats) return false;
                                            } else if (curFilter.endsWith("skill")) {
                                                subStats = getStat(curStats, queryFilter, actionTarget.fertigkeit.name, "sub", "skill");
                                                if (!subStats) return false;
                                                subStats.title = actionTarget.fertigkeit.typeRef;
                                            } else if (curFilter.endsWith("level")) {
                                                if (levelDataArray.length === 1) return; // Wenn es nur einen Level gibt, wird dieses Kriterium ignoriert
                                                subStats = getStat(curStats, queryFilter, "Level " + finalLevelNr, "sub", "level");
                                                if (!subStats) return false;
                                                subStats.title = "Level " + finalLevelNr + "<br>(" + levelData.roundCount + " Runden)" + (finalAreaNr === 1 ? "" : "<br>(" + areas.length + " Kämpfe)");
                                            } else if (curFilter.endsWith("fight")) {
                                                subStats = getStat(curStats, queryFilter, "Kampf " + finalLevelNr + "." + finalAreaNr, "sub", "fight");
                                                if (!subStats) return false;
                                                subStats.title = "Kampf " + finalLevelNr + "." + finalAreaNr + "<br>(" + area.rounds.length + " Runden)";
                                            } else if (curFilter.endsWith("items")) {
                                                subStats = getStat(curStats, queryFilter, util.arrayMap(actionTarget.fertigkeit.items, a => a.name).join(", "), "sub", "items");
                                                if (!subStats) return false;
                                                subStats.title = util.arrayMap(actionTarget.fertigkeit.items, a => a.srcRef).join(", ");
                                            } else if (curFilter.endsWith("dmgType")) {
                                                hadDmgType = true;
                                                subStats = getStat(curStats, queryFilter, damage === true ? "Ohne Schaden" : damage.type, "sub", "dmgType");
                                                if (!subStats) return false;
                                            } else {
                                                console.error("StatQuery-Filter ist nicht valide: '" + curFilter + "'");
                                            }
                                            subStats.filterType = curFilter;
                                            const tail = filters.slice(1);
                                            if (execFilter(subStats, tail)) {
                                                addTargetDmgStats(target, curStats, action, damage, hadDmgType, damageIndexFinal, true);
                                                return true;
                                            }
                                            return false;
                                        }
                                        execFilter(stats, filter);
                                        firstDamage = false;
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

        static FilterTypes = class FilterTypes {
            static level = "Level";
            static fight = "Kampf";

            static attackType = "AngriffsTyp";

            static position = "Position";
            static unit = "Einheit";
            static skill = "Fertigkeit";
            static items = "Gegenstände";
            static dmgType = "Schadensart";

            static enemy_unit = "Gegner-Einheit";
            static enemy_position = "Gegner-Position";
        }

        // helden <-> monster
        // action <-> target
        // action.unit.position
        // z.B. monster, target.unit.position
        static StatQuery = class StatQuery {
            side; // "heroes" oder "monsters"
            type; // 1: für Angriff, 2: für Verteidigung
            filter; // Array von QueryFilter

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

    // Liest den Kampfbericht ein und erstellt die Datenstruktur auf der Anfragen gestellt werden können.
    // Grobe Struktur: Report -> Level -> Kampf -> (Vor-)Runde -> Aktion -> Ziel -> Auswirkung
    class ReportParser {
        static currentRound;

        static readAndStoreKampfbericht(reportId) {
            var levelNr;
            var levelCount;
            if (reportId.startsWith("schlacht_")) {
                levelNr = 1;
                levelCount = 1;
            } else { // Dungeon
                levelNr = document.getElementsByName("current_level")[0].value;
                levelCount = document.getElementsByClassName("navigation levels")[0].children.length - 1;
            }
            const levelData = this.readKampfbericht();
            Mod.thisReport.id = reportId;
            Mod.thisReport.levelCount = levelCount;
            if (!Mod.thisReport.levelDatas) {
                Mod.thisReport.levelDatas = [];
            }
            Mod.thisReport.levelDatas[levelNr - 1] = levelData;
            return levelData;
        }

        static readKampfbericht() {
            var contentTables = document.getElementsByClassName("content_table");

            var roundContentTable; // Suche nach dem Table der die eigentliche Runden enthält
            {
                for (var i = 0, l = contentTables.length; i < l; i++) {
                    var curContentTable = contentTables[i];
                    if (curContentTable.getElementsByClassName("rep_status_table").length > 0) {
                        roundContentTable = curContentTable;
                    }
                }
            }

            const areas = Array();
            var curAreaNr = 0;
            var curArea = Array();
            var roundCount = 0;
            if (roundContentTable) {
                var roundTRs = roundContentTable.children[0].children;
                roundCount = roundTRs.length;
                for (var i = 0, l = roundTRs.length; i < l; i++) {
                    const neueRunde = new this.Round(i + 1, roundTRs[i]);
                    if (neueRunde.area !== curAreaNr) {
                        curArea = {
                            rounds: Array(),
                        };
                        curAreaNr = neueRunde.area;
                        areas.push(curArea);
                    }
                    curArea.rounds.push(neueRunde);
                }
            }
            return {
                roundCount: roundCount,
                areas: areas,
            };
        }

        static Round = class Round {
            nr;
            area;
            helden;

            // ohne Kampf sind nur Daten nicht angelegt
            actions;
            monster;

            constructor(nr, roundTD) {
                if (!ReportParser.currentRound) {
                    this.area = 1;
                } else {
                    if (roundTD.getElementsByClassName("rep_round_headline")[0].innerText === "Runde 1") {
                        this.area = ReportParser.currentRound.area + 1;
                    } else {
                        this.area = ReportParser.currentRound.area;
                    }
                }
                ReportParser.currentRound = this;
                this.nr = nr;

                var statusTables = roundTD.getElementsByClassName("rep_status_table"); // üblicherweise sollten es immer 2 sein, nur am Ende des Kampfes dann 4
                if (statusTables.length !== 2 && statusTables.length !== 4) {
                    console.error("Es wurden keine zwei StatusTable in einer Runde gefunden: " + statusTables.length);
                }
                this.helden = ReportParser.GruppenStatus(statusTables[0], true);
                if (!this.helden) return; // keine kampfbereiten Helden, keine Aktionen
                this.monster = ReportParser.GruppenStatus(statusTables[1], false);
                if (!this.monster) return; // keine kampfbereiten Gegner, keine Aktionen
                var vorrunde = Array();
                var runde = Array();
                var actions = util.arrayMap(roundTD.getElementsByClassName("rep_initiative"), function (a) {
                    return a.parentElement
                });
                for (var k = 0, kl = actions.length; k < kl; k++) {
                    var currentAction = actions[k]; // Round-Action-TR
                    if (currentAction.children.length === 1) { // <hr>
                        // nothing to do
                    } else if (currentAction.children.length === 2) { // Flucht z.B. "ist ein Feigling und flieht wegen Hitpointverlusts." oder "kann nichts tun"
                        // currently nothing to do
                    } else { // length == 3. Vorrunden- (ohne Initiative) oder Runden-Aktion (mit Initiative)
                        if (currentAction.children[0].innerHTML + "" === "&nbsp;") { // Vorrunden-Aktion
                            vorrunde.push(ReportParser.Action(currentAction, null, currentAction.children[1], currentAction.children[2]));
                        } else { // Runden-Aktion
                            runde.push(ReportParser.Action(currentAction, currentAction.children[0], currentAction.children[1], currentAction.children[2]));
                        }
                    }
                }
                this.actions = {
                    vorrunde: vorrunde,
                    runde: runde
                };
            }
        }

        static GruppenStatus(statusTable, heldenJaNein) {
            var statusTRs = statusTable.children[0].children
            if (statusTRs[1].innerText.includes("keine kampfbereiten Gegner")) {
                return;
            }
            var result = Array();
            //console.log("Status Table", statusTRs);
            for (var i = 1, l = statusTRs.length; i < l; i++) { // ohne Header
                var tds = statusTRs[i].children;
                var srcRef = tds[1].innerHTML; // Mit aktuellen Wirkungen und Index. Helden wenn sie bewusstlos sind haben keinen Link mehr
                var typeRef; // unabhängig von Wirkung und Index, sofern vorhanden einzig der Link
                var unitLink = tds[1].getElementsByTagName("a");
                if (unitLink) unitLink = unitLink[0];
                if (unitLink) typeRef = unitLink.outerHTML;
                const unit = {
                    id: this.getUnitIdFromElement(tds[1].childNodes[0], null, heldenJaNein, true),
                    stufe: tds[2].innerText.trim(),
                    position: tds[3].innerText.trim(),
                    hp: tds[4].innerText.trim(),
                    mp: tds[5].innerText.trim(),
                    zustand: tds[6].innerText.trim(),
                    srcRef: srcRef,
                    typeRef: typeRef,
                }
                if (unit.position !== "") {
                    result.push(unit);
                }
            }
            return result;
        }

        static Target(strLine) {
            var type
            var wirkung
            var result

            if (strLine.match(/: Fehlschlag/)) {
                result = 0;
            } else if (strLine.match(/: kritischer Erfolg/)) {
                result = 3;
            } else if (strLine.match(/: guter Erfolg/)) {
                result = 2;
            } else if (strLine.match(/: Erfolg/)) {
                result = 1;
            }
            var pw;
            if (result > -1) {
                type = "Angriff";
                const pwMatch = strLine.match(/(\(|\/)(\d+)(\)|\/)/);
                if (pwMatch) {
                    pw = pwMatch[2];
                } else {
                    console.log("Keine Parade", strLine);
                }

            } else {
                var matching = strLine.match(/\+(\d*) HP/)
                if (matching) { // Single Target Heal
                    type = "Heilung";
                    wirkung = {
                        what: "HP",
                        value: matching[1],
                    }
                } else {

                }
            }

            return {
                type: type,
                fertigkeit: {
                    wurf: pw,
                },
                wirkung: wirkung, // z.B. bei direkter Heilung
                result: result, // 0:Fehlschlag, 1:Erfolg, 2: Guter Erfolg, 3: Kritischer Erfolg
                damage: Array() // Achtung: hier wird auch der Overkill nicht abgezogen. Ist also evtl. mehr Schaden angezeigt als überhaupt HP beim Gegner noch vorhanden wären. Gilt das aber auch beim Heilen!?
            };
        }

        static isUnitClass(className) {
            return className && (className === "rep_hero" || className === "rep_monster" || className === "rep_myhero" || className === "rep_myotherheros");
        }

        //Einen Lookup ausführen, damit die Unit auch immer alle möglichen Information (z.B. Position) trägt.
        static unitLookup(unitId) {
            var lookupUnit = this.unitSearch(unitId, this.currentRound.helden);
            if (!lookupUnit) {
                lookupUnit = this.unitSearch(unitId, this.currentRound.monster);
            }
            if (!lookupUnit) {
                console.error("Unit konnte nicht in der aktuellen Runde gefunden werden!", unitId);
                return {
                    id: unitId,
                };
            }
            return lookupUnit;
        }

        static unitSearch(unitId, unitArray) {
            for (var i = 0, l = unitArray.length; i < l; i++) {
                const curUnit = unitArray[i];
                if (curUnit.id.name === unitId.name && curUnit.id.index === unitId.index) {
                    return curUnit;
                }
            }
        }

        //im Target kann auch "sich" stehen, das wird dann entsprechend durch die zusätzliche Angabe "unitId" ersetzt.
        static getUnitIdFromElement(element, unitId, defaultIsHero) {
            if (!element) { // Ereignis
                return {
                    name: "? Ereignis",
                    isHero: false,
                    isEreignis: true,
                }
            }
            if (!element.tagName) {
                if (element.innerText === "sich" || element.textContent === "sich") {
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
            return {
                name: element.innerText,
                index: unitIndex,
                isHero: isHero,
            };
        }

        static getDamageType(stringLine) {
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
            console.error("DamageType kann nicht bestimmt werden: " + stringLine);
            return "???";
        }

        static Damage(damageLineElement) {
            var resistenz = 0;
            if (damageLineElement.tagName === "SPAN") { // hat Anfälligkeit
                //console.log("Anfälligkeit gefunden "+damageLineElement.textContent);
                const dmgVorher = damageLineElement.onmouseover.toString().match(/verursacht: <b>(\d*)<\/b>/)[1];
                const dmgNachher = damageLineElement.onmouseover.toString().match(/Anfälligkeit.* <b>(\d*)<\/b>/)[1];
                resistenz = Number(dmgVorher) - Number(dmgNachher);
            }
            const stringLine = damageLineElement.textContent;
            var matching = stringLine.match(/^(\d*) \[\+(\d*)\]/);
            if (matching) {
                return {
                    value: Number(matching[1]),
                    ruestung: Number(matching[2]),
                    resistenz: resistenz,
                    type: this.getDamageType(stringLine),
                }
            }
            matching = stringLine.match(/^(\d*)/);
            if (matching) {
                return {
                    value: Number(matching[1]),
                    ruestung: 0,
                    resistenz: resistenz,
                    type: this.getDamageType(stringLine),
                }
            }
            console.error("Es kann kein Schaden ermittelt werden: " + stringLine);
        }

        static Wirkungen(htmlString, parentElement) {
            const elem = document.createElement("div");
            elem.innerHTML = htmlString;
            const wirkungen = Array();
            var currentMode = 0;
            var name;
            var wirkung = Array();
            var wann;

            function addWirkung() {
                if (!name.startsWith("Dies ist ein")) {
                    wirkungen.push({
                        name: name,
                        wirkung: wirkung.join(""),
                        wann: wann,
                    });
                }
            }

            for (var i = 0, l = elem.childNodes.length; i < l; i++) {
                const curNode = elem.childNodes[i];
                if (currentMode === 0) {
                    name = curNode.textContent;
                    currentMode = 1;
                } else if (curNode.tagName === "BR") {
                    addWirkung();
                    currentMode = 0;
                } else if (curNode.textContent === " ") {
                    // ignorieren
                } else {
                    const curText = curNode.textContent;
                    if (curText.includes("Runde")) {
                        wann = curText;
                    } else {
                        wirkung.push(curText);
                    }
                    currentMode++;
                }
            }
            if (currentMode > 1) {
                addWirkung();
            }
            //console.log(htmlString, elem.childNodes.length, wirkungen);

            return wirkungen;
        }


        static getFertigkeit(actionElement, fertigkeitsWurfString, mitParade) { // wird üblicherweise in Klammern dargestellt (Fechtwaffen/29/Leichter Parierdolch der Fechtkunst)
            var fertigkeitsWurfArray = fertigkeitsWurfString.split("/");
            var name
            var wurf
            var mp
            var items = Array()
            var pointer = 0;
            var fertigkeitElement = util.arraySearch(actionElement.getElementsByTagName("a"), a => a.href.includes("/skill/"));
            var fertigkeitTypeRef = util.cloneElement(fertigkeitElement);

            if (mitParade) {
                name = fertigkeitsWurfArray[0];
                wurf = fertigkeitsWurfArray[1];
                pointer = 2;
            }

            if (fertigkeitsWurfArray.length > pointer) {
                if (fertigkeitsWurfArray[pointer].endsWith(" MP")) {
                    mp = fertigkeitsWurfArray[pointer].substring(0, fertigkeitsWurfArray[pointer].length - 3);
                    pointer += 1;
                }
                if (fertigkeitsWurfArray.length > pointer) {
                    var itemStringArray = fertigkeitsWurfArray[pointer].split(","); // Gegenstand + Munition(en)
                    itemStringArray.forEach(itemName => {
                        itemName = itemName.trim();
                        var href = util.searchHref(actionElement, itemName);
                        if (href) href = href.outerHTML;
                        items.push({
                            name: itemName,
                            srcRef: href,
                            wirkungen: ReportParser.searchWirkungen(actionElement, itemName),
                        });
                    });
                }
            }
            var wirkungen = ReportParser.searchWirkungen(actionElement, name);
            return {
                name: name,
                wirkungen: wirkungen,
                wurf: wurf,
                mp: mp,
                items: items,
                typeRef: fertigkeitTypeRef.outerHTML,
            }
        }

        static Action(actionTR, initiative, action, target) {
            var actionText = action.innerText;
            var who;
            var fertigkeit;
            var wurf;
            var mp;
            var unit = this.unitLookup(this.getUnitIdFromElement(action.children[0]));

            // Parse targetNew

            var curTargetUnit
            var currentTarget
            var currentLine = Array();
            var lineNr = 0;
            var targets = Array();

            function addTarget() {
                var line = util.arrayMap(currentLine, a => a.textContent).join("");
                currentTarget = ReportParser.Target(line);
                currentTarget.unit = curTargetUnit;
                targets.push(currentTarget);
            }

            //console.log("Target: "+target.innerText+" "+target.childNodes.length);
            for (var i = 0, l = target.childNodes.length; i < l; i++) {
                const curElement = target.childNodes[i];

                const unitIdCheck = this.getUnitIdFromElement(curElement, unit.id);

                if (unitIdCheck) {
                    lineNr = 1;
                    curTargetUnit = this.unitLookup(unitIdCheck);
                    currentLine.push(curElement);
                    currentTarget = null;
                } else if (lineNr === -1) {
                    // ignorieren solange bis neue Entität kommt
                } else if (curElement.tagName === "BR") {
                    if (lineNr === 1) { // Erste-Zeile beendet wir setzen das Target
                        addTarget();
                    }
                    currentLine = Array()
                    lineNr++;
                } else {
                    if (lineNr > 1) { // Nachfolgende DamageLines direkt auswerten
                        //console.log("here: "+currentTarget+" "+lineNr+" => "+curElement.textContent);
                        if (curElement.tagName === "A") { // Schaden an einem Gegenstand
                            lineNr = -1; // solange ignorieren bis eine neue Entität kommt
                        } else {
                            currentTarget.damage.push(ReportParser.Damage(curElement));
                        }
                    } else {
                        currentLine.push(curElement);
                    }
                }
            }
            if (lineNr === 1) {
                addTarget();
            }

            // Parse action
            if (unit.id.isEreignis) {
                fertigkeit = {
                    name: "Ereignis",
                    type: "Ereignis",
                    wurf: actionText.substring(actionText.lastIndexOf("(") + 1, actionText.lastIndexOf(")")),
                };

            } else {
                if (actionText.includes(" heilt mittels ")) {
                    fertigkeit = {
                        name: actionText.substring(actionText.indexOf(" heilt mittels ") + 15),
                        type: "Heilung",
                    }
                } else {
                    var index;

                    index = actionText.indexOf(" wirkt ");
                    if (index > 0 && !actionText.includes("wirkt als")) { // Fähigkeit vor Klammern. Benötigt keine Probe.
                        var klammerBegin = actionText.indexOf("(", index);
                        var vorKlammerText = actionText.substring(0, klammerBegin);
                        var klammerText = actionText.substring(klammerBegin + 1, actionText.lastIndexOf(")"));

                        fertigkeit = this.getFertigkeit(action, klammerText, false);
                        fertigkeit.name = vorKlammerText.substring(vorKlammerText.indexOf(" wirkt ") + 7, klammerBegin - 1);
                        fertigkeit.type = "Wirkung"
                    } else { // Fähigkeit in Klammern

                        var matcher = actionText.match(/(greift per Fernkampf an|greift im Nahkampf an|greift magisch an|greift sozial an|greift hinterhältig an|verseucht|entschärft|wirkt als Naturgewalt auf|wird ausgelöst auf|erwirkt eine Explosion gegen) \(/);
                        if (!matcher) {
                            console.error("Unbekannter fertigkeit.type gefunden! " + actionText);
                        } else {
                            var index = matcher.index;
                            var matchingPattern = matcher[1];
                            var klammerBegin = actionText.indexOf("(", index);
                            var klammerText = actionText.substring(klammerBegin + 1, actionText.lastIndexOf(")"));
                            fertigkeit = this.getFertigkeit(action, klammerText, true);
                            if (matchingPattern.includes("Nahkampf")) {
                                fertigkeit.type = "Nahkampf";
                            } else if (matchingPattern.includes("Fernkampf")) {
                                fertigkeit.type = "Fernkampf";
                            } else if (matchingPattern.includes("magisch")) {
                                fertigkeit.type = "Zauber";
                            } else if (matchingPattern.includes("sozial")) {
                                fertigkeit.type = "Sozial";
                            } else if (matchingPattern.includes("hinterhältig")) {
                                fertigkeit.type = "Hinterhalt";
                            } else if (matchingPattern.includes("verseucht")) {
                                fertigkeit.type = "Krankheit";
                            } else if (matchingPattern.includes("entschärft")) {
                                fertigkeit.type = "Falle entschärfen";
                            } else if (matchingPattern.includes("Naturgewalt")) {
                                fertigkeit.type = "Naturgewalt";
                            } else if (matchingPattern.includes("ausgelöst")) {
                                fertigkeit.type = "Falle";
                            } else if (matchingPattern.includes("Explosion")) {
                                fertigkeit.type = "Explosion";
                            } else {
                                console.error("Unbekannter fertigkeit.type gefunden! " + actionText);
                            }
                        }

                    }
                }
            }

            //console.log(actionTR);
            var result = {
                name: unit.id.name, // nur fürs Testen
                unit: unit,
                fertigkeit: fertigkeit,
                targets: targets,
                src: actionTR.outerHTML,
            };
            if (!unit.isHero) {
                //console.log(action, result);
            }
            //console.log(result);
            return result;
        }

        static searchWirkungen(parentElement, name) {
            var result;
            const hrefs = parentElement.getElementsByTagName("a");
            for (var i = 0, l = hrefs.length; i < l; i++) {
                const href = hrefs[i];
                if (href.innerText === name) {
                    if (href.onmouseover) {
                        result = href.onmouseover.toString();
                        result = result.substring(result.indexOf("'") + 1, result.lastIndexOf("'"));
                        result = ReportParser.Wirkungen(result, parentElement);
                    }
                    break;
                }
            }
            return result;
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

        }

        static TableViewAngriffVerteidigung = class TableViewAngriffVerteidigung {
            columns = Array();

            constructor(statView) {
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
                this.columns.push(new Column("Ausgehender Schaden", center("Ausgehender<br>Schaden<br>(Ø)"), dmgStat => {
                    const gesamtDamage = this.gesamtDamage(dmgStat);
                    const gesamtErfolge = this.gesamtErfolge(dmgStat);
                    var result = gesamtDamage;
                    if (gesamtErfolge > 0 && gesamtDamage > 0) {
                        const avgDamage = gesamtDamage / gesamtErfolge;
                        result += "<br>" + "(" + util.round(avgDamage, 2) + ")";
                    }
                    return center(result);
                }));
                this.columns.push(new Column("Direkter Schaden", center("Direkter<br>Schaden<br>(Ø)"), dmgStat => {
                    const gesamtErfolge = this.gesamtErfolge(dmgStat);
                    var result = dmgStat.value;
                    if (gesamtErfolge > 0 && dmgStat.value > 0) {
                        const avgDamage = dmgStat.value / gesamtErfolge;
                        result += "<br>" + "(" + util.round(avgDamage, 2) + ")";
                    }
                    return center(result);
                }));
                this.columns.push(new Column("Rüstung", center("Rüstung"), dmgStat => center(mitVorzeichen(-dmgStat.ruestung))));
                this.columns.push(new Column("Resistenz", center("Resistenz"), dmgStat => center(mitVorzeichen(-dmgStat.resistenz))));

                const awColumn = new Column("Angriffswürfe", center("AW Ø<br>(Min-Max)"), dmgStat => {
                    var aw = Array(); // Angriffswerte
                    dmgStat.actions.forEach(action => {
                        aw.push(Number(action.fertigkeit.wurf));
                    });
                    return center(util.arrayAvg(aw, null, 2) + "<br>(" + util.arrayMin(aw) + " - " + util.arrayMax(aw) + ")");
                });
                const pwColumn = new Column("Paradewürfe", center("PW Ø<br>(Min-Max)"), dmgStat => {
                    var pw = Array(); // Paradewerte
                    dmgStat.targets.forEach(target => {
                        pw.push(Number(target.fertigkeit.wurf));
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
                this.columns.push(new Column("Schadensarten", center("Schadensarten<br>Schaden / Rüstung / Anfälligkeit"), dmgStat => {
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

            center(text) {
                return "<td style='text-align:center;vertical-align:middle;'>" + text + "</td>";
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

            static renderColumnTable(table, tableView, statView) {
                var switcher = true;

                const header = document.createElement("tr");
                header.className = "row0";

                header.innerHTML = "<td colspan=" + this.maxColspan + "></td>"
                for (const column of tableView.columns) {
                    const curHeader = column.header;
                    if (!curHeader || !curHeader.startsWith("<td")) {
                        throw error("Header-Zelle muss immer mit <td anfangen!", column.id, curHeader);
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
                            throw error("Zelleneintrag muss immer mit <td anfangen!", column.id, columnResult);
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
                                td.style.backgroundColor = "#606060";
                                td.colSpan = 100;
                                tr.append(td);
                                const table = document.createElement("table");
                                table.style.width = "100%";
                                td.append(table);
                                util.addNode(line.parentElement, tr, myIndex + 1);

                                statResult.actions.forEach(action => {
                                    table.innerHTML += action.src;
                                })
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
                this.statView.result = SearchEngine.StatSearch(this.statView.query, this.levelDatas);

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
                infoHeader.innerHTML += "<a target='_blank' href='" + Mod.forumLink + "' style='font-size:12px;color:darkgrey;' class='bbignoreColor' onmouseover=\"return wodToolTip(this, 'Hier gehts zum Foren-Post der Anwendung')\">" + Mod.version + " </a>";

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
                info.innerHTML = "<span class='bbignore' onmouseover=\"return wodToolTip(this,'" + infoTipp.replaceAll("'", "\\'").replaceAll('"', '\\"') + "');\"><img alt='' height='14px' border='0' src='/wod/css/skins/skin-8/images/icons/inf.gif'></span>";
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
                toBBCodeButton.onmouseover = function () {
                    return unsafeWindow.wodToolTip(this, 'Einfach anklicken und der BBCode wird in die Zwischenablage kopiert. Dann einfach mit Strg+V irgendwo reinkopieren.');
                }

                //toBBCodeButton.title = "Einfach anklicken und der BBCode wird in die Zwischenablage kopiert. Dann einfach mit Strg+V irgendwo reinkopieren."

                const toBBCodeDone = document.createElement("img");
                toBBCodeDone.src = "/wod/css/img/smiley/yes.png";
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
                    console.log(table);
                    navigator.clipboard.writeText(util.toBBCode(table));
                }

                this.anchor.appendChild(table);
                if (this.statView.query.side && this.statView.query.type) {
                    const statView = this.statView;
                    console.log("StatView", statView, Mod.thisLevelDatas);
                    if (!statView.result) {
                        tbody.innerHTML = "<td>Es konnte kein Ergebnis ermittelt werden!";
                        return;
                    }
                    Viewer.TableViewRenderer.renderColumnTable(tbody, new Viewer.TableViewAngriffVerteidigung(statView), statView);
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
                const yesButton = util.createImgButton("20px", "/wod/css/img/smiley/yes.png", function () {
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

            getFilterDisplayLabel(queryFilter) {
                var result = queryFilter.spec;
                for (const [filter, filterName] of Object.entries(QueryModel.FilterTypes)) {
                    result = result.replaceAll(filter, filterName);
                }
                result = result.replaceAll("_", "-").replaceAll("enemy", "Gegner");
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
                typeElement.style.cursor = "pointer";
                if (query.type === "attack") {
                    typeElement.innerHTML = "Angriff";
                } else {
                    typeElement.innerHTML = "Verteidigung";
                }
                typeElement.onclick = function () {
                    if (query.type === "attack") {
                        query.type = "defense";
                    } else {
                        query.type = "attack";
                    }
                    thisObject.refresh();
                }
                th.append(typeElement);
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
                        const containerElement = document.createElement("span");
                        containerElement.style.whiteSpace = "nowrap";
                        const labelElement = document.createElement("a");
                        const selectInput = document.createElement("select");
                        const allPossibleSelections = thisObject.getSelectionsFor(curQueryFilter, curStatResult);
                        curStatResult.forEach(stat => {
                            if (stat.sub) {
                                Object.values(stat.sub).forEach(nextSub => {
                                    nextStatResult.push(nextSub);
                                });
                            }
                        });
                        var selectOptions = "<option value=''></option>";
                        if (allPossibleSelections && allPossibleSelections.length > 0) {
                            selectOptions += "<option value='" + filterEinschraenken + "'>" + filterEinschraenken + "</option>";
                        }
                        for (const [filterSpec, filterName] of Object.entries(QueryModel.FilterTypes)) {
                            if (filterSpec === curQueryFilter.spec || !util.arraySearch(query.filter, qFilter => qFilter.spec === filterSpec)) {
                                selectOptions += "<option value='" + filterSpec + "'>" + filterName + "</option>"
                            }
                        }

                        selectInput.innerHTML = selectOptions;
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
                        selectInput.style.cursor = "pointer";

                        containerElement.append(selectInput);
                        containerElement.append(labelElement);
                        containerElement.style.position = "relative";
                        selectInput.style.width = "100%";
                        selectInput.style.position = "absolute";
                        selectInput.style.left = "0px";
                        selectInput.style.opacity = 0.0;
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
                        labelElement.href = "javascript:";
                        labelElement.innerHTML = thisObject.getFilterDisplayLabel(curQueryFilter);

                        filterBar.append(containerElement);
                    }
                }
                th.append(util.span(" "));

                // Add-Filter-Bar
                const addAnchor = document.createElement("span");
                addAnchor.style.position = "relative";
                const addElement = document.createElement("img");
                const selectInput = document.createElement("select");
                selectInput.style.width = "100%";
                selectInput.style.position = "absolute";
                selectInput.style.left = "0px";
                selectInput.style.opacity = 0.0;

                function createAddOptions() {
                    var result = "<option value=''></option>";
                    for (const [filterSpec, filterName] of Object.entries(QueryModel.FilterTypes)) {
                        if (!util.arraySearch(query.filter, qFilter => qFilter.spec === filterSpec)) {
                            result += "<option value='" + filterSpec + "'>" + filterName + "</option>";
                        }
                    }
                    return result;
                }

                selectInput.onchange = function (a) {
                    if (selectInput.value !== "") {
                        query.filter.push(new QueryModel.QueryFilter(selectInput.value));
                    }
                    thisObject.refresh();
                }
                selectInput.innerHTML = createAddOptions();
                selectInput.style.cursor = "pointer";

                addAnchor.append(addElement);
                addAnchor.append(selectInput);
                addElement.src = "/wod/css//skins/skin-8/images/icons/steigern_enabled.gif";
                addElement.style.height = "16px";
                addElement.style.cursor = "pointer";
                addElement.classList.add("bbignore");

                th.append(addAnchor);

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
        //  testet, ob wir uns auf der Berichtseite befinden   *
        static istSeite_Kampfbericht() {
            var result = false;
            var heading = document.getElementsByTagName("h1")[0];
            var text = heading.firstChild.data;

            if (text.indexOf("Kampfbericht:") !== -1) result = true;
            //console.log("Kampfbericht-Seite");

            return result;
        }

        //  testet, ob wir uns auf der Statistik-Seite befinden   *
        static istSeite_Kampfstatistik() {
            var result = false;
            var heading = document.getElementsByTagName("h1")[0];
            var text = heading.firstChild.data;

            if (text.indexOf("Kampfstatistik") !== -1) result = true;
            //console.log("Kampfstatistik-Seite");

            return result;
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

    class Storage {
        // feste Punkte im Storage die auf andere IDs im Storage verweisen
        static data = null;
        static reportIds = null;

        // Die einzige Methode mit GM.setValue, merkt sich die Ids in einem festen Ankerpunkt im Storage
        // id => data wird direkt auf den Root des GM-Storages geschrieben.
        // Die id wird sich unter einer Map unter der referenceMapId gespeichert.
        // So können Daten direkt und schnell ohne großen Overhead direkt abgerufen werden, aber wir haben
        // dennoch weiterhin einen Überblick über alle IDs über die entsprechenden Anker-Kontexte.
        // wenn 'data' undefined ist, wird das Objekt unter der zugehörigen ID gelöscht.
        static async storeData(referenceMapId, id, data, metaData) {
            if (!metaData) metaData = true;
            var thisData = this[referenceMapId];
            if (!thisData) {
                thisData = await GM.getValue(referenceMapId, {});
                if (!thisData) thisData = {};
                this[referenceMapId] = thisData;
            }
            if (data) {
                thisData[id] = metaData;
                await GM.setValue(referenceMapId, thisData);
            } else { // delete
                if (thisData[id]) {
                    delete thisData[id];
                    await GM.setValue(referenceMapId, thisData);
                }
            }
            await GM.setValue(id, data);
        }

        static async gmSetValue(id, data) {
            await this.storeData("data", id, data);
        }

        static async gmSetReport(id, report) {
            await this.storeData("reportIds", id, report, report ? report.metaData : null);
        }

        static async gmGetReport(id) {
            const result = await GM.getValue(id);
            if (!result) return {};
            // Nicht die aktuell verwendete Report-Version entdeckt => Der Report wird verworfen.
            if (!result.metaData || !result.metaData.dataVersion || result.metaData.dataVersion !== Mod.currentReportDataVersion) {
                console.log("Report enthält alte Daten und wird verworfen", result);
                await this.gmSetReport(id); // delete
                return {};
            }
            return result;
        }

        static async validateAllReports() {
            if (!this.reportIds) this.reportIds = await GM.getValue("reportIds", {});
            var somethingDeleted = false;
            var compareDate = new Date();
            compareDate.setDate(compareDate.getDate() - 30);
            for (const [reportId, metaData] of Object.entries(this.reportIds)) {
                if (metaData.dataVersion !== Mod.currentReportDataVersion || metaData.time && metaData.time < compareDate.getTime()) {
                    console.log("Report veraltet und wird verworfen", reportId);
                    delete this.reportIds[reportId];
                    await this.gmSetReport(reportId);
                    somethingDeleted = true;
                }
            }
            if (somethingDeleted) await this.gmSetValue("reportIds", this.allReports);
        }

        static async loadThisReport(reportId) {
            const storeId = "report_" + reportId;
            const result = await this.gmGetReport(storeId);
            Mod.thisReport = result;
            //console.log("Loaded report", result);
        }

        static async saveThisReport() {
            const storeId = "report_" + Mod.thisReport.id;
            Mod.thisReport.metaData = {
                dataVersion: Mod.currentReportDataVersion,
                time: new Date().getTime()
            };
            console.log("Saved report: ", storeId, Mod.thisReport);
            await this.gmSetReport(storeId, Mod.thisReport);
            //console.log("Stored report", thisReport);
        }

    }

    class util {
        static arrayMap(list, fn) {
            var result = Array();
            for(var i=0,l=list.length;i<l;i++) {
                result.push(fn(list[i]));
            }
            return result;
        }

        static addNode(parent, element, index) {
            if (!(index > -1) || index >= parent.children.length) parent.append(element);
            parent.insertBefore(element, parent.children[index]);
        }

        static getMyIndex(element) {
            return Array.prototype.indexOf.call(element.parentElement.children, element);
        }

        static arraySearch(array, predicate) {
            for(var i=0,l=array.length;i<l;i++) {
                const cur = array[i];
                if(predicate(cur)) return cur;
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
            for(var i=0,l=hrefs.length;i<l;i++) {
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

        static createCollapsible(height, initialCollapsed, fnCallback) {
            const collapsible = document.createElement("img");
            collapsible.style.height = height;
            collapsible.style.cursor = "pointer";
            collapsible.classList.add("bbignore");
            var collapsed = initialCollapsed;
            function updateCollapserSrc() {
                if(collapsed) {
                    collapsible.src = "/wod/css/skins/skin-8/images/page/navigate_right.png"
                } else {
                    collapsible.src = "/wod/css/skins/skin-8/images/page/navigate_down.png";
                }
            }
            updateCollapserSrc();
            collapsible.onclick = function() {
                collapsed = !collapsed;
                updateCollapserSrc();
                Mod.runSave(function () {
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

        static hatClassName(node, className) {
            return node.classList && node.classList.contains(className);
        }

        static toBBCode(node) {
            if (node.classList && node.classList.contains("bbignore")) return "";
            var result = this.toBBCodeRaw(node);
            if (result.length !== 3) {
                console.log("Keine Array-Länge von 3 zurückgegeben", node);
            }
            if (node.style && node.style.textAlign === "center") {
                result[0] = result[0] + "[center]";
                result[2] = "[/center]" + result[2];
            }
            if (node.style && node.style.color && !this.hatClassName(node, "bbignoreColor")) {
                result[0] = result[0] + "[color=" + node.style.color + "]";
                result[2] = "[/color]" + result[2];
            }
            return result.join("");
        }

        static toBBCodeRaw(node) {
            switch (node.tagName) {
                case "TABLE":
                    return ["[table" + (node.border ? " border=" + node.border : "") + "]", this.toBBCodeArray(node.childNodes), "[/table]"];
                case "TR":
                    return ["[tr]", this.toBBCodeArray(node.childNodes), "[/tr]"];
                case "TD":
                    if (node.colSpan > 1) {
                        return ["[td colspan=" + node.colSpan + "]", this.toBBCodeArray(node.childNodes), "[/td]"];
                    }
                    return ["[td]", this.toBBCodeArray(node.childNodes), "[/td]"];
                case "TH":
                    if (node.colSpan > 1) {
                        return ["[th colspan=" + node.colSpan + "]", this.toBBCodeArray(node.childNodes), "[/th]"];
                    }
                    return ["[th]", this.toBBCodeArray(node.childNodes), "[/th]"];
                case "SPAN":
                    return ["", this.toBBCodeArray(node.childNodes), ""];
                case "IMG":
                    return ["[img]", node.src, "[/img]"];
                case "SELECT":
                    return ["", "", ""];
                case "A":
                    if (node.href.startsWith("http")) {
                        if (node.classList.contains("rep_monster")) {
                            return ["", "[beast:" + decodeURIComponent(node.href.match(/\/npc\/(.*?)&/)[1].replaceAll("+", " ")) + "]", ""];
                        } else {
                            return ["[url=" + node.href + "]", this.toBBCodeArray(node.childNodes), "[/url]"];
                        }
                    }
                    return ["", this.toBBCodeArray(node.childNodes), ""];
                case "THEAD":
                case "TBODY": // ignore it
                    return ["", this.toBBCodeArray(node.childNodes), ""];
                case "BR":
                    return ["", "\n", ""];
                default:
                    if (typeof node.tagName === 'undefined') {
                        return ["", node.textContent, ""];
                    } else {
                        console.error("Unbekannter TagName gefunden: '" + node.tagName + "'");
                    }
            }
        }

        static toBBCodeArray(childNodes) {
            return this.arrayMap(childNodes, a => this.toBBCode(a)).join("");
        }
    }

    function error(errorMsg, ...additionals) {
        const error = new Error(errorMsg);
        error.additionals = additionals;
        return error;
    }

    Mod.startMod();

})();