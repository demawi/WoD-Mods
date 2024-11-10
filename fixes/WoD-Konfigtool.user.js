// ==UserScript==
// @name           WoD-Konfigtool
// @namespace      Morkan
// @description    Hilft bei der Konfig
// @include        http://*.world-of-dungeons.de/wod*spiel/hero/skillconf*
// @include        https://*.world-of-dungeons.de/wod*spiel/hero/skillconf*
// @version        0.2.0beta3
// ==/UserScript==
// --------------------------------------------------------------------
// WoD-Konfigtool
// version 0.2.0beta3
// 2010-03-07
// Copyright (c) 2010, Morkan@Cartegon
// Released under the GPL license
// http://www.gnu.org/copyleft/gpl.html

mkt_WOD_SKILL_TYPE_INITIATIVE = 1 << 0;
mkt_WOD_SKILL_TYPE_PREROUND = 1 << 1;
mkt_WOD_SKILL_TYPE_ROUND = 1 << 2;
mkt_WOD_SKILL_TYPE_DEF_CLOSE_COMBAT = 1 << 3;
mkt_WOD_SKILL_TYPE_DEF_DISTANCE = 1 << 4;
mkt_WOD_SKILL_TYPE_DEF_SOCIAL = 1 << 5;
mkt_WOD_SKILL_TYPE_DEF_MAGIC = 1 << 6;
mkt_WOD_SKILL_TYPE_HEAL = 1 << 7;
mkt_WOD_SKILL_TYPE_MAX = mkt_WOD_SKILL_TYPE_HEAL;

var mkt_strings = {
    /********************************************************************
     * displayed strings *                                              *
     *********************                                              *
     * All strings in this section can be changed at leisure - they are *
     * only used for the display and have no other function. This       *
     * section needs to be translated for other languages.              *
     ********************************************************************/
    buttonstartinvisible: 'Einblenden',
    buttonstartvisible: 'Ausblenden',
    button_weaponchange: 'tauschen',
    button_ammochange: 'tauschen',
    buttonchangeweapon: 'Ausführen',
    buttonchangeammo: 'Ausführen',
    buttonrefreshammo: 'Munition aktualisieren',
    button_error_reset: 'Alle entfernen',
    button_cancel_errmsg: 'Diese Meldung entfernen',
    label_skill: 'Fertigkeit',
    label_weapon: 'Waffe/VG',
    label_ammo: 'Munition/Instrument',
    label_old: 'Alter Gegenstand',
    label_new: 'Neuer Gegenstand',
    label_for: 'für',
    label_arrow: '-->',
    label_socket: 'Veredelung',
    option_allskills: '(alles)',
    option_allpreroundandroundskills: '(alles in Vor- und Hauptrunde)',
    option_allroundskills: '(alles in Hauptrunden)',
    option_allpreroundskills: '(alles in Vorrunden)',
    option_allhealskills: '(alles in Heilung)',
    option_allinitiativeskills: '(alles in Initiative)',
    option_none: '------',
    option_auto: '(auto)',
    error_nostartelement: 'no start element found - is it a config page?',
    error_cantHaveTwoAutoSettings: 'Es kann nicht alter und neuer Gegenstand (auto) sein: ',
    error_allSelectsMustHaveValidSelection: 'Jedes Auswahlfeld muss mit einem gültigen Wert belegt sein: ',
    error_whenAutoItemSkillMustBeExplicit: 'Wenn ein Gegenstand auf (auto) steht, dann muss die Fertigkeit explizit angegeben werden: ',
    /********************************************************************
     * gamepage strings  *                                              *
     *********************                                              *
     * these strings are from the game page. they must be changed, when *
     * and only when your games page is changed. If they don't match the*
     * strings from the game, the skript will not work correctly.       *
     ********************************************************************/
    id_startelement: "wod-orders",      /* the id of the div containing the configuration elements */
    optionvalue_nosocks: '-',               /* the string indicating the config engine, that no sockets were selected */
    class_errordiv: 'message_error',   /* the css class name, that is used for error messages, so that users will recognize the error messages as errors */

    /********************************************************************
     * internal strings  *                                              *
     *********************                                              *
     * these strings are used only internally - changing them should not*
     * affect the script at all. If by chance of the ids is interferring*
     * with elements on the game page, feel free to change the rogue id.*
     ********************************************************************/
    id_div_main: 'mkt_id_div_main',
    id_div_error: 'mkt_id_div_error',
    id_select_skillforweapon: 'mkt_id_select_skillforweapon',
    id_select_skillforammo: 'mkt_id_select_skillforammo',
    id_select_weaponold: 'mkt_id_select_weaponold',
    id_select_weaponnew: 'mkt_id_select_weaponnew',
    id_select_weaponoldsocks: 'mkt_id_select_weaponoldsocks',
    id_select_weaponnewsocks: 'mkt_id_select_weaponnewsocks',
    id_select_ammoold: 'mkt_id_select_ammoold',
    id_select_ammonew: 'mkt_id_select_ammonew',
    id_button_start: 'mkt_id_button_start',
    id_button_start2: 'mkt_id_button_start2',
    id_button_changeweapon: 'mkt_id_button_changeweapon',
    id_button_changeammo: 'mkt_id_button_changeammo',
    id_button_refreshammo: 'mkt_id_button_refreshammo',
    id_button_error_reset: 'mkt_id_button_error_reset',
    id_hidden_statusweapon: 'mkt_id_hidden_statusweapon',
    id_hidden_statusammo: 'mkt_id_hidden_statusammo',
    optionvalue_allskills: '-' + (mkt_WOD_SKILL_TYPE_MAX << 1),
    optionvalue_allinitiativeskills: '-' + (mkt_WOD_SKILL_TYPE_INITIATIVE),
    optionvalue_allpreroundandroundskills: '-' + (mkt_WOD_SKILL_TYPE_PREROUND * 1 + mkt_WOD_SKILL_TYPE_ROUND * 1),
    optionvalue_allpreroundskills: '-' + (mkt_WOD_SKILL_TYPE_PREROUND),
    optionvalue_allroundskills: '-' + (mkt_WOD_SKILL_TYPE_ROUND),
    optionvalue_allhealskills: '-' + (mkt_WOD_SKILL_TYPE_HEAL),
    optionvalue_novalue: '-9999',
    optionvalue_auto: 'auto',
    skilldata_all: ',a,',
    skilldata_preskills: ',p,',
    skilldata_roundskills: ',r,',
    skilldata_healskills: ',h,',
    skilldata_initiativeskills: ',i,',
    skilldata_list: ',a,p,r,h,i,',
    status_weapon_skillselected: 'status_weapon_skillselected',
    status_weapon_oldselected: 'status_weapon_oldselected',
    status_weapon_newselected: 'status_weapon_newselected',
    status_ammo_skillselected: 'status_ammo_skillselected',
    status_ammo_oldselected: 'status_ammo_oldselected',
    status_ammo_newselected: 'status_ammo_newselected',
    /********************************************************************
     * ressource strings *                                              *
     *********************                                              *
     * Here should data:uri-strings be stored. they can be used to show *
     * images without accessing any files from the script.    .         *
     * http://software.hixie.ch/utilities/cgi/data/data                 *
     * can be used to create data-uris                                  *
     ********************************************************************/
    cancelimage: 'data:image/gif;base64,R0lGODlhDgAOALMAAPj8%2BAAAAJh0MPC0IAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACwAAAAADgAOAAAEMDDISau4OF8p5PggJ3rhKAzTl3bBiVYf677kIJf1Tac2R6seGQ%2FYGoFKMo2ywqREAAA7',

    /********************************************************************
     * The next entry is just for convenience - after every entry above,*
     * a comma is necessary. Without this last entry, it would be nece- *
     * ssary to ommit it after the last entry and then set it  when an- *
     * other entry is added.                                            *
     ********************************************************************/
    last: ''
};

var myuls = new Array();
var errordiv;

/*********************************************************************
 *                                                                   *
 * Default html and string functions                                 *
 *                                                                   *
 *********************************************************************/


/**
 * trim spaces from start and end of a string
 *
 * @param s der zu trimmende Text
 * @return der getrimmte Text
 */
function trim(s) {
    return s.replace(/^\s+/, '').replace(/\s+$/, '');
}

/**
 * Creates a div element with id, class and style-attribut
 * when div_id is empty, the id attribut will be ommited
 *
 * @param div_id the id of the created div
 * @param div_class class of the created div
 * @param div_id style of the created div
 * @return the created div
 */
function mkt_createDiv(div_id, div_class, div_style) {
    var el = document.createElement('div');
    if (div_id != null && div_id != '') {
        el.setAttribute('id', div_id);
    }
    el.setAttribute('class', div_class);
    el.setAttribute('style', div_style);
    return el;
}

/**
 * Creates an input-Element with type, name, id, class und value
 * id is only set, wenn the parameter is not empty
 *
 * @param inp_type type of the input
 * @param inp_name name of the input
 * @param inp_id id of the input
 * @param inp_class class of the input
 * @param inp_value value of the input
 * @return the created input-elementt
 */
function mkt_createInput(inp_type, inp_name, inp_id, inp_class, inp_value) {
    var el = document.createElement('input');
    el.setAttribute('type', inp_type);
    el.setAttribute('name', inp_name);
    if (inp_id != '' && inp_id != null) {
        el.setAttribute('id', inp_id);
    }
    el.setAttribute('class', inp_class);
    el.setAttribute('value', inp_value);
    return el;
}


/**
 * Creates an input button with name, id, class, text, onclick attribute and with a set clickevent function
 * the clickevent function is not set if parameter is empty
 * the id is not set, when parameter is empty
 *
 * @param btn_name name of the button
 * @param btn_id id of the button
 * @param btn_class class of the button
 * @param btn_text caption of the button
 * @param btn_oncklick text for the onclick attribut
 * @param btn_clickevent function to bind to the click event
 * @return the created input-button element
 */
function mkt_createButton(btn_name, btn_id, btn_class, btn_text, btn_onclick, btn_clickevent) {
    var el = mkt_createInput('button', btn_name, btn_id, btn_class, btn_text);
    if (btn_clickevent != '' && btn_clickevent != null) {
        if ('function' == typeof btn_clickevent) {
            el.addEventListener('click', btn_clickevent, false);
        }
    }
    if (btn_onclick != '' && btn_onclick != null) {
        if ('string' == typeof btn_onclick) {
            el.setAttribute('onclick', btn_onclick);
        }
    }
    return el;
}

/**
 * Creates an input of type radiobutton and a linked label
 * id will only be set, when parameter is not empty - without id, label will not be linked
 *
 * @param rb_id the id
 * @param rb_name name of the radio button group
 * @param rb_value value of this radio button
 * @param rb_selected true = button is preselected / false = button is not selected
 * @param rb_text the text in the linked label
 * @return an array, with the created inpunt in [0] and the label in [1]
 */
function mkt_createRadioButton(rb_id, rb_name, rb_value, rb_selected, rb_text) {
    var erg = new Array();
    var rb = mkt_createInput('radio', rb_name, rb_id, '', rb_value);
    if (rb_selected) {
        rb.setAttribute('checked', 'checked');
    }
    erg[0] = rb;
    var lbl = document.createElement('label');
    if (rb_id && rb_id != '') lbl.setAttribute('for', rb_id);
    var lbltext = document.createTextNode(rb_text);
    lbl.appendChild(lbltext);
    erg[1] = lbl;
    return erg;
}

/**
 * Creates a select element without option elements and a linked label
 * id will only be set, when parameter is not empty - without id, label will not be linked
 *
 * @param sl_id the id
 * @param sl_name name of the select element
 * @param sl_value preselected value
 * @param sl_text text in linked label
 * @param sl_changeevent - the function to bind to the change event
 * @param sl_onchange - the javascript-text for the "onchange" attribut
 * @return an array with the input in [0] and the label in [1]
 */
function mkt_createSelect(sl_id, sl_name, sl_value, sl_text, sl_changeevent, sl_onchange, sl_style, sl_class) {
    var erg = new Array();
    var sl = document.createElement('select');
    sl.setAttribute('size', '1');
    if (sl_id) sl.setAttribute('id', sl_id);
    if (sl_name) sl.setAttribute('name', sl_name);
    if (sl_value) sl.setAttribute('value', sl_value);
    if (sl_changeevent != '' && sl_changeevent != null) {
        if ('function' == typeof sl_changeevent) {
            sl.addEventListener('change', sl_changeevent, false);
        }
    }
    if (sl_onchange != '' && sl_onchange != null) {
        if ('string' == typeof sl_onchange) {
            sl.setAttribute('onchange', sl_onchange);
        }
    }
    if (sl_style) sl.setAttribute('style', sl_style);
    if (sl_class) sl.setAttribute('style', sl_class);
    erg[0] = sl;
    var lbl = document.createElement('label');
    if (sl_id) lbl.setAttribute('for', sl_id);
    var lbltext = document.createTextNode(sl_text);
    lbl.appendChild(lbltext);
    erg[1] = lbl;
    return erg;
}

/**
 * Creates an option element into the given select element
 *
 * @param theselect the select element
 * @param opt_value value of the option
 * @param opt_text displayed option text
 * @param opt_data additional data (goes into attribut mkt_strings.attribut_data)
 * @return the option element
 */
function mkt_addSelectOption(theselect, opt_value, opt_text, opt_data) {
    var opt = document.createElement('option');
    if (opt_value) opt.setAttribute('value', opt_value);
    opt.appendChild(document.createTextNode(opt_text));
    if (opt_data) opt.setAttribute('data', opt_data);
    theselect.appendChild(opt);
    return opt;
}

/**
 * creates a table element
 *
 * @param tblstyle the tables style attribut
 * @param tblclass css class name
 * @return the created table element
 */
function mkt_createTable(tblstyle, tblclass) {
    var tbl = document.createElement('table');
    if (tblstyle) tbl.setAttribute('style', tblstyle);
    if (tblclass) tbl.setAttribute('class', tblclass);
    return tbl;
}

/**
 * Adds a row to a given table
 *
 * @param tbl the table
 * @return the created row
 */
function mkt_addRow(tbl) {
    var tr = document.createElement('tr');
    tbl.appendChild(tr);
    return tr;
}

/**
 * adds a cell with content to a table row
 *
 * @param row the row to add the cell to
 * @param cont content of the cell
 * @return the created cell
 */
function mkt_addCell(row, cont) {
    var td = document.createElement('td');
    if (cont) {
        if ("string" == typeof cont) {
            td.appendChild(document.createTextNode(cont));
        } else if (cont instanceof HTMLElement) {
            td.appendChild(cont);
        } else {
            try {
                td.appendChild(cont);
            } catch (e) {
                td.appendChild(document.createTextNode(cont.toString()));
            }
        }
    }
    row.appendChild(td);
    return td;
}


function mkt_addError(msg) {
    var errid = 'errid' + Math.abs(Date.UTC(new Date()) * 100) + Math.abs(Math.random() * 1000);
    var el = mkt_createDiv(errid, null, 'border: 1px solid #666666; margin:3px; display:block; width:87%;');
    //el.style.border = errordiv.style.border;
    el.innerHTML = "<div style='display:inline;'>" + msg + "</div><div style='float:right;display:inline;'><input style='margin:0px;' type='image' src='" + mkt_strings.cancelimage + "' alt='" + mkt_strings.button_cancel_errmsg + "' title='" + mkt_strings.button_cancel_errmsg + "' onclick='mkt_removeMsg(\"" + errid + "\");' /></div>";
    errordiv.appendChild(el);
    mkt_setDisplayState(errordiv, 'block');
}


/*********************************************************************
 *                                                                   *
 * Tools                                                             *
 *                                                                   *
 *********************************************************************/


/**
 * changes the display state of a dom object
 *
 * @param obj the object, wich's state should be changed
 * @param state the new state
 */
function mkt_setDisplayState(obj, state) {

    if (typeof obj != 'undefined' && obj != null) {
        obj.style.display = state;
    }
}

/**
 * adds the tokens for all appropriate skill types to the given list
 *
 * @param skill the skill
 * @param list the list, where the tokens are added
 * @return the new list
 */
function addSkilltype(skill, list) {

    if (skill.type & mkt_WOD_SKILL_TYPE_INITIATIVE) {
        if (list.indexOf(mkt_strings.skilldata_initiativeskills) == -1) {
            list = list + mkt_strings.skilldata_initiativeskills.substr(1, 2);
        }
    }
    if (skill.type & mkt_WOD_SKILL_TYPE_PREROUND) {
        if (list.indexOf(mkt_strings.skilldata_preskills) == -1) {
            list = list + mkt_strings.skilldata_preskills.substr(1, 2);
        }
    }
    if (skill.type & mkt_WOD_SKILL_TYPE_ROUND) {
        if (list.indexOf(mkt_strings.skilldata_roundskills) == -1) {
            list = list + mkt_strings.skilldata_roundskills.substr(1, 2);
        }
    }

    if (skill.type & mkt_WOD_SKILL_TYPE_HEAL) {
        if (list.indexOf(mkt_strings.skilldata_healskills) == -1) {
            list = list + mkt_strings.skilldata_healskills.substr(1, 2);
        }
    }
    return list;
}

/**
 * checks, wether the given skill should be added to the skill list
 * in this version, only initiative, preround, round and heal skills are added.
 *
 * @param skill the skill
 * @return true, if the skill can be used in initiative, preround, round or heal, false otherwise
 */
function checkAddSkill(skill) {
    return ((skill.type & mkt_WOD_SKILL_TYPE_INITIATIVE) || (skill.type & mkt_WOD_SKILL_TYPE_PREROUND) || (skill.type & mkt_WOD_SKILL_TYPE_ROUND) || (skill.type & mkt_WOD_SKILL_TYPE_HEAL));
}

/*********************************************************************
 *                                                                   *
 * form functions and event handlers                                 *
 *                                                                   *
 *********************************************************************/

/**
 * Event handler for the change event of the weapon skill select
 */
function onweaponskillselect(evt) {
    var stat = document.getElementById(mkt_strings.id_hidden_statusweapon);
    if ((stat.firstChild.data != mkt_strings.status_weapon_skillselected) && (stat.firstChild.data != '')) {
        return;
    } else {
        stat.firstChild.data = mkt_strings.status_weapon_skillselected;
    }
    var me = document.getElementById(mkt_strings.id_select_skillforweapon);
    var oldsel = document.getElementById(mkt_strings.id_select_weaponold);
    var newsel = document.getElementById(mkt_strings.id_select_weaponnew);
    var selvalue = me.value;
    if (selvalue > -1) {
        var selindex = me.selectedIndex;
        var selnode = me.options[selindex];
        if (selnode) {
            var itemclassid = selnode.getAttribute('data');
            for (var i in oldsel.options) {
                var el = oldsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1) && (el.getAttribute('data').indexOf(',' + itemclassid + ',') == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
            for (var i in newsel.options) {
                var el = newsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1) && (el.getAttribute('data').indexOf(',' + itemclassid + ',') == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
        }
    } else {
        selvalue = -1 * selvalue;
        if (selvalue & (mkt_strings.optionvalue_allpreroundskills * -1)) {
            for (var i in oldsel.options) {
                var el = oldsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_preskills) == -1) && (el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
            for (var i in newsel.options) {
                var el = newsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_preskills) == -1) && (el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
        }
        if (selvalue & (mkt_strings.optionvalue_allroundskills * -1)) {
            for (var i in oldsel.options) {
                var el = oldsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_roundskills) == -1) && (el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
            for (var i in newsel.options) {
                var el = newsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_roundskills) == -1) && (el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
        }
        if (selvalue & (mkt_strings.optionvalue_allhealskills * -1)) {
            for (var i in oldsel.options) {
                var el = oldsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_healskills) == -1) && (el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
            for (var i in newsel.options) {
                var el = newsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_healskills) == -1) && (el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
        }
        if (selvalue & (mkt_strings.optionvalue_allinitiativeskills * -1)) {
            for (var i in oldsel.options) {
                var el = oldsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_initiativeskills) == -1) && (el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
            for (var i in newsel.options) {
                var el = newsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_initiativeskills) == -1) && (el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
        }
        if (selvalue & (mkt_strings.optionvalue_allskills * -1)) {
            stat.firstChild.data = '';
            for (var i in oldsel.options) {
                var el = oldsel.options[i];
                mkt_setDisplayState(el, 'block');
            }
            for (var i in newsel.options) {
                var el = newsel.options[i];
                mkt_setDisplayState(el, 'block');
            }
        }
    }
    if (oldsel.selectedIndex > -1 && oldsel.options[oldsel.selectedIndex].style.display == 'none') oldsel.selectedIndex = -1;
    if (newsel.selectedIndex > -1 && newsel.options[newsel.selectedIndex].style.display == 'none') newsel.selectedIndex = -1;
}

/**
 * Event handler for the change event of the old weapon select
 */
function onoldweaponselect(evt) {
    var stat = document.getElementById(mkt_strings.id_hidden_statusweapon);
    var skillsel = document.getElementById(mkt_strings.id_select_skillforweapon);
    var me = document.getElementById(mkt_strings.id_select_weaponold);
    if (me.selectedIndex == -1) {
        return;
    }
    var mysockets = document.getElementById(mkt_strings.id_select_weaponoldsocks);
    var newsel = document.getElementById(mkt_strings.id_select_weaponnew);
    var selvalue = me.value;
    var the_env = unsafeWindow.THE_ENV;
    var len = mysockets.options.length;
    for (var i = 0; i < len; i++) {
        mysockets.removeChild(mysockets.options[0]);
    }
    mkt_addSelectOption(mysockets, mkt_strings.optionvalue_nosocks, mkt_strings.option_auto, null);
    if (selvalue == mkt_strings.optionvalue_auto) {
        // if auto is selected, nothing else needs to be done here
        return;
    }
    if (selvalue > -1) {
        if (the_env.items[selvalue].haveSockets()) {
            var esocks = (typeof the_env.items[selvalue].equipped_sockets != undefined ? the_env.items[selvalue].equipped_sockets : '');
            var usocks = (typeof the_env.items[selvalue].unequipped_sockets != undefined ? the_env.items[selvalue].unequipped_sockets : '');
            var einmal = '';
            for (var i in esocks) {
                if (einmal.indexOf(esocks[i]) == -1) {
                    mkt_addSelectOption(mysockets, esocks[i], esocks[i], null);
                    einmal = einmal + '_' + esocks[i];
                }
            }
            for (var i in usocks) {
                if (einmal.indexOf(usocks[i]) == -1) {
                    mkt_addSelectOption(mysockets, usocks[i], '!! ' + usocks[i], null);
                    einmal = einmal + '_' + usocks[i];
                }
            }
        }
    }
    if ((stat.firstChild.data != mkt_strings.status_weapon_oldselected) && (stat.firstChild.data != '')) {
        return;
    } else {
        stat.firstChild.data = mkt_strings.status_weapon_oldselected;
    }
    if (selvalue > -1) {
        var classids = me.options[me.selectedIndex].getAttribute('data');
        for (var i in skillsel.options) {
            var el = skillsel.options[i];
            var data_ = el.getAttribute('data');
            if ((classids.indexOf(data_) != -1) || (data_ == mkt_strings.skilldata_all)) {
                mkt_setDisplayState(el, 'block');
            } else {
                mkt_setDisplayState(el, 'none');
            }
        }
        classids = classids.split(",");
        for (var i in newsel.options) {
            var el = newsel.options[i];
            if (classids[1] == mkt_strings.skilldata_all) {
                mkt_setDisplayState(el, 'block');
            } else {
                var data_ = el.getAttribute('data');
                if (data_ == mkt_strings.skilldata_all) {
                    mkt_setDisplayState(el, 'block');
                } else {
                    var found = false;
                    for (var j in classids) {
                        var aclassid = ',' + classids[j] + ',';
                        var test = mkt_strings.skilldata_list;
                        if (test.indexOf(aclassid) == -1) {
                            if (data_.indexOf(aclassid) != -1) {
                                found = true;
                                break;
                            }
                        }
                    }
                    if (found) {
                        mkt_setDisplayState(el, 'block');
                    } else {
                        mkt_setDisplayState(el, 'none');
                    }
                }
            }
        }
    } else {
        stat.firstChild.data = '';
        for (var i in skillsel.options) {
            var el = skillsel.options[i];
            mkt_setDisplayState(el, 'block');
        }
        for (var i in newsel.options) {
            var el = newsel.options[i];
            mkt_setDisplayState(el, 'block');
        }
    }
    if (skillsel.selectedIndex > -1 && skillsel.options[skillsel.selectedIndex].style.display == 'none') skillsel.selectedIndex = -1;
    if (newsel.selectedIndex > -1 && newsel.options[newsel.selectedIndex].style.display == 'none') newsel.selectedIndex = -1;
}


/**
 * Event handler for the change event of the new weapon select
 */
function onnewweaponselect(evt) {
    var stat = document.getElementById(mkt_strings.id_hidden_statusweapon);
    var skillsel = document.getElementById(mkt_strings.id_select_skillforweapon);
    var me = document.getElementById(mkt_strings.id_select_weaponnew);
    if (me.selectedIndex == -1) {
        return;
    }
    var mysockets = document.getElementById(mkt_strings.id_select_weaponnewsocks);
    var oldsel = document.getElementById(mkt_strings.id_select_weaponold);
    var selvalue = me.value;
    var the_env = unsafeWindow.THE_ENV;
    var len = mysockets.options.length;
    for (var i = 0; i < len; i++) {
        mysockets.removeChild(mysockets.options[0]);
    }
    mkt_addSelectOption(mysockets, mkt_strings.optionvalue_nosocks, mkt_strings.option_auto, null);
    if (selvalue == mkt_strings.optionvalue_auto) {
        // if auto is selected, nothing else needs to be done here
        return;
    }
    if (selvalue > -1) {
        if (the_env.items[selvalue].haveSockets()) {
            var esocks = (typeof the_env.items[selvalue].equipped_sockets != undefined ? the_env.items[selvalue].equipped_sockets : '');
            var usocks = (typeof the_env.items[selvalue].unequipped_sockets != undefined ? the_env.items[selvalue].unequipped_sockets : '');
            var einmal = '';
            for (var i in esocks) {
                if (einmal.indexOf(esocks[i]) == -1) {
                    mkt_addSelectOption(mysockets, esocks[i], esocks[i], null);
                    einmal = einmal + '_' + esocks[i];
                }
            }
            for (var i in usocks) {
                if (einmal.indexOf(usocks[i]) == -1) {
                    mkt_addSelectOption(mysockets, usocks[i], '!! ' + usocks[i], null);
                    einmal = einmal + '_' + usocks[i];
                }
            }
        }
    }


    if ((stat.firstChild.data != mkt_strings.status_weapon_newselected) && (stat.firstChild.data != '')) {
        return;
    } else {
        stat.firstChild.data = mkt_strings.status_weapon_newselected;
    }
    if (selvalue > -1) {
        var classids = me.options[me.selectedIndex].getAttribute('data');
        for (var i in skillsel.options) {
            var el = skillsel.options[i];
            var data_ = el.getAttribute('data');
            if ((classids.indexOf(data_) != -1) || (data_ == mkt_strings.skilldata_all)) {
                mkt_setDisplayState(el, 'block');
            } else {
                mkt_setDisplayState(el, 'none');
            }
        }
        classids = classids.split(",");
        for (var i in oldsel.options) {
            var el = oldsel.options[i];
            if (classids[1] == mkt_strings.skilldata_all) {
                mkt_setDisplayState(el, 'block');
            } else {
                var data_ = el.getAttribute('data');
                if (data_ == mkt_strings.skilldata_all) {
                    mkt_setDisplayState(el, 'block');
                } else {
                    var found = false;
                    for (var j in classids) {
                        var aclassid = ',' + classids[j] + ',';
                        var test = mkt_strings.skilldata_list;
                        if (test.indexOf(aclassid) == -1) {
                            if (data_.indexOf(aclassid) != -1) {
                                found = true;
                                break;
                            }
                        }
                    }
                    if (found) {
                        mkt_setDisplayState(el, 'block');
                    } else {
                        mkt_setDisplayState(el, 'none');
                    }
                }
            }
        }
    } else {
        stat.firstChild.data = '';
        for (var i in skillsel.options) {
            var el = skillsel.options[i];
            mkt_setDisplayState(el, 'block');
        }
        for (var i in oldsel.options) {
            var el = oldsel.options[i];
            mkt_setDisplayState(el, 'block');
        }
    }
    if (skillsel.selectedIndex > -1 && skillsel.options[skillsel.selectedIndex].style.display == 'none') skillsel.selectedIndex = -1;
    if (oldsel.selectedIndex > -1 && oldsel.options[oldsel.selectedIndex].style.display == 'none') oldsel.selectedIndex = -1;
}


/**
 * This function takes an action and replaces the item chosen by the old weapon select
 * with the item chosen by the new weapon select. When Sockets are given, they are changed as well.
 *
 * @param act the action
 * @param newsel the select element for the new weapon
 * @param oldsel the select element for the old weapon
 * @param newsockets the select element for the new weapon's sockets
 * @param oldsockets the select element for the old weapon's sockets
 */
function replaceItem(act, newsel, oldsel, newsockets, oldsockets) {
    var the_env = unsafeWindow.THE_ENV;
    var oldautoitem = oldsel.value == mkt_strings.optionvalue_auto;
    var newautoitem = newsel.value == mkt_strings.optionvalue_auto;
    if (oldautoitem && newautoitem) {
        mkt_addError(mkt_strings.error_cantHaveTwoAutoSettings + mkt_strings.label_weapon);
        return;
    }
    if (act.item && act.item != unsafeWindow.WOD_ITEM_AUTO && !oldautoitem && !newautoitem) {
        // item is set and neither olditem nor newitem are set to auto
        var check = true;
        if (oldsel.value != mkt_strings.optionvalue_novalue) {
            if (oldsel.value == act.item.id) { // the set item is the selected old item
                var check = true;
                var newsock = mkt_strings.optionvalue_nosocks;
                if (act.skill.use_sockets) {
                    // skill uses sockets for his weapon item
                    if (oldsockets.value != mkt_strings.optionvalue_nosocks) {
                        // oldsocket is not autosocket
                        if (act.socket != oldsockets.value) {
                            check = false;
                        } else {
                            newsock = newsockets.value;
                            check = true;
                        }
                    } else {
                        // oldsocket is autosocket
                        check = true;
                        newsock = newsockets.value;
                    }
                }
                if (!check) {
                    return;
                }
                var safeAmmo = act.ammo;
                var safeAmmoLength = act.item.ammoClassIds.length;
                var ammoClassList = ',';
                for (var i in act.item.ammoClassIds) {
                    ammoClassList += act.item.ammoClassIds[i] + ',';
                }
                act.setItem(the_env.items[newsel.value], newsock);
                if (act.item.ammoClassIds && act.item.ammoClassIds.length && act.item.ammoClassIds.length == safeAmmoLength) {
                    // prüfen, ob identische Klassen
                    var ok = true;
                    for (var i in act.item.ammoClassIds) {
                        if (ammoClassList.indexOf(',' + act.item.ammoClassIds[i] + ',') == -1) {
                            ok = false;
                            break;
                        }
                    }
                    if (ok) {
                        //alert(ammoClassList);
                        //act.ammo = safeAmmo;
                    }
                }
            }
        }
    } else if (oldautoitem && (!act.item || act.item == unsafeWindow.WOD_ITEM_AUTO)) {
        // olditem is auto item --> ammo needs not to be saved
        var newsock = '-';
        if (act.skill.use_sockets) {
            newsock = newsockets.value;
        }
        act.setItem(the_env.items[newsel.value], newsock);
    } else if (newautoitem && act.item && act.item != unsafeWindow.WOD_ITEM_AUTO) {
        if (oldsel.value == act.item.id) {
            var check = true;
            var newsock = mkt_strings.optionvalue_nosocks;
            if (act.skill.use_sockets) {
                // skill uses sockets for his weapon item
                if (oldsockets.value != mkt_strings.optionvalue_nosocks) {
                    // oldsocket is not autosocket
                    if (act.socket != oldsockets.value) {
                        check = false;
                    } else {
                        newsock = newsockets.value;
                        check = true;
                    }
                } else {
                    // oldsocket is autosocket
                    check = true;
                    newsock = newsockets.value;
                }
            }
            if (!check) {
                return;
            }
            act.setItem(null, mkt_strings.optionvalue_nosocks);
        }
    } else {
        return;
    }
}


/**
 * This function takes an level and replaces in the selected parts the items chosen by the old weapon select
 * with the item chosen by the new weapon select. When Sockets are given, they are changed as well.
 *
 * @param level the level
 * @param isStandard Must be true, if the level is the standard level - must not be true, if the level is not the standard level
 * @param newsel the select element for the new weapon
 * @param oldsel the select element for the old weapon
 * @param newsockets the select element for the new weapon's sockets
 * @param oldsockets the select element for the old weapon's sockets
 * @param skillid the id of the selected skill, if a skill is selected, -1 otherwise
 * @param doini true, when the initiative should be processed
 * @param dopreround true, when the preround should be processed
 * @param domainround true, when the main round should be processed
 * @param doheal true, when the healing settings should be processed
 */
function processLevel(level, isStandard, newsel, oldsel, newsockets, oldsockets, skillid, doini, dopreround, domainround, doheal) {
    if (level.overwriteStandard || isStandard) {
        if (doini) {
            if (level.initiative.skill && (skillid < 0 || level.initiative.skill.id == skillid)) {
                replaceItem(level.initiative, newsel, oldsel, newsockets, oldsockets);
            }
        }
        if (dopreround) {
            for (var j in level.preround) {
                var act = level.preround[j];
                if (!act.skill) continue;
                if (act.skill && (skillid < 0 || act.skill.id == skillid)) {
                    replaceItem(act, newsel, oldsel, newsockets, oldsockets);
                }
            }
        }
        if (domainround) {
            for (var j in level.round) {
                var act = level.round[j];
                if (!act.skill) continue;
                if (act.skill && (skillid < 0 || act.skill.id == skillid)) {
                    replaceItem(act, newsel, oldsel, newsockets, oldsockets);
                }
            }
        }
        if (doheal) {
            for (var j in level.heal.good) {
                var act = level.heal.good[j];
                if (!act.skill) continue;
                if (act.skill && (skillid < 0 || act.skill.id == skillid)) {
                    replaceItem(act, newsel, oldsel, newsockets, oldsockets);
                }
            }
            for (var j in level.heal.medium) {
                var act = level.heal.medium[j];
                if (!act.skill) continue;
                if (skillid < 0 || (act.skill && act.skill.id == skillid)) {
                    replaceItem(act, newsel, oldsel, newsockets, oldsockets);
                }
            }
            for (var j in level.heal.bad) {
                var act = level.heal.bad[j];
                if (!act.skill) continue;
                if (skillid < 0 || (act.skill && act.skill.id == skillid)) {
                    replaceItem(act, newsel, oldsel, newsockets, oldsockets);
                }
            }
        }
    }
}

/**
 * Event handler for the click event of the change weapon button
 */
function onweaponchangeclick(evt) {

    var skillsel = document.getElementById(mkt_strings.id_select_skillforweapon);
    if (skillsel.selectedIndex == -1) {
        mkt_addError(mkt_strings.error_allSelectsMustHaveValidSelection + mkt_strings.label_skill + ' / ' + mkt_strings.label_weapon);
        return;
    }
    var newsel = document.getElementById(mkt_strings.id_select_weaponnew);
    var oldsel = document.getElementById(mkt_strings.id_select_weaponold);
    if (newsel.selectedIndex == -1 || newsel.value == mkt_strings.optionvalue_novalue) {
        mkt_addError(mkt_strings.error_allSelectsMustHaveValidSelection + mkt_strings.label_new + ' / ' + mkt_strings.label_weapon);
        return;
    }
    if (oldsel.selectedIndex == -1 || oldsel.value == mkt_strings.optionvalue_novalue) {
        mkt_addError(mkt_strings.error_allSelectsMustHaveValidSelection + mkt_strings.label_old + ' / ' + mkt_strings.label_weapon);
        return;
    }
    if (newsel.value == mkt_strings.optionvalue_auto && oldsel.value == mkt_strings.optionvalue_auto) {
        mkt_addError(mkt_strings.error_cantHaveTwoAutoSettings + mkt_strings.label_weapon);
        return;
    }
    if ((oldsel.value == mkt_strings.optionvalue_auto) && ((skillsel.value * 1) < 0)) {
        mkt_addError(mkt_strings.error_whenAutoItemSkillMustBeExplicit + mkt_strings.label_new + ' / ' + mkt_strings.label_weapon);
        return;
    }

    var oldsockets = document.getElementById(mkt_strings.id_select_weaponoldsocks);
    if (oldsockets.selectedIndex == -1) {
        mkt_addError(mkt_strings.error_allSelectsMustHaveValidSelection + mkt_strings.label_old + '-' + mkt_strings.label_socket + ' / ' + mkt_strings.label_weapon);
        return;
    }
    var newsockets = document.getElementById(mkt_strings.id_select_weaponnewsocks);
    if (newsockets.selectedIndex == -1) {
        mkt_addError(mkt_strings.error_allSelectsMustHaveValidSelection + mkt_strings.label_new + '-' + mkt_strings.label_socket + ' / ' + mkt_strings.label_weapon);
        return;
    }

    var skillid = skillsel.value < 0 ? -1 : skillsel.value;
    var doini = skillsel.value == mkt_strings.optionvalue_allinitiativeskills || skillsel.value == mkt_strings.optionvalue_allskills || skillid > 0;
    var dopreround = skillsel.value == mkt_strings.optionvalue_allpreroundskills || skillsel.value == mkt_strings.optionvalue_allskills || skillsel.value == mkt_strings.optionvalue_allpreroundandroundskills || skillid > 0;
    var domainround = skillsel.value == mkt_strings.optionvalue_allroundskills || skillsel.value == mkt_strings.optionvalue_allskills || skillsel.value == mkt_strings.optionvalue_allpreroundandroundskills || skillid > 0;
    var doheal = skillsel.value == mkt_strings.optionvalue_allhealskills || skillsel.value == mkt_strings.optionvalue_allskills || skillid > 0;

    var wod_cfg = unsafeWindow.WOD_CFG;
    // First process the dungeon settings ...
    processLevel(wod_cfg.dungeon.standard, true, newsel, oldsel, newsockets, oldsockets, skillid, doini, dopreround, domainround, doheal);
    for (var i in wod_cfg.dungeon.levels) {
        var level = wod_cfg.dungeon.levels[i];
        processLevel(level, false, newsel, oldsel, newsockets, oldsockets, skillid, doini, dopreround, domainround, doheal);
    }
    // ... and then the duel settings
    processLevel(wod_cfg.duel.hero, false, newsel, oldsel, newsockets, oldsockets, skillid, doini, dopreround, domainround, doheal);
    processLevel(wod_cfg.duel.group, false, newsel, oldsel, newsockets, oldsockets, skillid, doini, dopreround, domainround, doheal);
    if (wod_cfg.duel.clan) processLevel(wod_cfg.duel.clan, false, newsel, oldsel, newsockets, oldsockets, skillid, doini, dopreround, domainround, doheal);
    if (wod_cfg.duel.clanquest) processLevel(wod_cfg.duel.clanquest, false, newsel, oldsel, newsockets, oldsockets, skillid, doini, dopreround, domainround, doheal);

    // refresh the display
    for (var i in myuls) {
        var ul = myuls[i];
        if (ul.parentNode.style.display == 'block') {
            var lis = ul.getElementsByTagName('li');
            for (var j in lis) {
                if (lis[j].className == 'selected') {
                    var evt = document.createEvent("MouseEvents");
                    evt.initMouseEvent("click", true, true, document.defaultView, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
                    lis[j].dispatchEvent(evt);
                }
            }
        }
    }
}

/**
 * checks, whether a key is set in an array or an object
 *
 * @param ar the array or the object
 * @param key the key to be checked
 * @return true, when the key is set in the array, otherwise false
 */
function isset(ar, key) {

    for (i in ar) {
        if (i == key) {
            return true
        }
    }
    return false
}

/**
 * checks, whether a given action uses any ammo, adds the item ids, item class ids and skill ids to the given lists
 * and adds skills to the ammo skill select and items to the ammo old item select element.
 *
 * @param act the action
 * @param skillsel the ammo skill select element
 * @param oldsel the ammo old item select element
 * @param lists array containing the id-lists - the lists will be changed by the function!
 * @return nothing, but stores the result in param lists
 */
function doCheckActionForAmmo(act, skillsel, oldsel, newsel, lists) {
    if (!act.skill) return;
    itemclasslist = lists[0];
    var skillitemclasslist = ',';
    if (act.item && act.item.ammoClassIds && act.item.ammoClassIds.length > 0) {
        // item can use ammunition
        var skilloption;
        if (lists[2].indexOf(',' + act.skill.id + ',') == -1) {
            skilloption = mkt_addSelectOption(skillsel, act.skill.id, act.skill.name, skillitemclasslist);
            lists[2] += act.skill.id + ',';
        } else {
            for (var i in skillsel.options) {
                if (skillsel.options[i].value == act.skill.id) {
                    skilloption = skillsel.options[i];
                    skillitemclasslist = skilloption.getAttribute('data');
                }
            }
        }
        for (var itemClassId in act.item.ammoClasses) {
            // save the allowed ammunition item class ids
            if (lists[0].indexOf(',' + itemClassId + ',') == -1) {
                lists[0] += itemClassId + ',';
            }
            if (isset(act.ammo, itemClassId)) {
                // ammunition is set
                var ammoItem = act.ammo[itemClassId];
                var classlist = ',';
                // find all itemclasses of the ammunition item
                for (var j in ammoItem.classes) {
                    classlist += ammoItem.classes[j] + ',';
                    /*if (skillitemclasslist.indexOf(',' + ammoItem.classes[j] + ',') == -1) {
                      skillitemclasslist += ammoItem.classes[j] + ',';
                    }*/
                }
                if (lists[1].indexOf(',' + ammoItem.id + ',') == -1) {
                    lists[1] += ',' + ammoItem.id + ',';
                    var ids = addSkilltype(act.skill, classlist);
                    mkt_addSelectOption(oldsel, ammoItem.id, ammoItem.name, ids);
                }
            }
            if (skillitemclasslist.indexOf(',' + itemClassId + ',') == -1) {
                skillitemclasslist += itemClassId + ',';
            }
            var tmpitems = unsafeWindow.THE_ENV.itemClasses[itemClassId]; // list of items in this itemclass
            for (var i in tmpitems) {  // for every item
                var anitem = tmpitems[i];
                if (lists[3].indexOf(',' + anitem.id + ',') == -1) { // is new item
                    lists[3] += anitem.id + ',';
                    var ids = addSkilltype(act.skill, ',' + itemClassId + ',');  // result: ",id,prhi,"
                    var op1 = mkt_addSelectOption(newsel, anitem.id, anitem.name, ids);
                    lists[4][anitem.id] = op1; // save the option elements for this item
                } else { // this item has already options
                    var op1 = lists[4][anitem.id];
                    var dt = op1.getAttribute('data');
                    if (dt.indexOf(itemClassId) == -1) {
                        dt += itemClassId + ',';
                    }
                    dt = addSkilltype(act.skill, dt);  // result: ,id of skill1,prhi of skill 1,id of skill2, prhi of skill2,
                    op1.setAttribute('data', dt);
                }
            }

        }
        skilloption.setAttribute('data', skillitemclasslist);
    }
}


/**
 * checks, whether a given level uses any ammo, adds the item ids, item class ids and skill ids to the given lists
 * and adds skills to the ammo skill select and items to the ammo old item select element.
 *
 * @param level the level
 * @param skillsel the ammo skill select element
 * @param oldsel the ammo old item select element
 * @param lists array containing the id-lists - the lists will be changed by the function!
 * @return nothing, but stores the result in param lists
 */
function doCheckLevelForAmmo(level, standard, skillsel, oldsel, newsel, lists) {
    if (level.overwriteStandard || standard) {

        // check initiative
        var act = level.initiative;
        doCheckActionForAmmo(act, skillsel, oldsel, newsel, lists);

        // check preround
        for (var i in level.preround) {
            act = level.preround[i];
            doCheckActionForAmmo(act, skillsel, oldsel, newsel, lists);
        }

        // check main round
        for (var i in level.round) {
            act = level.round[i];
            doCheckActionForAmmo(act, skillsel, oldsel, newsel, lists);
        }

        // check healing settings
        if (level.heal.good) {
            for (var i in level.heal.good) {
                act = level.heal.good[i];
                doCheckActionForAmmo(act, skillsel, oldsel, newsel, lists);
            }
        }
        if (level.heal.medium) {
            for (var i in level.heal.medium) {
                act = level.heal.medium[i];
                doCheckActionForAmmo(act, skillsel, oldsel, newsel, lists);
            }
        }
        if (level.heal.bad) {
            for (var i in level.heal.bad) {
                act = level.heal.bad[i];
                doCheckActionForAmmo(act, skillsel, oldsel, newsel, lists);
            }
        }
    }
}

/**
 * refreshs the ammunition lists with the current settings in the config
 * it's necessary, because the possible old ammunition items can change drastically by changing the used items for skills
 *
 */
function doRefreshAmmunition() {
    var skillsel = document.getElementById(mkt_strings.id_select_skillforammo);
    var oldsel = document.getElementById(mkt_strings.id_select_ammoold);
    var newsel = document.getElementById(mkt_strings.id_select_ammonew);
    var l = skillsel.options.length;
    for (var i = 0; i < l; i++) {
        skillsel.removeChild(skillsel.options[0]);
    }
    l = oldsel.options.length;
    for (var i = 0; i < l; i++) {
        oldsel.removeChild(oldsel.options[0]);
    }
    l = newsel.options.length;
    for (var i = 0; i < l; i++) {
        newsel.removeChild(newsel.options[0]);
    }
    mkt_addSelectOption(skillsel, mkt_strings.optionvalue_allskills, mkt_strings.option_allskills, mkt_strings.skilldata_all);
    mkt_addSelectOption(skillsel, mkt_strings.optionvalue_allpreroundandroundskills, mkt_strings.option_allpreroundandroundskills, mkt_strings.skilldata_roundskills.substr(0, 2) + mkt_strings.skilldata_preskills);
    mkt_addSelectOption(skillsel, mkt_strings.optionvalue_allroundskills, mkt_strings.option_allroundskills, mkt_strings.skilldata_roundskills);
    mkt_addSelectOption(skillsel, mkt_strings.optionvalue_allpreroundskills, mkt_strings.option_allpreroundskills, mkt_strings.skilldata_preskills);
    mkt_addSelectOption(skillsel, mkt_strings.optionvalue_allhealskills, mkt_strings.option_allhealskills, mkt_strings.skilldata_healskills);
    mkt_addSelectOption(skillsel, mkt_strings.optionvalue_allinitiativeskills, mkt_strings.option_allinitiativeskills, mkt_strings.skilldata_initiativeskills);
    mkt_addSelectOption(oldsel, mkt_strings.optionvalue_novalue, mkt_strings.option_none, mkt_strings.skilldata_all);
    mkt_addSelectOption(newsel, mkt_strings.optionvalue_novalue, mkt_strings.option_none, mkt_strings.skilldata_all);
    mkt_addSelectOption(oldsel, mkt_strings.optionvalue_auto, mkt_strings.option_auto, mkt_strings.skilldata_all);
    mkt_addSelectOption(newsel, mkt_strings.optionvalue_auto, mkt_strings.option_auto, mkt_strings.skilldata_all);

    var the_env = unsafeWindow.THE_ENV;
    var wod_cfg = unsafeWindow.WOD_CFG;

    // first check the config for used items and skills
    var itemclasslist = ',';
    var itemlist = ',';
    var itemnewlist = ',';
    var skillidlist = ',';
    var optionslist = new Object();
    var lists = new Array();
    lists.push(itemclasslist);
    lists.push(itemlist);
    lists.push(skillidlist);
    lists.push(itemnewlist);
    lists.push(optionslist);
    doCheckLevelForAmmo(wod_cfg.dungeon.standard, true, skillsel, oldsel, newsel, lists);
    for (var i in wod_cfg.dungeon.levels) {
        doCheckLevelForAmmo(wod_cfg.dungeon.levels[i], false, skillsel, oldsel, newsel, lists);
    }
    doCheckLevelForAmmo(wod_cfg.duel.hero, false, skillsel, oldsel, newsel, lists);
    doCheckLevelForAmmo(wod_cfg.duel.group, false, skillsel, oldsel, newsel, lists);
    if (wod_cfg.duel.clan) doCheckLevelForAmmo(wod_cfg.duel.clan, false, skillsel, oldsel, newsel, lists);
    if (wod_cfg.duel.clanquest) doCheckLevelForAmmo(wod_cfg.duel.clanquest, false, skillsel, oldsel, newsel, lists);

    // then find compatible items for the new item select:
    /* itemclasslist = lists[0];
     itemlist = lists[1];
     var newitemlist = ',';
     for (var i in the_env.items) {
       var anitem = the_env.items[i];
       var additem = false;
       var classlist = ',';
       for (var j in anitem.classes) {
         if (itemclasslist.indexOf(',' + anitem.classes[j] + ',') > -1) {
           additem = true;
         }
         classlist += anitem.classes[j] + ',';
       }
       if (additem && newitemlist.indexOf(',' + anitem.id + ',') == -1) {
         newitemlist += ',' + anitem.id + ',';
         mkt_addSelectOption(newsel, anitem.id, anitem.name, classlist + mkt_strings.skilldata_roundskills.substr(1,2) + mkt_strings.skilldata_preskills.substr(1,2) + mkt_strings.skilldata_healskills.substr(1,2) + mkt_strings.skilldata_initiativeskills.substr(1,2));
       }
     }*/
}

/**
 * Event handler for the change event of the change ammo skill select
 */
function onammoskillselect(evt) {
    var stat = document.getElementById(mkt_strings.id_hidden_statusammo);
    if ((stat.firstChild.data != mkt_strings.status_ammo_skillselected) && (stat.firstChild.data != '')) {
        return;
    } else {
        stat.firstChild.data = mkt_strings.status_ammo_skillselected;
    }
    var me = document.getElementById(mkt_strings.id_select_skillforammo);
    var oldsel = document.getElementById(mkt_strings.id_select_ammoold);
    var newsel = document.getElementById(mkt_strings.id_select_ammonew);
    var selvalue = me.value;
    if (selvalue > -1) {
        var selindex = me.selectedIndex;
        var selnode = me.options[selindex];
        if (selnode) {
            var itemclassids = selnode.getAttribute('data').split(",");
            for (var i in oldsel.options) {
                var el = oldsel.options[i];
                var ok = false;
                for (var j in itemclassids) {
                    var itemclassid = ',' + itemclassids[j] + ',';
                    if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_all) > -1) || (el.getAttribute('data').indexOf(itemclassid) > -1)) {
                        ok = true;
                        break;
                    }
                }
                if (!ok) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
            for (var i in newsel.options) {
                var el = newsel.options[i];
                var ok = false;
                for (var j in itemclassids) {
                    var itemclassid = ',' + itemclassids[j] + ',';
                    if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_all) > -1) || (el.getAttribute('data').indexOf(itemclassid) > -1)) {
                        ok = true;
                        break;
                    }
                }
                if (!ok) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
        }
    } else {
        selvalue = -1 * selvalue;
        if (selvalue & (mkt_strings.optionvalue_allpreroundskills * -1)) {
            for (var i in oldsel.options) {
                var el = oldsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_preskills) == -1) && (el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
            for (var i in newsel.options) {
                var el = newsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_preskills) == -1) && (el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
        }
        if (selvalue & (mkt_strings.optionvalue_allroundskills * -1)) {
            for (var i in oldsel.options) {
                var el = oldsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_roundskills) == -1) && (el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
            for (var i in newsel.options) {
                var el = newsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_roundskills) == -1) && (el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
        }
        if (selvalue & (mkt_strings.optionvalue_allhealskills * -1)) {
            for (var i in oldsel.options) {
                var el = oldsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_healskills) == -1) && (el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
            for (var i in newsel.options) {
                var el = newsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_healskills) == -1) && (el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
        }
        if (selvalue & (mkt_strings.optionvalue_allinitiativeskills * -1)) {
            for (var i in oldsel.options) {
                var el = oldsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_initiativeskills) == -1) && (el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
            for (var i in newsel.options) {
                var el = newsel.options[i];
                if ((el.getAttribute('data').indexOf(mkt_strings.skilldata_initiativeskills) == -1) && (el.getAttribute('data').indexOf(mkt_strings.skilldata_all) == -1)) {
                    mkt_setDisplayState(el, 'none');
                } else {
                    mkt_setDisplayState(el, 'block');
                }
            }
        }
        if (selvalue & (mkt_strings.optionvalue_allskills * -1)) {
            stat.firstChild.data = '';
            for (var i in oldsel.options) {
                var el = oldsel.options[i];
                mkt_setDisplayState(el, 'block');
            }
            for (var i in newsel.options) {
                var el = newsel.options[i];
                mkt_setDisplayState(el, 'block');
            }
        }
    }
    if (oldsel.selectedIndex > -1 && oldsel.options[oldsel.selectedIndex].style.display == 'none') oldsel.selectedIndex = -1;
    if (newsel.selectedIndex > -1 && newsel.options[newsel.selectedIndex].style.display == 'none') newsel.selectedIndex = -1;
}

/**
 * Event handler for the change event of the change old ammo item select
 */
function onoldammoselect(evt) {
    var stat = document.getElementById(mkt_strings.id_hidden_statusammo);
    var skillsel = document.getElementById(mkt_strings.id_select_skillforammo);
    var me = document.getElementById(mkt_strings.id_select_ammoold);
//  var mysockets = document.getElementById(mkt_strings.selectammooldsocksid);     // prepared for config with socks in ammunition
    var newsel = document.getElementById(mkt_strings.id_select_ammonew);
    var selvalue = me.value;
    var the_env = unsafeWindow.THE_ENV;
    /*  var len = mysockets.options.length;         // prepared for config with socks in ammunition
      for (var i=0;i<len; i++) {
        mysockets.removeChild(mysockets.options[0]);
      }
      mkt_addSelectOption(mysockets, mkt_strings.optionvalue_nosocks, mkt_strings.option_auto, null);
        if (selvalue>-1) {
        if (the_env.items[selvalue].haveSockets()) {
          var esocks = (typeof the_env.items[selvalue].equipped_sockets != undefined?the_env.items[selvalue].equipped_sockets:'');
          var usocks = (typeof the_env.items[selvalue].unequipped_sockets != undefined?the_env.items[selvalue].unequipped_sockets:'');
          var einmal = '';
          for (var i in esocks) {
            if(einmal.indexOf(esocks[i])==-1) {
              mkt_addSelectOption(mysockets, esocks[i], esocks[i], null);
              einmal = einmal + '_' + esocks[i];
            }
          }
          for (var i in usocks) {
            if(einmal.indexOf(esocks[i])==-1) {
              mkt_addSelectOption(mysockets, usocks[i], '!! ' + usocks[i], null);
              einmal = einmal + '_' + esocks[i];
            }
          }
        }
      }*/
    if (selvalue == mkt_strings.optionvalue_auto) {
        // if auto is selected, nothing else needs to be done
        return;
    }
    if ((stat.firstChild.data != mkt_strings.status_ammo_oldselected) && (stat.firstChild.data != '')) {
        return;
    } else {
        stat.firstChild.data = mkt_strings.status_ammo_oldselected;
    }
    var z = 1;
    if (selvalue > -1) {
        var classids = me.options[me.selectedIndex].getAttribute('data');
        for (var i in skillsel.options) {
            var el = skillsel.options[i];
            var data_ = el.getAttribute('data').split(",");
            var ok = false;
            for (var i in data_) {
                var anid = ',' + data_[i] + ',';
                if ((classids.indexOf(anid) != -1) || (anid == mkt_strings.skilldata_all)) {
                    ok = true;
                }
            }
            if (ok) {
                mkt_setDisplayState(el, 'block');
            } else {
                mkt_setDisplayState(el, 'none');
            }
        }
        classids = classids.split(",");
        for (var i in newsel.options) {
            var el = newsel.options[i];
            if (classids[1] == mkt_strings.skilldata_all) {
                mkt_setDisplayState(el, 'block');
            } else {
                var data_ = el.getAttribute('data');
                if (data_ == mkt_strings.skilldata_all) {
                    mkt_setDisplayState(el, 'block');
                } else {
                    var found = false;
                    for (var j in classids) {
                        var aclassid = ',' + classids[j] + ',';
                        var test = mkt_strings.skilldata_list;
                        if (test.indexOf(aclassid) == -1) {
                            if (data_.indexOf(aclassid) != -1) {
                                found = true;
                                break;
                            }
                        }
                    }
                    if (found) {
                        mkt_setDisplayState(el, 'block');
                    } else {
                        mkt_setDisplayState(el, 'none');
                    }
                }
            }
        }
    } else {
        stat.firstChild.data = '';
        for (var i in skillsel.options) {
            var el = skillsel.options[i];
            mkt_setDisplayState(el, 'block');
        }
        for (var i in newsel.options) {
            var el = newsel.options[i];
            mkt_setDisplayState(el, 'block');
        }
    }
    if (skillsel.selectedIndex > -1 && skillsel.options[skillsel.selectedIndex].style.display == 'none') skillsel.selectedIndex = -1;
    if (newsel.selectedIndex > -1 && newsel.options[newsel.selectedIndex].style.display == 'none') newsel.selectedIndex = -1;
}

/**
 * Event handler for the change event of the change new ammo item select
 */
function onnewammoselect(evt) {
    // Alle Items ausblenden in oldammo, die nicht diese Itemklassen haben & alle Fertigkeiten ausblenden, die nicht diese itemklasse zulassen als ammo
    // Bei newweaponsocks die sockets anzeigen
    var stat = document.getElementById(mkt_strings.id_hidden_statusammo);
    var skillsel = document.getElementById(mkt_strings.id_select_skillforammo);
    var me = document.getElementById(mkt_strings.id_select_ammonew);
//  var mysockets = document.getElementById(mkt_strings.selectammooldsocksid);        // prepared for config with socks in ammunition
    var oldsel = document.getElementById(mkt_strings.id_select_ammoold);
    var selvalue = me.value;
    var the_env = unsafeWindow.THE_ENV;
    /*  var len = mysockets.options.length;                   // prepared for config with socks in ammunition
      for (var i=0;i<len; i++) {
        mysockets.removeChild(mysockets.options[0]);
      }
      mkt_addSelectOption(mysockets, mkt_strings.optionvalue_nosocks, mkt_strings.option_auto, null);
        if (selvalue>-1) {
        if (the_env.items[selvalue].haveSockets()) {
          var esocks = (typeof the_env.items[selvalue].equipped_sockets != undefined?the_env.items[selvalue].equipped_sockets:'');
          var usocks = (typeof the_env.items[selvalue].unequipped_sockets != undefined?the_env.items[selvalue].unequipped_sockets:'');
          var einmal = '';
          for (var i in esocks) {
            if(einmal.indexOf(esocks[i])==-1) {
              mkt_addSelectOption(mysockets, esocks[i], esocks[i], null);
              einmal = einmal + '_' + esocks[i];
            }
          }
          for (var i in usocks) {
            if(einmal.indexOf(esocks[i])==-1) {
              mkt_addSelectOption(mysockets, usocks[i], '!! ' + usocks[i], null);
              einmal = einmal + '_' + esocks[i];
            }
          }
        }
      }*/
    if (selvalue == mkt_strings.optionvalue_auto) {
        // if auto was selected, nothing else needs to be done
        return;
    }
    if ((stat.firstChild.data != mkt_strings.status_ammo_newselected) && (stat.firstChild.data != '')) {
        return;
    } else {
        stat.firstChild.data = mkt_strings.status_ammo_newselected;
    }
    if (selvalue > -1) {
        var classids = me.options[me.selectedIndex].getAttribute('data');
        for (var i in skillsel.options) {
            var el = skillsel.options[i];
            var data_ = el.getAttribute('data').split(",");
            var ok = false;
            for (var i in data_) {
                var anid = ',' + data_[i] + ',';
                if ((classids.indexOf(anid) != -1) || (anid == mkt_strings.skilldata_all)) {
                    ok = true;
                }
            }
            if (ok) {
                mkt_setDisplayState(el, 'block');
            } else {
                mkt_setDisplayState(el, 'none');
            }
        }
        classids = classids.split(",");
        for (var i in oldsel.options) {
            var el = oldsel.options[i];
            if (classids[1] == mkt_strings.skilldata_all) {
                mkt_setDisplayState(el, 'block');
            } else {
                var data_ = el.getAttribute('data');
                if (data_ == mkt_strings.skilldata_all) {
                    mkt_setDisplayState(el, 'block');
                } else {
                    var found = false;
                    for (var j in classids) {
                        var aclassid = ',' + classids[j] + ',';
                        var test = mkt_strings.skilldata_list;
                        if (test.indexOf(aclassid) == -1) {
                            if (data_.indexOf(aclassid) != -1) {
                                found = true;
                                break;
                            }
                        }
                    }
                    if (found) {
                        mkt_setDisplayState(el, 'block');
                    } else {
                        mkt_setDisplayState(el, 'none');
                    }
                }
            }
        }
    } else {
        stat.firstChild.data = '';
        for (var i in skillsel.options) {
            var el = skillsel.options[i];
            mkt_setDisplayState(el, 'block');
        }
        for (var i in oldsel.options) {
            var el = oldsel.options[i];
            mkt_setDisplayState(el, 'block');
        }
    }
    if (skillsel.selectedIndex > -1 && skillsel.options[skillsel.selectedIndex].style.display == 'none') skillsel.selectedIndex = -1;
    if (oldsel.selectedIndex > -1 && oldsel.options[oldsel.selectedIndex].style.display == 'none') oldsel.selectedIndex = -1;
}

/**
 * This function takes an action and replaces the ammo item chosen by the old ammo select
 * with the item chosen by the new ammo select. Sockets support is prepared but is not ready yet.
 *
 * @param act the action
 * @param newsel the select element for the new ammo item
 * @param oldsel the select element for the old ammo item
 * @param newsockets the select element for the new weapon's sockets
 * @param oldsockets the select element for the old weapon's sockets
 */
function replaceAmmo(act, newsel, oldsel /*, newsockets, oldsockets */) {
    var the_env = unsafeWindow.THE_ENV;
    var oldautoitem = oldsel.value == mkt_strings.optionvalue_auto;
    var newautoitem = newsel.value == mkt_strings.optionvalue_auto;
    if (oldautoitem && newautoitem) {
        mkt_addError(mkt_strings.error_cantHaveTwoAutoSettings + mkt_strings.label_weapon);
        return;
    }
    if (act.item) {
        if (act.ammo && !(oldautoitem || newautoitem)) {
            for (var i in act.ammo) {
                if (act.ammo[i] && oldsel.value == act.ammo[i].id) {
                    // this ammo should be replaced
                    // i is the id of the itemclass of the required ammunition type
                    var newitem = the_env.items[newsel.value];
                    var ok = false;
                    for (var j in newitem.classes) {
                        if (i == newitem.classes[j]) {
                            ok = true;
                            break;
                        }
                    }
                    if (ok) {
                        act.ammo[i] = newitem;
                    }
                }
            }
        } else if (act.ammo && oldautoitem) {
            var theids = new Array();
            var newclassids = (newsel.selectedIndex > -1 ? newsel.options[newsel.selectedIndex].getAttribute('data') : '');
            for (var i in act.item.ammoClassIds) {
                if (newclassids.indexOf(act.item.ammoClassIds[i]) > -1) {
                    theids.push(act.item.ammoClassIds[i]);
                }
            }
            if (theids.length == 0) {
                GM_log(mkt_strings.thisshouldnothappen);
                return;
            }
            for (var i in theids) {
                theclassid = theids[i];
                if (act.ammo[theclassid] == undefined || act.ammo[theclassid] == null || act.ammo[theclassid] == unsafeWindow.WOD_ITEM_AUTO) {
                    // the ammo slot is empty and the selected new ammunition has the right itemclass id
                    // theclassid is the id of the itemclass of the required ammunition type
                    var newitem = the_env.items[newsel.value];
                    act.ammo[theclassid] = newitem;
                }
            }
        } else if (act.ammo && newautoitem) {
            for (var i in act.ammo) {
                if (act.ammo[i] && oldsel.value == act.ammo[i].id) {
                    // this ammo should be replaced with autoselect
                    // i is the id of the itemclass of ammunition type, that will be removed.
                    var newammo = new Object();
                    for (var j in act.ammo) {
                        if (j != i) {
                            newammo[j] = act.ammo[j];
                        }
                    }
                    act.setAmmo(newammo);
                }
            }
        } else {
            return;
        }
    }
    /*    var check = true;
        olditem = (oldsel.value == mkt_strings.option_autovalue ? null : oldsel.value);
        if (oldsel.value != mkt_strings.optionvalue_novalue) {
          if (olditem == act.item.id) {
            var check = true;
            var newsock = '-';
            if (act.skill.use_sockets) {
              if (oldsockets.selectedIndex==-1 || newsockets.selectedIndex == -1 || act.socket != oldsockets.value) {
                check = false;
              } else {
                newsock = newsockets.value;
              }
            }
            if (!check) {
              // Fehlermeldung anzeigen
              return;
            }
            var safeAmmo = act.ammo;
            var safeAmmoLength = act.item.ammoClassIds.length;
            var ammoClassList = ',';
            for (var i in act.item.ammoClassIds) {
              ammoClassList += act.item.ammoClassIds[i] + ',';
            }
            act.setItem(the_env.items[newsel.value], newsock);
            if (act.item.ammoClassIds && act.item.ammoClassIds.length && act.item.ammoClassIds.length == safeAmmoLength) {
              // prüfen, ob identische Klassen
              var ok = true;
              for (var i in act.item.ammoClassIds) {
                if (ammoClassList.indexOf(',' + act.item.ammoClassIds[i] + ',') == -1) {
                  ok = false;
                  break;
                }
              }
              if (ok) {
                act.ammo = safeAmmo;
              }
            }
          }
        }*/
}


/**
 * This function takes an level and replaces the ammo item chosen by the old ammo select
 * with the item chosen by the new ammo select. Sockets support is prepared but is not activated yet.
 *
 * @param level the level
 * @param isStandard Must be true, if the level is the standard level - must not be true, if the level is not the standard level
 * @param newsel the select element for the new ammo item
 * @param oldsel the select element for the old ammo item
 * @param newsockets the select element for the new weapon's sockets
 * @param oldsockets the select element for the old weapon's sockets
 * @param skilldi the id of the selected skill, if a skill is selected, -1 otherwise
 * @param doini true, when the initiative should be processed
 * @param dopreround true, when the preround should be processed
 * @param domainround true, when the main round should be processed
 * @param doheal true, when the healing settings should be processed
 */
function processLevelAmmo(level, isStandard, newsel, oldsel, /*newsockets, oldsockets, */ skillid, doini, dopreround, domainround, doheal) {
    if (level.overwriteStandard || isStandard) {
        if (doini) {
            if (skillid < 0 || (level.initiative.skill && level.initiative.skill.id == skillid)) {
                replaceAmmo(level.initiative, newsel, oldsel/* , newsockets, oldsockets */);
            }
        }
        if (dopreround) {
            for (var j in level.preround) {
                var act = level.preround[j];
                if (skillid < 0 || (act.skill && act.skill.id == skillid)) {
                    replaceAmmo(act, newsel, oldsel/* , newsockets, oldsockets */);
                }
            }
        }
        if (domainround) {
            for (var j in level.round) {
                var act = level.round[j];
                if (skillid < 0 || (act.skill && act.skill.id == skillid)) {
                    replaceAmmo(act, newsel, oldsel/* , newsockets, oldsockets */);
                }
            }
        }
        if (doheal) {
            for (var j in level.heal.good) {
                var act = level.heal.good[j];
                if (skillid < 0 || (act.skill && act.skill.id == skillid)) {
                    replaceAmmo(act, newsel, oldsel/* , newsockets, oldsockets */);
                }
            }
            for (var j in level.heal.medium) {
                var act = level.heal.medium[j];
                if (skillid < 0 || (act.skill && act.skill.id == skillid)) {
                    replaceAmmo(act, newsel, oldsel/* , newsockets, oldsockets */);
                }
            }
            for (var j in level.heal.bad) {
                var act = level.heal.bad[j];
                if (skillid < 0 || (act.skill && act.skill.id == skillid)) {
                    replaceAmmo(act, newsel, oldsel/* , newsockets, oldsockets */);
                }
            }
        }
    }
}


/**
 * Event handler for the click event of the ammo change button
 */
function onammochangeclick(evt) {

    var skillsel = document.getElementById(mkt_strings.id_select_skillforammo);
    if (skillsel.selectedIndex == -1) {
        mkt_addError(mkt_strings.error_allSelectsMustHaveValidSelection + mkt_strings.label_skill + ' / ' + mkt_strings.label_ammo);
        return;
    }
    var newsel = document.getElementById(mkt_strings.id_select_ammonew);
    var oldsel = document.getElementById(mkt_strings.id_select_ammoold);
    if (newsel.selectedIndex == -1 || newsel.value == mkt_strings.optionvalue_novalue) {
        mkt_addError(mkt_strings.error_allSelectsMustHaveValidSelection + mkt_strings.label_new + ' / ' + mkt_strings.label_ammo);
        return;
    }
    if (oldsel.selectedIndex == -1 || oldsel.value == mkt_strings.optionvalue_novalue) {
        mkt_addError(mkt_strings.error_allSelectsMustHaveValidSelection + mkt_strings.label_old + ' / ' + mkt_strings.label_ammo);
        return;
    }
    if (newsel.value == mkt_strings.optionvalue_auto && oldsel.value == mkt_strings.optionvalue_auto) {
        mkt_addError(mkt_strings.error_cantHaveTwoAutoSettings + mkt_strings.label_ammo);
        return;
    }
    if ((oldsel.value == mkt_strings.optionvalue_auto) && ((skillsel.value * 1) < 0)) {
        mkt_addError(mkt_strings.error_whenAutoItemSkillMustBeExplicit + mkt_strings.label_ammo);
        return;
    }
    /*var oldsockets = document.getElementById(mkt_strings.selectammooldsocksid);      // prepared for config with socks in ammunition
    var newsockets = document.getElementById(mkt_strings.selectammonewsocksid);*/

    var skillid = skillsel.value < 0 ? -1 : skillsel.value;
    var doini = skillsel.value == mkt_strings.optionvalue_allinitiativeskills || skillsel.value == mkt_strings.optionvalue_allskills || skillid > 0;
    var dopreround = skillsel.value == mkt_strings.optionvalue_allpreroundskills || skillsel.value == mkt_strings.optionvalue_allskills || skillsel.value == mkt_strings.optionvalue_allpreroundandroundskills || skillid > 0;
    var domainround = skillsel.value == mkt_strings.optionvalue_allroundskills || skillsel.value == mkt_strings.optionvalue_allskills || skillsel.value == mkt_strings.optionvalue_allpreroundandroundskills || skillid > 0;
    var doheal = skillsel.value == mkt_strings.optionvalue_allhealskills || skillsel.value == mkt_strings.optionvalue_allskills || skillid > 0;
    var wod_cfg = unsafeWindow.WOD_CFG;
    // First process the dungeon config ...
    processLevelAmmo(wod_cfg.dungeon.standard, true, newsel, oldsel, /*newsockets, oldsockets, */ skillid, doini, dopreround, domainround, doheal);   // prepared for config with socks in ammunition
    for (var i in wod_cfg.dungeon.levels) {
        var level = wod_cfg.dungeon.levels[i];
        processLevelAmmo(level, false, newsel, oldsel, /*newsockets, oldsockets, */ skillid, doini, dopreround, domainround, doheal);                   // prepared for config with socks in ammunition
    }
    // ... and then the duel config
    processLevelAmmo(wod_cfg.duel.hero, false, newsel, oldsel, /*newsockets, oldsockets, */ skillid, doini, dopreround, domainround, doheal);         // prepared for config with socks in ammunition
    processLevelAmmo(wod_cfg.duel.group, false, newsel, oldsel, /*newsockets, oldsockets, */ skillid, doini, dopreround, domainround, doheal);        // prepared for config with socks in ammunition
    if (wod_cfg.duel.clan) processLevelAmmo(wod_cfg.duel.clan, false, newsel, oldsel, /*newsockets, oldsockets, */ skillid, doini, dopreround, domainround, doheal);           // prepared for config with socks in ammunition
    if (wod_cfg.duel.clanquest) processLevelAmmo(wod_cfg.duel.clanquest, false, newsel, oldsel, /*newsockets, oldsockets, */ skillid, doini, dopreround, domainround, doheal); // prepared for config with socks in ammunition

    // Refresh display
    for (var i in myuls) {
        var ul = myuls[i];
        if (ul.parentNode.style.display == 'block') {
            var lis = ul.getElementsByTagName('li');
            for (var j in lis) {
                if (lis[j].className == 'selected') {
                    var evt = document.createEvent("MouseEvents");
                    evt.initMouseEvent("click", true, true, document.defaultView, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
                    lis[j].dispatchEvent(evt);
                }
            }
        }
    }
}

function resetErrorDiv() {
    var childs = errordiv.childNodes;
    var l = errordiv.childNodes;
    for (var i = 0; i < l; i++) {
        errordiv.removeChild(errordiv.childNodes[0]);
    }
    mkt_setDisplayState(errordiv, 'none');
}


/**
 * This function creates the form elements. It will be called after(!) the page loaded completely
 */
function mkt_start() {

    var startelement = document.getElementById(mkt_strings.id_startelement);
    if (startelement != null) {
        errordiv = mkt_createDiv(mkt_strings.id_div_error, mkt_strings.class_errordiv, 'display:none;');
        var btnErrorReset = mkt_createButton(mkt_strings.id_button_error_reset, mkt_strings.id_button_error_reset, "", mkt_strings.button_error_reset, null, resetErrorDiv);
        var div_btnErrorReset = mkt_createDiv(null, null, 'vertical-align: top; text-align: right; display: block; float: right;border-left:1px solid #666666; margin:1px;');
        div_btnErrorReset.appendChild(btnErrorReset);
        errordiv.appendChild(div_btnErrorReset);

        var br = document.createElement('br');
        var thehr = startelement.getElementsByTagName('hr')[0];
        var myhr = thehr.cloneNode(false);
        startelement.insertBefore(myhr, thehr.nextSibling);
        startelement.insertBefore(errordiv, myhr);
        var theButton_off = mkt_createButton(mkt_strings.id_button_start, mkt_strings.id_button_start, "", mkt_strings.buttonstartinvisible, "setDisplayState('" + mkt_strings.id_div_main + "','block');setDisplayState('" + mkt_strings.id_button_refreshammo + "', 'inline');setDisplayState('" + mkt_strings.id_button_start + "','none');setDisplayState('" + mkt_strings.id_button_start2 + "','inline');", null);
        var theButton_on = mkt_createButton(mkt_strings.id_button_start2, mkt_strings.id_button_start2, "", mkt_strings.buttonstartvisible, "setDisplayState('" + mkt_strings.id_div_main + "','none'); setDisplayState('" + mkt_strings.id_button_refreshammo + "', 'none');  setDisplayState('" + mkt_strings.id_button_start2 + "','none');setDisplayState('" + mkt_strings.id_button_start + "','inline');", null);
        theButton_off.setAttribute('style', 'display:inline;width:10em;');
        theButton_on.setAttribute('style', 'display:none; width:10em;');
        var btnAmmoRefresh = mkt_createButton(mkt_strings.id_button_refreshammo, mkt_strings.id_button_refreshammo, '', mkt_strings.buttonrefreshammo, null, doRefreshAmmunition);
        btnAmmoRefresh.setAttribute('style', 'display:none;');
        startelement.insertBefore(theButton_off, errordiv);
        startelement.insertBefore(theButton_on, errordiv);
        startelement.insertBefore(btnAmmoRefresh, errordiv);
        var thediv = mkt_createDiv(mkt_strings.id_div_main, '', 'display:none;');
        startelement.insertBefore(thediv, errordiv);

        var hiddenstatusweapon = mkt_createInput('hidden', '', mkt_strings.id_hidden_statusweapon, null, '')
        var hiddenstatusammo = mkt_createInput('hidden', '', mkt_strings.id_hidden_statusammo, null, '')
        hiddenstatusweapon.appendChild(document.createTextNode(''));
        hiddenstatusammo.appendChild(document.createTextNode(''));
        thediv.appendChild(hiddenstatusweapon);
        thediv.appendChild(hiddenstatusammo);

        // *** create weapon selects start
        var selWeaponSkills_ = mkt_createSelect(mkt_strings.id_select_skillforweapon, mkt_strings.id_select_skillforweapon, '', mkt_strings.label_for, onweaponskillselect, null, 'width:100%;', null);
        var selWeaponOld_ = mkt_createSelect(mkt_strings.id_select_weaponold, mkt_strings.id_select_weaponold, '', mkt_strings.label_for, onoldweaponselect, null, 'width:100%;', null);
        var selWeaponNew_ = mkt_createSelect(mkt_strings.id_select_weaponnew, mkt_strings.id_select_weaponnew, '', mkt_strings.label_for, onnewweaponselect, null, 'width:100%;', null);
        var selWeaponOldSocks_ = mkt_createSelect(mkt_strings.id_select_weaponoldsocks, mkt_strings.id_select_weaponoldsocks, '', null, null, null, 'width:100%;', null);
        var selWeaponNewSocks_ = mkt_createSelect(mkt_strings.id_select_weaponnewsocks, mkt_strings.id_select_weaponnewsocks, '', null, null, null, 'width:100%;', null);
        var selWeaponSkills = selWeaponSkills_[0];
        var lblselWeaponSkills = selWeaponSkills_[1];
        var selWeaponOld = selWeaponOld_[0];
        var selWeaponNew = selWeaponNew_[0];
        var selWeaponOldSocks = selWeaponOldSocks_[0];
        var selWeaponNewSocks = selWeaponNewSocks_[0];

        mkt_addSelectOption(selWeaponSkills, mkt_strings.optionvalue_allskills, mkt_strings.option_allskills, mkt_strings.skilldata_all);
        mkt_addSelectOption(selWeaponSkills, mkt_strings.optionvalue_allpreroundandroundskills, mkt_strings.option_allpreroundandroundskills, mkt_strings.skilldata_roundskills.substr(0, 2) + mkt_strings.skilldata_preskills);
        mkt_addSelectOption(selWeaponSkills, mkt_strings.optionvalue_allroundskills, mkt_strings.option_allroundskills, mkt_strings.skilldata_roundskills);
        mkt_addSelectOption(selWeaponSkills, mkt_strings.optionvalue_allpreroundskills, mkt_strings.option_allpreroundskills, mkt_strings.skilldata_preskills);
        mkt_addSelectOption(selWeaponSkills, mkt_strings.optionvalue_allhealskills, mkt_strings.option_allhealskills, mkt_strings.skilldata_healskills);
        mkt_addSelectOption(selWeaponSkills, mkt_strings.optionvalue_allinitiativeskills, mkt_strings.option_allinitiativeskills, mkt_strings.skilldata_initiativeskills);
        mkt_addSelectOption(selWeaponOld, mkt_strings.optionvalue_novalue, mkt_strings.option_none, mkt_strings.skilldata_all);
        mkt_addSelectOption(selWeaponNew, mkt_strings.optionvalue_novalue, mkt_strings.option_none, mkt_strings.skilldata_all);
        mkt_addSelectOption(selWeaponOld, mkt_strings.optionvalue_auto, mkt_strings.option_auto, mkt_strings.skilldata_all);
        mkt_addSelectOption(selWeaponNew, mkt_strings.optionvalue_auto, mkt_strings.option_auto, mkt_strings.skilldata_all);
        mkt_addSelectOption(selWeaponOldSocks, mkt_strings.optionvalue_nosocks, mkt_strings.option_auto, null);
        mkt_addSelectOption(selWeaponNewSocks, mkt_strings.optionvalue_nosocks, mkt_strings.option_auto, null);

        var btnWeaponChange = mkt_createButton(mkt_strings.id_button_changeweapon, mkt_strings.id_button_changeweapon, '', mkt_strings.buttonchangeweapon, null, onweaponchangeclick);
        btnWeaponChange.style.margin = '0px';
        // *** create weapon selects end

        // do the same for ammuntion selects
        // *** create ammuniton selects start
        var selammoSkills_ = mkt_createSelect(mkt_strings.id_select_skillforammo, mkt_strings.id_select_skillforammo, '', mkt_strings.label_for, onammoskillselect, null, 'width:100%;', null);
        var selammoOld_ = mkt_createSelect(mkt_strings.id_select_ammoold, mkt_strings.id_select_ammoold, '', mkt_strings.label_for, onoldammoselect, null, 'width:100%;', null);
        var selammoNew_ = mkt_createSelect(mkt_strings.id_select_ammonew, mkt_strings.id_select_ammonew, '', mkt_strings.label_for, onnewammoselect, null, 'width:100%;', null);
//    var selammoOldSocks_ = mkt_createSelect(mkt_strings.selectammooldsocksid, mkt_strings.selectammooldsocksid, '', null, null, null, 'width:100%;', null); // prepared for config with socks in ammunition
//    var selammoNewSocks_ = mkt_createSelect(mkt_strings.selectammonewsocksid, mkt_strings.selectammonewsocksid, '', null, null, null, 'width:100%;', null); // prepared for config with socks in ammunition
        var selammoSkills = selammoSkills_[0];
        var selammoOld = selammoOld_[0];
        var selammoNew = selammoNew_[0];
//    var selammoOldSocks  = selammoOldSocks_[0]; // prepared for config with socks in ammunition
//    var selammoNewSocks  = selammoNewSocks_[0]; // prepared for config with socks in ammunition

        mkt_addSelectOption(selammoSkills, mkt_strings.optionvalue_allskills, mkt_strings.option_allskills, mkt_strings.skilldata_all);
        mkt_addSelectOption(selammoSkills, mkt_strings.optionvalue_allpreroundandroundskills, mkt_strings.allpreroundandroundskills, mkt_strings.skilldata_roundskills.substr(0, 2) + mkt_strings.skilldata_preskills);
        mkt_addSelectOption(selammoSkills, mkt_strings.optionvalue_allroundskills, mkt_strings.option_allroundskills, mkt_strings.skilldata_roundskills);
        mkt_addSelectOption(selammoSkills, mkt_strings.optionvalue_allpreroundskills, mkt_strings.option_allpreroundskills, mkt_strings.skilldata_preskills);
        mkt_addSelectOption(selammoSkills, mkt_strings.optionvalue_allhealskills, mkt_strings.option_allhealskills, mkt_strings.skilldata_healskills);
        mkt_addSelectOption(selammoSkills, mkt_strings.optionvalue_allinitiativeskills, mkt_strings.option_allinitiativeskills, mkt_strings.skilldata_initiativeskills);
        mkt_addSelectOption(selammoOld, mkt_strings.optionvalue_novalue, mkt_strings.option_none, mkt_strings.skilldata_all);
        mkt_addSelectOption(selammoNew, mkt_strings.optionvalue_novalue, mkt_strings.option_none, mkt_strings.skilldata_all);
//    mkt_addSelectOption(selammoOldSocks, mkt_strings.optionvalue_nosocks, mkt_strings.option_auto, null); // prepared for config with socks in ammunition
//    mkt_addSelectOption(selammoNewSocks, mkt_strings.optionvalue_nosocks, mkt_strings.option_auto, null); // prepared for config with socks in ammunition

        var btnAmmoChange = mkt_createButton(mkt_strings.id_button_changeammo, mkt_strings.id_button_changeammo, '', mkt_strings.buttonchangeammo, null, onammochangeclick);
        btnAmmoChange.style.margin = '0px';

        // *** create ammunition selects end

        var the_env = unsafeWindow.THE_ENV;

        // *** fill weapon selects start
        var itemidlist = new Array();
        var itemoptionlist = new Object();
        var skillidlist = ',';
        for (var s in the_env.skills) { // for every skill
            var skill = the_env.skills[s];
            if (checkAddSkill(skill)) { // if skill can be added
                if (skill.itemClassId) { // if skill uses an item
                    // The skill needs an weapon-item
                    // --> add skill to list
                    mkt_addSelectOption(selWeaponSkills, skill.id, skill.name, skill.itemClassId);
                    // --> add allowed items to lists
                    if (skillidlist.indexOf(skill.id) == -1) { // but every skill only one time
                        skillidlist = skill.id + ',';

                        var tmpitems = the_env.itemClasses[skill.itemClassId]; // list of items in this itemclass
                        for (var i in tmpitems) {  // for every item
                            var anitem = tmpitems[i];
                            if (itemidlist.indexOf(anitem.id) == -1) { // is new item
                                itemidlist.push(anitem.id);
                                var ids = addSkilltype(skill, ',' + skill.itemClassId + ',');  // result: ",id,prhi,"
                                var op1 = mkt_addSelectOption(selWeaponOld, anitem.id, anitem.name, ids);
                                var op2 = mkt_addSelectOption(selWeaponNew, anitem.id, anitem.name, ids);
                                itemoptionlist[anitem.id] = [op1, op2]; // save the option elements for this item
                            } else { // this item has already options
                                var op1 = itemoptionlist[anitem.id][0];
                                var op2 = itemoptionlist[anitem.id][1];
                                var dt = op1.getAttribute('data');
                                if (dt.indexOf(skill.itemClassId) == -1) {
                                    dt += skill.itemClassId + ',';
                                }
                                dt = addSkilltype(skill, dt);  // result: ,id of skill1,prhi of skill 1,id of skill2, prhi of skill2,
                                op1.setAttribute('data', dt);
                                op2.setAttribute('data', dt);
                            }
                        }
                    }
                }
            }
        }
        // *** fill weapon selects end

        var thetable = mkt_createTable('border:none;', null);
        var tr1 = mkt_addRow(thetable);
        var tr2 = mkt_addRow(thetable);
        var tr3 = mkt_addRow(thetable);
        mkt_addCell(tr1, ' ');
        var td = mkt_addCell(tr1, mkt_strings.label_old);
        td.setAttribute('style', 'width:220px;');
        var td = mkt_addCell(tr1, mkt_strings.label_socket);
        td.setAttribute('style', 'width:80px;');
        mkt_addCell(tr1, ' ');
        td = mkt_addCell(tr1, mkt_strings.label_new);
        td.setAttribute('style', 'width:220px;');
        var td = mkt_addCell(tr1, mkt_strings.label_socket);
        td.setAttribute('style', 'width:80px;');
        mkt_addCell(tr1, ' ');
        td = mkt_addCell(tr1, mkt_strings.label_skill);
        td.setAttribute('style', 'width:220px;');
        mkt_addCell(tr1, ' ');
        mkt_addCell(tr2, mkt_strings.label_weapon);
        mkt_addCell(tr2, selWeaponOld);
        mkt_addCell(tr2, selWeaponOldSocks);
        mkt_addCell(tr2, mkt_strings.label_arrow);
        mkt_addCell(tr2, selWeaponNew);
        mkt_addCell(tr2, selWeaponNewSocks);
        mkt_addCell(tr2, mkt_strings.label_for);
        mkt_addCell(tr2, selWeaponSkills);
        mkt_addCell(tr2, btnWeaponChange);
        mkt_addCell(tr3, mkt_strings.label_ammo);
        mkt_addCell(tr3, selammoOld);
        mkt_addCell(tr3, ' ' /*selammoOldSocks*/); // prepared for config with socks in ammunition
        mkt_addCell(tr3, mkt_strings.label_arrow);
        mkt_addCell(tr3, selammoNew);
        mkt_addCell(tr3, ' ' /*selammoNewSocks*/); // prepared for config with socks in ammunition
        mkt_addCell(tr3, mkt_strings.label_for);
        mkt_addCell(tr3, selammoSkills);
        mkt_addCell(tr3, btnAmmoChange);
        thediv.appendChild(thetable);

        // *** fill ammo selects start
        doRefreshAmmunition();
        // *** fill ammo selects end

        var divs = startelement.getElementsByTagName('div').children;
        for (var i in divs) {
            var uls = divs.children[i].getElementsByTagName('ul');
            if (uls && uls.length > 0) {
                myuls.push(uls[0]);
            }
        }
        var container = document.createElement('div');
        container.innerHTML = "<script type='text/javascript'> function mkt_removeMsg(id) { var errdiv = document.getElementById('" + mkt_strings.id_div_error + "'); if (!errdiv) return; var errmsg = document.getElementById(id);  if (!errmsg) return;   errdiv.removeChild(errmsg);   if (errdiv.getElementsByTagName('div').length == 1) {    setDisplayState('" + mkt_strings.id_div_error + "', 'none');   } } </script>";
        document.body.appendChild(container.firstChild);

    } else {
        GM_log(mkt_strings.errornostartelement);
    }
}


/**
 * This registers the main function with the onLoad-Event of the page
 */
window.addEventListener(
    'load',
    function () {
        mkt_start();
    },
    true);
