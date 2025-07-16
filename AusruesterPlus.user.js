// ==UserScript==
// @name           [WoD] Ausrüster Plus
// @version        0.8.2
// @author         demawi
// @namespace      demawi
// @description    Erweiterungen für die Ausrüstung.
// @include        http*://*.world-of-dungeons.de/wod/spiel/hero/items.php*
// @require        https://code.jquery.com/jquery-3.7.1.min.js
// @require        https://code.jquery.com/ui/1.14.1/jquery-ui.js
// @require	       https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js#sha512=2ImtlRlf2VVmiGZsjm9bEyhjGW4dU7B6TNwh/hx/iSByxNENtj3WVE6o/9Lj4TJeVXPi4bnOIMXFIJJAeufa0A==
// @require        repo/DemawiRepository.js
// ==/UserScript==
// *************************************************************
// *** WoD-Kampfkonfig Plus                                  ***
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

        static async startMod() {
            if (_.WoD.getView() === _.WoD.VIEW.ITEMS_GEAR) {
                await demawiRepository.startMod();
                await MyStorage.initMyStorage(_.Storages.IndexedDb.getDb(Mod.dbname, "Equipper"));
                Ausruester.start();
            }
        }

    }

    class Ausruester {

        static async start() {
            await EquipConfig.init();
            await ControlBar.init();
            await SelectOptimizer.init();
        }

    }

    class ControlBar {

        static hasChange_Loadout_Server;
        static hasChange_UI_Loadout;
        static hasChange_UI_Server;

        static loadoutNamePanel;
        static markerPanel_UI_Loadout;
        static markerPanel_Loadout_Server;
        static markerPanel_UI_Server;

        static warningPanel;
        static loadOutSelect;
        static loadButton;
        static saveButton;
        static renameButton;
        static saveUnderButton;
        static vgSyncButton;
        static saveAndLoadButton;
        static deleteButton;

        static marker_Right = "⮞"; // Commit changes to server
        static marker_Left = "⮜"; // Commit changes to indexedDb

        static updateProfileName() {
            const currentLoadoutName = EquipConfig.getCurrentLoadoutName();
            if (currentLoadoutName) {
                this.loadoutNamePanel.innerHTML = "Aktuell geladen: " + currentLoadoutName;
            } else {
                this.loadoutNamePanel.innerHTML = "";
            }

            this.markerPanel_UI_Loadout.innerHTML = this.hasChange_UI_Loadout ? "🛢" : "<img src='" + _.UI.WOD_SIGNS.YES + "' />";
            this.markerPanel_Loadout_Server.innerHTML = this.hasChange_Loadout_Server ? "🖧" : "<img src='" + _.UI.WOD_SIGNS.YES + "' />";
            this.markerPanel_UI_Server.innerHTML = this.hasChange_UI_Server ? "💻" : "<img src='" + _.UI.WOD_SIGNS.YES + "' />";
            this.markerPanel_UI_Loadout.title = this.hasChange_UI_Loadout ? "UI<>Loadout. Das Loadout wurde noch nicht für später gespeichert!" : "UI=Loadout. Das gewählte Loadout stimmt mit der aktuellen Auswahl der UI überein!";
            this.markerPanel_Loadout_Server.title = this.hasChange_Loadout_Server ? "Loadout<>Server. Das Loadout ist aktuell noch nicht ausgerüstet!" : "Loadout=Server. Das gewählte Loadout stimmt mit der aktuellen Auswahl der UI überein!";
            this.markerPanel_UI_Server.title = this.hasChange_UI_Server ? "UI<>Server. UI und Server unterscheiden sich" : "UI=Server. Die gewählte Ausrüstung entspricht dem Stand des Servers";
        }

        static async init() {
            const _this = this;

            _.Libs.addCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css");

            const panel = document.createElement("div");
            panel.style.textAlign = "right";
            this.loadoutNamePanel = document.createElement("div");
            this.loadoutNamePanel.title = "Das aktuelle Loadout, welches beim Neuladen der Seite verwendet wird";
            this.loadoutNamePanel.style.marginBottom = "2px";
            this.loadOutSelect = document.createElement("select");

            this.warningPanel = document.createElement("div");
            this.warningPanel.style.color = "#FF5555";

            this.markerPanel_UI_Loadout = document.createElement("span");
            this.markerPanel_UI_Loadout.style.marginLeft = "3px";
            //this.markerPanel_UI_Loadout.style.marginRight = "0px";
            this.markerPanel_Loadout_Server = document.createElement("span");
            //this.markerPanel_Loadout_Server.style.marginLeft = "0px";
            //this.markerPanel_Loadout_Server.style.marginRight = "3px";
            this.markerPanel_UI_Server = document.createElement("span");
            //this.markerPanel_UI_Server.style.marginLeft = "0px";
            //this.markerPanel_UI_Server.style.marginRight = "3px";


            this.loadOutSelect.onchange = function () {
                _this.clearErrors();
                _this.onDataChange();
            }

            const updateSelect = function (profilName, initial) {
                _this.updateProfileName();
                _this.loadOutSelect.innerHTML = "";
                for (const curProfileName of Object.keys(EquipConfig.getLoadouts()).sort()) {
                    const selected = profilName === curProfileName ? "selected" : "";
                    _this.loadOutSelect.innerHTML += "<option " + selected + ">" + curProfileName + "</option>";
                }
                if (!initial) _this.onDataChange();
            }

            const askForLoadoutName = async function (initialLoadoutname) {
                let loadoutName = initialLoadoutname || "";
                let errMsg = "";
                do {
                    loadoutName = window.prompt((errMsg ? errMsg + " " : "") + "Loadoutname:", loadoutName);
                    errMsg = "";
                    if (loadoutName) {
                        if (loadoutName === initialLoadoutname) {
                            // ok
                        } else if (await EquipConfig.hasLoadout(loadoutName)) {
                            errMsg = "Das Loadout existiert bereits!";
                        }
                    }
                } while (errMsg);
                return loadoutName;
            }

            const saveCurrent = async function (askForName) {
                let profileName;
                if (!askForName) {
                    if (_this.getCurrentSelectedLoadoutName() !== EquipConfig.getCurrentLoadoutName()) {
                        const confirm = window.confirm("Wollen sie das Loadout wirklich überschreiben?");
                        if (!confirm) return;
                    }
                    profileName = _this.getCurrentSelectedLoadoutName();
                } else {
                    profileName = await askForLoadoutName(_this.hasSelectedLoadout() && _this.getCurrentSelectedLoadoutName());
                }
                if (!profileName) return;

                const equipConfig = EquipConfig.getLoadoutFromUI(true);
                await EquipConfig.saveCurrentToLoadout(profileName, equipConfig);
                console.log("Equip wurde gespeichert: ", equipConfig);
                return profileName;
            }

            const loadCurrent = async function () {
                const profileName = _this.loadOutSelect.value;
                const loadout = await EquipConfig.getLoadout(profileName);
                await EquipConfig.setCurrent(profileName, true);
                FormHandler.applyEquip(loadout);
            }

            const renameCurrent = async function () {
                const previousLoadoutName = _this.getCurrentSelectedLoadoutName();
                const loadoutName = await askForLoadoutName(previousLoadoutName);
                if (loadoutName) {
                    await EquipConfig.renameLoadout(previousLoadoutName, loadoutName);
                    _this.updateProfileName();
                    updateSelect(loadoutName);
                }
            }

            this.saveButton = document.createElement("button");
            this.saveButton.type = "button";
            this.saveButton.innerHTML = this.marker_Left + " Speichern";
            this.saveButton.style.lineHeight = "1em";
            this.saveButton.style.display = "none";
            this.saveButton.onclick = async function (e) {
                const saved = await saveCurrent(false);
                if (saved) {
                    updateSelect(_this.getCurrentSelectedLoadoutName());
                    _this.revalidateAll();
                }
            }

            const saveAndRename = async function () {
                const previousLoadoutName = _this.getCurrentSelectedLoadoutName();
                const savedLoadoutName = await saveCurrent(true);
                if (savedLoadoutName) {
                    if (previousLoadoutName !== savedLoadoutName) {
                        await EquipConfig.deleteLoadout(previousLoadoutName);
                    }
                    updateSelect(savedLoadoutName || previousLoadoutName);
                }
            }

            this.saveUnderButton = document.createElement("button");
            this.saveUnderButton.type = "button";
            this.saveUnderButton.innerHTML = " Neu+";
            this.saveUnderButton.style.lineHeight = "1em";
            this.saveUnderButton.style.display = "none";
            this.saveUnderButton.onclick = async function () {
                const savedLoadoutName = await saveCurrent(true);
                if (savedLoadoutName) {
                    updateSelect(savedLoadoutName);
                    _this.revalidateAll();
                }
            }

            this.saveAndLoadButton = document.createElement("button");
            this.saveAndLoadButton.type = "button";
            this.saveAndLoadButton.style.display = "none";
            this.saveAndLoadButton.innerHTML = this.marker_Left + " Speichern + Ausrüsten " + this.marker_Right;
            this.saveAndLoadButton.style.lineHeight = "1em";
            this.saveAndLoadButton.onclick = async function () {
                await saveCurrent();
                _this.saveAndLoadButton.innerHTML = _this.saveAndLoadButton.innerHTML.replace(_this.marker_Right, _.UI.createSpinner().outerHTML);
                await loadCurrent();
            }

            this.renameButton = document.createElement("button");
            this.renameButton.type = "button";
            this.renameButton.style.display = "none";
            this.renameButton.innerHTML = "Umbenennen";
            this.renameButton.style.lineHeight = "1em";
            this.renameButton.onclick = async function () {
                await renameCurrent();
            }

            this.loadButton = document.createElement("button");
            this.loadButton.type = "button";
            this.loadButton.style.display = "none";
            this.loadButton.innerHTML = "Ausrüsten " + this.marker_Right;
            this.loadButton.style.lineHeight = "1em";
            this.loadButton.onclick = async function () {
                _this.loadButton.innerHTML = _this.loadButton.innerHTML.replace(_this.marker_Right, _.UI.createSpinner().outerHTML);
                await loadCurrent();
            }

            this.activButton = document.createElement("button");
            this.activButton.type = "button";
            this.activButton.style.display = "none";
            this.activButton.innerHTML = "Aktuell";
            this.activButton.style.lineHeight = "1em";
            this.activButton.onclick = async function () {
                EquipConfig.setCurrent(_this.getCurrentSelectedLoadoutName(), true);
                _this.updateProfileName();
                _this.onDataChange();
            }

            this.vgSyncButton = document.createElement("button");
            this.vgSyncButton.type = "button";
            this.vgSyncButton.style.display = "none";
            this.vgSyncButton.innerHTML = "NachfüllenTest " + this.marker_Right;
            this.vgSyncButton.style.lineHeight = "1em";
            this.vgSyncButton.onclick = async function () {
                //_this.vgSyncButton.innerHTML = _this.vgSyncButton.innerHTML.replace(_this.marker_Right, _.UI.createSpinner().outerHTML);
                FormHandler.getDynamicVGs((await EquipConfig.getSelectedLoadout()).vgs, true);
            }

            this.deleteButton = document.createElement("button");
            this.deleteButton.type = "button";
            this.deleteButton.innerHTML = "Löschen";
            this.deleteButton.style.lineHeight = "1em";
            this.deleteButton.onclick = async function () {
                const loadoutName = _this.loadOutSelect.value;
                const confirm = window.confirm("Soll das Loadout '" + loadoutName + "' wirklisch gelöscht werden?");
                if (confirm) {
                    await EquipConfig.deleteLoadout(loadoutName);
                    updateSelect();
                }
            }

            panel.append(this.loadoutNamePanel);
            panel.append(this.markerPanel_UI_Loadout);
            panel.append(this.markerPanel_Loadout_Server);
            panel.append(this.markerPanel_UI_Server);
            panel.append(this.loadOutSelect);
            panel.append(this.loadButton);
            //this.markerPanel_UI_Server.style.display = "inline-block";
            //this.markerPanel_UI_Server.style.marginBottom = "5px";
            panel.append(document.createElement("br"));
            let subpanel = document.createElement("div");
            subpanel.style.marginTop = "2px"
            //subpanel.style.marginBottom = "2px"
            panel.append(subpanel);
            subpanel.append(this.activButton);
            subpanel.append(this.saveButton);
            subpanel.append(this.saveAndLoadButton);
            subpanel.append(this.vgSyncButton);
            subpanel = document.createElement("div");
            subpanel.style.marginTop = "2px";
            subpanel.style.marginBottom = "2px";
            panel.append(subpanel);
            subpanel.append(this.saveUnderButton);
            subpanel.append(this.renameButton);
            subpanel.append(this.deleteButton);
            //panel.style.marginLeft = "0px";
            panel.style.marginTop = "10px";
            panel.style.float = "right";
            panel.append(this.warningPanel);

            updateSelect(EquipConfig.getCurrentLoadoutName(), true);

            const title = document.querySelector("h1");
            title.style.display = "inline-block";
            title.parentElement.insertBefore(panel, title.nextSibling);

            this.saveButton.title = "Angezeigte Ausrüstung im Loadout speichern";
            this.saveUnderButton.title = "Angezeigte Ausrüstung als Loadout unter einem abgefragten Namen speichern.";
            this.saveAndLoadButton.title = ""; // wird dynamisch bestimmt
            this.loadButton.title = ""; // wird dynamisch bestimmt
            this.vgSyncButton.title = "Anhand der hinterlegten VG-Konfig im Loadout die Tasche befüllen.";

            // Einzig auf Loadout bezogen
            this.activButton.title = "Als aktuelles Loadout übernehmen.";
            this.renameButton.title = "Das gewählte Loadout umbenennen.";
            this.deleteButton.title = "Das gewählte Loadout löschen";
        }

        /**
         * Wird aufgerufen, wenn ein Gegenstand, die Loadout-Auswahl oder eine VG-Konfig geändert wird.
         */
        static async onDataChange() {
            const selectedLoadoutName = this.getCurrentSelectedLoadoutName();
            const hasVGsConfigured = this.hasSelectedLoadout() && (await EquipConfig.getSelectedLoadout()).vgs;

            this.hasChange_UI_Loadout = !this.hasSelectedLoadout() || await EquipConfig.differs_UI_Loadout(selectedLoadoutName);
            this.hasChange_Loadout_Server = !this.hasSelectedLoadout() || await EquipConfig.differs_Loadout_Server(selectedLoadoutName);
            this.hasChange_UI_Server = await EquipConfig.differs_UI_Server();
            console.log("DIFF", selectedLoadoutName, "UI<>Loadout:" + this.hasChange_UI_Loadout, "Loadout<>Server:" + this.hasChange_Loadout_Server, "UI<>Server:" + this.hasChange_UI_Server);
            this.saveButton.style.display = this.hasSelectedLoadout() && this.hasChange_UI_Loadout ? "" : "none";
            this.renameButton.style.display = this.hasSelectedLoadout() ? "" : "none";
            this.saveUnderButton.style.display = ""; // ist immer möglich
            this.saveAndLoadButton.style.display = this.hasSelectedLoadout() && this.hasChange_UI_Loadout ? "" : "none"; // && this.hasChange_UI_Server
            this.loadButton.style.display = this.hasSelectedLoadout() && (this.hasChange_Loadout_Server || hasVGsConfigured) ? "" : "none";
            console.log("LLLLL", EquipConfig.getSelectedLoadout())
            this.vgSyncButton.style.display = "none"; // & hasVGsConfigured && !this.hasChange_UI_Loadout ? "" : "none";
            if (this.getCurrentSelectedLoadoutName() !== EquipConfig.getCurrentLoadoutName()) {
                this.saveButton.innerHTML = this.marker_Left + " Überschreiben";
            } else {
                this.saveButton.innerHTML = this.marker_Left + " Speichern";
            }
            if (this.getCurrentSelectedLoadoutName() !== EquipConfig.getCurrentLoadoutName()) {
                this.saveAndLoadButton.innerHTML = this.marker_Left + " Überschreiben + Ausrüsten " + this.marker_Right;
                this.saveAndLoadButton.title = "Angezeigte Ausrüstung im Loadout speichern und auch direkt ausrüsten. VGs werden entsprechend der hinterlegten Konfiguration automatisch befüllt!";
            } else {
                this.saveAndLoadButton.innerHTML = this.marker_Left + " Speichern + Ausrüsten " + this.marker_Right;
                this.saveAndLoadButton.title = "Angezeigte Ausrüstung im Loadout speichern und auch direkt ausrüsten. VGs werden entsprechend der hinterlegten Konfiguration automatisch befüllt!";
            }
            if (this.hasChange_UI_Loadout && this.hasChange_UI_Server) {
                this.loadButton.innerHTML = "Trotz Änderungen ausrüsten" + this.marker_Right;
                this.loadButton.title = "Gewähltes Loadout laden und VGs neu befüllen! Änderungen an der UI werden verworfen!";
            } else {
                this.loadButton.innerHTML = "" + this.marker_Right;
                this.loadButton.title = "Gewähltes Loadout laden! VGs werden entsprechend der hinterlegten Konfiguration automatisch befüllt!";
            }
            this.activButton.style.display = (!this.hasChange_UI_Loadout && this.hasChangedProfile()) ? "" : "none";
            this.deleteButton.style.display = this.hasSelectedLoadout() ? "" : "none";
            this.updateProfileName();
        }

        static hasSelectedLoadout() {
            return this.loadOutSelect.value !== "";
        }

        static hasChangedProfile() {
            return EquipConfig.getCurrentLoadoutName() !== this.loadOutSelect.value;
        }

        static getCurrentSelectedLoadoutName() {
            return this.loadOutSelect.value;
        }

        static revalidateAll() {
            this.clearErrors();
            for (const slotName of FormHandler.getAllSlotNames()) {
                EquipConfig.checkValidationOnEquip(slotName, true);
            }
            VGKonfig.checkValidationAll();
        }

        static errors = {};

        static reportProblem(id, msg) {
            //console.warn(id, "Report problem: " + msg);
            this.errors[id] = msg;
            this.updateErrorMsg();
        }

        static removeError(id) {
            delete this.errors[id];
            this.updateErrorMsg();
        }

        static clearErrors() {
            this.errors = {};
            this.updateErrorMsg();
        }

        static updateErrorMsg() {
            this.warningPanel.innerHTML = Object.entries(this.errors).sort().map(a => a[1]).join("<br>");
        }
    }

    class SelectOptimizer {

        static async init() {
            const _this = this;
            await _.Libs.useJQueryUI();

            const errorMsgBox = document.getElementsByClassName("message_error")[0];
            if (errorMsgBox) errorMsgBox.classList.add("combatnote_msg");

            const currentLoadoutName = EquipConfig.getCurrentLoadoutName();
            if (currentLoadoutName) {
                const loadout = await EquipConfig.getLoadout(currentLoadoutName);
                if (!loadout) {
                    EquipConfig.setCurrent(undefined, true);
                } else {
                    const vgs = loadout.vgs;
                    if (vgs) VGKonfig.syncWithLoadout(vgs);
                }
            }

            // instanceId -> Veredelungen
            const gemImages = this.getAllSlotImages();

            const theForm = FormHandler.getTheForm();
            const allSlots = FormHandler.getAllExistingSlots();
            for (const [slotName, slotIdx] of allSlots) {
                const selectField = theForm["LocationEquip[go_" + slotName + "][" + slotIdx + "]"];
                this.addSlotImagesToSelect(gemImages, selectField);
                this.rearrangeOptions(selectField);
                selectField.onchange = async function () {
                    VGKonfig.onEquipSelectChange(slotName, slotIdx);
                    EquipConfig.onEquipSlotChanged(slotName, slotIdx, false);
                    await ControlBar.onDataChange();
                    FormHandler.sortInOrder(slotName);
                }
                _.Libs.betterSelect2(selectField, {templateResult: _this.addSlotImgs});
                VGKonfig.onEquipSelectChange(slotName, slotIdx); // Initial
            }

            ControlBar.revalidateAll();
            await ControlBar.onDataChange(); // Initial
            FormHandler.sortInOrder();
        }

        static rearrangeOptions(selectField) {
            const vgs = [];
            const nonVgs = [];
            for (const cur of selectField.querySelectorAll("option")) {
                if (_.WoDItemDb.isVGName(cur.innerHTML)) {
                    vgs.push(cur);
                } else {
                    nonVgs.push(cur);
                }
            }

            selectField.innerHTML = "";
            if (nonVgs.length > 0) {
                selectField.innerHTML += nonVgs.map(a => a.outerHTML).join();
            }
            if (vgs.length > 0) {
                const header = "<option disabled>⎯⎯⎯⎯⎯⎯⎯ Verbrauchsgegenstände ⎯⎯⎯⎯⎯⎯⎯</option>"
                selectField.innerHTML += header + vgs.map(a => a.outerHTML).join();
            }
        }

        static getAllSlotImages() {
            const imageMap = {};
            const trs = document.getElementsByName('ITEMS_LOCATION')[0].getElementsByTagName('tr');
            for (const curTr of trs) {
                const id = Number(curTr.childNodes[0].innerHTML);
                const imgs = curTr.childNodes[3].querySelectorAll('img');
                imageMap[id] = "";
                for (const curImg of imgs) {
                    imageMap[id] += "<img src='" + curImg.src + "'/>";
                }
            }
            return imageMap;
        }

        static addSlotImagesToSelect(src_obj, select) {
            let selectedId;
            for (const [idx, option] of Object.entries(select.options)) {
                if (Number(idx) === 0) {
                    selectedId = -Number(option.value);
                } else {
                    let curId;
                    if (Number(option.value) === 0) {
                        curId = selectedId;
                    } else {
                        curId = Number(option.value);
                    }
                    if (src_obj[curId]) option.setAttribute("slotImgs", src_obj[curId]);
                }
            }
        }

        static addSlotImgs(data) {
            if (data.element !== undefined && data.element.attributes.slotImgs !== undefined) {
                return $('<span>' + data.text + " " + data.element.attributes.slotImgs.value + '</span>');
            } else {
                return data.text;
            }
        }
    }

    class VGKonfig {

        static vgSelects = {};

        static syncWithLoadout(loadoutVGs) {
            for (const [slotName, slotDef] of Object.entries(loadoutVGs)) {
                for (const [vgBaseName, amount] of Object.entries(slotDef.items)) {
                    VGKonfig.ensureUpdateVGKonfig(vgBaseName, slotName, amount, true);
                }
            }
        }

        static checkValidationAll() {
            for (const [vgBaseName, vgCfg] of Object.entries(this.vgSelects)) {
                this.checkValidation(vgBaseName);
            }
        }

        static checkValidation(vgBaseName) {
            const vgCfg = this.vgSelects[vgBaseName];
            if (!vgCfg) {
                ControlBar.removeError(vgBaseName);
                return;
            }

            const curEquippedAmount = FormHandler.getCurrentEquippedVGAmount(vgBaseName);
            if (curEquippedAmount < vgCfg.amount) {
                ControlBar.reportProblem(vgBaseName, vgBaseName + " zu wenig ausgerüstet " + curEquippedAmount + " < " + vgCfg.amount);
            } else {
                ControlBar.removeError(vgBaseName);
            }
        }

        static getCurrentUiVGKonfig(uiEquip) {
            const vgDefs = {};
            for (const curVgDef of Object.values(this.vgSelects)) {
                const slotName = curVgDef.slotName;
                let slotEntry = vgDefs[slotName];
                if (!slotEntry) {
                    slotEntry = vgDefs[slotName] = {
                        items: {}
                    };
                    const slotCount = FormHandler.getAllSlotCounts()[slotName] + 1;
                    const usedSlots = uiEquip[slotName] ? Object.keys(uiEquip[slotName]).length : 0;
                    slotEntry.slots = slotCount - usedSlots; // free slots
                }
                const items = slotEntry.items;
                items[curVgDef.vgBaseName] = curVgDef.amount;
            }
            if (Object.keys(vgDefs).length === 0) return;
            return vgDefs;
        }

        static addVGKonfig(vgBaseName, slotName, slotIdx, amount) {
            const _this = this;
            const textInput = document.createElement("input");
            textInput.type = "text";
            textInput.maxLength = 3;
            textInput.size = 1;
            let latestValue = amount || 1;
            textInput.value = latestValue;

            const vgKonfig = document.createElement("span");
            vgKonfig.classList.add("nowod");
            vgKonfig.classList.add("VGconfig");
            vgKonfig.innerHTML = "≥ ";
            vgKonfig.append(textInput);

            let availableAmount = FormHandler.getAvailableVGAmount(slotName, vgBaseName);
            const amountElem = document.createElement("span");
            amountElem.innerHTML = "/ " + availableAmount;
            vgKonfig.append(amountElem);

            const selectField = FormHandler.getSelectField(slotName, slotIdx);
            let mainElement;
            if (selectField) {
                const td = document.createElement("td");
                selectField.parentElement.parentElement.append(td);
                td.append(vgKonfig);
                mainElement = td;
            } else {
                const lastSelectField = FormHandler.getLastSelectField(slotName);
                if (lastSelectField) { // nur wenn mindestens 1 Slot verfügbar ist
                    let tr = document.createElement("tr");
                    mainElement = tr;
                    tr.innerHTML = "<td></td>";
                    const td = document.createElement("td");
                    tr.append(td);
                    if (FormHandler.isMultiSlot(slotName)) {
                        lastSelectField.parentElement.parentElement.parentElement.append(tr);
                    } else {
                        lastSelectField.parentElement.parentElement.parentElement.insertBefore(tr, lastSelectField.parentElement.parentElement.nextElementSibling);
                    }
                    td.colSpan = 100;
                    td.innerHTML = vgBaseName + ": ";
                    td.append(vgKonfig);
                }
            }

            this.vgSelects[vgBaseName] = {
                vgBaseName: vgBaseName,
                slotName: slotName,
                slotIdx: slotIdx,
                amount: latestValue,
                elem: mainElement,
            };

            textInput.onchange = async function () {
                try {
                    let newValue;
                    if (textInput.value === "") {
                        newValue = 1;
                    } else {
                        newValue = Number(textInput.value);
                        if (isNaN(newValue) || (selectField && newValue < 1) || newValue < 0) throw new Errror("Not a valid number");
                    }
                    if (newValue === 0) {
                        _this.remove(vgBaseName);
                    } else {
                        latestValue = newValue;
                        _this.vgSelects[vgBaseName].amount = newValue;
                    }
                    ControlBar.onDataChange();
                    _this.checkValidation(vgBaseName);
                } catch (e) { // reset
                    textInput.value = latestValue;
                }
            }
        }

        /**
         * Stellt sich, dass an der richtigen Stelle die Konfig für den Vebrauchsgegenstand auftaucht
         */
        static ensureUpdateVGKonfig(vgBaseName, slotName, amount, initial) {
            const [wantedSlotName, wantedSlotIdx] = this.findFirstVGItem(vgBaseName, slotName);
            const existingKonfig = this.vgSelects[vgBaseName];
            if (!existingKonfig) {
                this.addVGKonfig(vgBaseName, slotName, wantedSlotIdx, amount || 1);
            } else if (existingKonfig.slotIdx !== wantedSlotIdx) {
                existingKonfig.elem.remove();
                if (initial || this.findFirstVGItem(vgBaseName, slotName)[1]) { // Behalten nur initial und wenn es noch ein anderes SelectField mit diesem Item existiert
                    this.addVGKonfig(vgBaseName, slotName, wantedSlotIdx, existingKonfig.amount);
                } else {
                    delete this.vgSelects[vgBaseName];
                }
            }
            this.checkValidation(vgBaseName);
        }

        static findFirstVGItem(vgBaseName, slotName) {
            for (const [curSlotName, slotIdx] of FormHandler.getAllExistingSlots()) {
                if (curSlotName !== slotName) continue;
                const [instanceId, instanceName] = FormHandler.getSlotSelectedItemInformation(curSlotName, slotIdx);
                if (!instanceName) continue;
                const curBaseName = _.WoDItemDb.getItemVGBaseName(instanceName);
                if (vgBaseName === curBaseName) {
                    return [curSlotName, slotIdx];
                }
            }
            return [];
        }

        static onEquipSelectChange(slotName, slotIdx) {
            const _this = this;
            // Prüfen ob hier bereits eine Konfiguration vorliegt und diese aktualisieren
            let alreadyChecked;
            for (const [key, def] of Object.entries(_this.vgSelects)) {
                if (def.slotIdx === slotIdx && def.slotName === slotName) {
                    alreadyChecked = def.vgBaseName;
                    _this.ensureUpdateVGKonfig(def.vgBaseName, slotName);
                    break;
                }
            }

            // Prüfen ob der neue Eintrag einen neuen Wert triggert
            const [instanceId, itemName] = FormHandler.getSlotSelectedItemInformation(slotName, slotIdx);
            if (!itemName || !_.WoDItemDb.isVGName(itemName)) return;
            const vgBaseName = _.WoDItemDb.getItemVGBaseName(itemName);
            if (alreadyChecked !== vgBaseName) _this.ensureUpdateVGKonfig(vgBaseName, slotName);

            this.checkRemoval(slotName, slotIdx);
        }

        static checkRemoval(slotName, slotIdx) {
            if (!FormHandler.isMultiSlot(slotName)) {
                for (const [vgBaseName, vgCfg] of Object.entries(this.vgSelects)) {
                    if (FormHandler.getCurrentEquippedVGAmount(vgBaseName) <= 0) {
                        this.remove(vgBaseName);
                    }
                }
            }
        }

        static remove(vgBaseName) {
            this.vgSelects[vgBaseName].elem.remove();
            delete this.vgSelects[vgBaseName];
            ControlBar.removeError(vgBaseName);
        }

    }

    class EquipConfig {

        static #heroId;
        static #equipConfigs; // save(), load()
        static #serverEquip;
        static #serverEquipOhneVGs;
        static #serverEquipUniqueVgs;

        static async init() {
            this.#heroId = _.WoD.getMyHeroId();
            await this.#load();
            if (!this.#equipConfigs) {
                this.#equipConfigs = {
                    id: this.#heroId,
                    loadouts: {}
                }
                await this.#save();
            }
            [this.#serverEquipOhneVGs, this.#serverEquipUniqueVgs] = FormHandler.getUIEquipOnlyIds(1);
            this.#serverEquip = FormHandler.getServerEquipOnlyIds();
            console.log("Loaded Equip: ", this.#serverEquip);
        }

        static async onEquipSlotChanged(slotName, slotIdx, initial) {
            const loadout = await this.getCurrentLoadout();
            if (!loadout) return;
            const equip = loadout.equip;
            const isMultiSlot = FormHandler.isMultiSlot(slotName);
            if (!isMultiSlot) {
                this.checkValidationOnEquipSlot(equip, slotName, slotIdx, initial);
            } else if (!initial) { // Initial wird dieses nur einmalig aufgerufen und nicht auf jedem Slot
                this.checkValidationOnEquip(slotName, false);
            }
        }

        static async checkValidationOnEquip(slotName, initial) {
            const loadout = await EquipConfig.getSelectedLoadout()
            if (!loadout) return;

            let equippedIds = FormHandler.getUIEquipOnlyIds()[slotName];
            if (!equippedIds || !Array.isArray(equippedIds)) equippedIds = [equippedIds];

            const checkExists = function (itemDef) {
                if (!equippedIds.includes(itemDef.id)) {
                    if (initial) ControlBar.reportProblem(itemDef.id, "Fehlendes Item [" + slotName + "]: " + itemDef.name);
                } else {
                    ControlBar.removeError(itemDef.id);
                }
            }
            const slotDef = loadout.equip[slotName];
            if (!slotDef) return;
            if (Array.isArray(slotDef)) {
                for (const itemDef of slotDef) {
                    checkExists(itemDef);
                }
            } else {
                checkExists(slotDef);
            }
        }

        static async checkValidationOnEquipSlot(loadOutEquip, slotName, slotIdx, initial) {
            const [instanceId, itemName] = FormHandler.getSlotSelectedItemInformation(slotName, slotIdx);
            const wantedId = loadOutEquip[slotName] && loadOutEquip[slotName].id;
            const wantedName = loadOutEquip[slotName] && loadOutEquip[slotName].name;
            if (wantedId !== instanceId) {
                if (initial) ControlBar.reportProblem(wantedId, slotName + " fehlt das Item: " + wantedName);
            } else {
                ControlBar.removeError(wantedId);
            }
        }

        static async getCurrentLoadout() {
            const loadoutName = this.getCurrentLoadoutName();
            if (!loadoutName) return;
            return await this.getLoadout(loadoutName);
        }

        static async getSelectedLoadout() {
            const loadoutName = ControlBar.getCurrentSelectedLoadoutName();
            if (!loadoutName) return;
            return await this.getLoadout(loadoutName);
        }

        static getLoadoutFromUI(ignoreVGs) {
            const equipConfig = {
                equip: FormHandler.getCurrentEquipWithFullInformation(ignoreVGs),
            }
            const vgDefs = VGKonfig.getCurrentUiVGKonfig(equipConfig.equip);
            if (vgDefs) equipConfig.vgs = vgDefs;
            return equipConfig;
        }

        static differs_UI_Server() {
            const currentUiEquip = FormHandler.getUIEquipOnlyIds();
            const previousEquip = this.#serverEquip;
            const result = !_.util.deepEqual(currentUiEquip, previousEquip);
            console.log("differs_UI_Server", result, previousEquip, currentUiEquip);
            return result;
        }

        static async differs_Loadout_Server(loadOutName) {
            loadOutName = loadOutName || this.getCurrentLoadoutName();
            const [loadoutEquip, loadoutVgs] = await this.#getSnapshotFromLoadout(loadOutName);
            if (!loadoutEquip) return true;
            return this.#compareEquips(this.#serverEquipOhneVGs, undefined, loadoutEquip, undefined, "differs_Loadout_Server");
        }

        /**
         * Überprüft die Instanz-Ids der nicht VGs, dazu noch die VG-Konfigs
         */
        static async differs_UI_Loadout(loadOutName) {
            const [currentUiEquip, uniqueVGs] = FormHandler.getUIEquipOnlyIds(1);
            loadOutName = loadOutName || this.getCurrentLoadoutName();
            const [loadoutEquip, loadoutVgs] = await this.#getSnapshotFromLoadout(loadOutName);
            if (!loadoutEquip) return true;
            return this.#compareEquips(currentUiEquip, VGKonfig.getCurrentUiVGKonfig(currentUiEquip), loadoutEquip, loadoutVgs, "differs_UI_Loadout");
        }

        static async #getSnapshotFromLoadout(loadOutName) {
            if (!loadOutName) return [];
            const currentEquipCfg = await this.getLoadout(loadOutName);
            if (!currentEquipCfg) return [];
            const storeEquip = {};
            for (const [key, value] of Object.entries(currentEquipCfg.equip)) {
                if (Array.isArray(value)) {
                    const list = [];
                    storeEquip[key] = list;
                    for (const cur of value) {
                        list.push(cur.id);
                    }
                    list.sort();
                } else {
                    storeEquip[key] = value.id;
                }
            }
            return [storeEquip, currentEquipCfg.vgs];
        }

        static #compareEquips(equip1, vgCfg1, equip2, vgCfg2, debugMethod) {
            let result = !_.util.deepEqual(equip1, equip2);
            console.log(debugMethod + "#1", result, equip1, equip2);
            if (result) return true;

            if (vgCfg1 || vgCfg2) {
                result = !_.util.deepEqual(vgCfg1, vgCfg2);
                console.log(debugMethod + "#2", result, vgCfg1, vgCfg2);
            }
            return result;
        }

        static getCurrentLoadoutName() {
            return this.#equipConfigs.current;
        }

        static getLoadouts() {
            return this.#equipConfigs.loadouts;
        }

        static async setCurrent(profileName, diretSave) {
            this.#equipConfigs.current = profileName;
            if (diretSave) {
                await MyStorage.equipHeroes.setValue(this.#equipConfigs);
            }
        }

        static async hasLoadout(loadoutName) {
            return this.#equipConfigs.loadouts[loadoutName];
        }

        static async renameLoadout(previousLoadoutname, nextLoadoutname) {
            const loadout = await this.getLoadout(previousLoadoutname);
            loadout.id = this.getLoadoutId(nextLoadoutname);
            loadout.name = nextLoadoutname;
            await MyStorage.equipLoadout.setValue(loadout);

            const prevCfg = this.#equipConfigs.loadouts[previousLoadoutname];
            delete this.#equipConfigs.loadouts[previousLoadoutname];
            this.#equipConfigs.loadouts[nextLoadoutname] = prevCfg;
            if (previousLoadoutname === this.getCurrentLoadoutName()) {
                this.setCurrent(nextLoadoutname, false);
            }
            await this.#save();
        }

        static async getLoadout(loadoutName) {
            const id = this.getLoadoutId(loadoutName);
            return await MyStorage.equipLoadout.getValue(id);
        }

        static async deleteLoadout(loadoutName) {
            const id = this.getLoadoutId(loadoutName);
            delete this.#equipConfigs.loadouts[loadoutName];
            if (this.#equipConfigs.current === loadoutName) {
                delete this.#equipConfigs.current;
            }
            await MyStorage.equipLoadout.deleteValue(id);
            await this.#save();
        }

        static async saveCurrentToLoadout(profileName, equipConfig) {
            equipConfig.id = this.getLoadoutId(profileName);
            equipConfig.name = profileName;
            const now = new Date().getTime();
            this.#equipConfigs.loadouts[profileName] = {
                ts: now,
            }
            this.setCurrent(profileName, false);
            equipConfig.ts = now;
            await MyStorage.equipHeroes.setValue(this.#equipConfigs);
            await MyStorage.equipLoadout.setValue(equipConfig);
        }

        static getLoadoutId(profileName) {
            return this.#heroId + "|" + profileName;
        }

        static async #load() {
            this.#equipConfigs = await MyStorage.equipHeroes.getValue(this.#heroId);
        }

        static async #save() {
            await MyStorage.equipHeroes.setValue(this.#equipConfigs);
        }

    }

    class FormHandler {

        static getTheForm() {
            return document.getElementsByName("the_form")[0];
        }

        static getSelectField(slotName, slotIdx) {
            return this.getTheForm()["LocationEquip[go_" + slotName + "][" + slotIdx + "]"];
        }

        static getLastSelectField(slotName) {
            let lastSlotIdx;
            for (const [curSlotName, curSlotIdx] of FormHandler.getAllExistingSlots()) {
                if (curSlotName === slotName) lastSlotIdx = curSlotIdx;
            }
            return FormHandler.getSelectField(slotName, lastSlotIdx);
        }

        /**
         * @return [itemId, itemName] (can be [] if no item is selected)
         */
        static getSlotSelectedItemInformation(slotName, slotIdx) {
            const cur = this.getSelectField(slotName, slotIdx);
            const option = cur.options[cur.selectedIndex];
            if (!option.text) return [];
            const unselectOption = cur.options[0];
            const itemId = Number(cur.value) || (-Number(unselectOption.value));
            return [itemId, option.text];
        }

        static getAvailableVGAmount(slotName, vgBaseName) {
            let availableAmount = FormHandler.getAllSlotOptionsByName(slotName);
            if (!availableAmount) return 0;
            availableAmount = availableAmount[vgBaseName];
            if (!availableAmount) return 0;
            return availableAmount.sum;
        }

        static getCurrentEquippedVGAmount(vgBaseName) {
            let result = 0;
            for (const [slotName, slotIdx] of this.getAllExistingSlots()) {
                const [, itemName] = this.getSlotSelectedItemInformation(slotName, slotIdx);
                if (!itemName) continue;
                const [curVgBaseName, amount, max] = _.WoDItemDb.getItemVGInfos(itemName);
                if (!vgBaseName || curVgBaseName !== vgBaseName) continue;
                result += Number(amount);
            }
            return result;
        }

        static getCurrentEquipWithFullInformation(ignoreVGs) {
            const theForm = this.getTheForm();
            const equip = {};
            const allFields = theForm.querySelectorAll("select[name^='LocationEquip']");
            for (const cur of allFields) {
                const option = cur.options[cur.selectedIndex];
                const itemName = option.text;
                if (!itemName || (ignoreVGs && _.WoDItemDb.isVGName(itemName))) continue;
                const unselectOption = cur.options[0];
                const slotMatch = cur.name.match(/^LocationEquip\[go_(\w*)\]\[(\d*)\].*/);
                const slotName = slotMatch[1];
                const isMultipleSlot = this.isMultiSlot(slotName);
                // TODO: Veredelungen mit hinzufügen, falls nach einer Alternative gesucht werden muss
                const item = {
                    id: Number(cur.value) || -Number(unselectOption.value),
                    name: itemName,
                }
                if (isMultipleSlot) {
                    const equipSlot = equip[slotName] || (equip[slotName] = []);
                    equipSlot.push(item);
                } else {
                    equip[slotName] = item;
                }
            }
            return equip;
        }

        /**
         * Gibt die vorherig ausgewählten IDs zurück, also die, die auf dem Server gespeichert sind.
         */
        static getServerEquipOnlyIds() {
            return this.#getEquipCfgIds("input", "Default", false, cur => Number(cur.value));
        }

        static getUIEquipOnlyIds(vgMode) {
            return this.#getEquipCfgIds("select", "Equip", vgMode, cur => {
                let result = Number(cur.value);
                if (result) return result;
                const unselectOption = cur.options[0];
                return -Number(unselectOption.value) || 0;
            });
        }

        static #getEquipCfgIds(type, name, vgMode, idFn) {
            const theForm = document.getElementsByName("the_form")[0];
            const equip = {};
            const allFields = theForm.querySelectorAll(type + "[name^='Location" + name + "']"); // Select or Input-Fields
            const vgs = [];
            for (const cur of allFields) {
                const patternString = new RegExp("^Location" + name + "\\[go_(\\w*)\\]\\[(\\d*)\\].*");
                const slotMatch = cur.name.match(patternString);
                const slotName = slotMatch[1];
                if (vgMode) { // !!! geht nur bei den SelectFields, da nur dort die ItemNamen hinterlegt sind
                    const itemName = this.getSelectedItemText(cur);
                    if (_.WoDItemDb.isVGName(itemName)) {
                        vgs.push(itemName);
                        continue;
                    }
                }
                const isMultipleSlot = this.isMultiSlot(slotName);
                const itemId = idFn(cur);
                if (isMultipleSlot) {
                    const equipSlot = equip[slotName] || (equip[slotName] = []);
                    if (itemId > 0) equipSlot.push(itemId);
                } else if (itemId > 0) {
                    equip[slotName] = itemId;
                }
            }
            for (const cur of ["tasche", "ring", "orden"]) {
                const list = equip[cur];
                if (list) list.sort();
            }
            if (vgMode === 1) { // nur die Unique-Namen liefern
                const vgResult = {};
                for (const cur of vgs) {
                    vgResult[_.WoDItemDb.getItemVGBaseName(cur)] = 1;
                }
                return [equip, Object.keys(vgResult).sort()];
            }
            return equip;
        }

        static getSelectedItemText(selectField) {
            const option = selectField.options[selectField.selectedIndex];
            return option.text;
        }

        static getSlotIdx(selectField) {
            return selectField.name.match(/^LocationEquip\[go_(\w*)\]\[(\d*)\].*/)[2];
        }

        static isMultiSlot(slotName) {
            return slotName === "ring" || slotName === "orden" || slotName === "tasche";
        }

        static _allSlotNameCache;
        static _allSlotsCache;
        static _allSlotCountsCache;

        /**
         * Liefert den letzten Index eines jeden Slots. -1 wenn nicht vorhanden.
         * {
         *     "tasche": 2,
         * }
         */
        static getAllSlotCounts() {
            if (this._allSlotCountsCache) return this._allSlotCountsCache;
            this.#generateSlotCache();
            return this._allSlotCountsCache;
        }

        /**
         * Liefert auch "tasche", wenn sie nicht vorhanden ist. Alle möglichen Slotnames in einem Array.
         */
        static getAllSlotNames() {
            if (this._allSlotNameCache) return this._allSlotNameCache;
            this.#generateSlotCache();
            return this._allSlotNameCache;
        }

        /**
         * @returns Array of [slotName, slotIdx]
         */
        static getAllExistingSlots() {
            if (this._allSlotsCache) return this._allSlotsCache;
            this.#generateSlotCache();
            return this._allSlotsCache;
        }

        static #generateSlotCache() {
            const allFields = this.getTheForm().querySelectorAll("input[name^='LocationDefault']");
            const result = [];
            const result2 = {"tasche": 1}; // tasche kann auch mal komplett nicht vorhanden sein
            const result3 = {"tasche": -1};
            for (const cur of allFields) {
                const slotMatch = cur.name.match(/^LocationDefault\[go_(\w*)\]\[(\d*)\].*/);
                const slotName = slotMatch[1];
                const slotIdx = Number(slotMatch[2]);
                result.push([slotName, slotIdx]);
                result2[slotName] = 1;
                result3[slotName] = slotIdx;
            }
            this._allSlotsCache = result;
            this._allSlotNameCache = Object.keys(result2);
            this._allSlotCountsCache = result3;
        }

        /**
         * slotName = "ring" oder "tasche"
         */
        static sortInOrder(slotName) {
            if (!slotName) {
                this.sortInOrder2(this.#getTrWrapper("tasche"));
                this.sortInOrder2(this.#getTrWrapper("ring"));
            } else if (this.isMultiSlot(slotName)) {
                this.sortInOrder2(this.#getTrWrapper(slotName));
            }
        }

        static #getTrWrapper(slotName) {
            const selectField = this.getSelectField(slotName, 0);
            if (!selectField) return;
            return selectField.parentElement.parentElement.parentElement; // das Element, wo die TRs drin sind
        }

        static sortInOrder2(trWrapper) {
            if (!trWrapper) return; // tasche existiert evtl. nicht
            const tableTRs = [];
            for (const tr of trWrapper.children) {
                const selectField = tr.querySelector("select[name^='LocationEquip']");
                if (!selectField) continue;
                const slotIdx = Number(this.getSlotIdx(selectField));
                let selectedName = selectField.options[selectField.selectedIndex].text;
                let sortGroup;
                let colorCode;
                if (selectedName === "") { // 0 ist ganz unten
                    sortGroup = 0;
                    colorCode = "rgba(0,0,0,0.6)";
                } else {
                    const [curVgBaseName, amount, max] = _.WoDItemDb.getItemVGInfos(selectedName);
                    if (curVgBaseName) {
                        sortGroup = 1;
                        selectedName = curVgBaseName;
                        colorCode = "rgba(155,155,155,0.6)";
                    } else {
                        sortGroup = 2;
                    }
                }
                tableTRs.push([tr, sortGroup, selectedName, colorCode, slotIdx]);
            }
            tableTRs.sort((a, b) => {
                if (a[1] !== b[1]) return b[1] - a[1];
                let result = a[2].localeCompare(b[2]);
                if (result !== 0) return result;
                if (a[4] !== b[4]) return a[4] - b[4];
                return 0;
            })
            let i = 1;
            for (const trEntry of tableTRs) {
                const tr = trEntry[0];
                if (trEntry[3]) tr.style.backgroundColor = trEntry[3];
                tr.children[0].innerHTML = tr.children[0].innerHTML.replace(/#\d+/, "#" + i);
                _.UI.insertAtIndex(trWrapper, tr, i);
                i++;
            }
        }

        /**
         * Genau dies Equip anlegen und nichts anderes.
         * Um exakt zu funktionieren, muss die Seite aktuell sein, da man auch explizit Gegenstände ablegen muss.
         */
        static applyEquip(loadout) {
            const equip = _.util.cloneObject(loadout.equip);
            const vgs = this.getDynamicVGs(loadout.vgs);
            for (const [slotName, itemIds] of Object.entries(vgs)) {
                if (this.isMultiSlot(slotName)) {
                    for (const itemId of itemIds) {
                        equip[slotName].push({id: itemId});
                    }
                } else {
                    equip[slotName] = {id: itemIds[0]};
                }
            }
            const theForm = document.getElementsByName("the_form")[0];
            const newForm = document.createElement("form");
            newForm.style.display = "none";
            newForm.method = theForm.method;
            newForm.action = theForm.action;
            newForm.acceptCharset = theForm.acceptCharset;
            const defaultEquip = this.getServerEquipOnlyIds();

            function addFormValue(key, value) {
                const newValue = document.createElement("input");
                newValue.type = "hidden";
                newValue.name = key;
                newValue.value = value;
                newForm.append(newValue);
            }

            addFormValue("ok", "Änderungen durchführen"); // wird benötigt

            for (const cur of theForm.querySelectorAll("input[type='hidden']")) {
                if (cur.name.startsWith("Location")) continue;
                const newHidden = document.createElement("input");
                newHidden.type = "hidden";
                newHidden.name = cur.name;
                newHidden.value = cur.value;
                newForm.append(newHidden);
            }

            const adds = [];
            const removes = [];

            function addEntry(slotName, idx, value) {
                const entry = [slotName, idx, value];
                if (value < 0) removes.push(entry);
                else adds.push(entry);
            }

            function getId(itemDef) {
                if (typeof itemDef === "number") return itemDef;
                return itemDef.id;
            }

            for (const slotName of this.getAllSlotNames()) {
                const wantedEquip = equip[slotName];
                if (this.isMultiSlot(slotName)) {
                    const slotIds = [];
                    if (wantedEquip) {
                        for (const [idx, cur] of wantedEquip.entries()) {
                            const itemId = getId(cur);
                            slotIds.push(itemId);
                            if (!defaultEquip[slotName] || !defaultEquip[slotName].includes(itemId)) {
                                addEntry(slotName, idx, itemId);
                            }
                        }
                    }
                    // Überprüfen, was abgelegt werden soll
                    let idx = (wantedEquip && wantedEquip.length) || 0;
                    if (defaultEquip[slotName]) { // tasche kann auch mal komplett nicht vorhanden sein
                        for (const itemId of defaultEquip[slotName]) {
                            if (!slotIds.includes(itemId)) {
                                addEntry(slotName, idx, -itemId);
                                idx++;
                            }
                        }
                    }
                } else {
                    if (wantedEquip) {
                        const itemId = getId(wantedEquip);
                        if (defaultEquip[slotName] !== itemId) {
                            addEntry(slotName, 0, itemId);
                        }
                    } else {
                        if (defaultEquip[slotName]) {
                            addEntry(slotName, 0, -defaultEquip[slotName]);
                        }
                    }
                }
            }

            // Erst alles entfernen, dann alles hinzufügen. Verhindert die häufigste Meldung aufgrunde von Tragebeschränkungen.
            const reindex = {};
            const getNextIndex = function (slotName) {
                let result = reindex[slotName];
                if (result === undefined) {
                    return reindex[slotName] = 0;
                }
                return reindex[slotName] = (reindex[slotName] + 1);
            }
            for (const cur of removes) {
                addFormValue("LocationEquip[go_" + cur[0] + "][" + getNextIndex(cur[0]) + "]", cur[2]);
            }
            for (const cur of adds) {
                addFormValue("LocationEquip[go_" + cur[0] + "][" + getNextIndex(cur[0]) + "]", cur[2]);
            }

            document.body.append(newForm);
            newForm.submit();
        }

        /**
         * Primäres Ziel: möglichst kleine Stacks aufbrauchen
         */
        static getDynamicVGs(vgsDef, debug) {
            if (!vgsDef) return [];
            const result = {};
            for (const [slotName, itemsDef] of Object.entries(vgsDef)) {
                const stacksDef = this.getAllSlotOptionsByName(slotName, 1);
                if (!stacksDef) return;
                const slotResult = result[slotName] = [];
                const freeSlots = itemsDef.slots; // Anzahl verfügbarer Slots
                const vgsToFillCount = Object.keys(itemsDef.items).length; // Anzahl gewünschter unterschiedlicher VGs
                const additionalSlots = freeSlots - vgsToFillCount;
                if (additionalSlots < 0) console.error("Tasche kann nicht ausreichend gefüllt werden, da nicht genügend Slots für VGs frei sind!");

                const arrTimes = function (nr, times) {
                    const result = [];
                    for (let i = 0; i < times; i++) {
                        result.push(nr);
                    }
                    return result;
                }

                const slotUsages = [];
                let realUsedSlots = 0;
                for (const [vgBaseName, wantedAmount] of Object.entries(itemsDef.items)) {
                    const stackInfo = stacksDef[vgBaseName];
                    if (!stackInfo) continue; // ERROR: Keine Stacks um vgBaseName zu bedienen

                    const cur = {
                        name: vgBaseName,
                        slots: 1,
                        info: stackInfo,
                        // hier könnte man noch optimieren, da wir eigentlich gar nicht die gesamte StackSizeOrder brauchen, sondern nur soviel wie wir überhaupt Slots zu vergeben haben
                        stackSizeInOrder: Object.entries(stackInfo.stacks).map(a => [Number(a[0]), a[1].length]).sort((a, b) => b[0] - a[0]).flatMap(a => arrTimes(a[0], a[1])),
                        wantedAmount: wantedAmount,
                    };
                    cur.maxAvailable = Number(cur.stackSizeInOrder[0]); // cur.slots - 1
                    cur.prio = this.#priority(cur);
                    slotUsages.push(cur);
                    realUsedSlots++;
                }
                if (debug) console.log("Initial SlotUsage: ", _.util.cloneObject(slotUsages))
                for (let i = 0, l = freeSlots - realUsedSlots; i < l; i++) {
                    const best = slotUsages.reduce(function (prev, current) {
                        return (prev && prev.prio > current.prio) ? prev : current
                    }); //returns object
                    if (debug) console.log("Add Slot for " + best.name + " prio:" + best.prio);
                    best.slots++;
                    // Es wird der max Stack verbraucht
                    best.maxAvailable += Number(best.stackSizeInOrder[best.slots - 1]);
                    best.prio = this.#priority(best);
                }
                if (debug) console.log("SlotUsages: " + slotName, slotUsages);

                for (const slotUsage of slotUsages) {
                    const wantedAmount = slotUsage.wantedAmount;
                    const numberArray = Object.entries(slotUsage.info.stacks).reduce((map, a) => {
                        map[a[0]] = a[1].length;
                        return map;
                    }, {});
                    const kResult = this.#getKnappsack(numberArray, slotUsage.slots, wantedAmount);
                    if (debug) console.log("Knappsack: ", kResult);
                    for (const [key, value] of Object.entries(kResult[1])) {
                        for (let i = 0; i < value; i++) {
                            slotResult.push(slotUsage.info.stacks[key][i]);
                        }
                    }
                }
            }
            // console.log("RESULTS: ", result);
            return result;
        }

        /**
         * Bewertet die Priorität, ob noch ein weiterer Slot konsumiert werden sollte.
         */
        static #priority(slotUsage) {
            const stackInfo = slotUsage.info;
            const stackCount = stackInfo.stackCount;
            const alreadyConsumedSlots = slotUsage.slots;
            if (alreadyConsumedSlots >= stackCount) return 0; // Wir haben gar keinen weiteren Stack mehr
            const wantedAmount = slotUsage.wantedAmount;
            const maxAvailableStackSize = slotUsage.maxAvailable;
            if (wantedAmount > maxAvailableStackSize) return Number.MAX_VALUE; // Wir brauchen auf jeden Fall einen weiteren Slot
            const minStackSize = stackInfo.min;
            const amountSum = stackInfo.sum; // Anzahl an VGs
            const avgStackCount = amountSum / stackCount;
            return stackCount * avgStackCount / stackInfo.stackSize / alreadyConsumedSlots;
        }

        /**
         * Es soll in Summe mindestens X aber nicht weniger erreicht werden.
         * Es sollen genau 'count'-Items verwendet werden.
         * NumberArray: {1: 2, 2: 4}
         */
        static #getKnappsack(numberArray, count, X) {
            const availableNumbers = Object.keys(numberArray);
            const resultArr = [];
            const resultMap = {};
            let resultCount = 0;

            let prev;
            do { // take the smallest available
                prev = resultCount;
                for (const cur of availableNumbers) {
                    if (numberArray[cur] > (resultMap[cur] || 0)) {
                        const add = Number(cur);
                        resultCount += add;
                        resultArr.push(add);
                        resultMap[cur] = (resultMap[cur] || 0) + 1;
                        break;
                    }
                }
            } while (resultArr.length < count && resultCount > prev);
            if (resultCount >= X || resultArr.length !== count) return [resultArr, resultMap, resultCount]; // Ziel erreicht oder Abbruch

            const increaseANumber = function () {
                // increase one number
                for (let i = resultArr.length - 1; i >= 0; i--) {
                    const oldNumber = resultArr[i];
                    for (const cur of availableNumbers) {
                        const newNumber = Number(cur);
                        if (oldNumber >= newNumber) continue; // erstmal eine größere Zahl finden
                        if (numberArray[cur] > (resultMap[cur] || 0)) { // ist noch eine verfügbar
                            resultCount += (newNumber - oldNumber);
                            resultArr[i] = newNumber;
                            resultMap[oldNumber] -= 1;
                            if (resultMap[oldNumber] === 0) delete resultMap[oldNumber];
                            resultMap[cur] = (resultMap[cur] || 0) + 1;
                            return true;
                        }
                    }
                }
            }

            do {
                prev = resultCount;
                const increased = increaseANumber();
            } while (resultCount > prev && resultCount < X);

            return [resultArr, resultMap, resultCount];
        }

        static _allVGItemStats = {};

        /**
         * Gruppiert nach BaseName.
         * slotName -> vgBaseName -> {
         *     ...
         * }
         */
        static getAllSlotOptionsByName(slotName, vgMode) {
            if (this._allVGItemStats[slotName]) return this._allVGItemStats[slotName];
            const select = this.getSelectField(slotName, 0);
            if (!select) return;
            const result = this._allVGItemStats[slotName] = {};

            const addEntry = function (itemId, itemName) {
                let [vgBaseName, amount, max] = _.WoDItemDb.getItemVGInfos(itemName);
                if (!vgBaseName) return;
                const vgBaseDef = result[vgBaseName] || (result[vgBaseName] = {
                    min: 1000, // min available
                    max: 0, // max available
                    sum: 0,
                    stackCount: 0,
                    stackSize: Number(max),
                    stacks: {},
                });
                amount = Number(amount);
                vgBaseDef.min = Math.min(vgBaseDef.min, amount);
                vgBaseDef.max = Math.max(vgBaseDef.max, amount);
                vgBaseDef.sum = (vgBaseDef.sum) + amount;
                vgBaseDef.stackCount++;
                const itemIds = vgBaseDef.stacks[amount] || (vgBaseDef.stacks[amount] = []);
                itemIds.push(itemId);
            }

            let selectedId;
            for (const [idx, option] of Object.entries(select.options)) {
                if (Number(idx) === 0) {
                    selectedId = -Number(option.value);
                } else {
                    let curId;
                    if (Number(option.value) === 0) {
                        curId = selectedId;
                    } else {
                        curId = Number(option.value);
                    }
                    addEntry(curId, option.text);
                }
            }

            // Die bereits ausgewählten Items sind nicht in der Option enthalten
            for (let idx = 1, l = this.getAllSlotCounts()[slotName]; idx < l; idx++) {
                const [itemId, itemText] = this.getSlotSelectedItemInformation(slotName, idx);
                if (itemText) addEntry(itemId, itemText);
            }

            return this._allVGItemStats[slotName];
        }
    }

    class MyStorage {

        static async initMyStorage(indexedDb) {
            this.indexedDb = indexedDb;
            this.indexedDbLocal = _.Storages.IndexedDb.getDb(Mod.dbname, "WoDStats+");
            await this.initThisStorage(this.indexedDb);
        }

        static async initThisStorage(indexedDb) {
            this.equipHeroes = indexedDb.createObjectStorage("equipHeroes", "id");
            this.equipLoadout = indexedDb.createObjectStorage("equipLoadout", "id");
        }

    }

    Mod.startMod();
})();