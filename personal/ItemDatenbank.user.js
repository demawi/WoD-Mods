// ==UserScript==
// @name           [WoD] Item-Datenbank
// @namespace      demawi
// @description    Datenbank der Items und Suche
// @include        https://*.world-of-dungeons.*/wod/spiel/*
// @require        https://raw.githubusercontent.com/demawi/WoD-Mods/refs/heads/master/repo/DemawiRepository.js?version=1.0.4
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
    let debug = false;

    const _Storages = demawiRepository.import("Storages");
    const _WoDStorages = demawiRepository.import("WoDStorages");
    const _WoDLootDb = demawiRepository.import("WoDLootDb");
    const _BBCodeExporter = demawiRepository.import("BBCodeExporter");
    const _File = demawiRepository.import("File");
    const _WoD = demawiRepository.import("WoD");
    const _util = demawiRepository.import("util");
    const _UI = demawiRepository.import("UI");

    class Mod {
        static dbname = "wodDB";
        static currentDataVersion = 1;
        static currentItemDataVersion = 3; // durch eine Veränderung werden die Items neu aus den Sourcen beschrieben

        static async startMod() {
            const page = _util.getWindowPage();
            console.log("StartMod: ItemDB '" + page + "'");

            // Links zu Items finden und markieren. Nahezu überall.
            if (page !== "item.php") {
                await ItemTracking.start();

                // Sofern Gegenstandsseite des Kampfberichtes: Fund hinzufügen.
                // combat_report: Schlacht
                if (page === "report.php" || page === "combat_report.php") {
                    await ItemReaderKampfberichtArchiv.start();
                }
            }

            // Gegenstandsseite. Einlesen der Item-Werte.
            if (page === "item.php") {
                await ItemReader.start();
                await ItemFunde.start();
            }

            // Einbinden der Such-UI.
            if (page === "items.php" || page === "trade.php") await ItemSearchUI.start();
        }
    }

    class ItemFunde {

        static async start() {
            const hints = document.getElementsByClassName("hints")[0];
            if (!hints) return;
            const all = document.getElementsByTagName("h1")[0];
            const itemName = all.getElementsByTagName("a")[0].childNodes[0].textContent.trim();
            if (!itemName) return;
            const item = await MyStorage.getItemLootDB().getValue(itemName);
            const loot = item && (item.loot || []);

            const header = ["Dungeon", "Welt", "Zeit", "Stufe"];
            let content = [];
            let stufeMin = Number.MAX_VALUE;
            let stufeMax = Number.MIN_VALUE;
            const dungeons = {};
            const entries = Object.entries(loot);
            for (const [key, value] of entries) {
                const stufe = Number(value.stufe) || Number(value.stufe_);
                if (stufe < stufeMin) stufeMin = stufe;
                if (stufe > stufeMax) stufeMax = stufe;
                dungeons[value.loc] = true;
                content.push([value.loc, value.world, _util.formatDateAndTime(new Date(Number(key))), value.stufe || "(" + value.stufe_ + ")"]);
            }
            content.sort((a, b) => {
                console.log(a[0]);
                return a[0].localeCompare(b[0]);
            });
            const table = _UI.createContentTable(content, header);
            table.style.marginLeft = "15px";
            table.classList.add("nowod");
            const lootUeberschrift = document.createElement("h3");
            lootUeberschrift.style.marginLeft = "15px";
            lootUeberschrift.innerHTML = "Fundorte";
            hints.parentElement.insertBefore(lootUeberschrift, hints);
            hints.parentElement.insertBefore(table, hints);
            if (entries.length > 0) {
                const aggregateInfos = [];
                aggregateInfos.push(["Stufe (min-max):", stufeMin + "-" + stufeMax]);
                aggregateInfos.push(["Unterschiedliche Dungeons:", Object.entries(dungeons).length]);
                const aggregateTable = _UI.createContentTable(aggregateInfos);
                aggregateTable.classList.add("nowod");
                aggregateTable.style.marginLeft = "15px";
                hints.parentElement.insertBefore(aggregateTable, table);
            }
        }
    }

    class ItemReader {
        static createItem(itemName) {
            return {
                name: itemName,
                time: new Date().getTime(),
                world: _WoD.getMyWorld(),
            }
        }

        static async start() {
            //await MyStorage.indexedDb.cloneTo("wodCopy");
            var link = document.getElementById("link");
            if (!link) {
                if (document.documentElement.textContent.includes("Der Gegenstand existiert nicht")) {
                    let itemName = document.querySelector("form input[name='name']").value;
                    console.log("Gegenstand existiert nicht '" + itemName + "'");
                    await MyStorage.notExistingItem(itemName.trim());
                }
                return;
            }
            if (ItemParser.hasSetOrGemBonus(link)) {
                console.log("Set oder gem-boni entdeckt! Item wird nicht für die Datenbank verwendet!");
                return;
            }
            link = link.innerHTML;
            const details = document.getElementById("details").innerHTML;

            const all = document.getElementsByTagName("h1")[0];
            var itemName = all.getElementsByTagName("a")[0].childNodes[0].textContent.trim();
            const sourceItem = this.createItem(itemName);
            sourceItem.details = details;
            sourceItem.link = link;
            await MyStorage.getItemSourceDB().setValue(sourceItem);
            const item = await ItemParser.getItemDataFromSource(sourceItem);
            await MyStorage.getItemDB().setValue(item);
            console.log("Gegenstand der ItemDB hinzugefügt: ", sourceItem, item);
        }
    }

    class ItemAutoLoader {
        static async start() {
            const item = await this.findNext();
            if (item) {
                // console.log("Auto-Load Item: " + item.name);
                const iframe = document.createElement("iframe");
                iframe.src = WoD.getItemUrl(item.name);
                iframe.style.display = "none";
                document.body.append(iframe);
            }
        }

        static async findNext() {
            const allItems = await MyStorage.getItemSourceDB().getAll();
            for (const sourceItem of allItems) {
                if (sourceItem.invalid) continue;
                if (!sourceItem.details) return sourceItem;
            }
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

            async function checkSiteForItems() {
                console.log("ItemDB.checkSiteForItems...");
                const allHrefs = document.getElementsByTagName("a");
                var missingItemsFound = 0;
                for (var i = 0, l = allHrefs.length; i < l; i++) {
                    const itemLinkElement = allHrefs[i];
                    const itemName = util.getItemNameFromElement(itemLinkElement);
                    if (!itemName) continue;

                    const sourceItem = await MyStorage.getItemSourceDB().getValue(itemName);
                    if (sourceItem && sourceItem.invalid) continue;
                    if (!sourceItem || !sourceItem.details) missingItemsFound++;
                    await MyStorage.indexItem(itemName, itemLinkElement, sourceItem);
                }
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
            }

            await checkSiteForItems();
            setInterval(async function () {
                checkSiteForItems();
            }, 10000);
            ItemAutoLoader.start();
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
                    const allItems = await MyStorage.getItemSourceDB().getAll();
                    var itemsToLoad = 0;
                    var allItemCount = 0;
                    for (const item of allItems) {
                        if (item.invalid) continue;
                        if (!item.details || item.irregular) {
                            itemsToLoad++;
                        }
                        allItemCount++;
                    }
                    missingSearchLabel.innerText = "Fehlend [" + itemsToLoad + "/" + allItemCount + "]";
                }

                updateMissingButton(); // kein await benötigt

                const mySearchTable = ItemSearch.QueryTable.create();
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
                    navigator.clipboard.writeText(_BBCodeExporter.toBBCode(resultContainer));
                }

                WoD.getSuchfeld().onkeydown = function (event) {
                    // Enter abfangen und den aktuellen Such-Button auslösen
                    if (event.keyCode === 13) {
                        event.preventDefault();
                        buttonContainer.children[0].click();
                    }
                };

                function changeContainer() {
                    ItemSearch.SearchDomains.fetchDataForAuswahllisten();
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

                function getItemValue(obj, columnDef, pfadArray) {
                    if (!pfadArray) pfadArray = columnDef.pfadArray;
                    if (!obj) return "";
                    if (pfadArray.length === 0) {
                        if (columnDef.toHTML) return columnDef.toHTML(obj);
                        if (typeof obj === "string") return obj;
                        return JSON.stringify(obj);
                    }
                    return getItemValue(obj[pfadArray[0]], columnDef, pfadArray.slice(1));
                }

                var sortOrderColumnDef;

                async function getItemResult() {
                    var items;
                    if (itemDBSearch.checked) {
                        items = await MyStorage.getItemDB().getAll();
                    } else {
                        items = await MyStorage.getItemSourceDB().getAll();
                    }
                    const itemResult = Array();
                    for (const item of items) {
                        if (item.invalid) continue;
                        if (missingSearch.checked && !item.details || missingSearch.checked && item.details && item.irregular || itemDBSearch.checked && item.data && ItemSearch.matches(item)) {
                            itemResult.push(item);
                        }
                    }
                    if (sortOrderColumnDef) {
                        itemResult.sort((a, b) => {
                            return getItemValue(a, sortOrderColumnDef).localeCompare(getItemValue(b, sortOrderColumnDef));
                        })
                    }
                    return itemResult;
                }

                const updateResultTable = async function () {
                    // Search and display result
                    if (resultContainer.children.length > 0) {
                        resultContainer.removeChild(resultContainer.children[0]);
                    }
                    const itemResults = await getItemResult()

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
                    headTR.innerHTML += "<th></th><th>Gegenstand (" + itemResults.length + ")</th>";

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

                    for (const item of itemResults) {
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
                            td.innerHTML = getItemValue(item, columnDef);
                            tr.append(td);
                        }

                        const itemSpan = document.createElement("span");
                        const href = document.createElement("a");
                        itemSpan.append(href);
                        const url = WoD.getItemUrl(item.name);
                        href.href = url;
                        href.target = "ItemView";
                        href.innerHTML = item.name;

                        if (itemDBSearch.checked) {
                            for (let i = 0, l = item.data.edelslots; i < l; i++) {
                                if (itemSpan.children.length < 2) {
                                    const abstand = document.createElement("span");
                                    abstand.innerHTML = "&nbsp;";
                                    itemSpan.append(abstand);
                                }
                                const img = document.createElement("img");
                                img.src = "/wod/css/icons/WOD/gems/gem_0.png";
                                itemSpan.append(img);
                            }
                            href.onclick = function () {
                                return wo(url + "&IS_POPUP=1");
                            }
                        } else {
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
            }
            static "Klasse" = {
                pfad: "data.klasse",
                notWhen: "Klasse",
                toHTML: function (obj) {
                    if (obj.typ === "alle") return "alle";
                    if (obj.typ === "nur") {
                        return obj.def.map(a => ItemSearch.SearchDomains.KLASSEN[a]).join(", ");
                    }
                    return Object.keys(ItemSearch.SearchDomains.KLASSEN).filter(a => !obj.def.includes(a)).map(a => ItemSearch.SearchDomains.KLASSEN[a]).join(", ");
                }
            }
            static "Stufe" = {
                pfad: "data.bedingungen.Stufe",
                toHTML: function (obj) {
                    return obj.comp + " " + obj.value;
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
                toHTML: AutoColumns.default2SpaltenOutputWithLink(a => WoD.getLinkForFertigkeit(a)),
            }
            static "Fertigkeit (Betroffener)" = {
                pfad: "effects.target.fertigkeit",
                when: "Bonus - Fertigkeit",
                toHTML: AutoColumns.default2SpaltenOutputWithLink(a => WoD.getLinkForFertigkeit(a)),
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
            }
            static "nutzbar mit" = {
                pfad: "data.fertigkeiten",
                when: "nutzbar mit",
                toHTML: function (obj) {
                    return obj.join("<br>");
                },
            }
        }

        static whenBedingung(when) {
            var validatorIndex = ItemSearch.QueryTable.validatorTypes.indexOf(when);
            var negator = ItemSearch.QueryTable.negators[validatorIndex] || false;
            var validator = validatorIndex > -1;
            return negator !== validator;
        }

        static getAutoColumns() {
            const result = {};
            for (const [title, def] of Object.entries(this.AutoColumnsDefinition)) {
                const notWhen = def.notWhen;
                const when = def.when;
                if (!notWhen && !when || notWhen && !this.whenBedingung(notWhen) || when && this.whenBedingung(when)) {
                    result[title] = {
                        pfadArray: def.pfad.split("."),
                        toHTML: def.toHTML,
                    };
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
            var hsInput = ItemSearch.QueryTable.getHsInput();
            if (hsInput === "") hsInput = null;
            else hsInput = Number(hsInput);
            var frInput = ItemSearch.QueryTable.getFrInput();
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
                result += (linkFn && linkFn(parade.type) || parade.type) + ": " + bonus + (parade.dauer ? " (" + parade.dauer + (parade.bemerkung ? "/" + parade.bemerkung : "") + ")" : "");
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


    class ItemSearch {


        static SuchKriterien = class SuchKriterien {
            static "Klasse" = (container) => {
                const select1 = ItemSearch.UI.createSelect(["<Klasse>", ...Object.keys(ItemSearch.SearchDomains.KLASSEN)]);
                container.append(select1);
                return {
                    matches: function (item) {
                        if (select1.value === "") return true;
                        const klasse = item?.data?.klasse;
                        if (!klasse || klasse.typ === "alle") return true;
                        if (klasse.typ === "nur") {
                            return klasse.def.includes(select1.value);
                        }
                        return !klasse.def.includes(select1.value);
                    },
                }
            }

            static "Trageort" = (container) => {
                const select1 = ItemSearch.UI.createSelect(["<Trageort>", ...ItemSearch.SearchDomains.TRAGEORT]);
                container.append(select1);
                return {
                    matches: function (item) {
                        if (select1.value === "") return true;
                        const trageort = item?.data?.trageort
                        if (select1.value === "Jegliche Hand/Hände") {
                            for (const curTrageort of ItemSearch.SearchDomains.JEGLICHE_HAND) {
                                if (trageort === curTrageort) return true;
                            }
                            return false;
                        } else if (select1.value === "Waffenhand/Einhändig") {
                            for (const curTrageort of ItemSearch.SearchDomains.WAFFENHAND_EINHAENDIG) {
                                if (trageort === curTrageort) return true;
                            }
                            return false;
                        } else if (select1.value === "Schildhand/Einhändig") {
                            for (const curTrageort of ItemSearch.SearchDomains.SCHILDHAND_EINHAENDIG) {
                                if (trageort === curTrageort) return true;
                            }
                            return false;
                        } else if (select1.value === "Waffenhand/Schildhand/Einhändig") {
                            for (const curTrageort of ItemSearch.SearchDomains.WAFFENHAND_SCHILDHAND_EINHAENDIG) {
                                if (trageort === curTrageort) return true;
                            }
                            return false;
                        }

                        return trageort === select1.value;
                    },
                }
            }

            static "Verbrauchsgut" = (container) => {
                const select1 = ItemSearch.UI.createSelect(["<Verbrauchsgut>", "JA", "nein"]);
                container.append(select1);
                return {
                    matches: function (item) {
                        if (select1.value === "") return true;
                        if (select1.value === "JA") {
                            return item.data?.isVG;
                        } else {
                            return !item.data?.isVG;
                        }
                    },
                }
            }

            static "Gegenstandsklasse" = (container) => {
                const select1 = ItemSearch.UI.createSelect(["<Gegenstandsklasse>", ...ItemSearch.SearchDomains.GEGENSTANDSKLASSEN]);
                container.append(select1);
                return {
                    matches: function (item) {
                        if (select1.value === "") return true;
                        const klassen = item.data?.gegenstandsklassen;
                        if (klassen) {
                            if (select1.value === "Veredelungsart: Keine Waffe, keine Rüstung") {
                                return util.twoListMatch(klassen, ItemSearch.SearchDomains.VEREDELUNGSART_SCHADEN_OHNE_WAFFE);
                            }
                            return klassen.includes(select1.value);
                        }
                        return false;
                    },
                }
            }

            static "nutzbar mit" = (container) => {
                const select1 = ItemSearch.UI.createSelect(["<Fertigkeit>", ...ItemSearch.SearchDomains.FERTIGKEITEN]);
                container.append(select1);
                return {
                    matches: function (item) {
                        if (select1.value === "") return true;
                        const fertigkeiten = item.data?.fertigkeiten;
                        if (fertigkeiten) {
                            return fertigkeiten.includes(select1.value);
                        }
                        return false;
                    },
                }
            }

            static "Besitzer/Betroffener" = (container) => {
                const selectBesitzerBetroffener = ItemSearch.UI.createSelect(ItemSearch.SearchDomains.BESITZER_BETROFFENER);
                container.append(selectBesitzerBetroffener);
                return {
                    matches: function (item) {
                        if (selectBesitzerBetroffener.value === "Besitzer") {
                            return item.effects.owner;
                        } else if (selectBesitzerBetroffener.value === "Betroffener") {
                            console.log(item.effects.target);
                            return item.effects.target;
                        }
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
                    matches: function (item) {
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
                    matches: function (item) {
                        if (textFrom.value === "") textFrom.value = 1;
                        var from = textFrom.value.trim();
                        var to = textTo.value.trim();
                        if (from === "") from = null;
                        if (to === "") to = null;
                        if (!from && !to) return true;
                        if (from && to && to < from) return false; // keine Klassen eingeschlossen
                        const anzahlEdelslots = Number(item.data?.edelslots || 0);
                        if (from !== null && Number(from) > anzahlEdelslots) return false;
                        if (to !== null && Number(to) < anzahlEdelslots) return false;
                        return true;
                    },
                }
            }

            static "Bonus - Eigenschaft" = (container) => this.effects2Kriterium(container, "eigenschaft", ["<Eigenschaft>", ...Object.values(ItemSearch.SearchDomains.EIGENSCHAFTEN)])
            static "Bonus - Fertigkeit" = (container) => this.effects2Kriterium(container, "fertigkeit", ["<Fertigkeit>", ...Object.values(ItemSearch.SearchDomains.FERTIGKEITEN)])
            static "Bonus - Talentklasse" = (container) => this.effects2Kriterium(container, "talentklasse", ["<Talentklasse>", ...ItemSearch.SearchDomains.TALENTKLASSEN])

            static "Bonus - Angriff" = (container) => this.effects2Kriterium(container, "angriff", ["<Angriffstyp>", ...ItemSearch.SearchDomains.ANGRIFFSTYPEN])
            static "Bonus - Parade" = (container) => this.effects2Kriterium(container, "parade", ["<Parade>", ...ItemSearch.SearchDomains.PARADETYPEN])
            static "Bonus - Schaden" = (container) => this.schadenRuestung(container, true);
            static "Bonus - Rüstung" = (container) => this.schadenRuestung(container, false);

            static schadenRuestung(container, schadenValue) {
                const selectSchadensart = ItemSearch.UI.createSelect(["<Schadensart>", ...ItemSearch.SearchDomains.SCHADENSARTEN]);
                container.append(selectSchadensart);
                const selectBesitzerBetroffener = ItemSearch.UI.createSelect(ItemSearch.SearchDomains.BESITZER_BETROFFENER);
                container.append(selectBesitzerBetroffener);
                const selectAngriffstyp = ItemSearch.UI.createSelect(["<Angriffstyp>", ...ItemSearch.SearchDomains.ANGRIFFSTYPEN]);
                container.append(selectAngriffstyp);
                const selectAZ = ItemSearch.UI.createSelect(["<a/z>", ...ItemSearch.SearchDomains.SCHADENSBONITYP]);
                if (schadenValue) container.append(selectAZ);

                return {
                    matches: function (item) {
                        if (selectSchadensart.value === "" && selectBesitzerBetroffener.value === "" && selectAngriffstyp.value === "" && selectAZ.value === "") return true;

                        var result = Array();

                        if (selectBesitzerBetroffener.value === "Besitzer" || selectBesitzerBetroffener.value === "") {
                            const cur = schadenValue ? item.effects?.owner?.schaden : item.effects?.owner?.ruestung;
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
                            const cur = schadenValue ? item.effects?.target?.schaden : item.effects?.target?.ruestung;
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
                            if (schadenValue && selectAZ.value !== "") {
                                var matches = false;
                                switch (selectAZ.value) {
                                    case ItemSearch.SearchDomains.SCHADENSBONITYP[0]:
                                        matches = !enthaelt("(z)");
                                        break;
                                    case ItemSearch.SearchDomains.SCHADENSBONITYP[1]:
                                        matches = !enthaelt("(a)") && !enthaelt("(z)");
                                        break;
                                    case ItemSearch.SearchDomains.SCHADENSBONITYP[2]:
                                        matches = enthaelt("(a)") && !enthaelt("(z)");
                                        break;
                                    case ItemSearch.SearchDomains.SCHADENSBONITYP[3]:
                                        matches = enthaelt("(a)");
                                        break;
                                    case ItemSearch.SearchDomains.SCHADENSBONITYP[4]:
                                        matches = enthaelt("(z)") && enthaelt("(a)");
                                        break;
                                    case ItemSearch.SearchDomains.SCHADENSBONITYP[5]:
                                        matches = !enthaelt("(a)");
                                        break;
                                    case ItemSearch.SearchDomains.SCHADENSBONITYP[6]:
                                        matches = enthaelt("(z)");
                                        break;
                                    case ItemSearch.SearchDomains.SCHADENSBONITYP[7]:
                                        matches = enthaelt("(z)") && !enthaelt("(a)");
                                        break;
                                }
                                if (!matches) return false;
                            }
                            return true;
                        });
                        return result.length > 0;
                    },
                }
            }

            static effects2Kriterium(container, id, selectArray) {
                const select1 = ItemSearch.UI.createIntelligentMultiSelect(selectArray);
                container.append(select1);
                const select2 = ItemSearch.UI.createSelect(ItemSearch.SearchDomains.BESITZER_BETROFFENER);
                container.append(select2);
                const [checkBox, label, span] = util.createCheckBoxInSpan("debuff_" + id, "Debuff");
                container.append(span);
                return {
                    matches: function (item) {
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
                        const selectedOptions = ItemSearch.SuchKriterien.getSelectedOptions(select1);
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
                if (!this.GEGENSTANDSKLASSEN) {
                    this.GEGENSTANDSKLASSEN = WoD.getAuswahlliste("item_?item_class");
                    this.GEGENSTANDSKLASSEN.push("Duellbelohnung");
                    this.GEGENSTANDSKLASSEN.push("Einzigartige Duellbelohnung");
                    this.GEGENSTANDSKLASSEN.push("Veredelungsart: Keine Waffe, keine Rüstung");
                    this.GEGENSTANDSKLASSEN.sort();
                    this.FERTIGKEITEN = WoD.getAuswahlliste("item_?any_skill");
                    this.EIGENSCHAFTEN = WoD.getAuswahlliste("item_?bonus_attr");
                    this.TALENTKLASSEN = WoD.getAuswahlliste("item_?any_skillclass");
                }
            }

            static KLASSEN = {
                "Barbar": "Bb",
                "Barde": "Bd",
                "Dieb": "Di",
                "Gaukler": "Ga",
                "Gelehrter": "Ge",
                "Gestaltwandler": "Gw",
                "Gladiator": "Gl",
                "Hasardeur": "Ha",
                "Jäger": "Jä",
                "Klingenmagier": "Km",
                "Magier": "Ma",
                "Mönch": "Mö",
                "Paladin": "Pa",
                "Priester": "Pr",
                "Quacksalber": "Qu",
                "Ritter": "Ri",
                "Schamane": "Sm",
                "Schütze": "Sü",
            }
            static SCHADENSBONITYP = ["Alle Trigger: (a) egal, kein (z)", "Trigger-Additiv: kein (a), kein (z)", "Trigger-Anwendung: (a), kein (z)", "Anwendung: (a), (z) egal", "Anwendung: (a), (z)", "Additiv: kein (a), (z) egal", "Additiv: (a) egal, (z)", "Additiv: kein (a), (z)"];
            static ANGRIFFSTYPEN = ["Nahkampf", "Fernkampf", "Zauber", "Sozial", "Naturgewalt", "Explosion", "Falle entschärfen"];
            static PARADETYPEN = ["Nahkampf", "Fernkampf", "Zauber", "Sozial", "Naturgewalt", "Explosion", "Falle auslösen", "Hinterhalt"];
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
                const select = ItemSearch.UI.createSelect(["<Auswahl>"].concat(Object.keys(ItemSearch.SuchKriterien)));
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
                        const suche = ItemSearch.SuchKriterien[select.value](searchFieldsTD);
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

        static matches(item) {
            const result = this.#matches(item);
            if (false) {
                for (var i = 0, l = item.data.bedingungen2.length; i < l; i++) {
                    const bedingung = item.data.bedingungen2[i];
                    if (bedingung.includes("Geister")) return true;
                }
                return false;
            }
            if (false && item.data && item.data.bedingungen) {
                console.log(item);
                for (const [name, comp] of Object.entries(item.data.bedingungen)) {
                    if (comp.comp === "bis") return true;
                }
                return false;
            }
            if (this.debug) console.log("Matches", result);
            return result;
        }

        static #matches(item) {
            this.debug = item.name.includes("Thanat");
            if (this.debug) console.log(item);
            const suchfeldWert = WoD.getSuchfeld().value.trim();
            if (suchfeldWert !== "") {
                const matching = "^(" + suchfeldWert.replaceAll("*", ".*") + ")$";
                if (!item.name.match(matching)) return false;
            }
            for (var i = 0, l = this.QueryTable.validators.length; i < l; i++) {
                const currentValidator = this.QueryTable.validators[i];
                if (!currentValidator) continue;
                const currentValidatorResult = currentValidator.matches(item) || false;
                const negatorWish = this.QueryTable.negators[i] || false;
                if (this.debug) console.log("Matches2", currentValidatorResult, negatorWish);
                if (currentValidatorResult === negatorWish) return false;
            }
            return true;
        }

    }

    class ItemParser {
        static hasSetOrGemBonus(linkElement) {
            return linkElement.getElementsByClassName("gem_bonus_also_by_gem").length > 0 || linkElement.getElementsByClassName("gem_bonus_only_by_gem").length > 0;
        }

        static async rewriteAllItemsFromSource() {
            console.log("rewriteAllItemsFromSource");
            let itemSources = await MyStorage.getItemSourceDB().getAll();
            for (const itemSource of itemSources) {
                if (itemSource.invalid) {
                    await MyStorage.getItemDB().deleteValue(itemSource.name);
                } else {
                    let item = await this.getItemDataFromSource(itemSource);
                    await MyStorage.getItemDB().setValue(item);
                }
            }
        }

        static async getItemDataFromSource(itemSource) {
            let item = await MyStorage.getItemDB().getValue(itemSource.name);
            if (!item) {
                item = {
                    name: itemSource.name,
                }
            }
            item.details = itemSource.details; // nur temporär
            item.link = itemSource.link; // nur temporär
            await this.#writeItemData(item);
            delete item.details;
            delete item.link;
            return item;
        }

        // nimmt die Rohdaten (.details/.link) aus dem Objekt und schreibt die abgeleiteten Daten
        static async #writeItemData(item) {
            try {
                this.writeItemData(item);
                this.writeItemDataEffects(item);
                item.dataVersion = Mod.currentItemDataVersion;
            } catch (error) {
                console.log(error);
                //alert(error);
                throw error;
            }
        }

        static writeItemData(item) {
            const div = document.createElement("div");
            div.innerHTML = item.details;
            const data = {};
            item.data = data;
            const tableTRs = div.querySelectorAll('tr.row0, tr.row1');
            for (var i = 0, l = tableTRs.length; i < l; i++) {
                const tr = tableTRs[i];
                const kategorie = util.html2Text(tr.children[0].innerHTML.split("<br>")[0]);
                switch (kategorie) {
                    case "Besonderheiten":
                        var besonderheiten = tr.children[1].textContent.trim();
                        if (besonderheiten === "Veredelungen") {
                            data.veredelung = true;
                        } else {
                            var matches = besonderheiten.match(/(.\d*)x veredelbar/);
                            if (!matches) {
                                console.error("Unbekannte Besonderheit entdeckt", item.name, besonderheiten);
                                alert("Unbekannte Besonderheit entdeckt");
                            }
                            data.edelslots = matches[1];
                        }
                        break;
                    case "Heldenklassen":
                        var heldenklassen = tr.children[1].textContent.trim();
                        var typ;
                        var def;
                        if (heldenklassen.startsWith("ausschließlich für")) {
                            typ = "nur";
                            def = Array();
                            for (const klasse of tr.children[1].getElementsByTagName("span")) {
                                def.push(klasse.textContent.trim());
                            }
                        } else if (heldenklassen.startsWith("nicht für")) {
                            typ = "nicht";
                            def = Array();
                            for (const klasse of tr.children[1].getElementsByTagName("span")) {
                                def.push(klasse.textContent.trim());
                            }
                        } else if (heldenklassen.startsWith("für alle")) {
                            typ = "alle";
                        }
                        data.klasse = {
                            typ: typ,
                            def: def,
                        }
                        break;
                    case "Voraussetzungen":
                        let bedingungen = {};
                        let freieBedingungen = Array();
                        util.forEach(tr.children[1].children, elem => {
                            if (elem.tagName === "BR") return;
                            let line = elem.textContent.trim();
                            if (line === "") return;
                            const matches = line.trim().match(/^(.*) (ab|bis) (\d*)$/);
                            if (matches) {
                                bedingungen[matches[1]] = {
                                    comp: matches[2],
                                    value: matches[3],
                                };
                            } else {
                                freieBedingungen.push(line);
                            }
                        })
                        data.bedingungen = bedingungen;
                        data.bedingungen2 = freieBedingungen;
                        break;
                    case "Gegenstandsklasse": {
                        const gegenstandsklassen = Array();
                        util.forEach(tr.children[1].getElementsByTagName("a"), a => {
                            gegenstandsklassen.push(a.textContent.trim());
                        });
                        data.gegenstandsklassen = gegenstandsklassen;
                        break;
                    }
                    case "Wirkung": {
                        const value = tr.children[1].textContent.trim();
                        if (value !== "-") {
                            const matches = value.match(/(Stufe \d*,\d*)?[\n]?(.*)/);
                            let stufe = matches[1];
                            if (stufe) stufe = stufe.match(/Stufe (\d*).*/)[1];
                            let type = matches[2];
                            if (type) type = type.trim();
                            if (type === "") type = null;
                            data.wirkung = {
                                type: type,
                                value: stufe,
                            }
                        }
                        break;
                    }
                    case "Anwendungen insgesamt": {
                        data.isVG = tr.children[1].textContent.trim() !== "unbegrenzt";
                        break;
                    }
                    case "Fertigkeiten": {
                        const fertigkeiten = Array();
                        util.forEach(tr.children[1].getElementsByTagName("a"), a => {
                            fertigkeiten.push(a.textContent.trim());
                        });
                        data.fertigkeiten = fertigkeiten;
                        break;
                    }
                    case "Wo getragen?":
                        data.trageort = tr.children[1].textContent.trim();
                        break;
                }
            }
        }

        static writeItemDataEffects(item) {
            const div = document.createElement("div");
            div.innerHTML = item.link;
            if (this.hasSetOrGemBonus(div)) {
                item.irregular = true;
            } else {
                delete item.irregular;
            }
            item.effects = {};
            var currentOwnerContext;
            var currentBoniContext;
            var tableType;
            var ownerType;

            function getBoniContext(ctxName) {
                var result = currentOwnerContext[ctxName];
                if (!result) {
                    result = [];
                    currentOwnerContext[ctxName] = result;
                }
                return result;
            }

            for (var i = 0, l = div.children.length; i < l; i++) {
                const cur = div.children[i];
                if (cur.tagName === "H2") {
                    ownerType = this.getOwnerType(cur.textContent.trim());
                    currentOwnerContext = item.effects[ownerType];
                    if (!currentOwnerContext) {
                        currentOwnerContext = {};
                        item.effects[ownerType] = currentOwnerContext;
                    }
                } else if (cur.tagName === "H3") {
                    tableType = this.getType(cur.textContent.trim());
                    currentBoniContext = getBoniContext(tableType);
                } else if (cur.className === "content_table") {
                    const tableTRs = cur.querySelectorAll('tr.row0, tr.row1');
                    switch (tableType) {
                        case "schaden":
                        case "ruestung":
                        case "anfaelligkeit": // 3-Spalten Standard
                            this.addBoni(currentBoniContext, tableTRs, b => {
                                return {
                                    damageType: b.children[0].textContent.trim(),
                                    attackType: b.children[1].textContent.trim(),
                                    bonus: b.children[2].textContent.trim(),
                                    dauer: b.children.length > 3 ? b.children[3].textContent.trim() : undefined,
                                    bemerkung: b.children.length > 4 ? b.children[4].textContent.trim() : undefined,
                                }
                            });
                            break;
                        case "eigenschaft":
                        case "angriff":
                        case "parade":
                        case "wirkung":
                        case "beute": // 2-Spalten-Standard
                            this.addBoni(currentBoniContext, tableTRs, b => {
                                return {
                                    type: b.children[0].textContent.trim(),
                                    bonus: b.children[1].textContent.trim(),
                                    dauer: b.children.length > 2 ? b.children[2].textContent.trim() : undefined,
                                    bemerkung: b.children.length > 3 ? b.children[3].textContent.trim() : undefined,
                                }
                            });
                            break;
                        case "fertigkeit":
                            tableTRs.forEach(b => {
                                var type = b.children[0].textContent.trim();
                                var targetContext;
                                if (type.startsWith("alle Fertigkeiten der Klasse")) {
                                    targetContext = getBoniContext("talentklasse");
                                    type = type.substring(29);
                                } else {
                                    targetContext = currentBoniContext;
                                }
                                targetContext.push({
                                    type: type,
                                    bonus: b.children[1].textContent.trim(),
                                    dauer: b.children.length > 2 ? b.children[2].textContent.trim() : undefined,
                                    bemerkung: b.children.length > 3 ? b.children[3].textContent.trim() : undefined,
                                });
                            });
                            break;
                        default:
                            console.error("Unbekannter Boni-TableType: '" + tableType + "'");
                            alert("Unbekannter Boni-TableType: '" + tableType + "'");
                    }

                }
            }
        }

        static addBoni(currentBoniContext, tableTRs, fn) {
            tableTRs.forEach(b => {
                currentBoniContext.push(fn(b));
            });
        }

        static getType(text) {
            switch (text) {
                case 'Boni auf Eigenschaften':
                    return "eigenschaft";
                case 'Boni auf Paraden':
                    return "parade";
                case 'Boni auf Schaden':
                    return "schaden";
                case 'Boni auf Rüstung':
                    return "ruestung";
                case 'Boni auf den Rang von Fertigkeiten':
                    return "fertigkeit";
                case 'Boni auf Angriffe':
                    return "angriff";
                case 'Boni auf die Wirkung von Fertigkeiten':
                    return "wirkung";
                case 'Boni auf die Anfälligkeit gegen Schäden':
                    return "anfaelligkeit";
                case 'Boni auf Beute aus Dungeonkämpfen':
                    return "beute";
                default:
                    console.error("Unbekannte H3-Item Überschrift: '" + text + "'");
                    alert("Unbekannte H3-Item Überschrift: '" + text + "'");
            }
        }

        static getOwnerType(text) {
            switch (text) {
                case 'Auswirkungen auf den Betroffenen des Gegenstands':
                    return 'target';
                case 'Auswirkungen auf den Besitzer des Gegenstands':
                    return 'owner';
                case 'Auswirkungen auf den Betroffenen der Fertigkeit':
                    return 'target';
                case 'Auswirkungen auf den Besitzer der Fertigkeit':
                    return 'owner';
                case 'Vor- und Nachteile':
                    return 'owner';
                case 'Auswirkungen auf den Betroffenen des Sets':
                    return "target";
                default:
                    if (text.includes('Diese Boni wirken zurzeit auf ')) {
                        return 'owner';
                    }
                    console.error("Unbekannte H2-Item Überschrift: '" + text + "'");
                    alert("Unbekannte H2-Item Überschrift: '" + text + "'");
            }
        }

    }

    class ItemReaderKampfberichtArchiv {

        static async start() {
            await this.readDocument(document);
            //await this.startMigration(true);
        }

        static getStufeFromReport(report) {
            // console.log("getStufeFromReport for ", report);
            if (!report.levels) return;
            for (const level of report.levels) {
                const temp = document.createElement("div");
                temp.innerHTML = level;
                let check = temp.getElementsByClassName("rep_myhero")[0];
                if (check) { // auf die 2te Spalte springen und ausgeben
                    const nextSibling = check.parentElement.nextElementSibling;
                    if (nextSibling) return check.parentElement.nextElementSibling.textContent;
                }
                check = temp.getElementsByClassName("rep_myotherhero")[0];
                if (check) { // auf die 2te Spalte springen und ausgeben
                    const nextSibling = check.parentElement.nextElementSibling;
                    if (nextSibling) return check.parentElement.nextElementSibling.textContent;
                }
                check = temp.getElementsByClassName("rep_hero")[0];
                if (check) { // auf die 2te Spalte springen und ausgeben
                    const nextSibling = check.parentElement.nextElementSibling;
                    if (nextSibling) return check.parentElement.nextElementSibling.textContent;
                }
            }
        }

        static async readDocument(doc, report) {
            // console.log("Document: ", doc);
            if (!doc) return;
            const ueberschrift = doc.getElementsByTagName("h2")[0];
            if (!ueberschrift) return;
            const titleSplit = ueberschrift.textContent.split(/-(.*)/); // only on first occurence
            const dungeonName = titleSplit[1].trim();
            const stufe = (report && this.getStufeFromReport(report)) || _WoD.getMyStufe(doc);
            if (!stufe) console.log("Keine Stufe gefunden: ", report);
            const timeString = (report && report.time) || titleSplit[0].trim();
            const timestamp = _util.parseStandardTimeString(_WoD.getTimeString(timeString));
            const world = _WoD.getMyWorld();
            // console.log("Found Items: " + doc.getElementsByTagName("h3"));
            for (const elem of doc.getElementsByTagName("h3")) {
                if (elem.textContent === "Gefundene Gegenstände") {
                    await this.readGegenstaende(elem.parentElement.getElementsByTagName("table")[0], world, dungeonName, timestamp, stufe);
                }
            }
        }

        static async readGegenstaende(table, world, dungeonName, timestamp, stufe) {
            if (!table) return;
            for (const aHref of table.getElementsByClassName("report")) {
                const itemName = util.getItemNameFromElement(aHref);
                await _WoDLootDb.addLootUnsafe(itemName, dungeonName, timestamp, world, stufe);
            }
        }

    }

    class MyStorage {
        static adjust = function (objStore) {
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
        static indexedDb = new _Storages.IndexedDb("ItemDB", Mod.dbname);
        static itemSources = this.adjust(this.indexedDb.createObjectStore("itemSources", "id"));
        static item = this.adjust(this.indexedDb.createObjectStore("item", "id"));
        static itemLoot = this.adjust(this.indexedDb.createObjectStore("itemLoot", "id"));

        static getItemSourceDB() {
            return this.itemSources;
        }

        static getItemDB() {
            return this.item;
        }

        static getItemLootDB() {
            return this.itemLoot;
        }

        static async notExistingItem(itemName) {
            let item = ItemReader.createItem(itemName);
            item.invalid = true;
            await this.getItemSourceDB().setValue(item);
        }

        static async getItemFromLink(itemLink) {
            const itemName = util.getItemNameFromElement(itemLink);
            if (!itemName) return;
            return await this.getItem(itemName);
        }

        static async getItem(itemName) {
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

        static async indexItem(itemName, element, sourceItem) {
            const missingElement = element.parentElement.className === "missingWrapper" && element.parentElement.children.length > 1 && element.parentElement.children[1];
            if (!sourceItem || !sourceItem.details) {
                if (!missingElement) {
                    if (element.parentElement.className !== "missingWrapper") {
                        const missingWrapper = document.createElement("span");
                        missingWrapper.className = "missingWrapper";
                        element.parentElement.insertBefore(missingWrapper, element);
                        element.parentElement.removeChild(element);
                        missingWrapper.append(element);
                        missingWrapper.onclick = function () {
                            if (missingWrapper.children.length > 1) {
                                missingWrapper.removeChild(missingWrapper.children[1]);
                            }
                        }
                    }
                    const missingSpan = document.createElement("span");
                    missingSpan.onclick = function (event) {
                        event.stopPropagation();
                    }
                    missingSpan.style.color = "red";
                    missingSpan.innerHTML = "�";
                    missingSpan.className = "missingMe";
                    element.parentElement.append(missingSpan);
                }
            } else {
                if (missingElement) {
                    element.parentElement.removeChild(missingElement);
                }
            }
            if (!sourceItem) {
                const newItem = {
                    name: itemName,
                }
                await this.itemSources.setValue(newItem);
            }
        }
    }


    class WoD {
        static AUSWAHL_IDS = [3, 4, 5, 6, 7, 10, 11];

        static getItemUrl(itemName) {
            return "/wod/spiel/hero/item.php?IS_POPUP=1&name=" + _util.fixedEncodeURIComponent(itemName);
        }

        static getSuchfeld() {
            return this.getSuchInput("item_?name");
        }

        static getLinkForFertigkeit(fertigkeit) {
            return "<a href='/wod/spiel/hero/skill.php?name=" + fertigkeit + "&is_popup=1' onclick=\"return wo('/wod/spiel/hero/skill.php?name=" + fertigkeit + "&session_hero_id=373802&IS_POPUP=1');\">" + fertigkeit + "</a>";
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
                const curText = a.text.trim();
                if (curText !== "") result.push(a.text);
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

        static html2Text(html) {
            const span = document.createElement("span");
            span.innerHTML = html;
            return span.textContent.trim();
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

        static getItemNameFromElement(aElement) {
            const curHref = aElement.href;
            var itemName;
            var index = curHref.indexOf("item.php?");
            if (index > 0) {
                itemName = curHref.match(/name=(.*?)&/);
            } else {
                index = curHref.indexOf("/item/");
                if (index > 0) {
                    itemName = curHref.match(/item\/(.*?)&/);
                }
            }
            if (!itemName) return;
            itemName = decodeURIComponent(itemName[1].replaceAll("+", " "));
            return itemName;
        }

    }

    Mod.startMod();

})();
