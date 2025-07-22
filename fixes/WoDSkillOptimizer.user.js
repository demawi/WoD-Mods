// ==UserScript==
// @name        WOD Skills Optimizer
// @namespace   https://world-of-dungeons.de
// @description optimize and update skill menu
// @match       *://*.world-of-dungeons.de/wod/spiel/hero/skills.php*
// @exclude     *://barkladesh.world-of-dungeons.de*
// @exclude     *://xerasia.world-of-dungeons.de*
// @exclude     *://*.world-of-dungeons.de/wod/spiel/hero/skills.php?class=*
// @exclude     *://*.world-of-dungeons.de/wod/spiel/hero/skills.php?subclass=*
// @version     0.73.1-dirty
// @run-at      document-start
// ==/UserScript==
"use strict";

/**
 * @typedef types
 * @type {Object}
 * @property {attack_types} angriffs_typ
 * @property {damage_types} schadens_typ
 * @property {Object} attribute
 * @property {Object} attribute_kurz
 * @property {attribute_versteckt} attribute_versteckt
 * @property {attribute_versteckt} attribute_versteckt_kurz
 * @property {Object} erfolgs_typ
 * @property {talent_typ} talent_typ
 */
/**
 * @typedef attribute_versteckt
 * @type {Object}
 * @property {string} at_v_anz_aktion
 * @property {string} at_v_heil_hitpoints
 * @property {string} at_v_heil_manapoints
 * @property {string} at_v_initiative
 * @property {string} at_v_max_hitpoints
 * @property {string} at_v_max_manapoints
 * @property {string} clan_fame
 * @property {string} fame
 * @property {string} maxitems_orden
 * @property {string} maxitems_ring
 * @property {string} maxitems_tasche
 */
/**
 * @typedef talent_typ
 * @type {Object}
 * @property {string} rt_attack
 * @property {string} rt_create_monster
 * @property {string} rt_healing
 * @property {string} rt_initiativ
 * @property {string} rt_parade
 * @property {string} rt_powerdown
 * @property {string} rt_powerup
 * @property {string} rt_rebirth
 *
 */

/**
 * @typedef powerups
 * @type {Object}
 * @property {pt_powerup[]} pt_angriff
 * @property {pt_powerup[]} pt_attribut
 * @property {pt_powerup[]} pt_drop
 * @property {pt_powerup[]} pt_parade
 * @property {pt_powerup[]} pt_ruestung
 * @property {pt_powerup[]} pt_schaden
 * @property {pt_powerup[]} pt_schadens_faktor
 * @property {pt_powerup[]} pt_talent
 * @property {pt_powerup[]} pt_wirkung
 */
/**
 * @typedef pt_powerup
 * @type {Array}
 * @property {string} angriffs_typ
 * @property {string} attribut
 * @property {string} bonus_typ - bo_wert (+- x), bo_prozent (%), bo_stufen_faktor [% HS], bo_wirk_faktor [% FR]
 * @property {string|Number} bonus_wert
 * @property {string} erfolgs_typ - et_erfolg, et_gut, et_kritisch
 * @property {string} extra_drop
 * @property {string} from_count - only sets, at how many parts of the set this bonus is active
 * @property {string} label
 * @property {string} label_attribut
 * @property {string} label_schadens_typ
 * @property {string} label_schadens_wirkungs_art
 * @property {string} label_talent
 * @property {string} label_talent_klasse
 * @property {string} label_angriffs_typ
 * @property {string} label_extra_drop
 * @property {string} label_typ
 * @property {string} schadens_typ
 * @property {string} schadens_wirkungs_art - sw_erhoehen, sw_hinzufuegen
 * @property {number|string} talent
 * @property {number|string} talent_klasse
 * @property {string} to_count - only sets, until how many parts of the set this bonus is active
 * @property {string} typ - pt_*
 * @property {string} wirkungs_art - "", wirkt_immer, wirkt_bei_anwendung, "" === wirkt_immer
 * @property {string} wod_SO_name -label for *this* object (i.e. skill name, damage type, etc.)
 * @property {string} wod_SO_powerup_von - which item, skill or set is triggering this powerup?
 * @property {number} [wod_SO_powerup_skill_rang] - rank of skill of this powerup is from a skill
 */

/**
 * @typedef attack_types
 * @type {Object}
 * @property {string} an_nahkampf
 * @property {string} an_fernkampf
 * @property {string} an_zauber
 * @property {string} an_sozial
 * @property {string} an_natur
 * @property {string} an_falle_a - Falle entschärfen
 * @property {string} an_falle_p - Falle auslösen
 * @property {string} an_detonate
 * @property {string} an_mag_fluch
 * @property {string} an_mag_geschoss
 * @property {string} an_misc_1 - Hinterhalt
 * @property {string} an_misc_2 - Krankheit
 * @property {string} an_misc_3 - Bannen
 * @property {string} an_misc_4 - Verschrecken
 * @property {string} an_misc_5 - Illusion anzweifeln
 * @property {string} an_misc_6 - Rammen
 */
/**
 * @typedef damage_types
 * @type {Object}
 * @property {string} st_blitz_schaden
 * @property {string} st_eis_schaden
 * @property {string} st_feuer_schaden
 * @property {string} st_gift_schaden
 * @property {string} st_hieb_schaden
 * @property {string} st_hl_schaden - Heiliger Schaden
 * @property {string} st_mana_schaden
 * @property {string} st_nn_1 - Arkaner Schaden
 * @property {string} st_psycho_schaden
 * @property {string} st_saeure_schaden
 * @property {string} st_schneid_schaden
 * @property {string} st_stich_schaden
 * @property {string} st_wucht_schaden - Fallen entschärfen
 */
/**
 * @typedef attribute_types
 * @type {Object}
 * @property {string} at_ch
 * @property {string} at_ge
 * @property {string} at_in
 * @property {string} at_ko
 * @property {string} at_sn
 * @property {string} at_st
 * @property {string} at_wa
 * @property {string} at_wi
 * @property {string} fame
 * @property {string} at_v_anz_aktion
 * @property {string} at_v_heil_hitpoints
 * @property {string} at_v_heil_manapoints
 * @property {string} at_v_initiative
 * @property {string} at_v_max_hitpoints
 * @property {string} at_v_max_manapoints
 * @property {string} clan_fame
 * @property {string} fame
 * @property {string} maxitems_orden
 * @property {string} maxitems_ring
 * @property {string} maxitems_tasche
 */
/**
 * @typedef drop_types
 * @type {Object}
 * @property {bonus_type_details} gold
 * @property {bonus_type_details} fame
 */
/**
 * @typedef bonus_type_details
 * @type {Object}
 * @property {boolean} istTalentKlasseWirkung - for pt_wirkung. if true, object is a powerup for a skill class
 * @property {string} wod_SO_name
 * @property {string} blIsTripleValue - if true the object is of armor, damage factor or damage
 * @property {bonus} bonus
 * @property {bonus} et_erfolg - only if blIsTripleValue === true (armor, damage factor, damage)
 * @property {bonus} et_gut - only if blIsTripleValue === true (armor, damage factor, damage)
 * @property {bonus} et_kritisch - only if blIsTripleValue === true (armor, damage factor, damage)
 * @property {Array} details
 * @property {Object}
 */

/**
 * @typedef bonus
 * @type {Object}
 * @property {Object} bonus
 * @property {number} bonus.flBase
 * @property {number} bonus.flHero
 * @property {number} bonus.flSkill
 * @property {Object} bonus.percentage
 * @property {Number} bonus.percentage.iLabel
 * @property {Number} bonus.percentage.flEffective
 * @property {number} bonus.flTotal
 * @property {Array} details
 */

/**
 * @typedef attributes
 * @type {Object}
 * @property {attribute_details} anz_aktionen
 * @property {attribute_details} at_ch
 * @property {attribute_details} at_ge
 * @property {attribute_details} at_in
 * @property {attribute_details} at_ko
 * @property {attribute_details} at_sn
 * @property {attribute_details} at_st
 * @property {attribute_details} at_wa
 * @property {attribute_details} at_wi
 * @property {attribute_details} fame
 * @property {attribute_details} heil_hp
 * @property {attribute_details} heil_mp
 * @property {attribute_details} ini_bonus
 * @property {attribute_details} level
 * @property {attribute_details} max_hp
 * @property {attribute_details} max_mp
 * @property {attribute_details} reset_points
 */
/**
 * @typedef attribute_details
 * @type {Object}
 * @property {string|number} base_value
 * @property {Array<string>} current_bonusse
 * @property {number} effective_value
 * @property {string} label
 */

/**
 * @typedef fetch_item_class
 * @type {Object}
 * @property {string|number} id
 * @property {string|number} maxItems
 * @property {string} name
 * @property {Array<Item>} items
 */

/**
 * @typedef items
 * @type {Object}
 * @property {item_instance} instance
 * @property {number} instance_id
 * @property {item_template} template
 * @property {number} template_id
 */
/**
 * @typedef item_instance
 * @type {Object}
 * @property {powerups} owner_powerups
 * @property {string} place
 * @property {powerups} target_powerups
 */
/**
 * @typedef item_template
 * @type {Object}
 * @property {string|number|null} anw_dungeon
 * @property {string|number|null} anw_gesamt
 * @property {string|number|null} anw_kampf
 * @property {Array|Object<item_class>} gegenstand_klassen
 * @property {Array} munition
 * @property {Array} munition_list
 * @property {string|number|boolean} is_stuck - Resetpunkt fürs ablegen notwendig
 * @property {string} name
 * @property {string} schadens_typ
 * @property {string} schadens_typ_msg
 * @property {string|number} set_id
 * @property {string} trage_typ
 */
/**
 * @typedef item_class
 * @type {Object}
 * @property {string|boolean} anw_abbuchen
 * @property {string|boolean} boni_anzeigen
 * @property {string|number} id
 * @property {string|number} max_items
 * @property {string} name
 * @property {string} proben_bonus_typ
 * @property {string|number} proben_bonus_wert
 * @property {string} wirk_bonus_typ
 * @property {string|number} wirk_bonus_wert
 * @property {string|number} ziel_pu_wirken
 */

/**
 * @typedef skills
 * @type {Object}
 * @property {string} base_value skilled rank of skill without bonus
 * @property {Array} current_bonusse bonus on rank of skill
 * @property {number} effective_value skilled rank of skill with bonus
 * @property {powerups} owner_powerups bonus from skill for user of skill
 * @property {powerups} target_powerups bonus (malus) for target of skill
 * @property {skill_template} template more info about skill
 * @property {string|number} template_id
 */

/**
 * @typedef skill_template
 * @type {Object}
 * @property {string|Number} affected_basis - "2 +/- "
 * @property {string|Number} affected_typ - bo_wert, bo_prozent, bo_stufen_faktor, bo_wirk_faktor
 * @property {string|Number} affected_wert - Anzahl betroffener Gegner/Helden
 * @property {string} angriffs_typ
 * @property {string|Number} anw_abbuchen
 * @property {string} attr_primaer
 * @property {string} attr_sekundaer
 * @property {string} attr_wirk_primaer
 * @property {string} attr_wirk_sekundaer
 * @property {string} final_bonus_typ
 * @property {string|Number} final_bonus_wert
 * @property {string|Number} gain_hp_basis
 * @property {string|Number} gain_hp_proc - 200 = Gewinn an HP +200% des Heilungswurfes ([skill: Hauch des Lebens])
 * @property {string} gain_hp_typ
 * @property {string|Number} gain_hp_wert
 * @property {string|Number} gain_mp_basis - -4 = Verlust an MP -4 ([skill: Gabe: Geste der Heilung])
 * @property {string|Number} gain_mp_proc - 20 = Gewinn an MP +20% des Schadenswurfes ([skill: Manaentzug])
 * @property {string} gain_mp_typ
 * @property {string|Number} gain_mp_wert
 * @property {string|Number} gegenstand_klasse_id - Benötigt Gegenstand
 * @property {string|Number} gegenstand_optional
 * @property {string|Boolean} gegenstand_wirkungsbonus_gilt_fuer_beschwoerungen
 * @property {string|Boolean} gegenstand_wirkungsbonus_gilt_fuer_powerups
 * @property {string} heil_typ - ht_hitpoints, ht_manapoints, ht_beide
 * @property {string|Boolean} is_back_attack - 1: nicht anwendbar wenn man bereits im rücken ist
 * @property {string|Boolean} is_n_ammo_1_dmg - Wenn mun_faktor > 1 und is_n_ammo_1_dmg == 1 dann wird der Munitionsbonus nur 1x angewendet, ansonsten mehrfach
 * @property {string|Boolean} is_stop_when_fail - Weiterer Gegner wird nur angegriffen, wenn vorheriger Gegner ist KO gegangen (z.B. [skill: Schlag der Gerechten])
 * @property {Boolean} item_powerups_wirken
 * @property {string|Boolean} konfigurierbar
 * @property {string|Boolean} konfigurierbar_aktion
 * @property {string|Boolean} konfigurierbar_parade
 * @property {string|Boolean} konfigurierbar_vorrunde
 * @property {string} label
 * @property {string|Number} mana_kosten - zeigt Mana-Basiskosten an, [Berechnung für aktuelle Manakosten](https://world-of-dungeons.de/ency/Manakosten)
 * @property {string|Boolean} max_rang_is_1
 * @property {Boolean} [mit_schadens_typ]
 * @property {Boolean} [mit_wirkungs_bonus]
 * @property {string|Number} mun_faktor - wie viel Munition verbraucht wird (normalerweise 1, ausnahmen wie [skill: Zwillingswurf] mit 2 für 2fachen Munitionsbrauch
 * @property {string} proben_bonus_typ
 * @property {Number} proben_bonus_wert
 * @property {string} real_type - rt_powerup, rt_powerdown, rt_create_monster, rt_healing, rt_attack, rt_parade, rt_initiative, rt_rebirth
 * @property {string} schadens_typ
 * @property {string|Number} talent_klasse_id
 * @property {string} typ - tt_powerup, tt_create_monster, tt_heil (beinhaltet rt_healing, rt_attack und rt_parade), tt_initiativ
 * @property {string} wirk_bonus_typ
 * @property {string|Number} wirk_bonus_wert
 * @property {string} ziel - tz_gegner_alle, tz_gegner_figur, tz_gegner_position, tz_selbst, tz_team_alle, tz_team_figur, tz_team_position
 */

/**
 *
 */
class skillsOptimizerLayout {
    oElements = {
        oLayout: document.createDocumentFragment(),
        /**
         * @type {HTMLTableElement}
         */
        oTable: document.createElement("table"),
        oRow: document.createElement("tr"),
        oTh: document.createElement("th"),
        oTd: document.createElement("td"),
        oDiv: document.createElement("div"),
        oSpan: document.createElement("span"),
        oInput: document.createElement("input"),
        oSelect: document.createElement("select"),
        oOption: document.createElement("option"),
        oH4: document.createElement("h4"),
        oP: document.createElement("p"),
    };
    oStorageKeys = {
        openBonusTables: "wodSkillsOptimizerOpenBonusTable",
        userOrder: "wodSOUserOrder",
    };
    oIds = {
        sMessageArea: "wodSOMessages",
        sTopTable: "wodSOTopTable",
        oTableGeneral: {
            sHeroLvl: "wodSOGeneralHeroLvl",
            sHitPoints: "wodSOGeneralHP",
            sHpReg: "wodSOGeneralHpReg",
            sManaPoints: "wodSOGeneralMP",
            sMpReg: "wodSOGeneralMpReg",
            sAction: "wodSOGeneralAction",
            sIni: "wodSOGeneralIni"
        },
        oTableAttributes: {
            sStBase: "wodSOStrengthBase",
            sStEffective: "wodSOStrengthEffective",
            sKoBase: "wodSOConstitutionBase",
            sKoEffective: "wodSOConstitutionEffective",
            sInBase: "wodSOSIntelligenceBase",
            sInEffective: "wodSOSIntelligenceEffective",
            sGeBase: "wodSODexterityBase",
            sGeEffective: "wodSODexterityEffective",
            sChBase: "wodSOCharismaBase",
            sChEffective: "wodSOCharismaEffective",
            sSnBase: "wodSOSpeedBase",
            sSnEffective: "wodSOSpeedEffective",
            sWaBase: "wodSOPerceptionBase",
            sWaEffective: "wodSOPerceptionEffective",
            sWiBase: "wodSOWillForceBase",
            sWiEffective: "wodSOWillForceEffective",
        },
        oTableBonus: {
            sCheckRemember: "wodSOCheckRemember",
            sHiddenBonusTable: "wodSOTableBonus",
            sTableAttacks: "wodSOTableAttacks",
            sTableParades: "wodSOTableParades",
            sTableAttributes: "wodSOTableAttributes",
            sTableSkillEffects: "wodSOTableSkillEffects",
            sTableDamage: "wodSOTableDamage",
            sTableDamageZ: "wodSOTableDamageZ",
            sTableArmor: "wodSOTableArmor",
            sTableDamageFactor: "wodSOTableDamageFactor",
            sTableDrop: "wodSOTableDrop"
        },
        oTableOptions: {
            sCheckOptions: "wodSOCheckOptions",
            sHiddenOptionsTable: "wodSOTableOptions",
            sTableAttackTypes: "wodSOOptionAttackTypes",
            sTableAttributes: "wodSOOptionAttributes",
            sTableDamageTypes: "wodSOOptionDamageTypes",
            sTableDrops: "wodSOOptionDrops",
            sSaveOptions: "wodSOSaveOptions"
        }
    };
    oClassDataSets = {
        oBonusCheck: {
            js: "bonusCheck",
            css: "data-bonus-check"
        },
        oBonusCheckTitle: {
            js: "bonusCheckTitle",
            css: "data-bonus-check-title"
        },
        oBonusTitle: {
            js: "bonusTitle",
            css: "data-bonus-title"
        },
        oRememberMe: {
            js: "rememberMe",
            css: "data-remember-me"
        },
        oOptionType: {
            js: "optionType",
            css: "data-option-type"
        },
        oTab: {
            js: "tab",
            css: "data-tab"
        },
    };
    oOrder = {
        aAttributes: ["at_st", "at_ko", "at_in", "at_ge", "at_ch", "at_sn", "at_wa", "at_wi"],
        oBonus: {
            aAttackTypes: {
                default: ["an_nahkampf", "an_fernkampf", "an_zauber", "an_sozial", "an_natur", "an_falle_a", "an_falle_p", "an_detonate"/*, "an_mag_fluch"*//*, "an_mag_geschoss"*/, "an_misc_1", "an_misc_2"/*, "an_misc_3"*/, "an_misc_4"/*, "an_misc_5"*//*, "an_misc_6"*/],
                user: []
            },
            aDamageTypes: {
                default: ["st_hieb_schaden", "st_schneid_schaden", "st_stich_schaden", "st_feuer_schaden", "st_eis_schaden", "st_blitz_schaden", "st_gift_schaden", "st_saeure_schaden", "st_psycho_schaden", "st_nn_1", "st_mana_schaden", "st_hl_schaden", "st_wucht_schaden"],
                user: [],
            },
            aAttributes: {
                default: ["at_st", "at_ko", "at_in", "at_ge", "at_ch", "at_sn", "at_wa", "at_wi", "at_v_max_hitpoints", "at_v_heil_hitpoints", "at_v_max_manapoints", "at_v_heil_manapoints", "at_v_anz_aktionen", "at_v_initiative", "maxitems_ring", "maxitems_tasche", "maxitems_orden", "fame", "clan_fame"],
                user: [],
            },
            aDrops: {
                default: ["gold", "fame"],
                user: [],
            },
        }
    };
    aRememberedTables = [];
    blNeedToReSave = false;

    constructor() {

    }

    initRender() {
        const aCheckedHiddenBonusTables = this.loadOpenBonusTables();

        if (aCheckedHiddenBonusTables) {
            this.aRememberedTables = aCheckedHiddenBonusTables;
        }

        this.createTopTable();
        this.assignUserOrder();
        this.createHiddenOptionTable();
        this.createHiddenTopBonusTables();
        this.eventListener();
        this.hidePagination();
    }

    get detailsAreShown() {
        return !document.forms["the_form"]["show_details"];
    }

    /************
     * Messages *
     ************/

    /**
     *
     */
    createMessageArea() {
        let oDiv = this.oElements.oDiv.cloneNode();
        oDiv.id = this.oIds.sMessageArea;

        document.forms["the_form"].querySelector("p").insertAdjacentElement("afterend", oDiv);
    }

    addMessage(sMessage) {
        const oMessageArea = document.getElementById(this.oIds.sMessageArea);
        let oParagraph = this.oElements.oP.cloneNode();

        if (oMessageArea.childElementCount === 0) {
            const oHeader = this.oElements.oH4.cloneNode();
            oHeader.style.fontSize = "20px";
            oHeader.style.fontWeight = "bold";
            oHeader.innerText = "Meldungen";
            oMessageArea.appendChild(oHeader);
        }

        if (!oMessageArea.innerText.includes(sMessage)) {
            oParagraph.innerText = sMessage;
            oMessageArea.appendChild(oParagraph);
        }
    }

    /**************
     * top tables *
     **************/

    /**
     *
     */
    createTopTable() {
        let oTopTable = this.oElements.oTable.cloneNode();
        let oHeaderRow = oTopTable.insertRow();
        let oGeneralTh = this.oElements.oTh.cloneNode();
        let oAttributesTh = this.oElements.oTh.cloneNode();
        let oBonusTh = this.oElements.oTh.cloneNode();
        let oOptionsTh = this.oElements.oTh.cloneNode();
        let oClassDataRow = oTopTable.insertRow();
        let oGeneralCell = oClassDataRow.insertCell();
        let oAttributeCell = oClassDataRow.insertCell();
        let oBonusCell = oClassDataRow.insertCell();
        let oOptionsCell = oClassDataRow.insertCell();

        oTopTable.id = this.oIds.sTopTable;

        // top-header
        oGeneralTh.innerText = "Allgemeines";
        oAttributesTh.innerText = "Eigenschaften";
        oBonusTh.innerText = "Zeige Boni";
        oOptionsTh.innerText = "Konfiguration";

        oHeaderRow.appendChild(oGeneralTh);
        oHeaderRow.appendChild(oAttributesTh);
        oHeaderRow.appendChild(oBonusTh);
        oHeaderRow.appendChild(oOptionsTh);

        this.createTopGeneralTable(oGeneralCell);
        this.createTopAttributesTable(oAttributeCell);
        this.createTopBonusTable(oBonusCell);
        this.createTopOptionsTable(oOptionsCell);

        this.oElements.oLayout.appendChild(oTopTable);
    }

    createTopGeneralTable(oGeneralCell) {
        const aGeneralOrder = ["sHeroLvl", "sHitPoints", "sHpReg", "sManaPoints", "sMpReg", "sAction", "sIni"];
        const oGeneralTranslation = {
            sHeroLvl: {sToolTip: "Heldenstufe", sLabel: "Stufe"},
            sHitPoints: {sToolTip: "Hitpoints", sLabel: "HP"},
            sHpReg: {sToolTip: "HP-Regeneration pro Runde", sLabel: "HP-Reg"},
            sManaPoints: {sToolTip: "Manapoints", sLabel: "MP"},
            sMpReg: {sToolTip: "MP-Regeneration pro Runde", sLabel: "MP-Reg"},
            sAction: {sToolTip: "Aktionen pro Runde", sLabel: "Akt"},
            sIni: {sToolTip: "Initiativebonus", sLabel: "Ini-Bonus"}
        };
        let oGeneralTable = this.oElements.oTable.cloneNode();
        let oGeneralHeaderRow = oGeneralTable.insertRow();
        let oGeneralDataRow = oGeneralTable.insertRow();

        oGeneralTable.className = "content_table";
        oGeneralTable.id = "wodSOTopTableGeneral";
        oGeneralHeaderRow.className = "header";
        oGeneralDataRow.className = "row0";
        oGeneralCell.appendChild(oGeneralTable);

        for (let sGeneralAttribute of aGeneralOrder) {
            let oHeaderCell = oGeneralHeaderRow.insertCell();
            let oHeaderSpan = this.createMouseOver(oGeneralTranslation[sGeneralAttribute].sToolTip, oGeneralTranslation[sGeneralAttribute].sLabel);
            let oClassDataCell = oGeneralDataRow.insertCell();

            oHeaderCell.style.minWidth = "20px";
            oHeaderCell.style.textAlign = "center";
            oHeaderCell.appendChild(oHeaderSpan);

            oClassDataCell.style.textAlign = "center";
            oClassDataCell.id = `${this.oIds.oTableGeneral[sGeneralAttribute]}`;
        }
    }

    createTopAttributesTable(oAttributeCell) {
        // @todo mit data.oTypes verbinden
        const oAttributesTranslation = {
            at_st: {sToolTip: "Stärke", sLabel: "St"},
            at_ko: {sToolTip: "Konstitution", sLabel: "Ko"},
            at_in: {sToolTip: "Intelligenz", sLabel: "In"},
            at_ge: {sToolTip: "Geschicklichkeit", sLabel: "Ge"},
            at_ch: {sToolTip: "Charisma", sLabel: "Ch"},
            at_sn: {sToolTip: "Schnelligkeit", sLabel: "Sn"},
            at_wa: {sToolTip: "Wahrnehmung", sLabel: "Wa"},
            at_wi: {sToolTip: "Willenskraft", sLabel: "Wi"}
        };
        let oAttributesTable = this.oElements.oTable.cloneNode();
        let oAttributesHeaderRow = oAttributesTable.insertRow();
        let oAttributesDataRow = oAttributesTable.insertRow();

        oAttributesTable.className = "content_table";
        oAttributesTable.id = "wodSOTopTableAttributes";
        oAttributesHeaderRow.className = "header";
        oAttributesDataRow.className = "row0";
        oAttributeCell.appendChild(oAttributesTable);

        for (let sAttributesAttribute of this.oOrder.aAttributes) {
            let oHeaderCell = oAttributesHeaderRow.insertCell();
            let oHeaderSpan = this.createMouseOver(oAttributesTranslation[sAttributesAttribute].sToolTip, oAttributesTranslation[sAttributesAttribute].sLabel);
            let oClassDataCell = oAttributesDataRow.insertCell();
            let oClassDataSpanBase = this.oElements.oSpan.cloneNode();
            let oClassDataSpanEffective = this.oElements.oSpan.cloneNode();
            const sBaseId = `s${oAttributesTranslation[sAttributesAttribute].sLabel}Base`;
            const sEffectiveId = `s${oAttributesTranslation[sAttributesAttribute].sLabel}Effective`;

            oHeaderCell.style.minWidth = "20px";
            oHeaderCell.style.textAlign = "center";
            oHeaderCell.appendChild(oHeaderSpan);

            oClassDataCell.style.textAlign = "center";
            oClassDataCell.style.whiteSpace = "nowrap";
            oClassDataCell.id = `${this.oIds.oTableGeneral[sAttributesAttribute]}`;
            oClassDataSpanBase.id = `${this.oIds.oTableAttributes[sBaseId]}`;
            oClassDataSpanEffective.style.color = "gold";
            oClassDataSpanEffective.id = `${this.oIds.oTableAttributes[sEffectiveId]}`;
            oClassDataCell.appendChild(oClassDataSpanBase);
            oClassDataCell.appendChild(document.createTextNode(" "));
            oClassDataCell.appendChild(oClassDataSpanEffective);
        }
    }

    createTopBonusTable(oAttributeCell) {
        const aBonusOrder = ["sTableAttacks", "sTableParades", "sTableAttributes", "sTableSkillEffects", "sTableDamage", "sTableDamageZ", "sTableArmor", "sTableDamageFactor", "sTableDrop"];
        const oBonusTranslation = {
            sTableAttacks: "Angriffe",
            sTableParades: "Paraden",
            sTableAttributes: "Eigenschaften",
            sTableSkillEffects: "Wirkung",
            sTableDamage: "Schaden",
            sTableDamageZ: "Schaden (z)",
            sTableArmor: "Rüstung",
            sTableDamageFactor: "Anfälligkeiten",
            sTableDrop: "Belohnungen"
        };
        let oBonusTable = this.oElements.oTable.cloneNode();
        let oBonusHeaderRow = oBonusTable.insertRow();
        let oBonusDataRow = oBonusTable.insertRow();

        oBonusTable.className = "content_table";
        oBonusHeaderRow.className = "header";
        oBonusDataRow.className = "row0";
        oAttributeCell.appendChild(oBonusTable);

        for (let sBonusAttribute of aBonusOrder) {
            const blIsRemembered = this.aRememberedTables.includes(this.oIds.oTableBonus[sBonusAttribute]);
            let oHeaderCell = oBonusHeaderRow.insertCell();
            let oClassDataCell = oBonusDataRow.insertCell();
            let oClassDataInput = this.oElements.oInput.cloneNode();

            oHeaderCell.style.textAlign = "center";
            oHeaderCell.innerText = oBonusTranslation[sBonusAttribute];

            oClassDataCell.style.textAlign = "center";

            oClassDataInput.type = "checkbox";
            oClassDataInput.dataset[this.oClassDataSets.oBonusCheck.js] = `${this.oIds.oTableBonus[sBonusAttribute]}`;

            if (blIsRemembered) {
                oClassDataInput.checked = true;
            }

            if (!blIsRemembered) {
                oHeaderCell.style.display = "none";
                oClassDataCell.style.display = "none";
            }

            oHeaderCell.dataset[this.oClassDataSets.oBonusCheckTitle.js] = `${this.oIds.oTableBonus[sBonusAttribute]}`;

            oClassDataCell.appendChild(oClassDataInput);
        }

        const blUserSavedOpenTables = !!this.loadOpenBonusTables();
        let oRememberHeaderCell = oBonusHeaderRow.insertCell();
        let oRememberDataCell = oBonusDataRow.insertCell();
        let oRememberInput = this.oElements.oInput.cloneNode();

        oRememberHeaderCell.style.textAlign = "center";
        oRememberHeaderCell.innerText = "Merken?";
        oRememberDataCell.style.textAlign = "center";
        oRememberDataCell.appendChild(oRememberInput);
        oRememberInput.type = "checkbox";
        oRememberInput.id = `${this.oIds.oTableBonus.sCheckRemember}`;
        oRememberInput.dataset[this.oClassDataSets.oRememberMe.js] = "";
        oRememberInput.checked = blUserSavedOpenTables;
    }

    createTopOptionsTable(oAttributeCell) {
        let oOptionsTable = this.oElements.oTable.cloneNode();
        let oOptionsHeaderRow = oOptionsTable.insertRow();
        let oOptionsDataRow = oOptionsTable.insertRow();

        oOptionsTable.className = "content_table";
        oOptionsTable.style.margin = "auto";
        oOptionsHeaderRow.className = "header";
        oOptionsDataRow.className = "row0";
        oAttributeCell.appendChild(oOptionsTable);

        let oHeaderCell = oOptionsHeaderRow.insertCell();
        oHeaderCell.style.textAlign = "center";
        oHeaderCell.innerText = "Optionen";

        let oClassDataCell = oOptionsDataRow.insertCell();
        oClassDataCell.style.textAlign = "center";

        let oCheckBox = this.oElements.oInput.cloneNode();
        oCheckBox.type = "checkbox";
        oCheckBox.id = this.oIds.oTableOptions.sCheckOptions;

        oClassDataCell.appendChild(oCheckBox);
    }

    /**
     *
     * @param {attributes} oAttributes
     */
    addAttributeData(oAttributes) {
        const oIdsTableGeneral = this.oIds.oTableGeneral;
        const oIdsTableAttributes = this.oIds.oTableAttributes;
        const aHiddenAttributes = ["level", "max_hp", "heil_hp", "max_mp", "heil_mp", "anz_aktionen", "ini_bonus"];
        const oIdToAttribute = {
            "level": "sHeroLvl",
            "max_hp": "sHitPoints",
            "heil_hp": "sHpReg",
            "max_mp": "sManaPoints",
            "heil_mp": "sMpReg",
            "anz_aktionen": "sAction",
            "ini_bonus": "sIni",
            "at_st": "sSt",
            "at_ko": "sKo",
            "at_in": "sIn",
            "at_ge": "sGe",
            "at_ch": "sCh",
            "at_sn": "sSn",
            "at_wa": "sWa",
            "at_wi": "sWi"
        };

        for (let sAttribute of aHiddenAttributes) {
            this.addGeneralAttribute(oIdsTableGeneral[oIdToAttribute[sAttribute]], oAttributes[sAttribute]);
        }

        for (let sAttribute of this.oOrder.aAttributes) {
            this.addBaseAttribute(oIdsTableAttributes[`${oIdToAttribute[sAttribute]}Base`], oAttributes[sAttribute]);
            this.addEffectiveAttribute(oIdsTableAttributes[`${oIdToAttribute[sAttribute]}Effective`], oAttributes[sAttribute])
        }
    }

    /**
     *
     * @param {attribute_details} oAttribute
     * @param {string} sAttributeId
     */
    addGeneralAttribute(sAttributeId, oAttribute) {
        this.oElements.oLayout.getElementById(sAttributeId).innerText = `${oAttribute.effective_value}`;
    }

    /**
     *
     * @param {attribute_details} oAttribute
     * @param {string} sAttributeId
     */
    addBaseAttribute(sAttributeId, oAttribute) {
        this.oElements.oLayout.getElementById(sAttributeId).innerText = oAttribute.base_value;
    }

    /**
     *
     * @param {attribute_details} oAttribute
     * @param {string} sAttributeId
     */
    addEffectiveAttribute(sAttributeId, oAttribute) {
        if (parseInt(oAttribute.base_value) !== oAttribute.effective_value) {
            this.oElements.oLayout.getElementById(sAttributeId).innerText = `[${oAttribute.effective_value}]`;
        }
    };

    /***********************
     * Hidden option table *
     ***********************/

    /**
     *
     */
    assignUserOrder() {
        const oSavedOrder = this.loadOptionsOrder();

        if (oSavedOrder[oHero.sName]) {
            for (let [sTypeKey, aOrder] of Object.entries(oSavedOrder[oHero.sName])) {
                this.oOrder.oBonus[sTypeKey].user = aOrder;
            }
        }
    }

    createHiddenOptionTable() {
        const oTopBonusTable = this.oElements.oTable.cloneNode();
        const oHeaderRow = oTopBonusTable.insertRow();
        const oClassDataRow = oTopBonusTable.insertRow();
        const oButtonRow = oTopBonusTable.insertRow();
        const oSaveCell = oButtonRow.insertCell();
        const oSaveButton = this.oElements.oInput.cloneNode();
        const aCells = [this.oIds.oTableOptions.sTableAttackTypes, this.oIds.oTableOptions.sTableDamageTypes, this.oIds.oTableOptions.sTableAttributes, this.oIds.oTableOptions.sTableDrops];

        oTopBonusTable.id = this.oIds.oTableOptions.sHiddenOptionsTable;
        oTopBonusTable.style.display = "none";

        for (let sTableId of aCells) {
            this.createHiddenOptionsHead(oHeaderRow, sTableId)
            this.createHiddenOptionsTable(oClassDataRow, sTableId);
        }

        oSaveCell.colSpan = 4;
        oSaveCell.style.textAlign = "center";

        oSaveButton.type = "button";
        oSaveButton.id = this.oIds.oTableOptions.sSaveOptions;
        oSaveButton.className = "button clickable";
        oSaveButton.value = "Änderung speichern";
        oSaveButton.style.marginRight = "8px";

        oSaveCell.appendChild(oSaveButton);
        oSaveCell.appendChild(document.createTextNode("Erinnerungen werden nach einem Reload angewendet"));
        this.oElements.oLayout.appendChild(oTopBonusTable);
    }

    createHiddenOptionsHead(oHeaderRow, sTableId) {
        const oCellsLabel = {
            wodSOOptionAttackTypes: "Reihenfolge Angriffstypen",
            wodSOOptionAttributes: "Reihenfolge Eigenschaften",
            wodSOOptionDamageTypes: "Reihenfolge Schadenstypen",
            wodSOOptionDrops: "Reihenfolge Belohnungen"
        };
        let oTh = this.oElements.oTh.cloneNode();

        oTh.style.textAlign = "center";
        oTh.innerText = oCellsLabel[sTableId];
        oHeaderRow.appendChild(oTh);
    }

    createHiddenOptionsTable(oClassDataRow, sTableId) {
        let oCell = oClassDataRow.insertCell();
        /**
         *
         * @type {HTMLTableElement}
         */
        let oTable = this.oElements.oTable.cloneNode();

        oCell.style.verticalAlign = "top";
        oCell.style.textAlign = "center";
        oTable.id = sTableId;
        oTable.className = "content_table";

        switch (sTableId) {
            case this.oIds.oTableOptions.sTableAttackTypes:
                oTable.dataset[this.oClassDataSets.oOptionType.js] = "aAttackTypes";
                break;
            case this.oIds.oTableOptions.sTableDamageTypes:
                oTable.dataset[this.oClassDataSets.oOptionType.js] = "aDamageTypes";
                break;
            case this.oIds.oTableOptions.sTableAttributes:
                oTable.dataset[this.oClassDataSets.oOptionType.js] = "aAttributes";
                break;
            case this.oIds.oTableOptions.sTableDrops:
                oTable.dataset[this.oClassDataSets.oOptionType.js] = "aDrops";
                break;
        }

        oTable.createTBody();
        oCell.appendChild(oTable);
    }

    fillHiddenOptionsTable() {
        const aTableIds = [this.oIds.oTableOptions.sTableAttackTypes, this.oIds.oTableOptions.sTableDamageTypes, this.oIds.oTableOptions.sTableAttributes, this.oIds.oTableOptions.sTableDrops];

        for (let sTableId of aTableIds) {
            /**
             *
             * @type {HTMLTableElement}
             */
            const oTBody = this.oElements.oLayout.getElementById(sTableId).tBodies[0];
            const aListAttributes = this.getListOptions(sTableId);
            const aDefaultList = this.getListOptions(sTableId, true);
            let iCounter = 0;

            for (let oLevel1OptionElement of aListAttributes) {
                const oRow = oTBody.insertRow();
                const oLabelCell = oRow.insertCell();
                const oValueCell = oRow.insertCell();

                /**
                 *
                 * @type {HTMLSelectElement}
                 */
                let oSelectElement = this.oElements.oSelect.cloneNode();

                oRow.className = `row${iCounter++ % 2 ? "0" : "1"}`
                oLabelCell.innerText = `#${iCounter}`;
                oSelectElement.style.display = "block";
                oSelectElement.name = `${iCounter}`;

                for (let oLevel2OptionElement of aDefaultList) {
                    /**
                     *
                     * @type {HTMLOptionElement}
                     */
                    let oOptionElement = this.oElements.oOption.cloneNode();
                    oOptionElement.value = oLevel2OptionElement.sKey;
                    oOptionElement.innerText = oLevel2OptionElement.sLabel;

                    if (oLevel2OptionElement.sKey === oLevel1OptionElement.sKey) {
                        oOptionElement.selected = true;
                    }

                    oSelectElement.appendChild(oOptionElement);
                }

                oValueCell.appendChild(oSelectElement);
            }
        }
    }

    getListOptions(sTableId, blGetDefault = false) {
        let aReturn = [];

        switch (sTableId) {
            case this.oIds.oTableOptions.sTableAttackTypes:
                aReturn = this.getOptions("aAttackTypes", blGetDefault);
                break;
            case this.oIds.oTableOptions.sTableDamageTypes:
                aReturn = this.getOptions("aDamageTypes", blGetDefault);
                break;
            case this.oIds.oTableOptions.sTableAttributes:
                aReturn = this.getOptions("aAttributes", blGetDefault);
                break;
            case this.oIds.oTableOptions.sTableDrops:
                aReturn = this.getOptions("aDrops", blGetDefault);
                break;
        }

        return aReturn;
    }

    getOptions(sOrderKey, blGetDefault) {
        let aReturn = [];
        let sOrderType = "default";

        if (!blGetDefault && this.oOrder.oBonus[sOrderKey].user.length > 0) {
            sOrderType = "user";

            // if, i.e., another attack get released, the number of user saved dropdowns won´t match the necessary new numbers, so let´s default back to default
            if (this.oOrder.oBonus[sOrderKey].user.length !== this.oOrder.oBonus[sOrderKey].default.length) {
                const aMissingElements = this.oOrder.oBonus[sOrderKey].default.filter(sOrderElement => {
                    return !this.oOrder.oBonus[sOrderKey].user.includes(sOrderElement);
                });

                this.oOrder.oBonus[sOrderKey].user = this.oOrder.oBonus[sOrderKey].user.concat(aMissingElements);
                this.blNeedToReSave = true;
            }
        }

        for (let sKey of this.oOrder.oBonus[sOrderKey][sOrderType]) {
            let sLabel;

            switch (sOrderKey) {
                case "aAttackTypes":
                    sLabel = oClassData.oTypes.angriffs_typ[sKey];
                    break;
                case "aDamageTypes":
                    sLabel = oClassData.oTypes.schadens_typ[sKey];
                    break;
                case "aAttributes":
                    sLabel = oClassData.oTypes.attribute[sKey] || oClassData.oTypes.attribute_versteckt[sKey];
                    break;
                case "aDrops":
                    sLabel = oClassData.oTypes.attribute_versteckt[sKey] || sKey.at(0).toUpperCase() + sKey.slice(1);
                    break;
            }

            aReturn.push({
                sKey: sKey,
                sLabel: oClassData.translateSpecialSymbols(sLabel)
            });
        }

        return aReturn;
    }

    saveOptionsOrder() {
        const aTableIds = ["sTableAttackTypes", "sTableAttributes", "sTableDamageTypes", "sTableDrops"];
        const oSavedUserOrders = this.loadOptionsOrder();
        oSavedUserOrders[oHero.sName] = {};

        for (let sTableId of aTableIds) {
            const oTable = document.getElementById(this.oIds.oTableOptions[sTableId]);
            const sDataType = oTable.dataset[this.oClassDataSets.oOptionType.js];

            oTable.querySelectorAll("select").forEach(oSelect => {
                if (!oSavedUserOrders[oHero.sName][sDataType]) {
                    oSavedUserOrders[oHero.sName][sDataType] = [];
                }

                oSavedUserOrders[oHero.sName][sDataType].push(oSelect.selectedOptions[0].value);
            });
        }

        localStorage.setItem(this.oStorageKeys.userOrder, JSON.stringify(oSavedUserOrders));
    }

    loadOptionsOrder() {
        return JSON.parse(localStorage.getItem(this.oStorageKeys.userOrder)) || {};
    }

    toggleHiddenOptions() {
        const oHiddenTable = document.getElementById(this.oIds.oTableOptions.sHiddenOptionsTable);

        oHiddenTable.style.display = oHiddenTable.style.display === "none" ? "block" : "none";
    }

    /***********************
     * Hidden bonus tables *
     ***********************/

    /**
     *
     */
    createHiddenTopBonusTables() {
        let oTopBonusTable = this.oElements.oTable.cloneNode();
        let oHeaderRow = oTopBonusTable.insertRow();
        let oClassDataRow = oTopBonusTable.insertRow();
        const aCells = ["sTableAttacks", "sTableParades", "sTableAttributes", "sTableSkillEffects", "sTableDamage", "sTableDamageZ", "sTableArmor", "sTableDamageFactor", "sTableDrop"];
        const oCellsLabel = {
            sTableAttacks: "Boni auf Angriffe",
            sTableParades: "Boni auf Paraden",
            sTableAttributes: "Boni auf Eigenschaften",
            sTableSkillEffects: "Boni auf Wirkung von Fertigkeiten",
            sTableDamage: "Boni auf Schaden",
            sTableDamageZ: "Boni auf Schaden (z)",
            sTableArmor: "Boni auf Rüstung",
            sTableDamageFactor: "Boni auf Anfälligkeiten",
            sTableDrop: "Belohnungen in Dungeon"
        };

        oTopBonusTable.id = this.oIds.oTableBonus.sHiddenBonusTable;

        for (let sTableId of aCells) {
            let oTh = this.oElements.oTh.cloneNode();
            let oCell = oClassDataRow.insertCell();
            let oTable = this.oElements.oTable.cloneNode();

            oTh.dataset[this.oClassDataSets.oBonusTitle.js] = `${this.oIds.oTableBonus[sTableId]}`;
            oTh.style.textAlign = "center";
            oTh.style.display = "none";
            oTh.innerText = oCellsLabel[sTableId];
            oHeaderRow.appendChild(oTh);

            oCell.style.verticalAlign = "top";
            oCell.style.textAlign = "center";
            oCell.style.display = "none";
            oTable.id = `${this.oIds.oTableBonus[sTableId]}`;
            oTable.className = "content_table";
            oTable.createTBody();
            oCell.appendChild(oTable);
        }

        this.oElements.oLayout.appendChild(oTopBonusTable);
    }

    getOrder(sOrderKey) {
        return this.oOrder.oBonus[sOrderKey].user.length > 0 ? this.oOrder.oBonus[sOrderKey].user : this.oOrder.oBonus[sOrderKey].default
    }

    /**
     * make checkbox of hidden bonus tables available/visible because data for these tables is available.
     *
     * @param sBonusTableId
     */
    makeAvailableHiddenBonusTable(sBonusTableId) {
        this.oElements.oLayout.querySelector(`[${this.oClassDataSets.oBonusCheckTitle.css}=${sBonusTableId}]`).style.display = "table-cell";
        this.oElements.oLayout.querySelector(`[${this.oClassDataSets.oBonusCheck.css}=${sBonusTableId}]`).parentElement.style.display = "table-cell";
    }

    /**
     * toggle status of hidden bonus table and hidden title after clicking their respective checkboxes
     *
     * @param sBonusTable
     */
    toggleHiddenBonusTable(sBonusTable) {
        const oSelector = this.oElements.oLayout.childElementCount ? this.oElements.oLayout : document;
        const oTitle = oSelector.querySelector(`[${this.oClassDataSets.oBonusTitle.css}='${sBonusTable}']`);
        const oTable = oSelector.getElementById(sBonusTable);

        oTitle.style.display = oTitle.style.display === "none" ? "table-cell" : "none";
        oTable.parentElement.style.display = oTable.parentElement.style.display === "none" ? "table-cell" : "none";
    }

    /**
     *
     * @param {Object<bonus_type_details>} oValues
     * @param {string} sType
     */
    fillSingleBonus(oValues, sType) {
        console.log("layout bonus", sType, oValues);
        if (oValues.length === 0) {
            return;
        }

        const sTableKey = `sTable${sType}`;
        let sOrderKey = "";

        switch (sType) {
            case "Attributes":
                sOrderKey = "aAttributes";
                break;
            case "Attacks":
            case "Parades":
                sOrderKey = "aAttackTypes";
                break;
            case "Drop":
                sOrderKey = "aDrops";
                break;
        }

        const oHiddenBonusTableTBody = this.oElements.oLayout.getElementById(this.oIds.oTableBonus[sTableKey]).tBodies[0];
        const aTypeOrder = this.getOrder(sOrderKey);

        for (let sTypeKey of aTypeOrder) {
            if (oValues[sTypeKey]) {
                this.createBonusRow(oHiddenBonusTableTBody, oValues[sTypeKey]);
            }
        }

        this.makeAvailableHiddenBonusTable(this.oIds.oTableBonus[sTableKey]);
        this.showRememberedTable(this.oIds.oTableBonus[sTableKey]);
    }

    /**
     *
     * @param {Object<bonus_type_details>} oValues
     * @param {string} sType
     */
    fillTripleBonus(oValues, sType) {
        console.log("layout bonus", sType, oValues);
        if (oValues.length === 0) {
            return;
        }

        const sTableKey = `sTable${sType}`;
        const oHiddenBonusTableTBody = this.oElements.oLayout.getElementById(this.oIds.oTableBonus[sTableKey]).tBodies[0];
        const aDamageTypeOrder = this.getOrder("aDamageTypes");
        const aAttackTypeOrder = this.getOrder("aAttackTypes");

        for (let sDamageTypeKey of aDamageTypeOrder) {
            if (!oValues[sDamageTypeKey]) {
                continue;
            }

            if (oValues[sDamageTypeKey][oClassData.sAllAttackTypKey]) {
                this.createBonusRow(oHiddenBonusTableTBody, oValues[sDamageTypeKey][oClassData.sAllAttackTypKey]);
            }

            for (let sAttackTypeKey of aAttackTypeOrder) {
                if (oValues[sDamageTypeKey][sAttackTypeKey] === "blIsTripleValue" || sAttackTypeKey === oClassData.sAllAttackTypKey) {
                    continue;
                }

                if (oValues[sDamageTypeKey][sAttackTypeKey]) {
                    this.createBonusRow(oHiddenBonusTableTBody, oValues[sDamageTypeKey][sAttackTypeKey]);
                }
            }

        }

        this.makeAvailableHiddenBonusTable(this.oIds.oTableBonus[sTableKey]);
        this.showRememberedTable(this.oIds.oTableBonus[sTableKey]);
    }

    /**
     *
     * @param {Object<bonus_type_details>} oSkillEffects
     */
    fillBonusSkillEffects(oSkillEffects) {
        console.log("layout bonus skill effects", oSkillEffects);
        const oBonusSkillEffectsTBody = this.oElements.oLayout.getElementById(this.oIds.oTableBonus.sTableSkillEffects);

        if (Object.keys(oSkillEffects).length === 0) {
            return;
        }

        for (let oSkillEffect of Object.values(oSkillEffects)) {
            this.createBonusRow(oBonusSkillEffectsTBody, oSkillEffect);
        }

        this.makeAvailableHiddenBonusTable(this.oIds.oTableBonus.sTableSkillEffects);
        this.showRememberedTable(this.oIds.oTableBonus.sTableSkillEffects);
    }

    /**
     *
     * @param {HTMLTableElement} oTbody
     * @param {bonus_type_details} oBonusObject
     */
    createBonusRow(oTbody, oBonusObject) {
        if (!oBonusObject.blIsTripleValue && oBonusObject.bonus.flTotal === 0 && oBonusObject.bonus.percentage.flEffective === 1) {
            return;
        }

        let oBonusRow = oTbody.insertRow();
        let oLabelCell = oBonusRow.insertCell();
        let oValueCell = oBonusRow.insertCell();
        let oValueSpan;
        let sValueInnerText = "";
        let sOnMouseOver = "";
        let sLabel = oBonusObject.wod_SO_name;

        oBonusRow.className = oBonusRow.rowIndex % 2 === 0 ? "row0" : "row1";

        if (oBonusObject.istTalentKlasseWirkung) {
            sLabel = `alle Fertigkeiten der Klasse `;
        }

        oLabelCell.innerText = sLabel;
        oLabelCell.style.textAlign = "left";

        if (oBonusObject.istTalentKlasseWirkung) {
            let oTextNode = this.oElements.oSpan.cloneNode();
            oTextNode.style.fontStyle = "italic";
            oTextNode.innerText = oBonusObject.wod_SO_name;
            oLabelCell.appendChild(oTextNode);
        }

        if (oBonusObject.blIsTripleValue) {
            sValueInnerText += this.formValueString(oBonusObject.et_erfolg.bonus);
            sValueInnerText += ` / ${this.formValueString(oBonusObject.et_gut.bonus)}`;
            sValueInnerText += ` / ${this.formValueString(oBonusObject.et_kritisch.bonus)}`;
        } else {
            sValueInnerText = this.formValueString(oBonusObject.bonus);
        }

        for (let sDetail of oBonusObject.details) {
            sOnMouseOver += `${sDetail}<br />`;
        }

        oValueSpan = this.createMouseOver(sOnMouseOver, sValueInnerText);
        oValueCell.appendChild(oValueSpan);
    }

    formValueString(oTripleValueBonusObject) {
        let sReturnString = "";
        let sOperator = "";

        if (oTripleValueBonusObject.flTotal !== 0) {
            sReturnString = this.formatTotal(oTripleValueBonusObject.flTotal);
        }

        if (oTripleValueBonusObject.percentage.flEffective !== 1) {
            if (oTripleValueBonusObject.percentage.flEffective >= 1) {
                sOperator += "+";
            } else {
                sOperator += "-";
            }

            if (oTripleValueBonusObject.flTotal !== 0) {
                sOperator = ` ${sOperator} `;
            }

            sReturnString += `${sOperator}${Math.abs(oTripleValueBonusObject.percentage.iLabel)}%`;
        }

        if (sReturnString === "") {
            sReturnString = "0";
        }

        return sReturnString;
    }

    formatTotal(flTotal) {
        return new Intl.NumberFormat("default", {
            style: "decimal",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(flTotal);
    }

    showRememberedTable(sBonusTable) {
        if (this.aRememberedTables.includes(sBonusTable)) {
            this.toggleHiddenBonusTable(sBonusTable);
        }
    }

    /************************
     * remember me, senpai! *
     ************************/

    /**
     *
     */
    saveOpenBonusTables() {
        let oStoredOpenTables = this.loadOpenBonusTables(true);
        let aStoreData = [];

        document.querySelectorAll(`[${this.oClassDataSets.oBonusCheck.css}]`).forEach(/** @param {HTMLInputElement} oCheckBox **/oCheckBox => {
            if (oCheckBox.checked) {
                aStoreData.push(oCheckBox.dataset[this.oClassDataSets.oBonusCheck.js]);
            }
        });

        oStoredOpenTables[oHero.sName] = aStoreData;

        localStorage.setItem(this.oStorageKeys.openBonusTables, JSON.stringify(oStoredOpenTables));
    }

    /***********
     * Helpers *
     ***********/

    /**
     *
     */
    deleteOpenBonusTables() {
        let oStoredOpenTables = this.loadOpenBonusTables(true);

        if (oStoredOpenTables[oHero.sName]) {
            delete oStoredOpenTables[oHero.sName];
        }

        localStorage.setItem(this.oStorageKeys.openBonusTables, JSON.stringify(oStoredOpenTables));
    }

    loadOpenBonusTables(blWholeData = false) {
        let mReturnData;
        let oStorageData = JSON.parse(localStorage.getItem(this.oStorageKeys.openBonusTables));

        if (blWholeData) {
            mReturnData = oStorageData || {};
        } else {
            try {
                mReturnData = oStorageData[oHero.sName];
            } catch (sError) {
                mReturnData = [];
            }
        }

        return mReturnData;
    }

    /**
     *
     * @param sMouseOverText
     * @param mInnerText
     * @param {Object} oStyleOptions
     * @return {Node}
     */
    createMouseOver(sMouseOverText, mInnerText, oStyleOptions = false) {
        const oMouseOverSpan = this.oElements.oSpan.cloneNode();
        let oStyleElement = oMouseOverSpan;

        if (typeof mInnerText === "object") {
            oStyleElement = mInnerText;
            oMouseOverSpan.appendChild(mInnerText);
        } else {
            oMouseOverSpan.appendChild(document.createTextNode(mInnerText));
        }

        oMouseOverSpan.style.verticalAlign = "middle";
        oStyleElement.style.borderBottom = "1px dotted white";
        oStyleElement.setAttribute("onmouseover", `return wodToolTip(this, "${sMouseOverText}");`);

        if (oStyleOptions !== false) {
            for (let [sStyleKey, sStyleValue] of Object.entries(oStyleOptions)) {
                oMouseOverSpan.style[sStyleKey] = sStyleValue;
            }
        }

        return oMouseOverSpan;
    }

    /**************
     * Pagination *
     **************/

    /**
     *
     */
    hidePagination() {
        document.querySelectorAll(".paginator_selected, .paginator_selected + .texttoken").forEach(oElement => {
            oElement.style.display = "none";
        });
    }

    /**************
     * The Finals *
     **************/

    /**
     *
     */
    appendLayout() {
        document.forms["the_form"].insertBefore(this.oElements.oLayout, document.forms["the_form"].querySelector(".tab"));

        if (this.blNeedToReSave) {
            this.saveOptionsOrder();
        }
    }

    /**********
     * Events *
     **********/

    /**
     *
     */
    eventListener() {
        const oLayout = this.oElements.oLayout;

        oLayout.getElementById(this.oIds.sTopTable).addEventListener("click", (e) => {
            if (e.target.dataset[this.oClassDataSets.oBonusCheck.js]) {
                this.toggleHiddenBonusTable(e.target.dataset[this.oClassDataSets.oBonusCheck.js]);
            }

            if (e.target.hasAttribute(this.oClassDataSets.oRememberMe.css)) {
                if (e.target.checked) {
                    this.saveOpenBonusTables();
                } else {
                    this.deleteOpenBonusTables();
                }
            }

            if (e.target.id === this.oIds.oTableOptions.sCheckOptions) {
                this.toggleHiddenOptions();
            }
        });

        oLayout.getElementById(this.oIds.oTableOptions.sSaveOptions).addEventListener("click", () => {
            this.saveOptionsOrder();
        });
    }
}

class oSkillOptimizerSkills {
    /**
     *
     * @type {attributes}
     */
    oAttributes = {};
    oCellTypeNames = {
        skillClass: "skillClass",
        itemDropDown: "itemsDropDown",
        effectThrows: "throws",
        attackType: "attackType",
        manaCost: "manaCost",
        item: "item",
        numberOfTargets: "targets",
        hide: "hide"
    };
    oCellTypeLabel = {
        skillClass: "Klasse",
        itemsDropDown: "Item(a)",
        effectThrows: "Würfe",
        attackType: "Angriffsart",
        manaCost: "Manakosten",
        item: "Gegenstand",
        numberOfTargets: "Betroffene",
        hide: "Ausblenden"
    };
    oDataPowerUps = {
        attributes: {},
        attacks: {},
        parades: {},
        damages: {},
        damagesZ: {},
        initiative: {},
        skillEffects: {},
    };
    oDataSets = {
        tabs: {
            js: "tab",
            css: "data-tab"
        },
        tabRow: {
            js: "tabRow",
            css: "data-tab-row"
        },
        tabRowParade: {
            js: "tabRowParade",
            css: "data-tab-row-parade"
        },
        tabSkill: {
            js: "tabSkillName",
            css: "data-tab-skill-name"
        },
        cellType: {
            js: "cellType",
            css: "data-cell-type"
        },
        cellRowType: {
            js: "cellRowType",
            css: "data-cell-row-type"
        },
        selectSkillName: {
            js: "selectSkillName",
            css: "data-select-skill-name"
        },
        itemClassId: {
            js: "itemClassId",
            css: "data-item-class-id"
        },
    };
    oDefaultParades = {
        an_nahkampf: {
            primary: "at_sn",
            secondary: "at_ge"
        },
        an_fernkampf: {
            primary: "at_sn",
            secondary: "at_wa"
        },
        an_zauber: {
            primary: "at_wi",
            secondary: "at_in",
        },
        an_sozial: {
            primary: "at_wi",
            secondary: "at_ch"
        },
        an_detonate: {
            primary: "at_sn",
            secondary: "at_wa"
        },
        an_falle_p: {
            primary: "at_wa",
            secondary: "at_sn"
        },
        /* hinterhalt */
        an_misc_1: {
            primary: "at_wa",
            secondary: "at_in"
        },
        /* krankheit */
        an_misc_2: {
            primary: "at_ko",
            secondary: "at_ch"
        },
        an_natur: {
            primary: "at_wi",
            secondary: "at_sn"
        },
        initiative: {
            primary: "at_sn",
            secondary: "at_wa"
        }
    };
    oElements = {
        oTh: document.createElement("th"),
        oDiv: document.createElement("div"),
        oUl: document.createElement("ul"),
        oLi: document.createElement("li"),
        oSpan: document.createElement("span"),
        oA: document.createElement("a"),
        oSmall: document.createElement("small"),
        oTbody: document.createElement("tbody"),
        oSelect: document.createElement("select"),
        oOption: document.createElement("option"),
    };
    oItemClassItemsSorted = {};
    /**
     * @type {HTMLTableElement}
     */
    oSkillTable;
    /**
     *
     * @type {Object<bonus>}
     */
    oSkillEffects = {};
    oTableBodySkills = {};
    /**
     *
     * @type {HTMLTableSectionElement}
     */
    oTableBodyParades = {};
    /**
     *
     * @type {HTMLTableSectionElement}
     */
    oTableBodyInitiative = {};
    /**
     * @type {Object<Skill>}
     */
    oSkillObjectByName = {};
    aNewCells = ["skillClass", "itemsDropDown", "effectThrows", "attackType", "manaCost", "item", "numberOfTargets", "hide"];
    aOldCells = ["index", "label", "rank", "cost1", "cost2"];
    aOrderSlots = ["tr_kopf", "tr_ohren", "tr_brille", "tr_hals", "tr_orden", "tr_schaerpe", "tr_torso", "tr_umhang", "tr_arme", "tr_hand", "tr_ring", "tr_beide_haende", "tr_waffen_hand", "tr_schild_hand", "tr_einhaendig", "tr_beine", "tr_fuss", "tr_tasche", "tr_rucksack"];
    aTabSkillGroups = ["rt_attack", "rt_parade", "rt_initiativ", "rt_healing", "rt_powerup", "rt_create_monster"];
    sDamageTypeKey = "wod_S0_damage_key";
    iDefaultTableHeaderCells = 0;

    constructor() {

    }

    initRender() {
        this.oSkillTable = document.forms["the_form"].querySelector(".content_table");
        this.oSkillTable.id = "wodSOSkillTable";
        this.oTableBodySkills = this.oSkillTable.tBodies[0];

        this.createTabs();
        this.extendTableStructure();
        this.createTableFooter();
        this.eventListener();
    }

    /**************************
     * fill table with values *
     **************************/

    /**
     *
     */
    fillTable() {
        console.log("oSkillsByName", oClassData.oSkillsByName);
        console.log("oSkillsById", oClassData.oSkillsById);
        console.log("fillTable attributes", this.oDataPowerUps.attributes);
        console.log("fillTable skill effects", this.oDataPowerUps.skillEffects);

        const oFragment = document.createDocumentFragment();

        oFragment.appendChild(this.oTableBodySkills);

        for (let oRow of this.oTableBodySkills.rows) {
            const sSkillName = oRow.cells[1].innerText.trim();
            const oSkillObject = this.oSkillObjectByName[sSkillName] = new Skill(sSkillName);
            const oCells = oRow.cells;

            this.applySkillClassDataAttribute(oRow, oSkillObject);
            this.insertSkillClass(oCells[this.iDefaultTableHeaderCells + this.aNewCells.indexOf("skillClass") + 1], oSkillObject);
            const oFirstItemInList = this.insertItemDropDown(oCells[this.iDefaultTableHeaderCells + this.aNewCells.indexOf("itemsDropDown") + 1], oSkillObject);
            this.insertThrows(oCells[this.iDefaultTableHeaderCells + this.aNewCells.indexOf("effectThrows") + 1], oSkillObject, oFirstItemInList);
            this.insertAttackType(oCells[this.iDefaultTableHeaderCells + this.aNewCells.indexOf("attackType") + 1], oSkillObject);
            this.insertManaCosts(oCells[this.iDefaultTableHeaderCells + this.aNewCells.indexOf("manaCost") + 1], oSkillObject)
            this.insertItemClass(oCells[this.iDefaultTableHeaderCells + this.aNewCells.indexOf("item") + 1], oSkillObject);
            this.insertNumberOfTargets(oCells[this.iDefaultTableHeaderCells + this.aNewCells.indexOf("numberOfTargets") + 1], oSkillObject);
        }

        this.oSkillTable.appendChild(oFragment);

        this.addDefaultParades();
        this.addDefaultInitiative();
    }

    /**
     * @param {HTMLTableRowElement} oRow
     * @param {Skill} oSkillObject
     */
    applySkillClassDataAttribute(oRow, oSkillObject) {
        oRow.dataset[this.oDataSets.tabSkill.js] = oSkillObject.name;

        if (!oSkillObject.isConfigurable) {
            oRow.dataset[this.oDataSets.tabRow.js] = "passive";
        } else if (oSkillObject.realType === Skill.oRealTypes.powerDown) {
            oRow.dataset[this.oDataSets.tabRow.js] = "rt_attack";
        } else {
            oRow.dataset[this.oDataSets.tabRow.js] = oSkillObject.realType;
        }

        if (oSkillObject.realType !== Skill.oRealTypes.parade && oSkillObject.isConfigurableParade) {
            oRow.dataset[this.oDataSets.tabRowParade.js] = true;
        }
    }

    /**
     * @param {HTMLTableCellElement} oCell
     * @param {Skill} oSkillObject
     */
    insertSkillClass(oCell, oSkillObject) {
        oCell.dataset[this.oDataSets.cellType.js] = this.oCellTypeNames.skillClass;

        if (oSkillObject.skillClassId) {
            oCell.innerText = oSkillObject.skillClassName;
        }
    }

    /**
     * @todo secondary items depending on first one
     * @param {HTMLTableCellElement} oCell
     * @param {Skill} oSkillObject
     * @return {Item|null} oItem
     */
    insertItemDropDown(oCell, oSkillObject) {
        const iItemClassId = oSkillObject.itemClassId;
        /**
         * @type {Item|null}
         */
        let oFirstItem = null;

        oCell.dataset[this.oDataSets.cellType.js] = this.oCellTypeNames.itemDropDown;

        if (oSkillObject.type !== Skill.oTypes.heal && oSkillObject.realType !== Skill.oRealTypes.ini && oSkillObject.realType !== Skill.oRealTypes.powerDown) {
            return oFirstItem;
        }

        if (iItemClassId === 0) {
            return oFirstItem;
        }

        if (!oClassData.oItemClasses[iItemClassId].items || oClassData.oItemClasses[iItemClassId].items.length === 0) {
            return oFirstItem;
        }

        let oPrimarySelect = this.createItemDropDown(iItemClassId, oSkillObject.isItemOptional);
        oPrimarySelect.dataset[this.oDataSets.selectSkillName.js] = oSkillObject.name;

        if (oPrimarySelect.selectedOptions[0].value !== "") {
            oFirstItem = oClassData.oItemsByInstanceId[oPrimarySelect.selectedOptions[0].value];
        }

        oCell.appendChild(oPrimarySelect);

        if (oFirstItem && oFirstItem.hasAmmo) {
            oFirstItem.ammoList.forEach(oAmmoList => {
                const oAmmoSelect = this.createItemDropDown(oAmmoList.gegenstand_klasse_id, false);
                oCell.appendChild(oAmmoSelect);

                if (oAmmoSelect.childElementCount > 0) {
                    const oAmmoObject = oClassData.oItemsByInstanceId[oAmmoSelect.selectedOptions[0].value];
                    oAmmoObject.itemClassId = oAmmoList.gegenstand_klasse_id;

                    oFirstItem.setAmmo(oAmmoList.gegenstand_klasse_id, oAmmoObject);
                }
            });
        }

        return oFirstItem;
    }

    /**
     * @todo sets
     * @param {HTMLTableCellElement} oCell
     * @param {Skill} oSkillObject
     * @param {Item} oItemObject
     */
    insertThrows(oCell, oSkillObject, oItemObject = null) {
        oCell.dataset[this.oDataSets.cellType.js] = this.oCellTypeNames.effectThrows;

        if (oSkillObject.type !== Skill.oTypes.heal && oSkillObject.type !== Skill.oTypes.ini && oSkillObject.realType !== Skill.oRealTypes.powerDown) {
            return;
        }

        if (oItemObject) {
            oItemObject.itemClassId = oSkillObject.itemClassId;

            if (oItemObject.damageType) {
                oSkillObject.damageType = oItemObject.damageType;
            }
        }

        switch (oSkillObject.realType) {
            case "rt_healing":
                this.createThrowRows(oSkillObject, oItemObject, oCell, "healing");
                this.addHealValueRow(oSkillObject, oCell);
                break;
            case "rt_parade":
                this.createThrowRows(oSkillObject, oItemObject, oCell, "parades");
                break;
            case "rt_initiativ":
                this.createThrowRows(oSkillObject, oItemObject, oCell, "initiative");
                break;
            case "rt_powerdown":
                this.createThrowRows(oSkillObject, oItemObject, oCell, "attacks");
                break;
            case "rt_attack":
                this.createThrowRows(oSkillObject, oItemObject, oCell, "attacks");

                if (oSkillObject.isConfigurableParade) {
                    this.createThrowRows(oSkillObject, oItemObject, oCell, "parades");
                }

                if (oSkillObject.hasDamageType) {
                    this.createThrowRows(oSkillObject, oItemObject, oCell, "damage");
                }

                break;
            default:
                console.log("real_type", oSkillObject.realType);
        }
    }

    /**
     * @param {HTMLTableCellElement} oCell
     * @param {Skill} oSkillObject
     */
    insertAttackType(oCell, oSkillObject) {
        oCell.dataset[this.oDataSets.cellType.js] = this.oCellTypeNames.attackType;

        if (oSkillObject.attackType) {
            oCell.innerText = oClassData.translateSpecialSymbols(oClassData.oTypes.angriffs_typ[oSkillObject.attackType]);
        }
    }

    /**
     * @param {HTMLTableCellElement} oCell
     * @param {Skill} oSkillObject
     */
    insertManaCosts(oCell, oSkillObject) {
        const oFragment = document.createDocumentFragment()
        const iNextCostRows = 12;

        oCell.dataset[this.oDataSets.cellType.js] = this.oCellTypeNames.manaCost;

        if (oSkillObject.manaCost === 0 && oSkillObject.gainMpBasic === 0 && oSkillObject.gainMpPercent === 0) {
            return;
        }

        const flNotVariable = oSkillObject.manaCost * 0.8;
        const iTotalCost = Math.trunc(flNotVariable + (oSkillObject.rankEffective / 10) * oSkillObject.manaCost);
        let sMouseOverText = `Basismanakosten: ${oSkillObject.manaCost}<hr />Nächste Erhöhung der Manakosten:<br />`;
        let sGainMinusMouseOverText = "<hr />Die Fertigkeit wird grundsätzlich in voller Wirkung ausgeführt, solange der Held Basis-Manakosten bestreiten kann."
            + "<br />Die zusätzlichen Manakosten werden nach der Ausführung der Fertigkeit von deinem Manavorrat abgezogen, dieser kann dabei nicht unter 0 sinken.";
        let sGainPlusMouseOverText = "<hr />";
        let iLastTotal = iTotalCost;
        let sCellText = "";

        oCell.style.textAlign = "center";

        for (let iIndex = 1; iIndex <= iNextCostRows; iIndex++) {
            const iNewSkillRank = oSkillObject.rankEffective + iIndex;
            let iNewTotal = Math.trunc(flNotVariable + (iNewSkillRank / 10) * oSkillObject.manaCost);

            if (iLastTotal === iNewTotal) {
                continue;
            }

            sMouseOverText += `Rang ${iNewSkillRank}: ${iNewTotal}<br />`;

            iLastTotal = iNewTotal;
        }

        oFragment.appendChild(oClassLayout.createMouseOver(`<p>${sMouseOverText}</p>`, iTotalCost));

        if (oSkillObject.gainMpBasic) {
            let sOperator = " - ";
            let sGainBasisMouseOverText;

            if (oSkillObject.gainMpBasic < 0) {
                sOperator = " + ";
                sGainBasisMouseOverText = "Verlust an MP" + sGainMinusMouseOverText;
            } else {
                sGainBasisMouseOverText = "Gewinn an MP" + sGainPlusMouseOverText;
            }

            sCellText = Math.abs(oSkillObject.gainMpBasic);
            oFragment.appendChild(document.createTextNode(sOperator));
            oFragment.appendChild(oClassLayout.createMouseOver(sGainBasisMouseOverText, sCellText));
        }

        if (oSkillObject.gainMpValue) {
            console.warn("gain mp wert", oSkillObject);
        }

        if (oSkillObject.gainMpType !== "bo_wert" && oSkillObject.gainMpPercent !== 0 && oSkillObject.gainMpBasic !== 0 && oSkillObject.gainMpValue !== 0) {
            console.warn("gain_mp_typ !bo_wert", oSkillObject);
        }

        if (oSkillObject.gainMpPercent) {
            let sOperator = " - ";
            let sGainProcMouseOverText;

            if (oSkillObject.gainMpPercent < 0) {
                sOperator = " + ";
                sGainProcMouseOverText = `Verlust an MP: ${oSkillObject.gainMpPercent}% des Schadenswurfes` + sGainMinusMouseOverText;
            } else {
                sGainProcMouseOverText = `Gewinn an MP: ${oSkillObject.gainMpPercent}% des Schadenswurfes` + sGainPlusMouseOverText;
            }

            sCellText = `${Math.abs(oSkillObject.gainMpPercent)}%`;
            oFragment.appendChild(document.createTextNode(sOperator));
            oFragment.appendChild(oClassLayout.createMouseOver(sGainProcMouseOverText, sCellText));
        }

        oCell.appendChild(oFragment);
    }

    /**
     * @param {HTMLTableCellElement} oCell
     * @param {Skill} oSkillObject
     */
    insertItemClass(oCell, oSkillObject) {
        oCell.dataset[this.oDataSets.cellType.js] = this.oCellTypeNames.item;

        if (oSkillObject.itemClassId === 0) {
            return;
        }

        const sItemClassName = oClassData.oItemClasses[oSkillObject.itemClassId].name;

        if (oSkillObject.isItemOptional) {
            oCell.appendChild(oClassLayout.createMouseOver("optional", sItemClassName));
        } else {
            oCell.innerText = sItemClassName;
        }
    }

    /**
     * @param {HTMLTableCellElement} oCell
     * @param {Skill} oSkillObject
     */
    insertNumberOfTargets(oCell, oSkillObject) {
        const oHeroMaxLevel = 40;
        const sChainAttackPopUp = "Der zweite Gegner erhält nur dann Schaden,<br />wenn der erste bewusstlos geworden ist.<br /><br />Der dritte erhält nur dann Schaden,<br />wenn der zweite bewusstlos geworden ist.<br /><br />Usw.";

        oCell.dataset[this.oDataSets.cellType.js] = this.oCellTypeNames.numberOfTargets;

        if (oSkillObject.realType === Skill.oRealTypes.parade || oSkillObject.realType === Skill.oRealTypes.ini) {
            return;
        }

        if (!oSkillObject.isConfigurable) {
            return;
        }

        let blOnlyOnePosition = false;

        oCell.style.textAlign = "center";

        // noinspection FallThroughInSwitchStatementJS
        switch (oSkillObject.targetType) {
            case Skill.oTargetTypes.hero:
                oCell.innerText = "nur auf Selbst";
                break;
            case Skill.oTargetTypes.oneAlly:
            case Skill.oTargetTypes.oneEnemy:
                oCell.innerText = "1";
                break;
            case Skill.oTargetTypes.allyPosition:
            case Skill.oTargetTypes.enemyPosition:
                blOnlyOnePosition = true;
            case Skill.oTargetTypes.allyGroup:
            case Skill.oTargetTypes.enemyGroup:
                const blAffectedIsNumber = !Number.isNaN(oSkillObject.targetNumberValue);
                let sMouseOverText = "Anzahl Betroffene: ";
                let sFactorLabel = "der Heldenstufe";
                let sNextTargetFactor = "Stufe";
                let iMoreTargetLevel = 0;
                let iFactor = oHero.iLevel;

                /**
                 *
                 * @type {number|string}
                 */
                let mNumberOfTargets = 0;

                if (oSkillObject.targetNumberBasic) {
                    sMouseOverText += oSkillObject.targetNumberBasic;
                    mNumberOfTargets += oSkillObject.targetNumberBasic;
                }

                if (blAffectedIsNumber && oSkillObject.targetNumberValue !== 0) {
                    // noinspection FallThroughInSwitchStatementJS
                    switch (oSkillObject.targetNumberType) {
                        case "bo_wert":
                            mNumberOfTargets += oSkillObject.targetNumberValue;

                            break;
                        case "bo_prozent":
                            if (oSkillObject.targetNumberValue === 100) {
                                mNumberOfTargets = "Alle";
                            } else {
                                mNumberOfTargets += `${oSkillObject.targetNumberValue}%`;
                            }

                            break;
                        case "bo_wirk_faktor":
                            iFactor = oSkillObject.rankEffective;
                            sFactorLabel = "des Fertigkeitenrangs";
                            sNextTargetFactor = "Rang";
                        case "bo_stufen_faktor":
                            iMoreTargetLevel = (Math.trunc(oSkillObject.targetNumberValue * iFactor / 100) + 1) / (oSkillObject.targetNumberValue / 100);
                            sMouseOverText += `${oClassData.prefacePlus(oSkillObject.targetNumberValue)}% ${sFactorLabel}`;
                            mNumberOfTargets += Math.trunc(iFactor * (oSkillObject.targetNumberValue / 100));

                            if (iMoreTargetLevel <= oHeroMaxLevel) {
                                sMouseOverText += `<hr />Ein Betroffener mehr auf ${sNextTargetFactor} ${Math.ceil(iMoreTargetLevel)}`;
                            }

                            break;
                        default:
                            console.warn("unknown typ:", oSkillObject.targetNumberType);
                    }
                }

                if (oSkillObject.targetNumberType === "bo_wert" || !blAffectedIsNumber || mNumberOfTargets === "Alle" || (iMoreTargetLevel === 0 || iMoreTargetLevel > oHeroMaxLevel)) {
                    oCell.innerText = mNumberOfTargets;
                } else {
                    oCell.appendChild(oClassLayout.createMouseOver(sMouseOverText, mNumberOfTargets));
                }

                if (oSkillObject.isChainAttack) {
                    oCell.appendChild(oClassLayout.createMouseOver(sChainAttackPopUp, "🔗", {
                        fontSize: "10px",
                        marginLeft: "2px"
                    }));
                }

                if (blOnlyOnePosition) {
                    oCell.appendChild(document.createTextNode(" auf einer Position"));
                }

                break;
            default:
                console.log(oSkillObject.name, oSkillObject.targetType, oSkillObject.targetNumberBasic, oSkillObject.targetNumberType, oSkillObject.targetNumberValue);
        }
    }

    /**
     *
     * @param {Skill} oSkillObject
     * @param {Item} oItemObject
     * @param {HTMLTableCellElement} oCell
     * @param {string} sDataType
     */
    createThrowRows(oSkillObject, oItemObject = null, oCell, sDataType) {
        const blIsEffect = (sDataType === "healing" || sDataType === "damage");
        const blIsDamage = sDataType === "damage";
        const sPrimaryAttributeKey = blIsEffect ? oSkillObject.attributePrimaryEffect : oSkillObject.attributePrimary;
        const sSecondaryAttributeKey = blIsEffect ? oSkillObject.attributeSecondaryEffect : oSkillObject.attributeSecondary;
        /**
         * @type {attribute_details}
         */
        const oPrimaryAttribute = this.oDataPowerUps.attributes[sPrimaryAttributeKey];
        /**
         * @type {attribute_details}
         */
        const oSecondaryAttribute = this.oDataPowerUps.attributes[sSecondaryAttributeKey];
        let oCellRow = document.createDocumentFragment();
        let flPrimaryAttributeTotal = oPrimaryAttribute.effective_value;
        let flSecondaryAttributeTotal = oSecondaryAttribute.effective_value;
        let flSkillRank = oSkillObject.rankTotal;
        let flBaseCalculation = 0;
        let flAverageBase = 0;
        let flRangeMin = 0;
        let flRangeMax, flDamageOnGood, flDamageOnCritical, sToolTip;

        if (oItemObject) {
            flSkillRank += this.getItemRankBonus(oItemObject, oSkillObject)

            flPrimaryAttributeTotal += this.getItemAttributeBonus(oItemObject, sPrimaryAttributeKey, oPrimaryAttribute.base_value);
            flSecondaryAttributeTotal += this.getItemAttributeBonus(oItemObject, sSecondaryAttributeKey, oSecondaryAttribute.base_value);

            if (oItemObject.hasAmmo) {
                oItemObject.ammoEquipped.forEach(/** @param {Item} oAmmo **/oAmmo => {
                    flSkillRank += this.getItemRankBonus(oAmmo, oSkillObject)

                    flPrimaryAttributeTotal += this.getItemAttributeBonus(oAmmo, sPrimaryAttributeKey, oPrimaryAttribute.base_value);
                    flSecondaryAttributeTotal += this.getItemAttributeBonus(oAmmo, sSecondaryAttributeKey, oSecondaryAttribute.base_value);
                });
            }
        }

        flPrimaryAttributeTotal += (oSkillObject.getPowerUpAttribute(sPrimaryAttributeKey).percent - 1) * parseInt(oPrimaryAttribute.base_value) + oSkillObject.getPowerUpAttribute(sPrimaryAttributeKey).fixed;
        flSecondaryAttributeTotal += (oSkillObject.getPowerUpAttribute(sSecondaryAttributeKey).percent - 1) * parseInt(oSecondaryAttribute.base_value) + oSkillObject.getPowerUpAttribute(sSecondaryAttributeKey).fixed;

        if (flPrimaryAttributeTotal < 0) flPrimaryAttributeTotal = 0;
        if (flSecondaryAttributeTotal < 0) flSecondaryAttributeTotal = 0;
        if (flSkillRank < 0) flSkillRank = 0;

        if (blIsEffect) {
            flPrimaryAttributeTotal /= 2;
            flSecondaryAttributeTotal /= 3;
            flSkillRank /= 2;
        } else {
            flPrimaryAttributeTotal *= 2;
            flSkillRank *= 2;
        }

        flBaseCalculation += flPrimaryAttributeTotal + flSecondaryAttributeTotal + flSkillRank;
        flAverageBase += flBaseCalculation;

        flAverageBase *= this.getBonusseTotal(blIsEffect, blIsDamage, sDataType, oSkillObject, oItemObject, true);

        if (blIsDamage) {
            flDamageOnGood = flDamageOnCritical = flAverageBase;

            const oTriggerPercentBonus = this.getDamageBonusse(oSkillObject, oItemObject, oSkillObject.damageType, true, true);
            const oDamageZPercentBonus = this.getDamageBonusse(oSkillObject, oItemObject, oSkillObject.damageType, false, true);

            flAverageBase *= oTriggerPercentBonus.normal * oDamageZPercentBonus.normal;
            flDamageOnGood *= oTriggerPercentBonus.good * oDamageZPercentBonus.good;
            flDamageOnCritical *= oTriggerPercentBonus.critical * oDamageZPercentBonus.critical;

            flRangeMax = flDamageOnCritical * 2;
        } else {
            flRangeMax = flAverageBase * 2;
        }

        flRangeMin += this.getBonusseTotal(blIsEffect, blIsDamage, sDataType, oSkillObject, oItemObject);

        flAverageBase += flRangeMin;
        flRangeMax += flRangeMin;

        if (blIsDamage) {
            const oTriggerFixedBonus = this.getDamageBonusse(oSkillObject, oItemObject, oSkillObject.damageType, true);
            const oDamageZFixedBonus = this.getDamageBonusse(oSkillObject, oItemObject, oSkillObject.damageType);

            flAverageBase += oTriggerFixedBonus.normal + oDamageZFixedBonus.normal;
            flDamageOnGood += flRangeMin + oTriggerFixedBonus.good + oDamageZFixedBonus.good;
            flDamageOnCritical += flRangeMin + oTriggerFixedBonus.critical + oDamageZFixedBonus.critical;

            flRangeMin += oTriggerFixedBonus.normal + oDamageZFixedBonus.normal;
            flRangeMax += oTriggerFixedBonus.critical + oDamageZFixedBonus.critical;
        }

        if (blIsEffect) {
            flRangeMin *= oSkillObject.finalEffectBonus;
            flAverageBase *= oSkillObject.finalEffectBonus;
            flRangeMax *= oSkillObject.finalEffectBonus;
        }

        if (blIsDamage) {
            flDamageOnGood *= oSkillObject.finalEffectBonus;
            flDamageOnCritical *= oSkillObject.finalEffectBonus;
        }

        sToolTip = this.initPowerUpToolTip(blIsEffect, flBaseCalculation, flSkillRank, sPrimaryAttributeKey, flPrimaryAttributeTotal, sSecondaryAttributeKey, flSecondaryAttributeTotal);
        sToolTip += this.createPowerUpToolTipAttribute(oSkillObject, oItemObject, sPrimaryAttributeKey);
        sToolTip += this.createPowerUpToolTipAttribute(oSkillObject, oItemObject, sSecondaryAttributeKey);

        sToolTip += this.createPowerUpToolTipRank(oSkillObject.getPowerUpSkill(oSkillObject.name, "rank"));
        sToolTip += this.createPowerUpToolTipRank(oSkillObject.getPowerUpSkill(oSkillObject.skillClassName, "rank"));

        if (oItemObject) {
            sToolTip += this.createPowerUpToolTipRank(oItemObject.getPowerUpSkill(oSkillObject.name, "rank"), oItemObject.name);
            sToolTip += this.createPowerUpToolTipRank(oItemObject.getPowerUpSkill(oSkillObject.skillClassName, "rank"), oItemObject.name);

            if (oSkillObject.itemEffectCountForSkillRang) {
                sToolTip += this.createPowerUpToolTipRank(oItemObject.effect, `${oItemObject.name} Wirkung als `);
            }

            if (oItemObject.hasAmmo) {
                oItemObject.ammoEquipped.forEach(/** @param {Item} oAmmo **/oAmmo => {
                    sToolTip += this.createPowerUpToolTipRank(oAmmo.getPowerUpSkill(oSkillObject.name, "rank"), oAmmo.name);
                    sToolTip += this.createPowerUpToolTipRank(oAmmo.getPowerUpSkill(oSkillObject.skillClassName, "rank"), oAmmo.name);

                    if (oSkillObject.itemEffectCountForSkillRang) {
                        sToolTip += this.createPowerUpToolTipRank(oAmmo.effect, `${oItemObject.name} Wirkung als `);
                    }
                });
            }
        }

        sToolTip += this.createValuesToolTip(blIsEffect, blIsDamage, sDataType, oSkillObject, oItemObject, true);
        sToolTip += this.createValuesToolTip(blIsEffect, blIsDamage, sDataType, oSkillObject, oItemObject);

        if (blIsDamage) {
            sToolTip += this.createPowerUpToolTipDamage("Anwendungstrigger", oSkillObject.getPowerUpDamage(oSkillObject.damageType, oSkillObject.attackType));
            sToolTip += this.createPowerUpToolTipDamage("Anwendungsbonus", oSkillObject.getPowerUpDamage(oSkillObject.damageType, oSkillObject.attackType, false));

            if (oItemObject) {
                sToolTip += this.createPowerUpToolTipDamage(`${oItemObject.name} Trigger`, oItemObject.getPowerUpDamage(oSkillObject.damageType, oSkillObject.attackType));
                sToolTip += this.createPowerUpToolTipDamage(`${oItemObject.name} Bonus`, oItemObject.getPowerUpDamage(oSkillObject.damageType, oSkillObject.attackType, false));

                if (oItemObject.hasAmmo) {
                    oItemObject.ammoEquipped.forEach(/** @param {Item} oAmmo **/oAmmo => {
                        sToolTip += this.createPowerUpToolTipDamage(`${oAmmo.name} Trigger`, oAmmo.getPowerUpDamage(oSkillObject.damageType, oSkillObject.attackType));
                        sToolTip += this.createPowerUpToolTipDamage(`${oAmmo.name} Bonus`, oAmmo.getPowerUpDamage(oSkillObject.damageType, oSkillObject.attackType, false));
                    });
                }
            }

            if (typeof this.oDataPowerUps.damages[oSkillObject.damageType] !== "undefined") {
                if (typeof this.oDataPowerUps.damages[oSkillObject.damageType][oSkillObject.attackType] !== "undefined") {
                    sToolTip += this.createPowerUpToolTipDamage("Fester Trigger", this.oDataPowerUps.damages[oSkillObject.damageType][oSkillObject.attackType], oSkillObject.damageType);
                }

                if (typeof this.oDataPowerUps.damages[oSkillObject.damageType][oClassData.sAllAttackTypKey] !== "undefined") {
                    sToolTip += this.createPowerUpToolTipDamage("Fester Trigger", this.oDataPowerUps.damages[oSkillObject.damageType][oClassData.sAllAttackTypKey], oSkillObject.damageType);
                }
            }

            if (typeof this.oDataPowerUps.damagesZ[oSkillObject.damageType] !== "undefined") {
                if (typeof this.oDataPowerUps.damagesZ[oSkillObject.damageType][oSkillObject.attackType] !== "undefined") {
                    sToolTip += this.createPowerUpToolTipDamage("Fester Bonus", this.oDataPowerUps.damagesZ[oSkillObject.damageType][oSkillObject.attackType], oSkillObject.damageType);
                }

                if (typeof this.oDataPowerUps.damagesZ[oSkillObject.damageType][oClassData.sAllAttackTypKey] !== "undefined") {
                    sToolTip += this.createPowerUpToolTipDamage("Fester Bonus", this.oDataPowerUps.damagesZ[oSkillObject.damageType][oClassData.sAllAttackTypKey], oSkillObject.damageType);
                }
            }
        }

        if (blIsEffect) {
            sToolTip += this.createPowerUpToolTipPercentages("Finaler Wirkbonus", oSkillObject.finalEffectBonus);
        }

        if (oSkillObject.realType === Skill.oRealTypes.ini) {
            sToolTip += this.addActionsToolTip(flAverageBase);
        }

        if (flRangeMin < 0) flRangeMin = 0;
        if (flAverageBase < 0) flAverageBase = 0;
        if (flRangeMax < 0) flRangeMax = 0;
        if (flDamageOnGood < 0) flDamageOnGood = 0;
        if (flDamageOnCritical < 0) flDamageOnCritical = 0;

        oCellRow.appendChild(this.createCellRow(oSkillObject.damageType, sDataType, sToolTip, flRangeMin, flAverageBase, flRangeMax, blIsDamage, {
            hit: flAverageBase,
            good: flDamageOnGood,
            critical: flDamageOnCritical
        }));

        if (blIsDamage) {
            let aDamageTypeOrder = oClassLayout.oOrder.oBonus.aDamageTypes.user.length > 0 ? oClassLayout.oOrder.oBonus.aDamageTypes.user : oClassLayout.oOrder.oBonus.aDamageTypes.default;

            for (let sDamageType of aDamageTypeOrder) {
                if (sDamageType === oSkillObject.damageType) {
                    continue;
                }

                const oTriggerFixedBonus = this.getDamageBonusse(oSkillObject, oItemObject, sDamageType, true);

                if (oTriggerFixedBonus.normal === 0 && oTriggerFixedBonus.good === 0 && oTriggerFixedBonus.critical === 0) {
                    continue;
                }

                const oDamageZFixedBonus = this.getDamageBonusse(oSkillObject, oItemObject, sDamageType);
                let oTriggerFinalBonusToolTip = "";
                let flAdditionalDamageOnHit = 0;
                let flAdditionalDamageOnGood = 0;
                let flAdditionalDamageOnCritical = 0;

                flAdditionalDamageOnHit += oTriggerFixedBonus.normal;
                flAdditionalDamageOnGood += oTriggerFixedBonus.good;
                flAdditionalDamageOnCritical += oTriggerFixedBonus.critical;

                if (flAdditionalDamageOnHit !== 0) {
                    flAdditionalDamageOnHit += oDamageZFixedBonus.normal;
                }

                if (flAdditionalDamageOnGood !== 0) {
                    flAdditionalDamageOnGood += oDamageZFixedBonus.good;
                }

                if (flAdditionalDamageOnCritical !== 0) {
                    flAdditionalDamageOnCritical += oDamageZFixedBonus.critical;
                }

                if (flAdditionalDamageOnHit === 0 && flAdditionalDamageOnGood === 0 && flAdditionalDamageOnCritical === 0) {
                    continue;
                }

                oTriggerFinalBonusToolTip += this.createPowerUpToolTipDamage("Anwendungstrigger", oSkillObject.getPowerUpDamage(sDamageType, oSkillObject.attackType));
                oTriggerFinalBonusToolTip += this.createPowerUpToolTipDamage("Anwendungsbonus", oSkillObject.getPowerUpDamage(sDamageType, oSkillObject.attackType, false));

                if (oItemObject) {
                    oTriggerFinalBonusToolTip += this.createPowerUpToolTipDamage(`${oItemObject.name} Trigger`, oItemObject.getPowerUpDamage(sDamageType, oSkillObject.attackType));
                    oTriggerFinalBonusToolTip += this.createPowerUpToolTipDamage(`${oItemObject.name} Bonus`, oItemObject.getPowerUpDamage(sDamageType, oSkillObject.attackType, false));

                    if (oItemObject.hasAmmo) {
                        oItemObject.ammoEquipped.forEach(/** @param {Item} oAmmo **/oAmmo => {
                            oTriggerFinalBonusToolTip += this.createPowerUpToolTipDamage(`${oAmmo.name} Trigger`, oAmmo.getPowerUpDamage(oSkillObject.damageType, oSkillObject.attackType));
                            oTriggerFinalBonusToolTip += this.createPowerUpToolTipDamage(`${oAmmo.name} Bonus`, oAmmo.getPowerUpDamage(oSkillObject.damageType, oSkillObject.attackType, false));
                        });
                    }
                }

                if (typeof this.oDataPowerUps.damages[sDamageType] !== "undefined") {
                    if (typeof this.oDataPowerUps.damages[sDamageType][oSkillObject.attackType] !== "undefined") {
                        oTriggerFinalBonusToolTip += this.createPowerUpToolTipDamage("Fester Trigger", this.oDataPowerUps.damages[sDamageType][oSkillObject.attackType], sDamageType);
                    }

                    if (typeof this.oDataPowerUps.damages[sDamageType][oClassData.sAllAttackTypKey] !== "undefined") {
                        oTriggerFinalBonusToolTip += this.createPowerUpToolTipDamage("Fester Trigger", this.oDataPowerUps.damages[sDamageType][oClassData.sAllAttackTypKey], sDamageType);
                    }
                }

                if (typeof this.oDataPowerUps.damagesZ[sDamageType] !== "undefined") {
                    if (typeof this.oDataPowerUps.damagesZ[sDamageType][oSkillObject.attackType] !== "undefined") {
                        oTriggerFinalBonusToolTip += this.createPowerUpToolTipDamage("Fester Bonus", this.oDataPowerUps.damagesZ[sDamageType][oSkillObject.attackType], sDamageType);
                    }

                    if (typeof this.oDataPowerUps.damagesZ[sDamageType][oClassData.sAllAttackTypKey] !== "undefined") {
                        oTriggerFinalBonusToolTip += this.createPowerUpToolTipDamage("Fester Bonus", this.oDataPowerUps.damagesZ[sDamageType][oClassData.sAllAttackTypKey], sDamageType);
                    }
                }

                oTriggerFinalBonusToolTip += this.createPowerUpToolTipPercentages("Finaler Wirkbonus", oSkillObject.finalEffectBonus);

                oCellRow.appendChild(this.createCellRow(sDamageType, sDataType, oTriggerFinalBonusToolTip, flRangeMin, flAverageBase, flRangeMax, blIsDamage, {
                    hit: flAdditionalDamageOnHit * oSkillObject.finalEffectBonus,
                    good: flAdditionalDamageOnGood * oSkillObject.finalEffectBonus,
                    critical: flAdditionalDamageOnCritical * oSkillObject.finalEffectBonus,
                    blDamageTrigger: true
                }));
            }
        }

        oCell.appendChild(oCellRow);
    }

    /**
     * @param {HTMLSelectElement} oSelect
     */
    updateThrowCell(oSelect) {
        const oThrowCell = oSelect.closest("tr").cells[this.iDefaultTableHeaderCells + this.aNewCells.indexOf("effectThrows") + 1];
        let sSkillName = oSelect.dataset[this.oDataSets.selectSkillName.js];
        let sItemInstanceId = oSelect.selectedOptions[0].value;
        let oSkill, oItem;

        oThrowCell.innerHTML = "";
        // for (let oChild of oThrowCell.children) {
        //     oThrowCell.removeChild(oChild);
        // }

        if (!sSkillName) {
            const oSkillSelect = oSelect.parentElement.querySelector(`select[${this.oDataSets.selectSkillName.css}]`);

            sSkillName = oSkillSelect.dataset[this.oDataSets.selectSkillName.js];
            sItemInstanceId = oSkillSelect.selectedOptions[0].value;
        }

        oSkill = this.oSkillObjectByName[sSkillName];
        oItem = oClassData.oItemsByInstanceId[sItemInstanceId];

        if (!oSelect.dataset[this.oDataSets.selectSkillName.js]) {
            const sItemClassId = oSelect.dataset[this.oDataSets.itemClassId.js];
            const oAmmoItem = oClassData.oItemsByInstanceId[oSelect.selectedOptions[0].value];
            oAmmoItem.itemClassId = sItemClassId;
            oItem.setAmmo(sItemClassId, oAmmoItem);
            oItem.damageType = oAmmoItem.damageType;
        }

        this.insertThrows(oThrowCell, oSkill, oItem);
    }

    /****************************
     * ThrowCell Data Gathering *
     ****************************/

    /**
     *
     * @param {boolean} blIsEffect
     * @param {boolean} blIsDamage
     * @param {string} sDataType
     * @param {Skill} oSkillObject
     * @param {Item} oItemObject
     * @param {boolean} blIsPercent
     * @return {number}
     */
    getBonusseTotal(blIsEffect, blIsDamage, sDataType, oSkillObject, oItemObject, blIsPercent = false) {
        let aValuesToAdd = [];
        let sSkillValueType;
        let flReturnValue;

        if (blIsPercent) {
            sSkillValueType = "percent";
        } else {
            sSkillValueType = "fixed";
        }

        if (oItemObject) {
            aValuesToAdd.push(...this.getItemSkillBonusseTotal(blIsEffect, sDataType, sSkillValueType, oItemObject, oSkillObject));

            if (oItemObject.hasAmmo) {
                oItemObject.ammoEquipped.forEach(/** @param {Item} oAmmo **/oAmmo => {
                    aValuesToAdd.push(...this.getItemSkillBonusseTotal(blIsEffect, sDataType, sSkillValueType, oAmmo, oSkillObject));
                });
            }
        }

        aValuesToAdd.push(...this.getItemSkillBonusseTotal(blIsEffect, sDataType, sSkillValueType, oSkillObject, oSkillObject));

        if (blIsEffect) {
            if (this.oDataPowerUps.skillEffects[oSkillObject.name]) {
                aValuesToAdd.push(this.getDataValue(blIsPercent, this.oDataPowerUps.skillEffects[oSkillObject.name].bonus));
            }
            if (this.oDataPowerUps.skillEffects[oSkillObject.skillClassName]) {
                aValuesToAdd.push(this.getDataValue(blIsPercent, this.oDataPowerUps.skillEffects[oSkillObject.skillClassName].bonus));
            }
        } else {
            if (sDataType === "attacks" && (oSkillObject.realType === Skill.oRealTypes.attack || oSkillObject.realType === Skill.oRealTypes.powerDown)) {
                if (this.oDataPowerUps.attacks[oSkillObject.attackType]) {
                    aValuesToAdd.push(this.getDataValue(blIsPercent, this.oDataPowerUps.attacks[oSkillObject.attackType].bonus));
                }
            } else if (sDataType === "parades" && oSkillObject.isConfigurableParade) {
                if (this.oDataPowerUps.parades[oSkillObject.attackType]) {
                    aValuesToAdd.push(this.getDataValue(blIsPercent, this.oDataPowerUps.parades[oSkillObject.attackType].bonus));
                }
            } else if (sDataType === "initiative" && oSkillObject.realType === Skill.oRealTypes.ini) {
                if (this.oDataPowerUps.initiative) {
                    aValuesToAdd.push(this.getDataValue(blIsPercent, this.oDataPowerUps.initiative.bonus));
                }
            }
        }

        if (blIsPercent) {
            flReturnValue = 1;

            aValuesToAdd.forEach(flValueToAdd => {
                flReturnValue *= flValueToAdd;
            });
        } else {
            flReturnValue = 0;

            aValuesToAdd.forEach(flValueToAdd => {
                flReturnValue += flValueToAdd;
            });
        }

        return flReturnValue;
    }

    /**
     *
     * @param blIsEffect
     * @param sDataType
     * @param sSkillValueType
     * @param {Item|Skill} oClassObject
     * @param {Skill} oSkillObject
     * @return {*[]}
     */
    getItemSkillBonusseTotal(blIsEffect, sDataType, sSkillValueType, oClassObject, oSkillObject) {
        const oReturnArray = [];

        if (blIsEffect) {
            oReturnArray.push(oClassObject.effect[sSkillValueType]);
            oReturnArray.push(oClassObject.getPowerUpSkill(oSkillObject.name)[sSkillValueType]);
            oReturnArray.push(oClassObject.getPowerUpSkill(oSkillObject.skillClassName)[sSkillValueType]);
        } else {
            if (sDataType === "attacks" && (oSkillObject.realType === Skill.oRealTypes.attack || oSkillObject.realType === Skill.oRealTypes.powerDown)) {
                oReturnArray.push(oClassObject.getPowerUpProbeThrow(oSkillObject.attackType, Skill.oRealTypes.attack)[sSkillValueType]);
            } else if (sDataType === "parades" && oSkillObject.isConfigurableParade) {
                oReturnArray.push(oClassObject.getPowerUpProbeThrow(oSkillObject.attackType, Skill.oRealTypes.parade)[sSkillValueType]);
            } else if (sDataType === "initiative" && oSkillObject.realType === Skill.oRealTypes.ini) {
                oReturnArray.push(oClassObject.getPowerUpAttribute("at_v_initiative")[sSkillValueType]);
            }

            if ((sDataType === "attacks" && (oSkillObject.realType === Skill.oRealTypes.attack || oSkillObject.realType === Skill.oRealTypes.powerDown))
                || (sDataType === "parades" && oSkillObject.isConfigurableParade)
                || (sDataType === "initiative" && oSkillObject.realType === Skill.oRealTypes.ini)) {
                oReturnArray.push(oClassObject.probe[sSkillValueType]);
            }
        }

        return oReturnArray;
    }

    /**
     * @param {Skill} oSkillObject
     * @param {Item} oItemObject
     * @param {string} sDamageType
     * @param {boolean} blIsPercent
     * @param {boolean} blIsTrigger
     * @return {{normal: number, critical: number, good: number}}
     */
    getDamageBonusse(oSkillObject, oItemObject, sDamageType, blIsTrigger = false, blIsPercent = false) {
        const oValuesToAdd = [];
        let sDataPowerUpType = "damagesZ";
        let oReturn = {
            normal: 0,
            good: 0,
            critical: 0
        };

        if (blIsPercent) {
            oReturn = {
                normal: 1,
                good: 1,
                critical: 1
            };
        }

        if (blIsTrigger) {
            sDataPowerUpType = "damages";
        }

        if (typeof this.oDataPowerUps[sDataPowerUpType][sDamageType] !== "undefined") {
            if (typeof this.oDataPowerUps[sDataPowerUpType][sDamageType][oSkillObject.attackType] !== "undefined") {
                oValuesToAdd.push({
                    normal: this.getDataValue(blIsPercent, this.oDataPowerUps[sDataPowerUpType][sDamageType][oSkillObject.attackType][oClassData.aHitTypes[0]].bonus),
                    good: this.getDataValue(blIsPercent, this.oDataPowerUps[sDataPowerUpType][sDamageType][oSkillObject.attackType][oClassData.aHitTypes[1]].bonus),
                    critical: this.getDataValue(blIsPercent, this.oDataPowerUps[sDataPowerUpType][sDamageType][oSkillObject.attackType][oClassData.aHitTypes[2]].bonus)
                });
            }

            if (typeof this.oDataPowerUps[sDataPowerUpType][sDamageType][oClassData.sAllAttackTypKey] !== "undefined") {
                oValuesToAdd.push({
                    normal: this.getDataValue(blIsPercent, this.oDataPowerUps[sDataPowerUpType][sDamageType][oClassData.sAllAttackTypKey][oClassData.aHitTypes[0]].bonus),
                    good: this.getDataValue(blIsPercent, this.oDataPowerUps[sDataPowerUpType][sDamageType][oClassData.sAllAttackTypKey][oClassData.aHitTypes[1]].bonus),
                    critical: this.getDataValue(blIsPercent, this.oDataPowerUps[sDataPowerUpType][sDamageType][oClassData.sAllAttackTypKey][oClassData.aHitTypes[2]].bonus)
                });
            }
        }

        const oSkillDamage = oSkillObject.getPowerUpDamage(sDamageType, oSkillObject.attackType, blIsTrigger);
        if (oSkillDamage) {
            oValuesToAdd.push({
                normal: this.getDataValue(blIsPercent, oSkillDamage[oClassData.aHitTypes[0]].bonus),
                good: this.getDataValue(blIsPercent, oSkillDamage[oClassData.aHitTypes[1]].bonus),
                critical: this.getDataValue(blIsPercent, oSkillDamage[oClassData.aHitTypes[2]].bonus)
            });
        }

        if (oItemObject) {
            const oItemDamage = oItemObject.getPowerUpDamage(sDamageType, oSkillObject.attackType, blIsTrigger);
            oValuesToAdd.push({
                normal: this.getDataValue(blIsPercent, oItemDamage[oClassData.aHitTypes[0]].bonus),
                good: this.getDataValue(blIsPercent, oItemDamage[oClassData.aHitTypes[1]].bonus),
                critical: this.getDataValue(blIsPercent, oItemDamage[oClassData.aHitTypes[2]].bonus)
            });

            if (oItemObject.hasAmmo) {
                oItemObject.ammoEquipped.forEach(/** @param {Item} oAmmo **/oAmmo => {
                    const oAmmoDamage = oAmmo.getPowerUpDamage(sDamageType, oSkillObject.attackType, blIsTrigger);
                    oValuesToAdd.push({
                        normal: this.getDataValue(blIsPercent, oAmmoDamage[oClassData.aHitTypes[0]].bonus),
                        good: this.getDataValue(blIsPercent, oAmmoDamage[oClassData.aHitTypes[1]].bonus),
                        critical: this.getDataValue(blIsPercent, oAmmoDamage[oClassData.aHitTypes[2]].bonus)
                    });
                });
            }
        }

        if (blIsPercent) {
            oValuesToAdd.forEach(oValueToAdd => {
                oReturn.normal *= oValueToAdd.normal;
                oReturn.good *= oValueToAdd.good;
                oReturn.critical *= oValueToAdd.critical;
            });
        } else {
            oValuesToAdd.forEach(oValueToAdd => {
                oReturn.normal += oValueToAdd.normal;
                oReturn.good += oValueToAdd.good;
                oReturn.critical += oValueToAdd.critical;
            });
        }

        return oReturn;
    }

    getItemAttributeBonus(oItemObject, sAttributeKey, sAttributeBaseValue) {
        const oItemPowerUpAttribute = oItemObject.getPowerUpAttribute(sAttributeKey);
        let flReturnBonus = 0;

        flReturnBonus += (oItemPowerUpAttribute.percent - 1) * parseInt(sAttributeBaseValue) + oItemPowerUpAttribute.fixed;

        return flReturnBonus;
    }

    getItemRankBonus(oItemObject, oSkillObject) {
        let flReturn = 0;

        if (oSkillObject.itemEffectCountForSkillRang) {
            flReturn += (oItemObject.effect.percent - 1) * oSkillObject.rankBase + oItemObject.effect.fixed;
        }

        const oItemPowerUpSkill = oItemObject.getPowerUpSkill(oSkillObject.name, "rank");
        flReturn += (oItemPowerUpSkill.percent - 1) * oSkillObject.rankBase + oItemPowerUpSkill.fixed;

        if (oSkillObject.skillClassId) {
            const oItemPowerUpSkillClass = oItemObject.getPowerUpSkill(oSkillObject.skillClassName, "rank");
            flReturn += (oItemPowerUpSkillClass.percent - 1) * oSkillObject.rankBase + oItemPowerUpSkillClass.fixed;
        }

        return flReturn;
    }

    /******************************
     * ThrowCell ToolTip creation *
     ******************************/

    /**
     *
     * @param {boolean} blIsEffect
     * @param {number} flBaseCalculation
     * @param {number} flSkillRank
     * @param {string} sPrimaryAttributeKey
     * @param {number} flPrimaryAttributeTotal
     * @param {string} sSecondaryAttributeKey
     * @param {number} flSecondaryAttributeTotal
     * @return {string}
     */
    initPowerUpToolTip(blIsEffect, flBaseCalculation, flSkillRank, sPrimaryAttributeKey, flPrimaryAttributeTotal, sSecondaryAttributeKey, flSecondaryAttributeTotal) {
        let sReturnToolTip = `${oClassData.oTypes.attribute_kurz[sPrimaryAttributeKey]} ${blIsEffect ? "/ 2" : "x 2"} + ${oClassData.oTypes.attribute_kurz[sSecondaryAttributeKey]}${blIsEffect ? " / 3" : ""} + Fertigkeitsrang ${blIsEffect ? "/ 2" : "x 2"}`;
        sReturnToolTip += `<br />${oClassLayout.formatTotal(flPrimaryAttributeTotal)} + ${oClassLayout.formatTotal(flSecondaryAttributeTotal)} + ${oClassLayout.formatTotal(flSkillRank)} = ${oClassLayout.formatTotal(flBaseCalculation)}`;

        return sReturnToolTip;
    }

    /**
     * @param {Skill} oSkillObject
     * @param {Item} oItemObject
     * @param {string} sAttributeKey
     */
    createPowerUpToolTipAttribute(oSkillObject, oItemObject, sAttributeKey) {
        let sReturnToolTip = "";

        if (oSkillObject.getPowerUpAttribute(sAttributeKey).percent) {
            sReturnToolTip += this.createPowerUpToolTipPercentages(`Anwendungsbonus ${oClassData.oTypes.attribute_kurz[sAttributeKey]}`, oSkillObject.getPowerUpAttribute(sAttributeKey).percent);
        }

        if (oItemObject && oItemObject.getPowerUpAttribute(sAttributeKey).percent) {
            sReturnToolTip += this.createPowerUpToolTipPercentages(`${oItemObject.name} ${oClassData.oTypes.attribute_kurz[sAttributeKey]}`, oItemObject.getPowerUpAttribute(sAttributeKey).percent);
        }

        if (oSkillObject.getPowerUpAttribute(sAttributeKey).fixed) {
            sReturnToolTip += this.createPowerUpToolTipFixed(`Anwendungsbonus  ${oClassData.oTypes.attribute_kurz[sAttributeKey]}`, oSkillObject.getPowerUpAttribute(sAttributeKey).fixed);
        }

        if (oItemObject && oItemObject.getPowerUpAttribute(sAttributeKey).fixed) {
            sReturnToolTip += this.createPowerUpToolTipFixed(`${oItemObject.name}  ${oClassData.oTypes.attribute_kurz[sAttributeKey]}`, oItemObject.getPowerUpAttribute(sAttributeKey).fixed);
        }

        if (oItemObject && oItemObject.hasAmmo) {
            oItemObject.ammoEquipped.forEach(/** @param {Item} oAmmo **/oAmmo => {
                if (oAmmo.getPowerUpAttribute(sAttributeKey).percent) {
                    sReturnToolTip += this.createPowerUpToolTipPercentages(`${oAmmo.name} ${oClassData.oTypes.attribute_kurz[sAttributeKey]}`, oAmmo.getPowerUpAttribute(sAttributeKey).percent);
                }

                if (oAmmo.getPowerUpAttribute(sAttributeKey).fixed) {
                    sReturnToolTip += this.createPowerUpToolTipPercentages(`${oAmmo.name} ${oClassData.oTypes.attribute_kurz[sAttributeKey]}`, oAmmo.getPowerUpAttribute(sAttributeKey).fixed);
                }
            });
        }

        return sReturnToolTip;
    }

    /**
     *
     * @param blIsEffect
     * @param sDataType
     * @param fnToolTipFunction
     * @param sLabel
     * @param sSkillValueType
     * @param {Item|Skill} oClassObject
     * @param {Skill} oSkillObject
     * @return {string}
     */
    createItemSkillValuesToolTip(blIsEffect, sDataType, fnToolTipFunction, sLabel, sSkillValueType, oClassObject, oSkillObject) {
        let sToolTip = "";

        if (blIsEffect) {
            sToolTip += fnToolTipFunction(`${sLabel} Wirkung`, oClassObject.effect[sSkillValueType]);
            sToolTip += fnToolTipFunction(`${sLabel} Wirkungsbonus`, oClassObject.getPowerUpSkill(oSkillObject.name)[sSkillValueType]);
            sToolTip += fnToolTipFunction(`${sLabel} Wirkungsbonus (Klasse)`, oClassObject.getPowerUpSkill(oSkillObject.skillClassName)[sSkillValueType]);
        } else {
            if ((sDataType === "attacks" && (oSkillObject.realType === Skill.oRealTypes.attack || oSkillObject.realType === Skill.oRealTypes.powerDown))
                || (sDataType === "parades" && oSkillObject.isConfigurableParade)
                || (sDataType === "initiative" && oSkillObject.realType === Skill.oRealTypes.ini)) {
                sToolTip += fnToolTipFunction(`${sLabel} Bonus`, oClassObject.probe[sSkillValueType]);
            }

            if (sDataType === "attacks" && (oSkillObject.realType === Skill.oRealTypes.attack || oSkillObject.realType === Skill.oRealTypes.powerDown)) {
                sToolTip += fnToolTipFunction(`${sLabel} Bonus`, oClassObject.getPowerUpProbeThrow(oSkillObject.attackType, Skill.oRealTypes.attack)[sSkillValueType]);
            } else if (sDataType === "parades" && oSkillObject.isConfigurableParade) {
                sToolTip += fnToolTipFunction(`${sLabel} Bonus`, oClassObject.getPowerUpProbeThrow(oSkillObject.attackType, Skill.oRealTypes.parade)[sSkillValueType]);
            } else if (sDataType === "initiative" && oSkillObject.realType === Skill.oRealTypes.ini) {
                sToolTip += fnToolTipFunction(`${sLabel} Bonus`, oClassObject.getPowerUpAttribute("at_v_initiative")[sSkillValueType]);
            }
        }

        return sToolTip;
    }

    /**
     * @param {boolean} blIsEffect
     * @param {boolean} blIsDamage
     * @param {string} sDataType
     * @param {Skill} oSkillObject
     * @param {Item} oItemObject
     * @param {boolean} blIsPercent
     * @return {string}
     */
    createValuesToolTip(blIsEffect, blIsDamage, sDataType, oSkillObject, oItemObject, blIsPercent = false) {
        let sToolTip = "";
        let sSkillValueType = "fixed";
        let sEffectType = "Fester";
        let fnToolTipFunction = this.createPowerUpToolTipFixed;

        if (blIsPercent) {
            sSkillValueType = "percent";
            sEffectType = "Prozentualer";
            fnToolTipFunction = this.createPowerUpToolTipPercentages;
        }

        sToolTip += this.createItemSkillValuesToolTip(blIsEffect, sDataType, fnToolTipFunction, "Anwendung", sSkillValueType, oSkillObject, oSkillObject);

        if (oItemObject) {
            sToolTip += this.createItemSkillValuesToolTip(blIsEffect, sDataType, fnToolTipFunction, oItemObject.name, sSkillValueType, oItemObject, oSkillObject);

            if (oItemObject.hasAmmo) {
                oItemObject.ammoEquipped.forEach(/** @param {Item} oAmmo **/oAmmo => {
                    sToolTip += this.createItemSkillValuesToolTip(blIsEffect, sDataType, fnToolTipFunction, oAmmo.name, sSkillValueType, oAmmo, oSkillObject);
                });
            }
        }

        if (blIsEffect) {
            if (this.oDataPowerUps.skillEffects[oSkillObject.name]) {
                sToolTip += fnToolTipFunction(`${sEffectType} Wirkungsbonus`, this.getDataValue(blIsPercent, this.oDataPowerUps.skillEffects[oSkillObject.name].bonus));
            }
            if (this.oDataPowerUps.skillEffects[oSkillObject.skillClassName]) {
                sToolTip += fnToolTipFunction(`${sEffectType} Wirkungsbonus (Klasse)`, this.getDataValue(blIsPercent, this.oDataPowerUps.skillEffects[oSkillObject.skillClassName].bonus));
            }
        } else {
            if (sDataType === "attacks" && (oSkillObject.realType === Skill.oRealTypes.attack || oSkillObject.realType === Skill.oRealTypes.powerDown)) {
                if (this.oDataPowerUps.attacks[oSkillObject.attackType]) {
                    sToolTip += fnToolTipFunction(`${sEffectType} Bonus`, this.getDataValue(blIsPercent, this.oDataPowerUps.attacks[oSkillObject.attackType].bonus));
                }
            } else if (sDataType === "parades" && oSkillObject.isConfigurableParade) {
                if (this.oDataPowerUps.parades[oSkillObject.attackType]) {
                    sToolTip += fnToolTipFunction(`${sEffectType} Bonus`, this.getDataValue(blIsPercent, this.oDataPowerUps.parades[oSkillObject.attackType].bonus));
                }
            } else if (sDataType === "initiative" && oSkillObject.realType === Skill.oRealTypes.ini) {
                if (this.oDataPowerUps.initiative) {
                    sToolTip += fnToolTipFunction(`${sEffectType} Bonus`, this.getDataValue(blIsPercent, this.oDataPowerUps.initiative.bonus));
                }
            }
        }

        return sToolTip;
    }

    getDataValue(blIsPercent, oBonusObject) {
        if (blIsPercent) {
            return oBonusObject.percentage.flEffective;
        } else {
            return oBonusObject.flTotal;
        }
    }

    createPowerUpToolTipDamage(sLabel, oDamagePowerUp, sDamageKey = "") {
        let sReturnToolTip = "";

        if (oDamagePowerUp && Object.keys(oDamagePowerUp).length > 0) {
            let sHitBonus = Math.trunc(oDamagePowerUp.et_erfolg.bonus.flTotal);
            let sGoodBonus = Math.trunc(oDamagePowerUp.et_gut.bonus.flTotal)
            let sCriticalBonus = Math.trunc(oDamagePowerUp.et_kritisch.bonus.flTotal);

            sReturnToolTip += `<hr />${sLabel} ${oClassData.oTypes.schadens_typ[oDamagePowerUp[this.sDamageTypeKey] || sDamageKey]}: `;

            if (oDamagePowerUp.et_erfolg.bonus.percentage.iLabel !== 0) {
                sReturnToolTip += `${oClassData.prefacePlus(oDamagePowerUp.et_erfolg.bonus.percentage.iLabel)}%`;
                sHitBonus = sHitBonus !== 0 ? oClassData.prefacePlus(sHitBonus) : "";
            }

            sReturnToolTip += `${sHitBonus} / `;

            if (oDamagePowerUp.et_gut.bonus.percentage.iLabel !== 0) {
                sReturnToolTip += `${oClassData.prefacePlus(oDamagePowerUp.et_gut.bonus.percentage.iLabel)}%`;
                sGoodBonus = sGoodBonus !== 0 ? oClassData.prefacePlus(sGoodBonus) : "";
            }

            sReturnToolTip += `${sGoodBonus} / `;

            if (oDamagePowerUp.et_kritisch.bonus.percentage.iLabel !== 0) {
                sReturnToolTip += `${oClassData.prefacePlus(oDamagePowerUp.et_kritisch.bonus.percentage.iLabel)}%`;
                sCriticalBonus = sCriticalBonus !== 0 ? oClassData.prefacePlus(sCriticalBonus) : "";
            }

            sReturnToolTip += `${sCriticalBonus}`;

            if (sReturnToolTip.includes("0 / 0 / 0")) {
                sReturnToolTip = "";
            }
        }

        return sReturnToolTip;
    }

    createPowerUpToolTipRank(oRankBonus, sLabel = "Anwendungsbonus") {
        let sReturnToolTip = "";

        if (oRankBonus.percent !== 1) {
            sReturnToolTip += `<hr />${sLabel} Rang: ${oClassData.prefacePlus(Math.round(oRankBonus.percent * 100 - 100))}%`;
        }

        if (oRankBonus.fixed !== 0) {
            sReturnToolTip += `<hr />${sLabel} Rang: ${oClassData.prefacePlus(oClassLayout.formatTotal(oRankBonus.fixed))}`;
        }

        return sReturnToolTip;
    }

    createPowerUpToolTipPercentages(sLabel, flPercentageBonus) {
        let sReturnToolTip = "";

        if (flPercentageBonus !== 1) {
            sReturnToolTip += `<hr />${sLabel}: ${oClassData.prefacePlus(Math.round(flPercentageBonus * 100 - 100))}%`;
        }

        return sReturnToolTip;
    }

    createPowerUpToolTipFixed(sLabel, flFixedBonus) {
        let sReturnToolTip = "";

        if (flFixedBonus !== 0) {
            sReturnToolTip += `<hr />${sLabel}: ${oClassData.prefacePlus(oClassLayout.formatTotal(flFixedBonus))}`;
        }

        return sReturnToolTip;
    }

    addActionsToolTip(flEffectBase) {
        const iActions = this.oDataPowerUps.attributes.anz_aktionen.effective_value;
        let sReturnActionToolTip = "";

        if (iActions > 1) {
            let flSecondValue = flEffectBase;

            sReturnActionToolTip += `<hr />`;

            for (let iActionIndex = 1; iActionIndex <= iActions; iActionIndex++) {
                let flFirstValue = (flEffectBase / iActions) * (1 + iActions - iActionIndex);

                sReturnActionToolTip += `${iActionIndex}. Aktion bei Initiative ${Math.floor((flFirstValue + flSecondValue) / 2)}<br />`;
                flSecondValue /= 2;
            }
        }

        return sReturnActionToolTip;
    }

    /*********************
     * ThrowCell Helpers *
     *********************/

    /**
     *
     * @param sDamageType
     * @param sDataType
     * @param sToolTip
     * @param flEffectMin
     * @param flEffectBase
     * @param flEffectMax
     * @param blIsDamage
     * @param oDamageBonus
     * @return {Node}
     */
    createCellRow(sDamageType, sDataType, sToolTip, flEffectMin, flEffectBase, flEffectMax, blIsDamage, oDamageBonus) {
        const oLabel = {
            "healing": "Heilung",
            "attacks": "Angriff",
            "parades": "Parade",
            "initiative": "Initiative",
            "damage": oClassData.oTypes.schadens_typ[sDamageType]
        };
        const oDamageColor = {
            "st_blitz_schaden": "yellow",
            "st_eis_schaden": "cyan",
            "st_feuer_schaden": "red",
            "st_gift_schaden": "greenyellow",
            "st_hl_schaden": "silver",
            "st_mana_schaden": "dodgerblue",
            "st_nn_1": "purple",//arkan
            "st_psycho_schaden": "fuchsia",
            "st_saeure_schaden": "green",
            "st_wucht_schaden": "inherit",//fallen entschärfen
            "st_hieb_schaden": "inherit",
            "st_schneid_schaden": "inherit",
            "st_stich_schaden": "inherit",
        };
        const oCellRow = this.oElements.oDiv.cloneNode();
        const oCellLabelElement = this.oElements.oSpan.cloneNode();
        const oCellValueElement = this.oElements.oSpan.cloneNode();
        const oCellValueRangeElement = this.oElements.oSmall.cloneNode();

        oCellRow.dataset[this.oDataSets.cellRowType.js] = sDataType;

        // left side label
        oCellLabelElement.style.fontWeight = "bold";
        oCellLabelElement.style.display = "table-cell";
        oCellLabelElement.style.paddingRight = "4px";
        oCellLabelElement.innerText = oLabel[sDataType];

        if (sDataType === "damage") {
            oCellLabelElement.style.color = oDamageColor[sDamageType];
        }

        if (!oDamageBonus.blDamageTrigger) {
            // right side variable throws
            oCellValueRangeElement.innerText = `(${Math.trunc(flEffectMin > 0 ? flEffectMin : 0)} - ${Math.trunc(flEffectMax > 0 ? flEffectMax : 0)})`;
            oCellValueRangeElement.style.marginLeft = "2px";
        } else if (sToolTip === "") {
            oCellValueElement.style.display = "table-cell";
        }

        oCellValueElement.style.textAlign = "right";

        if (blIsDamage) {
            oCellValueElement.innerText = `${Math.trunc(oDamageBonus.hit < 0 ? 0 : oDamageBonus.hit)} / ${Math.trunc(oDamageBonus.good > 0 ? oDamageBonus.good : 0)} / ${Math.trunc(oDamageBonus.critical < 0 ? 0 : oDamageBonus.critical)}`;
        } else {
            oCellValueElement.innerText = Math.trunc(flEffectBase < 0 ? 0 : flEffectBase);
        }

        oCellValueElement.appendChild(oCellValueRangeElement);

        oCellRow.style.display = "table";
        oCellRow.style.width = "100%";
        oCellRow.appendChild(oCellLabelElement);

        if (sToolTip !== "") {
            oCellRow.appendChild(oClassLayout.createMouseOver(sToolTip, oCellValueElement, {
                display: "table-cell",
                whiteSpace: "nowrap",
                textAlign: "right",
            }));
        } else {
            oCellRow.appendChild(oCellValueElement);
        }

        return oCellRow;
    }

    createItemDropDown(iItemClassId, blIsItemOptional) {
        /**
         *
         * @param {Array} aArrayToPushTo
         * @param {Item} oItem
         */
        const fnAddToArray = function (aArrayToPushTo, oItem) {
            if (!aArrayToPushTo.find(/** @param {Item} oSavedItem **/oSavedItem => oSavedItem.name === oItem.name)) {
                aArrayToPushTo.push(oItem);
            }
        }
        /**
         *
         * @type {HTMLSelectElement}
         */
        const oSelect = this.oElements.oSelect.cloneNode();
        const aDoubleEndless = [];
        const aEndlessPerDungeon = [];
        const aEndlessPerFight = [];
        const aNeverEndless = [];
        const aExpandable = [];
        let aSortingArrays = [aDoubleEndless, aEndlessPerDungeon, aEndlessPerFight, aNeverEndless, aExpandable];

        oSelect.dataset[this.oDataSets.itemClassId.js] = iItemClassId;
        oSelect.style.display = "block";
        oSelect.style.marginBottom = "2px";

        if (blIsItemOptional) {
            const oOption = this.oElements.oOption.cloneNode();
            oOption.value = "";
            oOption.innerText = "Bitte auswählen";

            oSelect.appendChild(oOption);
        }

        if (this.oItemClassItemsSorted[iItemClassId]) {
            aSortingArrays = this.oItemClassItemsSorted[iItemClassId];
        } else {
            if (typeof oClassData.oItemClasses[iItemClassId].items === "undefined") {
                return oSelect;
            }

            // @todo veredlungen
            for (let oItem of oClassData.oItemClasses[iItemClassId].items) {
                if (oItem.applicationsTotal === null) {
                    if (oItem.applicationsPerDungeon === null && oItem.applicationsPerFight === null) {
                        fnAddToArray(aDoubleEndless, oItem);
                    } else if (oItem.applicationsPerDungeon === null) {
                        fnAddToArray(aEndlessPerDungeon, oItem);
                    } else if (oItem.applicationsPerFight === null) {
                        fnAddToArray(aEndlessPerFight, oItem);
                    } else {
                        fnAddToArray(aNeverEndless, oItem);
                    }
                } else {
                    fnAddToArray(aExpandable, oItem);
                }
            }

            this.oItemClassItemsSorted[iItemClassId] = aSortingArrays;
        }

        for (let aSortingArray of aSortingArrays) {
            for (/** @type {Item} oItem **/let oItem of aSortingArray) {
                for (let sSlot of this.aOrderSlots) {
                    if (oItem.equipmentSlot === sSlot) {
                        const oOption = this.oElements.oOption.cloneNode();
                        oOption.value = oItem.instanceId;
                        oOption.innerText = oItem.name;

                        oSelect.appendChild(oOption);
                        break;
                    }
                }
            }
        }

        return oSelect;
    }

    /**
     * @param {Skill} oSkillObject
     * @param {HTMLTableCellElement} oCell
     */
    addHealValueRow(oSkillObject, oCell) {
        if (oSkillObject.realType !== Skill.oRealTypes.healing) {
            return;
        }

        const oHealTypeRow = this.oElements.oDiv.cloneNode();
        const oHealLabel = this.oElements.oSpan.cloneNode();
        const oHealTypeLabel = this.oElements.oSmall.cloneNode();
        const oHealType = {
            ht_hitpoints: "HP",
            ht_manapoints: "MP",
        };
        const oHealColors = {
            ht_hitpoints: "lime",
            ht_manapoints: "dodgerblue"
        };

        oHealLabel.style.fontWeight = "bold";
        oHealLabel.style.display = "table-cell";
        oHealLabel.innerText = "heilt";

        oHealTypeLabel.style.display = "table-cell";
        oHealTypeLabel.style.textAlign = "right";

        if (oSkillObject.healType === Skill.oHealTypes.both) {
            const oHpSpan = this.oElements.oSpan.cloneNode();
            const oMpSpan = this.oElements.oSpan.cloneNode();
            const oOperatorSpan = this.oElements.oSpan.cloneNode();

            oHpSpan.style.color = oHealColors.ht_hitpoints;
            oMpSpan.style.color = oHealColors.ht_manapoints;

            oHpSpan.innerText = oHealType.ht_hitpoints;
            oMpSpan.innerText = oHealType.ht_manapoints;
            oOperatorSpan.innerText = "+"

            oHealTypeLabel.appendChild(oHpSpan);
            oHealTypeLabel.appendChild(oOperatorSpan);
            oHealTypeLabel.appendChild(oMpSpan);
        } else {
            oHealTypeLabel.style.color = oHealColors[oSkillObject.healType];
            oHealTypeLabel.innerText = oHealType[oSkillObject.healType];
        }

        oHealTypeRow.style.display = "table";
        oHealTypeRow.style.width = "100%";
        oHealTypeRow.appendChild(oHealLabel);
        oHealTypeRow.appendChild(oHealTypeLabel);

        oCell.appendChild(oHealTypeRow);
    }

    /********
     * Tabs *
     ********/

    /**
     *
     */
    createTabs() {
        const oTabs = this.oElements.oDiv.cloneNode();
        const oList = this.oElements.oUl.cloneNode();
        const oClear = this.oElements.oSpan.cloneNode();
        const aAdditionalFirstTabs = ["all"];
        const aAdditionalLastTabs = ["passive"/*, "hide"*/, "export"];
        const oTabLabel = {
            "all": "Alle",
            "passive": "Passiv",
            "export": "Export"
        };

        oTabs.className = "tab";
        oTabs.style.backgroundImage = "none";

        for (let sTab of aAdditionalFirstTabs) {
            let oTab = this.createTabElement(sTab, oTabLabel[sTab]);
            oList.appendChild(oTab);
        }

        for (let sTab of this.aTabSkillGroups) {
            let oTab = this.createTabElement(sTab, oClassData.oTypes.talent_typ[sTab]);
            oList.appendChild(oTab);
        }

        for (let sTab of aAdditionalLastTabs) {
            let oTab = this.createTabElement(sTab, oTabLabel[sTab]);
            oList.appendChild(oTab);
        }

        oClear.style.display = "block";
        oClear.style.clear = "both";

        oTabs.appendChild(oList);
        oTabs.appendChild(oClear);

        this.oSkillTable.parentElement.insertBefore(oTabs, this.oSkillTable);
    }

    /**
     * @param {string} sKey
     * @param {string} sLabel
     * @return {Node}
     */
    createTabElement(sKey, sLabel) {
        let oTabElement = this.oElements.oLi.cloneNode();
        let oLinkElement = this.oElements.oA.cloneNode();

        oTabElement.className = sKey !== "all" ? "not_selected" : "selected";

        oLinkElement.href = "#";
        oLinkElement.dataset[this.oDataSets.tabs.js] = sKey;
        oLinkElement.innerText = sLabel;

        oTabElement.appendChild(oLinkElement);

        return oTabElement;
    }

    /**
     * @param {string} sTabKey
     */
    selectTab(sTabKey) {
        document.querySelector(`[${this.oDataSets.tabs.css}="${sTabKey}"]`).parentElement.className = "selected";
    }

    unselectActiveTab() {
        document.querySelector(`.tab .selected`).className = "not_selected";
    }

    /**
     * @param {string} sTabKey
     */
    updateRows(sTabKey) {
        const oFragment = document.createDocumentFragment();
        const oThead = this.oSkillTable.tHead.rows[0];
        const oTFoot = this.oSkillTable.tFoot.rows[0];
        let iRowCounter = 0;

        oFragment.appendChild(this.oTableBodySkills);

        this.unHideCells(oThead, true);
        this.unHideCells(oTFoot, true);
        this.updateCells(oThead, sTabKey)
        this.updateCells(oTFoot, sTabKey)

        for (let oRow of this.oTableBodySkills.rows) {
            this.unHideCells(oRow);

            if (sTabKey === "all" || oRow.dataset[this.oDataSets.tabRow.js] === sTabKey || (sTabKey === Skill.oRealTypes.parade && oRow.dataset[this.oDataSets.tabRowParade.js] === "true")) {
                oRow.style.display = "table-row";

                this.setRowClassAndIndexLabel(oRow, iRowCounter++);
                this.updateCells(oRow, sTabKey);
                this.updateCellRows(oRow, sTabKey);
            } else {
                oRow.style.display = "none";
            }
        }

        if (sTabKey === "export") {
            const oTextarea = document.createElement("textarea");
            oFragment.appendChild(oTextarea);
            this.createExport(oTextarea);
            this.oSkillTable.appendChild(oFragment);
            oTextarea.select();
            oTextarea.focus();
            this.oSkillTable.tHead.rows[0].style.display = "none";
            this.oSkillTable.tFoot.rows[0].style.display = "none";
        } else {
            this.oSkillTable.appendChild(oFragment);
            document.querySelector("#wodSOSkillTable > textarea")?.remove();
            this.oSkillTable.tHead.rows[0].style.display = "table-row";
            this.oSkillTable.tFoot.rows[0].style.display = "table-row";
        }
    }

    /**
     * @param {HTMLTextAreaElement} oTextarea
     */
    createExport(oTextarea) {
        oTextarea.readOnly = true;
        oTextarea.style.width = "100vh";
        oTextarea.style.height = "100px";
        oTextarea.style.overflow = "hidden";

        let oOutput = String();

        oOutput += "[size=10]WoD Skill Optimizer by Darkflint (Beta-Version)[/size][br][br]";

        oOutput += "[h1]Eigenschaften[/h1]";
        oOutput += this.tableToBbCode(document.querySelector("#wodSOTopTableGeneral"));
        oOutput += this.tableToBbCode(document.querySelector("#wodSOTopTableAttributes"));

        let oTempTable = document.querySelector("#wodSOTableSkillEffects");
        if (oTempTable.rows.length > 0) {
            oOutput += "[h1]Wirkung[/h1]";
            oOutput += this.tableToBbCode(oTempTable);
        }

        oTempTable = document.querySelector("#wodSOTableDamage");
        if (oTempTable.rows.length > 0) {
            oOutput += "[h1]Schaden[/h1]";
            oOutput += this.tableToBbCode(oTempTable);
        }

        oTempTable = document.querySelector("#wodSOTableDamageZ");
        if (oTempTable.rows.length > 0) {
            oOutput += "[h1]Schaden (z)[/h1]";
            oOutput += this.tableToBbCode(oTempTable);
        }

        oTempTable = document.querySelector("#wodSOTableArmor");
        if (oTempTable.rows.length > 0) {
            oOutput += "[h1]Rüstung[/h1]";
            oOutput += this.tableToBbCode(oTempTable);
        }

        oTempTable = document.querySelector("#wodSOTableDamageFactor");
        if (oTempTable.rows.length > 0) {
            oOutput += "[h1]Anfälligkeit[/h1]";
            oOutput += this.tableToBbCode(oTempTable);
        }

        oOutput += "[h1]Angriff[/h1]";
        oOutput += "[table border=1]";
        oOutput += "[tr][th]Fertigkeit[/th][th]Rang[/th][th]Würfe[/th][th]Angriffsart[/th][th]MP[/th][th]Betroffene[/th][/tr]";
        oOutput += this.bbCodeTableHelper(Skill.oRealTypes.attack, [1, 2, 7, 8, 9, 11]);
        oOutput += "[/table]"

        oOutput += "[h1]Parade[/h1]";
        oOutput += "[table border=1]";
        oOutput += "[tr][th]Fertigkeit[/th][th]Rang[/th][th]Würfe[/th][th]Angriffsart[/th][/tr]";
        console.debug(this.oTableBodyInitiative);
        oOutput += this.bbCodeTableHelper(Skill.oRealTypes.parade, [1, 2, 7, 8]);
        oOutput += "[/table]"

        oOutput += "[h1]Initiative[/h1]";
        oOutput += "[table border=1]";
        oOutput += "[tr][th]Fertigkeit[/th][th]Rang[/th][th]Würfe[/th][th]MP[/th][/tr]";
        oOutput += this.bbCodeTableHelper(Skill.oRealTypes.ini, [1, 2, 7, 9]);
        oOutput += "[/table]"

        oOutput += "[h1]Verbesserung[/h1]";
        oOutput += "[table border=1]";
        oOutput += "[tr][th]Fertigkeit[/th][th]Rang[/th][th]MP[/th][th]Betroffene[/th][/tr]";
        oOutput += this.bbCodeTableHelper(Skill.oRealTypes.powerUp, [1, 2, 9, 11]);
        oOutput += "[/table]"

        oOutput += "[h1]Herbeirufung[/h1]";
        oOutput += "[table border=1]";
        oOutput += "[tr][th]Fertigkeit[/th][th]Rang[/th][th]MP[/th][/tr]";
        oOutput += this.bbCodeTableHelper(Skill.oRealTypes.summon, [1, 2, 9]);
        oOutput += "[/table]"

        oOutput += "[h1]Passive[/h1]";
        oOutput += "[table border=1]";
        oOutput += "[tr][th]Fertigkeit[/th][th]Rang[/th][/tr]";
        oOutput += this.bbCodeTableHelper("passive", [1, 2]);
        oOutput += "[/table]"

        oTextarea.value = oOutput.replaceAll('\r\n', '').replaceAll('\n', '').replaceAll('\r', '');
    }

    /**
     *
     * @param {string} sType
     * @param {Array<Number>} oCellsToParse
     *
     * @returns {string}
     */
    bbCodeTableHelper(sType, oCellsToParse) {
        let oTable = this.oTableBodySkills.cloneNode(true);
        switch (sType) {
            case Skill.oRealTypes.ini:
                oTable.appendChild(this.oTableBodyInitiative.rows[0].cloneNode(true));
                break;
            case Skill.oRealTypes.parade:
                for (let i = 0; i < this.oTableBodyParades.rows.length; i++) {
                    oTable.appendChild(this.oTableBodyParades.rows[i].cloneNode(true));
                }
                break;
            default:
                break;
        }
        let oOutput = String();
        for (let oRow of oTable.rows) {
            let sRowType = oRow.attributes.getNamedItem("data-tab-row")?.value;
            if (sRowType && sRowType !== sType) {
                if (!(sType === Skill.oRealTypes.parade && sRowType === Skill.oRealTypes.attack)) continue;
            }
            let oTempOutput = String();
            let oSkipRow = false;
            oTempOutput += "[tr]"
            for (let oCell of oRow.cells) {
                if (oCellsToParse.includes(oCell.cellIndex)) {
                    if (oCell.cellIndex === 1) { // Skillname
                        oTempOutput += `[td][skill=${oCell.textContent.trim()}][/td]`;
                    }
                    else if (oCell.cellIndex === 2) { // Skillrang
                        if (oCell.children.length > 0) {
                            let oRankContainer = oCell.querySelectorAll("td")[1]
                            let oRanks = oRankContainer.querySelectorAll("div, span");
                            oTempOutput += `[td align=center]${oRanks[0].innerText.trim()}`;
                            if (oRanks.length > 1) {
                                oTempOutput += `[color=gold] ${oRanks[1].innerText.trim()}[/color]`;
                            }
                            oTempOutput += "[/td]";
                        } else {
                            oTempOutput += "[td align=center]" + oCell.innerText.trim() + "[/td]";
                        }
                    } else if (oCell.cellIndex === 7) { // Würfe
                        let oDivs = oCell.querySelectorAll('div[data-cell-row-type]');
                        oTempOutput += "[td align=center][table]";
                        oSkipRow = true;
                        for (let oDiv of oDivs) {
                            if (oDiv.dataset[this.oDataSets.cellRowType.js] === "parades" && sType !== Skill.oRealTypes.parade) continue;
                            if (oDiv.dataset[this.oDataSets.cellRowType.js] !== "parades" && sType === Skill.oRealTypes.parade) continue;
                            let oSpans = oDiv.querySelectorAll('span[style*="display: table-cell;"]');
                            oTempOutput += "[tr]";
                            oTempOutput += `[td]${oSpans[0].textContent.trim()}[/td]`;
                            oTempOutput += `[td align=right]${oSpans[1].textContent.trim().replace('(', ' (')}[/td]`;
                            oTempOutput += "[/tr]";
                            oSkipRow = false;
                        }
                        oTempOutput += "[/table][/td]"
                    } else {
                        oTempOutput += `[td align=center]${oCell.textContent.trim()}[/td]`;
                    }
                }
            }
            if (!oSkipRow) oOutput += oTempOutput + "[/tr]";
        }
        return oOutput;
    }

    /**
     * @param {HTMLTableElement} oTable
     *
     * @returns {string}
     */
    tableToBbCode(oTable) {
        if (!oTable || !(oTable instanceof HTMLTableElement)) {
            throw new Error("Invalid table element");
        }

        let bbCode = "[table border=1]\n";

        const rows = oTable.querySelectorAll("tr");
        rows.forEach((row) => {
            bbCode += "[tr]";

            const cells = row.querySelectorAll("td, th");
            cells.forEach((cell) => {
                let cellText = "";

                // Concatenate all inner text content, including styled spans
                cell.childNodes.forEach((child) => {
                    if (child.nodeType === Node.TEXT_NODE) {
                        cellText += child.textContent.trim();
                    } else if (child.nodeType === Node.ELEMENT_NODE) {
                        const span = /** @type {HTMLElement} */ (child);
                        let text = span.textContent.trim();

                        if (span.style.color === "gold") {
                            text = `[color=gold]${text}[/color]`;
                        }

                        cellText += (cellText ? " " : "") + text;
                    }
                });

                // Determine alignment from style attributes
                let textAlign = cell.style.textAlign;
                if (!textAlign) {
                    const span = cell.querySelector("span");
                    if (span && span.style.verticalAlign) {
                        textAlign = span.style.verticalAlign;
                    }
                }

                let alignedText = cellText;
                if (textAlign === "center" || textAlign === "middle") {
                    alignedText = `[center]${cellText}[/center]`;
                } else if (textAlign === "right" || textAlign === "bottom") {
                    alignedText = `[right]${cellText}[/right]`;
                }

                const tag = cell.tagName.toLowerCase() === "th" ? "th" : "td";
                bbCode += `[${tag}]${alignedText}[/${tag}]`;
            });

            bbCode += "[/tr]\n";
        });

        bbCode += "[/table]";
        return bbCode;
    }

    /**
     * @param {HTMLTableRowElement} oRow
     * @param {number} iRowCounter
     */
    setRowClassAndIndexLabel(oRow, iRowCounter) {
        oRow.className = `row${iRowCounter % 2}`;
        oRow.cells[0].innerText = (iRowCounter + 1).toString();
    }

    /**
     * @param {HTMLTableRowElement} oRow
     * @param {boolean} blIsHeader
     */
    unHideCells(oRow, blIsHeader = false) {
        oRow.querySelectorAll(`${blIsHeader ? "th" : "td"}[style]`).forEach(oCell => {
            oCell.style.display = "table-cell";
        });
    }

    /**
     * @param {HTMLTableRowElement} oRow
     * @param {string} sTabKey
     */
    updateCells(oRow, sTabKey) {
        switch (sTabKey) {
            case Skill.oRealTypes.parade:
                this.hideCell("numberOfTargets", oRow);
                break;
            case Skill.oRealTypes.ini:
                this.hideCell("attackType", oRow)
                this.hideCell("numberOfTargets", oRow);
                break;
            case Skill.oRealTypes.healing:
                this.hideCell("attackType", oRow);
                break;
            case Skill.oRealTypes.powerUp:
                this.hideCell("attackType", oRow);
                this.hideCell("effectThrows", oRow);
                break;
            case Skill.oRealTypes.summon:
                this.hideCell("attackType", oRow);
                this.hideCell("effectThrows", oRow);
                this.hideCell("numberOfTargets", oRow);
                break;
            case "passive":
                this.hideCell("attackType", oRow);
                this.hideCell("effectThrows", oRow);
                this.hideCell("numberOfTargets", oRow);
                this.hideCell("item", oRow);
                this.hideCell("manaCost", oRow);
                break;
            case "all":
                // do nothing
                break;
        }
    }

    /**
     * @param {HTMLTableRowElement} oRow
     * @param {string} sTabKey
     */
    updateCellRows(oRow, sTabKey) {
        if (sTabKey === Skill.oRealTypes.parade) {
            oRow.querySelectorAll(`[${this.oDataSets.cellRowType.css}]:not([${this.oDataSets.cellRowType.css}="parades"])`).forEach(oCellRow => {
                oCellRow.style.display = "none";
            });
        } else {
            oRow.querySelectorAll(`[${this.oDataSets.cellRowType.css}]:not([${this.oDataSets.cellRowType.css}="parades"])`).forEach(oCellRow => {
                oCellRow.style.display = "table";
            });
        }

        if (sTabKey === Skill.oRealTypes.attack) {
            oRow.querySelectorAll(`[${this.oDataSets.cellRowType.css}="parades"]`).forEach(oCellRow => {
                oCellRow.style.display = "none";
            });
        } else {
            oRow.querySelectorAll(`[${this.oDataSets.cellRowType.css}="parades"]`).forEach(oCellRow => {
                oCellRow.style.display = "table";
            });
        }
    }

    /**
     * @param {string} sCellType
     * @param {HTMLTableRowElement} oRow
     */
    hideCell(sCellType, oRow) {
        oRow.querySelector(`[${this.oDataSets.cellType.css}="${this.oCellTypeNames[sCellType]}"]`).style.display = "none";
    }

    /**
     * @param {string} sTabKey
     * @param {string} sType
     * @param {boolean} blIsAppended
     * @param {HTMLTableSectionElement} oTBody
     * @return {boolean}
     */
    updateExtraTBody(sTabKey, sType, blIsAppended, oTBody) {
        if (sTabKey === sType) {
            this.oSkillTable.appendChild(oTBody);
            this.updateSecondTBody(oTBody);

            blIsAppended = true;
        } else if (blIsAppended) {
            blIsAppended = false;
            this.oSkillTable.removeChild(oTBody);
        }

        return blIsAppended;
    }

    /**
     * @param {HTMLTableSectionElement} oTableBody
     */
    updateSecondTBody(oTableBody) {
        const iInitial = 0;

        let iRowCounter = Array.from(this.oTableBodySkills.rows).reduce((accumulator, oRow) => {
            return accumulator + (oRow.style.display === "none" ? 0 : 1);
        }, iInitial);

        for (let oRow of oTableBody.rows) {
            this.setRowClassAndIndexLabel(oRow, iRowCounter++);
        }
    }

    /*******************
     * Table Structure *
     *******************/

    /**
     *
     */
    extendTableStructure() {
        const oFragment = document.createDocumentFragment();
        const oSkillTHead = this.oSkillTable.createTHead();
        const oHeaderRow = this.oTableBodySkills.rows[0];
        let iRowIndex = 0;

        this.iDefaultTableHeaderCells = oHeaderRow.cells.length;

        oFragment.appendChild(this.oTableBodySkills);

        for (let oRow of this.oTableBodySkills.rows) {
            oRow.cells[1].style.verticalAlign = "middle";

            for (let sCellType of this.aNewCells) {
                if (iRowIndex === 0) {
                    // table head
                    const oNewHeaderCell = this.oElements.oTh.cloneNode();
                    oNewHeaderCell.innerText = this.oCellTypeLabel[sCellType];
                    oNewHeaderCell.dataset[this.oDataSets.cellType.js] = this.oCellTypeNames[sCellType];
                    oRow.appendChild(oNewHeaderCell);
                } else {
                    oRow.insertCell();
                }
            }

            iRowIndex++;
        }

        oSkillTHead.appendChild(oHeaderRow);
        this.oSkillTable.appendChild(oFragment);
    }

    addDefaultParades() {
        const oTableParades = this.oElements.oTbody.cloneNode();
        const aAttackTypes = oClassLayout.oOrder.oBonus.aAttackTypes.user.length > 0 ? oClassLayout.oOrder.oBonus.aAttackTypes.user : oClassLayout.oOrder.oBonus.aAttackTypes.default;

        this.oTableBodyParades = oTableParades;

        for (const sAttackType of aAttackTypes) {
            if (sAttackType === "an_falle_a" || !this.oDefaultParades[sAttackType]) {
                continue;
            }

            this.createExtraTBodyRow(Skill.sFakeParade, oTableParades, this.oDefaultParades[sAttackType].primary, this.oDefaultParades[sAttackType].secondary, sAttackType);
        }
    }

    addDefaultInitiative() {
        const oTableInitiative = this.oElements.oTbody.cloneNode();

        this.oTableBodyInitiative = oTableInitiative;

        this.createExtraTBodyRow(Skill.sFakeIni, oTableInitiative, this.oDefaultParades.initiative.primary, this.oDefaultParades.initiative.secondary);
    }

    createExtraTBodyRow(sFakeType, oTable, sPrimaerAttr, sSecondaryAttr, sAttackType = "") {
        const oInnerText = {
            rt_parade: `Standardparade (${sAttackType !== "" ? oClassData.translateSpecialSymbols(oClassData.oTypes.angriffs_typ[sAttackType]) : ""})`,
            rt_initiativ: "Standardinitiative"
        };
        const oDataType = {
            rt_parade: "parades",
            rt_initiativ: "initiative"
        };

        const oRow = oTable.insertRow();
        const oFakeSkill = new Skill(sFakeType);
        oFakeSkill.attackType = sAttackType;
        oFakeSkill.attributeProbePrimary = sPrimaerAttr;
        oFakeSkill.attributeProbeSecondary = sSecondaryAttr;
        oFakeSkill.name = oInnerText[oFakeSkill.realType];

        for (const sOldCellType of this.aOldCells) {
            const oCell = oRow.insertCell();

            if (sOldCellType === "index") {
                oCell.style.textAlign = "right";
            } else if (sOldCellType === "label") {
                oCell.innerText = oInnerText[oFakeSkill.realType];
            }
        }

        for (const sCellType of this.aNewCells) {
            if (sCellType === "numberOfTargets") {
                continue;
            }

            if (oFakeSkill.realType === Skill.oRealTypes.ini && sCellType === "attackType") {
                continue;
            }

            const oCell = oRow.insertCell();

            if (sCellType === "effectThrows") {
                this.createThrowRows(oFakeSkill, null, oCell, oDataType[oFakeSkill.realType]);
            } else if (oFakeSkill.realType === Skill.oRealTypes.parade && sCellType === "attackType") {
                oCell.innerText = oClassData.translateSpecialSymbols(oClassData.oTypes.angriffs_typ[sAttackType]);
            }
        }
    }

    createTableFooter() {
        const oTableFooter = this.oSkillTable.createTFoot();
        const oFooterRow = oTableFooter.insertRow();
        const oHeaderCells = this.oSkillTable.tHead.firstElementChild.cells;
        const oIndexCell = this.oElements.oTh.cloneNode();
        const oLabelCell = this.oElements.oTh.cloneNode();
        const oRankCell = this.oElements.oTh.cloneNode();
        const oCostCell = this.oElements.oTh.cloneNode();

        oFooterRow.className = "header";
        oIndexCell.innerText = "";
        oLabelCell.innerHTML = oHeaderCells[1].innerHTML;
        oRankCell.innerHTML = oHeaderCells[2].innerHTML;
        oCostCell.colSpan = 2;
        oCostCell.innerText = oHeaderCells[3].innerText;

        oFooterRow.appendChild(oIndexCell);
        oFooterRow.appendChild(oLabelCell);
        oFooterRow.appendChild(oRankCell);
        oFooterRow.appendChild(oCostCell);

        for (const sNewCellType of this.aNewCells) {
            const oNewCell = this.oElements.oTh.cloneNode();
            oNewCell.innerText = this.oCellTypeLabel[sNewCellType];
            oNewCell.dataset[this.oDataSets.cellType.js] = this.oCellTypeNames[sNewCellType];
            oFooterRow.appendChild(oNewCell);
        }
    }

    /******************
     * Event listener *
     ******************/

    /**
     *
     */
    eventListener() {
        let blIsParadesAppended = false;
        let blIsInitiativeAppended = false;

        document.querySelector(".tab").addEventListener("click", e => {
            const sTabKey = e.target.dataset[this.oDataSets.tabs.js];

            if (sTabKey) {
                this.updateRows(sTabKey);
                this.unselectActiveTab();
                this.selectTab(sTabKey);

                blIsParadesAppended = this.updateExtraTBody(sTabKey, "rt_parade", blIsParadesAppended, this.oTableBodyParades);
                blIsInitiativeAppended = this.updateExtraTBody(sTabKey, "rt_initiativ", blIsInitiativeAppended, this.oTableBodyInitiative);
            }
        });

        this.oSkillTable.addEventListener("change", e => {
            this.updateThrowCell(e.target);
        });
    }
}

class oSkillsOptimizerData {
    aHitTypes = ["et_erfolg", "et_gut", "et_kritisch"];
    /**
     *
     * @type {{sTypes: string, sItemClasses: string, sClass: string, sSkillClasses: string}}
     */
    oStorageKeys = {
        sSkillClasses: "wodSkillOptimizerSkillClasses",
        sItemClasses: "wodSkillOptimizerItemClasses",
        sTypes: "wodSkillOptimizerTypes",
        sClass: "wodSkillOptimizerClass",
        sClassPlain: "wodSkillOptimizerClassPlain"
    };
    oPowerUpBoTypes = {
        base: "bo_wert",
        percentage: "bo_prozent",
        level: "bo_stufen_faktor",
        skill: "bo_wirkt_faktor",
    };
    oPowerUpEffectType = {
        sActive: "wirkt_bei_anwendung",
        sPassive: "wirkt_immer",
        sClass: ""
    };
    oPowerUpDamageEffectType = {
        sTrigger: "sw_hinzufuegen",
        sDamageZ: "sw_erhoehen"
    };
    oPowerUpSOLabel = {
        sFrom: "wod_SO_powerup_von",
        sSkillRank: "wod_SO_powerup_skill_rang",
    };
    oPowerUpApiKeys = {
        sAttacks: "pt_angriff",
        sAttributes: "pt_attribut",
        sDrops: "pt_drop",
        sParades: "pt_parade",
        sArmors: "pt_ruestung",
        sDamages: "pt_schaden",
        sDamagesZ: "pt_schaden_z",
        sDamageFactors: "pt_schadens_faktor",
        sSkillRanks: "pt_talent",
        sSkillsEffect: "pt_wirkung",
    };
    /**
     * @type {powerups}
     */
    oPowerUps = {
        pt_angriff: [],
        pt_attribut: [],
        pt_drop: [],
        pt_parade: [],
        pt_ruestung: [],
        pt_schaden: [],
        pt_schaden_z: [],
        pt_schadens_faktor: [],
        pt_talent: [],
        pt_wirkung: [],
    };
    oMessages = {
        sSetCacheError: "Set-Probleme entdeckt! Bitte einmal Geschlecht ändern oder Held wechseln.",
        sNewDataError: "Neue Daten entdeckt. Bitte Seite neu laden",
    };
    /**
     *
     * @type {types}
     */
    oTypes = {};
    /**
     * @type {Object<fetch_item_class>}
     */
    oItemClasses = {};
    /**
     * @property {attributes} attributes
     * @property {pt_powerup[]} powerups powerups from equipments and attributs, but not folk or class
     */
    oAttributes = {};
    /**
     * @property {{id: string, label: string, powerups: powerups}} class
     * @property {{id: string, label: string, powerups: powerups}} race
     */
    oClass = {};
    /**
     * @type {Object}
     * @property {items[]} items
     */
    oItems = {};
    /**
     * instance_id = individual id of item, template_id = shared id of all items of the same name
     * @type {Object<Item>}
     */
    oItemsByInstanceId = {};
    /**
     * @type {Array<skills>}
     */
    aSkills = [];
    /**
     * @type {Object<skills>}
     */
    oSkillsByName = {};
    /**
     * @type {Object<skills[]>}
     */
    oSkillsById = {};
    /**
     * @type {Object}
     */
    oSkillClasses = {};
    /**
     * @type {Object}
     * @property {Object} monument
     * @property {string} monument.id
     * @property {string} monument.label
     * @property {powerups[]} monument.powerups
     */
    oMonument = {};
    /**
     * @type {Object}
     */
    oSets = {};
    oSetValues = {};
    blClassPlain = true;
    sAllAttackTypKey = "alle";

    constructor() {
    }

    /**
     * get saved permanent data or fetch them if not yet existent
     * @param {string} sStorageKey
     * @param {string} sFetchType
     * @param {boolean} blAssignObjectClasses
     * @param blMultiLayer
     * @param sLayerKey
     * @return {Promise<Awaited<*>>}
     */
    getValues(sStorageKey, sFetchType, blAssignObjectClasses = true, blMultiLayer = false, sLayerKey) {
        let oPromiseReturn;

        if (!this.hasData(sStorageKey)) {
            oPromiseReturn = new Promise(oResolve => {
                this.fetchFromApi(sFetchType).then(oResponseObject => {
                    let oValues = oResponseObject;

                    if (blAssignObjectClasses) {
                        oValues = this.reassignObjectArrayToObject(oResponseObject[sFetchType]);
                    }
                    oResolve(oValues);
                });
            });
        } else {
            let oLoadData = this.loadData(sStorageKey);

            this.fetchFromApi(sFetchType).then(oResponseObject => {
                let oValues = oResponseObject;
                let iSavedDataLength = Object.keys(oLoadData).length;
                let oSaveData;

                if (blAssignObjectClasses) {
                    if (!blMultiLayer) {
                        oSaveData = this.reassignObjectArrayToObject(oValues[sFetchType]);
                    } else {
                        oSaveData = oValues[sFetchType];
                    }
                } else {
                    oSaveData = oValues;

                    if (blMultiLayer && oLoadData[sLayerKey]) {
                        iSavedDataLength = Object.keys(oLoadData[sLayerKey]).length;
                    }
                }

                if (iSavedDataLength !== Object.keys(oSaveData).length) {
                    this.saveData(sStorageKey, oSaveData);
                    oClassLayout.addMessage(this.oMessages.sNewDataError);
                }
            });

            if (!blMultiLayer) {
                oPromiseReturn = Promise.resolve(oLoadData);
            } else {
                if (oLoadData[sLayerKey]) {
                    oPromiseReturn = Promise.resolve(oLoadData[sLayerKey]);
                } else {
                    return this.getValues("false", sFetchType, blAssignObjectClasses, blMultiLayer, sLayerKey)
                }
            }
        }

        return oPromiseReturn;
    }

    hasData(sKey) {
        return localStorage.hasOwnProperty(sKey);
    }

    saveData(sKey, mData, blMultiLayer = false, sNewLayerKey) {
        if (!blMultiLayer) {
            return localStorage.setItem(sKey, JSON.stringify(mData));
        }

        let oSavedData = this.loadData(sKey);

        if (!oSavedData) {
            oSavedData = {};
        }

        oSavedData[sNewLayerKey] = mData;

        return localStorage.setItem(sKey, JSON.stringify(oSavedData));
    }

    loadData(sKey) {
        return JSON.parse(localStorage.getItem(sKey));
    }

    fetchFromApi(sType = "skills", sParamFormat = "json") {
        let sFormat = sParamFormat;

        return fetch(`${location.origin}/wod/spiel/hero/data.php?what=${sType}&type=${sFormat}"`).then(oResponse => {
            if (oResponse.ok) {
                if (sParamFormat === "text" || sFormat === "text") {
                    return oResponse.text();
                } else {
                    return oResponse.json();
                }
            } else {
                throw new Error(oResponse.statusText);
            }
        }).catch(oError => {
            console.error(sType, oError);
        });
    }

    /**
     *
     * @param {Array<Object>} aArray
     */
    reassignObjectArrayToObject(aArray) {
        let oReturnObject = {};
        /**
         * @property {string} oObject.id
         * @property {string} oObject.name
         * @property {string} [oObject.max_items]
         * @property {Object} [oObject.powerups]
         */
        for (let oObject of aArray) {
            oReturnObject[oObject.id] = {
                "id": oObject.id,
                "name": oObject.name
            };

            if (typeof oObject.max_items !== "undefined") {
                oReturnObject[oObject.id]["maxItems"] = oObject.max_items;
            }
        }

        return oReturnObject;
    }

    orderSkill(Skill) {
        this.oSkillsByName[Skill.template.label] = Skill;
        this.oSkillsById[Skill.template_id] = Skill;
    }

    orderSets(aSets) {
        let oReturnOrderSets = {};

        for (let oSet of aSets) {
            oReturnOrderSets[oSet.id] = oSet;
            oReturnOrderSets[oSet.id].items = [];
        }

        return oReturnOrderSets;
    };

    getSetPowerUps() {
        let oActiveSets = this.getActiveSets();

        console.log("oActiveSets", oActiveSets);

        try {
            for (let [sSetId, oSetPowerUps] of Object.entries(oActiveSets)) {
                const sSetName = this.oSets[sSetId].name;

                this.oSetValues[sSetId] = this.getActiveSetsBonus(oSetPowerUps, sSetName);
            }
        } catch (sError) {
            console.warn(sError);
            oClassLayout.addMessage(this.oMessages.sSetCacheError);
        }

        console.log("oActiveSets setValues", this.oSetValues);
    };

    getActiveSets() {
        let oSets = {};

        for (let [sSetId, oSet] of Object.entries(this.oSets)) {
            if (oSet.items.length <= 0) {
                return;
            }

            for (let aPtOb of Object.values(oSet.owner_powerups)) {
                for (let oAttribute of aPtOb) {
                    let iFrom = parseInt(oAttribute.from_count);
                    let iTo = parseInt(oAttribute.to_count);

                    if (oSet.items.length >= iFrom && oSet.items.length <= iTo) {
                        const {sSubKey, sLabel} = this.getBonusKeyAndLabel(oAttribute);
                        let sPowerUpType = this.assignCorrectPtKey(oAttribute);

                        if (!oSets[sSetId]) {
                            oSets[sSetId] = {};
                        }

                        if (!oSets[sSetId][sPowerUpType]) {
                            oSets[sSetId][sPowerUpType] = {};
                        }

                        oAttribute.wod_SO_powerup_von = oSet.name;
                        oAttribute.wod_SO_name = this.translateSpecialSymbols(sLabel);

                        if (!oSets[sSetId][sPowerUpType][sSubKey]) {
                            oSets[sSetId][sPowerUpType][sSubKey] = [];
                        }

                        oSets[sSetId][sPowerUpType][sSubKey].push(oAttribute);
                    }
                }
            }
        }

        return oSets;
    }

    getActiveSetsBonus(oSetPowerUps, sSetName) {
        let oRawSetBonus = {};

        for (let [sPtType, oPtType] of Object.entries(oSetPowerUps)) {
            let blTripleValueBonus = this.isTripleValueBonus(sPtType);

            if (!oRawSetBonus[sPtType]) {
                oRawSetBonus[sPtType] = {};
            }

            for (let [sSubType, aSubTypes] of Object.entries(oPtType)) {
                let aAttackTypes = [];
                let oNormalHits = {};
                let oGoodHits = {};
                let oCriticalHits = {};

                if (!blTripleValueBonus) {
                    if (!oRawSetBonus[sPtType][sSubType]) {
                        oRawSetBonus[sPtType][sSubType] = this.bonusAndDetailTemplate({
                            blIsTripleValue: blTripleValueBonus,
                            sPtType: sPtType,
                            mSkillClass: aSubTypes[0].talent_klasse,
                            sLabel: aSubTypes[0].wod_SO_name
                        });
                    }

                    oRawSetBonus[sPtType][sSubType] = this.setSetDetails(oRawSetBonus[sPtType][sSubType], aSubTypes, {
                        blDebug: false,
                        blIsTripleValue: blTripleValueBonus
                    });
                } else {
                    // sSubType = damage type key i.e. st_feuer_schaden
                    // aSubTypes = array of damage type powerups
                    if (!oRawSetBonus[sPtType][sSubType]) {
                        oRawSetBonus[sPtType][sSubType] = {};
                    }

                    for (let oDamageTypeObject of aSubTypes) {
                        let sAttackType = oDamageTypeObject.angriffs_typ || this.sAllAttackTypKey;

                        if (!aAttackTypes.includes(sAttackType)) {
                            aAttackTypes.push(sAttackType);

                            oNormalHits[sAttackType] = [];
                            oGoodHits[sAttackType] = [];
                            oCriticalHits[sAttackType] = [];

                            oRawSetBonus[sPtType][sSubType][sAttackType] = this.bonusAndDetailTemplate({blBonus: false});

                            for (let oHitType of this.aHitTypes) {
                                if (!oRawSetBonus[sPtType][sSubType][sAttackType][oHitType]) {
                                    oRawSetBonus[sPtType][sSubType][sAttackType][oHitType] = this.bonusAndDetailTemplate({
                                        sPtType: sPtType,
                                        mSkillClass: aSubTypes[0].talent_klasse,
                                        sLabel: aSubTypes[0].wod_SO_name,
                                        blDetails: false
                                    });
                                }
                            }
                        }

                        switch (oDamageTypeObject.erfolgs_typ) {
                            case "et_erfolg":
                                oNormalHits[sAttackType].push(oDamageTypeObject);
                                break;
                            case "et_gut":
                                oGoodHits[sAttackType].push(oDamageTypeObject);
                                break;
                            case "et_kritisch":
                                oCriticalHits[sAttackType].push(oDamageTypeObject);
                                break;
                        }
                    }

                    for (let sAttackType of aAttackTypes) {
                        oRawSetBonus[sPtType][sSubType][sAttackType][this.aHitTypes[0]] = this.setSetDetails(oRawSetBonus[sPtType][sSubType][sAttackType][this.aHitTypes[0]], oNormalHits[sAttackType], {
                            blDebug: false,
                            blIsTripleValue: blTripleValueBonus
                        });

                        oRawSetBonus[sPtType][sSubType][sAttackType][this.aHitTypes[1]] = this.setSetDetails(oRawSetBonus[sPtType][sSubType][sAttackType][this.aHitTypes[1]], oGoodHits[sAttackType], {
                            blDebug: false,
                            blIsTripleValue: blTripleValueBonus
                        });

                        oRawSetBonus[sPtType][sSubType][sAttackType][this.aHitTypes[2]] = this.setSetDetails(oRawSetBonus[sPtType][sSubType][sAttackType][this.aHitTypes[2]], oCriticalHits[sAttackType], {
                            blDebug: false,
                            blIsTripleValue: blTripleValueBonus
                        });

                        let sDetailString = `${sSetName}: `;
                        let oNormalBonus = oRawSetBonus[sPtType][sSubType][sAttackType][this.aHitTypes[0]].bonus;
                        let oGoodBonus = oRawSetBonus[sPtType][sSubType][sAttackType][this.aHitTypes[1]].bonus;
                        let oCriticalBonus = oRawSetBonus[sPtType][sSubType][sAttackType][this.aHitTypes[2]].bonus;
                        let oNewBonus = this.updateSetTripleBonus(sPtType, oNormalBonus, oGoodBonus, oCriticalBonus);

                        oRawSetBonus[sPtType][sSubType][sAttackType][this.aHitTypes[0]].bonus = oNewBonus[this.aHitTypes[0]].bonus;
                        oRawSetBonus[sPtType][sSubType][sAttackType][this.aHitTypes[1]].bonus = oNewBonus[this.aHitTypes[1]].bonus;
                        oRawSetBonus[sPtType][sSubType][sAttackType][this.aHitTypes[2]].bonus = oNewBonus[this.aHitTypes[2]].bonus;

                        sDetailString += this.createTripleSetDetailString(sPtType, oNewBonus, aSubTypes);
                        oRawSetBonus[sPtType][sSubType][sAttackType].details.push(sDetailString);
                    }
                }
            }
        }

        return oRawSetBonus;
    }

    setSetDetails(oRawSetBonus, aSubTypes, oOption) {
        for (let oSubType of aSubTypes) {
            oRawSetBonus = this.extractBonusValueFromBonus(oRawSetBonus, oSubType, oOption);
        }

        return oRawSetBonus;
    }

    updateSetTripleBonus(sPtType, oNormalBonus, oGoodBonus, oCriticalBonus) {
        const oReturn = {};

        for (let sHitType of this.aHitTypes) {
            oReturn[sHitType] = this.bonusAndDetailTemplate();
        }
        //@todo check other types
        switch (sPtType) {
            case this.oPowerUpApiKeys.sArmors:
            case this.oPowerUpApiKeys.sDamageFactors:
                oReturn[this.aHitTypes[0]].bonus.flBase = oCriticalBonus.flBase + oGoodBonus.flBase + oNormalBonus.flBase;
                oReturn[this.aHitTypes[0]].bonus.flHero = oCriticalBonus.flHero + oGoodBonus.flHero + oNormalBonus.flHero;
                oReturn[this.aHitTypes[0]].bonus.flSkill = oCriticalBonus.flSkill + oGoodBonus.flSkill + oNormalBonus.flSkill;

                oReturn[this.aHitTypes[1]].bonus.flBase = oCriticalBonus.flBase + oGoodBonus.flBase;
                oReturn[this.aHitTypes[1]].bonus.flHero = oCriticalBonus.flHero + oGoodBonus.flHero;
                oReturn[this.aHitTypes[1]].bonus.flSkill = oCriticalBonus.flSkill + oGoodBonus.flSkill;

                oReturn[this.aHitTypes[2]].bonus.flBase = oCriticalBonus.flBase;
                oReturn[this.aHitTypes[2]].bonus.flHero = oCriticalBonus.flHero;
                oReturn[this.aHitTypes[2]].bonus.flSkill = oCriticalBonus.flSkill;

                oReturn[this.aHitTypes[0]].bonus.flTotal = oReturn[this.aHitTypes[0]].bonus.flBase + oReturn[this.aHitTypes[0]].bonus.flHero + oReturn[this.aHitTypes[0]].bonus.flSkill;
                oReturn[this.aHitTypes[1]].bonus.flTotal = oReturn[this.aHitTypes[1]].bonus.flBase + oReturn[this.aHitTypes[1]].bonus.flHero + oReturn[this.aHitTypes[1]].bonus.flSkill;
                oReturn[this.aHitTypes[2]].bonus.flTotal = oReturn[this.aHitTypes[2]].bonus.flBase + oReturn[this.aHitTypes[2]].bonus.flHero + oReturn[this.aHitTypes[2]].bonus.flSkill;

                oReturn[this.aHitTypes[0]].bonus.percentage.flEffective = oCriticalBonus.percentage.flEffective * oGoodBonus.percentage.flEffective * oNormalBonus.percentage.flEffective;
                oReturn[this.aHitTypes[1]].bonus.percentage.flEffective = oCriticalBonus.percentage.flEffective * oGoodBonus.percentage.flEffective;
                oReturn[this.aHitTypes[2]].bonus.percentage.flEffective = oCriticalBonus.percentage.flEffective;
                break;
            case this.oPowerUpApiKeys.sDamages:
            case this.oPowerUpApiKeys.sDamagesZ:
                oReturn[this.aHitTypes[0]].bonus.flBase = oNormalBonus.flBase;
                oReturn[this.aHitTypes[0]].bonus.flHero = oNormalBonus.flHero;
                oReturn[this.aHitTypes[0]].bonus.flSkill = oNormalBonus.flSkill;

                oReturn[this.aHitTypes[1]].bonus.flBase = oNormalBonus.flBase + oGoodBonus.flBase;
                oReturn[this.aHitTypes[1]].bonus.flHero = oNormalBonus.flHero + oGoodBonus.flHero;
                oReturn[this.aHitTypes[1]].bonus.flSkill = oNormalBonus.flSkill + oGoodBonus.flSkill;

                oReturn[this.aHitTypes[2]].bonus.flBase = oNormalBonus.flBase + oGoodBonus.flBase + oCriticalBonus.flBase;
                oReturn[this.aHitTypes[2]].bonus.flHero = oNormalBonus.flHero + oGoodBonus.flHero + oCriticalBonus.flHero;
                oReturn[this.aHitTypes[2]].bonus.flSkill = oNormalBonus.flSkill + oGoodBonus.flSkill + oCriticalBonus.flSkill;

                oReturn[this.aHitTypes[0]].bonus.flTotal = oReturn[this.aHitTypes[0]].bonus.flBase + oReturn[this.aHitTypes[0]].bonus.flHero + oReturn[this.aHitTypes[0]].bonus.flSkill;
                oReturn[this.aHitTypes[1]].bonus.flTotal = oReturn[this.aHitTypes[1]].bonus.flBase + oReturn[this.aHitTypes[1]].bonus.flHero + oReturn[this.aHitTypes[1]].bonus.flSkill;
                oReturn[this.aHitTypes[2]].bonus.flTotal = oReturn[this.aHitTypes[2]].bonus.flBase + oReturn[this.aHitTypes[2]].bonus.flHero + oReturn[this.aHitTypes[2]].bonus.flSkill;

                oReturn[this.aHitTypes[0]].bonus.percentage.flEffective = oNormalBonus.percentage.flEffective;
                oReturn[this.aHitTypes[1]].bonus.percentage.flEffective = oNormalBonus.percentage.flEffective * oGoodBonus.percentage.flEffective;
                oReturn[this.aHitTypes[2]].bonus.percentage.flEffective = oNormalBonus.percentage.flEffective * oGoodBonus.percentage.flEffective * oCriticalBonus.percentage.flEffective;
                break;
        }

        oReturn[this.aHitTypes[0]].bonus.percentage.iLabel = this.setILabel(oReturn[this.aHitTypes[0]].bonus.percentage.flEffective);
        oReturn[this.aHitTypes[1]].bonus.percentage.iLabel = this.setILabel(oReturn[this.aHitTypes[1]].bonus.percentage.flEffective);
        oReturn[this.aHitTypes[2]].bonus.percentage.iLabel = this.setILabel(oReturn[this.aHitTypes[2]].bonus.percentage.flEffective);

        return oReturn;
    }

    /**
     *
     * @param sPtType
     * @param oNewBonus
     * @param {Array<pt_powerup>} aSetBonusObjects
     * @return {string}
     */
    createTripleSetDetailString(sPtType, oNewBonus, aSetBonusObjects) {
        let sReturnString = "";
        let sNormalString, sGoodString, sCriticalString
        let oNormalHitValues = objectStructure();
        let oGoodHitValues = objectStructure();
        let oCriticalHitValues = objectStructure();
        let oNormalCombinedValues = objectStructure();
        let oGoodCombinedValues = objectStructure();
        let oCriticalCombinedValues = objectStructure();

        for (let oSetBonusObject of aSetBonusObjects) {
            switch (oSetBonusObject.erfolgs_typ) {
                case this.aHitTypes[0]:
                    oNormalHitValues = addToValues(oNormalHitValues, oSetBonusObject.bonus_typ, oSetBonusObject.bonus_wert);
                    break;
                case this.aHitTypes[1]:
                    oGoodHitValues = addToValues(oGoodHitValues, oSetBonusObject.bonus_typ, oSetBonusObject.bonus_wert);
                    break;
                case this.aHitTypes[2]:
                    oCriticalHitValues = addToValues(oCriticalHitValues, oSetBonusObject.bonus_typ, oSetBonusObject.bonus_wert);
                    break;
            }
        }

        switch (sPtType) {
            case this.oPowerUpApiKeys.sDamages:
            case this.oPowerUpApiKeys.sDamagesZ:
                oNormalCombinedValues = oNormalHitValues;
                oGoodCombinedValues = {
                    level: oNormalHitValues.level + oGoodHitValues.level,
                    skill: oNormalHitValues.skill + oGoodHitValues.skill,
                };
                oCriticalCombinedValues = {
                    level: oNormalHitValues.level + oGoodHitValues.level + oCriticalHitValues.level,
                    skill: oNormalHitValues.skill + oGoodHitValues.skill + oCriticalHitValues.skill,
                };
                break;
            case this.oPowerUpApiKeys.sArmors:
            case this.oPowerUpApiKeys.sDamageFactors:
                oNormalCombinedValues = {
                    level: oCriticalHitValues.level + oGoodHitValues.level + oNormalHitValues.level,
                    skill: oCriticalHitValues.skill + oGoodHitValues.skill + oNormalHitValues.skill,
                };
                oGoodCombinedValues = {
                    level: oCriticalHitValues.level + oGoodHitValues.level,
                    skill: oCriticalHitValues.skill + oGoodHitValues.skill,
                };
                oCriticalCombinedValues = oCriticalHitValues;
                break;
        }

        sNormalString = detailStringPart(oNewBonus[this.aHitTypes[0]].bonus, oNormalCombinedValues);
        sGoodString = detailStringPart(oNewBonus[this.aHitTypes[1]].bonus, oGoodCombinedValues);
        sCriticalString = detailStringPart(oNewBonus[this.aHitTypes[2]].bonus, oCriticalCombinedValues);

        if (sNormalString === "") {
            sNormalString = "0";
        }

        if (sGoodString === "") {
            sGoodString = "0";
        }

        if (sCriticalString === "") {
            sCriticalString = "0";
        }

        sReturnString += `${sNormalString} / ${sGoodString} / ${sCriticalString}`;

        function objectStructure() {
            return {
                level: 0,
                skill: 0
            };
        }

        function addToValues(oHitValues, sSetBonusType, sSetBonusValue) {
            switch (sSetBonusType) {
                case oClassData.oPowerUpBoTypes.level:
                    oHitValues.level += parseInt(sSetBonusValue);
                    break;
                case oClassData.oPowerUpBoTypes.skill:
                    oHitValues.skill += parseInt(sSetBonusValue);
                    break;
            }

            return oHitValues;
        }

        function detailStringPart(oNewBonus, oCombinedLevelSkill) {
            let sReturnString = "";

            if (oNewBonus.flBase !== 0) {
                sReturnString += `${oClassData.prefacePlus(oNewBonus.flBase)}`;
            }

            if (oNewBonus.percentage.iLabel !== 0) {
                sReturnString += `${oClassData.prefacePlus(oNewBonus.percentage.iLabel)}%`;
            }

            if (oCombinedLevelSkill.level !== 0) {
                sReturnString += `${oClassData.prefacePlus(oCombinedLevelSkill.level)}% HS`;
            }

            if (oCombinedLevelSkill.skill !== 0) {
                sReturnString += `${oClassData.prefacePlus(oCombinedLevelSkill.skill)}% FR`;
            }

            return sReturnString;
        }

        return sReturnString;
    }

    /**
     *
     * @param {pt_powerup[]} aPowerUps
     * @param {string} sPowerUpFrom - name of skill, item, monument, class or race
     * @param {Object} [oOptions] - iSkillLevel for skills<br />blDebug for console logs
     * @param {Number} [oOptions.iSkillLevel]
     * @param {boolean} [oOptions.blDebug]
     */
    assignPowerUps(aPowerUps, sPowerUpFrom = "", oOptions) {
        if (typeof oOptions.iSkillLevel !== "undefined" && oOptions.iSkillLevel === 0) {
            return;
        }

        if (sPowerUpFrom !== "" || oOptions.iSkillLevel >= 0) {
            for (let oPowerUp of aPowerUps) {
                let sPtKey = this.assignCorrectPtKey(oPowerUp);

                if (sPtKey === this.oPowerUpApiKeys.sSkillRanks) {
                    continue;
                }

                if (oPowerUp.bonus_wert === 0 || oPowerUp.bonus_wert === "0") {
                    continue;
                }

                if (sPowerUpFrom !== "") {
                    oPowerUp[this.oPowerUpSOLabel.sFrom] = sPowerUpFrom;
                }

                if (oOptions.iSkillLevel >= 0) {
                    oPowerUp[this.oPowerUpSOLabel.sSkillRank] = oOptions.iSkillLevel;
                }

                if (oOptions.blDebug) {
                    console.log("assignPowerUps", sPtKey, oPowerUp, sPowerUpFrom);
                }

                if (!this.oPowerUps[sPtKey]) {
                    this.oPowerUps[sPtKey] = [];
                }

                this.oPowerUps[sPtKey].push(oPowerUp);
            }
        }
    }

    /**
     *
     * @param {string} sPtType - pt_type of the calling bonus table
     * @param {Object} oBonusTableValues - values of a bonus table, ie Attack, Attribute or Armor table
     * @return {*}
     */
    applySetBoniToPowerUps(sPtType, oBonusTableValues) {
        let blIsTripleValueBonus = this.isTripleValueBonus(sPtType);

        for (let [sSetId, oSetPowerUps] of Object.entries(this.oSetValues)) {
            // set doesn't have boni for calling bonus table
            if (!oSetPowerUps[sPtType]) {
                console.log(`fixHeroPowerUp set ${sSetId} no ${sPtType}`);
                continue;
            }

            for (let [sSubKey, oSetSubObject] of Object.entries(oSetPowerUps[sPtType])) {
                try {
                    if (blIsTripleValueBonus) {
                        for (let [sAttackType, oSetAttackTypeDamageType] of Object.entries(oSetSubObject)) {
                            for (let sHitType of this.aHitTypes) {
                                oBonusTableValues[sSubKey][sAttackType][sHitType].bonus = this.removeSetBonusOnItem(oBonusTableValues[sSubKey][sAttackType][sHitType].bonus, oSetAttackTypeDamageType[sHitType], sSetId);
                            }

                            oBonusTableValues[sSubKey][sAttackType].details = this.removeSetTripleBonusOnItemDetailString(oBonusTableValues[sSubKey][sAttackType].details, oSetAttackTypeDamageType.details[0], sSetId);
                            oBonusTableValues[sSubKey][sAttackType].details.push(oSetAttackTypeDamageType.details[0]);
                        }
                    } else {
                        oBonusTableValues[sSubKey].bonus = this.removeSetBonusOnItem(oBonusTableValues[sSubKey].bonus, oSetSubObject, sSetId);
                        oBonusTableValues[sSubKey].details = this.removeSetBonusOnItemDetailString(oBonusTableValues[sSubKey].details, oSetSubObject.details[0], sSetId);
                        // add set to detail list
                        oBonusTableValues[sSubKey].details.push(oSetSubObject.details[0]);
                    }
                } catch (sError) {
                    console.warn(sError);
                    oClassLayout.addMessage(this.oMessages.sSetCacheError);
                }
            }
        }

        return oBonusTableValues;
    }

    removeSetBonusOnItem(oItemBonus, oSetSubObject, sSetId) {
        let oSetBonusObject = oSetSubObject.bonus;

        for (let sBonusKey of Object.keys(oItemBonus)) {
            if (sBonusKey === "percentage") {
                if (oSetBonusObject[sBonusKey].flEffective !== 1) {
                    oItemBonus[sBonusKey].flEffective /= Math.pow(oSetBonusObject[sBonusKey].flEffective, this.oSets[sSetId].items.length - 1);
                    oItemBonus[sBonusKey].flEffective = Math.trunc(oItemBonus[sBonusKey].flEffective * 100) / 100;
                    oItemBonus[sBonusKey].iLabel = this.setILabel(oItemBonus[sBonusKey].flEffective);
                }
            } else {
                if (oSetBonusObject[sBonusKey] !== 0) {
                    oItemBonus[sBonusKey] -= oSetBonusObject[sBonusKey] * (this.oSets[sSetId].items.length - 1);
                }
            }
        }

        oItemBonus.flTotal = this.setBonusTotal(oItemBonus);

        return oItemBonus;
    }

    removeSetBonusOnItemDetailString(aBonusDetails, sSetBonusDetail, sSetId) {
        let oRegEx = new RegExp(/^(?<item>.*): (?<base>[+-][0-9]{1,3})?\s?(?<perc>[-+][0-9]{1,3}%)?\s?(?<level>[+-][0-9]{0,3}(% )?HS)?\s?(?<skill>[+-][0-9]{0,3}(% )?FR)?$/, "gm");
        let aSetPowerUps = [...sSetBonusDetail.matchAll(oRegEx)];

        for (let oSetItem of this.oSets[sSetId].items) {
            let iIndex = aBonusDetails.findIndex(sDetail => {
                return sDetail.includes(`${oSetItem.template.name}`);
            });

            try {
                let aItemPowerUp = [...aBonusDetails[iIndex].matchAll(oRegEx)];
                let sNewDetailString = `${oSetItem.template.name}: `;
                sNewDetailString += this.updateDetailString(aSetPowerUps[0].groups.base, aItemPowerUp[0].groups.base, "base");
                sNewDetailString += this.updateDetailString(aSetPowerUps[0].groups.perc, aItemPowerUp[0].groups.perc, "perc");
                sNewDetailString += this.updateDetailString(aSetPowerUps[0].groups.level, aItemPowerUp[0].groups.level, "level");
                sNewDetailString += this.updateDetailString(aSetPowerUps[0].groups.skill, aItemPowerUp[0].groups.skill, "skill");

                if (sNewDetailString !== `${oSetItem.template.name}: `) {
                    aBonusDetails[iIndex] = sNewDetailString;
                } else {
                    aBonusDetails.splice(iIndex, 1);
                }
            } catch (sError) {
                console.warn(sError);
                oClassLayout.addMessage(this.oMessages.sSetCacheError);
            }
        }

        return aBonusDetails;
    }

    removeSetTripleBonusOnItemDetailString(aPowerUpDetailStrings, sSetBonusDetail, sSetId) {
        let oRegExWithoutName = new RegExp(/^(?<base>[+-]?[0-9]{1,3})?\s?(?<perc>[-+][0-9]{1,3}%)?\s?(?<level>[+-][0-9]{0,3}(% )?HS)?\s?(?<skill>[+-][0-9]{0,3}(% )?FR)?$/, "gm");
        let sSetDetailWithoutName = sSetBonusDetail.replace(/.*:\s/gm, "");
        let aSplitSetValues = sSetDetailWithoutName.split("/");
        let aSetValues = [];

        for (let iSetIndex in aSplitSetValues) {
            aSetValues[iSetIndex] = [...aSplitSetValues[iSetIndex].trim().matchAll(oRegExWithoutName)][0];
        }

        for (let oSetItem of this.oSets[sSetId].items) {
            let iIndex = aPowerUpDetailStrings.findIndex(sDetail => {
                return sDetail.includes(`${oSetItem.template.name}`);
            });

            try {
                let sDetailStringWithoutItemName = aPowerUpDetailStrings[iIndex].replace(`${oSetItem.template.name}: `, "");
                let aItemSplit = sDetailStringWithoutItemName.split("/");
                let sNewDetailString = `${oSetItem.template.name}: `;

                for (let iItemValueIndex in aItemSplit) {
                    let aItemPowerUp = [...aItemSplit[iItemValueIndex].trim().matchAll(oRegExWithoutName)];
                    let sNewPartialDetailString = "";

                    sNewPartialDetailString += this.updateDetailString(aSetValues[iItemValueIndex].groups.base, aItemPowerUp[0].groups.base, "base");
                    sNewPartialDetailString += this.updateDetailString(aSetValues[iItemValueIndex].groups.perc, aItemPowerUp[0].groups.perc, "perc");
                    sNewPartialDetailString += this.updateDetailString(aSetValues[iItemValueIndex].groups.level, aItemPowerUp[0].groups.level, "level");
                    sNewPartialDetailString += this.updateDetailString(aSetValues[iItemValueIndex].groups.skill, aItemPowerUp[0].groups.skill, "skill");

                    if (sNewPartialDetailString === "") {
                        sNewPartialDetailString += "0";
                    }

                    if (iItemValueIndex < 2) {
                        sNewPartialDetailString += " / ";
                    }

                    sNewDetailString += sNewPartialDetailString;
                }

                if (sNewDetailString.includes("0 / 0 / 0")) {
                    aPowerUpDetailStrings.splice(iIndex, 1);
                } else {
                    aPowerUpDetailStrings[iIndex] = sNewDetailString;
                }
            } catch (sError) {
                console.warn(sError);
                oClassLayout.addMessage(this.oMessages.sSetCacheError);
            }
        }

        return aPowerUpDetailStrings;
    }

    updateDetailString(sSetPowerUp, sItemPowerUps, sType) {
        let sNewDetailString = "";
        let flItemPowerUp = parseFloat(sItemPowerUps);
        let flSetPowerUp = parseFloat(sSetPowerUp);
        let flNewValue = flItemPowerUp - flSetPowerUp;

        if (!flSetPowerUp && !sItemPowerUps) {
            return "";

        }
        if (flNewValue === 0) {
            return "";
        }

        if (flItemPowerUp && flSetPowerUp) {
            sNewDetailString += `${this.prefacePlus(flNewValue)}`;
        } else if (flItemPowerUp && !flSetPowerUp) {
            sNewDetailString += this.prefacePlus(flItemPowerUp);
        }

        if (sType !== "base") {
            sNewDetailString += "%";
        }

        switch (sType) {
            case "level":
                sNewDetailString += " HS";
                break;
            case "skill":
                sNewDetailString += " FR";
                break;
        }

        return sNewDetailString;
    }

    getBonusTableAttackValues() {
        let aAttackValues = this.oPowerUps[this.oPowerUpApiKeys.sAttacks].filter(/** @param {pt_powerup} oAttack**/oAttack => {
            return oAttack.wirkungs_art !== this.oPowerUpEffectType.sActive
        });

        return this.getBonusFromPowerUp(aAttackValues, false);
    }

    getBonusTableAttributeValues() {
        let aAttributeValues = this.oPowerUps[this.oPowerUpApiKeys.sAttributes].filter(/** @param {pt_powerup} oAttribute**/oAttribute => {
            return oAttribute.wirkungs_art !== this.oPowerUpEffectType.sActive
        });

        return this.getBonusFromPowerUp(aAttributeValues, false);
    }

    getBonusTableDropValues() {
        let oDropValues = this.oPowerUps[this.oPowerUpApiKeys.sDrops].filter(/** @param {pt_powerup} oDrops **/oDrops => {
            return oDrops.wirkungs_art !== this.oPowerUpEffectType.sActive;
        });

        return this.getBonusFromPowerUp(oDropValues, false);
    }

    getBonusTableParadeValues() {
        let oParadesValues = this.oPowerUps[this.oPowerUpApiKeys.sParades].filter(/** @param {pt_powerup} oParades **/oParades => {
            return oParades.wirkungs_art !== this.oPowerUpEffectType.sActive;
        });

        return this.getBonusFromPowerUp(oParadesValues, false);
    }

    getBonusTableArmorValues() {
        let oArmorValues = this.oPowerUps[this.oPowerUpApiKeys.sArmors].filter(/** @param {pt_powerup} oArmor **/oArmor => {
            return oArmor.wirkungs_art !== this.oPowerUpEffectType.sActive;
        });

        return this.getBonusFromPowerUp(oArmorValues, false);
    }

    getBonusTableDamageValues() {
        let oDamageValues = this.oPowerUps[this.oPowerUpApiKeys.sDamages].filter(/** @param {pt_powerup} oDamage **/oDamage => {
            return oDamage.wirkungs_art !== this.oPowerUpEffectType.sActive;
        });

        return this.getBonusFromPowerUp(oDamageValues, false);
    }

    getBonusTableDamageZValues() {
        let oDamageZValues = this.oPowerUps[this.oPowerUpApiKeys.sDamagesZ].filter(/** @param {pt_powerup} oDamageZ **/oDamageZ => {
            return oDamageZ.wirkungs_art !== this.oPowerUpEffectType.sActive;
        });

        return this.getBonusFromPowerUp(oDamageZValues, false);
    }

    getBonusTableDamageFactorValues() {
        let oDamageFactorValues = this.oPowerUps[this.oPowerUpApiKeys.sDamageFactors].filter(/** @param {pt_powerup} oDamageFactor **/oDamageFactor => {
            return oDamageFactor.wirkungs_art !== this.oPowerUpEffectType.sActive;
        });

        return this.getBonusFromPowerUp(oDamageFactorValues, false);
    }

    getBonusTableSkillEffectValues() {
        let oSkillEffectValues = this.oPowerUps[this.oPowerUpApiKeys.sSkillsEffect].filter(/** @param {pt_powerup} oSkillEffect **/oSkillEffect => {
            return oSkillEffect.wirkungs_art !== this.oPowerUpEffectType.sActive;
        });

        return this.getBonusFromPowerUp(oSkillEffectValues, false);
    }

    /**
     *
     * @param {Array<pt_powerup>} aPtPowerUp
     * @param blDebug
     * @return {bonus_type_details|Array}
     */
    getBonusFromPowerUp(aPtPowerUp, blDebug) {
        if (aPtPowerUp.length === 0) {
            return aPtPowerUp;
        }

        /**
         *
         * @type {bonus_type_details}
         */
        let oReturnBonus = {};

        if (blDebug) {
            console.log("###### getBonusFromPowerUp ######", aPtPowerUp);
        }

        for (let oPowerUp of aPtPowerUp) {
            const sPtType = this.assignCorrectPtKey(aPtPowerUp[0]);
            const blIsTripleValue = this.isTripleValueBonus(sPtType);
            const sTripleAttackType = oPowerUp.angriffs_typ || this.sAllAttackTypKey;
            let {sSubKey, sLabel} = this.getBonusKeyAndLabel(oPowerUp);
            sLabel = this.translateSpecialSymbols(sLabel);

            if (blDebug) {
                console.log("***** oPowerUp *****", oPowerUp);
                console.log("sPtType", sPtType);
                console.log("talentklasse", oPowerUp.talent_klasse);
                console.log("schadens wirkungs art", oPowerUp.schadens_wirkungs_art);
                console.log("isTriple", blIsTripleValue);
                console.log("sSubKey", sSubKey);
                console.log("returnBonus", oReturnBonus);
            }

            if (!blIsTripleValue && !oReturnBonus[sSubKey]) {
                // sSubKey = an_*, at_*, drop, hidden attributes
                oReturnBonus[sSubKey] = this.bonusAndDetailTemplate({
                    sPtType: sPtType,
                    mSkillClass: oPowerUp.talent_klasse,
                    sLabel: sLabel
                })
            }

            if (blIsTripleValue) {
                if (!oReturnBonus[sSubKey]) {
                    // sSubKey = damage typ for armor, damage or damage factor
                    oReturnBonus[sSubKey] = this.bonusAndDetailTemplate({
                        blIsTripleValue: blIsTripleValue,
                        blBonus: false,
                        blDetails: false
                    })
                }

                if (!oReturnBonus[sSubKey][sTripleAttackType]) {
                    let oAttackType = oPowerUp.label_angriffs_typ || this.oTypes.angriffs_typ[oPowerUp.angriffs_typ];
                    oReturnBonus[sSubKey][sTripleAttackType] = this.bonusAndDetailTemplate({
                        blIsTripleValue: blIsTripleValue,
                        sLabel: `${sLabel} (${oAttackType || this.sAllAttackTypKey})`,
                        blBonus: false,
                        blDetails: true
                    });

                    for (let sHitType of this.aHitTypes) {
                        oReturnBonus[sSubKey][sTripleAttackType][sHitType] = this.bonusAndDetailTemplate({
                            sLabel: this.oTypes.erfolgs_typ[sHitType],
                            blDetails: false
                        });
                    }
                }
            }

            if (blDebug) {
                console.log("von/angriffsTyp/bonusWert", oPowerUp.wod_SO_powerup_von, oPowerUp.angriffs_typ, oPowerUp.bonus_wert);
            }

            if (oPowerUp.bonus_typ) {
                // bo-structure, monuments, class_plain
                if (blDebug) {
                    console.log("bobo", oReturnBonus[sSubKey]);
                }

                if (oReturnBonus[sSubKey].blIsTripleValue) {
                    let sDetailString = `${oPowerUp.wod_SO_powerup_von}: `;

                    for (let sHitType of this.aHitTypes) {
                        let flTotal = 0;
                        let iLabel = 0;

                        oReturnBonus[sSubKey][sTripleAttackType][sHitType] = this.extractBonusValueFromBonus(oReturnBonus[sSubKey][sTripleAttackType][sHitType], oPowerUp, {
                            blDebug: false,
                            blIsTripleValue: blIsTripleValue
                        });

                        flTotal = this.setBonusTotal(oReturnBonus[sSubKey][sTripleAttackType][sHitType].bonus);
                        iLabel = oReturnBonus[sSubKey][sTripleAttackType][sHitType].bonus.percentage.iLabel;

                        oReturnBonus[sSubKey][sTripleAttackType][sHitType].bonus.flTotal = flTotal;

                        if (flTotal !== 0) {
                            sDetailString += this.prefacePlus(flTotal);
                        }

                        if (iLabel !== 0) {
                            if (flTotal !== 0) {
                                let sOperator = "";

                                if (iLabel < 0) {
                                    sOperator = "-";
                                } else {
                                    sOperator = "+";
                                }

                                if (flTotal !== 0) {
                                    sOperator = ` ${sOperator} `;
                                }

                                sDetailString += `${sOperator}${Math.abs(iLabel)}`;
                            } else {
                                sDetailString += this.prefacePlus(iLabel);
                            }
                        }

                        if (sHitType !== this.aHitTypes[2]) {
                            sDetailString += " / ";
                        }
                    }

                    oReturnBonus[sSubKey][sTripleAttackType].details.push(this.shortenDetailString(sDetailString));
                } else {
                    oReturnBonus[sSubKey] = this.extractBonusValueFromBonus(oReturnBonus[sSubKey], oPowerUp, {
                        blDebug: blDebug,
                        blIsTripleValue: blIsTripleValue
                    });

                    oReturnBonus[sSubKey].bonus.flTotal = this.setBonusTotal(oReturnBonus[sSubKey].bonus);
                }
            } else if (blIsTripleValue) {
                // values in bonus_wert html-string, 1/1/1, armor, damage, damage factor
                if (blDebug) {
                    console.log("triple entry", oReturnBonus[sSubKey][sTripleAttackType]);
                }

                let oSplits = oPowerUp.bonus_wert.split(/\/[^span]/gm);
                let sDetailString = `${oPowerUp.wod_SO_powerup_von}: `;

                for (let iSplitIndex in oSplits) {
                    let oPowerUpObject = {
                        wod_SO_powerup_von: oPowerUp.wod_SO_powerup_von,
                        wod_SO_powerup_skill_rang: oPowerUp.wod_SO_powerup_skill_rang,
                        bonus_wert: oSplits[iSplitIndex]
                    };
                    if (blDebug) {
                        console.log("triple", sSubKey, sTripleAttackType, this.aHitTypes[iSplitIndex]);
                    }
                    oReturnBonus[sSubKey][sTripleAttackType][this.aHitTypes[iSplitIndex]] = this.extractBonusValueFromItemString(oReturnBonus[sSubKey][sTripleAttackType][this.aHitTypes[iSplitIndex]], oPowerUpObject, {
                        blDebug: blDebug,
                        blIsTripleValue: blIsTripleValue
                    });

                    oReturnBonus[sSubKey][sTripleAttackType][this.aHitTypes[iSplitIndex]].bonus.flTotal = this.setBonusTotal(oReturnBonus[sSubKey][sTripleAttackType][this.aHitTypes[iSplitIndex]].bonus);
                }

                sDetailString += oPowerUp.bonus_wert.replace(/<span class="gem_(malus|bonus)(_(only|also)_by_gem)?">/gm, "").replace(/<\/span>/gm, "");
                oReturnBonus[sSubKey][sTripleAttackType].details.push(this.shortenDetailString(sDetailString));
            } else {
                // values in bonus_wert html-string, single value, class, attacks, parades, drops, attributes
                if (blDebug) {
                    console.log("single", oReturnBonus[sSubKey]);
                }

                oReturnBonus[sSubKey] = this.extractBonusValueFromItemString(oReturnBonus[sSubKey], oPowerUp, {blDebug: blDebug});
                oReturnBonus[sSubKey].bonus.flTotal = this.setBonusTotal(oReturnBonus[sSubKey].bonus);
            }
        }

        return oReturnBonus;
    }

    /**
     *
     * @param oReturnBonusWithBonusKey
     * @param oPowerUp
     * @param oOptions
     * @param sSource
     * @return {bonus}
     */
    extractBonusValueFromBonus(oReturnBonusWithBonusKey, oPowerUp, oOptions, sSource = "powerup") {
        const oTypeKey = {
            "powerup": "bonus_typ",
            "probe": "proben_bonus_typ",
            "effect": "wirk_bonus_typ",
        };
        const oValueKey = {
            "powerup": "bonus_wert",
            "probe": "proben_bonus_wert",
            "effect": "wirk_bonus_wert",
        };
        if (oOptions.blDebug) {
            console.log("bobo extract bonus_typ/wert", oOptions.blIsTripleValue, oPowerUp[oTypeKey[sSource]], oPowerUp[oValueKey[sSource]], oReturnBonusWithBonusKey, oPowerUp);
        }
        let sBonusDetails = "";
        // @todo ganze detail-string geschichte auslagern
        let iDetailIndex = oOptions.blIsTripleValue ? -1 : oReturnBonusWithBonusKey.details.findIndex(sDetail => {
            if (oOptions.blDebug) {
                console.log(`bobo extract: does "${sDetail}" includes "${oPowerUp.wod_SO_powerup_von}"`, sDetail.includes(oPowerUp.wod_SO_powerup_von));
            }
            return sDetail.includes(oPowerUp.wod_SO_powerup_von);
        });

        switch (oPowerUp[oTypeKey[sSource]]) {
            case this.oPowerUpBoTypes.base:
                // base
                oReturnBonusWithBonusKey.bonus.flBase += parseFloat(oPowerUp[oValueKey[sSource]]);
                sBonusDetails = this.prefacePlus(oPowerUp[oValueKey[sSource]]);
                if (oOptions.blDebug) {
                    console.log("bobo extract wert", oPowerUp[oValueKey[sSource]], parseFloat(oPowerUp[oValueKey[sSource]]), this.prefacePlus(oPowerUp[oValueKey[sSource]]), this.prefacePlus(parseFloat(oPowerUp[oValueKey[sSource]])));
                }
                break;
            case this.oPowerUpBoTypes.level:
                // % der heldenstufe
                if (oOptions.blDebug) {
                    console.log("bobo extract stufen_faktor", parseFloat(oPowerUp[oValueKey[sSource]]), parseFloat(oPowerUp[oValueKey[sSource]]) / 100, (parseFloat(oPowerUp[oValueKey[sSource]]) / 100) * oHero.iLevel);
                }
                oReturnBonusWithBonusKey.bonus.flHero += (parseFloat(oPowerUp[oValueKey[sSource]]) / 100) * oHero.iLevel;
                sBonusDetails = this.prefacePlus(oPowerUp[oValueKey[sSource]]) + "% HS";
                break;
            case this.oPowerUpBoTypes.skill:
                // % des fertigkeitenrangs @todo test
                if (oOptions.blDebug) {
                    console.log("bobo extract bo_wirk_faktor", oPowerUp);
                }
                oReturnBonusWithBonusKey.bonus.flSkill += (parseFloat(oPowerUp[oValueKey[sSource]]) / 100) * oPowerUp.wod_SO_powerup_skill_rang;
                sBonusDetails = this.prefacePlus(oPowerUp[oValueKey[sSource]]) + "% FR";
                break;
            case this.oPowerUpBoTypes.percentage:
                // prozentual
                oReturnBonusWithBonusKey.bonus.percentage.flEffective *= parseFloat(oPowerUp[oValueKey[sSource]]) / 100;
                oReturnBonusWithBonusKey.bonus.percentage.iLabel = this.setILabel(oReturnBonusWithBonusKey.bonus.percentage.flEffective);
                sBonusDetails = this.prefacePlus(parseFloat(oPowerUp[oValueKey[sSource]]) - 100) + "%";
                if (oOptions.blDebug) {
                    console.log("bobo extract: percentage: ", oPowerUp[oValueKey[sSource]], parseFloat(oPowerUp[oValueKey[sSource]]) / 100, oReturnBonusWithBonusKey.bonus.percentage.flEffective, oReturnBonusWithBonusKey.bonus.percentage.iLabel);
                }
                break;
            case "bo_wurf":
                // npc, should never ever be set
                console.log("bobo extract bo_wurf", oPowerUp);
                break;
            default:
                console.warn("set, unknown bonus type", oPowerUp.bonus_typ);
        }

        if (!oOptions.blIsTripleValue) {
            if (iDetailIndex >= 0) {
                // depending on incoming order it is possible that bo_wert doesn't come first. for now only seen with Rashani social parades, but who knows...
                if (!sBonusDetails.includes("%")) {
                    let aStringParts = oReturnBonusWithBonusKey.details[iDetailIndex].split(":");

                    if (aStringParts[1]) {
                        if (oOptions.blDebug) {
                            console.log("bobo extract: aStringParts", aStringParts);
                        }
                        if (aStringParts[1].includes("%")) {
                            sBonusDetails = `${this.prefacePlus(parseFloat(sBonusDetails))}${aStringParts[1].trim()}`;
                        } else {
                            sBonusDetails = this.prefacePlus(parseFloat(sBonusDetails) + parseFloat(aStringParts[1].trim()));
                        }

                        if (oOptions.blDebug) {
                            console.log(`bobo extract: change "${oReturnBonusWithBonusKey.details[iDetailIndex]}" to "${aStringParts[0]}: ${sBonusDetails}"`);
                        }
                    } else {
                        if (oOptions.blDebug) {
                            console.log(`bobo extract: add "${sBonusDetails}" to "${oReturnBonusWithBonusKey.details[iDetailIndex]}"`);
                        }
                    }

                    oReturnBonusWithBonusKey.details[iDetailIndex] = `${aStringParts[0]}: ${sBonusDetails}`;
                } else {
                    if (oOptions.blDebug) {
                        console.log(`bobo extract: add "${sBonusDetails}" to "${oReturnBonusWithBonusKey.details[iDetailIndex]}"`);
                    }

                    if (oReturnBonusWithBonusKey.details[iDetailIndex].includes("% HS") && sBonusDetails.includes("% HS")) {
                        let flOldValue = parseInt(oReturnBonusWithBonusKey.details[iDetailIndex].match(/[0-9]*?% HS/gm)[0]);
                        let flNewValue = parseInt(sBonusDetails.match(/[0-9]*?% HS/gm)[0]);
                        oReturnBonusWithBonusKey.details[iDetailIndex] = oReturnBonusWithBonusKey.details[iDetailIndex].replace(/[0-9]*?% HS/gm, `${Math.trunc(flOldValue + flNewValue)}% FR`);
                    } else if (oReturnBonusWithBonusKey.details[iDetailIndex].includes("% FR") && sBonusDetails.includes("% FR")) {
                        let flOldValue = parseInt(oReturnBonusWithBonusKey.details[iDetailIndex].match(/[0-9]*?% FR/gm)[0]);
                        let flNewValue = parseInt(sBonusDetails.match(/[0-9]*?% FR/gm)[0]);
                        oReturnBonusWithBonusKey.details[iDetailIndex] = oReturnBonusWithBonusKey.details[iDetailIndex].replace(/[0-9]*?% FR/gm, `${Math.trunc(flOldValue + flNewValue)}% FR`);
                    } else {
                        oReturnBonusWithBonusKey.details[iDetailIndex] += sBonusDetails;
                    }
                }
            } else {
                if (oOptions.blDebug) {
                    console.log(`bobo extract: add "${sBonusDetails}": "${oPowerUp.wod_SO_powerup_von}: ${sBonusDetails}"`);
                }
                oReturnBonusWithBonusKey.details.push(`${oPowerUp.wod_SO_powerup_von}: ${sBonusDetails}`);
            }
        }

        return oReturnBonusWithBonusKey;
    }

    extractBonusValueFromItemString(oReturnBonusWithBonusKey, oPowerUp, oOptions) {
        let sBonusDetails = `${oPowerUp.wod_SO_powerup_von}: `;
        let aValues = [...oPowerUp.bonus_wert.matchAll(/<span class="gem_(malus|bonus)(_(only|also)_by_gem)?">(?<detail_string>(?<value>[+-][0-9]{0,5})\s?(?<percentage>[%x]?)\s?(de[sr]\s)?((?<per_type>Heldenstufe|Fertigkeitenrang)s?)?)<\/span>/gm)];

        if (oOptions.blDebug) {
            console.log("extractBonusValueFromItemString", oPowerUp.wod_SO_powerup_von, oReturnBonusWithBonusKey.bonus, oPowerUp);
        }

        for (let oMatch of aValues) {
            /**
             * @type {Object}
             * @property {string} detail_string
             * @property {string} value
             * @property {string} percentage
             * @property {string} per_type
             */
            const oValues = oMatch.groups

            if (oOptions.blDebug) {
                console.log("match", oMatch.groups);
            }

            if (!oOptions.blIsTripleValue) {
                sBonusDetails += `${oValues.detail_string}`;
                sBonusDetails = this.shortenDetailString(sBonusDetails);
            }

            // pure base value, i.e. -3 or +5
            if (oValues.percentage === "" && oValues.per_type === undefined) {
                if (oOptions.blDebug) {
                    console.log("add base", oValues.value, parseFloat(oValues.value));
                }

                oReturnBonusWithBonusKey.bonus.flBase += parseFloat(oValues.value);
            }
            // skill rank bases boni
            else if (oValues.per_type === "Fertigkeitenrang") {
                if (oValues.percentage === "") {
                    // +- FR
                    if (oValues.value === "-" || oValues.value === "+") {
                        if (oOptions.blDebug) {
                            console.log("add FR", oPowerUp.wod_SO_powerup_skill_rang, parseFloat(`${oValues.value}${oPowerUp.wod_SO_powerup_skill_rang}`));
                        }

                        oReturnBonusWithBonusKey.bonus.flSkill += parseFloat(`${oValues.value}${oPowerUp.wod_SO_powerup_skill_rang}`);
                    }
                    // +- x to FR
                    else {
                        if (oOptions.blDebug) {
                            console.log("add FR +-");
                        }

                        oReturnBonusWithBonusKey.bonus.flSkill += parseFloat(oValues.value);
                    }
                }
                // +- x% FR
                else {
                    // +y x FR i.e. Robust
                    if (oValues.percentage === "x") {
                        if (oOptions.blDebug) {
                            console.log("add y x fr", oValues, oPowerUp.wod_SO_powerup_skill_rang, parseFloat(oValues.value) * oPowerUp.wod_SO_powerup_skill_rang);
                        }

                        oReturnBonusWithBonusKey.bonus.flSkill += parseFloat(oValues.value) * oPowerUp.wod_SO_powerup_skill_rang;
                    }
                    // +x% FR
                    else {
                        if (oOptions.blDebug) {
                            console.log("add x% fr", oValues.value, oPowerUp.wod_SO_powerup_skill_rang, Number(oValues.value / 100) * oPowerUp.wod_SO_powerup_skill_rang);
                        }

                        oReturnBonusWithBonusKey.bonus.flSkill += Number(oValues.value / 100) * oPowerUp.wod_SO_powerup_skill_rang;
                    }
                }
            }
            // hero level bases boni
            else if (oValues.per_type === "Heldenstufe") {
                if (oValues.percentage === "") {
                    // +- HS
                    if (oValues.value === "-" || oValues.value === "+") {
                        if (oOptions.blDebug) {
                            console.log("add HS", parseFloat(`${oValues.value}${oHero.iLevel}`));
                        }

                        oReturnBonusWithBonusKey.bonus.flHero += parseFloat(`${oValues.value}${oHero.iLevel}`);
                    }
                    // +- x to HS
                    else {
                        if (oOptions.blDebug) {
                            console.log("add HS +-");
                        }

                        oReturnBonusWithBonusKey.bonus.flHero += parseFloat(oValues.value);
                    }
                }
                // +- x% HS
                else {
                    if (oOptions.blDebug) {
                        console.log("add % HS", oValues.value, oHero.iLevel, (parseFloat(oValues.value) / 100) * oHero.iLevel);
                    }

                    oReturnBonusWithBonusKey.bonus.flHero += ((parseFloat(oValues.value) / 100) * oHero.iLevel);
                }
            }
            // pure %
            else if (oValues.percentage === "%" && oValues.per_type === undefined) {
                let flOldEffective = oReturnBonusWithBonusKey.bonus.percentage.flEffective;
                let flEffectiveValue = (100 + parseFloat(oValues.value)) / 100;
                let iNewShowValue = this.setILabel(flOldEffective * flEffectiveValue);

                if (oOptions.blDebug) {
                    console.log("add base %", sBonusDetails, flOldEffective, flEffectiveValue, flOldEffective * flEffectiveValue, iNewShowValue);
                }

                oReturnBonusWithBonusKey.bonus.percentage.flEffective *= flEffectiveValue;
                oReturnBonusWithBonusKey.bonus.percentage.iLabel = iNewShowValue;
            }
        }

        if (!oOptions.blIsTripleValue) {
            oReturnBonusWithBonusKey.details.push(sBonusDetails);
        }

        return oReturnBonusWithBonusKey;
    }

    setBonusTotal(oBonus) {
        return oBonus.flBase + oBonus.flHero + oBonus.flSkill;
    }

    setILabel(flEffectiveValue) {
        return Math.trunc(flEffectiveValue * 100 - 100);
    }

    shortenDetailString(sBonusDetails) {
        sBonusDetails = sBonusDetails.replace(/(des )?Fertigkeitenrangs?/gm, "FR");
        sBonusDetails = sBonusDetails.replace(/(der )?Heldenstufe/gm, "HS");

        let oldFormatBonus = sBonusDetails.match(/[+-](?<number>[0-9]{1,3}) x (?:FR|HS)/);
        if (oldFormatBonus?.groups) {
            let sNewFormatValue = (oldFormatBonus.groups.number * 100).toString();
            sBonusDetails = sBonusDetails.replace(/[0-9]{1,3}/, sNewFormatValue);
            sBonusDetails = sBonusDetails.replace(" x", "%");
        }

        return sBonusDetails;
    }

    /**
     * @param sPtType
     * @return {Boolean}
     */
    isTripleValueBonus(sPtType) {
        return sPtType === this.oPowerUpApiKeys.sArmors || sPtType === this.oPowerUpApiKeys.sDamages || sPtType === this.oPowerUpApiKeys.sDamagesZ || sPtType === this.oPowerUpApiKeys.sDamageFactors;
    }

    /**
     * @todo doc für bonus object (mit label_talent)
     * @param {pt_powerup} oBonus
     * @return {{sLabel: string, sKey}}
     */
    getBonusKeyAndLabel(oBonus) {
        let sBonusKey, sLabel;

        switch (oBonus.typ) {
            case this.oPowerUpApiKeys.sAttacks:
            case this.oPowerUpApiKeys.sParades:
                sBonusKey = oBonus.angriffs_typ;
                sLabel = this.oTypes.angriffs_typ[oBonus.angriffs_typ];
                break;
            case this.oPowerUpApiKeys.sDrops:
                sBonusKey = oBonus.extra_drop;

                if (this.oTypes.attribute_versteckt[oBonus.extra_drop]) {
                    sLabel = this.oTypes.attribute_versteckt[oBonus.extra_drop];
                } else {
                    sLabel = oBonus.extra_drop.at(0).toUpperCase() + oBonus.extra_drop.slice(1);
                }
                break;
            case this.oPowerUpApiKeys.sAttributes:
                sBonusKey = oBonus.attribut;
                sLabel = oBonus.label_attribut || this.oTypes.attribute[oBonus.attribut] || this.oTypes.attribute_versteckt[oBonus.attribut];
                break;
            case this.oPowerUpApiKeys.sSkillsEffect:
            case this.oPowerUpApiKeys.sSkillRanks:
                if (oBonus.talent && oBonus.talent !== "0") {
                    try {
                        sBonusKey = this.oSkillsById[oBonus.talent].template.label;
                    } catch (sError) {
                        if (!oBonus.label_talent) {
                            // @todo set-spezifisches problem?
                            return {
                                sBonusKey: oBonus.talent,
                                sLabel: oBonus.talent
                            }
                        } else {
                            sBonusKey = /<a .*?>(?<skill>.*?)<\/a>/.exec(oBonus.label_talent).groups.skill;
                        }
                    }
                } else if (oBonus.talent_klasse && oBonus.talent_klasse !== "0") {
                    try {
                        sBonusKey = this.oSkillClasses[oBonus.talent_klasse].name;
                    } catch (sError) {
                        sBonusKey = oBonus.talent_klasse;
                    }
                } else {
                    console.log("getBonusKeyAndLabel pt_talent unknown", oBonus);
                    sBonusKey = oBonus.typ;
                }

                sLabel = sBonusKey;
                break;
            case this.oPowerUpApiKeys.sArmors:
            case this.oPowerUpApiKeys.sDamages:
            case this.oPowerUpApiKeys.sDamageFactors:
                sLabel = `${oBonus.label_schadens_typ || this.oTypes.schadens_typ[oBonus.schadens_typ]}`;
                sBonusKey = `${oBonus.schadens_typ}`;
                break;
            default:
                console.log("getBonusKeyAndLabel unknown bonus", oBonus);
                sBonusKey = oBonus.typ;
        }

        return {
            sSubKey: sBonusKey,
            sLabel: sLabel
        };
    }

    /**
     *
     * @param [oOptions]
     * @param {Boolean} [oOptions.blIsTripleValue] - blIsTripleValue boolean
     * @param {Boolean} [oOptions.blBonus] - bonus object, default true
     * @param {Boolean} [oOptions.blDetails] - details array, default true
     * @param {string} [oOptions.sPtType] - istTalentKlasseWirkung boolean
     * @param {string|Number} [oOptions.mSkillClass] - istTalentKlasseWirkung boolean
     * @param {string} [oOptions.sLabel] - wod_SO_mame string
     */
    bonusAndDetailTemplate(oOptions) {
        let oReturnObject = {};

        if (!oOptions) {
            oOptions = {};
        }

        if (typeof oOptions.blBonus === "undefined") {
            oOptions.blBonus = true;
        }

        if (typeof oOptions.blDetails === "undefined") {
            oOptions.blDetails = true;
        }

        if (typeof oOptions.blIsTripleValue !== "undefined") {
            oReturnObject.blIsTripleValue = oOptions.blIsTripleValue;
        }

        if (oOptions.blBonus) {
            oReturnObject.bonus = {
                flBase: 0,
                flHero: 0,
                flSkill: 0,
                percentage: {
                    iLabel: 0,
                    flEffective: 1
                },
                flTotal: 0
            };
        }

        if (oOptions.blDetails) {
            oReturnObject.details = [];
        }

        if (oOptions.sPtType && oOptions.mSkillClass && parseInt(oOptions.mSkillClass) !== 0) {
            oReturnObject.istTalentKlasseWirkung = this.ifTalentKlasseWirkung(oOptions.sPtType, oOptions.mSkillClass);
        }

        if (oOptions.sLabel && oOptions.sLabel !== "") {
            oReturnObject.wod_SO_name = this.translateSpecialSymbols(oOptions.sLabel);
        }

        return oReturnObject;
    }

    assignCorrectPtKey(oPowerUp) {
        let sPtKey = oPowerUp.typ;

        if (sPtKey === this.oPowerUpApiKeys.sDamages && oPowerUp.schadens_wirkungs_art === this.oPowerUpDamageEffectType.sDamageZ) {
            sPtKey = this.oPowerUpApiKeys.sDamagesZ;
        }

        return sPtKey;
    }

    /**
     *
     * @param sPtType
     * @param mTalentKlasse
     * @return {boolean}
     */
    ifTalentKlasseWirkung(sPtType, mTalentKlasse) {
        return sPtType === "pt_wirkung" && parseInt(mTalentKlasse) !== 0;
    }

    prefacePlus(mNumber) {
        let sReturnString = "";

        if (parseFloat(mNumber) > 0) {
            sReturnString += "+";
        }

        return sReturnString + mNumber;
    }

    translateSpecialSymbols(sString) {
        sString = sString.replace(/&auml;/gm, "ä");
        sString = sString.replace(/&ouml;/gm, "ö");
        sString = sString.replace(/&uuml;/gm, "ü");

        return sString;
    }
}

class PowerUp {
    oPowerUps = {};

    constructor() {
    }

    applyPowerUps(oSkillPowerUps, iRankEffective = 0) {
        for (let [sPtKey, aPowerUp] of Object.entries(oSkillPowerUps)) {
            const aPowerUpsOnApplication = [];
            const aDamageZ = [];

            aPowerUp.forEach(/** @param {pt_powerup} oPowerUp **/oPowerUp => {
                if (oPowerUp.wirkungs_art === oClassData.oPowerUpEffectType.sActive) {
                    oPowerUp[oClassData.oPowerUpSOLabel.sSkillRank] = iRankEffective;

                    if (sPtKey === oClassData.oPowerUpApiKeys.sDamages && oPowerUp.schadens_wirkungs_art === oClassData.oPowerUpDamageEffectType.sDamageZ) {
                        aDamageZ.push(oPowerUp);
                    } else {
                        aPowerUpsOnApplication.push(oPowerUp);
                    }
                }
            });

            this.oPowerUps[sPtKey] = oClassData.getBonusFromPowerUp(aPowerUpsOnApplication, false);

            if (aDamageZ.length > 0) {
                this.oPowerUps[oClassData.oPowerUpApiKeys.sDamagesZ] = oClassData.getBonusFromPowerUp(aDamageZ, false);
            }
        }
    }

    getPowerUpAttribute(sAttributeKey) {
        let flFixed = 0;
        let flPercent = 1;

        if (this.oPowerUps.pt_attribut) {
            /**
             * @type {bonus}
             */
            const oAttributePowerUp = this.oPowerUps.pt_attribut[sAttributeKey];

            if (oAttributePowerUp) {
                flFixed += oAttributePowerUp.bonus.flTotal;
                flPercent *= oAttributePowerUp.bonus.percentage.flEffective;
            }
        }

        return {
            fixed: flFixed,
            percent: flPercent
        };
    }

    getProbeEffectExtract(sType, oPowerUps) {
        const oBonus = oClassData.extractBonusValueFromBonus(oClassData.bonusAndDetailTemplate(), oPowerUps, {blIsTripleValue: true}, sType);

        return {
            percent: oBonus.bonus.percentage.flEffective,
            fixed: oClassData.setBonusTotal(oBonus.bonus) || 0
        }
    }

    getPowerUpDamage(sDamageType, sAttackType, blIsTrigger = true) {
        const oReturn = {};
        oReturn[oClassData.aHitTypes[0]] = oClassData.bonusAndDetailTemplate({blDetails: false, blIsTripleValue: true});
        oReturn[oClassData.aHitTypes[1]] = oClassData.bonusAndDetailTemplate({blDetails: false, blIsTripleValue: true});
        oReturn[oClassData.aHitTypes[2]] = oClassData.bonusAndDetailTemplate({blDetails: false, blIsTripleValue: true});
        oReturn[oClassSkills.sDamageTypeKey] = sDamageType;

        let sPowerUpKey = oClassData.oPowerUpApiKeys.sDamagesZ;

        if (blIsTrigger) {
            sPowerUpKey = oClassData.oPowerUpApiKeys.sDamages;
        }

        if (!this.oPowerUps[sPowerUpKey]) {
            return oReturn;
        }

        if (!this.oPowerUps[sPowerUpKey][sDamageType]) {
            return oReturn;
        }

        if (this.oPowerUps[sPowerUpKey][sDamageType][sAttackType]) {
            for (let sHitType of oClassData.aHitTypes) {
                oReturn[sHitType].bonus.flTotal += this.oPowerUps[sPowerUpKey][sDamageType][sAttackType][sHitType].bonus.flTotal;
                oReturn[sHitType].bonus.percentage.flEffective *= this.oPowerUps[sPowerUpKey][sDamageType][sAttackType][sHitType].bonus.percentage.flEffective;
                oReturn[sHitType].bonus.percentage.iLabel = oClassData.setILabel(oReturn[sHitType].bonus.percentage.flEffective);
            }
        }

        if (this.oPowerUps[sPowerUpKey][sDamageType][oClassData.sAllAttackTypKey]) {
            for (let sHitType of oClassData.aHitTypes) {
                oReturn[sHitType].bonus.flTotal += this.oPowerUps[sPowerUpKey][sDamageType][oClassData.sAllAttackTypKey][sHitType].bonus.flTotal;
                oReturn[sHitType].bonus.percentage.flEffective *= this.oPowerUps[sPowerUpKey][sDamageType][oClassData.sAllAttackTypKey][sHitType].bonus.percentage.flEffective;
                oReturn[sHitType].bonus.percentage.iLabel = oClassData.setILabel(oReturn[sHitType].bonus.percentage.flEffective);
            }
        }

        return oReturn;
    }

    getPowerUpProbeThrow(sAttackType, sRealType) {
        const oPowerUpType = {};
        oPowerUpType[Skill.oRealTypes.attack] = oClassData.oPowerUpApiKeys.sAttacks;
        oPowerUpType[Skill.oRealTypes.parade] = oClassData.oPowerUpApiKeys.sParades;

        let flFixed = 0;
        let flPercent = 1;

        if (this.oPowerUps[oPowerUpType[sRealType]]) {
            /**
             * @type {bonus}
             */
            const oThrowPowerUp = this.oPowerUps[oPowerUpType[sRealType]][sAttackType];

            if (oThrowPowerUp) {
                flFixed += oThrowPowerUp.bonus.flTotal;
                flPercent *= oThrowPowerUp.bonus.percentage.flEffective;
            }
        }

        return {
            fixed: flFixed,
            percent: flPercent
        };
    }

    getPowerUpSkill(sSkillName, sType = "effect") {
        const oPowerUpType = {};
        oPowerUpType["rank"] = oClassData.oPowerUpApiKeys.sSkillRanks;
        oPowerUpType["effect"] = oClassData.oPowerUpApiKeys.sSkillsEffect;
        let flFixed = 0;
        let flPercent = 1;

        if (this.oPowerUps[oPowerUpType[sType]]) {
            /**
             * @type {bonus}
             */
            const oSkillClassPowerUp = this.oPowerUps[oPowerUpType[sType]][sSkillName];

            if (oSkillClassPowerUp) {
                flFixed += Math.trunc(oSkillClassPowerUp.bonus.flSkill) + Math.trunc(oSkillClassPowerUp.bonus.flHero) + oSkillClassPowerUp.bonus.flBase;
                flPercent *= oSkillClassPowerUp.bonus.percentage.flEffective;
            }
        }

        return {
            fixed: flFixed,
            percent: flPercent
        };
    }
}

class Skill extends PowerUp {
    static oHealTypes = {
        hp: "ht_hitpoints",
        mp: "ht_manapoints",
        both: "ht_beide"
    }
    static oRealTypes = {
        attack: "rt_attack",
        parade: "rt_parade",
        healing: "rt_healing",
        powerUp: "rt_powerup",
        powerDown: "rt_powerdown",
        ini: "rt_initiativ",
        summon: "rt_create_monster",
        rebirth: "rt_rebirth",
    };
    static oTargetTypes = {
        hero: "tz_selbst",
        oneAlly: "tz_team_figur",
        allyPosition: "tz_team_position",
        allyGroup: "tz_team_alle",
        oneEnemy: "tz_gegner_figur",
        enemyPosition: "tz_gegner_position",
        enemyGroup: "tz_gegner_alle",
    };
    static oTypes = {
        heal: "tt_heil",
        powerUp: "tt_powerup",
        ini: "tt_initiativ",
        summon: "tt_create_monster",
        rebirth: "tt_rebirth",
    };
    static sFakeParade = "fakeParade";
    static sFakeIni = "fakeInitiative";

    /**
     * @type {powerups}
     */
    oPowerUps = {}

    /**
     * @type {Number}
     */
    #iRankBase;
    /**
     * @type {Number}
     */
    #iRankEffective;
    #oEffect = {
        percent: 1,
        fixed: 0,
    };
    #oProbe = {
        percent: 1,
        fixed: 0
    };
    /**
     * @type {skill_template}
     */
    #oTemplate;
    /**
     * @type {String}
     */
    #sDamageType;
    /**
     * @type {Number}
     */
    #iId;

    constructor(sSkillName) {
        super();

        if (sSkillName === Skill.sFakeIni || sSkillName === Skill.sFakeParade) {
            this.#iRankBase = 0;
            this.#iRankEffective = 0;
            this.#oTemplate = {};
            this.#oTemplate.konfigurierbar_parade = "1";

            if (sSkillName === Skill.sFakeIni) {
                this.#oTemplate.real_type = Skill.oRealTypes.ini;
            } else {
                this.#oTemplate.real_type = Skill.oRealTypes.parade;
            }
        } else {
            /**
             * @type {skills}
             */
            const oSkillObject = oClassData.oSkillsByName[sSkillName];

            // this.#aCurrentBonuses = oSkillObject.current_bonusse;
            this.#iRankEffective = oSkillObject.effective_value;
            this.#iRankBase = parseInt(oSkillObject.base_value);
            // this.#oTargetPowerUps = oSkillObject.target_powerups;
            this.#oTemplate = oSkillObject.template;
            this.#sDamageType = oSkillObject.template.schadens_typ;
            this.#iId = parseInt(oSkillObject.template_id);

            this.applyPowerUps(oSkillObject.owner_powerups, this.#iRankEffective);
            this.#oEffect = this.getProbeEffectExtract("effect", this.#oTemplate);
            this.#oProbe = this.getProbeEffectExtract("probe", this.#oTemplate);
        }
    }

    get attributePrimary() {
        return this.#oTemplate.attr_primaer;
    }

    get attributePrimaryEffect() {
        return this.#oTemplate.attr_wirk_primaer;
    }

    get attributeSecondary() {
        return this.#oTemplate.attr_sekundaer;
    }

    get attributeSecondaryEffect() {
        return this.#oTemplate.attr_wirk_sekundaer;
    }

    get attackType() {
        return this.#oTemplate.angriffs_typ;
    }

    get damageType() {
        return this.#sDamageType;
    }

    get effect() {
        return this.#oEffect;
    }

    get finalEffectBonus() {
        return parseFloat(this.#oTemplate.final_bonus_wert) / 100;
    }

    get gainMpBasic() {
        return parseInt(this.#oTemplate.gain_mp_basis);
    }

    get gainMpPercent() {
        return parseInt(this.#oTemplate.gain_mp_proc);
    }

    get gainMpType() {
        return this.#oTemplate.gain_mp_typ;
    }

    get gainMpValue() {
        return parseInt(this.#oTemplate.gain_mp_wert);
    }

    get hasDamageType() {
        return this.#oTemplate.mit_schadens_typ
    }

    get healType() {
        return this.#oTemplate.heil_typ;
    }

    get isChainAttack() {
        return parseInt(this.#oTemplate.is_stop_when_fail) === 1;
    }

    get isConfigurable() {
        return parseInt(this.#oTemplate.konfigurierbar) === 1;
    }

    get isConfigurableParade() {
        return parseInt(this.#oTemplate.konfigurierbar_parade) === 1;
    }

    get isItemOptional() {
        return parseInt(this.#oTemplate.gegenstand_optional) === 1;
    }

    get itemClassId() {
        return parseInt(this.#oTemplate.gegenstand_klasse_id);
    }

    get itemEffectCountForSkillRang() {
        return parseInt(this.#oTemplate.gegenstand_wirkungsbonus_gilt_fuer_powerups) === 1;
    }

    get manaCost() {
        return parseInt(this.#oTemplate.mana_kosten);
    }

    get name() {
        return this.#oTemplate.label;
    }

    get probe() {
        return this.#oProbe;
    }

    get rankBase() {
        return this.#iRankBase;
    }

    get rankEffective() {
        return this.#iRankEffective;
    }

    get rankTotal() {
        let flTotalRank = this.#iRankEffective;

        if (this.oPowerUps[oClassData.oPowerUpApiKeys.sSkillRanks]) {
            if (this.oPowerUps[oClassData.oPowerUpApiKeys.sSkillRanks][this.#oTemplate.label]) {
                flTotalRank += this.oPowerUps[oClassData.oPowerUpApiKeys.sSkillRanks][this.#oTemplate.label].bonus.flTotal;
                flTotalRank *= (this.oPowerUps[oClassData.oPowerUpApiKeys.sSkillRanks][this.#oTemplate.label].bonus.percentage.flEffective - 1) * this.#iRankBase;
            }

            if (this.oPowerUps[oClassData.oPowerUpApiKeys.sSkillRanks][this.skillClassName]) {
                flTotalRank += this.oPowerUps[oClassData.oPowerUpApiKeys.sSkillRanks][this.skillClassName].bonus.flTotal;
                flTotalRank *= (this.oPowerUps[oClassData.oPowerUpApiKeys.sSkillRanks][this.skillClassName].bonus.percentage.flEffective - 1) * this.#iRankBase;
            }
        }

        return flTotalRank;
    }

    get realType() {
        return this.#oTemplate.real_type;
    }

    get skillClassId() {
        return parseInt(this.#oTemplate.talent_klasse_id);
    }

    get skillClassName() {
        if (parseInt(this.#oTemplate.talent_klasse_id) === 0 || !this.#oTemplate.talent_klasse_id) {
            return "";
        } else {
            return oClassData.oSkillClasses[this.#oTemplate.talent_klasse_id].name;
        }
    }

    get targetNumberBasic() {
        return parseInt(this.#oTemplate.affected_basis);
    }

    get targetNumberType() {
        return this.#oTemplate.affected_typ;
    }

    get targetNumberValue() {
        return parseInt(this.#oTemplate.affected_wert);
    }

    get targetType() {
        return this.#oTemplate.ziel;
    }

    get type() {
        return this.#oTemplate.typ;
    }

    set attackType(sAttackType) {
        this.#oTemplate.angriffs_typ = sAttackType;
    }

    set attributeProbePrimary(sAttributeKey) {
        this.#oTemplate.attr_primaer = sAttributeKey;
    }

    set attributeProbeSecondary(sAttributeKey) {
        this.#oTemplate.attr_sekundaer = sAttributeKey;
    }

    set damageType(sDamageType) {
        this.#sDamageType = sDamageType;
    }

    set name(sName) {
        this.#oTemplate.label = sName;
    }
}

class Item extends PowerUp {
    /**
     * @type {powerups}
     */
    oPowerUps = Object.create(null);

    #oAmmo = Object.create(null);
    /**
     * @type {item_template}
     */
    #oTemplate;
    #sDamageType;
    /**
     * @type {Number}
     */
    #iInstanceId;
    /**
     * @type {Number}
     */
    #iItemClassId;
    /**
     * @type {Number}
     */
    #iTemplateId;

    /**
     * @param {items} oItem
     */
    constructor(oItem) {
        super();

        this.#sDamageType = oItem.template.schadens_typ;
        this.#iInstanceId = oItem.instance_id;
        this.#iTemplateId = oItem.template_id;
        // this.#oInstance = oItem.instance;
        this.#oTemplate = oItem.template;

        this.applyPowerUps(oItem.instance.owner_powerups);
    }

    get ammo() {
        return this.#oAmmo;
    }

    get ammoEquipped() {
        const oReturnArray = [];

        for (let oAmmoObject of Object.values(this.#oAmmo)) {
            oReturnArray.push(oAmmoObject);
        }

        return oReturnArray;
    }

    get ammoList() {
        return this.#oTemplate.munition_list;
    }

    get applicationsPerFight() {
        return this.#oTemplate.anw_kampf ? parseInt(this.#oTemplate.anw_kampf) : null;
    }

    get applicationsPerDungeon() {
        return this.#oTemplate.anw_dungeon ? parseInt(this.#oTemplate.anw_dungeon) : null;
    }

    get applicationsTotal() {
        return this.#oTemplate.anw_gesamt ? parseInt(this.#oTemplate.anw_gesamt) : null;
    }

    get damageType() {
        return this.#sDamageType;
    }

    /**
     * @return {{fixed: number, percent: number}|null}
     */
    get effect() {
        if (this.#oTemplate.gegenstand_klassen[this.#iItemClassId]) {
            return this.getProbeEffectExtract("effect", this.#oTemplate.gegenstand_klassen[this.#iItemClassId]);
        } else {
            return {
                percent: 1,
                fixed: 0
            };
        }
    }

    get equipmentSlot() {
        return this.#oTemplate.trage_typ;
    }

    get hasAmmo() {
        return this.#oTemplate.munition_list.length > 0;
    }

    get instanceId() {
        return this.#iInstanceId;
    }

    get name() {
        return this.#oTemplate.name;
    }

    get needResetPointsToDrop() {
        return parseInt(this.#oTemplate.is_stuck) === 1;
    }

    /**
     * @return {{fixed: number, percent: number}|null}
     */
    get probe() {
        if (this.#oTemplate.gegenstand_klassen[this.#iItemClassId]) {
            return this.getProbeEffectExtract("probe", this.#oTemplate.gegenstand_klassen[this.#iItemClassId]);
        } else {
            return {
                fixed: 0,
                percent: 1
            };
        }
    }

    get setId() {
        return parseInt(this.#oTemplate.set_id);
    }

    /**
     * @param {string} sItemClassId
     * @param {Item} oAmmoItem
     */
    setAmmo(sItemClassId, oAmmoItem) {
        this.#oAmmo[sItemClassId] = oAmmoItem;

        if (oAmmoItem.damageType) {
            this.damageType = oAmmoItem.damageType;
        }
    }

    set damageType(sDamageType) {
        if (sDamageType && sDamageType !== "") {
            this.#sDamageType = sDamageType;
        } else {
            this.#sDamageType = this.#oTemplate.schadens_typ;
        }
    }

    /**
     * @param {number} iItemClassId
     */
    set itemClassId(iItemClassId) {
        this.#iItemClassId = iItemClassId;
    }
}

// @todo hero to Data
const oHero = {};
const oClassData = new oSkillsOptimizerData();
const oClassLayout = new skillsOptimizerLayout();
const oClassSkills = new oSkillOptimizerSkills();

(() => {
    const oFetchSets = oClassData.fetchFromApi("sets");
    const oFetchSkills = oClassData.fetchFromApi("all_skills");
    // const aSkills = this.fetchFromApi("skills").then(oSkills => this.aSkills = oSkills.skills);
    const oFetchItems = oClassData.fetchFromApi("items");
    const oFetchAttributes = oClassData.fetchFromApi("attributes");
    const oFetchMonument = oClassData.fetchFromApi("monument");

    // const oFetchClass = oClassData.getValues(oClassData.oStorageKeys.sClassPlain, "class_plain", false/*, true, oHero.sName*/);
    // const oClass = oClassData.getValues(oClassData.oStorageKeys.sClass, "class", false, true, oHero.sName).then(oClass => oClassData.oClass = oClass);
    const oFetchTypes = oClassData.getValues(oClassData.oStorageKeys.sTypes, "types", false).then(oTypes => oClassData.oTypes = oTypes);
    const oFetchItemClasses = oClassData.getValues(oClassData.oStorageKeys.sItemClasses, "item_classes").then(oItemClasses => oClassData.oItemClasses = oItemClasses);
    const oFetchSkillClasses = oClassData.getValues(oClassData.oStorageKeys.sSkillClasses, "skill_classes").then(oSkillClasses => oClassData.oSkillClasses = oSkillClasses);

    const oContentLoaded = new Promise((oResolve, oReject) => {
        document.addEventListener("DOMContentLoaded", () => {
            console.log("DOMContentLoaded");
            oHero.sName = document.forms["the_form"]["heldenname"].value;
            oHero.iLevel = parseInt(document.forms["the_form"]["stufe"].value);

            oClassLayout.createMessageArea();

            // @todo: no progress if pagination available
            if (oClassLayout.detailsAreShown) {
                oClassLayout.addMessage("Bitte Details ausschalten");
                oReject("error_details_active");
            } else {
                oResolve("DomDone");
            }
        });
    });

    oFetchAttributes.then(oAttributes => {
        console.log("fetch attributes", oAttributes);

        // oClassData.oAttributes = oAttributes;
        oClassSkills.oDataPowerUps.attributes = oAttributes.attributes;
    });

    oFetchItems.then(oItems => {
        console.log("fetch items", oItems);
        oClassData.oItems = oItems;
    });

    oFetchMonument.then(oMonument => {
        console.log("fetch monument", oMonument);

        oClassData.oMonument = oMonument;

        if (oClassData.oMonument.monument.label) {
            const sMonumentName = oClassData.oMonument.monument.label;

            for (let aMonumentPowerUp of Object.values(oClassData.oMonument.monument.powerups)) {
                oClassData.assignPowerUps(aMonumentPowerUp, sMonumentName, {blDebug: false});
            }
        }
    });

    oFetchSets.then(oSets => {
        console.log("fetch sets", oSets);
        oClassData.oSets = oClassData.orderSets(oSets.sets);
    });

    oFetchSkills.then(oSkills => {
        console.log("fetch skills", oSkills);

        oClassData.aSkills = oSkills.skills;

        for (let Skill of oClassData.aSkills) {
            const sSkillName = Skill.template.label;
            const iSkillRank = Skill.effective_value;

            oClassData.orderSkill(Skill);

            for (let aSkillPowerUp of Object.values(Skill.owner_powerups)) {
                oClassData.assignPowerUps(aSkillPowerUp, sSkillName, {iSkillLevel: iSkillRank, blDebug: false});
            }
        }
    });

    const oFetchClass = Promise.all([oContentLoaded]).then(() => {
        return new Promise((oResolve, oReject) => {
            oClassData.getValues(oClassData.oStorageKeys.sClassPlain, "class_plain", false, true, oHero.sName).then(oClass => {
                console.log("permanent class", oClass);
                oResolve(oClass);
            }).catch(sError => {
                oReject(sError);
            });
        });
    }).catch(sError => {
        throw new Error(sError);
    });

    const oStructureRendered = Promise.all([oContentLoaded, oFetchTypes]).then(() => {
        console.log("DOM-Types");

        oClassSkills.initRender();
        oClassLayout.initRender();
        oClassLayout.fillHiddenOptionsTable();
    }).catch(sError => {
        throw new Error(sError);
    });

    Promise.all([oStructureRendered, oFetchAttributes]).then(aValues => {
        console.log("DOM-Attributes");
        /**
         * @type {Object}
         * @property {attributes} attributes
         * @property {Array<pt_powerup>} powerups
         */
        const oAttributes = aValues[1];
        oClassLayout.addAttributeData(oAttributes.attributes);
    }).catch(sError => {
        console.error("DOM-Attributes", sError);
    });

    const oFetchItemsAndSets = Promise.all([oFetchItems, oFetchSets]).then(() => {
        console.log("Item-Set");

        for (let oItem of oClassData.oItems.items) {
            const sItemName = oItem.template.name;
            const oItemObject = new Item(oItem);

            if (oItem.template.set_id !== "0") {
                oClassData.oSets[oItem.template.set_id].items.push(oItem);
            }

            for (let sItemClassId of Object.keys(oItem.template.gegenstand_klassen)) {
                if (typeof oClassData.oItemClasses[sItemClassId].items === "undefined") {
                    oClassData.oItemClasses[sItemClassId].items = [];
                }

                oClassData.oItemClasses[sItemClassId].items.push(oItemObject);
            }

            oClassData.oItemsByInstanceId[oItem.instance_id] = oItemObject;

            for (let aItemPowerUp of Object.values(oItem.instance.owner_powerups)) {
                oClassData.assignPowerUps(aItemPowerUp, sItemName, {blDebug: false});
            }
        }

        oClassData.getSetPowerUps();
    }).catch(sError => {
        throw new Error(sError);
    });

    // fetch permanent data
    const oSavedPermanentData = Promise.all([oFetchTypes, oFetchItemClasses, oFetchSkillClasses]).then(aValues => {
        let [oTypes, oItemClasses, oSkillClasses] = aValues;

        console.log("permanent: types", oTypes);
        console.log("permanent: itemClasses", oItemClasses);
        console.log("permanent: skillClasses", oSkillClasses);

        oClassData.saveData(oClassData.oStorageKeys.sTypes, oTypes);
        oClassData.saveData(oClassData.oStorageKeys.sItemClasses, oItemClasses);
        oClassData.saveData(oClassData.oStorageKeys.sSkillClasses, oSkillClasses);
    }).catch(sError => {
        console.error("permanent", sError);
    });

    const oGetClassData = Promise.all([oContentLoaded, oFetchClass]).then(aValues => {
        let oClass = aValues[1];
        console.log("DOM-Class", oClass);

        oClassData.oClass = oClass;
        oClassData.saveData(oClassData.blClassPlain ? oClassData.oStorageKeys.sClassPlain : oClassData.oStorageKeys.sClass, oClass, true, oHero.sName);

        for (let aClassPowerUp of Object.values(oClassData.oClass.class.powerups)) {
            const sClassName = oClassData.oClass.class.label;

            oClassData.assignPowerUps(aClassPowerUp, sClassName, {blDebug: false});
        }

        for (let aFolkPowerUp of Object.values(oClassData.oClass.race.powerups)) {
            const sFolkName = oClassData.oClass.race.label;

            oClassData.assignPowerUps(aFolkPowerUp, sFolkName, {blDebug: false});
        }
    }).catch(sError => {
        throw new Error(sError);
    });

    const oCalcBonusValues = Promise.all([oFetchAttributes, oGetClassData, oFetchItems, oFetchMonument, oFetchSkills]).then(() => {
        console.log("calc bonus values");

        let oBonusAttackValues = oClassData.getBonusTableAttackValues();
        let oBonusAttributeValues = oClassData.getBonusTableAttributeValues();
        let oBonusDropValues = oClassData.getBonusTableDropValues();
        let oBonusParadeValues = oClassData.getBonusTableParadeValues();
        let oBonusArmorValues = oClassData.getBonusTableArmorValues();
        let oBonusDamageValues = oClassData.getBonusTableDamageValues();
        let oBonusDamageZValues = oClassData.getBonusTableDamageZValues();
        let oBonusDamageFactorValues = oClassData.getBonusTableDamageFactorValues();
        let oBonusSkillEffectValues = oClassData.getBonusTableSkillEffectValues();

        return [oBonusAttackValues, oBonusAttributeValues, oBonusDropValues, oBonusParadeValues, oBonusArmorValues, oBonusDamageValues, oBonusDamageZValues, oBonusDamageFactorValues, oBonusSkillEffectValues];
    }).catch(sError => {
        throw new Error(sError);
    });

    const oAppliedSetBoni = Promise.all([oCalcBonusValues, oFetchItemsAndSets]).then(aValues => {
        console.log("applySetBoniToPowerUps");

        let [oBonusAttackValues, oBonusAttributeValues, oBonusDropValues, oBonusParadeValues, oBonusArmorValues, oBonusDamageValues, oBonusDamageZValues, oBonusDamageFactorValues, oBonusSkillEffectValues] = aValues[0];

        oBonusAttackValues = oClassData.applySetBoniToPowerUps(oClassData.oPowerUpApiKeys.sAttacks, oBonusAttackValues);
        oBonusAttributeValues = oClassData.applySetBoniToPowerUps(oClassData.oPowerUpApiKeys.sAttributes, oBonusAttributeValues);
        oBonusDropValues = oClassData.applySetBoniToPowerUps(oClassData.oPowerUpApiKeys.sDrops, oBonusDropValues);
        oBonusParadeValues = oClassData.applySetBoniToPowerUps(oClassData.oPowerUpApiKeys.sParades, oBonusParadeValues);
        oBonusArmorValues = oClassData.applySetBoniToPowerUps(oClassData.oPowerUpApiKeys.sArmors, oBonusArmorValues);
        oBonusDamageValues = oClassData.applySetBoniToPowerUps(oClassData.oPowerUpApiKeys.sDamages, oBonusDamageValues);
        oBonusDamageZValues = oClassData.applySetBoniToPowerUps(oClassData.oPowerUpApiKeys.sDamagesZ, oBonusDamageZValues);
        oBonusDamageFactorValues = oClassData.applySetBoniToPowerUps(oClassData.oPowerUpApiKeys.sDamageFactors, oBonusDamageFactorValues);
        oBonusSkillEffectValues = oClassData.applySetBoniToPowerUps(oClassData.oPowerUpApiKeys.sSkillsEffect, oBonusSkillEffectValues);

        return [oBonusAttackValues, oBonusAttributeValues, oBonusDropValues, oBonusParadeValues, oBonusArmorValues, oBonusDamageValues, oBonusDamageZValues, oBonusDamageFactorValues, oBonusSkillEffectValues];
    }).catch(sError => {
        throw new Error(sError);
    });

    Promise.all([oStructureRendered, oSavedPermanentData, oAppliedSetBoni]).then(aValues => {
        console.log("got all");

        let [oBonusAttackValues, oBonusAttributeValues, oBonusDropValues, oBonusParadeValues, oBonusArmorValues, oBonusDamageValues, oBonusDamageZValues, oBonusDamageFactorValues, oBonusSkillEffectValues] = aValues[2];

        oClassSkills.oDataPowerUps.skillEffects = oBonusSkillEffectValues;
        oClassSkills.oDataPowerUps.attacks = oBonusAttackValues;
        oClassSkills.oDataPowerUps.parades = oBonusParadeValues;
        oClassSkills.oDataPowerUps.damages = oBonusDamageValues;
        oClassSkills.oDataPowerUps.damagesZ = oBonusDamageZValues;
        oClassSkills.oDataPowerUps.initiative = oBonusAttributeValues.at_v_initiative;

        oClassSkills.fillTable();

        oClassLayout.fillSingleBonus(oBonusAttackValues, "Attacks")
        oClassLayout.fillSingleBonus(oBonusAttributeValues, "Attributes");
        oClassLayout.fillSingleBonus(oBonusDropValues, "Drop");
        oClassLayout.fillSingleBonus(oBonusParadeValues, "Parades");
        oClassLayout.fillTripleBonus(oBonusArmorValues, "Armor");
        oClassLayout.fillTripleBonus(oBonusDamageValues, "Damage");
        oClassLayout.fillTripleBonus(oBonusDamageZValues, "DamageZ");
        oClassLayout.fillTripleBonus(oBonusDamageFactorValues, "DamageFactor");
        oClassLayout.fillBonusSkillEffects(oBonusSkillEffectValues);

        oClassLayout.appendLayout();
    }).catch(sError => {
        console.error("all", sError);
    });
})();
