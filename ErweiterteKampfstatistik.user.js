// ==UserScript==
// @name           [WoD] Erweiterte Kampfstatistik
// @namespace      demawi
// @description    Erweitert die World of Dungeons Kampfstatistiken
// @version        0.13
// @downloadURL    https://raw.githubusercontent.com/demawi/WoD-Mods/refs/heads/master/ErweiterteKampfstatistik.user.js
// @grant          GM.getValue
// @grant          GM.setValue
// @include        http*://*.world-of-dungeons.de/wod/spiel/*dungeon/report.php*
// @include        http*://*/wod/spiel/*dungeon/report.php*
// @include        http*://*.world-of-dungeons.de/*combat_report.php*
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
    const version = "0.13";
    const stand = "11.11.2024";
    const currentReportDataVersion = 2;
    var thisReport;

    // Einstiegspunkt
    async function startMod() {
        if (WOD_istSeite_Kampfbericht()) { // Einzelseite
            const reportId = document.getElementsByName("report_id[0]")[0].value;
            await storage.loadThisReport(reportId);

            var levelData = readAndStoreKampfbericht(reportId);
            if (levelData) {
                var roundCount = levelData.roundCount;

                var hinweisText = ": " + roundCount + " Runden";
                const reportProgress = getReportProgress();
                if (reportProgress.missingReports.length > 0) {
                    hinweisText += ". Es fehlen noch die Reports für folgende Level: " + reportProgress.missingReports.join(", ") + " (Bitte entsprechende Level aufrufen)";
                }
                statistikAusgabe_Level([levelData], hinweisText);
                await storage.saveThisReport();
            }

        }
        if (WOD_istSeite_Kampfstatistik()) { // Übersichtsseite
            const reportId = document.getElementsByName("report_id[0]")[0].value;
            await storage.loadThisReport(reportId);
            if (thisReport.levelCount) {
                const reportProgress = getReportProgress();

                var hinweisText = ": " + reportProgress.roundCount + " Runden (" + reportProgress.allRoundNumbers.join(", ") + ")";
                if (reportProgress.foundReportCount < reportProgress.levelCount) {
                    hinweisText += ". Es fehlen noch die Reports für folgende Level: " + reportProgress.missingReports.join(", ") + " (Bitte entsprechende Level aufrufen)";
                }
                // console.log(foundReportCount+" "+reportData.levelCount);
                statistikAusgabe_Level(reportProgress.levelDatas, hinweisText);
            } else {
                statistikAusgabe_Level(null, ": Es fehlen noch alle Level-Reports!" + " (Bitte entsprechende Level aufrufen)");
            }
            storage.validateAllReports();
        }
    }

    function getReportProgress() {
        var foundReportCount = 0;
        var missingReports = Array();
        var allRoundNumbers = Array();
        var roundCount = 0;
        var levelCount = 0;
        var levelDatas;

        if (thisReport) {
            levelCount = thisReport.levelCount;
            levelDatas = thisReport.levelDatas;

            for(var i=0,l=levelCount;i<l;i++) {
                if(levelDatas.length > i) {
                    const levelData = levelDatas[i];
                    console.log("LevelData, ", levelData);
                    if(levelData) {
                        allRoundNumbers[i] = levelData.roundCount;
                        roundCount += levelData.roundCount;
                        foundReportCount++;
                        continue;
                    }
                    allRoundNumbers[i] = "x";
                } else {
                    allRoundNumbers[i] = "x";
                }
                missingReports.push(i+1);
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

    const storage = {
        // feste Punkte im Storage die auf andere IDs im Storage verweisen
        data: null,
        reportIds: null,

        // Die einzige Methode mit GM.setValue, merkt sich die Ids in einem festen Ankerpunkt im Storage
        // id => data wird direkt auf den Root des GM-Storages geschrieben.
        // Die id wird sich unter einer Map unter der referenceMapId gespeichert.
        // So können Daten direkt und schnell ohne großen Overhead direkt abgerufen werden, aber wir haben
        // dennoch weiterhin einen Überblick über alle IDs über die entsprechenden Anker-Kontexte.
        // wenn 'data' undefined ist, wird das Objekt unter der zugehörigen ID gelöscht.
        storeData: async function (referenceMapId, id, data, metaData) {
            if (!metaData) metaData = true;
            var thisData = this[referenceMapId];
            if (!thisData) {
                thisData = await GM.getValue(referenceMapId, {});
                this[referenceMapId] = thisData;
            }
            console.log("Storage Current", referenceMapId, thisData);
            if (data) {
                if (!thisData[id]) {
                    thisData[id] = metaData;
                    await GM.setValue(referenceMapId, thisData);
                }
            } else { // delete
                if (thisData[id]) {
                    delete thisData[id];
                    await GM.setValue(referenceMapId, thisData);
                }
            }
            await GM.setValue(id, data);
        },

        gmSetValue: async function (id, data) {
            await this.storeData("data", id, data);
        },

        gmSetReport: async function (id, report) {
            await this.storeData("reportIds", id, report, report ? report.metaData : null);
        },

        gmGetReport: async function (id) {
            const result = await GM.getValue(id);
            if (!result) return {};
            // Nicht die aktuell verwendete Report-Version entdeckt => Der Report wird verworfen.
            if (!result.metaData || !result.metaData.dataVersion || result.metaData.dataVersion !== currentReportDataVersion) {
                console.log("Report enthält alte Daten und wird verworfen", result);
                await this.gmSetReport(id); // delete
                return {};
            }
            return result;
        },

        validateAllReports: async function () {
            if (!this.allReports) this.allReports = await GM.getValue("reportIds", {});
            var somethingDeleted = false;
            var compareDate = new Date();
            compareDate.setDate(compareDate.getDate() - 30);
            for (const [reportId, metaData] of Object.entries(this.allReports)) {
                if (metaData.dataVersion !== currentReportDataVersion || metaData.time && metaData.time < compareDate.getTime()) {
                    console.log("Report veraltet und wird verworfen", reportId);
                    delete this.allReports[reportId];
                    await this.gmSetReport(reportId);
                    somethingDeleted = true;
                }
            }
            if (somethingDeleted) await this.gmSetValue("reportIds", this.allReports);
        },

        loadThisReport: async function (reportId) {
            const storeId = "report_" + reportId;
            const result = await this.gmGetReport(storeId);
            thisReport = result;
            console.log("Loaded report", result);
        },

        saveThisReport: async function () {
            const storeId = "report_" + thisReport.id;
            thisReport.metaData = {
                dataVersion: currentReportDataVersion,
                time: new Date().getTime()
            };
            await this.gmSetReport(storeId, thisReport);
            console.log("Stored report", thisReport);
        },

    };

    function readAndStoreKampfbericht(reportId) {
        const levelNr = document.getElementsByName("current_level")[0].value;
        const levelData = readKampfbericht();
        thisReport.id = reportId;
        thisReport.levelCount = document.getElementsByClassName("navigation levels")[0].children.length - 1;
        if (!thisReport.levelDatas) {
            thisReport.levelDatas = [];
        }
        thisReport.levelDatas[levelNr - 1] = levelData;
        return levelData;
    }

    function readKampfbericht() {
        var contentTables = document.getElementsByClassName("content_table");

        var roundContentTable; // Suche nach dem Table der die eigentliche Runden enthält
        {
            for(var i=0,l=contentTables.length;i<l;i++) {
                var curContentTable = contentTables[i];
                if(curContentTable.getElementsByClassName("rep_status_table").length > 0) {
                    roundContentTable = curContentTable;
                }
            }
        }

        const areas = Array();
        var curAreaNr = 0;
        var curArea = Array();
        var roundCount = 0;
        if(roundContentTable) {
            var roundTRs = roundContentTable.children[0].children;
            roundCount = roundTRs.length;
            for(var i=0,l=roundTRs.length;i<l;i++) {
                const neueRunde = new Round(i + 1, roundTRs[i]);
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

    function StatSearch(statQuery, levelDataArray) {
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
        var addDmgStats = function(from, toStat) {
            toStat.value += from.value;
            toStat.ruestung += from.ruestung;
            toStat.resistenz += from.resistenz;
        };
        var getStat = function(object, queryFilter, id, subDomain, typeInitialize) {
            if(queryFilter && queryFilter.selection && !queryFilter.selection.includes(id)) return;
            var curObject = object;
            if(subDomain) {
                var subDomainEntry = object[subDomain];
                if(!subDomainEntry) {
                    subDomainEntry = {};
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
                    }
                    object[subDomain] = subDomainEntry;
                }
                curObject = subDomainEntry;
            }
            var result = curObject[id];
            if(!result) {
                result = createStat()
                curObject[id] = result;
            }
            return result;
        }
        var addTargetDmgStats = function(target, toStat, fromAction) {
            toStat.result[target.result]++;
            toStat.targets.push(target);
            if(!toStat.actions.includes(fromAction)) {
                toStat.actions.push(fromAction);
            }
            target.damage.forEach(damage => {
                addDmgStats(damage, toStat); // gesamtschaden
                addDmgStats(damage, getStat(toStat, null, damage.type, "byDmgType"));
            });
        }
        var stats = createStat();

        const wantHeroes = statQuery.side === "heroes";
        const wantOffense = statQuery.type === "attack";
        var filter = statQuery.filter; // position, attackType, fertigkeit, units
        for(var levelNr=1,levelCount=levelDataArray.length;levelNr<=levelCount;levelNr++) {
            const levelNrFinal = levelNr;
            const levelData = levelDataArray[levelNr-1];
            if(!levelData) continue;
            const areas = levelData.areas;
            for (var areaNr = 1, areaCount = areas.length; areaNr <= areaCount; areaNr++) {
                const area = areas[areaNr - 1];

                const rounds = area.rounds;
                for (var i = 0, l = rounds.length; i < l; i++) {
                    var round = rounds[i];
                    round.actions.runde.forEach(action => {
                        var isHero = action.unit.id.isHero;
                        // console.log(myStats);
                        // a. Wir wollen Helden und deren Offensive: es muss ein Held angreifen.
                        // b. Wir wollen Monster und die Defensive: es muss ein Held angreifen.
                        // c. Wir wollen Monster und die Offensive: es muss ein Monster angreifen.
                        // d. Wir wollen Helden und die Defensive: es muss ein Monster angreifen.
                        if ((wantHeroes && wantOffense && isHero) || (!wantHeroes && !wantOffense && isHero) || (!wantHeroes && wantOffense && !isHero) || (wantHeroes && !wantOffense && !isHero)) {
                            action.targets.forEach(target => {
                                if (target.type !== "Angriff") return;

                                const execFilter = function (curStats, filters) {
                                    if (!filters || filters.length === 0) {
                                        addTargetDmgStats(target, curStats, action);
                                        return true;
                                    }
                                    const queryFilter = filters[0];
                                    const curFilter = queryFilter.spec;
                                    const curFilterSelection = queryFilter.selection;
                                    var actionTarget;
                                    if (curFilter.startsWith("attackType")) { // attackType ist immer auf der aktiven Unit
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
                                        subStats.unit = actionTarget.unit;
                                        subStats.title = actionTarget.unit.typeRef;
                                        if (actionTarget.unit.id.index) {
                                            var unitCount = subStats.unitCount;
                                            if (!unitCount) {
                                                unitCount = {};
                                                subStats.unitCount = unitCount;
                                            }
                                            unitCount[actionTarget.unit.id.index] = true;
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
                                        subStats = getStat(curStats, queryFilter, levelNrFinal, "sub", "level");
                                        if (!subStats) return false;
                                        subStats.title = "Level " + levelNrFinal + "<br>(" + levelData.roundCount + " Runden)";
                                    } else if (curFilter.endsWith("items")) {
                                        subStats = getStat(curStats, queryFilter, util.arrayMap(actionTarget.fertigkeit.items, a => a.name).join(", "), "sub", "items");
                                        if (!subStats) return false;
                                        subStats.title = util.arrayMap(actionTarget.fertigkeit.items, a => a.srcRef).join(", ");
                                    } else {
                                        console.error("StatQuery-Filter ist nicht valide: '" + curFilter + "'");
                                    }
                                    subStats.filterType = curFilter;
                                    const tail = filters.slice(1);
                                    if (execFilter(subStats, tail)) {
                                        addTargetDmgStats(target, curStats, action);
                                        return true;
                                    }
                                    return false;
                                }
                                execFilter(stats, filter);

                            });
                        }
                    });
                }
            }
        }
        return stats;
    }

    function createStatisticAnchor(hinweisText) {
        // Ausgabe
        var headings = document.getElementsByTagName("h2");
        var statistic = document.createElement("div");
        statistic.hidden = true;
        var header = document.createElement("div");
        header.innerHTML = "Erweiterte Kampfstatistiken";
        if(hinweisText) {
            header.innerHTML+=""+hinweisText+"";
        }
        var firstClick = true;
        const collapsible = util.createCollapsible("20px", true, function(hide) {
            statistic.hidden = hide;
            if (firstClick) {
                firstClick = false;
                const anchor = document.createElement("div");
                statistic.appendChild(anchor);
                const initialStatView = new StatView(new StatQuery("heroes", "attack", []), true, false);
                new StatTable(initialStatView, thisReport.levelDatas, anchor);
                statistic.append(document.createElement("br"));
            }
        });
        header.append(collapsible);
        headings[0].parentNode.insertBefore(header, headings[0].nextSibling);
        headings[0].parentNode.insertBefore(statistic, header.nextSibling);
        return statistic;
    }

    const Position = [
        'Vorne',
        'Zentrum',
        'Links',
        'Rechts',
        'Hinten',
        'Im Rücken',
    ];

    var currentRound;
    class Round {
        nr;
        area;
        helden;

        // ohne Kampf sind nur Daten nicht angelegt
        actions;
        monster;
        constructor(nr, roundTD) {
            if (!currentRound) {
                this.area = 1;
            } else {
                if (roundTD.getElementsByClassName("rep_round_headline")[0] === "Runde 1") {
                    this.area = currentRound.area + 1;
                } else {
                    this.area = currentRound.area;
                }
            }
            currentRound = this;
            this.nr = nr;

            var statusTables = roundTD.getElementsByClassName("rep_status_table"); // üblicherweise sollten es immer 2 sein, nur am Ende des Kampfes dann 4
            if (statusTables.length !== 2 && statusTables.length !== 4) {
                console.error("Es wurden keine zwei StatusTable in einer Runde gefunden: "+statusTables.length);
            }
            this.helden = new GruppenStatus(statusTables[0], true);
            if(!this.helden) return; // keine kampfbereiten Helden, keine Aktionen
            this.monster = new GruppenStatus(statusTables[1], false);
            if(!this.monster) return; // keine kampfbereiten Gegner, keine Aktionen
            var vorrunde = Array();
            var runde = Array();
            var actions = util.arrayMap(roundTD.getElementsByClassName("rep_initiative"), function(a) { return a.parentElement });
            for(var k=0,kl=actions.length;k<kl;k++) {
                var currentAction = actions[k]; // Round-Action-TR
                if (currentAction.children.length === 1) { // <hr>
                    // nothing to do
                } else if (currentAction.children.length === 2) { // Flucht z.B. "ist ein Feigling und flieht wegen Hitpointverlusts." oder "kann nichts tun"
                    // currently nothing to do
                } else { // length == 3. Vorrunden- (ohne Initiative) oder Runden-Aktion (mit Initiative)
                    if (currentAction.children[0].innerHTML + "" === "&nbsp;") { // Vorrunden-Aktion
                        vorrunde.push(new Action(null, currentAction.children[1], currentAction.children[2]));
                    } else { // Runden-Aktion
                        runde.push(new Action(currentAction.children[0], currentAction.children[1], currentAction.children[2]));
                    }
                }
            }
            this.actions = {
                vorrunde: vorrunde,
                runde: runde
            };
        }

    }

    function GruppenStatus(statusTable, heldenJaNein) {
        var statusTRs = statusTable.children[0].children
        if(statusTRs[1].innerText.includes("keine kampfbereiten Gegner")) {
            return;
        }
        var result = Array();
        //console.log("Status Table", statusTRs);
        for(var i=1,l=statusTRs.length;i<l;i++) { // ohne Header
            var tds = statusTRs[i].children;
            var srcRef = tds[1].innerHTML; // Mit aktuellen Wirkungen und Index. Helden wenn sie bewusstlos sind haben keinen Link mehr
            var typeRef; // unabhängig von Wirkung und Index, sofern vorhanden einzig der Link
            var unitLink = tds[1].getElementsByTagName("a");
            if(unitLink) unitLink = unitLink[0];
            if(unitLink) typeRef = unitLink.outerHTML;
            const unit = {
                id: getUnitIdFromElement(tds[1].childNodes[0], null, heldenJaNein, true),
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

    function Target(strLine) {
        var type
        var wirkung
        var result

        if(strLine.match(/: Fehlschlag/)) {
            result = 0;
        } else if(strLine.match(/: kritischer Erfolg/)) {
            result = 3;
        } else if(strLine.match(/: guter Erfolg/)) {
            result = 2;
        } else if(strLine.match(/: Erfolg/)) {
            result = 1;
        }
        var pw;
        if(result > -1) {
            type = "Angriff";
            const pwMatch = strLine.match(/(\(|\/)(\d+)(\)|\/)/);
            if(pwMatch) {
                pw = pwMatch[2];
            } else {
                console.log("Keine Parade", strLine);
            }

        } else {
            var matching = strLine.match(/\+(\d*) HP/)
            if(matching) { // Single Target Heal
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

    function isUnitClass(className) {
        return className && (className == "rep_hero" || className == "rep_monster" || className == "rep_myhero" || className == "rep_myotherheros");
    }

    //Einen Lookup ausführen, damit die Unit auch immer alle möglichen Information (z.B. Position) trägt.
    function unitLookup(unitId) {
        var lookupUnit = unitSearch(unitId, currentRound.helden);
        if(!lookupUnit) {
            lookupUnit = unitSearch(unitId, currentRound.monster);
        }
        if(!lookupUnit) {
            console.error("Unit konnte nicht in der aktuellen Runde gefunden werden!", unitId);
            return {
                id: unitId,
            };
        }
        return lookupUnit;
    }

    function unitSearch(unitId, unitArray) {
        for(var i=0,l=unitArray.length;i<l;i++) {
            const curUnit = unitArray[i];
            if(curUnit.id.name == unitId.name && curUnit.id.index == unitId.index) {
                return curUnit;
            }
        }
    }

    //im Target kann auch "sich" stehen, das wird dann entsprechend durch die zusätzliche Angabe "unitId" ersetzt.
    function getUnitIdFromElement(element, unitId, defaultIsHero) {
        if(!element) { // Ereignis
            return {
                name: "? Ereignis",
                isHero: false,
                isEreignis: true,
            }
        }
        if(!element.tagName) {
            if(element.innerText == "sich" || element.textContent == "sich") {
                return unitId;
            }
            return;
        }
        if(element.tagName != "A") {
            const findElements = element.getElementsByTagName("A");
            if(findElements.length > 0) {
                element = findElements[0];
            } else {
                return;
            }
        }
        var className = element.className;
        if(!isUnitClass(className)) return;

        var unitIndex;
        var sibling = element.nextSibling;
        var isHero = element.className != "rep_monster";
        if(sibling && sibling.tagName == "SPAN") {
            unitIndex = sibling.innerText;
        }
        return {
            name: element.innerText,
            index: unitIndex,
            isHero: isHero,
        };
    }

    function getDamageType(stringLine) {
        if(stringLine.includes("Hiebschaden"))
            return "Hieb";
        else if(stringLine.includes("Schneidschaden"))
            return "Schneid";
        else if(stringLine.includes("Stichschaden"))
            return "Stich";
        else if(stringLine.includes("Feuer"))
            return "Feuer";
        else if(stringLine.includes("Eisschaden"))
            return "Eis";
        else if(stringLine.includes("Blitzschaden"))
            return "Blitz";
        else if(stringLine.includes("psychologisch"))
            return "Psychologisch";
        else if(stringLine.includes("Heiliger Schaden"))
            return "Heilig";
        else if(stringLine.includes("Säureschaden"))
            return "Säure";
        else if(stringLine.includes("Falle entschärfen"))
            return "FalleEntschärfen";
        else if(stringLine.includes("Giftschaden"))
            return "Gift";
        else if(stringLine.includes("Manaschaden"))
            return "Mana";
        console.error("DamageType kann nicht bestimmt werden: "+stringLine);
        return "???";
    }

    function Damage(damageLineElement) {
        var resistenz = 0;
        if(damageLineElement.tagName == "SPAN") { // hat Anfälligkeit
            //console.log("Anfälligkeit gefunden "+damageLineElement.textContent);
            const dmgVorher = damageLineElement.onmouseover.toString().match(/verursacht: <b>(\d*)<\/b>/)[1];
            const dmgNachher = damageLineElement.onmouseover.toString().match(/Anfälligkeit.* <b>(\d*)<\/b>/)[1];
            resistenz = Number(dmgVorher)-Number(dmgNachher);
        }
        const stringLine = damageLineElement.textContent;
        var matching = stringLine.match(/^(\d*) \[\+(\d*)\]/);
        if(matching) {
            return {
                value: Number(matching[1]),
                ruestung: Number(matching[2]),
                resistenz: resistenz,
                type: getDamageType(stringLine),
            }
        }
        matching = stringLine.match(/^(\d*)/);
        if(matching) {
            return {
                value: Number(matching[1]),
                ruestung: 0,
                resistenz: resistenz,
                type: getDamageType(stringLine),
            }
        }
        console.error("Es kann kein Schaden ermittelt werden: "+stringLine);
    }

    function Wirkungen(htmlString, parentElement) {
        const elem = document.createElement("div");
        elem.innerHTML = htmlString;
        const wirkungen = Array();
        var currentMode = 0;
        var name;
        var wirkung = Array();
        var wann;
        function addWirkung() {
            if(!name.startsWith("Dies ist ein")) {
                wirkungen.push({
                    name: name,
                    wirkung: wirkung.join(""),
                    wann: wann,
                });
            }
        }

        for(var i=0,l=elem.childNodes.length;i<l;i++) {
            const curNode = elem.childNodes[i];
            if(currentMode == 0) {
                name = curNode.textContent;
                currentMode = 1;
            } else if(curNode.tagName == "BR") {
                addWirkung();
                currentMode = 0;
            } else if(curNode.textContent == " ") {
                // ignorieren
            } else {
                const curText = curNode.textContent;
                if(curText.includes("Runde")) {
                    wann = curText;
                } else {
                    wirkung.push(curText);
                }
                currentMode++;
            }
        }
        if(currentMode > 1) {
            addWirkung();
        }
        //console.log(htmlString, elem.childNodes.length, wirkungen);

        return wirkungen;
    }


    function getFertigkeit(actionElement, fertigkeitsWurfString, mitParade) { // wird üblicherweise in Klammern dargestellt (Fechtwaffen/29/Leichter Parierdolch der Fechtkunst)
        var fertigkeitsWurfArray = fertigkeitsWurfString.split("/");
        var name
        var wurf
        var mp
        var items = Array()
        var pointer = 0;
        var fertigkeitElement = util.arraySearch(actionElement.getElementsByTagName("a"), a => a.href.includes("/skill/"));
        var fertigkeitTypeRef = util.cloneElement(fertigkeitElement);

        if(mitParade) {
            name = fertigkeitsWurfArray[0];
            wurf = fertigkeitsWurfArray[1];
            pointer = 2;
        }

        if(fertigkeitsWurfArray.length > pointer) {
            if(fertigkeitsWurfArray[pointer].endsWith(" MP")) {
                mp = fertigkeitsWurfArray[pointer].substring(0, fertigkeitsWurfArray[pointer].length-3);
                pointer+=1;
            }
            if(fertigkeitsWurfArray.length > pointer) {
                var itemStringArray = fertigkeitsWurfArray[pointer].split(","); // Gegenstand + Munition(en)
                itemStringArray.forEach(itemName => {
                    itemName = itemName.trim();
                    var href = util.searchHref(actionElement, itemName);
                    if(href) href = href.outerHTML;
                    items.push({
                        name: itemName,
                        srcRef: href,
                        wirkungen: util.searchWirkungen(actionElement, itemName),
                    });
                });
            }
        }
        var wirkungen = util.searchWirkungen(actionElement, name);
        return {
            name: name,
            wirkungen: wirkungen,
            wurf: wurf,
            mp: mp,
            items: items,
            typeRef: fertigkeitTypeRef.outerHTML,
        }
    }

    function Action(initiative, action, target) {
        var actionText = action.innerText;
        var who;
        var fertigkeit;
        var wurf;
        var mp;
        var unit = unitLookup(getUnitIdFromElement(action.children[0]));

        // Parse targetNew

        var curTargetUnit
        var currentTarget
        var currentLine = Array();
        var lineNr = 0;
        var targets = Array();

        function addTarget() {
            var line = util.arrayMap(currentLine, a => a.textContent).join("");
            currentTarget = new Target(line);
            currentTarget.unit = curTargetUnit;
            targets.push(currentTarget);
        }

        //console.log("Target: "+target.innerText+" "+target.childNodes.length);
        for(var i=0,l=target.childNodes.length;i<l;i++) {
            const curElement = target.childNodes[i];

            const unitIdCheck = getUnitIdFromElement(curElement, unit.id);

            if(unitIdCheck) {
                lineNr = 1;
                curTargetUnit = unitLookup(unitIdCheck);
                currentLine.push(curElement);
                currentTarget = null;
            } else if(lineNr == -1) {
                // ignorieren solange bis neue Entität kommt
            } else if(curElement.tagName == "BR") {
                if(lineNr == 1) { // Erste-Zeile beendet wir setzen das Target
                    addTarget();
                }
                currentLine = Array()
                lineNr++;
            } else {
                if(lineNr > 1) { // Nachfolgende DamageLines direkt auswerten
                    //console.log("here: "+currentTarget+" "+lineNr+" => "+curElement.textContent);
                    if(curElement.tagName == "A") { // Schaden an einem Gegenstand
                        lineNr = -1; // solange ignorieren bis eine neue Entität kommt
                    } else {
                        currentTarget.damage.push(new Damage(curElement));
                    }
                } else {
                    currentLine.push(curElement);
                }
            }
        }
        if(lineNr==1) {
            addTarget();
        }

        // Parse action
        if(unit.id.isEreignis) {
            fertigkeit = {
                name: "Ereignis",
                type: "Ereignis",
                wurf: actionText.substring(actionText.lastIndexOf("(")+1, actionText.lastIndexOf(")")),
            };

        } else {
            if(actionText.includes(" heilt mittels ")) {
                fertigkeit = {
                    name: actionText.substring(actionText.indexOf(" heilt mittels ")+15),
                    type: "Heilung",
                }
            }
            else {
                var index;

                index = actionText.indexOf(" wirkt ");
                if(index > 0 && !actionText.includes("wirkt als")) { // Fähigkeit vor Klammern. Benötigt keine Probe.
                    var klammerBegin = actionText.indexOf("(", index);
                    var vorKlammerText = actionText.substring(0, klammerBegin);
                    var klammerText = actionText.substring(klammerBegin+1, actionText.lastIndexOf(")"));

                    fertigkeit = getFertigkeit(action, klammerText, false);
                    fertigkeit.name = vorKlammerText.substring(vorKlammerText.indexOf(" wirkt ")+7, klammerBegin-1);
                    fertigkeit.type = "Wirkung"
                }
                else { // Fähigkeit in Klammern

                    var matcher = actionText.match(/(greift per Fernkampf an|greift im Nahkampf an|greift magisch an|greift sozial an|greift hinterhältig an|verseucht|entschärft|wirkt als Naturgewalt auf|wird ausgelöst auf|erwirkt eine Explosion gegen) \(/);
                    if(!matcher) {
                        console.error("Unbekannter fertigkeit.type gefunden! "+actionText);
                    } else {
                        var index = matcher.index;
                        var matchingPattern = matcher[1];
                        var klammerBegin = actionText.indexOf("(", index);
                        var klammerText = actionText.substring(klammerBegin+1, actionText.lastIndexOf(")"));
                        fertigkeit = getFertigkeit(action, klammerText, true);
                        if(matchingPattern.includes("Nahkampf")) {
                            fertigkeit.type = "Nahkampf";
                        } else if(matchingPattern.includes("Fernkampf")) {
                            fertigkeit.type = "Fernkampf";
                        } else if(matchingPattern.includes("magisch")) {
                            fertigkeit.type = "Zauber";
                        } else if(matchingPattern.includes("sozial")) {
                            fertigkeit.type = "Sozial";
                        } else if(matchingPattern.includes("hinterhältig")) {
                            fertigkeit.type = "Hinterhalt";
                        } else if(matchingPattern.includes("verseucht")) {
                            fertigkeit.type = "Krankheit";
                        } else if(matchingPattern.includes("entschärft")) {
                            fertigkeit.type = "Falle entschärfen";
                        } else if(matchingPattern.includes("Naturgewalt")) {
                            fertigkeit.type = "Naturgewalt";
                        } else if(matchingPattern.includes("ausgelöst")) {
                            fertigkeit.type = "Falle";
                        } else if (matchingPattern.includes("Explosion")) {
                            fertigkeit.type = "Explosion";
                        } else {
                            console.error("Unbekannter fertigkeit.type gefunden! "+actionText);
                        }
                    }

                }
            }
        }

        //console.log(action);
        var result = {
            name: unit.id.name, // nur fürs Testen
            unit: unit,
            fertigkeit: fertigkeit,
            targets: targets,
        };
        if(!unit.isHero) {
            //console.log(action, result);
        }
        //console.log(result);
        return result;
    }

    const filterTypes = {
        level: "Level",

        attackType: "AngriffsTyp",

        position: "Position",
        unit: "Einheit",
        skill: "Fertigkeit",
        items: "Gegenstände",

        enemy_unit: "Gegner-Einheit",
        enemy_position: "Gegner-Position",

        //"gegner:fertigkeit": "Gegner-Fertigkeit",
        //"gegner:attackType": "Gegner-Angriffstyp",
        //"gegner:items": "Gegner-Gegenstände",
    }

    class StatView {
        query; // type StatQuery
        result; // type StatSearch, enthält auch den StatQuery
        spalten; // type Array TODO: zum Ein-/Ausblenden von Spalten
        showRootStat; // type Boolean soll auch alles zusammen gezählt werden
        initialFolded;

        constructor(statQuery, showRootStat, initialFolded) {
            this.query = statQuery;
            this.showRootStat = showRootStat;
            this.initialFolded = initialFolded;
        }
    }

    //
    // helden <-> monster
    // action <-> target
    // action.unit.position
    // z.B. monster, target.unit.position
    class StatQuery {
        side; // "heroes" oder "monsters"
        type; // 1: für Angriff, 2: für Verteidigung
        filter; // Array von QueryFilter

        constructor(side, type, filter) {
            this.side = side;
            this.type = type;
            this.filter = filter;
        }
    }

    class QueryFilter {
        spec; // FilterTypes ["units", "fertigkeit", "attackType", "positions", "gegner:units", "gegner:fertigkeit", "gegner:attackType", "gegner:positions"] auf welchem Attribut von Seite A oder B (mit "t:"-prefix) soll aggregiert werden
        selection; // um nur gewisse Werte einzuschließen (whitelist)

        constructor(spec, selection) {
            this.spec = spec;
            this.selection = selection;
        }
    }

    function statistikAusgabe_Level(levelDatas, hinweisText) {
        const statistic = createStatisticAnchor(hinweisText);

    }

    class StatTable {
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
            const child = this.anchor.children[0];
            if(child) this.anchor.removeChild(child);

            const table = document.createElement("table");
            table.style.minWidth = "600px";
            table.className = "content_table";
            table.border = 1;
            const tbody = document.createElement("tbody");
            table.append(tbody);
            const headerTr = this.createHeader(tbody);
            headerTr.style.position = "relative";

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
            info.innerHTML = "<span onmouseover=\"return wodToolTip(this,'"+infoTipp.replaceAll("'", "\\'").replaceAll('"', '\\"')+"');\"><img alt='' height='14px' border='0' src='/wod/css/skins/skin-8/images/icons/inf.gif'></span>";
            info.style.position = "absolute";
            info.style.right = "7px";
            info.style.top = "7px";
            headerTr.append(info);

            this.anchor.appendChild(table);
            if(this.statView.query.side && this.statView.query.type) {
                this.fillTable(tbody);
            }
        }

        getSelectionsFor(queryFilter) {
            if(queryFilter.spec.includes("position")) {
                return ["Vorne", "Linke Seite", "Rechte Seite", "Zentrum", "Hinten", "Im Rücken"];
            }
        }

        createMultiSelectionFor(queryFilter, fnCallbackOnYes) {
            var options = this.getSelectionsFor(queryFilter);
            const multiSelectionContainer = document.createElement("div");
            const multiSelection = document.createElement("select");
            multiSelectionContainer.append(multiSelection);
            multiSelection.multiple = "multiple";
            multiSelection.size = options.length;
            options.forEach(curOpt => {
                var selected = queryFilter.selection && queryFilter.selection.includes(curOpt);
                multiSelection.innerHTML += "<option "+(selected?"selected":"")+">"+curOpt+"</option>";
            });
            multiSelectionContainer.style.position="absolute";
            multiSelectionContainer.style.left="0px";
            multiSelectionContainer.style.top="0px";
            multiSelectionContainer.style.zIndex=1;
            const multiSelectionButtonBar = document.createElement("div");
            multiSelectionContainer.append(multiSelectionButtonBar);
            const yesButtonDiv = document.createElement("div");
            yesButtonDiv.style.display = "inline-block";
            yesButtonDiv.style.width = "50%";
            const yesButton = util.createImgButton("20px", "/wod/css/img/smiley/yes.png", function() {
                multiSelectionContainer.parentElement.removeChild(multiSelectionContainer);
                var result = [];
                var options = multiSelection.options;
                for (var i=0,l=options.length;i<l;i++) {
                    const opt = options[i];
                    if (opt.selected) {
                        result.push(opt.value || opt.text);
                    }
                }
                console.log("Selected", result);
                fnCallbackOnYes(result);
            });
            yesButton.style.margin = "auto";
            yesButton.style.display = "block";
            const noButtonDiv = document.createElement("span");
            noButtonDiv.style.width = "50%";
            noButtonDiv.style.display = "inline-block";
            const noButton = util.createImgButton("20px", "/wod/css/img/smiley/no.png", function() {
                multiSelectionContainer.parentElement.removeChild(multiSelectionContainer);
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
            for (const [filter, filterName] of Object.entries(filterTypes)) {
                result = result.replaceAll(filter, filterName);
            }
            result = result.replaceAll("_","-").replaceAll("enemy", "Gegner");
            if(queryFilter.selection) {
                result += " ("+queryFilter.selection.join(", ")+")";
            }
            return result;
        }

        createHeader(curTable) {
            var tr = document.createElement("tr");
            tr.className = "row0";
            curTable.append(tr);

            const thisObject = this;
            const query = this.statView.query;
            const th = document.createElement("th");
            th.colSpan = 100;
            th.style.textAlign = "left";
            th.className = "row0";
            tr.append(th);

            // Helden - Monster
            const sideElement = document.createElement("span");
            sideElement.style.cursor = "pointer";
            if (query.side === "heroes") {
                sideElement.innerHTML = "Helden";
            } else {
                sideElement.innerHTML = "Monster";
            }
            sideElement.onclick = function() {
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
            switchElement.onclick = function() {
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
            typeElement.onclick = function() {
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
            if(query.filter.length > 0) {
                for(var i=0,l=query.filter.length;i<l;i++) {
                    const curQueryFilter = query.filter[i];
                    const finalI = i;
                    const containerElement = document.createElement("span");
                    const labelElement = document.createElement("a");
                    const selectInput = document.createElement("select");

                    var selectOptions = "<option value=''></option>";
                    for (const [filterSpec, filterName] of Object.entries(filterTypes)) {
                        if (filterSpec === curQueryFilter.spec || !util.arraySearch(query.filter, qFilter => qFilter.spec === filterSpec)) {
                            selectOptions+="<option value='"+filterSpec+"'>"+filterName+"</option>"
                        }
                    }
                    if(thisObject.getSelectionsFor(curQueryFilter)) {
                        selectOptions += "<option value='"+filterEinschraenken+"'>"+filterEinschraenken+"</option>";
                    }
                    selectInput.innerHTML = selectOptions;
                    selectInput.onchange = function(a) {
                        if (selectInput.value === filterEinschraenken) {
                            containerElement.append(thisObject.createMultiSelectionFor(curQueryFilter, function(values) {
                                if (values.length === 0) {
                                    delete curQueryFilter.selection;
                                } else {
                                    curQueryFilter.selection = values;
                                }
                                thisObject.refresh();
                            }));
                        }
                        else {
                            if (selectInput.value === "") {
                                query.filter.splice(finalI, 1);
                            } else {
                                query.filter[finalI] = new QueryFilter(selectInput.value);
                            }
                            thisObject.refresh();
                        }
                    }
                    selectInput.value = curQueryFilter.spec;
                    selectInput.style.cursor = "pointer";

                    containerElement.append(selectInput);
                    containerElement.append(labelElement);
                    containerElement.style.position="relative";
                    selectInput.style.width="100%";
                    selectInput.style.position="absolute";
                    selectInput.style.left = "0px";
                    selectInput.style.opacity = 0.0;
                    if(filterBar.children.length > 0) {
                        const navi = document.createElement("span");
                        navi.innerText = " > ";
                        navi.style.cursor = "pointer";
                        filterBar.append(navi);
                        navi.onclick = function() { // vertauschen der beiden anhängigen Filter
                            const temp = query.filter[finalI];
                            query.filter[finalI] = query.filter[finalI-1];
                            query.filter[finalI-1] = temp;
                            thisObject.refresh();
                        };
                    }
                    labelElement.href="javascript:";
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
            selectInput.style.width="100%";
            selectInput.style.position="absolute";
            selectInput.style.left = "0px";
            selectInput.style.opacity = 0.0;
            function createAddOptions() {
                var result = "<option value=''></option>";
                for (const [filterSpec, filterName] of Object.entries(filterTypes)) {
                    if(!util.arraySearch(query.filter, qFilter => qFilter.spec == filterSpec)) {
                        result+="<option value='"+filterSpec+"'>"+filterName+"</option>";
                    }
                }
                return result;
            }
            selectInput.onchange = function(a) {
                if(selectInput.value != "") {
                    query.filter.push(new QueryFilter(selectInput.value));
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

            th.append(addAnchor);

            const collapsible = util.createCollapsible("20px", thisObject.collapsed, function(hide) {
                thisObject.collapsed = hide;
                if(curTable.children.length>1) {
                    for(var i=1,l=curTable.children.length;i<l;i++) {
                        const cur = curTable.children[i];
                        cur.hidden = hide;
                    }
                }
            });
            th.append(collapsible);

            return th;
        }

        fillTable(curTable) {
            var switcher = true;

            function writeTR(texts) {
                switcher = !switcher;
                var tr = document.createElement("tr");
                tr.className = "row"+(switcher? "0":"1");
                texts.forEach(cur => {
                    if(cur.startsWith("<td")) {
                        tr.innerHTML+=cur;
                    } else {
                        var td = document.createElement("td");
                        td.innerHTML = cur;
                        tr.append(td);
                    }
                });
                curTable.append(tr);
            }

            function writeHeader(text) {
                var tr = document.createElement("tr");
                tr.innerHTML = text;
                tr.className = "row0";
                curTable.append(tr);
                return tr;
            }

            var mitVorzeichen = nummer => {
                if(nummer == 0) return "x";
                if(nummer < 0) return nummer;
                if(nummer >0) return "+"+nummer;
            };

            function getDmgString(stat) {
                return stat.value+" ["+mitVorzeichen(-stat.ruestung)+"|"+mitVorzeichen(-stat.resistenz)+"]";
            }

            var lastCategoryColor = {};
            function convertPrefix(prefix, dmgStat) {
                var prefixSplit = prefix.split(" -> ");
                var fillerColor;
                if(prefixSplit.length > 1) {
                    prefix = prefixSplit.slice(1).join(" -> ");
                    fillerColor = lastCategoryColor[prefixSplit[0]] ? "#616D7E":"#616D7E";
                }
                lastCategoryColor[prefix] = switcher;

                var filler = "";
                for(var i=1,l=prefixSplit.length;i<l;i++) {
                    if(fillerColor) {
                        filler+="<td style='background-color:"+fillerColor+";border-right-style: hidden;'>&nbsp;</td>";
                    }
                    else {
                        filler+="<td style='border-right-style: hidden;'>&nbsp;</td>";
                    }
                }
                var unitCount = dmgStat.unitCount;
                if (unitCount) {
                    unitCount = " (" + Object.keys(unitCount).length + ")";
                } else {
                    unitCount = "";
                }
                prefix = dmgStat.title ? (dmgStat.title + unitCount) : prefixSplit[prefixSplit.length - 1];
                return filler+"<td colspan="+(11-prefixSplit.length)+" style='text-align:left;vertical-align:middle;'>"+prefix+"</td>";
            }

            function center(text) {
                return "<td style='text-align:center;vertical-align:middle;'>"+text+"</td>";
            }

            function getDmgTypeTable(specificArray) {
                const table = document.createElement("table");
                table.width = "100%";
                for (const [dmgType, dmgStat] of Object.entries(specificArray)) {
                    table.innerHTML+="<tr><td width=50%>"+dmgType+"</td>"+center(dmgStat.value)+center(mitVorzeichen(-dmgStat.ruestung))+center(mitVorzeichen(-dmgStat.resistenz))+"</tr>";
                }
                return table.outerHTML;
            }

            function printHeader(statView) {
                const tableEntry = Array();
                tableEntry.push("<th colspan=10 style='text-align:left;'>" + "" + "</th>");
                tableEntry.push(center("Aktionen"));
                if (statView.query.type === "defense") {
                    tableEntry.push(center("Erfolgreich<br>verteidigt"));
                } else {
                    tableEntry.push(center("Erfolgreich<br>angegriffen"));
                }

                tableEntry.push(center("normal/gut/krit"));
                tableEntry.push(center("Ausgehender<br>Schaden<br>(Ø)"));
                tableEntry.push(center("Direkter<br>Schaden<br>(Ø)"));
                tableEntry.push(center("Rüstung"));
                tableEntry.push(center("Resistenz"));
                tableEntry.push(center("AW Ø<br>(Min-Max)"));
                tableEntry.push(center("PW Ø<br>(Min-Max)"));
                tableEntry.push(center("Schadensarten<br>Schaden / Rüstung / Anfälligkeit"));
                writeHeader(tableEntry.join(""));
            }

            function statOutput(statView, prefix, dmgStat, specificArray) {
                if(dmgStat.result[1]+dmgStat.result[2]+dmgStat.result[3]+dmgStat.result[0] <= 0) return;
                var gesamtErfolge = dmgStat.result[1] + dmgStat.result[2] + dmgStat.result[3];
                var tableEntry = Array();
                tableEntry.push(convertPrefix(prefix, dmgStat)); // Title/Name
                tableEntry.push(center(dmgStat.actions.length));
                if (statView.query.type === "defense") {
                    tableEntry.push(center(dmgStat.result[0] + ":" + gesamtErfolge)); // lediglich hier ist es umgedreht für Defense
                } else {
                    tableEntry.push(center(gesamtErfolge + ":" + dmgStat.result[0]));
                }

                tableEntry.push(center(dmgStat.result[1]+" / "+dmgStat.result[2]+" / "+dmgStat.result[3]));
                const gesamtDamage = dmgStat.value + dmgStat.ruestung + dmgStat.resistenz;

                // Ausgehender Schaden
                const dmgFn = function (a) {
                    return a.value + a.ruestung + a.resistenz;
                };
                const damageAverage = "(" + util.arrayMin(dmgStat.actions, dmgFn) + " - " + util.arrayMax(dmgStat.actions, dmgFn) + ")";

                if (gesamtErfolge > 0 && gesamtDamage > 0) {
                    const avgDamage = gesamtDamage / gesamtErfolge;
                    tableEntry.push(center((gesamtDamage) + "<br>" + "(" + util.round(avgDamage, 2) + ")"));
                } else {
                    tableEntry.push(center((gesamtDamage)));
                }

                // Direkter Schaden
                if (gesamtErfolge > 0 && dmgStat.value > 0) {
                    tableEntry.push(center(dmgStat.value + "<br>" + "(" + util.round(dmgStat.value / gesamtErfolge, 2) + ")"));
                } else {
                    tableEntry.push(center(dmgStat.value));
                }
                tableEntry.push(center(mitVorzeichen(-dmgStat.ruestung)));
                tableEntry.push(center(mitVorzeichen(-dmgStat.resistenz)));
                var aw = Array(); // Angriffswerte
                var pw = Array(); // Paradewerte
                dmgStat.actions.forEach(action => {
                    aw.push(Number(action.fertigkeit.wurf));
                });
                dmgStat.targets.forEach(target => {
                    pw.push(Number(target.fertigkeit.wurf));
                });
                tableEntry.push(center(util.arrayAvg(aw, null, 2) + "<br>(" + util.arrayMin(aw) + " - " + util.arrayMax(pw) + ")"));
                tableEntry.push(center(util.arrayAvg(pw, null, 2) + "<br>(" + util.arrayMin(pw) + " - " + util.arrayMax(pw) + ")"));
                if(specificArray) {
                    tableEntry.push(getDmgTypeTable(specificArray));
                } else {
                    tableEntry.push("");
                }
                writeTR(tableEntry);
            }


            function printOut2(statView, id, statResult) {
                if (id === "") id = "Gesamt";
                statOutput(statView, id === "" ? "" : (id + ""), statResult, statResult.byDmgType);
            }

            function connect(a, b, isDefense) {
                if (a === "") return b;
                return a+" -> "+b;
            }

            function titleConvert(title) {
                if (title === "Gegner-AngriffsTyp") {
                    return "Alle Angriffstypen";
                }
                return title;
            }

            function printOut(statView, title, curResult) {
                if(curResult.sub) {
                    if (title !== "" || statView.showRootStat) {
                        if(curResult.ruestung > -1) {
                            printOut2(statView, title, curResult);
                        }
                    }
                    for (const [id, dmg] of Object.entries(curResult.sub)) {
                        printOut(statView, connect(title, id), dmg);
                    }

                } else {
                    printOut2(statView, title, curResult);
                }
            }

            //Löscht die vorangelegten Einträge, welche keine Treffer hatten
            function resultClearance(subResult) {
                if(!subResult) return;
                for (const [id, entry] of Object.entries(subResult)) {
                    if(!entry.filterType) {
                        delete subResult[id];
                    } else {
                        resultClearance(entry.sub);
                    }
                }
            }
            const statView = this.statView;
            statView.result = StatSearch(statView.query, this.levelDatas);
            console.log("StatView", statView, this.levelDatas);
            if(!statView.result) {
                curTable.innerHTML = "<td>Es konnte kein Ergebnis ermittelt werden!";
                return;
            }
            resultClearance(statView.result.sub);

            printHeader(statView);
            printOut(statView, "", statView.result);

            const myTable = curTable;
            if(this.collapsed) {
                for(var i=1,l=myTable.children.length;i<l;i++) {
                    const cur = myTable.children[i];
                    cur.hidden = true;
                }
            }
        }
    }

    const util = {
        arrayMap: function (list, fn) {
            var result = Array();
            for(var i=0,l=list.length;i<l;i++) {
                result.push(fn(list[i]));
            }
            return result;
        },
        arraySearch: function(array, predicate) {
            for(var i=0,l=array.length;i<l;i++) {
                const cur = array[i];
                if(predicate(cur)) return cur;
            }
        },
        createElementFromHTML: function(htmlString) {
            var div = document.createElement('div');
            div.innerHTML = htmlString.trim();
            return div.firstChild;
        },
        cloneElement: function(elem) {
            return this.createElementFromHTML(elem.outerHTML);
        },
        span: function(html) {
            const result = document.createElement("span");
            result.innerHTML = html;
            return result;
        },
        round: function(num, digits) {
            const correction = Math.pow(10, digits);
            return Math.round((num + Number.EPSILON) * correction) / correction;
        },

        arrayMin: function (array, fn) {
            if (!fn) fn = a => a;
            var result = Number.MAX_SAFE_INTEGER;
            array.forEach(action => {
                const cur = Number(fn(action));
                if (cur < result) {
                    result = cur;
                }
            });
            return result;
        },
        arrayMax: function (array, fn) {
            if (!fn) fn = a => a;
            var result = Number.MIN_SAFE_INTEGER;
            array.forEach(action => {
                const cur = Number(fn(action));
                if (cur > result) {
                    result = cur;
                }
            });
            return result;
        },
        arrayAvg: function (array, fn, roundingDigits) {
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
        },
        searchHref: function(parentElement, name) {
            const hrefs = parentElement.getElementsByTagName("a");
            for(var i=0,l=hrefs.length;i<l;i++) {
                const href = hrefs[i];
                if (href.innerText === name) {
                    return href;
                }
            }
        },
        searchWirkungen: function(parentElement, name) {
            var result;
            const hrefs = parentElement.getElementsByTagName("a");
            for(var i=0,l=hrefs.length;i<l;i++) {
                const href = hrefs[i];
                if (href.innerText === name) {
                    if(href.onmouseover) {
                        result = href.onmouseover.toString();
                        result = result.substring(result.indexOf("'")+1, result.lastIndexOf("'"));
                        result = new Wirkungen(result, parentElement);
                    }
                    break;
                }
            }
            return result;
        },
        createImgButton: function(height, url, fnCallback) {
            const result = document.createElement("img");
            result.style.height = height;
            result.src = url;
            result.onclick = fnCallback;
            return result;
        },
        createCollapsible: function(height, initialCollapsed, fnCallback) {
            const collapsible = document.createElement("img");
            collapsible.style.height = height;
            collapsible.style.cursor = "pointer";
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
                fnCallback(collapsed);
            }
            return collapsible;
        }
    }

    function WOD_istSeite_Kampfbericht()
    //**********************************************************************
    //*  testet, ob wir uns auf der Berichtseite befinden   *
    //**********************************************************************/
    {
        var result = false;
        var heading = document.getElementsByTagName("h1")[0];
        var text = heading.firstChild.data;

        if (text.indexOf("Kampfbericht:") !== -1) result = true;
        //console.log("Kampfbericht-Seite");

        return result;
    }
    function WOD_istSeite_Kampfstatistik()
    //**********************************************************************
    //*  testet, ob wir uns auf der Statistik-Seite befinden   *
    //**********************************************************************/
    {
        var result = false;
        var heading = document.getElementsByTagName("h1")[0];
        var text = heading.firstChild.data;

        if (text.indexOf("Kampfstatistik") !== -1) result = true;
        //console.log("Kampfstatistik-Seite");

        return result;
    }
    startMod();

})();