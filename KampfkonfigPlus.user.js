// ==UserScript==
// @name           [WoD] Kampfkonfig Plus
// @namespace      demawi
// @description    Erweiterungen für die Kampfkonfigs. Aktuell nur JSON-Export/Import.
// @version        1.0
// @include        https://*.world-of-dungeons.de/wod/spiel/hero/skillconf_nojs.php*
// @include        https://*.world-of-dungeons.de/wod/spiel/hero/skillconfig.php*
// @require        https://raw.githubusercontent.com/demawi/WoD-Mods/refs/heads/master/repo/DemawiRepository.js?version=1.1
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

    const _WoD = demawiRepository.import("WoD");
    const _File = demawiRepository.import("File");
    const _JSON2 = demawiRepository.import("JSON2");

    class Mod {

        static async startMod() {
            console.log("Kampfkonfig found!");
            this.addButtons();
        }

        static addButtons() {
            console.log("addbuttons");
            console.log(document.getElementsByTagName("h1"));
            const ueberschrift = document.getElementsByTagName("h1")[1];
            const profileName = ueberschrift.textContent.substring(8);
            const button = document.createElement("span");
            button.classList.add("nowod");
            button.innerHTML = " 💾";
            button.style.fontSize = "12px";
            button.style.cursor = "pointer";
            button.onclick = function () {
                Mod.exportKonfig(profileName);
            }
            const button2 = document.createElement("span");
            button2.classList.add("nowod");
            button2.innerHTML = " 📦";
            button2.style.fontSize = "12px";
            button2.style.cursor = "pointer";
            button2.onclick = function () {
                Mod.importKonfig(profileName);
            }
            ueberschrift.append(button);
            ueberschrift.append(button2);
        }

        static async importKonfig() {
            const data = await _File.createUploadForRead();
            const objectFactory = {
                // WoDSkill und WoItem werden vollständig aus dem WodEnvironment geholt
                "WodSkill": object => this.getSkillReferenceLookup(object, objectFactory),
                "WodItem": object => this.getItemReferenceLookup(object, objectFactory)
            };
            const newCfg = _JSON2.parse(data, objectFactory);
            console.log("Config geladen: ", newCfg);
            this.refreshView(newCfg);
        }

        static getItemReferenceLookup(object) {
            let name = object.name;
            if (WOD_ITEM_AUTO.name === object.name) return [WOD_ITEM_AUTO, true];
            if (WOD_ITEM_NONE.name === object.name) return [WOD_ITEM_NONE, true];
            if (name.startsWith("!!")) name = name.substring(3);
            if (name.endsWith("(Lager)")) name = name.substring(0, name.length - 8);
            const id = object.id;
            for (const key in THE_ENV.items) {
                const current = THE_ENV.items[key];
                if (id === current.id) return [current, true];
            }
            // Gegenstand nicht gefunden
            if (!object.name.startsWith("!!")) {
                object.name = "!! " + object.name;
            }
            console.log("Can't find item: '" + name + "'");
            return [object, false];
        }

        static getSkillReferenceLookup(object, objectFactory) {
            const name = object.name;
            for (const key in THE_ENV.skills) {
                const current = THE_ENV.skills[key];
                if (name === current.name) return [current, true];
            }
            // Skill aktuell nicht gelernt
            object.name = "⚠️ Unbekannte Fertigkeit: " + object.name;
            console.log("Can't find skill: '" + name + "'");
            return [object, false];
        }

        static refreshView(optCfg) {
            // Save cfg-parameters
            const url = WOD_CFG.ui_orders.form.element.attributes.action.value;
            const fig_type = WOD_CFG.ui_orders.fig_type.element.value;
            const fig_id = WOD_CFG.ui_orders.fig_id.element.value;
            const is_popup = WOD_CFG.ui_orders.is_popup.element.value;
            const world = WOD_CFG.ui_orders.world.element.value;
            const session_hero_id = WOD_CFG.ui_orders.session_hero_id.element.value;
            const php_session_name = '';
            const php_session_id = '';
            if (optCfg) wodSetCfg(optCfg);

            // refresh
            const table = document.getElementById("wod-orders");
            table.parentElement.removeChild(table);

            // wod_orders_init( url, fig_type, fig_id, is_popup, world, session_hero_id, php_session_name, php_session_id);
            // wod_orders_init( '/wod/spiel/hero/skillconfig.php', 'figur', 373802, 0, 'WA', '373802', '', '' )
            wod_orders_init(url, fig_type, fig_id, is_popup, world, session_hero_id, php_session_name, php_session_id);
            this.addButtons();
        }

        static exportKonfig(profileName) {
            const result = this.getWodConfig();
            console.log("Konfig exportiert: ", result);
            const resultStr = _JSON2.stringify(result, object => {
                // in dem WodSkill-Objekt werden auch alle Items aufgelistet die damit verwendet werden können
                // diese wollen wir hier nicht speichern. Diese werden beim Import wieder aus dem aktuellen Ausrüstungsstand geladen.
                if (object && object.constructor && object.constructor.name === "WodSkill") {
                    delete object.items;
                }
                return object;
            });
            const name = _WoD.getMyHeroName() + "_" + profileName + ".json";
            _File.forDownload(name, resultStr);
        }

        /**
         * ohne "ui_orders"-Funktionen/DOM-Elemente
         */
        static getWodConfig() {
            const result = new WodConfig();
            for (const key in WOD_CFG) {
                result[key] = WOD_CFG[key];
            }
            delete result.ui_orders;
            return result;
        }

    }

    Mod.startMod();
})();