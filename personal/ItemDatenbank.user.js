// ==UserScript==
// @name           [WoD] Item-Datenbank
// @version        0.13.0
// @author         demawi
// @namespace      demawi
// @description    Datenbank der Items und Suche
//
// @match          *://*.world-of-dungeons.de/wod/spiel/*
// @match          *://*.world-of-dungeons.de/
// @match          *://world-of-dungeons.de/*
// @require        repo/DemawiRepository.js
// ==/UserScript==
// *************************************************************
// *** [WoD] Item-Datenbank                                  ***
// *** Dieses Script ist Freeware                            ***
// *** Wer es verbessern will, moege dies tun, aber bitte    ***
// *** nicht meinen Namen entfernen.                         ***
// *** Danke! demawi                                         ***
// *************************************************************

(function () {
    'use strict';

    const _ = demawiRepository;


    class Mod {
        static dbname = "wodDB";
        static version = GM.info.script.version;

        static async startMod() {
            const indexedDb = await _.WoDStorages.tryConnectToMainDomain(Mod.dbname);
            if (!indexedDb) return;
            await MyStorage.initMyStorage(indexedDb);

            if (false) {
                console.log("YYYYYYYYY")
                await MyStorage.getItemSourceDB().getAll(false, async function (itemSource) {
                    const newItemIndex = {
                        id: itemSource.id,
                        name: itemSource.name, // ggf. vorläufiger Name
                        data: itemSource.src ? 1 : 0,
                        world: itemSource.world,
                        ts: itemSource.ts,
                    }
                    await MyStorage.getItemIndexDB().setValue(newItemIndex);
                });
                console.log("ZZZZZZZZZZZ")
            }

            if (false) {
                await MyStorage.getItemIndexDB().getAll(false, async function (itemIndex) {
                    if (!_.WoDItemDb.isValidItemName(itemIndex.name)) {
                        console.log("Not valid itemName", itemIndex.name);
                        const id = itemIndex.id;
                        await MyStorage.getItemIndexDB().deleteValue(id);
                        await MyStorage.getItemSourceDB().deleteValue(id);
                        await MyStorage.getItemDB().deleteValue(id);
                    }
                });
            }

            await demawiRepository.startMod();
            await MyStorage.init();
            const page = _.util.getWindowPage();

            // Gegenstandsseite. Einlesen der Item-Werte.
            if (page === "item.php") await _.ItemParser.onItemPage();

            // Einbinden der Such-UI.
            if (page === "items.php" || page === "trade.php") await ItemSearchUI.start();

            // Links zu Items finden und markieren. Nahezu überall.
            if (page !== "item.php") {
                await ItemTracking.start();
                await ItemAutoLoader.start();
            }

            if (page === "skills.php" && _.util.urlHasAttribute("class")) {
                await SkillsPageExtended.start();
            }

        }
    }

    class ItemAutoLoader {
        static async start() {
            if (window.opener) return;
            const item = await this.findNext();
            if (item) {
                this.autoLoad(_.WoD.getItemUrl(item.name) + "&silent=true");
            }
        }

        static autoLoadSkill(skillName) {
            this.autoLoad(_.WoD.getSkillUrl(skillName) + "&silent=true");
        }

        static autoLoad(url) {
            const iframe = document.createElement("iframe");
            iframe.src = url;
            iframe.style.display = "none";
            document.body.append(iframe);
        }

        static async findNext() {
            const myWorldId = _.WoD.getMyWorld();
            let result;
            // Es ist wahrscheinlicher solche Einträge bei Neueinträgen zu finden
            await MyStorage.getItemIndexDB().getAll({
                index: ["data", "world." + myWorldId + ".valid", "ts"],
                keyMatch: [0, 1, _.Storages.MATCHER.NUMBER.ANY],
                order: "prev",
            }, function (itemIndex) {
                if (_.WoDItemDb.couldBeValid(itemIndex, myWorldId)) {
                    result = itemIndex;
                    return false;
                }
            });
            // keine Neueinträge gefunden, wir schauen, ob wir alte aktualisieren können
            if (!result) {
                await MyStorage.getItemIndexDB().getAll({
                    index: ["ts"],
                    keyMatch: [_.Storages.MATCHER.NUMBER.ANY],
                    order: "next",
                }, function (itemIndex) {
                    let days = Math.round((Date.now() - itemIndex.ts) / 86400000);
                    if (days > 100 && _.WoDItemDb.couldBeValid(itemIndex, myWorldId)) {
                        result = itemIndex;
                        return false;
                    }
                });
            }
            console.log("ItemAutoLoader.findNext", result, result ? "Tage alt: " + Math.round((Date.now() - result.ts) / 86400000) : "Kein Item-Load");
            return result;
        }


    }

    // Überprüft auf einer Webseite die Gegenstandslinks und fügt den Namen bei Bedarf der ItemDB hinzu.
    class ItemTracking {

        static async start() {
            const missingSpanOverall = document.createElement("span");
            missingSpanOverall.style.color = "red";
            missingSpanOverall.className = "missingMeOverall";
            missingSpanOverall.style.position = "fixed";
            missingSpanOverall.style.top = "0px";
            missingSpanOverall.style.right = "0px";
            let needRecheck = false;
            const isIrrelevantElement = function (elem) {
                return elem.className && elem.className.includes("tooltip") || elem.id && elem.id.includes("progressBar");
            }
            const observer = new MutationObserver(mutationList => {
                if (mutationList) {
                    let onlyIrrelevantElements = true;
                    for (const mutation of mutationList) {
                        if (!isIrrelevantElement(mutation.target)) {
                            onlyIrrelevantElements = false;
                            break;
                        }
                    }
                    if (onlyIrrelevantElements) return;
                }
                needRecheck = true;
            });

            async function checkSiteForItems() {
                observer.disconnect();
                const allHrefs = document.querySelectorAll("a");
                var missingItemsFound = 0;
                const myWorldId = _.WoD.getMyWorld();
                await _.util.forEachSafe(allHrefs, async itemLinkElement => {
                    const [itemName] = _.ItemParser.getItemNameFromElement(itemLinkElement);
                    if (!itemName) return;
                    const itemIndex = await MyStorage.getItemIndexDB().getValue(itemName);
                    if (itemIndex && !_.WoDItemDb.couldBeValid(itemIndex, myWorldId)) return;
                    if (!itemIndex || !itemIndex.data) missingItemsFound++;
                    await MyStorage.indexItem(itemName, itemLinkElement, itemIndex);
                });
                missingSpanOverall.innerHTML = missingItemsFound + "�";
                if (missingItemsFound === 0) {
                    if (document.body.contains(missingSpanOverall)) {
                        document.body.removeChild(missingSpanOverall);
                    }
                } else {
                    if (!document.body.contains(missingSpanOverall)) {
                        document.body.append(missingSpanOverall);
                    }
                }
                console.log("ItemDB.checkSiteForItems...finished!");
                observer.observe(document.body, {
                    attributes: false, // manchmal werden zwar Elemente eingeblendet, die waren dann aber vorher auch schon so da
                    childList: true,
                    subtree: true,
                });
                needRecheck = false;
            }

            setInterval(function () {
                if (needRecheck) checkSiteForItems();
            }, 1000);
            await checkSiteForItems();

        }
    }

    class ItemSearchUI {
        static async start() {
            // Erweiterung für die Suche
            const searchContainer = document.getElementsByClassName("search_container")[0];
            if (searchContainer) {
                const searchContainerTitle = searchContainer.children[0].children[0].children[0];

                const [itemDBSearch] = util.createCheckboxInTd(searchContainerTitle, "itemDB", "Item-DB");

                const [missingSearch, missingSearchLabel] = util.createCheckboxInTd(searchContainerTitle, "missingSearch", "");

                const toBBCodeButton = document.createElement("span");
                toBBCodeButton.style.fontSize = "12px";
                toBBCodeButton.style.cursor = "copy";
                toBBCodeButton.innerHTML = "[bb]";
                toBBCodeButton.style.marginLeft = "2px";
                toBBCodeButton.style.color = "darkgrey";
                toBBCodeButton.classList.add("bbignore");
                searchContainerTitle.append(toBBCodeButton);

                async function updateMissingButton() {
                    const allItemCount = await MyStorage.getItemIndexDB().count();
                    const myWorld = _.WoD.getMyWorld();
                    const itemsToLoadValidsValids = await MyStorage.getItemIndexDB().count({
                        index: ["data", "world." + myWorld + ".valid"],
                        keyMatch: [0, 1], // still valid for this world but not loaded yet
                    });
                    const itemsToLoadNonValids = await MyStorage.getItemIndexDB().count({
                        index: ["data", "world." + myWorld + ".valid"],
                        keyMatch: [0, 0], // still valid for this world but not loaded yet
                    });
                    const itemDataCount = await MyStorage.getItemIndexDB().count({
                        index: ["data"],
                    });
                    if (allItemCount - itemDataCount !== 0) console.error("ItemIndizes besitzen kein 'data'-flag!");
                    const notInWorldIndex = (allItemCount - itemsToLoadValidsValids - itemsToLoadNonValids);
                    //console.log("AAA", allItemCount, itemsToLoadValidsValids, itemsToLoadNonValids, notInWorldIndex, itemDataCount);
                    missingSearchLabel.innerText = "Fehlend [" + (allItemCount - notInWorldIndex - itemsToLoadNonValids) + "/" + allItemCount + "]";
                }

                updateMissingButton(); // kein await benötigt

                const mySearchTable = Searcher.QueryTable.create();
                const theirSearchTable = searchContainer.children[1];

                const mySearchButton = document.createElement("a");
                mySearchButton.className = "button";
                mySearchButton.innerHTML = "Suchen";
                mySearchButton.href = "javascript:void(0);";

                const button = searchContainerTitle.getElementsByClassName("button")[0];
                const buttonContainer = document.createElement("span");
                button.parentElement.insertBefore(buttonContainer, button);
                buttonContainer.append(button);

                const resultContainer = document.createElement("div");
                const originalResultTable = searchContainer.parentElement.getElementsByClassName("content_table")[0];
                searchContainer.parentElement.insertBefore(resultContainer, originalResultTable);
                searchContainer.parentElement.removeChild(originalResultTable);
                resultContainer.append(originalResultTable);

                toBBCodeButton.onclick = function () {
                    navigator.clipboard.writeText(_.BBCodeExporter.toBBCode(resultContainer));
                }

                WoD.getSuchfeld().onkeydown = function (event) {
                    // Enter abfangen und den aktuellen Such-Button auslösen
                    if (event.keyCode === 13) {
                        event.preventDefault();
                        buttonContainer.children[0].click();
                    }
                };

                function changeContainer() {
                    Searcher.SearchDomains.fetchDataForAuswahllisten();
                    if (itemDBSearch.checked || missingSearch.checked) {
                        buttonContainer.removeChild(buttonContainer.children[0]);
                        buttonContainer.append(mySearchButton);
                    } else {
                        buttonContainer.removeChild(buttonContainer.children[0]);
                        buttonContainer.append(button);
                    }
                    if (searchContainer.children.length > 1) {
                        searchContainer.removeChild(searchContainer.children[1]);
                    }
                    if (itemDBSearch.checked) {
                        searchContainer.append(mySearchTable);
                    } else if (!missingSearch.checked) {
                        searchContainer.append(theirSearchTable);
                    }
                }

                itemDBSearch.onclick = async function () {
                    if (itemDBSearch.checked) {
                        missingSearch.checked = false;
                    }
                    changeContainer();
                };
                missingSearch.onclick = async function () {
                    if (missingSearch.checked) {
                        itemDBSearch.checked = false;
                    }
                    changeContainer();
                };

                function getItemValue(obj, columnDef) {
                    if (columnDef.instantToHtml) {
                        const result = columnDef.instantToHtml(obj);
                        if (result !== undefined) return result;
                    }
                    return getItemValueIntern(obj, columnDef);
                }

                function getItemValueIntern(obj, columnDef, pfadArray) {
                    if (!pfadArray) pfadArray = columnDef.pfadArray;
                    if (!obj) return "";
                    if (pfadArray.length === 0) {
                        if (columnDef.toHTML) {
                            const result = columnDef.toHTML(obj);
                            if (result !== undefined) return result;
                        }
                        if (typeof obj === "string") return obj;
                        return JSON.stringify(obj);
                    }
                    return getItemValueIntern(obj[pfadArray[0]], columnDef, pfadArray.slice(1));
                }

                var sortOrderColumnDef;
                const myWorld = _.WoD.getMyWorld();

                async function search() {
                    const startTime = new Date();
                    const search4Items = itemDBSearch.checked;
                    console.log("search4Items", search4Items);
                    let items = null;
                    if(search4Items) {
                        items = await MyStorage.getItemDB().getAll();
                    } else {
                        items = await MyStorage.getItemIndexDB().getAll();
                    }

                    const itemResult = Array();
                    for (const item of items) {
                        if (!_.WoDItemDb.couldBeValid(item, myWorld)) continue;
                        if (missingSearch.checked && !item.data) {
                            itemResult.push(item);
                        } else if(search4Items) {
                            if (item.data && Searcher.matches(item, true)) {
                                itemResult.push(item);
                            }
                        }
                    }
                    if (search4Items) {
                        const skills = await _.WoDStorages.getSkillsDb().getAll();
                        for (const skill of skills) {
                            if (Searcher.matches(skill, false)) {
                                itemResult.push(skill);
                            }
                        }
                    }
                    if (sortOrderColumnDef) {
                        itemResult.sort((a, b) => {
                            return getItemValue(a, sortOrderColumnDef).localeCompare(getItemValue(b, sortOrderColumnDef));
                        })
                    }
                    console.log("ItemSearchTime: ", itemResult.length, "in", Math.round((new Date() - startTime)/10)/100, "ms");
                    return itemResult;
                }

                const updateResultTable = async function () {
                    // Search and display result
                    if (resultContainer.children.length > 0) {
                        resultContainer.removeChild(resultContainer.children[0]);
                    }
                    const itemOrSkillResults = await search()

                    updateMissingButton();
                    const table = document.createElement("table");
                    table.className = "content_table";
                    const thead = document.createElement("thead");
                    table.append(thead);
                    const headTR = document.createElement("tr");
                    thead.append(headTR);
                    headTR.className = "header";
                    const tbody = document.createElement("tbody");
                    table.append(tbody);
                    resultContainer.append(table);
                    headTR.innerHTML += "<th></th><th>Gegenstand (" + itemOrSkillResults.length + ")</th>";

                    var columns;
                    if (itemDBSearch.checked) {
                        columns = AutoColumns.getAutoColumns();
                        for (const [columnTitle, columnDef] of Object.entries(columns)) {
                            const columnHead = document.createElement("th");
                            headTR.append(columnHead);
                            columnHead.innerHTML = columnTitle;
                            columnHead.style.cursor = "pointer";
                            columnHead.onclick = function () {
                                sortOrderColumnDef = columnDef;
                                updateResultTable();
                            }
                        }
                    } else {
                        columns = Array();
                    }

                    var i = 1;
                    var switcher = false;

                    for (const itemOrSkill of itemOrSkillResults) {
                        switcher = !switcher;
                        const tr = document.createElement("tr");
                        tr.className = "row" + (switcher ? "0" : "1");
                        tbody.append(tr);
                        var td = document.createElement("td");
                        tr.append(td);
                        td.innerHTML = "" + i;
                        td = document.createElement("td");
                        tr.append(td);

                        for (const [title, columnDef] of Object.entries(columns)) {
                            const td = document.createElement("td");
                            td.innerHTML = getItemValue(itemOrSkill, columnDef);
                            tr.append(td);
                        }

                        const itemSpan = document.createElement("span");
                        const isItemAndNotSkill = _.EffectsParser.isItem(itemOrSkill);
                        const href = isItemAndNotSkill ? _.WoD.createItemLink(itemOrSkill.name) : _.WoD.createSkillLink(itemOrSkill.name);
                        itemSpan.append(href);
                        href.target = "ItemView";

                        if (itemDBSearch.checked) {
                            if (itemOrSkill?.data?.slots) {
                                for (let i = 0, l = itemOrSkill.data.slots; i < l; i++) {
                                    if (itemSpan.children.length < 2) {
                                        const abstand = document.createElement("span");
                                        abstand.innerHTML = "&nbsp;";
                                        itemSpan.append(abstand);
                                    }
                                    const img = document.createElement("img");
                                    img.src = "/wod/css/icons/WOD/gems/gem_0.png";
                                    itemSpan.append(img);
                                }
                            } else {
                                // nix
                            }

                        } else { // Fehlende Items
                            href.onclick = function () {
                                itemSpan.parentElement.removeChild(itemSpan);
                                //return wo(url + "&IS_POPUP=1");
                            }
                        }

                        td.append(itemSpan);
                        i++;
                    }
                }
                mySearchButton.onclick = updateResultTable;

            }

        }
    }


    class AutoColumns {

        static AutoColumnsDefinition = class AutoColumnsDefinition {
            static "Trageort" = {
                pfad: "data.trageort",
                notWhen: "Trageort",
                instantToHtml: function (obj) {
                    if (!_.EffectsParser.isItem(obj)) return "Fertigkeit";
                }
            }
            static "Klasse" = {
                pfad: "data.klasse",
                notWhen: "Klasse",
                toHTML: function (obj) {
                    if (obj.typ === "alle") return "alle";
                    if (obj.typ === "nur") {
                        return obj.def.map(a => _.WoD.KLASSEN[a]).join(", ");
                    }
                    return Object.keys(_.WoD.KLASSEN).filter(className => !obj.def.includes(className)).map(a => _.WoD.KLASSEN[a]).join(", ");
                },
                instantToHtml: function (obj) {
                    if (!_.EffectsParser.isItem(obj)) { // Skill
                        const _this = this;
                        return Object.entries(obj.classInfo).filter(([className, def]) => _.WoD.KLASSEN[_this.toSkillType(className)]).map(([className, def]) => _.WoD.KLASSEN[_this.toSkillType(className)] + "<sup>(" + def.type + def.lvl + ")</sup>").join(", ");
                    }
                },
                toSkillType: function (obj) {
                    if (obj.indexOf("/")) {
                        return obj.split("/")[0];
                    }
                    return obj;
                }
            }
            static "Volk" = {
                pfad: "data.volk",
                notWhen: "Volk",
                toHTML: function (obj) {
                    if (obj.typ === "alle") return "alle";
                    if (obj.typ === "nur") {
                        return obj.def.map(a => _.WoD.VOELKER[a]).join(", ");
                    }
                    return Object.keys(_.WoD.VOELKER).filter(className => !obj.def.includes(className)).map(a => _.WoD.VOELKER[a]).join(", ");
                },
                instantToHtml: function (obj) {
                    if (!_.EffectsParser.isItem(obj)) { // Skill
                        const _this = this;
                        return Object.entries(obj.classInfo).filter(([className, def]) => _.WoD.VOELKER[_this.toSkillType(className)]).map(([className, def]) => _.WoD.VOELKER[_this.toSkillType(className)] + "<sup>(" + def.type + def.lvl + ")</sup>").join(", ");
                    }
                },
                toSkillType: function (obj) {
                    if (obj.indexOf("/")) {
                        return obj.split("/")[0];
                    }
                    return obj;
                }
            }
            static "Stufe" = {
                pfad: "data.bedingungen.Stufe",
                toHTML: function (obj) {
                    return obj.comp + " " + obj.value;
                },
                instantToHtml: function (obj) {
                    if (!_.EffectsParser.isItem(obj)) { // Skill
                        return "ab " + Math.min(...Object.values(obj.classInfo).map(def => def.lvl));
                    }
                }
            }
            static "Schaden (Besitzer)" = {
                pfad: "effects.owner.schaden",
                when: "Bonus - Schaden",
                toHTML: AutoColumns.default3SpaltenOutput
            }
            static "Schaden (Betroffener)" = {
                pfad: "effects.target.schaden",
                when: "Bonus - Schaden",
                toHTML: AutoColumns.default3SpaltenOutput
            }
            static "Rüstung (Besitzer)" = {
                pfad: "effects.owner.ruestung",
                when: "Bonus - Rüstung",
                toHTML: AutoColumns.default3SpaltenOutput
            }
            static "Rüstung (Betroffener)" = {
                pfad: "effects.target.ruestung",
                when: "Bonus - Rüstung",
                toHTML: AutoColumns.default3SpaltenOutput
            }
            static "Anfälligkeit (Besitzer)" = {
                pfad: "effects.owner.anfaelligkeit",
                when: "Bonus - Anfälligkeit",
                toHTML: AutoColumns.default3SpaltenOutput
            }
            static "Anfälligkeit (Betroffener)" = {
                pfad: "effects.target.anfaelligkeit",
                when: "Bonus - Anfälligkeit",
                toHTML: AutoColumns.default3SpaltenOutput
            }
            static "Parade (Besitzer)" = {
                pfad: "effects.owner.parade",
                when: "Bonus - Parade",
                toHTML: AutoColumns.default2SpaltenOutput
            }
            static "Parade (Betroffener)" = {
                pfad: "effects.target.parade",
                when: "Bonus - Parade",
                toHTML: AutoColumns.default2SpaltenOutput
            }
            static "Angriff (Besitzer)" = {
                pfad: "effects.owner.angriff",
                when: "Bonus - Angriff",
                toHTML: AutoColumns.default2SpaltenOutput
            }
            static "Angriff (Betroffener)" = {
                pfad: "effects.target.angriff",
                when: "Bonus - Angriff",
                toHTML: AutoColumns.default2SpaltenOutput
            }
            static "Eigenschaft (Besitzer)" = {
                pfad: "effects.owner.eigenschaft",
                when: "Bonus - Eigenschaft",
                toHTML: AutoColumns.default2SpaltenOutput
            }
            static "Eigenschaft (Betroffener)" = {
                pfad: "effects.target.eigenschaft",
                when: "Bonus - Eigenschaft",
                toHTML: AutoColumns.default2SpaltenOutput
            }
            static "Fertigkeit (Besitzer)" = {
                pfad: "effects.owner.fertigkeit",
                when: "Bonus - Fertigkeit",
                toHTML: AutoColumns.default2SpaltenOutputWithLink(a => _.WoD.createSkillLink(a)),
            }
            static "Fertigkeit (Betroffener)" = {
                pfad: "effects.target.fertigkeit",
                when: "Bonus - Fertigkeit",
                toHTML: AutoColumns.default2SpaltenOutputWithLink(a => _.WoD.createSkillLink(a)),
            }
            static "Talentklasse (Besitzer)" = {
                pfad: "effects.owner.talentklasse",
                when: "Bonus - Talentklasse",
                toHTML: AutoColumns.default2SpaltenOutput
            }
            static "Talentklasse (Betroffener)" = {
                pfad: "effects.target.talentklasse",
                when: "Bonus - Talentklasse",
                toHTML: AutoColumns.default2SpaltenOutput
            }
            static "Gegenstandsklasse" = {
                pfad: "data.gegenstandsklassen",
                when: "Gegenstandsklasse",
                toHTML: function (obj) {
                    return obj.join("<br>");
                },
                instantToHtml: function (obj) {
                    if (!_.EffectsParser.isItem(obj)) {
                        return obj.klasse;
                    }
                }
            }
            static "Fertigkeitklasse" = {
                pfad: "...",
                when: "Fertigkeit:Klasse",
                toHTML: function (obj) {
                },
                instantToHtml: function (obj) {
                    if (_.EffectsParser.isItem(obj)) {
                        return "";
                    } else {
                        return obj.klasse;
                    }
                }
            }
            static "Angriffstyp" = {
                pfad: "...",
                when: "Fertigkeit:Angriffstyp",
                toHTML: function (obj) {
                },
                instantToHtml: function (obj) {
                    if (_.EffectsParser.isItem(obj)) {
                        return "";
                    } else {
                        return obj.angriffstyp;
                    }
                }
            }
            static "nutzbar mit" = {
                pfad: "data.fertigkeiten",
                when: "nutzbar mit",
                toHTML: function (obj) {
                    return obj.map(a => _.WoD.createSkillLink(a).outerHTML).join("<br>");
                },
            }
        }

        static whenBedingung(when) {
            var validatorIndex = Searcher.QueryTable.validatorTypes.indexOf(when);
            var negator = Searcher.QueryTable.negators[validatorIndex] || false;
            var validator = validatorIndex > -1;
            return negator !== validator;
        }

        static getAutoColumns() {
            const result = {};
            for (const [title, def] of Object.entries(this.AutoColumnsDefinition)) {
                const notWhen = def.notWhen;
                const when = def.when;
                if (!notWhen && !when || notWhen && !this.whenBedingung(notWhen) || when && this.whenBedingung(when)) {
                    def.pfadArray = def.pfad.split(".")
                    result[title] = def;
                }
            }
            console.log("AutoColumns", result);
            return result;
        }

        static replaceHSFR(text) {
            return text.replaceAll("der Heldenstufe", "HS").replaceAll("des Fertigkeitenrangs", "FR").replaceAll("Fertigkeitenrang", "FR").replaceAll("Heldenstufe", "HS");
        }

        static replaceHSFRMitBerechnung(bonusText) {
            var result = bonusText.replaceAll("der Heldenstufe", "HS").replaceAll("des Fertigkeitenrangs", "FR").replaceAll("Fertigkeitenrang", "FR").replaceAll("Heldenstufe", "HS");
            var hsInput = Searcher.QueryTable.getHsInput();
            if (hsInput === "") hsInput = null;
            else hsInput = Number(hsInput);
            var frInput = Searcher.QueryTable.getFrInput();
            if (frInput === "") frInput = null;
            else frInput = Number(frInput);

            return this.bonusAusrechnen(result, hsInput, frInput);
        }

        static bonusAusrechnen(bonus, hsWert, frWert) {
            bonus = bonus.replaceAll(" x", "");
            const isA = bonus.includes("(a)");
            if (isA) bonus = bonus.replaceAll("(a)", "").trim();

            const splitted = bonus.split(" ");

            var earlyResult = "";
            var festerWert = 0;
            var prozentualerWert = 0;
            var lastOne = aufschluesseln(splitted[0]);

            function colorize(wert, text) {
                var color;
                if (wert > 0) {
                    color = "limegreen";
                    text = "+" + text;
                } else color = "red";
                return "<span style='color:" + color + "'>" + text + "</span>";
            }

            function ausdruckAbschließen(mit) {
                if (!lastOne) return;
                var wert = Number(lastOne[0]);
                if (lastOne[1]) wert *= -1;

                var mitEinrechnen
                if (mit === "HS") mitEinrechnen = hsWert;
                else if (mit === "FR") mitEinrechnen = frWert;
                if (mitEinrechnen) wert *= Number(mitEinrechnen);
                else if (mit) { // ohne ausrechnen
                    var text = wert;
                    if (lastOne[2]) text += "%";
                    if (earlyResult.length > 0) earlyResult += " ";
                    earlyResult += colorize(wert, text + " " + mit);
                    return;
                }
                if (lastOne[2]) {
                    if (mit) {
                        festerWert += wert / 100;
                    } else {
                        prozentualerWert += wert;
                    }
                } else festerWert += wert;
            }

            function aufschluesseln(ausdruck) {
                if (ausdruck === "+FR") {
                    lastOne = [100, false, true];
                    ausdruckAbschließen("FR");
                    return;
                } else if (ausdruck === "-FR") {
                    lastOne = [100, true, true];
                    ausdruckAbschließen("FR");
                    return;
                } else if (ausdruck === "+HS") {
                    lastOne = [100, false, true];
                    ausdruckAbschließen("HS");
                    return;
                } else if (ausdruck === "-HS") {
                    lastOne = [100, true, true];
                    ausdruckAbschließen("HS");
                    return;
                }

                const minus = ausdruck.includes("-");
                const prozentual = ausdruck.includes("%");
                var wert = ausdruck.replaceAll("+", "").replaceAll("%", "").replaceAll("-", "");
                if (frWert) wert = wert.replaceAll("FR", frWert);
                if (hsWert) wert = wert.replaceAll("HS", hsWert);
                return [wert, minus, prozentual];
            }

            for (var i = 1, l = splitted.length; i < l; i++) {
                const cur = splitted[i];
                if (cur.startsWith("+") || cur.startsWith("-")) { // next one, letzten Abschließen
                    ausdruckAbschließen();
                    lastOne = aufschluesseln(cur);
                } else { // multiplizieren
                    ausdruckAbschließen(cur); // cur = HS oder FR
                    lastOne = null;
                }
            }
            ausdruckAbschließen();

            var result = "";
            if (prozentualerWert !== 0) {
                var prozWertText = prozentualerWert + "%";
                result += colorize(prozentualerWert, prozWertText);
            }
            if (festerWert !== 0) {
                var festWertText = festerWert;
                if (result.length > 0) result += " ";
                result += colorize(festerWert, festWertText);
            }
            if (earlyResult.length > 0) {
                if (result.length > 0) result += " ";
                result += earlyResult;
            }
            if (isA) result += " (a)";
            return result;
        }

        static default2SpaltenOutput(obj, linkFn) {
            var result = "";
            obj.forEach(parade => {
                if (result.length > 0) result += "<br>";
                const bonus = AutoColumns.replaceHSFRMitBerechnung(parade.bonus);
                console.log("GegBonus", parade.bonus, bonus);
                let bemerkungAdd = (parade.dauer ? " (" + parade.dauer + (parade.bemerkung ? "/" + parade.bemerkung : "") + ")" : "");
                if (parade.nurWirkung) bemerkungAdd += " (nur Wirkung)";
                result += (linkFn && linkFn(parade.type).outerHTML || parade.type) + ": " + bonus + bemerkungAdd;
            });
            return result;
        }

        static default2SpaltenOutputWithLink(linkFn) {
            return obj => {
                return this.default2SpaltenOutput(obj, linkFn);
            }
        }

        static default3SpaltenOutput(obj) {
            var result = "";
            obj.forEach(dmg => {
                if (result.length > 0) result += "<br>";
                const bonus = AutoColumns.replaceHSFR(dmg.bonus);
                result += dmg.damageType + "(" + dmg.attackType + "): " + dmg.bonus;
            });
            return result;
        }

    }


    class Searcher {

        /**
         * aka Validators um einzelne Items zu verfizieren
         */
        static SuchKriterien = class SuchKriterien {
            static "Klasse" = (container) => {
                const select1 = Searcher.UI.createSelect(["<Klasse>", ...Object.keys(_.WoD.KLASSEN)]);
                container.append(select1);
                return {
                    matchesItem: function (item) {
                        if (select1.value === "") return true;
                        const klasse = item?.data?.klasse;
                        if (!klasse || klasse.typ === "alle") return true;
                        if (klasse.typ === "nur") {
                            return klasse.def.includes(select1.value);
                        }
                        return !klasse.def.includes(select1.value);
                    },
                    matchesSkill: function (skill) {
                        if (select1.value === "") return true;
                        const classInfo = skill?.classInfo;
                        return !classInfo || !!classInfo[select1.value];
                    }
                }
            }

            static "Trageort" = (container) => {
                const select1 = Searcher.UI.createSelect(["<Trageort>", ...Searcher.SearchDomains.TRAGEORT]);
                container.append(select1);
                return {
                    matchesItem: function (item) {
                        if (select1.value === "") return true;
                        const trageort = item?.data?.trageort
                        if (select1.value === "Jegliche Hand/Hände") {
                            for (const curTrageort of Searcher.SearchDomains.JEGLICHE_HAND) {
                                if (trageort === curTrageort) return true;
                            }
                            return false;
                        } else if (select1.value === "Waffenhand/Einhändig") {
                            for (const curTrageort of Searcher.SearchDomains.WAFFENHAND_EINHAENDIG) {
                                if (trageort === curTrageort) return true;
                            }
                            return false;
                        } else if (select1.value === "Schildhand/Einhändig") {
                            for (const curTrageort of Searcher.SearchDomains.SCHILDHAND_EINHAENDIG) {
                                if (trageort === curTrageort) return true;
                            }
                            return false;
                        } else if (select1.value === "Waffenhand/Schildhand/Einhändig") {
                            for (const curTrageort of Searcher.SearchDomains.WAFFENHAND_SCHILDHAND_EINHAENDIG) {
                                if (trageort === curTrageort) return true;
                            }
                            return false;
                        }

                        return trageort === select1.value;
                    },
                    matchesSkill: function (skill) {
                        return true;
                    },
                }
            }

            static "Verbrauchsgut" = (container) => {
                const select1 = Searcher.UI.createSelect(["<Verbrauchsgut>", "JA", "nein"]);
                container.append(select1);
                return {
                    matchesItem: function (item) {
                        if (select1.value === "") return true;
                        if (select1.value === "JA") {
                            return item.data?.isVG;
                        } else {
                            return !item.data?.isVG;
                        }
                    },
                    matchesSkill: function (skill) {
                        return true;
                    },
                }
            }

            static "Gegenstandsklasse" = (container) => {
                const select1 = Searcher.UI.createSelect(["<Gegenstandsklasse>", ...Searcher.SearchDomains.GEGENSTANDSKLASSEN]);
                container.append(select1);
                return {
                    matchesItem: function (item) {
                        if (select1.value === "") return true;
                        const klassen = item.data?.gegenstandsklassen;
                        if (klassen) {
                            if (select1.value === "Veredelungsart: Keine Waffe, keine Rüstung") {
                                return util.twoListMatch(klassen, Searcher.SearchDomains.VEREDELUNGSART_SCHADEN_OHNE_WAFFE);
                            }
                            return klassen.includes(select1.value);
                        }
                        return false;
                    },
                    matchesSkill: function (skill) {
                        return false;
                    },
                }
            }

            static "Fertigkeit:Klasse" = (container) => {
                const select1 = Searcher.UI.createSelect(["<Talentklasse>", ...Searcher.SearchDomains.TALENTKLASSEN]);
                container.append(select1);
                return {
                    matchesItem: function (item) {
                        return false;
                    },
                    matchesSkill: function (skill) {
                        if (select1.value === "") return true;
                        if (!skill.klasse) return false;
                        return skill.klasse === select1.value;
                    },
                }
            }

            static "Fertigkeit:Angriffstyp" = (container) => {
                const select1 = Searcher.UI.createSelect(["<Angriffstyp>", ...Searcher.SearchDomains.ANGRIFFSTYPEN]);
                container.append(select1);
                return {
                    matchesItem: function (item) {
                        return false;
                    },
                    matchesSkill: function (skill) {
                        if (select1.value === "") return true;
                        if (!(skill.typ === "Angriff" || skill.typ === "Verschlechterung") || !skill.angriffstyp) return false;
                        return skill.angriffstyp === select1.value;
                    },
                }
            }

            static "nutzbar mit" = (container) => {
                const select1 = Searcher.UI.createSelect(["<Fertigkeit>", ...Searcher.SearchDomains.FERTIGKEITEN]);
                container.append(select1);
                return {
                    matchesItem: function (item) {
                        if (select1.value === "") return true;
                        const fertigkeiten = item.data?.fertigkeiten;
                        if (fertigkeiten) {
                            return fertigkeiten.includes(select1.value);
                        }
                        return false;
                    },
                    matchesSkill: function (skill) {
                        return select1.value === "";
                    },
                }
            }

            static "Besitzer/Betroffener" = (container) => {
                const selectBesitzerBetroffener = Searcher.UI.createSelect(Searcher.SearchDomains.BESITZER_BETROFFENER);
                container.append(selectBesitzerBetroffener);
                return {
                    matchesItem: function (item) {
                        if (selectBesitzerBetroffener.value === "Besitzer") {
                            return item.effects.owner;
                        } else if (selectBesitzerBetroffener.value === "Betroffener") {
                            console.log(item.effects.target);
                            return item.effects.target;
                        }
                    },
                    matchesSkill: function (skill) {
                        return this.matchesItem(skill);
                    },
                }
            }

            static "Stufe" = (container) => {
                const textFrom = util.createTextInput("50px");
                const textTo = util.createTextInput("50px");
                container.append(textFrom);
                container.append(util.span(" - "));
                container.append(textTo);
                return {
                    matchesItem: function (item) {
                        var from = textFrom.value.trim();
                        var to = textTo.value.trim();
                        if (from === "") from = null;
                        if (to === "") to = null;
                        if (!from && !to) return true;
                        if (from && to && to < from) return false; // keine Klassen eingeschlossen
                        const stufenBedingung = item.data?.bedingungen?.Stufe;
                        if (!stufenBedingung) return true;
                        const value = stufenBedingung.value;
                        if (stufenBedingung.comp === "ab") {
                            if (to) return Number(value) <= Number(to);
                            return Number(value) <= Number(from);
                        } else { // bis
                            if (from) return Number(value) >= Number(from);
                            return Number(value) >= Number(to);
                        }
                    },
                    matchesSkill: function (skill) {
                        return true;
                    },
                }
            }

            static "Veredelbar" = (container) => {
                const textFrom = util.createTextInput("50px");
                const textTo = util.createTextInput("50px");
                textFrom.value = 1;
                container.append(textFrom);
                container.append(util.span(" - "));
                container.append(textTo);
                return {
                    matchesItem: function (item) {
                        if (textFrom.value === "") textFrom.value = 1;
                        var from = textFrom.value.trim();
                        var to = textTo.value.trim();
                        if (from === "") from = null;
                        if (to === "") to = null;
                        if (!from && !to) return true;
                        if (from && to && to < from) return false; // keine Klassen eingeschlossen
                        const anzahlEdelslots = Number(item.data?.slots || 0);
                        if (from !== null && Number(from) > anzahlEdelslots) return false;
                        if (to !== null && Number(to) < anzahlEdelslots) return false;
                        return true;
                    },
                    matchesSkill: function (skill) {
                        return false;
                    },
                }
            }

            static "Bonus - Eigenschaft" = (container) => this.effects2Kriterium(container, "eigenschaft", ["<Eigenschaft>", ...Object.values(Searcher.SearchDomains.EIGENSCHAFTEN)])
            static "Bonus - Fertigkeit" = (container) => this.effects2Kriterium(container, "fertigkeit", ["<Fertigkeit>", ...Object.values(Searcher.SearchDomains.FERTIGKEITEN)])
            static "Bonus - Talentklasse" = (container) => this.effects2Kriterium(container, "talentklasse", ["<Talentklasse>", ...Searcher.SearchDomains.TALENTKLASSEN])

            static "Bonus - Angriff" = (container) => this.effects2Kriterium(container, "angriff", ["<Angriffstyp>", ...Searcher.SearchDomains.ANGRIFFSTYPEN])
            static "Bonus - Parade" = (container) => this.effects2Kriterium(container, "parade", ["<Parade>", ...Searcher.SearchDomains.PARADETYPEN])
            static "Bonus - Schaden" = (container) => this.schadenRuestungAnfaelligkeit(container, "schaden");
            static "Bonus - Rüstung" = (container) => this.schadenRuestungAnfaelligkeit(container, "ruestung");
            static "Bonus - Anfälligkeit" = (container) => this.schadenRuestungAnfaelligkeit(container, "anfaelligkeit");

            static schadenRuestungAnfaelligkeit(container, boniType) {
                const selectSchadensart = Searcher.UI.createSelect(["<Schadensart>", ...Searcher.SearchDomains.SCHADENSARTEN]);
                container.append(selectSchadensart);
                const selectBesitzerBetroffener = Searcher.UI.createSelect(Searcher.SearchDomains.BESITZER_BETROFFENER);
                container.append(selectBesitzerBetroffener);
                const selectAngriffstyp = Searcher.UI.createSelect(["<Angriffstyp>", ...Searcher.SearchDomains.ANGRIFFSTYPEN]);
                container.append(selectAngriffstyp);
                const selectAZ = Searcher.UI.createSelect(["<a/z>", ...Searcher.SearchDomains.SCHADENSBONITYP]);
                if (boniType === "schaden") container.append(selectAZ);

                return {
                    matchesItem: function (item) {
                        if (selectSchadensart.value === "" && selectBesitzerBetroffener.value === "" && selectAngriffstyp.value === "" && selectAZ.value === "") return true;

                        var result = Array();

                        if (selectBesitzerBetroffener.value === "Besitzer" || selectBesitzerBetroffener.value === "") {
                            const cur = item.effects?.owner?.[boniType];
                            if (cur) result.push(...cur);
                            if (selectSchadensart.value !== "" && item.data?.wirkung?.type) {
                                result.push({
                                    bonus: "+1 / +1 / +1",
                                    damageType: item.data?.wirkung?.type,
                                    attackType: "(alle) (a)", // ist tendenziell abhängig von den Fähigkeiten
                                });
                            }
                        }
                        if (selectBesitzerBetroffener.value === "Betroffener" || selectBesitzerBetroffener.value === "") {
                            const cur = item.effects?.target?.[boniType];
                            if (cur) result.push(...cur);
                        }

                        result = result.filter(cur => {
                            function enthaelt(str) {
                                return cur.bonus.includes(str) || cur.attackType.includes(str)
                            }

                            function angriffsTyp(str) {
                                if (!str || str === "") return true;
                                return cur.attackType.includes("alle") || cur.attackType.includes(str);
                            }

                            if (selectSchadensart.value !== "" && cur.damageType !== selectSchadensart.value) {
                                return false;
                            }
                            if (selectAngriffstyp.value !== "" && !angriffsTyp(selectAngriffstyp.value)) {
                                return false;
                            }
                            if (boniType === "schaden" && selectAZ.value !== "") {
                                var matches = false;
                                switch (selectAZ.value) {
                                    case Searcher.SearchDomains.SCHADENSBONITYP[0]:
                                        matches = !enthaelt("(z)");
                                        break;
                                    case Searcher.SearchDomains.SCHADENSBONITYP[1]:
                                        matches = !enthaelt("(a)") && !enthaelt("(z)");
                                        break;
                                    case Searcher.SearchDomains.SCHADENSBONITYP[2]:
                                        matches = enthaelt("(a)") && !enthaelt("(z)");
                                        break;
                                    case Searcher.SearchDomains.SCHADENSBONITYP[3]:
                                        matches = enthaelt("(a)");
                                        break;
                                    case Searcher.SearchDomains.SCHADENSBONITYP[4]:
                                        matches = enthaelt("(z)") && enthaelt("(a)");
                                        break;
                                    case Searcher.SearchDomains.SCHADENSBONITYP[5]:
                                        matches = !enthaelt("(a)");
                                        break;
                                    case Searcher.SearchDomains.SCHADENSBONITYP[6]:
                                        matches = enthaelt("(z)");
                                        break;
                                    case Searcher.SearchDomains.SCHADENSBONITYP[7]:
                                        matches = enthaelt("(z)") && !enthaelt("(a)");
                                        break;
                                }
                                if (!matches) return false;
                            }
                            return true;
                        });
                        return result.length > 0;
                    },
                    matchesSkill: function (skill) {
                        return this.matchesItem(skill);
                    },
                }
            }

            static effects2Kriterium(container, id, selectArray) {
                const select1 = Searcher.UI.createIntelligentMultiSelect(selectArray);
                container.append(select1);
                const select2 = Searcher.UI.createSelect(Searcher.SearchDomains.BESITZER_BETROFFENER);
                container.append(select2);
                const [checkBox, label, span] = util.createCheckBoxInSpan("debuff_" + id, "Debuff");
                container.append(span);
                return {
                    matchesItem: function (item) {
                        if (select1.value === "" && select2.value === "") return true;
                        var result = Array();
                        if (select2.value === "Besitzer" || select2.value === "") {
                            const cur = item.effects?.owner?.[id];
                            if (cur) result.push(...cur);
                        }
                        if (select2.value === "Betroffener" || select2.value === "") {
                            const cur = item.effects?.target?.[id];
                            if (cur) result.push(...cur);
                        }
                        var next = Array();
                        const selectedOptions = Searcher.SuchKriterien.getSelectedOptions(select1);
                        if (selectedOptions) {
                            result.forEach(cur => {
                                if (selectedOptions.includes(cur.type) && (!checkBox.checked && cur.bonus.includes("+") || checkBox.checked && cur.bonus.includes("-"))) {
                                    next.push(cur);
                                }
                            });
                            result = next;
                            next = Array();
                        }
                        return result.length > 0;
                    },
                    matchesSkill: function (skill) {
                        return this.matchesItem(skill);
                    },
                }
            }

            static getSelectedOptions(select1) {
                if (select1.selectedOptions.length > 0 && !(select1.selectedOptions.length === 1 && select1.selectedOptions[0].value === "")) {
                    return util.getSelectedOptions(select1);
                }
            }
        }

        static SearchDomains = class {

            static GEGENSTANDSKLASSEN;
            static FERTIGKEITEN;
            static EIGENSCHAFTEN;
            static TALENTKLASSEN;

            // müssen vorab geholt werden bevor der eigentliche Such-Container ausgebettet wird.
            static fetchDataForAuswahllisten() {
                if (!this.GEGENSTANDSKLASSEN) { // nur initial
                    this.GEGENSTANDSKLASSEN = WoD.getAuswahlliste("item_?item_class");
                    this.GEGENSTANDSKLASSEN.push("Duellbelohnung");
                    this.GEGENSTANDSKLASSEN.push("Mal der Geister");
                    this.GEGENSTANDSKLASSEN.push("Einzigartige Duellbelohnung");
                    this.GEGENSTANDSKLASSEN.push("Veredelungsart: Keine Waffe, keine Rüstung");
                    this.GEGENSTANDSKLASSEN.sort();
                    this.FERTIGKEITEN = WoD.getAuswahlliste("item_?any_skill");
                    this.EIGENSCHAFTEN = WoD.getAuswahlliste("item_?bonus_attr");
                    this.TALENTKLASSEN = WoD.getAuswahlliste("item_?any_skillclass");
                }
            }

            static SCHADENSBONITYP = ["Alle Trigger: (a) egal, kein (z)", "Trigger-Additiv: kein (a), kein (z)", "Trigger-Anwendung: (a), kein (z)", "Anwendung: (a), (z) egal", "Anwendung: (a), (z)", "Additiv: kein (a), (z) egal", "Additiv: (a) egal, (z)", "Additiv: kein (a), (z)"];
            static ANGRIFFSTYPEN = ["Nahkampf", "Fernkampf", "Zauber", "Sozial", "Naturgewalt", "Hinterhalt", "Explosion", "Falle entschärfen", "Verschrecken"];
            static PARADETYPEN = ["Nahkampf", "Fernkampf", "Zauber", "Sozial", "Naturgewalt", "Krankheit", "Explosion", "Falle auslösen", "Hinterhalt"];
            static BESITZER_BETROFFENER = ["<Ziel>", "Besitzer", "Betroffener"];

            static TRAGEORT = ["Kopf", "Ohren", "Brille", "Halskette", "Torso", "Gürtel", "Umhang", "Schultern", "Arme", "Handschuhe", "Jegliche Hand/Hände", "Beide Hände", "Waffenhand", "Schildhand", "Einhändig", "Waffenhand/Einhändig", "Schildhand/Einhändig", "Waffenhand/Schildhand/Einhändig", "Beine", "Füße", "Orden", "Tasche", "Ring", "nicht tragbar"];
            static JEGLICHE_HAND = ["Beide Hände", "Waffenhand", "Schildhand", "Einhändig"];
            static WAFFENHAND_EINHAENDIG = ["Waffenhand", "Einhändig"];
            static SCHILDHAND_EINHAENDIG = ["Schildhand", "Einhändig"];
            static WAFFENHAND_SCHILDHAND_EINHAENDIG = ["Waffenhand", "Schildhand", "Einhändig"];

            static VEREDELUNGSART_WAFFE = ["Veredelungsart: Metallwaffe", "Veredelungsart: Holzwaffe"];
            static VEREDELUNGSART_RUESTUNG_TEXTIL = ["Veredelungsart: Felle", "Veredelungsart: Lederbekleidung", "Veredelungsart: Metallrüstung", "Veredelungsart: Textilien"];
            static VEREDELUNGSART_SCHADEN_OHNE_WAFFE = ["Veredelungsart: Chitin", "Veredelungsart: Knochen", "Veredelungsart: Holzgegenstand", "Veredelungsart: Steingegenstand", "Veredelungsart: Schriftstück", "Veredelungsart: Zierrat"];
            // noch offen: , "Veredelungsart: Geschosse"

            static SCHADENSARTEN = ["Schneidschaden", "Hiebschaden", "Stichschaden", "Eisschaden", "Feuerschaden", "Blitzschaden", "Giftschaden", "Heiliger Schaden", "Manaschaden", "Säureschaden", "Psychologischer Schaden", "Arkaner Schaden", "Falle entschärfen"];
        }


        static QueryTable = class QueryTable {
            static validators = [];
            static validatorTypes = [];
            static negators = [];

            static table;
            static thead;
            static tbody;

            static hsInput;
            static frInput;

            static getHsInput() {
                return this.hsInput.value;
            }

            static getFrInput() {
                return this.frInput.value;
            }

            static create() {
                this.table = document.createElement("table");
                this.thead = document.createElement("thead");
                this.tbody = document.createElement("tbody");
                this.table.append(this.thead);
                this.table.append(this.tbody);

                this.hsInput = util.createTextInput("50px");
                this.frInput = util.createTextInput("50px");
                const tr = document.createElement("tr");
                const th = document.createElement("td");
                tr.append(th);
                th.colSpan = 10;
                th.style.textAlign = "left";
                this.thead.append(tr);
                th.append(util.span("Boniberechnung mit: "))
                th.append(util.span("HS: "));
                th.append(this.hsInput);
                th.append(util.span(" FR: "));
                th.append(this.frInput);

                this.createAuswahl(0);
                return this.table;
            }

            static createAuswahl(i) {
                const tbody = this.tbody;
                const thisObject = this;
                const tr = document.createElement("tr");
                tbody.append(tr);
                const mainSelectTD = document.createElement("td");
                mainSelectTD.style.verticalAlign = "top";
                const select = Searcher.UI.createSelect(["<Auswahl>"].concat(Object.keys(Searcher.SuchKriterien)));
                const searchFieldsTD = document.createElement("td");
                searchFieldsTD.style.verticalAlign = "top";
                mainSelectTD.append(select);
                tr.append(mainSelectTD);
                tr.append(searchFieldsTD);
                const [checkbox, checkboxLabel, labelcheckBoxTd] = util.createCheckboxInTd(tr, "", "Negieren");
                labelcheckBoxTd.style.verticalAlign = "top";

                checkbox.onclick = function () {
                    const myCurIndex = [...tbody.children].indexOf(tr);
                    thisObject.negators[myCurIndex] = checkbox.checked;
                }
                checkbox.parentElement.hidden = true;

                select.onchange = function () {
                    const myCurIndex = [...tbody.children].indexOf(tr);
                    if (select.value === "") {
                        searchFieldsTD.innerHTML = "";
                        delete thisObject.validators[myCurIndex];
                        delete thisObject.validatorTypes[myCurIndex];
                        checkbox.parentElement.hidden = true;
                        thisObject.checkRemove(myCurIndex);
                    } else {
                        searchFieldsTD.innerHTML = "";
                        const suche = Searcher.SuchKriterien[select.value](searchFieldsTD);
                        checkbox.parentElement.hidden = false;
                        suche.name = select.value;
                        thisObject.validators[myCurIndex] = suche;
                        thisObject.validatorTypes[myCurIndex] = select.value;
                        if (tbody.children.length <= myCurIndex + 1) {
                            thisObject.createAuswahl(myCurIndex + 1);
                        }
                    }
                }
            }

            static checkRemove(i) {
                if (this.tbody.children.length === 1) return false;
                if (!this.validatorTypes[i]) {
                    this.validatorTypes.splice(i, i);
                    this.validators.splice(i, i);
                    this.negators.splice(i, i);
                    this.tbody.removeChild(this.tbody.children[i]);
                }
            }
        }

        static UI = class UI {
            static createSelect(options) {
                const result = document.createElement("select");
                result.style.display = "inline-block";
                result.style.verticalAlign = "top";
                options.forEach(opt => {
                    const autoSelected = opt.startsWith(":") ? "selected" : "";
                    const value = opt.startsWith("<") ? "" : (opt.startsWith(":") ? opt.substring(1) : opt);
                    result.innerHTML += "<option value='" + value + "' " + autoSelected + ">" + opt.replaceAll("<", "&lt;").replaceAll(">", "&gt;") + "</option>";
                });
                return result;
            }

            static createIntelligentMultiSelect(options) {
                const result = this.createSelect(options);
                result.onclick = function (e) {
                    if (e.ctrlKey) {
                        result.multiple = "multiple";
                    } else if (e.altKey) {
                        result.multiple = "";
                    }
                }
                return result;
            }
        }

        static matches(itemOrSkill) {
            const result = this.#matches(itemOrSkill);
            if (false) {
                for (var i = 0, l = itemOrSkill.data.bedingungen2.length; i < l; i++) {
                    const bedingung = itemOrSkill.data.bedingungen2[i];
                    if (bedingung.includes("Geister")) return true;
                }
                return false;
            }
            if (false && itemOrSkill.data && itemOrSkill.data.bedingungen) {
                console.log(itemOrSkill);
                for (const [name, comp] of Object.entries(itemOrSkill.data.bedingungen)) {
                    if (comp.comp === "bis") return true;
                }
                return false;
            }
            if (this.debug) console.log("Matches", result);
            return result;
        }

        static #matches(itemOrSkill, isItem) {
            this.debug = itemOrSkill.name.includes("Thanat");
            if (this.debug) console.log(itemOrSkill);
            const suchfeldWert = WoD.getSuchfeld().value.trim();
            if (suchfeldWert !== "") {
                const matching = "^(" + suchfeldWert.replaceAll("*", ".*") + ")$";
                if (!itemOrSkill.name.match(matching)) return false;
            }
            for (var i = 0, l = this.QueryTable.validators.length; i < l; i++) {
                const currentValidator = this.QueryTable.validators[i];
                if (!currentValidator) continue;
                const currentValidatorResult = (_.EffectsParser.isItem(itemOrSkill) ? currentValidator.matchesItem(itemOrSkill) : (Object.keys(itemOrSkill.classInfo).length > 0 && currentValidator.matchesSkill(itemOrSkill))) || false;
                const negatorWish = this.QueryTable.negators[i] || false;
                if (this.debug) console.log("Matches2", currentValidatorResult, negatorWish);
                if (currentValidatorResult === negatorWish) return false;
            }
            return true;
        }

    }

    class SkillsPageExtended {
        static async start() {
            const contentTableBody = document.querySelector(".content_table tbody");

            for (const tr of contentTableBody.children) {
                const add = function (name, isHeader) {
                    const th = isHeader ? document.createElement("th") : document.createElement("td");
                    th.innerHTML = name;
                    tr.append(th);
                }
                if (tr.className === "header") {
                    add("Fertigkeitenklasse", true);
                    add("Typ", true);
                    add("Verwendbarkeit", true);
                    add("Häufigkeit", true);
                } else {
                    const skillName = tr.children[1].textContent.trim();
                    const skill = await _.WoDSkillsDb.getSkill(skillName);
                    if(!skill) {
                        ItemAutoLoader.autoLoadSkill(skillName);
                    }
                    add(skill ? this.getText(skill.klasse) : "???");
                    add(this.getTypText(skill));
                    add(this.getVerwendungText(skill))
                    add(this.getHauefigkeitText(skill))
                }
            }
        }

        static getText(obj) {
            if (obj) return obj;
            return "-";
        }

        static getTargetText(skill) {
            if (!skill) return "???";
            const target = skill.target;
            if (!target) return "";
            const range = this.getRangeText(skill);
            if (target === "Alle Mitstreiter auf einer Position" || target === "Alle Gegner einer Position") return "Position, " + range;
            if (target === "Alle Gegner" && range === "Alle") return "Alle";
            if (target === "Alle Gegner" && range === "1" || target === "Ein Gegner") return "1";
            if (target === "Eigene Gruppe" || target === "Alle Gegner") return "Gruppe, " + range;
            // TODO: "Alle Gegner" muss geprüft werden, ob es wirklich alle Gegner ist. Es kann "Position" oder "Alle" sein.
            return target;
        }

        static getTypText(skill) {
            if (!skill) return "???";
            let result = skill.typ;
            if (result === "Angriff" || result === "Verschlechterung") {
                result += ": " + skill.angriffstyp;
            }
            const range = this.getTargetText(skill);
            if (range) result += " (" + range + ")";
            return result;
        }

        static getRangeText(skill) {
            if (!skill.range) return "";
            return skill.range.replaceAll("der Heldenstufe", "HS").replaceAll("der Fertigkeitenstufe", "FR");
        }

        static getVerwendungText(skill) {
            if (!skill || !skill.verwendung) return "???";
            let result = [];
            if (skill.verwendung.vr) result.push("VR");
            if (skill.verwendung.hr) result.push("HR");
            if (skill.verwendung.p) result.push("Parade");
            if (skill.verwendung.i) result.push("Initiative");
            if (skill.verwendung.h) result.push("Heilung");
            if (result.length === 0) return "-";
            return result.join(" / ");
        }

        static getHauefigkeitText(skill) {
            if(!skill) return "???";
            let prio = Number.MAX_VALUE;
            let result = "";
            let setResult = function (prioNr, resultText) {
                if (prioNr < prio) {
                    result = resultText;
                }
            }
            const effects = skill?.effects?.target;
            if(effects) {
                for (const [type, typeDef] of Object.entries(effects)) {
                    for (const effect of typeDef) {
                        const dauer = effect.dauer;
                        if (!dauer) continue;
                        if (dauer === "unbegrenzt") {
                            return "Einmalig";
                        }
                        if (dauer.endsWith("Kampfende")) {
                            setResult(1, "pro Kampf");
                        } else if (dauer.endsWith("Runde") || dauer.endsWith("Runden")) {
                            let anzahlRunden;
                            if (dauer === "eine Runde") {
                                anzahlRunden = 1;
                            } else {
                                anzahlRunden = dauer.match(/(\d+) Runde/)[1];
                            }
                            setResult(2, anzahlRunden + " " + (anzahlRunden === 1 ? "Runde" : "Runden"));
                        } else if (dauer.endsWith("Rundenende")) {
                            setResult(3, "pro Runde");
                        } else {
                            setResult(10, "-");
                        }

                    }
                }
            } else {
                if(skill.typ==="Angriff" || skill.typ === "Parade" || skill.typ === "Heilung" || skill.typ === "Initiative") {
                    return "immer";
                } else if(Object.keys(skill.verwendung).length === 0) {
                    return "";
                } else if(skill.item) {
                    return "Gegenstand";
                } else if(skill.typ === "Verschlechterung") { // z.B. Hinterhalt mit 0 aufliegenden "Effekten"
                    return "immer";
                } else {
                    return "???";
                }
            }
            return result;
        }
    }

    class MyStorage {

        static async initMyStorage(indexedDb) {
            this.indexedDb = indexedDb;
            this.indexedDbLocal = _.Storages.IndexedDb.getDb(Mod.dbname, "ItemDB");
            await this.init(this.indexedDb);
        }

        static async init() {
            const adjust = function (objStore) {
                if (!objStore) return;
                let resultGetValue = objStore.getValue;
                objStore.getValue = async function (dbObjectId) {
                    dbObjectId = dbObjectId.toLocaleLowerCase().trim();
                    return await resultGetValue.call(objStore, dbObjectId);
                }
                let resultSetValue = objStore.setValue;
                objStore.setValue = async function (dbObject) {
                    dbObject.id = dbObject.name.toLocaleLowerCase().trim();
                    await resultSetValue.call(objStore, dbObject);
                }
                let resultDeleteValue = objStore.deleteValue;
                objStore.deleteValue = async function (dbObjectId) {
                    dbObjectId = dbObjectId.toLocaleLowerCase().trim();
                    await resultDeleteValue.call(objStore, dbObjectId);
                }
                return objStore;
            }
            this.item = adjust(this.indexedDb.createObjectStorage("item", "id"));
            this.itemSources = adjust(this.indexedDb.createObjectStorage("itemSources", "id"));
            this.itemIndex = adjust(this.indexedDb.createObjectStorage("itemIndex", "id"));
        }


        static getItemIndexDB() {
            return this.itemIndex;
        }

        static getItemSourceDB() {
            return this.itemSources;
        }

        static getItemDB() {
            return this.item;
        }

        static async getItem_Deprecated(itemName) {
            if (!this.itemSources.getValue(itemName)) {
                const newItem = {name: itemName};
                await this.itemSources.setValue(newItem);
            }
            let result = this.item.getValue(itemName);
            if (!result) {
                const newItem = {name: itemName};
                await this.item.setValue(newItem);
                result = newItem;
            }
            return result;
        }

        static async indexItem(itemName, itemA, itemIndex) {
            const missingMeElement = itemA.parentElement.className === "missingWrapper" && itemA.parentElement.querySelector(".missingMe");
            if (!itemIndex || !itemIndex.data) {
                if (!missingMeElement) {
                    if (!itemA.parentElement.classList.contains("missingWrapper")) {
                        const missingWrapper = document.createElement("div");
                        missingWrapper.style.display = "inline";
                        missingWrapper.className = "missingWrapper";
                        itemA.parentElement.insertBefore(missingWrapper, itemA);
                        missingWrapper.append(itemA);
                        missingWrapper.onclick = function () {
                            // Remove missingMe marker
                            if (missingWrapper.children.length > 1) {
                                missingWrapper.removeChild(missingWrapper.children[1]);
                            }
                        }
                    }
                    const missingSpan = document.createElement("span");
                    missingSpan.onclick = function (event) {
                        event.stopPropagation();
                    }
                    missingSpan.classList.add("nowod");
                    missingSpan.style.color = "red";
                    missingSpan.style.fontSize = "0.9em";
                    missingSpan.style.marginLeft = "3px";
                    missingSpan.innerHTML = _.UI.SIGNS.MISSING;
                    missingSpan.className = "missingMe";
                    missingSpan.title = "Gegenstand ist der Item-Datenbank noch nicht bekannt!";
                    itemA.parentElement.append(missingSpan);
                }
            } else {
                if (missingMeElement) {
                    itemA.parentElement.removeChild(missingMeElement);
                }
            }
            if (!itemIndex) {
                const newItem = _.WoDItemDb.createItem(itemName);
                await this.itemIndex.setValue(newItem);
            }
        }
    }


    class WoD {
        static AUSWAHL_IDS = [3, 4, 5, 6, 7, 10, 11];

        static getSuchfeld() {
            return this.getSuchInput("item_?name");
        }

        static getSuchInput(nameSchema) {
            for (var i = 0, l = this.AUSWAHL_IDS.length; i < l; i++) {
                const curName = nameSchema.replace("?", this.AUSWAHL_IDS[i]);
                const result = document.getElementsByName(curName)[0];
                if (result) return result;
            }
            console.error("SuchInput nicht gefunden: " + nameSchema);
        }

        static getAuswahlliste(nameSchema) {
            var selectInput = this.getSuchInput(nameSchema);
            const result = Array();
            util.forEach(selectInput.options, a => {
                let curText = a.text.trim();
                if (curText !== "") {
                    curText = curText.replace("...G", " (G").replace("...", " ");
                    result.push(curText);
                }
            })
            return result;
        }
    }

    class util {
        static forEach(array, fn) {
            for (var i = 0, l = array.length; i < l; i++) {
                fn(array[i]);
            }
        }

        static twoListMatch(list1, list2) {
            for (const cur of list1) {
                if (list2.includes(cur)) return true;
            }
            return false;
        }

        static getSelectedOptions(selectInput) {
            const result = [];
            var options = selectInput.selectedOptions;
            for (var i = 0, l = options.length; i < l; i++) {
                const opt = options[i];
                result.push(opt.value || opt.text);
            }
            return result;
        }

        static span(text) {
            const result = document.createElement("span");
            result.innerHTML = text;
            return result;
        }

        static createCheckboxInTd(parent, id, labelTitle) {
            const result = document.createElement("input");
            result.type = "checkbox";
            result.id = id;
            var td = document.createElement("td");
            td.append(result);
            const label = document.createElement("label");
            label.for = id;
            label.innerText = labelTitle;
            td.append(label);
            parent.append(td);
            return [result, label, td];
        }

        static createCheckBoxInSpan(id, labelTitle) {
            const result = document.createElement("input");
            result.type = "checkbox";
            result.id = id;
            var span = document.createElement("span");
            span.append(result);
            const label = document.createElement("label");
            label.for = id;
            label.innerText = labelTitle;
            span.append(label);
            return [result, label, span];
        }

        static createTextInput(width) {
            const result = document.createElement("input");
            result.type = "text";
            if (width) result.style.width = width;
            return result;
        }

    }

    Mod.startMod();

})();
