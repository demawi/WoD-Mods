// ==UserScript==
// @name           [WoD] Item-Datenbank
// @namespace      demawi
// @description    Datenbank der Items und Suche
// @grant   	   GM.getValue
// @grant  		   GM.setValue
// @grant          GM.deleteValue
// @include        http*://*.world-of-dungeons.*/wod/spiel/*
// ==/UserScript==
// *************************************************************
// *** [WoD] Item-Datenbank                                  ***
// *** Dieses Script ist Freeware                            ***
// *** Wer es verbessern will, moege dies tun, aber bitte    ***
// *** nicht meinen Namen entfernen.                         ***
// *** Danke! demawi                                         ***
// *************************************************************

(function() {
    'use strict';

    class Mod {
        static currentDataVersion = 1;
        static currentItemDataVersion = 3; // durch eine Veränderung werden die Items neu aus den Sourcen beschrieben

        static async startMod() {
            const page = util.getWindowPage();
            // Links zu Items finden und markieren. Nahezu überall.
            if (page !== "item.php") await ItemTracking.start();

            // Gegenstandsseite
            if (page === "item.php") await ItemReader.start();

            if (page === "items.php" || page === "trade.php") await ItemSearchUILinker.start();

            await Storage.ensureItemSources();
            const allItemSources = Storage.itemSources;
            var countRetrieved = 0;
            var all = 0;
            for (const [itemName, item] of Object.entries(allItemSources)) {
                all++;
                if (item.details) {
                    countRetrieved++;
                }
            }
            console.log("ItemSources: " + countRetrieved + "/" + all);
            await Storage.validateItems();
        }
    }

    class ItemReader {
        static async start() {
            var link = document.getElementById("link");
            if (ItemParser.hasSetOrGemBonus(link)) {
                console.log("Set oder gem-boni entdeckt! Item wird nicht für die Datenbank verwendet!");
                return;
            }
            link = link.innerHTML;
            const details = document.getElementById("details").innerHTML;

            const all = document.getElementsByTagName("h1")[0];
            var itemName = all.getElementsByTagName("a")[0].textContent.trim();
            if (itemName[itemName.length - 1] === "!") itemName = itemName.substring(0, itemName.length - 1);
            const sourceItem = {
                name: itemName,
                details: details,
                link: link,
            }
            await Storage.gmSetSourceItem(itemName, sourceItem);
            const item = {
                name: itemName,
                details: details,
                link: link,
            }
            await ItemParser.writeItemData(item);
            delete item.details;
            delete item.link;
            await Storage.gmSetItem(itemName, item);
            console.log("Gegenstandsseite", sourceItem, item);
        }
    }

    // Überprüft auf einer Webseite die Gegenstandslinks
    class ItemTracking {

        static async start() {
            const missingSpanOverall = document.createElement("span");
            missingSpanOverall.style.color = "red";
            missingSpanOverall.className = "missingMeOverall";
            missingSpanOverall.style.position = "fixed";
            missingSpanOverall.style.top = "0px";
            missingSpanOverall.style.right = "0px";

            async function checkSiteForItems() {
                console.log("checkSiteForItems");
                const allHrefs = document.getElementsByTagName("a");
                var missingItemsFound = 0;
                var addedItems = 0;
                for (var i = 0, l = allHrefs.length; i < l; i++) {
                    const itemLinkElement = allHrefs[i];
                    const curHref = itemLinkElement.href;
                    var itemName;
                    var index = curHref.indexOf("item.php?");
                    if (index > 0) {
                        itemName = curHref.match(/name=(.*?)&/);
                    } else {
                        index = curHref.indexOf("/item/");
                        if (index > 0) {
                            itemName = curHref.match(/item\/(.*?)&/);
                        } else continue;
                    }
                    if (!itemName) continue;
                    itemName = decodeURIComponent(itemName[1].replaceAll("+", " "));

                    if (index > 0) {
                        await Storage.ensureItemSources();
                        const sourceItem = Storage.itemSources[itemName];
                        if (!sourceItem || !sourceItem.details) missingItemsFound++;
                        if (!sourceItem) addedItems++;
                        await Storage.indexItem(itemName, itemLinkElement, sourceItem);
                    }
                }
                if (addedItems) await Storage.saveItemSources();
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
                await Storage.ensureItemSources(true);
                checkSiteForItems();
            }, 10000);
        }
    }

    class ItemSearchUILinker {
        static async start() {
            // Erweiterung für die Suche
            const searchContainer = document.getElementsByClassName("search_container")[0];
            if (searchContainer) {
                const searchContainerTitle = searchContainer.children[0].children[0].children[0];

                const [itemDBSearch] = util.createCheckbox(searchContainerTitle, "itemDB", "Item-DB");

                const [missingSearch, missingSearchLabel] = util.createCheckbox(searchContainerTitle, "missingSearch", "");

                async function updateMissingButton() {
                    const allItems = await Storage.ensureItemSources();
                    var itemsToLoad = 0;
                    var allItemCount = 0;
                    for (const [itemName, item] of Object.entries(allItems)) {
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

                WoD.getSuchfeld().onkeydown = function (event) {
                    // Enter abfangen und den aktuellen Such-Button auslösen
                    if (event.keyCode === 13) {
                        event.preventDefault();
                        buttonContainer.children[0].click();
                    }
                };

                function changeContainer() {
                    SearchDomains.fetchDataForAuswahllisten();
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

                const updateResultTable = async function () {
                    // Search and display result
                    if (resultContainer.children.length > 0) {
                        resultContainer.removeChild(resultContainer.children[0]);
                    }

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
                    headTR.innerHTML += "<th></th><th>Gegenstand</th>";

                    var columns;
                    if (itemDBSearch.checked) {
                        columns = AutoColumns.getAutoColumns();
                        for (const column of Object.keys(columns)) {
                            headTR.innerHTML += "<th>" + column + "</th>";
                        }
                    } else {
                        columns = Array();
                    }

                    function getItemValue(obj, pfadArray, toHTML, lastHeader) {
                        //console.log("getItemValue", obj, pfadArray);
                        if (!obj) return "";
                        if (pfadArray.length === 0) {
                            if (toHTML) return toHTML(obj);
                            if (typeof obj === "string") return obj;
                            return JSON.stringify(obj);
                        }
                        return getItemValue(obj[pfadArray[0]], pfadArray.slice(1), toHTML, pfadArray[0]);
                    }

                    var i = 1;
                    var switcher = false;
                    var items;
                    if (itemDBSearch.checked) {
                        items = await Storage.ensureItemDB(true);
                    } else {
                        items = await Storage.ensureItemSources(true);
                    }
                    for (const [itemName, item] of Object.entries(items)) {
                        if (missingSearch.checked && !item.details || missingSearch.checked && item.details && item.irregular || itemDBSearch.checked && item.data && ItemSearch.matches(item)) {
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
                                td.innerHTML = getItemValue(item, columnDef.pfadArray, columnDef.toHTML);
                                tr.append(td);
                            }

                            const href = document.createElement("a");
                            const url = "/wod/spiel/hero/item.php?IS_POPUP=1&name=" + encodeURI(itemName);
                            href.href = url;
                            href.target = "ItemView";
                            href.innerHTML = itemName;

                            if (itemDBSearch.checked) {
                                href.onclick = function () {
                                    return wo(url + "&IS_POPUP=1");
                                }
                            } else {
                                href.onclick = function () {
                                    href.parentElement.removeChild(href);
                                    //return wo(url + "&IS_POPUP=1");
                                }
                            }

                            td.append(href);
                            i++;
                        }
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
                        return obj.def.map(a => SearchDomains.KLASSEN[a]).join(", ");
                    }
                    return Object.keys(SearchDomains.KLASSEN).filter(a => !obj.def.includes(a)).map(a => SearchDomains.KLASSEN[a]).join(", ");
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
                toHTML: AutoColumns.default2SpaltenOutput
            }
            static "Fertigkeit (Betroffener)" = {
                pfad: "effects.target.fertigkeit",
                when: "Bonus - Fertigkeit",
                toHTML: AutoColumns.default2SpaltenOutput
            }
            static Gegenstandsklasse = {
                pfad: "data.gegenstandsklassen",
                notWhen: "Gegenstandsklasse",
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
                if (!def.notWhen && !def.when || def.notWhen && !this.whenBedingung(def.notWhen) || def.when && this.whenBedingung(def.when)) {
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


        static replaceHSFRMitBerechnung(text) {
            var result = text.replaceAll("der Heldenstufe", "HS").replaceAll("des Fertigkeitenrangs", "FR").replaceAll("Fertigkeitenrang", "FR").replaceAll("Heldenstufe", "HS");
            var hsInput = ItemSearch.QueryTable.getHsInput();
            if (hsInput === "") hsInput = null;
            else hsInput = Number(hsInput);
            var frInput = ItemSearch.QueryTable.getFrInput();
            if (frInput === "") frInput = null;
            else frInput = Number(frInput);

            var nextResult = Array();
            result.split("<br>").forEach(a => {
                const boni = a.split(":"); // Name, Wert
                nextResult.push(boni[0] + ": " + this.bonusAusrechnen(boni[1], hsInput, frInput));
            });
            //console.log("Ausrechnen", result, nextResult);
            return nextResult.join("<br>");
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

        static default2SpaltenOutput(obj) {
            var result = "";
            obj.forEach(parade => {
                if (result.length > 0) result += "<br>";
                result += parade.type + ": " + parade.bonus;
            });
            return AutoColumns.replaceHSFRMitBerechnung(result);
        }

        static default3SpaltenOutput(obj) {
            var result = "";
            obj.forEach(dmg => {
                if (result.length > 0) result += "<br>";
                result += dmg.damageType + "(" + dmg.attackType + "): " + dmg.bonus;
            });
            return AutoColumns.replaceHSFR(result);
        }

    }


    class SearchDomains {

        static GEGENSTANDSKLASSEN;
        static FERTIGKEITEN;
        static EIGENSCHAFTEN;

        // müssen vorab geholt werden bevor der eigentliche Such-Container ausgebettet wird.
        static fetchDataForAuswahllisten() {
            if (!this.GEGENSTANDSKLASSEN) {
                this.GEGENSTANDSKLASSEN = WoD.getAuswahlliste("item_?item_class");
                this.FERTIGKEITEN = WoD.getAuswahlliste("item_?any_skill");
                this.EIGENSCHAFTEN = WoD.getAuswahlliste("item_?bonus_attr");
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
            "Mönch": "Mo",
            "Paladin": "Pa",
            "Priester": "Pr",
            "Quacksalber": "Qu",
            "Ritter": "Ri",
            "Schamane": "Sm",
            "Schütze": "Sü",
        }
        static SCHADENSBONITYP = ["Zusätzlich (weder a noch z)", "Nur bei Anwendung (a)", "Nur wenn schon vorhanden (z)"];
        static ANGRIFFSARTEN = ["Nahkampf", "Fernkampf", "Zauber", "Sozial", "Naturgewalt"];
        static BESITZER_BETROFFENER = ["<Ziel>", "Besitzer", "Betroffener"];
        static TRAGEORT = ["Kopf", "Ohren", "Brille", "Halskette", "Torso", "Gürtel", "Umhang", "Schultern", "Arme", "Handschuhe", "Jegliche Hand/Hände", "Beide Hände", "Waffenhand", "Schildhand", "Einhändig", "Beine", "Füße", "Orden", "Tasche", "Ring", "nicht tragbar"];
        static JEGLICHE_HAND = ["Beide Hände", "Waffenhand", "Schildhand", "Einhändig"];

        static SCHADENSARTEN = ["Schneidschaden", "Hiebschaden", "Stichschaden", "Eisschaden", "Feuerschaden", "Giftschaden", "Heiliger Schaden", "Manaschaden", "Psychologischer Schaden"];
    }

    class ItemSearch {

        static SuchKriterien = class SuchKriterien {
            static "Klasse" = () => {
                const span = document.createElement("span");
                const select1 = ItemSearch.UI.createSelect(["<Klasse>", ...Object.keys(SearchDomains.KLASSEN)]);
                span.append(select1);
                return {
                    matches: function (item) {
                        const klasse = item?.data?.klasse;
                        if (!klasse || klasse.typ === "alle") return true;
                        if (klasse.typ === "nur") {
                            return klasse.def.includes(select1.value);
                        }
                        return !klasse.def.includes(select1.value);
                    },
                    get: function () {
                        return span;
                    }
                }
            }

            static "Trageort" = () => {
                const span = document.createElement("span");
                const select1 = ItemSearch.UI.createSelect(["<Klasse>", ...SearchDomains.TRAGEORT]);
                span.append(select1);
                return {
                    matches: function (item) {
                        const trageort = item?.data?.trageort
                        if (select1.value === "Jegliche Hand/Hände") {
                            for (const curTrageort of SearchDomains.JEGLICHE_HAND) {
                                if (trageort === curTrageort) return true;
                            }
                            return false;
                        }
                        return trageort === select1.value;
                    },
                    get: function () {
                        return span;
                    }
                }
            }

            static "Gegenstandsklasse" = () => {
                const span = document.createElement("span");
                const select1 = ItemSearch.UI.createSelect(["<Gegenstandsklasse>", ...SearchDomains.GEGENSTANDSKLASSEN]); // GEGENSTANDSKLASSEN
                span.append(select1);
                return {
                    matches: function (item) {
                        if (select1.value === "") return true;
                        const klassen = item.data?.gegenstandsklassen;
                        if (klassen) {
                            return klassen.includes(select1.value);
                        }
                        return false;
                    },
                    get: function () {
                        return span;
                    }
                }
            }

            static "Stufe" = () => {
                const span = document.createElement("span");
                const textFrom = util.createTextInput("50px");
                const textTo = util.createText("50px");
                span.append(textFrom);
                span.append(util.span(" - "));
                span.append(textTo);
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
                            console.log(">>>ab", value, from, to, Number(value) >= Number(from));
                            if (to) return Number(value) <= Number(to);
                            return Number(value) <= Number(from);
                        } else { // bis
                            console.log(">>>bis", value, from, to, !!to);
                            if (from) return Number(value) >= Number(from);
                            return Number(value) >= Number(to);
                        }
                    },
                    get: function () {
                        return span;
                    }
                }
            }

            static "Bonus - Eigenschaft" = () => this.effects2Kriterium("eigenschaft", ["<Eigenschaft>", ...Object.values(SearchDomains.EIGENSCHAFTEN)])
            static "Bonus - Fertigkeit" = () => this.effects2Kriterium("fertigkeit", ["<Fertigkeit>", ...Object.values(SearchDomains.FERTIGKEITEN)])
            static "Bonus - Parade" = () => this.effects2Kriterium("parade", ["<Parade>", ...SearchDomains.ANGRIFFSARTEN])
            static "Bonus - Angriff" = () => this.effects2Kriterium("angriff", ["<Angriff>", ...SearchDomains.ANGRIFFSARTEN])
            static "Bonus - Schaden" = function () {
                const span = document.createElement("span");
                const select1 = ItemSearch.UI.createSelect(["<Schadensart>", ...SearchDomains.SCHADENSARTEN]);
                span.append(select1);
                const select2 = ItemSearch.UI.createSelect(SearchDomains.BESITZER_BETROFFENER);
                span.append(select2);
                const select3 = ItemSearch.UI.createSelect(["<Angriffstyp>", ...SearchDomains.ANGRIFFSARTEN]);
                span.append(select3);
                const select4 = ItemSearch.UI.createSelect(["<a/z>", ...SearchDomains.SCHADENSBONITYP]);
                span.append(select4);

                return {
                    matches: function (item) {
                        var result = Array();
                        if (select2.value === "Besitzer" || select2.value === "") {
                            const cur = item.effects?.owner?.schaden;
                            if (cur) result.push(...cur);
                        }
                        if (select2.value === "Betroffener" || select2.value === "") {
                            const cur = item.effects?.target?.schaden;
                            if (cur) result.push(...cur);
                        }
                        var next = Array();
                        if (select1.value !== "") {
                            result.forEach(cur => {
                                if (cur.damageType === select1.value) {
                                    next.push(cur);
                                }
                            });
                            result = next;
                            next = Array();
                        }
                        if (select4.value !== "") {
                            result.forEach(cur => {
                                var matches = false;
                                switch (select4.value) {
                                    case SearchDomains.SCHADENSBONITYP[0]:
                                        matches = !cur.bonus.includes("(a)") && !cur.attackType.includes("(a)") && !cur.bonus.includes("(z)") && !cur.attackType.includes("(z)");
                                        break;
                                    case SearchDomains.SCHADENSBONITYP[1]:
                                        matches = cur.bonus.includes("(a)") || cur.attackType.includes("(a)");
                                        break;
                                    case SearchDomains.SCHADENSBONITYP[2]:
                                        matches = cur.bonus.includes("(z)") || cur.attackType.includes("(z)");
                                        break;
                                }
                                if (matches) {
                                    next.push(cur);
                                }
                            });
                            result = next;
                            next = Array();
                        }
                        return result.length > 0;
                    },
                    get: function () {
                        return span;
                    }
                }
            }

            static effects2Kriterium(id, selectArray) {
                const span = document.createElement("span");
                const select1 = ItemSearch.UI.createSelect(selectArray);
                span.append(select1);
                const select2 = ItemSearch.UI.createSelect(SearchDomains.BESITZER_BETROFFENER);
                span.append(select2);
                return {
                    matches: function (item) {
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
                        if (select1.value !== "") {
                            result.forEach(cur => {
                                if (cur.type === select1.value && cur.bonus.includes("+")) {
                                    next.push(cur);
                                }
                            });
                            result = next;
                            next = Array();
                        }
                        return result.length > 0;
                    },
                    get: function () {
                        return span;
                    }
                }
            }
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
                const th = document.createElement("th");
                tr.append(th);
                th.colSpan = 10;
                this.thead.append(tr);
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
                const select = ItemSearch.UI.createSelect(["<Auswahl>"].concat(Object.keys(ItemSearch.SuchKriterien)));
                const searchFieldsTD = document.createElement("td");
                tr.append(select);
                tr.append(searchFieldsTD);
                const [checkbox, label] = util.createCheckbox(tr, "", "Negieren");
                checkbox.onclick = function () {
                    const myCurIndex = [...tbody.children].indexOf(tr);
                    console.log("set checked", checkbox.checked);
                    thisObject.negators[myCurIndex] = checkbox.checked;
                }
                checkbox.parentElement.hidden = true;

                select.onchange = function () {
                    const myCurIndex = [...tbody.children].indexOf(tr);
                    if (select.value === "") {
                        searchFieldsTD.removeChild(searchFieldsTD.children[0]);
                        delete thisObject.validators[myCurIndex];
                        delete thisObject.validatorTypes[myCurIndex];
                        checkbox.parentElement.hidden = true;
                        thisObject.checkRemove(myCurIndex);
                    } else {
                        const suche = ItemSearch.SuchKriterien[select.value]();
                        if (searchFieldsTD.children.length > 0) searchFieldsTD.removeChild(searchFieldsTD.children[0]);
                        searchFieldsTD.append(suche.get());
                        checkbox.parentElement.hidden = false;
                        thisObject.validators[myCurIndex] = suche.matches;
                        thisObject.validatorTypes[myCurIndex] = select.value;
                        console.log("test", tbody.children.length, myCurIndex);
                        if (tbody.children.length <= myCurIndex + 1) {
                            thisObject.createAuswahl(myCurIndex + 1);
                        }
                    }
                    console.log("Kriterien", thisObject.validators);
                }
            }

            static checkRemove(i) {
                if (this.tbody.children.length === 1) return false;
                console.log("checkRemove", this.validatorTypes[i], this.tbody.children.length, i);
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
                options.forEach(opt => {
                    const value = opt.startsWith("<") ? "" : opt.replaceAll(":", "");
                    const autoSelected = opt.startsWith(":") ? "selected" : "";
                    result.innerHTML += "<option value='" + value + "' " + autoSelected + ">" + opt.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll(":", "") + "</option>";
                });
                return result;
            }
        }

        static debug = false;

        static matches(item) {
            const result = this.#matches(item);
            if (this.debug) console.log("Matches", result);
            return result;
        }

        static #matches(item) {
            this.debug = item.name.includes("Thanat");
            if (this.debug) console.log(item);
            const suchfeldWert = WoD.getSuchfeld().value.trim();
            if (suchfeldWert !== "") {
                const matching = "^" + suchfeldWert.replaceAll("*", ".*") + "$";
                if (!item.name.match(matching)) return false;
            }
            for (var i = 0, l = this.QueryTable.validators.length; i < l; i++) {
                const currentValidator = this.QueryTable.validators[i];
                if (!currentValidator) continue;
                const currentValidatorResult = currentValidator(item) || false;
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

        // nimmt die Rohdaten (.details/.link) aus dem Objekt und schreibt die abgeleiteten Daten
        static async writeItemData(item) {
            try {
                this.writeItemDataLink(item);
                this.writeItemDataDetails(item);
                item.dataVersion = Mod.currentItemDataVersion;
            } catch (error) {
                console.log(error);
                //alert(error);
                throw error;
            }
        }

        static writeItemDataDetails(item) {
            const div = document.createElement("div");
            div.innerHTML = item.details;
            const data = {};
            item.data = data;
            const tableTRs = div.querySelectorAll('tr.row0, tr.row1');
            for (var i = 0, l = tableTRs.length; i < l; i++) {
                const tr = tableTRs[i];
                const kategorie = util.html2Text(tr.children[0].innerHTML.split("<br>")[0]);
                switch (kategorie) {
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
                        var bedingungen = {};
                        var freieBedingungen = Array();
                        tr.children[1].innerHTML.split("<br>").forEach(line => {
                            const matches = line.trim().match(/^(.*) (ab|bis) (\d*)$/);
                            if (matches) {
                                bedingungen[matches[1]] = {
                                    comp: matches[2],
                                    value: matches[3],
                                };
                            } else {
                                freieBedingungen.push(line);
                            }
                        });
                        data.bedingungen = bedingungen;
                        data.bedingungen2 = freieBedingungen;
                        break;
                    case "Gegenstandsklasse":
                        const gegenstandsklassen = Array();
                        tr.children[1].innerHTML.split("<br>").forEach(line => {
                            gegenstandsklassen.push(util.html2Text(line).trim());
                        });
                        data.gegenstandsklassen = gegenstandsklassen;
                        break;
                    case "Wo getragen?":
                        data.trageort = tr.children[1].textContent.trim();
                        break;
                }
            }
        }

        static writeItemDataLink(item) {
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
                    var newContext = currentOwnerContext[tableType];
                    if (!newContext) {
                        newContext = [];
                        currentOwnerContext[tableType] = newContext;
                    }
                    currentBoniContext = newContext;
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
                        case "fertigkeit":
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

    class Storage {
        static ITEM_SOURCES = "itemSources"; // Speicherung der Sourcen
        static ITEM_ID_STORE = "itemIds";
        static ITEM_DB_STORE = "itemDB";

        // feste Punkte im Storage die auf andere IDs im Storage verweisen
        static data = null;
        static itemIds = null; // Enthält Referenzen für einzelne Einträge im Storage sowie noch Metadaten über das Item
        static itemSources = null;
        static itemDB = null;
        static count = 0;

        static async ensureItemSources(force) {
            if (!this.itemSources || force) {
                this.count++;
                const start = new Date();
                this.itemSources = await GM.getValue(this.ITEM_SOURCES, {});
                if (!force) console.log("Loaded ItemSources [" + (new Date() - start) + " msecs]", this.itemSources);
            }
            return this.itemSources;
        }

        static async ensureItemDB(force) {
            if (!this.itemDB || force) {
                this.itemDB = await GM.getValue(this.ITEM_DB_STORE, {});
                const start = new Date();
                if (!force) console.log("Loaded ItemDB [" + (new Date() - start) + " msecs]", this.itemDB);
            }
            return this.itemDB;
        }

        static async ensureItemsIdMap(force) {
            if(!this.itemIds || force) {
                this.itemIds = await GM.getValue(this.ITEM_ID_STORE, {});
                const start = new Date();
                if (!force) console.log("Loaded ItemIdStore [" + (new Date() - start) + " msecs]", this.itemIds);
            }
            return this.itemIds;
        }

        static async saveItemSources() {
            await GM.setValue(this.ITEM_SOURCES, this.itemSources);
        }

        static async gmSetSourceItem(itemName, item) {
            if (item.data || item.effects) throw new Error("Item enthält bereits abgeleitete Daten!");
            if (!item.details || !item.link) throw new Error("Item enthält keine Source-Daten");
            await this.ensureItemSources();
            item.time = new Date().getTime();
            this.itemSources[itemName] = item;
            await this.saveItemSources();
        }

        static async gmSetItem(itemName, item) {
            if (!item.data || !item.effects) throw new Error("Item wurde noch nicht eingelesen!");
            if (item.details || item.link) throw new Error("Item enthält noch Source-Daten");
            await this.ensureItemsIdMap();
            await this.ensureItemDB();
            const itemRootId = "item_" + itemName;
            if(item) {
                this.itemDB[itemName] = item;
                this.itemIds[itemRootId] = {
                    dataVersion: Mod.currentDataVersion,
                    time: new Date().getTime(),
                    loaded: !!item.details,
                };
                await GM.setValue(itemRootId, item);
            } else {
                delete this.itemDB[itemName];
                delete this.itemIds[itemRootId];
                await GM.deleteValue(itemRootId);
            }
            await GM.setValue(this.ITEM_ID_STORE, this.itemIds);
            await GM.setValue(this.ITEM_DB_STORE, this.itemDB);
        }

        static async indexItem(itemName, element, sourceItem) {
            const missingElement = element.parentElement.className === "missingWrapper" && element.parentElement.children.length > 1 && element.parentElement.children[1];
            if (!sourceItem || !sourceItem.details) {
                if(!missingElement) {
                    if(element.parentElement.className !== "missingWrapper") {
                        const missingWrapper = document.createElement("span");
                        missingWrapper.className = "missingWrapper";
                        element.parentElement.insertBefore(missingWrapper, element);
                        element.parentElement.removeChild(element);
                        missingWrapper.append(element);
                        missingWrapper.onclick = function() {
                            if(missingWrapper.children.length > 1) {
                                missingWrapper.removeChild(missingWrapper.children[1]);
                            }
                        }
                    }
                    const missingSpan = document.createElement("span");
                    missingSpan.onclick = function(event) {
                        event.stopPropagation();
                    }
                    missingSpan.style.color = "red";
                    missingSpan.innerHTML = "�";
                    missingSpan.className = "missingMe";
                    element.parentElement.append(missingSpan);
                }
            } else {
                if(missingElement) {
                    element.parentElement.removeChild(missingElement);
                }
            }
            if (!sourceItem) {
                const newItem = {
                    name: itemName,
                }
                console.log("New item entry", newItem, sourceItem);
                this.itemSources[itemName] = newItem;
            }
        }

        static async validateItems() {
            if (true) {
                await Storage.ensureItemSources();
                var changedSomething = false;
                for (const [itemName, sourceItem] of Object.entries(Storage.itemSources)) {
                    if (itemName.includes("%3F")) {
                        delete Storage.itemSources[itemName];
                        const itemNameNew = decodeURIComponent(itemName);
                        console.log("Change name", itemName, itemNameNew);
                        sourceItem.name = itemNameNew;
                        this.gmSetIndexItem(itemNameNew, sourceItem);
                        changedSomething = true;
                    }
                }
                if (changedSomething) await GM.setValue(this.ITEM_SOURCES, this.itemSources);
            }

            // await this.ensureAllItems();
            // await GM.setValue(ITEM_SOURCES, this.allItems);
            // prüft und aktualisiert bei Bedarf die Item DB anhand der Sourcen
            //await GM.setValue(ITEM_DB_STORE, {}); // delete and rewrite all ItemDB-Objects
            async function updateItemDB() {
                await Storage.ensureItemSources();
                await Storage.ensureItemDB();
                for (const [itemName, sourceItem] of Object.entries(Storage.itemSources)) {
                    var item = Storage.itemDB[itemName];
                    if (!item || item.dataVersion !== Mod.currentItemDataVersion) {
                        if (sourceItem.details) {
                            //console.log("Update Item to ItemDB", sourceItem);
                            item = {
                                name: itemName,
                                details: sourceItem.details,
                                link: sourceItem.link,
                            }
                            ItemParser.writeItemData(item);
                            delete item.details;
                            delete item.link;
                            await Storage.gmSetItem(itemName, item);
                        }
                    }
                }
            }

            await updateItemDB();
            return;
            await this.ensureItemsIdMap();
            await this.ensureItemSources();
            Object.keys(this.itemIds).forEach(async a => {
                if(a.includes("%3A") || a.includes("%2C")) {
                    console.log("falsches Item: "+a);
                    await this.gmSetSourceItem(a.substring(a.indexOf("_") + 1));
                }
            });
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
                const curText = a.text.trim();
                if (curText !== "") result.push(a.text);
            })
            return result;
        }
    }

    class util {
        static forEach(array, fn) {
            for(var i=0,l=array.length;i<l;i++) {
                fn(array[i]);
            }
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

        static createCheckbox(parent, id, labelTitle) {
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
            return [result, label];
        }

        static createTextInput(width) {
            const result = document.createElement("input");
            result.type = "text";
            if (width) result.style.width = width;
            return result;
        }

        static getWindowPage() {
            var pathname = window.location.pathname.split("/");
            var pageSection = pathname[pathname.length - 2];
            return pathname[pathname.length - 1];
        }

        static createUploadLink(data, filename) {
            var result = document.createElement('a');
            var blob = new Blob([data], {type: 'text/plain'});
            result.href = window.URL.createObjectURL(blob);
            result.download = filename;
            result.dataset.downloadurl = ['text/plain', result.download, result.href].join(':');
            result.draggable = true;
            return result;
        }
    }

    Mod.startMod();

})();
