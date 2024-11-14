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
    const currentDataVersion = 1;
    const currentItemDataVersion = 1;

    var pathname = window.location.pathname.split("/");
    var pageSection = pathname[pathname.length-2];
    var page = pathname[pathname.length-1];

    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);

    function getItemNameFromUrl() {
        return decodeURI(urlParams.get("name"));
    }

    async function startMod() {
        // Links zu Items finden und markieren. Nahezu überall.
        if(page !== "item.php") {
            async function checkSiteForItems() {
                console.log("checkSiteForItems");
                await storage.ensureItemSources();
                const allHrefs = document.getElementsByTagName("a");
                for(var i=0,l=allHrefs.length;i<l;i++) {
                    const itemLinkElement = allHrefs[i];
                    const curHref = itemLinkElement.href;
                    var itemName;
                    var index = curHref.indexOf("item.php?");
                    if(index > 0) {
                        itemName = curHref.match(/name=(.*?)&/);
                    } else {
                        index = curHref.indexOf("/item/");
                        if(index > 0) {
                            itemName = curHref.match(/item\/(.*?)&/);
                        }
                    }
                    if(!itemName) continue;
                    itemName = decodeURIComponent(itemName[1]).replaceAll("+", " ");

                    if(index > 0) {
                        await storage.indexItem(itemName, itemLinkElement);
                    }
                }
            }

            await checkSiteForItems();
            setInterval(async function () {
                await storage.ensureItemSources(true);
                checkSiteForItems();
            }, 10000);
        }

        // Gegenstandsseite
        if (page === "item.php") {
            var link = document.getElementById("link");
            if (hasSetOrGemBonus(link)) {
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
            await storage.gmSetSourceItem(itemName, sourceItem);
            const item = {
                name: itemName,
                details: details,
                link: link,
            }
            await writeItemData(item);
            delete item.details;
            delete item.link;
            await storage.gmSetItem(itemName, item);
            console.log("Gegenstandsseite", sourceItem, item);
        }

        // Erweiterung für die Suche
        if(page === "items.php" || page === "trade.php") {
            const searchContainer = document.getElementsByClassName("search_container")[0];
            if(searchContainer) {
                const searchContainerTitle = searchContainer.children[0].children[0].children[0];

                const [itemDBSearch] = util.createCheckbox(searchContainerTitle, "itemDB", "Item-Datenbank anfragen");

                var itemsToLoad = 0;
                for (const [itemName, item] of Object.entries(await storage.ensureItemSources())) {
                    if(!item.details || item.irregular) {
                        itemsToLoad++;
                    }
                }
                const [missingSearch, missingSearchLabel] = util.createCheckbox(searchContainerTitle, "missingSearch", "Fehlende Einträge ["+itemsToLoad+"]");
                async function updateMissingButton() {
                    const allItems = await storage.ensureItemSources();
                    var itemsToLoad = 0;
                    for (const [itemName, item] of Object.entries(allItems)) {
                        if(!item.details || item.irregular) {
                            itemsToLoad++;
                        }
                    }
                    missingSearchLabel.innerText = "Fehlende Einträge ["+itemsToLoad+"]";
                }

                const mySearchTable = createSearchTable();
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

                getSuchfeld().onkeydown = function(event) {
                    // Enter abfangen und den aktuellen Such-Button auslösen
                    if (event.keyCode === 13) {
                        event.preventDefault();
                        buttonContainer.children[0].click();
                    }
                };

                function changeContainer() {
                    if(itemDBSearch.checked || missingSearch.checked) {
                        buttonContainer.removeChild(buttonContainer.children[0]);
                        buttonContainer.append(mySearchButton);
                    } else {
                        buttonContainer.removeChild(buttonContainer.children[0]);
                        buttonContainer.append(button);
                    }
                    if(searchContainer.children.length > 1) {
                        searchContainer.removeChild(searchContainer.children[1]);
                    }
                    if(itemDBSearch.checked) {
                        searchContainer.append(mySearchTable);
                    } else if(!missingSearch.checked) {
                        searchContainer.append(theirSearchTable);
                    }
                }

                itemDBSearch.onclick = async function() {
                    if(itemDBSearch.checked) {
                        missingSearch.checked = false;
                    }
                    changeContainer();
                };
                missingSearch.onclick = async function() {
                    if(missingSearch.checked) {
                        itemDBSearch.checked = false;
                    }
                    changeContainer();
                };

                const updateResultTable = async function() {
                    // Search and display result
                    if(resultContainer.children.length > 0) {
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
                        columns = getAutoColumns();
                        for (const column of Object.keys(columns)) {
                            headTR.innerHTML += "<th>" + column + "</th>";
                        }
                    } else {
                        columns = Array();
                    }

                    function getItemValue(obj, pfadArray, lastHeader) {
                        //console.log("getItemValue", obj, pfadArray);
                        if(!obj) return "";
                        if (pfadArray.length === 0) {
                            if(lastHeader === "schaden") {
                                var result = "";
                                obj.forEach(dmg => {
                                    if(result.length > 0) result+="<br>";
                                    result+= dmg.damageType+"("+dmg.attackType+"): "+dmg.bonus;
                                });
                                return result.replaceAll("der Heldenstufe", "HS").replaceAll("des Fertigkeitenrangs", "FR").replaceAll("Fertigkeitenrang", "FR").replaceAll("Heldenstufe", "HS");
                            } else if(lastHeader === "parade" || lastHeader === "eigenschaft") {
                                var result = "";
                                obj.forEach(parade => {
                                    if(result.length > 0) result+="<br>";
                                    result+= parade.type + ": " + parade.bonus;
                                });
                                return result.replaceAll("der Heldenstufe", "HS").replaceAll("des Fertigkeitenrangs", "FR").replaceAll("Fertigkeitenrang", "FR").replaceAll("Heldenstufe", "HS");
                            } else if(lastHeader === "klasse") {
                                if(obj.typ === "alle") return "alle";
                                if(obj.typ === "nur") {
                                    return obj.def.map(a => KLASSEN[a]).join(", ");
                                } else {
                                    return Object.keys(KLASSEN).filter(a => !obj.def.includes(a)).map(a => KLASSEN[a]).join(", ");
                                }
                            }

                            if(typeof obj === "string") return obj;
                            return JSON.stringify(obj);
                        }
                        return getItemValue(obj[pfadArray[0]], pfadArray.slice(1), pfadArray[0]);
                    }

                    var i = 1;
                    var switcher = false;
                    var items;
                    if (itemDBSearch.checked) {
                        items = await storage.getAllItems(true);
                    } else {
                        items = await storage.ensureItemSources(true);
                    }
                    for (const [itemName, item] of Object.entries(items)) {
                        if(!itemDBSearch.checked && !item.details || !itemDBSearch.checked && item.details && item.irregular || itemDBSearch.checked && item.data && matches(item, searchContainer)) {
                            switcher = !switcher;
                            const tr = document.createElement("tr");
                            tr.className = "row"+(switcher?"0":"1");
                            tbody.append(tr);
                            var td = document.createElement("td");
                            tr.append(td);
                            td.innerHTML = ""+i;
                            td = document.createElement("td");
                            tr.append(td);

                            for(const [title, pfadArray] of Object.entries(columns)) {
                                const td = document.createElement("td");
                                td.innerHTML = getItemValue(item, pfadArray);
                                tr.append(td);
                            }

                            const href = document.createElement("a");
                            const url = "/wod/spiel/hero/item.php?name="+encodeURI(itemName);
                            href.href = url;
                            href.target = "_blank";
                            href.innerHTML = itemName;

                            if(itemDBSearch.checked) {
                                href.onclick = function() {
                                    return wo(url+"&IS_POPUP=1");
                                }
                            } else {
                                href.onclick = function() {
                                    href.parentElement.removeChild(href);
                                    return wo(url+"&IS_POPUP=1");
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

        await storage.ensureItemSources();
        const allItemSources = storage.itemSources;
        var countRetrieved = 0;
        var all = 0;
        for (const [itemName, item] of Object.entries(allItemSources)) {
            all++;
            if(item.details) {
                countRetrieved++;
            }
        }
        console.log("ItemSources: " + countRetrieved + "/" + all);
        await storage.validateItems();
    }

    const validators = [];
    const validatorTypes = [];
    const negators = [];
    function createSearchTable() {
        const table = document.createElement("table");

        const tbody = document.createElement("tbody");
        table.append(tbody);

        function checkRemove(i) {
            if (tbody.children.length === 1) return false;
            console.log("checkRemove", validatorTypes[i], tbody.children.length, i);
            if(!validatorTypes[i]) {
                validatorTypes.splice(i,i);
                validators.splice(i,i);
                negators.splice(i,i);
                tbody.removeChild(tbody.children[i]);
            }
        }

        function createAuswahl(i) {
            const tr = document.createElement("tr");
            tbody.append(tr);
            const select = createSelect(["<Auswahl>"].concat(Object.keys(SuchKriterien)));
            const searchFieldsTD = document.createElement("td");
            tr.append(select);
            tr.append(searchFieldsTD);
            const [checkbox, label] = util.createCheckbox(tr, "", "Negieren");
            checkbox.onclick = function() {
                const myCurIndex = [...tbody.children].indexOf(tr);
                console.log("set checked", checkbox.checked);
                negators[myCurIndex] = checkbox.checked;
            }
            checkbox.parentElement.hidden = true;

            select.onchange = function() {
                const myCurIndex = [...tbody.children].indexOf(tr);
                if(select.value === "") {
                    searchFieldsTD.removeChild(searchFieldsTD.children[0]);
                    delete validators[myCurIndex];
                    delete validatorTypes[myCurIndex];
                    checkbox.parentElement.hidden = true;
                    checkRemove(myCurIndex);
                } else {
                    const suche = SuchKriterien[select.value]();
                    if(searchFieldsTD.children.length > 0) searchFieldsTD.removeChild(searchFieldsTD.children[0]);
                    searchFieldsTD.append(suche.get());
                    checkbox.parentElement.hidden = false;
                    validators[myCurIndex] = suche.matches;
                    validatorTypes[myCurIndex] = select.value;
                    console.log("test", tbody.children.length, myCurIndex);
                    if(tbody.children.length <= myCurIndex+1) {
                        createAuswahl(myCurIndex+1);
                    }
                }
                console.log("Kriterien", validators);
            }
        }
        createAuswahl(0);

        return table;
    }

    var debug = false;
    function matches(item) {
        const result = matches2(item);
        if (debug) console.log("Matches", result);
        return result;
    }

    function matches2(item) {
        debug = item.name.includes("Thanat");
        if(debug) console.log(item);
        const suchfeldWert = getSuchfeld().value.trim();
        if(suchfeldWert !== "") {
            if(!item.name.match("^"+suchfeldWert.replace("*", ".*")+"$")) return false;
        }
        for(var i=0,l=validators.length;i<l;i++) {
            const currentValidator = validators[i];
            if(!currentValidator) continue;
            const currentValidatorResult = currentValidator(item) || false;
            const negatorWish = negators[i] || false;
            if (debug) console.log("Matches2", currentValidatorResult, negatorWish);
            if (currentValidatorResult === negatorWish) return false;
        }
        return true;
    }

    const AutoColumns = {
        Trageort: {
            pfad: "data.trageort",
            notWhen: "Trageort",
        },
        Klasse: {
            pfad: "data.klasse",
            notWhen: "Klasse",
        },
        "Schaden (Besitzer)": {
            pfad: "effects.owner.schaden",
            when: "Schaden",
        },
        "Schaden (Betroffener)": {
            pfad: "effects.target.schaden",
            when: "Schaden",
        },
        "Parade (Besitzer)": {
            pfad: "effects.owner.parade",
            when: "Parade",
        },
        "Parade (Betroffener)": {
            pfad: "effects.target.parade",
            when: "Parade",
        },
        "Eigenschaft (Besitzer)": {
            pfad: "effects.owner.eigenschaft",
            when: "Eigenschaft",
        },
        "Eigenschaft (Betroffener)": {
            pfad: "effects.target.eigenschaft",
            when: "Eigenschaft",
        },
    }

    function getSuchfeld() {
        return document.getElementsByName("item_10name")[0] || document.getElementsByName("item_3name")[0] || document.getElementsByName("item_6name")[0];
    }

    function whenBedingung(when) {
        var validatorIndex = validatorTypes.indexOf(when);
        var negator = negators[validatorIndex] || false;
        var validator = validatorIndex > -1;
        return negator !== validator;
    }

    function getAutoColumns() {
        const result = {};
        for(const [title, def] of Object.entries(AutoColumns)) {
            if (!def.notWhen && !def.when || def.notWhen && !whenBedingung(def.notWhen) || def.when && whenBedingung(def.when)) {
                result[title] = def.pfad.split(".");
            }
        }
        console.log("AutoColumns", result);
        return result;
    }

    const KLASSEN = {
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

    const EIGENSCHAFT = {
        "Charisma": "Ch",
        "Geschicklichkeit": "Ge",
        "Konstitution": "Ko",
        "Intelligenz": "In",
        "Schnelligkeit": "Sn",
        "Stärke": "St",
        "Wahrnehmung": "Wa",
        "Willenskraft": "Wi",
    }

    const TRAGEORT = ["Kopf", "Ohren", "Brille", "Halskette", "Torso", "Gürtel", "Umhang", "Schultern", "Arme", "Handschuhe", "Beide Hände", "Waffenhand", "Schildhand", "Einhändig", "Beine", "Füße", "Orden", "Tasche", "Ring", "nicht tragbar"];

    const SCHADENSARTEN = ["Schneidschaden", "Hiebschaden", "Stichschaden", "Eisschaden", "Feuerschaden", "Giftschaden", "Heiliger Schaden", "Manaschaden", "Psychologischer Schaden"];

    const ANGRIFFSARTEN = ["Nahkampf", "Fernkampf", "Zauber", "Sozial", "Naturgewalt"];

    const BESITZER_BETROFFENER = ["<Ziel>", "Besitzer", "Betroffener"];

    const SuchKriterien = {
        Schaden: function() {
            const span = document.createElement("span");
            const select1 = createSelect(["<Schadensart>", ...SCHADENSARTEN]);
            span.append(select1);
            const select2 = createSelect(BESITZER_BETROFFENER);
            span.append(select2);
            const select3 = createSelect(["<Angriffstyp>", "Nahkampf", "Fernkampf"]);
            span.append(select3);
            const select4 = createSelect(["<a/z>", "(a)", "(z)"]);
            span.append(select4);

            return {
                matches: function(item) {
                    var result = Array();
                    if (select2.value === "Besitzer" || select2.value === "") {
                        const cur = item.effects?.owner?.schaden;
                        if(cur) result.push(...cur);
                    }
                    if (select2.value === "Betroffener" || select2.value === "") {
                        const cur = item.effects?.target?.schaden;
                        if(cur) result.push(...cur);
                    }
                    if (debug) console.log("likhsdf", item, result);
                    var next = Array();
                    if(select1.value !== "") {
                        result.forEach(cur => {
                            if(cur.damageType === select1.value) {
                                next.push(cur);
                            }
                        });
                        result = next;
                        next = Array();
                    }
                    if(select4.value !== "") {
                        result.forEach(cur => {
                            if(cur.bonus.includes(select4.value) || cur.attackType.includes(select4.value)) {
                                next.push(cur);
                            }
                        });
                        result = next;
                        next = Array();
                    }
                    return result.length > 0;
                },
                get: function() {
                    return span;
                }
            };
        },
        Klasse: function() {
            const span = document.createElement("span");
            const select1 = createSelect(["<Klasse>", ...Object.keys(KLASSEN)]);
            span.append(select1);
            return {
                matches: function(item) {
                    const klasse = item?.data?.klasse;
                    if (!klasse || klasse.typ === "alle") return true;
                    if (klasse.typ === "nur") {
                        return klasse.def.includes(select1.value);
                    }
                    return !klasse.def.includes(select1.value);
                },
                get: function() {
                    return span;
                }
            }
        },
        Trageort: function () {
            const span = document.createElement("span");
            const select1 = createSelect(["<Klasse>", ...TRAGEORT]);
            span.append(select1);
            return {
                matches: function (item) {
                    return item?.data?.trageort === select1.value;
                },
                get: function () {
                    return span;
                }
            }
        },
        Eigenschaft: function() {
            const span = document.createElement("span");
            const select1 = createSelect(["<Eigenschaft>", ...Object.keys(EIGENSCHAFT)]);
            span.append(select1);
            const select2 = createSelect(BESITZER_BETROFFENER);
            span.append(select2);
            return {
                matches: function(item) {
                    var result = Array();
                    if(select2.value=="Besitzer" || select2.value == "") {
                        const cur = item.effects?.owner?.eigenschaft;
                        if(cur) result.push(...cur);
                    }
                    if(select2.value=="Betroffener" || select2.value == "") {
                        const cur = item.effects?.target?.eigenschaft;
                        if(cur) result.push(...cur);
                    }
                    var next = Array();
                    if(select1.value !== "") {
                        result.forEach(cur => {
                            if(cur.type === select1.value) {
                                next.push(cur);
                            }
                        });
                        result = next;
                        next = Array();
                    }
                    return result.length > 0;
                },
                get: function() {
                    return span;
                }
            }
        },
        Parade: function() {
            const span = document.createElement("span");
            const select1 = createSelect(["<Parade>", ...ANGRIFFSARTEN]);
            span.append(select1);
            const select2 = createSelect(BESITZER_BETROFFENER);
            span.append(select2);
            return {
                matches: function(item) {
                    var result = Array();
                    if (select2.value === "Besitzer" || select2.value === "") {
                        const cur = item.effects?.owner?.parade;
                        if(cur) result.push(...cur);
                    }
                    if (select2.value === "Betroffener" || select2.value === "") {
                        const cur = item.effects?.target?.parade;
                        if(cur) result.push(...cur);
                    }
                    var next = Array();
                    if(select1.value !== "") {
                        result.forEach(cur => {
                            if(cur.type === select1.value) {
                                next.push(cur);
                            }
                        });
                        result = next;
                        next = Array();
                    }
                    return result.length > 0;
                },
                get: function() {
                    return span;
                }
            }
        },

    }

    function td(txtOrElement) {
        const td = document.createElement("td");
        if(typeof txtOrElement == 'string') {
            td.innerHTML += txtOrElement;
        } else {
            td.append(txtOrElement);
        }
        return td;
    }

    function createSelect(options) {
        const result = document.createElement("select");
        options.forEach(opt => {
            const value = opt.startsWith("<") ? "": opt.replaceAll(":","");
            const autoSelected = opt.startsWith(":")? "selected":"";
            result.innerHTML += "<option value='"+value+"' "+autoSelected+">"+opt.replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll(":","")+"</option>";
        });
        return result;
    }

    function hasSetOrGemBonus(linkElement) {
        return linkElement.getElementsByClassName("gem_bonus_also_by_gem").length > 0 || linkElement.getElementsByClassName("gem_bonus_only_by_gem").length > 0;
    }

    async function writeItemData(item) {
        try {
            const itemData = {};
            writeItemDataLink(item);
            writeItemDataDetails(item);
            item.dataVersion = currentItemDataVersion;
        } catch(error) {
            console.log(error);
            //alert(error);
            throw error;
        }
    }

    function writeItemDataDetails(item) {
        const div = document.createElement("div");
        div.innerHTML = item.details;
        const data = {};
        item.data = data;
        const tableTRs = div.querySelectorAll('tr.row0, tr.row1');
        for(var i=0,l=tableTRs.length;i<l;i++) {
            const tr = tableTRs[i];
            switch(tr.children[0].textContent.trim()) {
                case "Heldenklassen":
                    var heldenklassen = tr.children[1].textContent.trim();
                    var typ;
                    var def;
                    if(heldenklassen.startsWith("ausschließlich für")) {
                        typ = "nur";
                        def = Array();
                        for(const klasse of tr.children[1].getElementsByTagName("span")) {
                            def.push(klasse.textContent.trim());
                        }
                    } else if(heldenklassen.startsWith("nicht für")) {
                        typ = "nicht";
                        def = Array();
                        for(const klasse of tr.children[1].getElementsByTagName("span")) {
                            def.push(klasse.textContent.trim());
                        }
                    } else if(heldenklassen.startsWith("für alle")) {
                        typ = "alle";
                    }
                    data.klasse = {
                        typ: typ,
                        def: def,
                    }
                    break;
                case "Wo getragen?":
                    data.trageort = tr.children[1].textContent.trim();
                    break;
            }
        }
    }

    function writeItemDataLink(item) {
        const div = document.createElement("div");
        div.innerHTML = item.link;
        if(hasSetOrGemBonus(div)) {
            item.irregular = true;
        } else {
            delete item.irregular;
        }
        item.effects = {};
        var currentOwnerContext;
        var currentBoniContext;
        var tableType;
        var ownerType;
        for(var i=0,l=div.children.length;i<l;i++) {
            const cur = div.children[i];
            if(cur.tagName == "H2") {
                ownerType = getOwnerType(cur.textContent.trim());
                currentOwnerContext = item.effects[ownerType];
                if(!currentOwnerContext) {
                    currentOwnerContext = {};
                    item.effects[ownerType] = currentOwnerContext;
                }
            }
            else if(cur.tagName == "H3") {
                tableType = getType(cur.textContent.trim());
                var newContext = currentOwnerContext[tableType];
                if(!newContext) {
                    newContext = [];
                    currentOwnerContext[tableType] = newContext;
                }
                currentBoniContext = newContext;
            }
            else if(cur.className === "content_table") {
                const tableTRs = cur.querySelectorAll('tr.row0, tr.row1');
                switch (tableType) {
                    case "schaden":
                    case "ruestung":
                    case "anfaelligkeit":
                        addBoni(currentBoniContext, tableTRs, b => {return {
                            damageType: b.children[0].textContent.trim(),
                            attackType: b.children[1].textContent.trim(),
                            bonus: b.children[2].textContent.trim(),
                            dauer: b.children.length > 3 ? b.children[3].textContent.trim(): undefined,
                            bemerkung: b.children.length > 4 ?b.children[4].textContent.trim(): undefined,
                        }});
                        break;
                    case "eigenschaft":
                    case "angriff":
                    case "fertigkeit":
                    case "parade":
                    case "wirkung":
                        addBoni(currentBoniContext, tableTRs, b => {return {
                            type: b.children[0].textContent.trim(),
                            bonus: b.children[1].textContent.trim(),
                            dauer: b.children.length > 2 ? b.children[2].textContent.trim(): undefined,
                            bemerkung: b.children.length > 3 ?b.children[3].textContent.trim(): undefined,
                        }});
                        break;
                    default:
                        console.error("Unbekannter Boni-TableType: '"+tableType+"'");
                        alert("Unbekannter Boni-TableType: '"+tableType+"'");
                }

            }
        }
    }

    function addBoni(currentBoniContext, tableTRs, fn) {
        tableTRs.forEach(b => {
            currentBoniContext.push(fn(b));
        });
    }

    function getType(text) {
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
            default:
                console.error("Unbekannte H3-Item Überschrift: '"+text+"'");
                alert("Unbekannte H3-Item Überschrift: '"+text+"'");
        }
    }

    function getOwnerType(text) {
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
                if(text.includes('Diese Boni wirken zurzeit auf ')) {
                    return 'owner';
                }
                console.error("Unbekannte H2-Item Überschrift: '"+text+"'");
                alert("Unbekannte H2-Item Überschrift: '"+text+"'");
        }
    }

    const ITEM_SOURCES = "itemSources"; // Speicherung der Sourcen
    //const ALL_ITEMS_STORE = "allItems";
    const ITEM_ID_STORE = "itemIds";
    const ITEM_DB_STORE = "itemDB";
    const storage = {
        // feste Punkte im Storage die auf andere IDs im Storage verweisen
        data: null,
        itemIds: null, // Enthält Referenzen für einzelne Einträge im Storage sowie noch Metadaten über das Item
        itemSources: null,
        itemDB: null,
        count: 0,

        getAllItems: async function(force) {
            await this.ensureItemDB(force);
            return this.itemDB;
        },

        ensureItemSources: async function (force) {
            if (!this.itemSources || force) {
                this.count++;
                this.itemSources = await GM.getValue(ITEM_SOURCES, {});
                if (!force) console.log("Loaded ItemSources", this.itemSources);
            }
            return this.itemSources;
        },

        ensureItemDB: async function (force) {
            if (!this.itemDB || force) {
                this.itemDB = await GM.getValue(ITEM_DB_STORE, {});
                if (!force) console.log("Loaded ItemDB", this.itemDB);
            }
            return this.itemDB;
        },

        ensureItemsIdMap: async function(force) {
            if(!this.itemIds || force) {
                this.itemIds = await GM.getValue(ITEM_ID_STORE, {});
                if(!force) console.log("Loaded ItemIdStore", this.itemIds);
            }
            return this.itemIds;
        },

        gmSetIndexItem: async function (itemName, item) {
            await this.ensureItemSources();
            if (!this.itemSources[itemName]) {
                this.itemSources[itemName] = item;
            }
        },

        gmSetSourceItem: async function (itemName, item) {
            if (item.data || item.effects) throw new Error("Item enthält bereits abgeleitete Daten!");
            if (!item.details || !item.link) throw new Error("Item enthält keine Source-Daten");
            await this.ensureItemSources();
            this.itemSources[itemName] = item;
            await GM.setValue(ITEM_SOURCES, this.itemSources);
        },

        gmSetItem: async function (itemName, item) {
            if (!item.data || !item.effects) throw new Error("Item wurde noch nicht eingelesen!");
            if (item.details || item.link) throw new Error("Item enthält noch Source-Daten");
            await this.ensureItemsIdMap();
            await this.ensureItemDB();
            const itemRootId = "item_" + itemName;
            if(item) {
                this.itemDB[itemName] = item;
                this.itemIds[itemRootId] = {
                    dataVersion: currentDataVersion,
                    time: new Date().getTime(),
                    loaded: !!item.details,
                };
                await GM.setValue(itemRootId, item);
            } else {
                delete this.itemDB[itemName];
                delete this.itemIds[itemRootId];
                await GM.deleteValue(itemRootId);
            }
            await GM.setValue(ITEM_ID_STORE, this.itemIds);
            await GM.setValue(ITEM_DB_STORE, this.itemDB);
        },

        indexItem: async function(itemName, element) {
            await this.ensureItemSources();
            const sourceItem = this.itemSources[itemName];
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
            if (!sourceItem || sourceItem.dataVersion !== currentDataVersion) {
                const newItem = {
                    name: itemName,
                }
                // console.log("added item: "+itemName, metaInfo, this.itemIds);
                await this.gmSetIndexItem(itemName, newItem);
            } else {
                sourceItem.time = new Date().getTime();
            }
        },

        validateItems: async function() {
            //await GM.setValue(ITEM_DB_STORE, {}); // delete and rewrite all ItemDB-Objects
            //this.itemDB = {};

            // await this.ensureAllItems();
            // await GM.setValue(ITEM_SOURCES, this.allItems);
            // prüft und aktualisiert bei Bedarf die Item DB anhand der Sourcen
            async function updateItemDB() {
                await storage.ensureItemSources();
                await storage.ensureItemDB();
                for (const [itemName, sourceItem] of Object.entries(storage.itemSources)) {
                    var item = storage.itemDB[itemName];
                    if (!item || item.dataVersion !== currentItemDataVersion) {
                        if (sourceItem.details) {
                            console.log("Update Item to ItemDB", sourceItem);
                            item = {
                                name: itemName,
                                details: sourceItem.details,
                                link: sourceItem.link,
                            }
                            writeItemData(item);
                            delete item.details;
                            delete item.link;
                            storage.gmSetItem(itemName, item);
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
        },

    };

    const util = {
        forEach: function(array, fn) {
            for(var i=0,l=array.length;i<l;i++) {
                fn(array[i]);
            }
        },
        createCheckbox: function(parent, id, labelTitle) {
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
        },
    }

    startMod();

})();