// ==UserScript==
// @name           [WoD] Ausrüster Plus
// @version        0.8.15
// @author         demawi
// @namespace      demawi
// @description    Erweiterungen für die Ausrüstung.
// @match          http*://*.world-of-dungeons.de/wod/spiel/hero/items.php*
//
// @match          http*://world-of-dungeons.de/*
// @require        repo/DemawiRepository.js
//
// @require        https://code.jquery.com/jquery-3.7.1.min.js#sha512=v2CJ7UaYy4JwqLDIrZUI/4hqeoQieOmAZNXBeQyjo21dadnwR+8ZaIJVT8EE2iyI61OV8e6M8PP2/4hpQINQ/g==
// @require        https://code.jquery.com/ui/1.14.1/jquery-ui.js#sha512=ETeDoII5o/Zv6W1AtLiNDwfdkH684h6M/S8wd2N0vMEAeL3UAOf7a1SHdP1LGDieDrofe1KZpp9k6yLkR90E6A==
// @require	       https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js#sha512=2ImtlRlf2VVmiGZsjm9bEyhjGW4dU7B6TNwh/hx/iSByxNENtj3WVE6o/9Lj4TJeVXPi4bnOIMXFIJJAeufa0A==
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
                const indexedDb = await _.WoDStorages.tryConnectToMainDomain(Mod.dbname);
                if (!indexedDb) return;
                await MyStorage.initMyStorage(indexedDb);

                demawiRepository.startMod();
                await Ausruester.start();
            }
        }

    }

    class Ausruester {

        static async start() {
            await GemHandler.init();
            await EquipConfig.init();
            await ControlBar.init();
            await SelectOptimizer.init();
        }

    }

    class ControlBar {

        static hasChange_Loadout_Server;
        static hasChange_UI_Loadout;
        static hasChange_UI_Loadout_Equip;
        static hasChange_UI_Loadout_VGConfig;
        static hasChange_UI_Server;
        static hasChange_UI_CurrentLoadout_Equip;
        static hasChange_UI_CurrentLoadout_VGConfig;

        static loadoutNamePanel;
        static markerPanel_UI_Loadout;
        static markerPanel_Loadout_Server;
        static markerPanel_UI_Server;

        static ui2XXXPanel;

        static warningPanel;
        static loadOutSelect;
        static applyLoadout2ServerButton;
        static applyUi2ServerButton;
        static applyUi2Loadout;
        static renameButton;
        static newButton;
        static vgSyncButton;
        static applyUi2Loadout2Server;
        static deleteButton;

        static marker_Right = "⮞"; // ↷Commit changes to server
        static marker_Left = "⮝"; // ⮜Commit changes to indexedDb
        static marker_Warn = "🔙"; // ⚠️

        static updateProfileName() {
            const currentLoadoutName = EquipConfig.getCurrentLoadoutName();
            if (currentLoadoutName) {
                this.loadoutNamePanel.innerHTML = "Aktuell geladen: " + currentLoadoutName;
                this.nameIt.innerHTML = currentLoadoutName;
            } else {
                this.loadoutNamePanel.innerHTML = "";
                this.nameIt.innerHTML = "UI";
            }

            this.markerPanel_UI_Loadout.innerHTML = this.hasChange_UI_Loadout ? "*" : "✓";
            this.markerPanel_Loadout_Server.innerHTML = this.hasChange_Loadout_Server ? "*" : "✓";
            this.markerPanel_UI_Server.innerHTML = this.hasChange_UI_Server ? "*" : "✓";
            this.markerPanel_UI_Loadout.title = this.hasChange_UI_Loadout ? "UI<>Loadout. Das Loadout wurde noch nicht für später gespeichert!" : "UI=Loadout. Das gewählte Loadout stimmt mit der aktuellen Auswahl der UI überein!";
            this.markerPanel_Loadout_Server.title = this.hasChange_Loadout_Server ? "Loadout<>Server. Das Loadout ist aktuell noch nicht ausgerüstet!" : "Loadout=Server. Das gewählte Loadout stimmt mit dem Server überein!";
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

            this.markerPanel_Loadout_Server = document.createElement("span");
            this.markerPanel_Loadout_Server.style.width = "10px";
            this.markerPanel_Loadout_Server.style.cursor = "help";
            this.markerPanel_Loadout_Server.style.textAlign = "center";
            this.markerPanel_Loadout_Server.style.display = "inline-block";
            this.markerPanel_Loadout_Server.style.marginLeft = "3px";
            //this.markerPanel_Loadout_Server.style.marginRight = "3px";

            this.markerPanel_UI_Loadout = document.createElement("span");
            //this.markerPanel_UI_Loadout.style.width = "10px";
            this.markerPanel_UI_Loadout.style.cursor = "help";
            this.markerPanel_UI_Loadout.style.textAlign = "center";
            this.markerPanel_UI_Loadout.style.display = "inline-block";
            //this.markerPanel_UI_Loadout.style.marginLeft = "3px";
            this.markerPanel_UI_Loadout.style.marginRight = "3px";

            this.markerPanel_UI_Server = document.createElement("span");
            this.markerPanel_UI_Server.style.width = "10px";
            this.markerPanel_UI_Server.style.cursor = "help";
            this.markerPanel_UI_Server.style.textAlign = "center";
            this.markerPanel_UI_Server.style.display = "inline-block";
            this.markerPanel_UI_Server.style.marginLeft = "3px";
            //this.markerPanel_UI_Server.style.marginRight = "3px";


            this.loadOutSelect.onchange = function () {
                _this.clearErrors();
                _this.onDataChange();
            }

            const updateSelect = function (profilName, initial) {
                _this.updateProfileName();
                _this.loadOutSelect.innerHTML = "";
                for (const curProfileName of Object.keys(EquipConfig.getLoadouts()).sort(_.util.localeComparator)) {
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

            const createButton = function (content, onclick) {
                const result = document.createElement("button");
                result.type = "button";
                result.style.display = "none";
                result.innerHTML = content;
                result.style.lineHeight = "1em";
                result.style.paddingTop = "2px";
                result.style.paddingBottom = "2px";
                result.style.paddingLeft = "5px";
                result.style.paddingRight = "5px";
                result.style.verticalAlign = "middle";
                result.onclick = onclick;
                return result;
            }
            const willSubmitToServer = function (button, revert) {
                button.innerHTML = button.innerHTML.replace(_this.marker_Right, _.UI.createSpinner().outerHTML);
            }

            this.applyUi2Loadout = createButton(this.marker_Left + " Speichern", async function (e) {
                const saved = await saveCurrent(false);
                if (saved) {
                    updateSelect(_this.getCurrentSelectedLoadoutName());
                    _this.revalidateAll();
                }
            });


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

            this.revertUiButton = createButton("🔙 " + this.marker_Right, async function () {
                willSubmitToServer(this);
                window.location.reload();
            });

            this.newButton = createButton(" ➕", async function () {
                const savedLoadoutName = await saveCurrent(true);
                if (savedLoadoutName) {
                    updateSelect(savedLoadoutName);
                    _this.revalidateAll();
                }
            });
            this.newButton.style.width = "22px"
            this.newButton.style.paddingLeft = "0px"
            this.newButton.style.paddingRight = "0px"

            this.applyUi2Loadout2Server = createButton(this.marker_Left + " Speichern + Ausrüsten " + this.marker_Right, async function () {
                await saveCurrent();
                willSubmitToServer(this);
                await loadCurrent();
            });

            this.renameButton = createButton("✎", async function () {
                await renameCurrent();
            });
            this.renameButton.style.width = "22px"
            this.renameButton.style.paddingLeft = "0px"
            this.renameButton.style.paddingRight = "0px"

            this.applyLoadout2ServerButton = createButton("Ausrüsten " + this.marker_Right, async function () {
                willSubmitToServer(this);
                await loadCurrent();
            });

            this.applyUi2ServerButton = createButton("Anwenden " + this.marker_Right, async function () {
                willSubmitToServer(this);
                document.querySelector("input[name='ok']").click();
            });

            this.activButton = createButton("Aktuell", async function () {
                EquipConfig.setCurrent(_this.getCurrentSelectedLoadoutName(), true);
                _this.updateProfileName();
                _this.onDataChange();
            });

            this.vgSyncButton = createButton("NachfüllenTest " + this.marker_Right, async function () {
                //_this.vgSyncButton.innerHTML = _this.vgSyncButton.innerHTML.replace(_this.marker_Right, _.UI.createSpinner().outerHTML);
                VGKonfig.getDynamicVGs((await EquipConfig.getSelectedLoadout()).vgs, true);
            });

            this.deleteButton = createButton("❌", async function () {
                const loadoutName = _this.loadOutSelect.value;
                const confirm = window.confirm("Soll das Loadout '" + loadoutName + "' wirklisch gelöscht werden?");
                if (confirm) {
                    await EquipConfig.deleteLoadout(loadoutName);
                    updateSelect(EquipConfig.getCurrentLoadoutName());
                }
            });
            this.deleteButton.style.width = "22px"
            this.deleteButton.style.paddingLeft = "0px"
            this.deleteButton.style.paddingRight = "0px"

            // 1st row
            //panel.append(this.loadoutNamePanel);

            // 2nd row: Loadout -> Server
            let subpanel = this.ui2XXXPanel = document.createElement("div");
            panel.append(subpanel);

            let selectPanel = document.createElement("span");
            subpanel.append(selectPanel);
            selectPanel.style.zIndex = 1;
            const buttonPanel = document.createElement("span");
            selectPanel.style.position = "relative";
            selectPanel.append(buttonPanel);
            buttonPanel.style.display = "inline-block";
            buttonPanel.style.position = "absolute";
            buttonPanel.style.width = "100%";

            buttonPanel.style.textAlign = "left";
            buttonPanel.append(this.newButton);
            buttonPanel.append(this.renameButton);
            buttonPanel.append(this.deleteButton);
            selectPanel.append(this.loadOutSelect);
            selectPanel.onmouseenter = function () {
                buttonPanel.style.top = (selectPanel.offsetHeight + 2) + "px";
                _this.newButton.style.display = "";
                _this.renameButton.style.display = _this.hasSelectedLoadout() ? "" : "none";
                _this.deleteButton.style.display = _this.hasSelectedLoadout() ? "" : "none";
            }
            const leaveFn = function () {
                _this.newButton.style.display = "none";
                _this.renameButton.style.display = "none";
                _this.deleteButton.style.display = "none";
            };
            this.loadOutSelect.onclick = leaveFn;
            selectPanel.onmouseleave = leaveFn;
            leaveFn();

            subpanel.append(this.activButton);
            subpanel.append(this.applyLoadout2ServerButton);
            subpanel.append(this.markerPanel_Loadout_Server);

            // 3rd row: UI -> Loadout / Server
            subpanel = this.ui2XXXPanel = document.createElement("div");
            subpanel.style.marginTop = "2px";
            subpanel.style.marginBottom = "2px";
            subpanel.style.display = "none";
            panel.append(subpanel);
            this.nameIt = _.UI.createElem("span", "UI: ");
            subpanel.append(this.nameIt);
            subpanel.append(this.markerPanel_UI_Loadout);
            subpanel.append(this.revertUiButton);
            subpanel.append(this.applyUi2Loadout);
            subpanel.append(this.applyUi2Loadout2Server);
            subpanel.append(this.applyUi2ServerButton);
            subpanel.append(this.vgSyncButton);
            subpanel.append(this.markerPanel_UI_Server);

            // 4th row: Persistent Loadout actions
            subpanel = document.createElement("div");
            subpanel.style.marginTop = "2px";
            subpanel.style.marginBottom = "2px";
            panel.append(subpanel);
            //panel.style.marginLeft = "0px";
            panel.style.marginTop = "10px";
            panel.style.float = "right";
            panel.append(this.warningPanel);

            updateSelect(EquipConfig.getCurrentLoadoutName(), true);

            const title = document.querySelector("h1");
            title.style.display = "inline-block";
            title.parentElement.insertBefore(panel, title.nextSibling);

            this.applyUi2ServerButton.title = "";
            this.newButton.title = "Angezeigte Ausrüstung als Loadout unter einem abgefragten Namen speichern.";
            this.applyUi2Loadout2Server.title = ""; // wird dynamisch bestimmt
            this.applyLoadout2ServerButton.title = ""; // wird dynamisch bestimmt
            this.applyUi2Loadout.title = ""; // wird dynamisch bestimmt
            this.vgSyncButton.title = "Anhand der hinterlegten VG-Konfig im Loadout die Tasche befüllen.";
            this.revertUiButton.title = "Jegliche gemachte Änderungen verwerfen und die Seite neu laden.";

            // Einzig auf Loadout bezogen
            this.activButton.title = "Als aktuelles Loadout übernehmen.";
            this.renameButton.title = "Das gewählte Loadout umbenennen.";
            this.deleteButton.title = "Das gewählte Loadout löschen";
        }

        static notPreferredOpacity = 0.65;

        /**
         * Wird aufgerufen, wenn ein Gegenstand, die Loadout-Auswahl oder eine VG-Konfig geändert wird.
         */
        static async onDataChange() {
            const selectedLoadoutName = this.getCurrentSelectedLoadoutName();
            const hasVGsConfigured = this.hasSelectedLoadout() && (await EquipConfig.getSelectedLoadout()).vgs;

            [this.hasChange_UI_Loadout_Equip, this.hasChange_UI_Loadout_VGConfig] = (!this.hasSelectedLoadout() && [false, false]) || await EquipConfig.differs_UI_Loadout(selectedLoadoutName);
            [this.hasChange_UI_CurrentLoadout_Equip, this.hasChange_UI_CurrentLoadout_VGConfig] = (!EquipConfig.getCurrentLoadoutName() && [false, false]) || await EquipConfig.differs_UI_Loadout(EquipConfig.getCurrentLoadoutName());
            this.hasChange_UI_Loadout = this.hasChange_UI_Loadout_Equip || this.hasChange_UI_Loadout_VGConfig;

            this.hasChange_Loadout_Server = !this.hasSelectedLoadout() || await EquipConfig.differs_Loadout_Server(selectedLoadoutName);
            this.hasChange_UI_Server = await EquipConfig.differs_UI_Server();
            console.log("DIFF", selectedLoadoutName, "UI<>Loadout:" + this.hasChange_UI_Loadout, "Loadout<>Server:" + this.hasChange_Loadout_Server, "UI<>Server:" + this.hasChange_UI_Server);

            // 3nd Row
            this.ui2XXXPanel.style.display = this.hasSelectedLoadout() && this.hasChange_UI_Loadout || this.hasChange_UI_Server ? "" : "none";
            this.applyUi2Loadout.style.display = this.hasSelectedLoadout() && this.hasChange_UI_Loadout ? "" : "none";
            this.applyUi2Loadout2Server.style.display = this.hasSelectedLoadout() && this.hasChange_UI_Loadout ? "" : "none"; // && this.hasChange_UI_Server
            this.applyUi2ServerButton.style.display = this.hasChange_UI_Server ? "" : "none";
            this.revertUiButton.style.opacity = this.notPreferredOpacity;

            //this.renameButton.style.display = this.hasSelectedLoadout() ? "" : "none";
            this.applyLoadout2ServerButton.style.display = this.hasSelectedLoadout() ? "" : "none"; //  && (this.hasChange_Loadout_Server || hasVGsConfigured)
            this.vgSyncButton.style.display = "none"; // & hasVGsConfigured && !this.hasChange_UI_Loadout ? "" : "none";
            //this.newButton.style.display = ""; // ist immer möglich
            this.revertUiButton.style.display = this.hasChange_UI_Server || (!this.hasChangedProfile() && this.hasChange_UI_Loadout_VGConfig) ? "" : "none";

            const prefix = this.hasChange_UI_Server ? "" : ""; //  unverifiziert dürfte nur bei this.hasChange_UI_Server_Equip auftauchen nicht bei VGs
            if (this.getCurrentSelectedLoadoutName() !== EquipConfig.getCurrentLoadoutName()) {
                this.applyUi2Loadout.innerHTML = this.marker_Left + prefix + " Überschreiben";
                this.applyUi2Loadout.style.opacity = this.notPreferredOpacity;
                this.applyUi2Loadout.title = "Angezeigte Ausrüstung im Loadout speichern." + (prefix ? " Die Ausrüstung wurde noch nicht an den Server übertragen und somit verifiziert!" : "");
            } else {
                this.applyUi2Loadout.innerHTML = this.marker_Left + prefix + " Speichern";
                this.applyUi2Loadout.style.opacity = prefix ? this.notPreferredOpacity : "";
                this.applyUi2Loadout.title = "Angezeigte Ausrüstung im Loadout speichern." + (prefix ? " Die Ausrüstung wurde noch nicht an den Server übertragen und somit verifiziert!" : "");
            }
            if (this.getCurrentSelectedLoadoutName() !== EquipConfig.getCurrentLoadoutName()) {
                this.applyUi2Loadout2Server.innerHTML = this.marker_Left + prefix + " Überschreiben + Ausrüsten " + this.marker_Right;
                this.applyUi2Loadout2Server.style.opacity = this.notPreferredOpacity;
                this.applyUi2Loadout2Server.title = "Angezeigte Ausrüstung im Loadout speichern und auch direkt ausrüsten. VGs werden entsprechend der hinterlegten Konfiguration automatisch befüllt!";
            } else {
                this.applyUi2Loadout2Server.innerHTML = this.marker_Left + prefix + " Speichern + Ausrüsten " + this.marker_Right;
                this.applyUi2Loadout2Server.style.opacity = prefix ? this.notPreferredOpacity : "";
                this.applyUi2Loadout2Server.title = "Angezeigte Ausrüstung im Loadout speichern und auch direkt ausrüsten. VGs werden entsprechend der hinterlegten Konfiguration automatisch befüllt!";
            }
            if (this.hasChange_UI_Loadout && this.hasChange_UI_Server) {
                this.applyLoadout2ServerButton.innerHTML = this.marker_Warn + " " + this.marker_Right;
                this.applyLoadout2ServerButton.style.opacity = this.notPreferredOpacity;
                this.applyLoadout2ServerButton.title = "Gewähltes Loadout laden und VGs neu befüllen!!\n" + this.marker_Warn + ": Änderungen an der UI werden verworfen";
            } else {
                this.applyLoadout2ServerButton.innerHTML = "" + this.marker_Right;
                this.applyLoadout2ServerButton.style.opacity = "";
                this.applyLoadout2ServerButton.title = "Gewähltes Loadout laden! VGs werden entsprechend der hinterlegten Konfiguration automatisch befüllt!";
            }
            if (this.hasChange_UI_CurrentLoadout_VGConfig) { // eigentlich sollte es hier this.hasChange_UI_Server_VGConfig heißen!?
                this.applyUi2ServerButton.innerHTML = this.marker_Warn + " Anwenden " + this.marker_Right;
                this.applyUi2ServerButton.title = "Gemachte Änderungen von der Oberfläche auf den Server übernehmen\n" + this.marker_Warn + ": Änderungen an der VG-Konfig werden somit nicht gespeichert!";
            } else {
                this.applyUi2ServerButton.innerHTML = "Anwenden " + this.marker_Right;
                this.applyUi2ServerButton.title = "Gemachte Änderungen von der Oberfläche auf den Server übernehmen";
            }
            this.activButton.style.display = (!this.hasChange_UI_Loadout && this.hasSelectedLoadout() && this.hasChangedProfile()) ? "" : "none";
            //this.deleteButton.style.display = this.hasSelectedLoadout() ? "" : "none";
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
        static DEBUG_ERROR_REPORTING = true;

        static reportProblem(id, msg) {
            if (this.DEBUG_ERROR_REPORTING) console.warn("[" + id + "] Report problem: " + msg);
            this.errors[id] = msg;
            this.updateErrorMsg();
        }

        static removeError(id) {
            if (this.DEBUG_ERROR_REPORTING && this.errors[id]) console.warn("[" + id + "] Remove problem");
            delete this.errors[id];
            this.updateErrorMsg();
        }

        static clearErrors() {
            if (this.DEBUG_ERROR_REPORTING) console.warn("Clear all errors");
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

            const theForm = FormHandler.getTheForm();
            const allSlots = FormHandler.getAllExistingSlots();
            for (const [slotName, slotIdx] of allSlots) {
                const selectField = theForm["LocationEquip[go_" + slotName + "][" + slotIdx + "]"];
                this.addSlotImagesToSelect(selectField);
                this.rearrangeOptions(selectField);
                selectField.onchange = async function () {
                    VGKonfig.onEquipSelectChange(slotName, slotIdx);
                    EquipConfig.onEquipSlotChanged(slotName, slotIdx, false);
                    await ControlBar.onDataChange();
                    FormHandler.sortInOrder(slotName);
                    for (const cur of selectField.parentElement.querySelectorAll("img")) {
                        if (cur.tagName === "IMG" && cur.src.includes("/gem_")) {
                            cur.remove();
                        }
                    }
                    const firstZustandImgElem = selectField.parentElement.children[0];
                    firstZustandImgElem.src = "/wod/css//skins/skin-8/images/icons/zustand_leer.gif";
                    const curItemId = FormHandler.getSelectedValue(selectField);
                    if (curItemId) {
                        const parent = selectField.parentElement;
                        const lastElem = parent.querySelector("input[type='submit']");
                        const slotImages = GemHandler.getSlotImagesSrcs(curItemId);
                        if (slotImages) {
                            for (const cur of slotImages) {
                                const img = document.createElement("img");
                                img.src = cur;
                                parent.insertBefore(img, lastElem);
                            }
                        }
                    }
                    selectField.nextSibling.style.boxShadow = "0px 0px 3px 3px rgba(0, 255, 0, 0.5)";
                    setTimeout(function () {
                        selectField.nextSibling.style.boxShadow = "";
                    }, 1000);
                }
                _.Libs.betterSelect2(selectField, {templateResult: _this.addSlotImgs});
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

        static addSlotImagesToSelect(select) {
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
                    const slotImages = GemHandler.getSlotImagesSrcs(curId);
                    if (slotImages) option.setAttribute("slotImgs", slotImages.map(src => "<img src='" + src + "'/>").join(""));
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
                for (const [vgBaseNameWithGems, amount] of Object.entries(slotDef.items)) {
                    VGKonfig.ensureUpdateVGKonfig(vgBaseNameWithGems, slotName, amount, true);
                }
            }
        }

        static checkValidationAll() {
            for (const [vgBaseNameWithGems, vgCfg] of Object.entries(this.vgSelects)) {
                this.checkValidation(vgBaseNameWithGems);
            }
        }

        static checkValidation(vgBaseNameWithGems) {
            const vgCfg = this.vgSelects[vgBaseNameWithGems];
            if (!vgCfg) {
                ControlBar.removeError(vgBaseNameWithGems);
                return;
            }

            const curEquippedAmount = FormHandler.getCurrentEquippedVGAmount(vgBaseNameWithGems);

            if (curEquippedAmount < vgCfg.amount) {
                ControlBar.reportProblem(vgBaseNameWithGems, GemHandler.getVGFullWithImgs(vgBaseNameWithGems) + " zu wenig ausgerüstet " + curEquippedAmount + " < " + vgCfg.amount);
            } else {
                ControlBar.removeError(vgBaseNameWithGems);
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
                items[curVgDef.vgBaseNameWithGems] = curVgDef.amount;
            }
            if (Object.keys(vgDefs).length === 0) return;
            return vgDefs;
        }

        static addVGKonfig(vgBaseNameWithGems, slotName, slotIdx, amount) {
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

            let availableAmount = FormHandler.getAvailableVGAmount(slotName, vgBaseNameWithGems);
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
                    td.innerHTML = vgBaseNameWithGems + ": ";
                    td.append(vgKonfig);
                }
            }

            this.vgSelects[vgBaseNameWithGems] = {
                vgBaseNameWithGems: vgBaseNameWithGems,
                slotName: slotName,
                slotIdx: slotIdx,
                amount: latestValue,
                elem: mainElement,
            };

            textInput.onchange = async function () {
                try {
                    let newValue;
                    if (textInput.value === "") {
                        newValue = 0;
                    } else {
                        newValue = Number(textInput.value);
                        if (isNaN(newValue) || (selectField && newValue < 1) || newValue < 0) throw new Errror("Not a valid number");
                    }
                    if (newValue === 0) {
                        _this.remove(vgBaseNameWithGems);
                    } else {
                        latestValue = newValue;
                        _this.vgSelects[vgBaseNameWithGems].amount = newValue;
                    }
                    ControlBar.onDataChange();
                    _this.checkValidation(vgBaseNameWithGems);
                } catch (e) { // reset
                    textInput.value = latestValue;
                }
            }
        }

        /**
         * Stellt sich, dass an der richtigen Stelle die Konfig für den Vebrauchsgegenstand auftaucht
         */
        static ensureUpdateVGKonfig(vgBaseNameWithGems, slotName, amount, initial) {
            const [wantedSlotName, wantedSlotIdx] = this.findFirstVGItem(vgBaseNameWithGems, slotName);
            const existingKonfig = this.vgSelects[vgBaseNameWithGems];
            if (!existingKonfig) {
                this.addVGKonfig(vgBaseNameWithGems, slotName, wantedSlotIdx, amount || 1);
            } else if (existingKonfig.slotIdx !== wantedSlotIdx) {
                existingKonfig.elem.remove();
                if (initial || this.findFirstVGItem(vgBaseNameWithGems, slotName)[1]) { // Behalten nur initial und wenn es noch ein anderes SelectField mit diesem Item existiert
                    this.addVGKonfig(vgBaseNameWithGems, slotName, wantedSlotIdx, existingKonfig.amount);
                } else {
                    delete this.vgSelects[vgBaseNameWithGems];
                }
            }
        }

        static findFirstVGItem(vgBaseNameWithGems, slotName) {
            for (const [curSlotName, slotIdx] of FormHandler.getAllExistingSlots()) {
                if (curSlotName !== slotName) continue;
                const [instanceId, instanceName] = FormHandler.getSlotSelectedItemInformation(curSlotName, slotIdx);
                if (!instanceName) continue;
                const curBaseName = _.WoDItemDb.getItemVGBaseName(instanceName);
                const gems = GemHandler.getGemsFor(instanceId);
                const curBaseNameWithGems = GemHandler.getBaseNameWithGems(curBaseName, gems);
                if (vgBaseNameWithGems === curBaseNameWithGems) {
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
                    alreadyChecked = def.vgBaseNameWithGems;
                    _this.ensureUpdateVGKonfig(alreadyChecked, slotName);
                    break;
                }
            }

            // Prüfen ob der neue Eintrag einen neuen Wert triggert
            const [instanceId, itemName] = FormHandler.getSlotSelectedItemInformation(slotName, slotIdx);
            if (!itemName || !_.WoDItemDb.isVGName(itemName)) return;
            const vgBaseName = _.WoDItemDb.getItemVGBaseName(itemName);
            const gems = GemHandler.getGemsFor(instanceId);
            const vgBaseNameWithGems = GemHandler.getBaseNameWithGems(vgBaseName, gems);
            if (alreadyChecked !== vgBaseNameWithGems) _this.ensureUpdateVGKonfig(vgBaseNameWithGems, slotName);

            this.checkRemoval(slotName, slotIdx);
        }

        static checkRemoval(slotName, slotIdx) {
            if (!FormHandler.isMultiSlot(slotName)) {
                for (const [vgBaseNameWithGems, vgCfg] of Object.entries(this.vgSelects)) {
                    if (FormHandler.getCurrentEquippedVGAmount(vgBaseNameWithGems) <= 0) {
                        this.remove(vgBaseNameWithGems);
                    }
                }
            }
        }

        static remove(vgBaseNameWithGems) {
            this.vgSelects[vgBaseNameWithGems].elem.remove();
            delete this.vgSelects[vgBaseNameWithGems];
            ControlBar.removeError(vgBaseNameWithGems);
        }

        /**
         * Primäres Ziel: möglichst kleine Stacks aufbrauchen
         */
        static getDynamicVGs(vgsDef, debug) {
            if (!vgsDef) return [];
            const result = {};
            for (const [slotName, itemsDef] of Object.entries(vgsDef)) {
                // 1. Auswählbare VG-Statistiken zusammenzählen
                const stacksDef = FormHandler.getSelectableVGStatistics(slotName);
                if (!stacksDef) return;
                const slotResultIds = result[slotName] = [];
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

                // 2. Slot-Priorisierung: initial alles zusammenfassen
                for (const [vgBaseNameWithGems, wantedAmount] of Object.entries(itemsDef.items)) {
                    const stackInfo = stacksDef[vgBaseNameWithGems];
                    if (!stackInfo) continue; // ERROR: Keine Stacks um vgBaseName zu bedienen

                    const cur = {
                        name: vgBaseNameWithGems,
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
                if (debug) console.log("Initial SlotUsage: ", _.util.cloneObject(slotUsages));

                // 3. Slot-Priorisierung: Die noch freien Slots vergeben
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

                // 4. Knappsack-Vergabe
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
                            slotResultIds.push(slotUsage.info.stacks[key][i]);
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
            const minStackSizeFound = stackInfo.min;
            const maxStackSizeFound = stackInfo.max;
            const stackSize = stackInfo.stackSize; // max stacksize in general
            const amountSum = stackInfo.sum; // Anzahl an VGs
            const avgStackCountInPercent = (amountSum / stackCount) / stackSize; // in percent
            return avgStackCountInPercent / alreadyConsumedSlots / minStackSizeFound;
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

    }

    class EquipConfig {

        static #heroId;
        static #heroName;
        static #myWorld;
        static #equipConfigs; // save(), load()
        static #serverEquip;
        static #serverEquipOhneVGs;
        static #serverEquipUniqueVgs;

        static async init() {
            this.#heroId = _.WoD.getMyHeroId();
            this.#myWorld = _.WoD.getMyWorld();
            this.#heroName = _.WoD.getMyHeroName();
            await this.#load();
            if (!this.#equipConfigs) {
                this.#equipConfigs = {
                    id: this.#myWorld + this.#heroId,
                    loadouts: {}
                }
                await this.#save();
            }
            this.#equipConfigs.name = this.#heroName;
            [this.#serverEquipOhneVGs, this.#serverEquipUniqueVgs] = FormHandler.getUIEquipOnlyIds(1);
            this.#serverEquip = FormHandler.getServerEquipOnlyIds();
            console.log("Loaded Equip: ", this.#serverEquip);
        }

        static async onEquipSlotChanged(slotName, slotIdx) {
            const loadout = await this.getCurrentLoadout();
            if (!loadout) return;
            const equip = loadout.equip;
            const isMultiSlot = FormHandler.isMultiSlot(slotName);
            if (!isMultiSlot) {
                this.checkValidationOnEquipSlot(equip, slotName, slotIdx);
            } else {
                this.checkValidationOnEquip(slotName);
            }
        }

        static async checkValidationOnEquip(slotName, initial) {
            const loadout = await EquipConfig.getSelectedLoadout()
            if (!loadout) return;

            let equippedIds = FormHandler.getUIEquipOnlyIds()[slotName];
            if (!equippedIds || !Array.isArray(equippedIds)) equippedIds = [equippedIds];

            const checkExists = function (itemDef) {
                if (!equippedIds.includes(itemDef.id)) {
                    if (initial) ControlBar.reportProblem(itemDef.id, "Fehlender Gegenstand [" + slotName + "]: " + itemDef.name);
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
            return this.#differsEquips(this.#serverEquipOhneVGs, loadoutEquip, "differs_Loadout_Server");
        }

        /**
         * Überprüft die Instanz-Ids der nicht VGs, dazu noch die VG-Konfigs
         */
        static async differs_UI_Loadout(loadOutName) {
            const [currentUiEquip, uniqueVGs] = FormHandler.getUIEquipOnlyIds(1);
            loadOutName = loadOutName || this.getCurrentLoadoutName();
            const [loadoutEquip, loadoutVgs] = await this.#getSnapshotFromLoadout(loadOutName);
            if (!loadoutEquip) return [false, false];
            return [this.#differsEquips(currentUiEquip, loadoutEquip, "differs_UI_Loadout_Equip"), this.#differsVGConfig(VGKonfig.getCurrentUiVGKonfig(currentUiEquip), loadoutVgs, "differs_UI_Loadout_VGKonfig")]
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

        static #differsEquips(equip1, equip2, debugMethod) {
            let result = !_.util.deepEqual(equip1, equip2);
            console.log(debugMethod, result, equip1, equip2);
            return result;
        }

        static #differsVGConfig(vgCfg1, vgCfg2, debugMethod) {
            let result = false;
            vgCfg1 = this.#withoutFreeSlots(vgCfg1);
            vgCfg2 = this.#withoutFreeSlots(vgCfg2);
            if (vgCfg1 || vgCfg2) {
                result = !_.util.deepEqual(vgCfg1, vgCfg2);
            }
            console.log(debugMethod, result, vgCfg1, vgCfg2);
            return result;
        }

        /**
         * Unabhängig von den freien Slots
         */
        static #withoutFreeSlots(vgCfg) {
            if (!vgCfg) return;
            const result = _.util.cloneObject(vgCfg);
            for (const [slotName, itemCfg] of Object.entries(vgCfg)) {
                delete itemCfg.slots;
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
                await MyStorage.equipHeroe.setValue(this.#equipConfigs);
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
            await MyStorage.equipHeroe.setValue(this.#equipConfigs);
            await MyStorage.equipLoadout.setValue(equipConfig);
        }

        static getLoadoutId(profileName) {
            return this.#myWorld + this.#heroId + "|" + profileName;
        }

        static async #load() {
            this.#equipConfigs = await MyStorage.equipHeroe.getValue(this.#myWorld + this.#heroId);
        }

        static async #save() {
            await MyStorage.equipHeroe.setValue(this.#equipConfigs);
        }

    }

    /**
     * Gibt Informationen zu Veredelungen der Gegenstände heraus
     */
    class GemHandler {

        static slotElements;

        static init() {
            this.slotElements = this.#getSlotElements();
        }

        static getSlotImagesSrcs(itemId) {
            const slotInfoTR = this.slotElements[itemId];
            if (slotInfoTR) {
                let slotImages = [];
                const imgs = slotInfoTR.childNodes[3].querySelectorAll('img');
                for (const curImg of imgs) {
                    slotImages.push(curImg.src);
                }
                return slotImages;
            }
        }

        static getGemsFor(itemId) {
            const vm = this.slotElements[itemId];
            if (!vm) return;
            return vm.querySelector("td[name='item_gems']").textContent;
        }

        static getVGFullWithImgs(vgBaseNameWithGems) {
            const [vgBaseName, gems] = this.getBaseNameAndGems(vgBaseNameWithGems);
            if (!gems) return vgBaseName;
            let result = vgBaseName + " ";
            for (let i = 0, l = gems.length; i < l; i++) {
                result += "<img src='/wod/css/icons/WOD/gems/gem_" + gems[i] + ".png' />";
            }
            return result;
        }

        static getBaseNameAndGems(vgBaseNameWithGems) {
            const idx = vgBaseNameWithGems.lastIndexOf("|");
            if (!idx) return [vgBaseNameWithGems, undefined];
            return vgBaseNameWithGems.split("|");
        }

        static getBaseNameWithGems(vgBaseName, gems) {
            if (!gems) return vgBaseName;
            return vgBaseName + "|" + gems;
        }

        static hasGems(vgBaseNameWithGems) {
            return vgBaseNameWithGems.includes("|");
        }

        static #getSlotElements() {
            const result = {};
            const trs = document.getElementsByName('ITEMS_LOCATION')[0].getElementsByTagName('tr');
            for (const curTr of trs) {
                const id = Number(curTr.childNodes[0].innerHTML);
                result[id] = curTr;
            }
            return result;
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

        static getAvailableVGAmount(slotName, vgBaseNameWithGems) {
            let availableAmount = FormHandler.getSelectableVGStatistics(slotName);
            if (!availableAmount) return 0;
            availableAmount = availableAmount[vgBaseNameWithGems];
            if (!availableAmount) return 0;
            return availableAmount.sum;
        }

        static getCurrentEquippedVGAmount(vgBaseNameWithGems) {
            let result = 0;
            for (const [slotName, slotIdx] of this.getAllExistingSlots()) {
                const [itemId, itemName] = this.getSlotSelectedItemInformation(slotName, slotIdx);
                if (!itemName) continue;
                let [curVgBaseName, amount, max] = _.WoDItemDb.getItemVGInfos(itemName);
                if (GemHandler.hasGems(vgBaseNameWithGems)) curVgBaseName = GemHandler.getBaseNameWithGems(curVgBaseName, GemHandler.getGemsFor(itemId));
                if (!vgBaseNameWithGems || curVgBaseName !== vgBaseNameWithGems) continue;
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

        static getSelectedValue(selectField) {
            const value = Number(selectField.value);
            if (value === 0) return -Number(selectField.options[0].value);
            if (value < 0) return;
            return value;
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
                    // evtl. ist hier die explizite Sortierung für Veredelungen nicht notwendig
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
         * Genau dies Equip anlegen und nichts anderes. Und an den Server senden.
         * Um exakt zu funktionieren, muss die Seite aktuell sein, da man auch explizit Gegenstände ablegen muss.
         */
        static applyEquip(loadout) {
            const equipChangesId = {};
            const equip = loadout.equip;
            const vgs = VGKonfig.getDynamicVGs(loadout.vgs);
            console.log("APPLY_EQUIP", equip, vgs);

            for (const [slotName, itemIds] of Object.entries(equip)) {
                const slotList = equipChangesId[slotName] = [];
                if (Array.isArray(itemIds)) {
                    for (const itemId of itemIds) {
                        slotList.push(itemId.id);
                    }
                } else {
                    slotList.push(itemIds.id);
                }
            }
            for (const [slotName, itemIds] of Object.entries(vgs)) {
                const slotList = equipChangesId[slotName] || (equipChangesId[slotName] = []);
                if (Array.isArray(itemIds)) {
                    for (const itemId of itemIds) {
                        slotList.push(itemId);
                    }
                } else {
                    slotList.push(itemIds);
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

            const getDefaultEquipArray = function (defaultEquip) {
                if (defaultEquip && !Array.isArray(defaultEquip)) defaultEquip = [defaultEquip];
                return defaultEquip;
            }

            for (const slotName of this.getAllSlotNames()) {
                let idx = 0;
                const wantedEquipIds = equipChangesId[slotName] || [];
                console.log("KKKKK", slotName, wantedEquipIds);
                for (const cur of wantedEquipIds) {
                    const itemId = getId(cur);
                    const defaultEquipSlot = getDefaultEquipArray(defaultEquip[slotName]);
                    if (!defaultEquipSlot || !defaultEquipSlot.includes(itemId)) {
                        addEntry(slotName, idx, itemId);
                        idx++;
                    }
                }
                // Überprüfen, was abgelegt werden soll
                const defaultEquipSlot = getDefaultEquipArray(defaultEquip[slotName]);
                console.log("DefaultEquipSlot: ", defaultEquipSlot);
                if (defaultEquipSlot) { // tasche kann auch mal komplett nicht vorhanden sein
                    for (const itemId of defaultEquipSlot) {
                        if (!wantedEquipIds.includes(itemId)) {
                            addEntry(slotName, idx, -itemId);
                            idx++;
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

            console.log("SUBMIT", removes, adds);
            document.body.append(newForm);
            newForm.submit();
        }

        static _allVGItemStats = {};

        /**
         * Gruppiert nach BaseName und liefert Statistiken dazu.
         * slotName -> vgBaseNameWithGems -> {
         *     min/max/sum/stackCount/stackSize/stacks
         * }
         */
        static getSelectableVGStatistics(slotName) {
            if (this._allVGItemStats[slotName]) return this._allVGItemStats[slotName];
            const select = this.getSelectField(slotName, 0);
            if (!select) return;
            const result = this._allVGItemStats[slotName] = {};

            const addEntry = function (itemId, itemName) {
                let [vgBaseName, amount, max] = _.WoDItemDb.getItemVGInfos(itemName);
                if (!vgBaseName) return;
                const gems = GemHandler.getGemsFor(itemId);
                const vgBaseNameWithGems = GemHandler.getBaseNameWithGems(vgBaseName, gems);
                const vgBaseDef = result[vgBaseNameWithGems] || (result[vgBaseNameWithGems] = {
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
            await this.initThisStorage(this.indexedDb);
        }

        static async initThisStorage(indexedDb) {
            this.equipHeroe = indexedDb.createObjectStorage("equipHero", "id");
            this.equipLoadout = indexedDb.createObjectStorage("equipLoadout", "id");
        }

    }

    Mod.startMod();
})();
