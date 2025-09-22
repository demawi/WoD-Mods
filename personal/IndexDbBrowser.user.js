// ==UserScript==
// @name           [WoD] IndexDbBrowser
// @version        0.11.3
// @author         demawi
// @namespace      demawi
// @description    Lässt einen die Index des Browsers ansehen und bearbeiten
//
// @match          *://*.world-of-dungeons.*/wod/spiel/settings/settings.php*
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
            await demawiRepository.startMod();

            OldSmarttab.addSmartTab("IndexDB", "indexdb", await IndexDbBrowser.create());


        }


    }

    class IndexDbBrowser {

        static indexDb;
        static objectStore;

        static async create() {
            const _this = this;
            const tableView = document.createElement("table");
            let tr = document.createElement("tr");
            tableView.append(tr);
            let td = document.createElement("td");
            td.innerHTML = "Datenbank:";
            tr.append(td);
            const dbs = await indexedDB.databases();
            const dbSelector = this.createSelectField(Object.values(dbs).map(a => a.name))
            td = document.createElement("td");
            tr.append(td);
            td.append(dbSelector);

            const objectStoreTR = document.createElement("tr");
            objectStoreTR.style.display = "none";
            tableView.append(objectStoreTR);
            td = document.createElement("td");
            td.innerHTML = "ObjectStore:";
            objectStoreTR.append(td);
            const objectStoreSelectorWrapper = document.createElement("td");
            objectStoreTR.append(objectStoreSelectorWrapper);

            const objekteIndizesTR = document.createElement("tr");
            objekteIndizesTR.style.display = "none";
            tableView.append(objekteIndizesTR);
            td = document.createElement("td");
            objekteIndizesTR.append(td);
            td.innerHTML = "Objekte/Indizes:";
            td = document.createElement("td");
            objekteIndizesTR.append(td);
            const objekteIndizesSelector = this.createSelectField(["Objekte", "Indizes"], true);
            td.append(objekteIndizesSelector);

            const objekteTR = document.createElement("tr");
            objekteTR.style.display = "none";
            tableView.append(objekteTR);
            td = document.createElement("td");
            objekteTR.append(td);
            td.innerHTML = "Objekte:";
            td.style.verticalAlign = "top";
            const objekteTD = document.createElement("td");
            objekteTR.append(objekteTD);

            const indizesTR = document.createElement("tr");
            indizesTR.style.display = "none";
            tableView.append(indizesTR);
            td = document.createElement("td");
            indizesTR.append(td);
            td.innerHTML = "Indizes:";
            const indizesTD = document.createElement("td");
            indizesTR.append(indizesTD);

            const checkBearbeitung = async function () {
                objekteTD.innerHTML = "";
                indizesTD.innerHTML = "";
                objekteTR.style.display = "none";
                indizesTR.style.display = "none";
                if (_this.objectStore) {
                    if (objekteIndizesSelector.value === "Objekte") {
                        objekteTR.style.display = "";
                        await _this.createObjektBearbeitung(objekteTD);
                        indizesTR.style.display = "none";
                    } else {
                        objekteTR.style.display = "none";
                        indizesTR.style.display = "";
                        _this.createIndexBearbeitung(indizesTD);
                    }
                }
            }
            objekteIndizesSelector.onchange = checkBearbeitung;

            dbSelector.onchange = async function () {
                if (_this.indexDb) _this.indexDb.closeConnection();
                const newValue = dbSelector.value;
                objekteIndizesTR.style.display = "none";
                indizesTR.style.display = "none";
                objectStoreTR.style.display = newValue === "" ? "none" : "";
                if (newValue === "") {
                    _this.indexDb = undefined;
                    return;
                }
                _this.indexDb = _Storages.IndexedDb.getDb(newValue, demawiRepository.getModName());
                const storeNames_ = await _this.indexDb.getObjectStoreNames();
                const storeNames = [];
                for (let i = 0, l = storeNames_.length; i < l; i++) {
                    storeNames.push(storeNames_.item(i));
                }
                objectStoreSelectorWrapper.innerHTML = "";
                const objectStoreSelector = _this.createSelectField(storeNames)
                objectStoreSelectorWrapper.append(objectStoreSelector);
                objectStoreSelector.onchange = async function () {
                    const objectStoreSelected = objectStoreSelector.value;
                    objekteIndizesTR.style.display = objectStoreSelected === "" ? "none" : "";
                    indizesTR.style.display = "none";
                    objekteTD.innerHTML = "";
                    if (objectStoreSelected !== "") {
                        _this.objectStore = await _this.indexDb.getObjectStorageChecked(objectStoreSelected);
                    } else {
                        _this.objectStore = undefined;
                    }
                    await checkBearbeitung();
                }
            }
            return tableView;
        }

        static async createObjektBearbeitung(objekteTD) {
            const _this = this;
            const div = document.createElement("div");
            console.log(this.objectStore);
            // Aktuell nur für simple primary keys noch nicht für arrays, dafür müssten wir wir mehrere Textfelder anbieten
            div.innerHTML = "Primary Key: " + JSON.stringify(await this.objectStore.getPrimaryKey());
            const text = document.createElement("input");
            text.type = "text";
            div.append(text);

            const textarea = document.createElement("textarea");
            const button = document.createElement("input");
            button.type = "button";
            button.value = "Suchen";
            button.onclick = async function () {
                const result = await _this.objectStore.getValue(text.value.trim());
                if (result) {
                    textarea.value = JSON.stringify(result, undefined, 4);
                } else {
                    textarea.value = "";
                }
            }
            div.append(button);

            const textareaDiv = document.createElement("div");
            div.append(textareaDiv);

            textareaDiv.append(textarea);
            textarea.cols = 120;
            textarea.rows = 50;

            // TODO: Objektsuche bzw. -selektion
            objekteTD.append(div);
        }

        static createIndexBearbeitung(objekteTD) {
            const div = document.createElement("div");
            div.innerHTML = "IndexBearbeitung";
            objekteTD.append(div);
        }


        static createSelectField(options, withoutEmptyOption) {
            const select = document.createElement("select");
            if (!withoutEmptyOption) select.append(document.createElement("option"));
            for (const cur of options) {
                const curOption = document.createElement("option");
                curOption.innerText = cur;
                select.append(curOption);
            }
            return select;
        }
    }

    class OldSmarttab {

        static addSmartTab(name, id, content) {
            const tabs = document.querySelectorAll("div[id^='smarttabs__']:not(div[id$='_inner'])");
            const newSmarttab = document.createElement("div");
            newSmarttab.id = "smarttabs__" + id;
            newSmarttab.className = "tab hidden";
            newSmarttab.display = "none";
            const newUl = document.createElement("ul");
            newSmarttab.append(newUl);

            const bar = document.createElement("div");
            bar.className = "bar";
            newSmarttab.append(bar);
            const newContent = document.createElement("div");
            newContent.id = "smarttabs__" + id + "_inner";
            newContent.className = "content";
            if (typeof content === "string") {
                newContent.innerHTML = content;
            } else {
                newContent.append(content);
            }
            newSmarttab.append(newContent);

            for (const tab of tabs) {
                tab.children[0].append(this.createNewTab(name, id, false));
                const tabName = tab.querySelector(".selected").textContent.trim();
                const tabId = tab.id.substring(tab.id.indexOf("__") + 2);
                newUl.append(this.createNewTab(tabName, tabId, false));
            }
            newUl.append(this.createNewTab(name, id, true));
            console.log("Apennd smarttab to: ", tabs[0].parentElement);
            tabs[0].parentElement.append(newSmarttab);
        }

        static createNewTab(name, id, selected) {
            const li = document.createElement("li");
            li.classList.add(selected ? "selected" : "not_selected");
            const a = document.createElement("a");
            li.append(a);
            a.innerHTML = name;
            a.href = "#";
            a.onclick = function () {
                const pId = document.forms['the_form'].tab.value;
                document.forms['the_form'].tab.value = id;
                console.log("Switch: " + pId + " => " + id);
                setDisplayState('smarttabs__' + pId, 'none');
                setDisplayState('smarttabs__' + id, 'block');
                return false;
            }
            return li;
        }
    }

    Mod.startMod();

})();
