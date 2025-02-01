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
    const BBCodeExporter = demawiRepository.import("BBCodeExporter");

    class Mod {
        static dbname = "wodDB";
        static version = "0.20";
        static stand = "01.02.2025";
        static forumLink = "/wod/spiel/forum/viewtopic.php?pid=16698430";
        static currentReportDataVersion = 7;

        static thisReport;
        static thisLevelDatas; // Array der Level über welche die Auswertung gefahren wird
        static outputAnchor;
        static runSave;

        // Einstiegspunkt der Anwendung
        static async startMod(kampfbericht, kampfstatistik) {
            let thisObject = this;
            console.log("startMod: Statistiklsd", kampfbericht, kampfstatistik)
            unsafeWindow.statExecuter = this.startMod;
            if (kampfbericht || WoD.istSeite_Kampfbericht()) { // Einzelseite
                Mod.outputAnchor = Mod.createOutputAnchor();
                Mod.runSave(async function () {
                    // cur_rep_id für Dungeons, report bei Schlachten
                    const reportId = WoD.getReportId();
                    thisObject.thisReport = await MyStorage.getReportDB().getValue(reportId);
                    console.log("ReportId: ", reportId, thisObject.thisReport);

                    var levelData = ReportParser.readKampfberichtAndStoreIntoReport(document, thisObject.thisReport, reportId);
                    if (levelData) {
                        var roundCount = levelData.roundCount;

                        var hinweisText = ": " + roundCount + " Runden";
                        if (levelData.areas.length > 0) {
                            hinweisText += " [" + util.arrayMap(levelData.areas, area => area.rounds.length).join(", ") + "]";
                        }
                        const reportProgress = Mod.getReportProgress();
                        if (reportProgress.missingReports.length > 0) {
                            hinweisText += ". Es fehlen noch die Reports für folgende Level: " + reportProgress.missingReports.join(", ") + " (Bitte entsprechende Level aufrufen)";
                        }
                        Mod.outputAnchor.setTitle(hinweisText);
                        Mod.thisLevelDatas = [levelData];
                        await MyStorage.getReportDB().setValue(thisObject.thisReport);
                    }
                });
            }
            if (kampfstatistik || WoD.istSeite_Kampfstatistik()) { // Übersichtsseite
                Mod.outputAnchor = Mod.createOutputAnchor();
                Mod.runSave(async function () {
                    const reportId = WoD.getReportId();
                    thisObject.thisReport = await MyStorage.getReportDB().getValue(reportId);

                    console.log("ReportId: ", reportId, thisObject.thisReport);

                    if (thisObject.thisReport.levelCount) {
                        const reportProgress = Mod.getReportProgress();

                        var hinweisText = ": " + reportProgress.roundCount + " Runden (" + reportProgress.allRoundNumbers.join(", ") + ")";
                        if (reportProgress.foundReportCount < reportProgress.levelCount) {
                            hinweisText += ". Es fehlen noch die Reports für folgende Level: " + reportProgress.missingReports.join(", ") + " (Bitte entsprechende Level aufrufen)";
                        }
                        Mod.outputAnchor.setTitle(hinweisText);
                        Mod.thisLevelDatas = thisObject.thisReport.levelDatas;
                    } else {
                        Mod.outputAnchor.setTitle(": Es fehlen noch alle Level-Reports!" + " (Bitte entsprechende Level aufrufen)")
                    }
                    MyStorage.validateAllReports(); // no await
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
                        levelDataArray[0].areas[0].rounds[0].helden.forEach(held => {
                            subDomainEntry[held.id.name] = this.createStat();
                        });
                    } else if (typeInitialize === "position") {
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
                unit.id.id = unit.id.name + "_" + (unit.index || 1) + "_" + action.level.nr + "_" + action.area.nr;
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
                            fromMe: curSettings.fromMe && ReportParser.isUnitEqual(statTarget.unit, curAction.unit),
                            atMe: curSettings.atMe && !!util.arraySearch(curAction.targets, target => ReportParser.isUnitEqual(target.unit, statTarget.unit)),
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
                    return SearchEngine.getStat(curStats, queryFilter, statTarget.unit.position, "sub", "position");
                }
            },
            "enemy_position": {
                name: "Gegner-Position",
                apply: (statRoot, curStats, queryFilter, action, target, statTarget) => {
                    return SearchEngine.getStat(curStats, queryFilter, statTarget.unit.position, "sub", "position");
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
                    if (ReportParser.isUnitEqual(unit, action.unit)) {
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
                    if (ReportParser.isUnitEqual(unit, action.unit)) {
                        subStats.actionUnit = unit;
                    }
                    return subStats;
                }
            },
            "skillType": {
                name: "AngriffsTyp",
                apply: (statRoot, curStats, queryFilter, action, target, statTarget) => {
                    return SearchEngine.getStat(curStats, queryFilter, statTarget.fertigkeit.type, "sub", "skillType");
                }
            },
            "skill": {
                name: "Fertigkeit",
                apply: (statRoot, curStats, queryFilter, action, target, statTarget) => {
                    if (!statTarget || !statTarget.fertigkeit) return;
                    if (statRoot.wantHeroes !== statTarget.unit.id.isHero) return;
                    let subStats = SearchEngine.getStat(curStats, queryFilter, statTarget.fertigkeit.name, "sub", "skill");
                    subStats.title = statTarget.fertigkeit.typeRef;
                    return subStats;
                }
            },
            "skill_active": {
                name: "Fertigkeit(Aktiv)",
                apply: (statRoot, curStats, queryFilter, action, target, statTarget) => {
                    if (!statTarget || !statTarget.fertigkeit) return;
                    if (statRoot.wantHeroes !== statTarget.unit.id.isHero) return;
                    console.log("isso", action, curStats.actionClassification(action));
                    if (!curStats.actionClassification(action).fromMe) return;
                    let subStats = SearchEngine.getStat(curStats, queryFilter, statTarget.fertigkeit.name, "sub", "skill");
                    if (!subStats) return;
                    subStats.title = statTarget.fertigkeit.typeRef;
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
                    let subStats = SearchEngine.getStat(curStats, queryFilter, util.arrayMap(statTarget.fertigkeit.items, a => a.name).join(", "), "sub", "items");
                    if (!subStats) return false;
                    subStats.title = util.arrayMap(statTarget.fertigkeit.items, a => a.srcRef).join(", ");
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
                        throw error("StatQuery-Filter ist nicht valide: '" + queryFilter.spec + "'");
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
                    if (curFilter.startsWith("skillType") || curFilter.startsWith("skill")) { // attackType und skill sind immer auf der aktiven Unit
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
                                    stats.actionClassification = function (curAction) {
                                        return {
                                            fromMe: wantHeroes && curAction.unit.id.isHero,
                                            atMe: wantHeroes && curAction.unit.id.isHero,
                                            fromGroup: wantHeroes && curAction.unit.id.isHero,
                                            atGroup: wantHeroes && curAction.unit.id.isHero,
                                        }
                                    }
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
                                        if (target.type !== "Angriff") { // Es wurde eine Verteidigungs-Probe gewürfelt
                                            return;
                                        }
                                    }
                                    SearchEngine.addUnitId(action, target.unit);
                                    stats.actionClassification = function (curAction) {
                                        return {
                                            fromMe: wantHeroes === curAction.unit.id.isHero,
                                            atMe: wantHeroes === !!util.arraySearch(curAction.targets, target => target.unit.id.isHero === wantHeroes),
                                            fromGroup: wantHeroes === curAction.unit.id.isHero,
                                            atGroup: wantHeroes === !!util.arraySearch(action.targets, target => ReportParser.isUnitEqual(curAction.unit, target.unit)),
                                        }
                                    }

                                    var damages = target.damage; // nur bei "true" wird die action auch gezählt
                                    if (damages.length === 0) damages = [true];
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
            skill: "Fertigkeit",
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
                skill: "Fertigkeit",
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

    // Liest den Kampfbericht ein und erstellt die Datenstruktur auf der Anfragen gestellt werden können.
    // Grobe Struktur: Report -> Level -> Kampf -> (Vor-)Runde -> Aktion -> Ziel -> Auswirkung
    class ReportParser {
        static currentRound;

        static isUnitEqual(unit1, unit2) {
            return unit1.id.name === unit2.id.name;
        }

        static readKampfberichtAndStoreIntoReport(container, report, reportId) {
            var levelNr;
            var levelCount;
            console.log("Reporting", reportId, report);
            if (reportId.startsWith("schlacht_")) {
                levelNr = 1;
                report.levelCount = 1;
            } else { // Dungeon
                levelNr = container.getElementsByName("current_level")[0].value;
                let navigationBar = container.getElementsByClassName("navigation levels")[0];
                if (navigationBar) {
                    report.levelCount = navigationBar.children.length - 1;
                }
            }
            const levelData = this.readKampfbericht(container);
            report.id = reportId;
            if (!report.levelDatas) {
                report.levelDatas = [];
            }
            report.levelDatas[levelNr - 1] = levelData;
            return levelData;
        }

        static readKampfbericht(container) {
            var contentTables = container.getElementsByClassName("content_table");

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

            actions; // aufgeteilt in vorrunde, regen, initiative, runde
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
                if (!this.helden) this.emptyRound(); // keine kampfbereiten Helden, keine Aktionen
                this.monster = ReportParser.GruppenStatus(statusTables[1], false);
                if (!this.monster) this.emptyRound(); // keine kampfbereiten Gegner, keine Aktionen
                var initiative = Array();
                var vorrunde = Array();
                var regen = Array();
                var runde = Array();
                let actionsElement = roundTD.getElementsByTagName("table")[2].querySelectorAll("tr");
                for (var k = 0, kl = actionsElement.length; k < kl; k++) {
                    var currentAction = actionsElement[k]; // Round-Action-TR
                    if (currentAction.children.length === 1) { // <hr>
                        // nothing to do
                    } else if (currentAction.children.length === 2) { // Flucht z.B. "ist ein Feigling und flieht wegen Hitpointverlusts." oder "kann nichts tun", oder Regen/Initiative
                        // currently nothing to do
                        let td = currentAction.children[1];
                        if (td.childNodes.length === 1) {
                            // einfache Beschreibung ohne Einheit-Verlinkung: Der Düsterwolf scheint noch etwas träge, offenbar muss er sich erst noch sammeln.
                        } else {
                            if (td.textContent.startsWith("Das Yeti-Kind")) continue; // z.B. Urlaub in den Bergen
                            let unit = td.childNodes[0];
                            if (unit.tagName === "SPAN") {
                                unit = unit.children[0];
                            }
                            if (unit.tagName === "A") { // regen oder initiative
                                let text = td.childNodes[1].textContent;
                                if (text.includes("wirkt")) { // Initiative

                                } else { // Regen

                                }
                            } else {
                                console.error("Aktion nicht zuweisbar ", td);
                                // if (typeof testEnvironment !== "undefined") window.alert("Aktion nicht zuweisbar! " + td.textContent);
                            }
                        }
                    } else { // length == 3. Vorrunden- (ohne Initiative) oder Runden-Aktion (mit Initiative)
                        if (currentAction.children[0].innerHTML + "" === "&nbsp;") { // Vorrunden-Aktion
                            ReportParser.Action(currentAction, null, currentAction.children[1], currentAction.children[2]).forEach(a => vorrunde.push(a));
                        } else { // Runden-Aktion
                            ReportParser.Action(currentAction, currentAction.children[0], currentAction.children[1], currentAction.children[2]).forEach(a => {
                                runde.push(a)
                            });
                        }
                    }
                }
                this.actions = {
                    initiative: initiative,
                    vorrunde: vorrunde,
                    regen: regen,
                    runde: runde,
                };
            }

            emptyRound() {
                return {
                    initiative: Array(),
                    vorrunde: Array(),
                    regen: Array(),
                    runde: Array(),
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
                } else if (this.unitNameOhneGestalt(curUnit.id.name) === this.unitNameOhneGestalt(unitId.name) && curUnit.id.index === unitId.index) { // evtl. Gestaltwechsel!? z.B. "Dunkles Erwachen"
                    return curUnit;
                }
            }
        }

        static unitNameOhneGestalt(unitName) {
            let matches = unitName.match(/\((.*gestalt)\)/);
            if (matches) {
                return unitName.replace(" (" + matches[1] + ")", "");
            }
            return unitName;
        }

        //im Target kann auch "sich" stehen, das wird dann entsprechend durch die zusätzliche Angabe "unitId" ersetzt.
        static getUnitIdFromElement(element, unitId) {
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
            else if (stringLine.includes("Arkaner Schaden"))
                return "Arkan";
            console.error("DamageType kann nicht bestimmt werden: " + stringLine);
            return "???";
        }

        static Damage(damageLineElement) {
            var resistenz = 0;
            let damage;
            const stringLine = damageLineElement.textContent;
            var matching = stringLine.match(/^(\d*) \[\+(\d*)\]/);
            if (matching) {
                damage = {
                    value: Number(matching[1]),
                    ruestung: Number(matching[2]),
                    resistenz: resistenz,
                    type: this.getDamageType(stringLine),
                }
            } else {
                matching = stringLine.match(/^(\d*)/);
                if (matching) {
                    damage = {
                        value: Number(matching[1]),
                        ruestung: 0,
                        resistenz: resistenz,
                        type: this.getDamageType(stringLine),
                    }
                }
            }
            if (!damage) {
                console.error("Es kann kein Schaden ermittelt werden: " + stringLine);
                return;
            }
            if (damageLineElement.tagName === "SPAN") { // hat Anfälligkeit
                //console.log("Anfälligkeit gefunden "+damageLineElement.textContent);
                const dmgVorher = damageLineElement.onmouseover.toString().match(/verursacht: <b>(\d*)<\/b>/)[1];
                const dmgNachher = damageLineElement.onmouseover.toString().match(/Anfälligkeit.* <b>(\d*)<\/b>/)[1];
                damage.resistenz = Number(dmgVorher) - Number(dmgNachher) - damage.ruestung;
            }
            return damage;
        }

        static actionParse(actionElement) {
            const fertigkeit = {};
            const childNodes = actionElement.childNodes;
            const items = Array();
            var unit;
            const wuerfe = Array();
            util.forEach(actionElement.childNodes, curNode => {
                    switch (curNode.tagName) {
                        case "IMG":
                            // z.B. Veredelungen => ignore
                            break;
                        case "A":
                            if (curNode.href.includes("/hero/") || curNode.href.includes("/npc/")) {
                                unit = this.unitLookup(this.getUnitIdFromElement(curNode));
                            } else if (curNode.href.includes("/skill/")) {
                                fertigkeit.name = curNode.textContent.trim();
                                fertigkeit.typeRef = curNode.outerHTML;
                                fertigkeit.wirkungen = this.getWirkungenFromElement(curNode);
                            } else if (curNode.href.includes("/item/")) {
                                items.push({
                                    name: curNode.textContent.trim(),
                                    srcRef: curNode.outerHTML,
                                    wirkungen: this.getWirkungenFromElement(curNode),
                                });
                            } else {
                                console.error("Unbekanntes A-Element in Action!", curNode.textContent, curNode);
                                throw Error("Unbekanntes A-Element in Action!");
                            }
                            break;
                        case "SPAN":
                            if (curNode.style.fontSize === "0.65em") {
                                //unitIdx = curNode.textContent;
                            } else if (curNode.className === "rep_mana_cost") {
                                fertigkeit.mp = curNode.textContent.match(/(\d*) MP/)[1];
                            } else if (curNode.className === "rep_gain") { // z.B. "Dunkles Erwachen"
                                let mpGain = curNode.textContent.match(/\.(\d*) MP/);
                                if (mpGain) {
                                    fertigkeit.mpGain = mpGain[1];
                                } else {
                                    let hpGain = curNode.textContent.match(/\.(\d*) HP/);
                                    if (hpGain) {
                                        fertigkeit.hpGain = hpGain[1];
                                    } else {
                                        error("Rep_Gain kann nicht aufgelöst werden", curNode.textContent);
                                    }
                                }

                            } else if (curNode.onmouseover && curNode.children[0].tagName === "A") { // Unit-Wrap z.B. für Helfer
                                unit = this.unitLookup(this.getUnitIdFromElement(curNode.children[0]));
                            } else {
                                console.error("Unbekanntes SPAN-Element in Action!", curNode);
                                throw Error("Unbekanntes SPAN-Element in Action!");
                            }
                            break;
                        case "":
                        case undefined: {
                            let text = curNode.textContent.trim();
                            if (!unit) {
                                // only flavour text without unit reference
                                unit = {
                                    name: "? Ereignis",
                                    id: {
                                        name: "? Ereignis",
                                    },
                                    isHero: false,
                                    isEreignis: true,
                                }
                                fertigkeit.unit = unit;
                            }
                            if (text.length < 2) break; // skip

                            const textArray = text.trim().split("/");
                            textArray.forEach(curText => {
                                curText = curText.trim();
                                let wurfMatcher = curText.match(/^(\D*)?(\d+)[\.\)]?$/);
                                if (curText.startsWith("ballert in die Menge") || curText.startsWith("wirft einen Stuhl") || curText.startsWith("schleudert einen Stuhl")) { // z.B. "Dunkles Erwachen"
                                    fertigkeit.type = "Fernkampf";
                                } else if (curText.startsWith("zieht euch eins mit dem abgebrochenen Tischbein drüber") || curText.startsWith("haut daneben und erwischt fast einen Kollegen") || curText.startsWith("beißt mit ihren spitzen Zähnen zu und saugt von eurem Blut")) { // z.B. "Dunkles Erwachen"
                                    fertigkeit.type = "Nahkampf";
                                } else if (curText.startsWith("Der Boden ist nass und glitschig") // z.B. "Rückkehr zum Zeughaus"
                                    || curText.startsWith("aus, sie dörrt Körper und Geist aus und lässt euch geschwächt zurück.") // Goldene Dracheneier
                                ) {
                                    fertigkeit.type = "Naturgewalt";
                                } else if (curText.startsWith("auf sein Ziel und brüllt mit harter Stimme: DU gehörst mir!") || curText.startsWith("deutet mit seiner Waffe auf einen Gegner und brüllt mit harter Stimme: DU gehörst mir!") // "Sagenumwobener Zwergenstieg"
                                    || curText.startsWith("sind einfach überall!") || curText.startsWith("euch all eurer Kräfte.") // Goldene Dracheneier
                                ) {
                                    fertigkeit.type = "Sozial";
                                    if(curText.startsWith("sind einfach überall!")) {
                                        wuerfe.push({
                                            value: 40,
                                        })
                                    }
                                }
                                if (wurfMatcher) { // wurf
                                    let wo = wurfMatcher[1];
                                    if (wo && wo.endsWith(":")) {
                                        wo = wo.replace(":", "").trim();
                                    }
                                    wuerfe.push({
                                        value: wurfMatcher[2],
                                        dest: wo,
                                    })
                                } else if (!fertigkeit.type) {
                                    curText = curText.replace("(", "").replace(")", "").trim();
                                    switch (curText) {
                                        case "auf":
                                        case "":
                                        case "Das": // z.B. "Urlaub in den Bergen"
                                        case "Der": // "Sagenumwobener Zwergenstieg"
                                        case "mit seiner Waffe deutet": // "Sagenumwobener Zwergenstieg"
                                        case "geht von": // Goldene Dracheneier
                                        case "Mit seinem": // Goldene Dracheneier
                                        case "entreißt": // Goldene Dracheneier
                                            break;
                                        case "ruft voller Schmerzen um Hilfe...": // z.B. Dungeon "Urlaub in den Bergen"
                                        case "hält sein Opfer fest gefangen und verursacht tiefe Wunden...": // z.B. Dungeon "Urlaub in den Bergen" (verursacht wohl Schaden)
                                        case "befindet sich in eurer Gefangenschaft - er wird kontrolliert von:": // z.B. Dungeon "Katz und Maus"
                                        case "wird getragen von": // z.B. Weißzahnturm Lvl4 wirkt auf 2 Charaktere
                                        // Debuff: "Den Alchemisten tragen"
                                        case "wirkt":
                                            fertigkeit.type = "Wirkung";
                                            break;
                                        case "heilt mittels":
                                            fertigkeit.type = "Heilung";
                                            break;
                                        case "greift per Fernkampf an":
                                            fertigkeit.type = "Fernkampf";
                                            break;
                                        case "greift im Nahkampf an":
                                            fertigkeit.type = "Nahkampf";
                                            break;
                                        case "greift magisch an":
                                            fertigkeit.type = "Zauber";
                                            break;
                                        case "greift sozial an":
                                            fertigkeit.type = "Sozial";
                                            break;
                                        case "greift hinterhältig an":
                                            fertigkeit.type = "Hinterhalt";
                                            break;
                                        case "verseucht":
                                            fertigkeit.type = "Krankheit";
                                            break;
                                        case "entschärft":
                                            fertigkeit.type = "Falle entschärfen";
                                            break;
                                        case "wirkt als Naturgewalt auf":
                                            fertigkeit.type = "Naturgewalt";
                                            break;
                                        case "wird ausgelöst auf":
                                            fertigkeit.type = "Falle";
                                            break;
                                        case "erwirkt eine Explosion gegen":
                                            fertigkeit.type = "Explosion";
                                            break;
                                        case "ruft herbei mittels":
                                            fertigkeit.type = "Herbeirufung";
                                            break;
                                        default:
                                            console.error("Unbekannter Fertigkeits-Typ(1) ", "'" + curText + "'", actionElement);
                                            throw Error("Unbekannter Fertigkeits-Typ!(1)");
                                            break;
                                    }
                                }
                            });

                            break;
                        }
                        default:
                            console.error("Unbekannter Tag '" + curNode.tagName + "' Element in Action!", curNode);
                            throw Error("Unbekannter Tag '" + curNode.tagName + "' Element in Action!");
                            break;
                    }
                }
            )
            fertigkeit.items = items;
            if (!fertigkeit.type) {
                switch (fertigkeit.name) {
                    case "Stinkt gewaltig": // z.B. Manufaktur im verlassenden Tal
                        fertigkeit.type = "Krankheit";
                        break;
                    default:
                        console.error("Unbekannter Fertigkeits-Typ(2)", fertigkeit, actionElement);
                        fertigkeit.type = "Unbekannt: " + fertigkeit.name;
                        error("Unbekannter Fertigkeits-Typ", fertigkeit, actionElement);
                        break;
                }
            }
            const fertigkeiten = Array();
            if (wuerfe.length <= 1) {
                fertigkeit.wurf = wuerfe[0];
                fertigkeiten.push(fertigkeit);
            } else {
                wuerfe.forEach(wurf => {
                    const temp = util.cloneObject(fertigkeit);
                    temp.wurf = wurf;
                    fertigkeiten.push(temp);
                })
            }
            return [fertigkeiten, unit];
        }

        static Action(actionTR, initiative, action, target) {
            var actionText = action.innerText;
            var who;
            var wurf;
            var mp;
            const [fertigkeiten, unit] = this.actionParse(action);
            // Parse Targets
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

            // Action
            const actions = Array();
            var myAction = {
                name: unit.id.name, // nur fürs Testen
                unit: unit,
                targets: targets,
                src: actionTR.outerHTML,
            };
            if (fertigkeiten.length === 1) {
                myAction.fertigkeit = fertigkeiten[0];
                actions.push(myAction);
            } else {
                fertigkeiten.forEach(fertigkeit => {
                    const temp = util.cloneObject(myAction);
                    temp.fertigkeit = fertigkeiten[0];
                    actions.push(temp);
                });
            }
            return actions;
        }

        static searchWirkungen(parentElement, name) {
            var result;
            const hrefs = parentElement.getElementsByTagName("a");
            for (var i = 0, l = hrefs.length; i < l; i++) {
                const href = hrefs[i];
                if (href.innerText === name) {
                    if (href.onmouseover) {
                        result = this.getWirkungenFromElement(href);
                    }
                    break;
                }
            }
            return result;
        }

        /**
         * Die Dauer wird nicht angezeigt, diese müsste durch die Boni in Verbindung mit der/des angewandten Fertigkeit/Gegenstand aufgelöst werden
         * @param href Fertigkeit oder Gegenstands-Element
         * @returns {any[]}
         */
        static getWirkungenFromElement(href) {
            let result;
            if (href.onmouseover) {
                result = href.onmouseover.toString();
                result = result.substring(result.indexOf("'") + 1, result.lastIndexOf("'"));
                result = this.getWirkungenFromMouseOverString(result);
            }
            return result;
        }

        static getWirkungenFromMouseOverString(htmlString) {
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
                this.columns.push(new Column("Aktionen", center("Aktionen<br>(aktive:passive)"), stat => {
                    let activeActions = statView.query.side === "heroes" ? stat.actionsHelden : stat.actionsMonster;
                    let passiveActions = statView.query.side === "heroes" ? stat.actionsMonster : stat.actionsHelden;
                    activeActions = util.arrayFilter(activeActions, action => action.type !== "init");
                    passiveActions = util.arrayFilter(passiveActions, action => action.type !== "init");
                    return center(activeActions.length + ":" + passiveActions.length)
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

                    let heal = util.arrayFilter(actions, action => action.fertigkeit.type === "Heilung").length;
                    let wirkung = util.arrayFilter(actions, action => action.fertigkeit.type === "Wirkung").length;
                    return center((actions.length - heal - wirkung) + " / " + heal + " / " + wirkung);
                }));
                this.columns.push(new Column("Aktionsarten", center("Passiva<br>(Parade / Geheilt / Gebufft)"), stat => {
                    let actions = stat.actions;
                    actions = util.arrayFilter(actions, action => action.type !== "init");
                    actions = util.arrayFilter(actions, action => stat.actionClassification(action).atMe);
                    let heal = util.arrayFilter(actions, action => action.fertigkeit.type === "Heilung").length;
                    let wirkung = util.arrayFilter(actions, action => action.fertigkeit.type === "Wirkung").length;
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
                        target.damage.forEach(damage => {
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
                        target.damage.forEach(damage => {
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
                        if (!action.fertigkeit) {
                            console.error("Fertigkeit nicht gefunden: ", action);
                        }
                        aw.push(Number(action.fertigkeit.wurf.value));
                    });
                    return center(util.arrayAvg(aw, null, 2) + "<br>(" + util.arrayMin(aw) + " - " + util.arrayMax(aw) + ")");
                });
                const pwColumn = new Column("Paradewürfe", center("PW Ø<br>(min-max)"), dmgStat => {
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
                                    console.log(action)
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
                    navigator.clipboard.writeText(BBCodeExporter.toBBCode(table));
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

    class MyStorage {
        static adjust = function (objStore) {
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
        static indexedDb = new Storages.IndexedDb("WoDStats+", Mod.dbname);
        static reports = this.adjust(this.indexedDb.createObjectStore("reportStats", "reportId"));

        /**
         * @returns {Storages.ObjectStorage}
         */
        static getReportDB() {
            return this.reports;
        }

        static async validateAllReports() {
            return;
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

    }

    class util {
        static arrayMap(list, fn) {
            var result = Array();
            for (var i = 0, l = list.length; i < l; i++) {
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

        static cloneObject(obj) {
            return JSON.parse(JSON.stringify(obj));
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

    }

    function error(errorMsg, ...additionals) {
        const error = new Error(errorMsg);
        error.additionals = additionals;
        return error;
    }

    Mod.startMod();

})
();