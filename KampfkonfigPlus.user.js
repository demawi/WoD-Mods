// ==UserScript==
// @name           [WoD] Kampfkonfig Plus
// @version        1.1.4
// @author         demawi
// @namespace      demawi
// @description    Erweiterungen für die Kampfkonfigs. Aktuell nur JSON-Export/Import.
// @include        http*://*.world-of-dungeons.de/wod/spiel/hero/skillconf_nojs.php*
// @include        http*://*.world-of-dungeons.de/wod/spiel/hero/skillconfig.php*
//
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
        static version = GM.info.script.version;
        static async startMod() {
            await demawiRepository.startMod();
            WodKonfig.addButtons();
        }

    }

    class WodKonfig {
        static addButtons() {
            const _this = this;
            let ueberschrift;
            for (const cur of document.getElementsByTagName("h1")) {
                if (cur.textContent.startsWith("Profil:")) {
                    ueberschrift = cur;
                    break;
                }
            }
            const profileName = ueberschrift.textContent.substring(8);

            ueberschrift.append(_UI.createButton(" 💾", () => {
                _this.exportKonfig(profileName);
            }));
            ueberschrift.append(_UI.createButton(" 📂", () => {
                _this.importKonfig(profileName);
            }));
        }

        static async importKonfig() {
            const data = await _.File.createUploadForRead();
            const objectFactory = {
                // WoDSkill und WoItem werden vollständig aus dem WodEnvironment geholt
                "WodSkill": object => this.getSkillReferenceLookup(object, objectFactory),
                "WodItem": object => this.getItemReferenceLookup(object, objectFactory)
            };
            const newCfg = _.JSON2.parse(data, objectFactory);
            console.log("Config geladen: ", newCfg);
            this.refreshView(newCfg);
        }

        static getItemReferenceLookup(object) {
            let name = object.name;
            if (unsafeWindow.WOD_ITEM_AUTO.name === object.name) return [unsafeWindow.WOD_ITEM_AUTO, true];
            if (unsafeWindow.WOD_ITEM_NONE.name === object.name) return [unsafeWindow.WOD_ITEM_NONE, true];
            if (name.startsWith("!!")) name = name.substring(3);
            if (name.endsWith("(Lager)")) name = name.substring(0, name.length - 8);
            const id = object.id;
            for (const key in unsafeWindow.THE_ENV.items) {
                const current = unsafeWindow.THE_ENV.items[key];
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
            for (const key in unsafeWindow.THE_ENV.skills) {
                const current = unsafeWindow.THE_ENV.skills[key];
                if (name === current.name) return [current, true];
            }
            // Skill aktuell nicht gelernt
            if (object.name !== "(unbekannte Fertigkeit)") {
                object.name = "⚠️ Unbekannte Fertigkeit: " + object.name;
            }
            console.log("Can't find skill: '" + name + "'");
            return [object, false];
        }

        static refreshView(optCfg) {
            // Save cfg-parameters
            const url = this.getWOD_CFG().ui_orders.form.element.attributes.action.value;
            const fig_type = this.getWOD_CFG().ui_orders.fig_type.element.value;
            const fig_id = this.getWOD_CFG().ui_orders.fig_id.element.value;
            const is_popup = this.getWOD_CFG().ui_orders.is_popup.element.value;
            const world = this.getWOD_CFG().ui_orders.world.element.value;
            const session_hero_id = this.getWOD_CFG().ui_orders.session_hero_id.element.value;
            const php_session_name = '';
            const php_session_id = '';
            if (optCfg) unsafeWindow.wodSetCfg(optCfg);

            // refresh
            const table = document.getElementById("wod-orders");
            table.parentElement.removeChild(table);

            // wod_orders_init( url, fig_type, fig_id, is_popup, world, session_hero_id, php_session_name, php_session_id);
            // wod_orders_init( '/wod/spiel/hero/skillconfig.php', 'figur', 373802, 0, 'WA', '373802', '', '' )
            unsafeWindow.wod_orders_init(url, fig_type, fig_id, is_popup, world, session_hero_id, php_session_name, php_session_id);
            this.addButtons();
        }

        static exportKonfig(profileName) {
            const result = this.getWodConfig();
            console.log("Konfig exportiert: ", result);
            const resultStr = _.JSON2.stringify(result, object => {
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
            const result = new unsafeWindow.WodConfig();
            for (const key in this.getWOD_CFG()) {
                result[key] = this.getWOD_CFG()[key];
            }
            delete result.ui_orders;
            return result;
        }

        static getWOD_CFG() {
            return unsafeWindow.WOD_CFG;
        }
    }

    // Damit das Skript im FF nicht vor dem Skript der Hauptseite läuft.
    setTimeout(() => {
        Mod.startMod();
    }, 100);
})();