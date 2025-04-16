// ==UserScript==
// @name          WoD Ausrüster (Dunuin)
// @namespace     http://www.stumpenhagen.net/bm/dunuins_wod_scripte/ausruester/
// @description   Lässt Ausrüstungsprofile speichern, damit man diese später bequem laden kann, um die Ausüstung zu wechseln. NUR FÜR DIE DEUTSCHE WOD SEITE.
// @author		  Dunuin
// @grant       GM_getValue
// @grant       GM_setValue
// @include       *world-of-dungeons.de/wod/spiel/hero/items.php*
// @include       *world-of-dungeons.de/wod/spiel/dungeon/group.php*
// ==/UserScript==

//###########################################################################################################################################################
//############################################################# Globale Variablen deklarieren ###############################################################
//###########################################################################################################################################################
var aktuelleversion = "0.1.7";
var welt = document.getElementsByName('wod_post_world')[0].value;									//Die ID der Welt
var held = document.getElementsByName('session_hero_id')[0].value;									//Die ID des Helden
var hauptform = document.getElementsByName('the_form')[0];											//Das Hauptformular von WoD
var initialisiert = false;																			//Ob die Main-Funktiion fertig ist
var verschiebenaktiv = false;
var verschiebenxalt = 0;
var verschiebenyalt = 0;
var verschiebenxneu = 0;
var verschiebenyneu = 0;
GM_setValue("warnungen_anzeigen_aktiv", false);


//###########################################################################################################################################################
//######################################################################## Patchbereich ####################äää##############################################
//###########################################################################################################################################################
function patchen() {
//-------------------- Patch 0.0.12 auf 0.0.13 Start ------------------------------
    if (GM_getValue("patchdurchgefuehrt_0.0.13" + held, false) == false) {
        alert("Änderungen in Version 0.0.13\n\nÄnderungen:\n1.) 2 Fehler bezüglich der Gruppenseite behoben\n2.) Die Zuordnung der Konfigs wurde so verändert, dass man nun beliebig viele Konfigs einem Profil zuordnen kann. Die alten Zuordnungen werden gelöscht, da dise nicht mehr kompatibel sind.");
        for (var ipatch = 1; ipatch <= 21; ipatch++) {
            GM_setValue("profil_" + held + "_" + ipatch + "_verknuepftekonfig", "nicht vorhanden");
        }
        GM_setValue("patchdurchgefuehrt_0.0.13" + held, true);
        GM_setValue("letzte_update_anfrage", "0");
    }
//-------------------- Patch 0.0.12 auf 0.0.13 Ende -------------------------------

//-------------------- Patch 0.0.15 auf 0.1.0 Start ------------------------------
    if (GM_getValue("patchdurchgefuehrt_0.1.0", false) == false) {
        alert("Änderungen in Version 0.1.0\n\nÄnderungen:\n1.) Export-/Importfunktion hinzugefügt\n\nBehobene Fehler:\n1.) mehrere kleinere Schönheitsfehler und Typos\n\nPS: Es können nur Helden exportiert werden, mit denen man mindestens einmal seit dem Patch die Ausrüstungsseite betreten hat.");
        GM_setValue("patchdurchgefuehrt_0.1.0", true);
        GM_setValue("letzte_update_anfrage", "0");
        var eintraegeanzahl = GM_getValue("heldenliste_anzahl", -1);
        for (var i = 0; i < eintraegeanzahl; i++) {
            GM_deleteValue("heldenliste_" + i);
        }
        GM_deleteValue("heldenliste_anzahl");
    }
    if (GM_getValue("patchdurchgefuehrt_0.1.0" + held, false) == false) {
        heldSpeichern(parseInt(held), heldennameHerausfinden(), weltUmwandeln(welt));
        GM_setValue("patchdurchgefuehrt_0.1.0" + held, true);
    }
//-------------------- Patch 0.0.15 auf 0.1.0 Ende -------------------------------

//-------------------- Patch 0.1.3 auf 0.1.4 Start ------------------------------
    if (GM_getValue("patchdurchgefuehrt_0.1.4", false) == false) {
        alert("Änderungen in Version 0.1.4\n\nÄnderungen:\n1.) nun ist einstellbar, wie voll die VGs im Idealfall sein sollen, damit sie ausgerüstet werden");
        GM_setValue("patchdurchgefuehrt_0.1.4", true);
        GM_setValue("letzte_update_anfrage", "0");
    }
//-------------------- Patch 0.1.3 auf 0.1.4 Ende -------------------------------
//-------------------- Patch 0.1.4 auf 0.1.5 Start ------------------------------
    if (GM_getValue("patchdurchgefuehrt_0.1.5", false) == false) {
        alert("Änderungen in Version 0.1.5\n\nÄnderungen:\n1.) man kann nun global den Bereich festlegen, wie weit die VG-Ladungen von dem eingestellten Wert, nach Oben und nach Unten, maximal abweichen dürfen, damit diese zum Ausrüsten in Betracht gezogen werden\n\nBehobene Fehler:\n-falsche Warnungen bei unbenutzer Schild- und Waffenhand sollten nun nicht mehr auftauchen");
        if (GM_getValue("vgabweichungmin", -1) == -1) {
            GM_setValue("vgabweichungmin", 100);
        }
        if (GM_getValue("vgabweichungmax", -1) == -1) {
            GM_setValue("vgabweichungmax", 100);
        }
        GM_setValue("patchdurchgefuehrt_0.1.5", true);
        GM_setValue("letzte_update_anfrage", "0");
    }
//-------------------- Patch 0.1.4 auf 0.1.5 Ende -------------------------------
}

//###########################################################################################################################################################
//######################################################################## Subroutinen ######################################################################
//###########################################################################################################################################################

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Wandelt eine dezimale Zahl in eine hexdezimale Zahl um
//Erwartet: integer
//Gibt aus: string mit hexdezimaler zahl
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function dec2hex(dec) {
    return dec.toString(16);
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Wandelt eine hexdezimale Zahl in eine dezimale Zahl um
//Erwartet: string mit hexdezimaler Zahl
//Gibt aus: Integer
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function hex2dec(hex) {
    return parseInt(hex, 16);
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Erzeugt einen Rahmen um das HTML-Element ELEMENT, der Rot-Gelb pulsiert, bis man mit der Maus über das Elememnt fährt.
//Erwartet: übergenenes HTML-Elemeent bei ELEMENT, einen beliebigen Integer bei ID und true bei Start
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function pulsierenderRahmen(element, id, start) {
    var takt = 100;
    var farbverschiebung = 32;
    if (start == true) {
        id = GM_getValue("pulsierenderrahmen_letzte_id", 0) + 1;
        GM_setValue("pulsierenderrahmen_letzte_id", id);
        GM_setValue("pulsierenderrahmen_" + id + "_aktiv", true);
        GM_setValue("pulsierenderrahmen_" + id + "_rahmenfarbe", element.style.borderColor);
        GM_setValue("pulsierenderrahmen_" + id + "_rahmentyp", element.style.borderStyle);
        GM_setValue("pulsierenderrahmen_" + id + "_rahmenstaerke", element.style.borderWidth);
        GM_setValue("pulsierenderrahmen_" + id + "_farbe", 0);
        element.addEventListener("mouseover", function (e) {
            GM_setValue("pulsierenderrahmen_" + id + "_aktiv", false);
            element.style.borderColor = GM_getValue("pulsierenderrahmen_" + id + "_rahmenfarbe", "#FFFFFF");
            element.style.borderStyle = GM_getValue("pulsierenderrahmen_" + id + "_rahmentyp", "solid");
            element.style.borderWidth = GM_getValue("pulsierenderrahmen_" + id + "_rahmenstaerke", "1px");
        }, false);
        element.style.borderColor = "#FF0000";
        element.style.borderStyle = "solid";
        element.style.borderWidth = "3px";
    }
    if (GM_getValue("pulsierenderrahmen_" + id + "_aktiv", true) == true) {
        var altergruenton = GM_getValue("pulsierenderrahmen_" + id + "_farbe", 0);
        if (altergruenton + farbverschiebung >= 512) {
            var neuergruenton = 0;
        } else {
            var neuergruenton = altergruenton + farbverschiebung;
        }
        GM_setValue("pulsierenderrahmen_" + id + "_farbe", neuergruenton);
        if (neuergruenton >= 256) {
            neuergruenton = 255 - (neuergruenton - 256);
        }
        var gruenton = dec2hex(neuergruenton);
        if (gruenton.length == 1) {
            gruenton = "0" + gruenton;
        }
        element.style.borderColor = "#FF" + gruenton + "00";
        window.setTimeout(function () {
            //farbe ändern
            pulsierenderRahmen(element, id, false);
        }, takt);
    } else {
        element.removeEventListener("mouseover", function (e) {
            GM_setValue("pulsierenderrahmen_" + id + "_aktiv", false);
            element.style.borderColor = GM_getValue("pulsierenderrahmen_" + id + "_rahmenfarbe", "#FFFFFF");
            element.style.borderStyle = GM_getValue("pulsierenderrahmen_" + id + "_rahmentyp", "solid");
            element.style.borderWidth = GM_getValue("pulsierenderrahmen_" + id + "_rahmenstaerke", "1px");
        }, false);
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Läd den String aus der GM-Variable NAME und erzeugt daraus ein Array, welches ausgegeben wird.
//Erwartet: Name der GM-Variable unter der ein Arraystring gespeichert ist
//Gibt aus: das erzeugte Array oder False, falls kein Arraystring gespeichert war oder es einen Fehler gab
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function GM_getArray(name) {
    //alert("GM_getArray");
    var allesok = true;
    var erzeugtesarray = new Array();
    var arraystring = GM_getValue(name, undefined);
    //Prüfen ob eine Variable mit dem Namen gespeichert ist
    if (arraystring == undefined) {
        allesok = false;
        //alert("Keine Variable gefunden");
    } else {
        //Prüfen ob der gespeicherte Wert ein String ist
        if (typeof arraystring != "string") {
            allesok = false;
            //alert("Variable ist kein String");
        } else {
            //Prüfen ob es auch ein Arraystring ist
            if (arraystring.search(/^\[array\].+?\[\/array\]$/) == -1) {
                allesok = false;
                //alert("Variable ist kein Arraystring: "+arraystring);
            } else {
                //Arraystring auslesen
                var tempstring = arraystring.substring(7, arraystring.length - 8);
                //alert('tempstring: '+tempstring);
                while (tempstring.search(/\[element=".+?"\].+?\[\/element\]/) != -1) {
                    var elementstring = tempstring.match(/\[element="(.+?)"\](.+?)\[\/element\]/);
                    if (elementstring != null) {
                        switch (RegExp.$1) {
                            case "Float":
                                var wert = parseFloat(RegExp.$2);
                                break;
                            case "Integer":
                                var wert = parseInt(RegExp.$2);
                                break;
                            case "Boolean":
                                if (RegExp.$2 == "true") {
                                    var wert = true;
                                } else {
                                    var wert = false;
                                }
                                break;
                            case "String":
                                var wert = RegExp.$2;
                                break;
                            default:
                                allesok = false;
                                break;
                        }
                        if (allesok == true) {
                            erzeugtesarray.push(wert);
                            tempstring = tempstring.replace(/\[element=".+?"\].+?\[\/element\]/, "");
                            //alert('tempstring: '+tempstring+'\n\n');
                        } else {
                            break;
                        }
                    }
                }
            }
        }
    }
    if (allesok == true) {
        return erzeugtesarray;
    } else {
        return false;
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Konvertiert das übergebene Array in einen String, der dann unter dem übergebenen GM-Variablen-Namen gespeichert wird.
//Erwartet: Eindimensionales Array mit fortlaufenden Integern als Schlüssel und Integern, String oder Booleans als Werte; String als Name für die GM-Variable
//Gibt aus: true falls speichern erfolgreich war, sonst false
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function GM_setArray(name, array) {
    //alert("GM_setArray");
    var allesok = true;
    var arraystring = "[array]";
    for (var i = 0; i < array.length; i++) {
        switch (typeof array[i]) {
            case "number":
                if (array[i].toString().search(/\./) != -1) {
                    var werttyp = "Float";
                    var wertalsstring = array[i].toString();
                } else {
                    var werttyp = "Integer";
                    var wertalsstring = array[i].toString();
                }
                break;
            case "boolean":
                var werttyp = "Boolean";
                if (array[i] == true) {
                    var wertalsstring = "true";
                } else {
                    var wertalsstring = "false";
                }
                break;
            case "string":
                var werttyp = "String";
                var wertalsstring = array[i];
                break;
            default:
                allesok = false;
                var werttyp = "";
                var wertalsstring = "";
                break;
        }
        arraystring += '[element="' + werttyp + '"]' + wertalsstring + '[/element]';
    }
    arraystring += "[/array]";
    if (allesok == true) {
        GM_setValue(name, arraystring);
        //alert(name+':'+arraystring);
    } else {
        //alert('Arrayfehler');
    }
    return allesok;
}


//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Gibt man den 2-stelligen Weltencode ein, gibt einem diese Funktion den dazu passenden Weltenname aus und umgekehrt. Oder man gibt "weltenarray" ein und bekommt ein Array mit allen Welten ausgegeben
//Erwartet: String mit Weltcode oder Weltnamen oder den String "weltenarray"
//Gibt aus: String mit Weltcode oder Weltnamen oder Array mit allen Welten oder False falls es einen Fehler gab
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function weltUmwandeln(inputstring) {
    //Array mit allen Welten erstellen
    var ausgabe = false;
    var allewelten = new Array();
    var welt = new Object();
    welt["code"] = "WA";
    welt["name"] = "Algarion";
    allewelten[0] = welt;
    var welt = new Object();
    welt["code"] = "WB";
    welt["name"] = "Barkladesh";
    allewelten[1] = welt;
    var welt = new Object();
    welt["code"] = "WC";
    welt["name"] = "Cartegon";
    allewelten[2] = welt;
    var welt = new Object();
    welt["code"] = "WD";
    welt["name"] = "Darakesh";
    allewelten[3] = welt;
    var welt = new Object();
    welt["code"] = "WE";
    welt["name"] = "Exturion";
    allewelten[4] = welt;
    var welt = new Object();
    welt["code"] = "WF";
    welt["name"] = "Forakesh";
    allewelten[5] = welt;
    var welt = new Object();
    welt["code"] = "WG";
    welt["name"] = "Galderion";
    allewelten[6] = welt;
    var welt = new Object();
    welt["code"] = "WH";
    welt["name"] = "Irelion";
    allewelten[7] = welt;
    var welt = new Object();
    welt["code"] = "WY";
    welt["name"] = "Xerasia";
    allewelten[8] = welt;
    if (inputstring == "weltenarray") {
        ausgabe = allewelten;
    } else {
        if (inputstring.length == 2) {
            for (var i = 0; i < allewelten.length; i++) {
                if (allewelten[i]["code"] == inputstring) {
                    ausgabe = allewelten[i]["name"];
                    break;
                }
            }
        } else {
            for (var i = 0; i < allewelten.length; i++) {
                if (allewelten[i]["name"] == inputstring) {
                    ausgabe = allewelten[i]["code"];
                    break;
                }
            }
        }
    }
    if (ausgabe == false) {
        ergeignisHinzufuegen(true, "Fehler: Es gab einen Fehler bei dem Bestimmen des Weltennamens/Weltencodes!");
    }
    return ausgabe;
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Such sich den Heldennamen auf der Gruppen- oder Ausrüstungsseite heraus, welche danach ausgegeben wird
//Erwartet: -
//Gibt aus: String mit dem Heldennamen oder false bei einem Fehler
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function heldennameHerausfinden() {
    var url = window.location.href;
    var heldenname = false;
    //Prüfen, ob man sich auf der Gruppenseite befindet
    if (url.search(/.+group\.php.*/) != -1) {
        //Man befindet sich auf der Gruppenseite
        //var konfigdropdown = document.getElementsByName("config["+held+"]")[0];
        //if(konfigdropdown != undefined){
        //heldenname = konfigdropdown.parentNode.parentNode.parentNode.previousSibling.previousSibling.innerHTML;
        //}
        var allelinks = document.getElementsByTagName("A");
        for (var i = 0; i < allelinks.length; i++) {
            var regexpstring = new RegExp("\\/wod\\/spiel\\/hero\\/profile\\.php\\?id=" + held + "\.\*");
            if (regexpstring.exec(allelinks[i].href) != null) {
                heldenname = allelinks[i].innerHTML;
            }
        }
    } else {
        if (url.search(/.+items\.php.*/) != -1) {
            var view = document.getElementsByName("view")[0];
            if ((view != undefined && view.value == "gear") || url.search(/.+view=gear.*/) != -1) {
                var allehauptueberschriften = document.getElementsByTagName("H1");
                for (var i = 0; i < allehauptueberschriften.length; i++) {
                    if (allehauptueberschriften[i].innerHTML.search(/(.+): Ausrüstung anlegen/) != -1) {
                        heldenname = RegExp.$1;
                        break;
                    }
                }
            }
        }
    }
    if (heldenname == false) {
        ergeignisHinzufuegen(true, "Fehler: Der Name des Helden konnte nicht ausgelesen werden!");
    }
    return heldenname;
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Läd die Namen, die Welten und die IDs aller gespeicherter Helden
//Erwartet: -
//Gibt aus: Array das pro Held folgendes Array enthält array["id"], array["name"], array["welt"]; false falls es Fehler gab
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function heldenLaden() {
    var allehelden = new Array();
    var allenamen = GM_getArray("heldenliste_name");
    var alleids = GM_getArray("heldenliste_id");
    var allewelten = GM_getArray("heldenliste_welt");
    if (allenamen != false && alleids != false && allewelten != false) {
        if (allenamen.length == alleids.length && allenamen.length == allewelten.length) {
            for (var i = 0; i < allenamen.length; i++) {
                var heldenarray = new Array();
                heldenarray['id'] = alleids[i];
                heldenarray['name'] = allenamen[i];
                heldenarray['welt'] = allewelten[i];
                allehelden[i] = heldenarray;
            }
            return allehelden;
        } else {
            return false;
        }
    } else {
        //alert("Keine Heldenarrays gefunden!");
        return false;
    }

}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Fügt der gespeicherten Heldenliste einen Neuen Helden, also dessen ID, Name und Welt hinzu
//Erwartet: Integer mit ID des Helden; String mit Name des Helden; String mit Welt des Helden
//Gibt aus: -1 = Held wurde neu hinzugefügt; 0 = Held wurde aktuallisiert; 1 = Held war schon vorhanden; -2 = held wurde hinzugefügt und Array war leer
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function heldSpeichern(heldenid, heldenname, heldenwelt) {
    var heldschonvorhanden = -1;
    var allehelden = heldenLaden();
    if (allehelden === false) {
        heldschonvorhanden = -2;
    } else {
        var heldenanzahl = allehelden.length;
        for (var i = 0; i < heldenanzahl; i++) {
            if (allehelden[i]['id'] == heldenid) {
                if (allehelden[i]['name'] == heldenname && allehelden[i]['welt'] == heldenwelt) {
                    heldschonvorhanden = 1;
                    break;
                } else {
                    heldschonvorhanden = 0;
                    break;
                }
            }
        }
    }
    //Held neu hinzufügen
    if (heldschonvorhanden == -1) {
        var allenamen = GM_getArray("heldenliste_name");
        var alleids = GM_getArray("heldenliste_id");
        var allewelten = GM_getArray("heldenliste_welt");
        allenamen.push(heldenname);
        alleids.push(heldenid);
        allewelten.push(heldenwelt);
        GM_setArray("heldenliste_name", allenamen);
        GM_setArray("heldenliste_id", alleids);
        GM_setArray("heldenliste_welt", allewelten);
    }
    //Held neu hinzufügen und Array war leer
    if (heldschonvorhanden == -2) {
        var allenamen = new Array();
        var alleids = new Array();
        var allewelten = new Array();
        allenamen.push(heldenname);
        alleids.push(heldenid);
        allewelten.push(heldenwelt);
        GM_setArray("heldenliste_name", allenamen);
        GM_setArray("heldenliste_id", alleids);
        GM_setArray("heldenliste_welt", allewelten);
    }
    //Held aktuallisieren
    if (heldschonvorhanden == 0) {
        var allenamen = GM_getArray("heldenliste_name");
        var alleids = GM_getArray("heldenliste_id");
        var allewelten = GM_getArray("heldenliste_welt");
        for (var i = 0; i < heldenanzahl; i++) {
            if (alleids[i] == heldenid) {
                allenamen.splice(i, 1, heldenname);
                allewelten.splice(i, 1, heldenwelt);
                GM_setArray("heldenliste_name", allenamen);
                GM_setArray("heldenliste_welt", allewelten);
            }
        }
    }
    return heldschonvorhanden;
}


//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Sucht nach dem verstecken Formularfeld, welches die aktuelle Seite der Tasche angibt, welche nur erscheint, wenn mehr als 10 Itewms gefunden wurden und so die anderen Dropdowns deaktiviert sind.
//Erwartet: -
//Gibt aus: true wenn alles ok ist, false falls mehr als 10 Itewms gefunden wurden
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function pruefenDassNichtZuVieleItemsGefundenWurden() {
    var gefundeneitemsseite = document.getElementsByName("ITEMS_GEFUNDEN_PAGE");
    if (gefundeneitemsseite[0] != undefined) {
        var ausgabe = false;
    } else {
        var ausgabe = true;
    }
    return ausgabe;
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Blendet die Abdunklungsebene aus
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function abdunklungsEbeneAusblenden() {
    var abdunklungsebene = document.getElementById("abdunklungsebene");
    if (abdunklungsebene != undefined) {
        abdunklungsebene.style.visibility = "collapse";
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Blendet die "Bitte Warten"-Seite aus
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function warteEbeneAusblenden() {
    var warteebene = document.getElementById("warteebene");
    if (warteebene != undefined) {
        warteebene.style.visibility = "collapse";
    }
    var ausruestungsmenue = document.getElementById("ausruestungsmenue");
    if (ausruestungsmenue != undefined) {
        if (ausruestungsmenue.style.visibility != "visible") {
            abdunklungsEbeneAusblenden();
        }
    } else {
        abdunklungsEbeneAusblenden();
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Erstellt die "Abdunklungsebene im Hintergrund
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function abdunklungsEbeneInitialisieren() {
    var ersteselement = document.getElementsByTagName("BODY")[0].firstChild;
    var abdunklungsebene = document.createElement("div");
    var hoehedesanzeigebereichs = window.innerHeight;
    abdunklungsebene.id = "abdunklungsebene";
    abdunklungsebene.style.visibility = "hidden";
    abdunklungsebene.innerHTML = '<div style="width: 100%; height: ' + hoehedesanzeigebereichs + 'px; background-image: url(http://www.stumpenhagen.net/bm/dunuins_wod_scripte/ausruester/abdunkler.png); background-repeat: repeat; text-align:center; position: fixed; z-index: 100; top: 0px; left: 0px;"></div>';
    ersteselement.parentNode.insertBefore(abdunklungsebene, ersteselement);
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Erstellt die "Bitte Warten"-Seite im Hintergrund
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function warteEbeneInitialisieren() {
    var ersteselement = document.getElementsByTagName("BODY")[0].firstChild;
    var warteebene = document.createElement("div");
    var hoehedesanzeigebereichs = window.innerHeight;
    var breitedesanzeigebereichs = window.innerWidth;
    var abstandoben = Math.round((hoehedesanzeigebereichs - 114) / 2);
    var abstandlinks = Math.round((breitedesanzeigebereichs - 254) / 2);
    warteebene.id = "warteebene";
    warteebene.style.visibility = "hidden";
    warteebene.innerHTML = '<div style="width: 250px; height: 110px; background-color:#FECD38; padding-top:10px; padding-bottom; 10px; border: 2px; border-bottom-color:#F98F02; border-right-color:#F98F02; border-top-color:#FDF780; border-left-color:#FDF780; border-style:solid; text-align:center; vertical-align: middle; position: fixed; z-index: 102; top: ' + abstandoben + 'px; left: ' + abstandlinks + 'px;"><span style="color:#000000; font-size: normal; font-weight:bold; padding-bottom: 15px; padding-top: 25px;">Ausrüster arbeitet.<br><br></span><span style="color:#000000; font-size: large; font-weight: normal;">Bitte warten...<br><br></span><input type="button" name="warteknopf" id="warteknopf" value="Schließen" /></div>';
    ersteselement.parentNode.insertBefore(warteebene, ersteselement);
    var warteknopf = document.getElementById("warteknopf");
    warteknopf.addEventListener("click", function (e) {
        warteEbeneAusblenden();
    }, false);
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Blendet die Abdunklungsebene ein
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function abdunklungsEbeneAnzeigen() {
    if (GM_getValue("verdunkelung", 1) == 1) {
        var abdunklungsebene = document.getElementById("abdunklungsebene");
        if (abdunklungsebene == undefined) {
            abdunklungsEbeneInitialisieren();
            abdunklungsebene = document.getElementById("abdunklungsebene");
        }
        abdunklungsebene.style.visibility = "visible";
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Blendet die "Bitte Warten"-Seite ein
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function warteEbeneAnzeigen() {
    var warteebene = document.getElementById("warteebene");
    if (warteebene == undefined) {
        warteEbeneInitialisieren();
        warteebene = document.getElementById("warteebene");
    }
    warteebene.style.visibility = "visible";
    abdunklungsEbeneAnzeigen();
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Fügt einen Warnugnsbalken ein, falls eine neue Version vorhanden ist
//Erwartet: Die neue Version in Form von "0.0.1"
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function neueVersionAnzeigen(neueversion) {
    var updatezeile = document.createElement("div");
    var neueversionstring = neueversion.replace(/\./g, "_");
    updatezeile.innerHTML = '<div align="center" style="color:#000000; background-color:#FF0000; padding:10px; border: thin; border-color:#000000; border-style:solid;" width: 100%;><strong>Neue Version verfügbar! <a href="http://www.stumpenhagen.net/bm/dunuins_wod_scripte/ausruester/dunuins_ausruester_' + neueversionstring + '.user.js">Hier klicken</a> für das Update auf Version ' + neueversion + '.</strong></div>';
    hauptform.parentNode.insertBefore(updatezeile, hauptform);
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Sucht, ob es eine neuere Version des Ausrüsters gibt
//Erwartet: Die aktuelle Version in Form von "0.0.1"
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function aufUpdatePruefen(aktuelleversion) {
    if (GM_getValue("updatepruefung", 0) == 0) {
        var jetzt = new Date();
        var jetzttimestamp = Date.UTC(jetzt.getFullYear(), jetzt.getMonth() + 1, jetzt.getDate(), jetzt.getHours(), jetzt.getMinutes(), jetzt.getSeconds());
        var letzteupdateanfrage = GM_getValue("letzte_update_anfrage", "0");
        if (jetzttimestamp >= parseInt(letzteupdateanfrage) + 3600000) { //wenn mehr als 1 Stunde seit der letzen vergangen sind, frage neu
            GM_setValue("letzte_update_anfrage", "" + jetzttimestamp);
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'http://www.stumpenhagen.net/bm/dunuins_wod_scripte/ausruester/version.xml?timestamp=' + new Date().getTime(),
                headers: {
                    'User-agent': 'Mozilla/4.0 (compatible) Greasemonkey',
                    'Accept': 'application/atom+xml,application/xml,text/xml',
                    'If-Modified-Since': 'Sat, 1 Jan 2005 00:00:00 GMT'
                },
                onload: function (responseDetails) {
                    if (responseDetails.statusText == "OK") {
                        var neueversiongefunden = responseDetails.responseText.search(/\<versionsnummer\>(\d+\.\d+\.\d+)\<\/versionsnummer\>/);
                        if (neueversiongefunden != -1) {
                            var neusteversion = RegExp.$1;
                            GM_setValue("neuste_version", neusteversion);
                            if (neusteversion != aktuelleversion) {
                                neueVersionAnzeigen(neusteversion);
                            }
                        }
                    }
                }
            });
        } else {
            if (GM_getValue("neuste_version", -1) != aktuelleversion && GM_getValue("neuste_version", -1) != -1) {
                neueVersionAnzeigen(GM_getValue("neuste_version", -1));
            }
        }
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Sendet die Seite
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function seiteAbschicken() {
//alert("seiteAbschicken");
    var okknopf = document.getElementsByName("ok");
    if (okknopf != undefined) {
        ergeignisHinzufuegen(false, "Seite wurde abgeschickt.");
        okknopf[0].click();
    } else {
        ergeignisHinzufuegen(true, "Fehler: Seite konnte nicht abgeschickt werden.");
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Fügt die Navigation des Ausrüsters ein
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function hauptNaviEinblenden() {
    var navi = document.createElement("div");
    navi.id = "navibalken";
    navi.innerHTML = '' +
        '<div align="center" id="Hauptnavi" style="color:#FFFFFF; background-color:#252525; text-align: right; width: 100%; border: thin; border-color:#000000; border-style:solid; margin-top: 5px; margin-bottom: 5px;">' +
        '<form id="naviform" name="naviform" style="padding: 0px; margin: 0px;">' +
        '<div style="float: left; padding: 5px;">' +
        '<input type="button" name="expertenmodusknopf" id="expertenmodusknopf" value="+" class="button"/>' +
        '&nbsp;&nbsp;&nbsp;<span style="vertical-align: bottom;" id="___wodToolTip_UniqueId__9999" onmouseover="return wodToolTip(this,\'' +
        '<h2><strong>Kurzanleitung: Normaler Modus</strong></h2>' +
        '<p>Im normalen Modus befindet sich das Ausrüstungsscript, wenn nur der Balken angezeigt wird, auf dem sich gerade der Mauscursor befindet.<br />' + 'Hier kann man 4 Dinge tun:</p>' +
        '<p><strong>1.) Ausrüstung in einem Profil speichern</strong><br />' +
        'Um die Ausrüstung später laden zu können, muss man sie als Erstes in einem Profil speichern. Dazu legt man erst die Gegenstände an, ' +
        'die gespeichert werden sollen. Dann wählt man in dem Dropdown-Menü, links vom Laden-Knopf, einen der 20 leeren Profilslots aus. ' +
        'Alternativ kann man auch einen benutzten Slot verwenden, dann wird dieser überschrieben. Danach klickt man auf den Speichern-Knopf.</p>' +
        '<p><strong>2.) Ausrüstung eines Profils laden</strong><br />' +
        'Als Erstes wählt man in dem Dropdown-Menü, links vom Laden-Knopf, ein zuvor gespeichertes Profil und klickt auf den Laden-Knopf. ' +
        'Im Normalfall sollte sich dann das Ausrüstungs-Menü öffnen, dass einen in 2 Schritten die Gegenstände anlegt. Bei Schritt 0 wird gefragt, ' +
        'ob die aktuell angelegte Ausrüstung, vor dem Anlegen der zu ladenden Ausrüstung, abgelegt werden soll (falls sonst durch z.B. Mali die Ausrüstung ' +
        'nicht tragbar wäre). Hat man sich entschieden, klickt man auf den Weiter-Knopf. Als Nächstes kommt Schritt 1. Hier muss man nichts weiter einstellen, ' +
        'sondern einfach nur mit dem Weiterknopf bestätigen, um das Anlegen der Gegenstände zu starten. Sollte es beim Laden der Ausrüstung Probleme gegen, ' +
        'weil z.B. nicht mehr genug Verbrauchgegenstände im Lager verfügbar sind, dann springt ein Protokollfeld auf und teilt dies einem mit.</p>' +
        '<p><strong>3.) Verbrauchgegenstände nachfüllen</strong><br />' +
        'Möchte man nicht die ganze Ausrüstung wechseln, sondern nur die verbrauchten Gegenstände nachfüllen, dann kann man ein Profil im Dropdown-Menü ' +
        'wählen und auf den Nachfüllen Knopf klicken. Daraufhin wird die ganze Ausrüstung in einem Schritt und ohne Ausrüstungsmenü geladen, was deutlich schneller ist als ein normalen Laden.</p>' +
        '<p><strong>4.) In den Experten-Modus wechseln<br />' +
        '</strong>Mit einem Klick auf den +/- Knopf, ganz Links im Balken, öffnet bzw. verlässt man den Expertenmodus. ' +
        'Dort kann man unter Anderem ' +
        'Alternativgegenstände festlegen, die ausgerüstet werden, wenn sich ein Gegenstand nicht mehr im Lader befindet. ' +
        'Außerdem kann man dort die Gegenstände 5 Anlegeschritten zuordnen, damit diese nacheinadner angelegt werden, ' +
        'falls es sonst Probleme mit den Itemanforderungen gibt.</p>' + '\');"><img alt="" src="http://www.stumpenhagen.net/bm/dunuins_wod_scripte/ausruester/info.gif" border="0" id="infoicon_kurzanleitung"></span>' +
        '&nbsp;&nbsp;&nbsp;<span style="font-size: large; font-weight: lighter;"><strong><a href="http://www.stumpenhagen.net/bm/dunuins_wod_scripte/ausruester/" target="_blank">Dunuin\'s Ausr&uuml;ster</a> ' + aktuelleversion + '</strong></span>' +
        '</div>' +
        '<div style="float: right; padding: 5px;">' +
        '<input type="button" name="speichernknopf" id="speichernknopf" value="Speichern" class="button"/> <input type="button" name="ladenknopf" id="ladenknopf" value="Laden" class="button"/> ' +
        '<select name="profilliste" id="profilliste">' +
        '<option value="0" id="profil0">Bitte Warten</option>' +
        '</select> ' +
        '<input type="button" name="nachfuellenknopf" id="nachfuellenknopf" value="Nachfüllen" class="button"/>' +
        '</div>' +
        '</form>' +
        '<div style="clear:both;"></div>' +
        '</div>';
    hauptform.parentNode.insertBefore(navi, hauptform);
    //Aktion des Expertenmodusknopfes
    var expertenmodusknopf = document.getElementById("expertenmodusknopf");
    expertenmodusknopf.addEventListener("click", function (e) {
        if (GM_getValue("ausruestungsschritt_" + held, -1) == -1) {
            if (pruefenDassNichtZuVieleItemsGefundenWurden() == true) {
                warteEbeneAnzeigen();
                expertenModusWechseln();
                warteEbeneAusblenden();
            } else {
                ergeignisHinzufuegen(true, "Sie können nicht in den Expertenmodus wechseln, wenn ihr Rucksack noch überfüllt ist. Werfen sie bitte zuerst ein paar Gegenstände weg.");
            }
        } else {
            ergeignisHinzufuegen(true, "Sie können nicht in den Expertenmodus wechseln, während der Ausrüstungsvorgang läuft.");
        }
    }, false);
    //Aktion des Speichernknopfes
    var speicherknopf = document.getElementById("speichernknopf");
    speicherknopf.addEventListener("click", function (e) {
        var gewaehltesprofil = GM_getValue("gewaehltesprofil_" + held, 0);
        if (gewaehltesprofil != 0) {
            if (GM_getValue("ausruestungsschritt_" + held, -1) == -1) {
                if (pruefenDassNichtZuVieleItemsGefundenWurden() == true) {
                    speichern(gewaehltesprofil);
                } else {
                    ergeignisHinzufuegen(true, "Sie können keine Profile speichern, wenn ihr Rucksack noch überfüllt ist. Werfen sie bitte zuerst ein paar Gegenstände weg.");
                }
            } else {
                ergeignisHinzufuegen(true, "Sie können keine Profile speichern, da sie sich beim Ausrüsten befinden.");
            }
        } else {
            ergeignisHinzufuegen(true, "Fehler: Speichern nicht möglich. Bitte wählen sie erst eines der 20 Profile aus.");
        }
    }, false);
    //Aktion des Profildropdowns
    var profildropdown = document.getElementById("profilliste");
    profildropdown.addEventListener("change", function (e) {
        var gewaehltesprofil = document.getElementById("profilliste").selectedIndex;
        GM_setValue("gewaehltesprofil_" + held, gewaehltesprofil);
        ergeignisHinzufuegen(false, "Das Profil '" + document.getElementById("profilliste").options[gewaehltesprofil].text + "' wurde ausgewählt.");
    }, false);
    //Aktion des Ladenknopfes
    var ladenknopf = document.getElementById("ladenknopf");
    ladenknopf.addEventListener("click", function (e) {
        var gewaehltesprofil = GM_getValue("gewaehltesprofil_" + held, 0);
        var profilname = GM_getValue("profil_" + held + "_" + gewaehltesprofil + "_profilname", "FEHLER");
        var profildropdown = document.getElementById("profilliste");
        if (pruefenDassNichtZuVieleItemsGefundenWurden() == true) {
            if (profildropdown.options[gewaehltesprofil].text.search(/nicht vorhanden/) == -1 && gewaehltesprofil != 0) {
                if (GM_getValue("expertenmodus_" + held, false) == true) {
                    ergeignisHinzufuegen(false, "Die Einstellungen des gewählten Profils werden geladen.");
                    ladenExpertenmodus(gewaehltesprofil);
                } else {
                    if (GM_getValue("ausruestungsschritt_" + held, -1) == -1) {
                        ergeignisHinzufuegen(false, 'Die Ausrüstung im gespeicherten Profil "' + profilname + '" wird geladen.');
                        ausruestungsSchrittSteuerung();
                    } else {
                        ergeignisHinzufuegen(true, "Sie können den Ausrüstungsvorgang nicht starten, da sie sich bereits beim Ausrüsten befinden.");
                    }
                }
            } else {
                ergeignisHinzufuegen(true, "Fehler: Laden nicht möglich. Bitte wählen sie erst eines der 20 Profile aus.");
            }
        } else {
            ergeignisHinzufuegen(true, "Sie können den Ausrüstungsvorgang nicht starten, da ihr Rucksack überfüllt ist. Bitte werfen sie erst ein paar Gegenstände weg.");
        }
    }, false);
    //Aktion des Nachfüllenknopfes
    var nachfuellenknopf = document.getElementById("nachfuellenknopf");
    nachfuellenknopf.addEventListener("click", function (e) {
        if (GM_getValue("expertenmodus_" + held, false) == false) {
            if (pruefenDassNichtZuVieleItemsGefundenWurden() == true) {
                if (GM_getValue("ausruestungsschritt_" + held, -1) == -1) {
                    var gewaehltesprofil = GM_getValue("gewaehltesprofil_" + held, 0);
                    nachfuellen(gewaehltesprofil);
                } else {
                    ergeignisHinzufuegen(true, "Sie können keine Verbrauchsgegenstände nachfüllen, während sie sich beim Ausrüsten befinden.");
                }
            } else {
                ergeignisHinzufuegen(true, "Sie können keine Verbrauchsgegenstände nachfüllen, da ihr Rucksack überfüllt ist. Bitte werfen sie erst ein paar Gegenstände weg.");
            }
        } else {
            ergeignisHinzufuegen(true, "Sie können keine Verbrauchsgegenstände nachfüllen, wenn sie sich im Expertenmodus befinden.");
        }
    }, false);
}


//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Fügt den Infobereich ein, um Warnungen auszugeben
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function infoBereichEinblenden() {
    var protokollzeilen = GM_getValue("protokollfeldhoehe", 2);
    var infobereich = document.createElement("div");
    infobereich.id = 'infobereich';
    infobereich.innerHTML = '' +
        '<div align="center" style="color:#000000; background-color:#252525; margin-top: 5px; margin-bottom: 5px; padding:5px; border: thin; border-color:#000000; border-style:solid; width: auto;">' +
        '<form id="infoform" name="infoform" style="padding: 0px; margin: 0px;">' +
        '<span align="center" style="font-size:larger; font-weight: bolder; color: #FFFFFF;">Protokoll</span><br>' +
        '<textarea name="ergeignisliste" id="ergeignisliste" cols="100" rows="' + protokollzeilen + '" align="center" style="background-color:#333333; padding: 5px; margin: 5px; width: 95%;" readonly></textarea><br>' +
        '<input type="button" name="ereignisspeicherloeschenknopf" id="ereignisspeicherloeschenknopf" value="Einträge Löschen" class="button"/>' +
        '</form>' +
        '</div>' +
        '<div style="clear:both;"></div>';
    hauptform.parentNode.insertBefore(infobereich, hauptform);
    ereignisliste = document.getElementById("ergeignisliste");
    ergeignisSpeicherEinfuegen();
    //Knopf Aktion zuweisen
    var ereignisspeicherloeschenknopf = document.getElementById("ereignisspeicherloeschenknopf");
    ereignisspeicherloeschenknopf.addEventListener("click", function (e) {
        ergeignisSpeicherLoeschen();
    }, false);
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Entfernt den Infobereich
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function infoBereichEntfernen() {
    var infobereich = document.getElementById("infobereich");
    if (infobereich != undefined) {
        infobereich.parentNode.removeChild(infobereich);
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Erzeugt einen String des aktuellen Datums im Format "DD.MM.YYYY HH:MM:SS"
//Erwartet: -
//Gibt aus: Datumsstring
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function aktuellesDatum() {
    var jetzt = new Date();
    var jetzttag = jetzt.getDate();
    if (jetzttag <= 9) {
        jetzttag = "0" + jetzttag;
    }
    var jetztmonat = jetzt.getMonth() + 1;
    if (jetztmonat <= 9) {
        jetztmonat = "0" + jetztmonat;
    }
    var jetztjahr = 2000 + (jetzt.getYear() - 100);
    var jetztstunde = jetzt.getHours();
    if (jetztstunde <= 9) {
        jetztstunde = "0" + jetztstunde;
    }
    var jetztminute = jetzt.getMinutes();
    if (jetztminute <= 9) {
        jetztminute = "0" + jetztminute;
    }
    var jetztsekunde = jetzt.getSeconds();
    if (jetztsekunde <= 9) {
        jetztsekunde = "0" + jetztsekunde;
    }
    var jetztdatum = jetzttag + '.' + jetztmonat + '.' + jetztjahr + ' ' + jetztstunde + ':' + jetztminute + ':' + jetztsekunde;
    return jetztdatum;
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Fügt dem Infobereich einen neuen Ereigniseintrag hinzu und speichert das Ereignis in
//Erwartet: true/false für info ab warnung oder nicht; einen String mit dem hinzuzufügendem Ereignistext
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function ergeignisHinzufuegen(isteinewarnung, ereignistext) {
    var protokollierungsstufe = GM_getValue("protokollierung", 1);
    if (protokollierungsstufe > 0) {
        if ((protokollierungsstufe == 1 && isteinewarnung == true) || protokollierungsstufe == 2) {
            var ereignisliste = document.getElementById("ergeignisliste");
            if (ereignisliste == undefined) {
                infoBereichEinblenden();
                var ereignisliste = document.getElementById("ergeignisliste");
            }
            var jetztdatum = aktuellesDatum();
            var ereigniseintrag = jetztdatum + " - " + ereignistext + "\n";
            ereignisliste.value = ereigniseintrag + ereignisliste.value;
            //Ereignis dem Ereignisspeicher hinzufügen
            var bisherigeereignisliste = GM_getValue("ereignisliste_" + held, '');
            var neueereignisliste = ereigniseintrag + bisherigeereignisliste;
            GM_setValue("ereignisliste_" + held, neueereignisliste);
        }
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Löscht den Ereignisspeicher für diesen Helden
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function ergeignisSpeicherLoeschen() {
    GM_setValue("ereignisliste_" + held, "");
    infoBereichEntfernen();
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Setzt die Formularelemente auf den gespeicherten Wert
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function optionsmenueElementeSetzen() {
    //Protokollierungsstufe
    var protokollierungsstufe = GM_getValue("protokollierung", 1);
    for (var radionummer = 0; radionummer <= 2; radionummer++) {
        if (parseInt(document.getElementById("protokoll1_" + radionummer).value) == protokollierungsstufe) {
            document.getElementById("protokoll1_" + radionummer).checked = true;
            break;
        }
    }
    //Protokollhöhe
    var protokoll2 = document.getElementById("protokoll2");
    var protokollzeilen = GM_getValue("protokollfeldhoehe", 2);
    for (var optionnummer = 0; optionnummer <= 2; optionnummer++) {
        if (parseInt(protokoll2.options[optionnummer].value) == protokollzeilen) {
            protokoll2.options[optionnummer].selected = true;
            break;
        }
    }
    //Protokoll Auto-Löschung
    var protokoll3 = document.getElementById("protokoll3");
    var protokollautoloeschung = GM_getValue("protokollautoloeschung", false);
    if (protokollautoloeschung == true) {
        protokoll3.checked = true;
    } else {
        protokoll3.checked = false;
    }
    //Updateprüfung
    var updatepruefung = GM_getValue("updatepruefung", 0);
    if (updatepruefung == 0) {
        document.getElementById("updatepruefung_0").checked = true;
    } else {
        document.getElementById("updatepruefung_1").checked = true;
    }
    //Gegenstände ablegen
    var gegenstaendeablegen = GM_getValue("gegenstaendeablegen", 1);
    if (gegenstaendeablegen == 0) {
        document.getElementById("ablegen_0").checked = true;
    } else {
        if (gegenstaendeablegen == 1) {
            document.getElementById("ablegen_1").checked = true;
        } else {
            document.getElementById("ablegen_2").checked = true;
        }
    }
    var checkboxablegenindividuell = document.getElementById("ablegenindividuell");
    var ablegenindividuellaktiv = GM_getValue("ablegenindividuellaktiv_" + held, false);
    if (ablegenindividuellaktiv == true) {
        checkboxablegenindividuell.checked = true;
    } else {
        checkboxablegenindividuell.checked = false;
    }
    //Verdunkelung
    var verdunkelung = GM_getValue("verdunkelung", 1);
    if (verdunkelung == 0) {
        document.getElementById("verdunkelung_0").checked = true;
    } else {
        document.getElementById("verdunkelung_1").checked = true;
    }
    //VG-Abweichungsbereich nach Unten
    var vgabweichung1 = document.getElementById("vgabweichung1");
    var vgabweichungmin = GM_getValue("vgabweichungmin", 100);
    for (var optionnummer = 0; optionnummer <= 10; optionnummer++) {
        if (parseInt(vgabweichung1.options[optionnummer].value) == vgabweichungmin) {
            vgabweichung1.options[optionnummer].selected = true;
            break;
        }
    }
    //VG-Abweichungsbereich nach Oben
    var vgabweichung2 = document.getElementById("vgabweichung2");
    var vgabweichungmax = GM_getValue("vgabweichungmax", 100);
    for (var optionnummer = 0; optionnummer <= 10; optionnummer++) {
        if (parseInt(vgabweichung2.options[optionnummer].value) == vgabweichungmax) {
            vgabweichung2.options[optionnummer].selected = true;
            break;
        }
    }
}


//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Fügt das Optionsmenü ein
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function optionsmenueEinfuegen() {
    if (document.getElementById("optionsmenue") == undefined) {
        var optionsmenue = document.createElement("div");
        optionsmenue.innerHTML = '' +
            '<div align="center" style="margin-top: 0px; margin-bottom: 0px; padding:5px; width: 100%;">' +
            '<form id="optionsform" name="optionsform">' +
            '<table width="100%" border="0" cellspacing="0" cellpadding="0" style="border: thin; border-color:#000000; border-style:solid;">' +
            '<tr>' +
            '<td colspan="5" style="background-color: #330000; border-bottom: thin; border-bottom-color:#000000; border-bottom-style:solid;  padding-top: 5px; padding-bottom: 5px;" align="center"><div style="float: left; width: 12px; height: 12px;">' +
            '<span style="vertical-align: bottom; padding-left: 5px;" id="___wodToolTip_UniqueId__9998" onmouseover="return wodToolTip(this,\'' +
            '<h2><strong>Kurzanleitung: Optionsmenü</strong></h2>' +
            '<h3>Protokollierung</h3>' +
            '<p><strong>nie: </strong><em>Stellt die Protokollierung komplett aus. Nicht empfehlenswert, da man so nicht mitbekommt, wenn ein Gegenstand nicht angelegt werden konnte.</em><br>' +
            '<strong>nur Warnungen: </strong><em>Es werden nur Warnungen protokolliert, also Fehler und wenn Gegenstände nicht angelegt werden konnten.</em><br>' +
            '<strong>komplett: </strong><em>Es wird alles protokolliert. Gut wenn man verstehen will, was das Script tut und zum Finden von Fehlern.</em><br>' +
            '<strong>X Zeilen anzeigen: </strong><em>Stellt die Anzeigehöhe des Protokollfeldes ein.</em><br>' +
            '<strong>Auto-Löschung: </strong><em>Wenn angekreuzt, wird das Protokoll immer automatisch gelöscht, sobald man die Ausrüstungsseite neu betritt.</em></p>' +
            '<h3>Updateprüfung</h3>' +
            '<p>Aktiviert oder deaktiviert die Updateprüfung. Ist sie aktiviert wird maximal einmal pro Stunde online nachgefragt, ob eine neue Version des Ausrüsters vorhanden ist und ggf. ein Hinweis angezeigt.</p>' +
            '<h3>Gegenstände ablegen</h3>' +
            '<p><strong>auf Nachfrage: </strong><em>Beim Laden eines Profils wird beim Ausrüstungs-Menü im Schritt Nr. 0 gefragt, ob man seine aktuell angelegte Ausrüstung vor dem Ausrüsten der neuen Ausrüstung ablegen möchte.</em><br>' +
            '<strong>immer: </strong><em>Der Schritt Nr. 0 im Ausrüstungsmenü wird übersprungen und es werden die aktuell angelegten Gegenstände immer vorher abgelegt. Hat man nur einen Anlegeschritt verwendet wird das Ausrüstungs-Menü komplett übersprungen und die Gegenstände direkt angelegt.</em><br>' +
            '<strong>nie: </strong><em>Der Schritt Nr. 0 im Ausrüstungsmenü wird übersprungen und die aktuell angelegten Gegenstände werden nie vorher abgelegt. Hat man nur einen Anlegeschritt verwendet wird das Ausrüstungs-Menü komplett übersprungen und die Gegenstände direkt angelegt.</em><br>' +
            '<strong>nur für diesen Helden: </strong><em>Ist diese Checkbox aktiviert, dann gelten die 3 eben genannten Einstellungsmöglichkeiten individuell für diesen Helden und nicht für alle Helden, was der Fall ist, wenn die Checkbox deaktiviert ist.</em></p>' +
            '<h3>Verdunkelung</h3>' +
            '<p>Hier kann man die Verdunkelung der WoD-Seite deaktivieren, die angezeigt wird, wenn das Ausrüstungs-Menü oder das Wartefenster angezeigt werden. Sollte man nur deaktivieren, wenn man genau weiß, was man tut, da so die WoD-Seite nicht mehr gesperrt ist und man Dinge tun kann, die zu Fehlern führen könnten. Wenn man weiß was man tut, hat man aber auch die Möglichkeit, die Gegenstände zwischen den Ausrüstungsschritten zu verändern.</p>' +
            '<h3>VG-Abweichungbereich</h3>' +
            '<p>Mit diesen 2 Dropdown-Menüs kann man global die maximal erlaubte Abweichung, nach oben und nach unten, von dem bevorzugen Wert der VG-Vollständigkeit, den man über den Expertenmodus festgelegt hat, bestimmen. Beispiel:<br>Soll ein VGs mit 50% Vollständigkeit bevorzugt werden und ist der VG-Abweichungsbereich auf -10% und + 30% eingestellt, dann werden alle VGs mit unter 40% Vollständigkeit und über 80% Vollständigkeit ignoriert und von den restlichen VGs das gewählt, was am dichtesten an 50% Vollständigkeit liegt.</p>' +
            '\');"><img alt="" src="http://www.stumpenhagen.net/bm/dunuins_wod_scripte/ausruester/info.gif" border="0" id="infoicon_optionsmenue"></span>' +
            '</div><span style="font-size:larger; font-weight: bolder; color: #FFFFFF;">Optionsmenü</span></td>' +
            '</tr>' +
            '<tr>' +
            '<td colspan="2" style="background-color: #444444; padding: 2px; color: #FFFFFF; border-right: thin; border-right-color:#000000; border-right-style:solid;"><div align="center" style="padding-bottom: 5px; padding-top: 3px;"><strong>Protokollierung</strong></div></td>' +
            '<td width="23%" style="background-color: #252525; padding: 2px; color: #FFFFFF; border-right: thin; border-right-color:#000000; border-right-style:solid;"><div align="center" style="padding-bottom: 5px; padding-top: 3px;"><strong>Updateprüfung</strong></div></td>' +
            '<td width="22%" style="background-color: #444444; padding: 2px; color: #FFFFFF; border-right: thin; border-right-color:#000000; border-right-style:solid;"><div align="center" style="padding-bottom: 5px; padding-top: 3px;"><strong>Gegenstände ablegen</strong></div></td>' +
            '<td width="23%" style="background-color: #252525; padding: 2px; color: #FFFFFF;"><div align="center" style="padding-bottom: 5px; padding-top: 3px;"><strong>Fensterverdunkelung</strong></div></td>' +
            '</tr>' +
            '<tr>' +
            '<td width="15%" style="background-color: #444444; padding: 2px; color: #FFFFFF;">' +
            '<input type="radio" name="protoll1" id="protokoll1_0" value="0" /> deaktiviert<br />' +
            '<input name="protoll1" type="radio" id="protokoll1_1" value="1" /> nur Warnungen<br />' +
            '<input type="radio" name="protoll1" id="protokoll1_2" value="2" /> komplett</td>' +
            '<td width="17%" style="background-color: #444444; padding: 2px; color: #FFFFFF; border-right: thin; border-right-color:#000000; border-right-style:solid;">' +
            '<select name="protokoll2" id="protokoll2">' +
            '<option value="2" id="protokoll2_0">3 Zeilen anzeigen.</option>' +
            '<option value="4" id="protokoll2_1">5 Zeilen anzeigen</option>' +
            '<option value="9" id="protokoll2_2">10 Zeilen anzeigen</option>' +
            '</select><br />' +
            '<input name="protokoll3" type="checkbox" id="protokoll3" checked="checked" /> Auto-Löschung</td>' +
            '<td style="background-color: #252525; padding: 2px; color: #FFFFFF; border-right: thin; border-right-color:#000000; border-right-style:solid;">' +
            '<input name="updatepruefung" type="radio" id="updatepruefung_0" value="0" /> aktiviert<br />' +
            '<input type="radio" name="updatepruefung" id="updatepruefung_1" value="1" /> deaktiviert</td>' +
            '<td style="background-color: #444444; padding: 2px; color: #FFFFFF; border-right: thin; border-right-color:#000000; border-right-style:solid;">' +
            '<table width="100%" border="0" cellspacing="0" cellpadding="0">' +
            '<tr>' +
            '<td width="60%">' +
            '<input type="radio" name="ablegen" id="ablegen_2" value="2" /> immer<br />' +
            '<input name="ablegen" type="radio" id="ablegen_1" value="1" /> auf Nachfrage</td>' +
            '<td width="40%">' +
            '<input name="ablegen" type="radio" id="ablegen_0" value="0" /> nie</td>' +
            '</tr>' +
            '<tr>' +
            '<td colspan="2">' +
            '<input type="checkbox" name="ablegenindividuell" id="ablegenindividuell" />nur für diesen Helden</td>' +
            '</tr>' +
            '</table></td>' +
            '<td style="background-color: #252525; padding: 2px; color: #FFFFFF;">' +
            '<input name="verdunkelung" type="radio" id="verdunkelung_0" value="0" /> deaktiviert<br />' +
            '<input name="verdunkelung" type="radio" id="verdunkelung_1" value="1" /> verdunkeln</td>' +
            '</tr>' +
            '<tr>' +
            '<td colspan="2" style="background-color: #252525; padding: 2px; color: #FFFFFF; border-right: thin; border-right-color:#000000; border-right-style:solid; border-top: thin; border-top-color:#000000; border-top-style:solid;"><div align="center" style="padding-bottom: 5px; padding-top: 3px;"><strong>Transfer</strong></div></td>' +
            '<td width="23%" style="background-color: #444444; padding: 2px; color: #FFFFFF; border-right: thin; border-right-color:#000000; border-right-style:solid; border-top: thin; border-top-color:#000000; border-top-style:solid;"><div align="center" style="padding-bottom: 5px; padding-top: 3px;"><strong>VG-Abweichungbereich</strong></div></td>' +
            '<td width="22%" style="background-color: #252525; padding: 2px; color: #FFFFFF; border-right: thin; border-right-color:#000000; border-right-style:solid; border-top: thin; border-top-color:#000000; border-top-style:solid;"><div align="center" style="padding-bottom: 5px; padding-top: 3px;"><strong></strong></div></td>' +
            '<td width="23%" style="background-color: #444444; padding: 2px; color: #FFFFFF; border-top: thin; border-top-color:#000000; border-top-style:solid;" ><div align="center" style="padding-bottom: 5px; padding-top: 3px;"><strong></strong></div></td>' +
            '</tr>' +
            '<tr>' +
            '<td colspan="2" style="background-color: #252525; padding: 2px; color: #FFFFFF; border-right: thin; border-right-color:#000000; border-right-style:solid;"><div align="center"><input type="button" name="exportknopf" id="exportknopf" value="Export" class="button"/>&nbsp;<input type="button" name="importknopf" id="importknopf" value="Import" class="button"/></div></td>' +
            '<td width="23%" style="background-color: #444444; padding: 2px; color: #FFFFFF; border-right: thin; border-right-color:#000000; border-right-style:solid;"><div align="center">' +
            '<select name="vgabweichung1" id="vgabweichung1">' +
            '<option value="100" id="vgabweichung1_0">-100%</option>' +
            '<option value="90" id="vgabweichung1_1">-90%</option>' +
            '<option value="80" id="vgabweichung1_2">-80%</option>' +
            '<option value="70" id="vgabweichung1_3">-70%</option>' +
            '<option value="60" id="vgabweichung1_4">-60%</option>' +
            '<option value="50" id="vgabweichung1_5">-50%</option>' +
            '<option value="40" id="vgabweichung1_6">-40%</option>' +
            '<option value="30" id="vgabweichung1_7">-30%</option>' +
            '<option value="20" id="vgabweichung1_8">-20%</option>' +
            '<option value="10" id="vgabweichung1_9">-10%</option>' +
            '<option value="0" id="vgabweichung1_10">-0%</option>' +
            '</select>  ' +
            '<select name="vgabweichung2" id="vgabweichung2">' +
            '<option value="100" id="vgabweichung2_0">+100%</option>' +
            '<option value="90" id="vgabweichung2_1">+90%</option>' +
            '<option value="80" id="vgabweichung2_2">+80%</option>' +
            '<option value="70" id="vgabweichung2_3">+70%</option>' +
            '<option value="60" id="vgabweichung2_4">+60%</option>' +
            '<option value="50" id="vgabweichung2_5">+50%</option>' +
            '<option value="40" id="vgabweichung2_6">+40%</option>' +
            '<option value="30" id="vgabweichung2_7">+30%</option>' +
            '<option value="20" id="vgabweichung2_8">+20%</option>' +
            '<option value="10" id="vgabweichung2_9">+10%</option>' +
            '<option value="0" id="vgabweichung2_10">+0%</option>' +
            '</select>  ' +
            '</div></td>' +
            '<td width="22%" style="background-color: #252525; padding: 2px; color: #FFFFFF; border-right: thin; border-right-color:#000000; border-right-style:solid;"></td>' +
            '<td width="23%" style="background-color: #444444; padding: 2px; color: #FFFFFF;"></td>' +
            '</tr>' +
            '</table>' +
            '</form>' +
            '</div>';
        var navi = document.getElementById("navibalken");
        optionsmenue.id = 'optionsmenue';
        navi.parentNode.insertBefore(optionsmenue, navi.nextSibling);
        optionsmenueElementeSetzen();
        //Klick auf Protokollierungsstufe erfassen und speichern
        var protokoll1_0 = document.getElementById("protokoll1_0");
        protokoll1_0.addEventListener("click", function (e) {
            GM_setValue("protokollierung", 0);
            ergeignisHinzufuegen(false, "Die Protokollierung wurde deaktiviert.");
        }, false);
        var protokoll1_1 = document.getElementById("protokoll1_1");
        protokoll1_1.addEventListener("click", function (e) {
            GM_setValue("protokollierung", 1);
            ergeignisHinzufuegen(false, "Es werden nur noch Warnungen protokolliert, also nicht anlegbare Gegenstände und Fehler.");
        }, false);
        var protokoll1_2 = document.getElementById("protokoll1_2");
        protokoll1_2.addEventListener("click", function (e) {
            GM_setValue("protokollierung", 2);
            ergeignisHinzufuegen(false, "Es wird nun komplett protokolliert.");
        }, false);
        //Änderung der Protokollfeldhöhe wird erfasst
        var protokoll2 = document.getElementById("protokoll2");
        protokoll2.addEventListener("change", function (e) {
            for (var optionnummer = 0; optionnummer <= 2; optionnummer++) {
                if (protokoll2.options[optionnummer].selected == true) {
                    var neueprotokollzeilen = parseInt(protokoll2.options[optionnummer].value);
                    break;
                }
            }
            GM_setValue("protokollfeldhoehe", neueprotokollzeilen);
            ereignisliste = document.getElementById("ergeignisliste");
            if (ereignisliste != undefined) {
                ereignisliste.rows = neueprotokollzeilen;
            }
            ergeignisHinzufuegen(false, "Die Höhe des Protokollfeldes wurde auf " + (neueprotokollzeilen + 1) + " Zeilen gesetzt.");
        }, false);
        //Klick auf die Auto-Löschungs-Checkbox feststellen
        var protokoll3 = document.getElementById("protokoll3");
        protokoll3.addEventListener("click", function (e) {
            if (protokoll3.checked == true) {
                GM_setValue("protokollautoloeschung", true);
                ergeignisHinzufuegen(false, "Auto-Löschung wurde aktiviert.");
            } else {
                GM_setValue("protokollautoloeschung", false);
                ergeignisHinzufuegen(false, "Auto-Löschung wurde deaktiviert.");
            }
        }, false);
        //Klicks auf die Updateprüfung feststellen
        var updatepruefung_0 = document.getElementById("updatepruefung_0");
        updatepruefung_0.addEventListener("click", function (e) {
            GM_setValue("updatepruefung", 0);
            ergeignisHinzufuegen(false, "Die Updateprüfung wurde aktiviert.");
        }, false);
        var updatepruefung_1 = document.getElementById("updatepruefung_1");
        updatepruefung_1.addEventListener("click", function (e) {
            GM_setValue("updatepruefung", 1);
            ergeignisHinzufuegen(false, "Die Updateprüfung wurde deaktiviert.");
        }, false);
        //Klicks auf die "Gegenstände vorher ablegen" Optionen feststellen
        var ablegen_0 = document.getElementById("ablegen_0");
        ablegen_0.addEventListener("click", function (e) {
            if (GM_getValue("ablegenindividuellaktiv_" + held, false) == true) {
                GM_setValue("ablegenindividuell_" + held, 0);
                ergeignisHinzufuegen(false, "Gegenstände werden nun für diesen Helden nie abgelegt.");
            } else {
                GM_setValue("gegenstaendeablegen", 0);
                ergeignisHinzufuegen(false, "Gegenstände werden nun nie abgelegt.");
            }
        }, false);
        var ablegen_1 = document.getElementById("ablegen_1");
        ablegen_1.addEventListener("click", function (e) {
            if (GM_getValue("ablegenindividuellaktiv_" + held, false) == true) {
                GM_setValue("ablegenindividuell_" + held, 1);
                ergeignisHinzufuegen(false, "Es wird nun bei diesem Helden jedes mal beim Laden gefragt, ob die Gegenstände vor dem Ausrüsten abgelegt werden sollen.");
            } else {
                GM_setValue("gegenstaendeablegen", 1);
                ergeignisHinzufuegen(false, "Es wird nun jedes mal beim Laden gefragt, ob die Gegenstände vor dem Ausrüsten abgelegt werden sollen.");
            }
        }, false);
        var ablegen_2 = document.getElementById("ablegen_2");
        ablegen_2.addEventListener("click", function (e) {
            if (GM_getValue("ablegenindividuellaktiv_" + held, false) == true) {
                GM_setValue("ablegenindividuell_" + held, 2);
                ergeignisHinzufuegen(false, "Gegenstände werden nun für diesen Helden immer automatisch abgelegt.");
            } else {
                GM_setValue("gegenstaendeablegen", 2);
                ergeignisHinzufuegen(false, "Gegenstände werden nun immer automatisch abgelegt.");
            }
        }, false);
        var checkboxablegenindividuell = document.getElementById("ablegenindividuell");
        checkboxablegenindividuell.addEventListener("click", function (e) {
            if (checkboxablegenindividuell.checked == true) {
                GM_setValue("ablegenindividuellaktiv_" + held, true);
                GM_setValue("ablegenindividuell_" + held, GM_getValue("gegenstaendeablegen", 1));
                ergeignisHinzufuegen(false, "Die Einstellungen für das Ablegen der Gegenstände gelten ab jetzt für diesen Helden individuell.");
            } else {
                GM_setValue("ablegenindividuellaktiv_" + held, false);
                ergeignisHinzufuegen(false, "Die Einstellungen für das Ablegen der Gegenstände gelten nun global.");
            }
        }, false);
        //Klicks auf die Verdunkelungsoptionen feststellen
        var verdunkelung_0 = document.getElementById("verdunkelung_0");
        verdunkelung_0.addEventListener("click", function (e) {
            GM_setValue("verdunkelung", 0);
            ergeignisHinzufuegen(false, "Die Verdunkelung bei dem Wartefenster und dem Ausrüstungsmenü wurde deaktiviert.");
        }, false);
        var verdunkelung_1 = document.getElementById("verdunkelung_1");
        verdunkelung_1.addEventListener("click", function (e) {
            GM_setValue("verdunkelung", 1);
            ergeignisHinzufuegen(false, "Die Verdunkelung bei dem Wartefenster und dem Ausrüstungsmenü wurde aktiviert.");
        }, false);
        var exportknopf = document.getElementById("exportknopf");
        exportknopf.addEventListener("click", function (e) {
            if (GM_getValue("ausruestungsschritt_" + held, -1) == -1) {
                if (pruefenDassNichtZuVieleItemsGefundenWurden() == true) {
                    exportfensterAnzeigen();
                } else {
                    ergeignisHinzufuegen(true, "Sie können nicht Exportieren, wenn ihr Rucksack noch überfüllt ist. Werfen sie bitte zuerst ein paar Gegenstände weg.");
                }
            } else {
                ergeignisHinzufuegen(true, "Sie können nicht Exportieren, während Sie sich beim Ausrüsten befinden.");
            }
        }, false);
        var importknopf = document.getElementById("importknopf");
        importknopf.addEventListener("click", function (e) {
            if (GM_getValue("ausruestungsschritt_" + held, -1) == -1) {
                if (pruefenDassNichtZuVieleItemsGefundenWurden() == true) {
                    importfensterAnzeigen();
                } else {
                    ergeignisHinzufuegen(true, "Sie können nicht Importieren, wenn ihr Rucksack noch überfüllt ist. Werfen sie bitte zuerst ein paar Gegenstände weg.");
                }
            } else {
                ergeignisHinzufuegen(true, "Sie können nicht Importieren, während Sie sich beim Ausrüsten befinden.");
            }
        }, false);
        //Änderung des VG-Abweichungsbereich nach Unten
        var vgabweichung1 = document.getElementById("vgabweichung1");
        vgabweichung1.addEventListener("change", function (e) {
            for (var optionnummer = 0; optionnummer <= 10; optionnummer++) {
                if (vgabweichung1.options[optionnummer].selected == true) {
                    var neuevgabweichung1 = parseInt(vgabweichung1.options[optionnummer].value);
                    break;
                }
            }
            GM_setValue("vgabweichungmin", neuevgabweichung1);
            ergeignisHinzufuegen(false, "Der maximale VG-Abweichungsbereich nach Unten wurde auf -" + neuevgabweichung1 + "% gesetzt.");
        }, false);
        //Änderung des VG-Abweichungsbereich nach Oben
        var vgabweichung2 = document.getElementById("vgabweichung2");
        vgabweichung2.addEventListener("change", function (e) {
            for (var optionnummer = 0; optionnummer <= 10; optionnummer++) {
                if (vgabweichung2.options[optionnummer].selected == true) {
                    var neuevgabweichung2 = parseInt(vgabweichung2.options[optionnummer].value);
                    break;
                }
            }
            GM_setValue("vgabweichungmax", neuevgabweichung2);
            ergeignisHinzufuegen(false, "Der maximale VG-Abweichungsbereich nach Oben wurde auf +" + neuevgabweichung2 + "% gesetzt.");
        }, false);
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Fügt die Einträge des Ereignispeichers in die Ereignisliste ein
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function ergeignisSpeicherEinfuegen() {
    var ereignisliste = document.getElementById("ergeignisliste");
    if (ereignisliste != undefined) {
        var ereignisse = GM_getValue("ereignisliste_" + held, "");
        ereignisliste.value = ereignisse;
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Entfernt das Optionsmenü
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function optionsmenueEntfernen() {
    var optionsmenue = document.getElementById("optionsmenue");
    if (optionsmenue != undefined) {
        optionsmenue.parentNode.removeChild(optionsmenue);
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Öffnet den Expertenmodus
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function expertenModusAktivieren() {
    optionsmenueEinfuegen();
    expertenmodusknopf = document.getElementById("expertenmodusknopf");
    expertenmodusknopf.value = "-";
    profiOptionenEinblenden();
    GM_setValue("expertenmodus_" + held, true);
    var okknopf = document.getElementsByName("ok");
    if (okknopf != undefined) {
        okknopf[0].disabled = true;
    }
    if (GM_getValue("erststarthinweis_2_gelesen", false) == false) {
        var infoicon = document.getElementById("infoicon_profioptionen");
        if (infoicon != undefined) {
            infoicon.addEventListener("mouseover", function (e) {
                GM_setValue("erststarthinweis_2_gelesen", true);
            }, false);
            pulsierenderRahmen(infoicon, 1002, true);
        }
    }
    if (GM_getValue("erststarthinweis_3_gelesen", false) == false) {
        var infoicon = document.getElementById("infoicon_optionsmenue");
        infoicon.addEventListener("mouseover", function (e) {
            GM_setValue("erststarthinweis_3_gelesen", true);
        }, false);
        pulsierenderRahmen(infoicon, 1003, true);
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Verlässt den Expertenmodus
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function expertenModusDeaktivieren() {
    optionsmenueEntfernen();
    expertenmodusknopf = document.getElementById("expertenmodusknopf");
    expertenmodusknopf.value = "+";
    profiOptionenAusblenden();
    GM_setValue("expertenmodus_" + held, false);
    var okknopf = document.getElementsByName("ok");
    if (okknopf != undefined) {
        okknopf[0].disabled = false;
    }
    if (GM_getValue("erststarthinweis_1_gelesen", false) == false) {
        var infoicon = document.getElementById("infoicon_kurzanleitung");
        infoicon.addEventListener("mouseover", function (e) {
            GM_setValue("erststarthinweis_1_gelesen", true);
        }, false);
        pulsierenderRahmen(infoicon, 1001, true);
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Wechselt zwischen Experten und Einfachem Modus
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function expertenModusWechseln() {
    var expertenmodusaktiv = GM_getValue("expertenmodus_" + held, false);
    if (expertenmodusaktiv == false) {
        expertenModusAktivieren();
        ergeignisHinzufuegen(false, "Expertenmodus aktiviert");
    } else {
        expertenModusDeaktivieren();
        ergeignisHinzufuegen(false, "Expertenmodus deaktiviert");
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Setzt die GM-Variablen auf den Standardwert, wenn der Ausrüster zum 1. mal gestartet wird
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function erststartPruefenUndDurchfuehren() {
    //Feststelleb ob Ausrüster zum 1. mal gestartet wird
    if (GM_getValue("erststart", true) == true) {
        GM_setValue("erststart", true);
        if (GM_getValue("protokollierung", -1) == -1) {
            GM_setValue("protokollierung", 1);
        }
        if (GM_getValue("protokollfeldhoehe", -1) == -1) {
            GM_setValue("protokollfeldhoehe", 2);
        }
        if (GM_getValue("protokollautoloeschung", -1) == -1) {
            GM_setValue("protokollautoloeschung", false);
        }
        if (GM_getValue("updatepruefung", -1) == -1) {
            GM_setValue("updatepruefung", 0);
        }
        if (GM_getValue("gegenstaendeablegen", -1) == -1) {
            GM_setValue("gegenstaendeablegen", 1);
        }
        if (GM_getValue("verdunkelung", -1) == -1) {
            GM_setValue("verdunkelung", 1);
        }
        if (GM_getValue("vgabweichungmin", -1) == -1) {
            GM_setValue("vgabweichungmin", 100);
        }
        if (GM_getValue("vgabweichungmax", -1) == -1) {
            GM_setValue("vgabweichungmax", 100);
        }
        if (GM_getValue("heldenliste_anzahl", -1) == -1) {
            GM_setValue("heldenliste_0", parseInt(held));
        }
        if (GM_getValue("heldenliste_anzahl", -1) == -1) {
            GM_setValue("heldenliste_anzahl", 1);
        }
        GM_setValue("erststart", false);
        ergeignisHinzufuegen(false, "Dies ist der Erststart. Standardeinstellungen wurden gesetzt.");
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Setzt die GM-Variablen auf den Standardwert, wenn der Ausrüster zum 1. mal gestartet wird
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function individuellenErststartPruefenUndDurchfuehren() {
    //Feststellen ob der Ausrüster zum 1. mal mit diesem Helden gestartet wird
    if (GM_getValue("erststart_" + held, true) == true) {
        GM_setValue("erststart_" + held, true);
        if (held != null && held != undefined) {
            heldSpeichern(parseInt(held), heldennameHerausfinden(), weltUmwandeln(welt));
        }
        if (GM_getValue("expertenmodus_" + held, -1) == -1) {
            GM_setValue("expertenmodus_" + held, false);
        }
        if (GM_getValue("gewaehltesprofil_" + held, -1) == -1) {
            GM_setValue("gewaehltesprofil_" + held, 0);
        }
        if (GM_getValue("ausruestungsschritt_" + held, -2) == -2) {
            GM_setValue("ausruestungsschritt_" + held, -1);
        }
        if (GM_getValue("letztesablegenauswahl_" + held, -1) == -1) {
            GM_setValue("letztesablegenauswahl_" + held, 1);
        }
        if (GM_getValue("restueberspringen_" + held, true) == true) {
            GM_setValue("restueberspringen_" + held, false);
        }
        if (GM_getValue("ausruestenvongruppe_" + held, -1) == -1) {
            GM_setValue("ausruestenvongruppe_" + held, false);
        }
        if (GM_getValue("ablegenindividuellaktiv_" + held, -1) == -1) {
            GM_setValue("ablegenindividuellaktiv_" + held, false);
        }
        if (GM_getValue("ablegenindividuell_" + held, -1) == -1) {
            GM_setValue("ablegenindividuell_" + held, 1);
        }
        GM_setValue("erststart_" + held, false);
        ergeignisHinzufuegen(false, "Sie nutzen den Ausrüster zum Ersten mal mit diesem Helden. Standardeinstellungen wurden gesetzt.");
    }
}


//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Sucht die 4 Tabellen mit den Gegenständen und vergibt diesen IDs
//Erwartet: -
//Gibt aus: true bei fehler, sonst false
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function tabellenIdsVergeben() {
    //Alle 4 Tabellen finden
    var error = false;
    var allespalten = document.getElementsByTagName("TD");
    var tabellegefunden = new Array(false, false, false, false);
    for (var ispalte = allespalten.length - 1; ispalte >= 0; ispalte--) {
        if (allespalten[ispalte].innerHTML == "Kopf") {
            allespalten[ispalte].parentNode.parentNode.id = "ausruestungstabelle_0";
            tabellegefunden[0] = true;
        }
        if (allespalten[ispalte].innerHTML == "Orden #1") {
            ;
            tabellegefunden[1] = true;
            allespalten[ispalte].parentNode.parentNode.id = "ausruestungstabelle_1";
        }
        if (allespalten[ispalte].innerHTML == "Tasche #1") {
            tabellegefunden[2] = true;
            allespalten[ispalte].parentNode.parentNode.id = "ausruestungstabelle_2";
        }
        if (allespalten[ispalte].innerHTML == "Ring #1") {
            tabellegefunden[3] = true;
            allespalten[ispalte].parentNode.parentNode.id = "ausruestungstabelle_3";
        }
        if (tabellegefunden[0] == true && tabellegefunden[1] == true && tabellegefunden[2] == true && tabellegefunden[3] == true) {
            break;
        }
    }
    if (tabellegefunden[0] == false || tabellegefunden[1] == false || tabellegefunden[2] == false || tabellegefunden[3] == false) {
        ergeignisHinzufuegen(true, "Fehler: Es konnten nicht alle 4 Tabellen gefunden werden!");
        error = true;
    }
    return error;
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Färbt alle Zeilen der 4 Tabellen abwechselnd hell oder dunkel ein oder entfernt die farbe
//Erwartet: false = Farbe entfernen; true = Einfärben)
//Gibt aus: true falls fehler, sonst false
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function zeilenFarbeAendern(einfaerben) {
    //Alle 4 Tabellen abarbeiten
    var tabelle = new Array();
    var error = false;
    if (document.getElementById("ausruestungstabelle_0") == undefined) {
        tabellenIdsVergeben();
    }
    for (var itabelle = 0; itabelle <= 3; itabelle++) {
        tabelle[itabelle] = document.getElementById("ausruestungstabelle_" + itabelle);
        if (tabelle[itabelle] != undefined) {
            //Alle Zeilen abarbeiten
            for (var izeile = 0; izeile < tabelle[itabelle].childNodes.length; izeile++) {
                if (tabelle[itabelle].childNodes[izeile].tagName == "TR") {
                    if (tabelle[itabelle].childNodes[izeile].id != "") {
                        var hell = true;
                    } else {
                        var hell = false;
                    }
                    //Alle Spalten abarbeiten
                    for (var ispalte = 0; ispalte < tabelle[itabelle].childNodes[izeile].childNodes.length; ispalte++) {
                        if (tabelle[itabelle].childNodes[izeile].childNodes[ispalte].tagName == "TD") {
                            if (einfaerben == true) {
                                //Spalte einfärben
                                if (hell == false) {
                                    tabelle[itabelle].childNodes[izeile].childNodes[ispalte].style.backgroundColor = "#252525";
                                } else {
                                    tabelle[itabelle].childNodes[izeile].childNodes[ispalte].style.backgroundColor = "#444444";
                                }
                            } else {
                                //Spalte Farbe entfernen
                                tabelle[itabelle].childNodes[izeile].childNodes[ispalte].style.backgroundColor = "transparent";
                            }
                        }
                    }
                }
            }
        } else {
            error = true;
        }
    }
    return error;
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Erzeugt eine Kopie des übergebenen DropDown-Menüs und gibt diese dann aus
//Erwartet: das zu kopierende Dropdown-Objekt, die ID für das neue Dropdown, einen Integer zwischen 0 und 2 (0=echte kopie; 1/2=kopie als 1./.2 alternativgegenstand)
//Gibt aus: die neu erstellte Kopie des Dropdown-Objektes oder false falls das eigegebene Dropdown nicht gefunden wurde
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function dropdownKopieren(dropdown, id, alternativitem) {
    var gefunden = false;
    if (dropdown != undefined) {
        var dropdownkopie = document.createElement("SELECT");
        dropdownkopie.id = id;
        for (var ioption = 0; ioption < dropdown.options.length; ioption++) {
            var wert = dropdown.options[ioption].value;
            var text = dropdown.options[ioption].text;
            if (dropdown.options[ioption].selected == true) {
                var ausgewaehlt = true;
            } else {
                var ausgewaehlt = false;
            }
            var neueoption = document.createElement("OPTION");
            neueoption.value = wert;
            neueoption.text = text;
            neueoption.id = id + "_" + ioption;
            if (alternativitem == 0) {
                if (ausgewaehlt == true) {
                    neueoption.selected = true;
                } else {
                    neueoption.selected = false;
                }
            } else {
                neueoption.selected = false;
            }
            dropdownkopie.appendChild(neueoption);
        }
        if (alternativitem >= 1) {
            var neueoption = document.createElement("OPTION");
            neueoption.value = "nichts";
            neueoption.text = "Alternativgegenstand " + alternativitem + ". Grades";
            neueoption.id = id + "_nichts";
            neueoption.selected = true;
            dropdownkopie.appendChild(neueoption);
        }
    } else {
        var dropdownkopie = false;
    }
    return dropdownkopie;
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Fügt einer Zeile mit einem Dropdown die 2 Alternativitem- und das Anlegeschrittdropdown hinzu
//Erwartet: String mit dem Ort der im WoD-Dropdown steht und Integer mit der Zahl die im WoD-Dropdown steht
//Gibt aus: true falls das WoD Dropdown gefunden wurde und false, falls es nicht der Fall ist
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function zeileProfiOptionenHinzufuegen(ort, nummer) {
    var gefunden = false;
    var dropdown = document.getElementsByName("LocationEquip[go_" + ort + "][" + nummer + "]");
    if (dropdown != undefined) {
        gefunden = true;
        var profioptionenzeile = document.createElement("TR");
        profioptionenzeile.id = "profioptionenzeile_" + ort + "_" + nummer;
        var profioptionenspaltelinks = document.createElement("TD");
        profioptionenspaltelinks.className = "texttoken";
        if (ort == "kopf" && nummer == 0) {
            profioptionenspaltelinks.innerHTML = '<span style="vertical-align: bottom; text-align: center;" id="___wodToolTip_UniqueId__9995" onmouseover="return wodToolTip(this,\'' +
                '<h2><strong>Kurzanleitung: Experten-Modus</strong></h2>' +
                '<p>Der Experten-Modus ist zum Erstellen und Verändern von komplexeren Ausrüstungsprofilen gedacht. Der Nachfüllen-Knopf ist hier komplett ohne Funktion und bei einem Klick auf den Laden-Knopf wird nicht die, in einem Profil gespeicherte, Ausrüstung angelegt, sondern es werden die Einstellungen eines Profils geladen, damit man diese Verändern kann, falls man ein bereits bestehendes Profil nur überarbeiten möchte.<br>Das Speichern über den Speichern-Knopf geht hier ebenso, wie in dem Normalen Modus, jedoch kann man zu jedem Gegenstandsort zusätzlich folgendes einstellen:</p>' +
                '<p><strong>1.) Alternativgegenstand 1. Grades</strong><br />' +
                'Hier kann man einen Gegenstand auswählen, der angelegt werden soll, wenn der Hauptgegenstand nicht geladen werden kann. Hat man z.B. Verbesserte Armbrustbolzen als Hauptgegenstand, also im obersten Dropdown, eingestellt und Armbrustbolzen als Alternativgegenstand 1. Grades, dann werden solange die Verbesserten Armbrustbolzen benutzt, bis sich keine mehr im Lager befinden, erst danach die Armbrustbolzen.</p>' +
                '<p><strong>2.) Alternativgegenstand 2. Grades</strong><br />' +
                'Hier kann man einen Gegenstand auswählen, der angelegt werden soll, wenn sowohl der Hauptgegenstand, als auch der Alternativgegenstand 1. Grades nicht geladen werden können.</p>' +
                '<p><strong>3.) Anlegeschritt</strong><br />' +
                'Muss man erst bestimmte Gegenstände anlegen, um die Anforderungen für andere Gegenstände zu erfüllen, oder müssen gewisse Gegenstände als erstes angelegt werden, da sie die Anzahl der tragbaren Gegenstände erhöhen, so sollte man die Anlegeschritte nutzen. Dazu kann man jedem Gegenstand einer der 5. Anlegeschritte zuordnen, die dann, der Reihenfolge nach, beim Ausrüsten, Schritt für Schritt angelegt werden.</p>' +
                '<p><strong>4.) VGs Bevorzugen</strong><br />' +
                'Mit diesen 3 Dropdown-Menüs kann man festlegen, welche Verbrauchsgegenstände bevorzugt werden, wenn sich mehrere des gleichen Typs im Lager befinden. Das XXX% steht dabei für die ideale Vollständigkeit der Ladungen eines VGs, die angestrebt werden soll. Stellt man also z.B. 50% ein, dann wird im Idealfall ein halbvolles VG ausgewählt. Das erste Dropdown steht für den Hauptgegenstand, das 2. für den Alternativgegenstand 1. Grades und das 3. für den Alternativgegenstand  2. Grades.</p>' +
                '\');"><img alt="" src="http://www.stumpenhagen.net/bm/dunuins_wod_scripte/ausruester/info.gif" border="0" id="infoicon_profioptionen"></span>';
        }
        profioptionenzeile.appendChild(profioptionenspaltelinks);
        var profioptionenspalterechts = document.createElement("TD");
        profioptionenspalterechts.className = "texttoken middle";
        profioptionenzeile.appendChild(profioptionenspalterechts);
        var zeile = dropdown[0].parentNode.parentNode;
        zeile.parentNode.insertBefore(profioptionenzeile, zeile.nextSibling);
        for (var i = 1; i <= 4; i++) {
            switch (i) {
                case 1:
                    //1. Alternativ-Dropdown einfügen
                    var neueselement = dropdownKopieren(dropdown[0], "alternativitem_" + i + "_" + ort + "_" + nummer, i);
                    var zeilenumbruch = document.createElement("BR");
                    profioptionenspalterechts.appendChild(neueselement);
                    profioptionenspalterechts.appendChild(zeilenumbruch);
                    break;
                case 2:
                    //2. Alternativ-Dropdown einfügen
                    var neueselement = dropdownKopieren(dropdown[0], "alternativitem_" + i + "_" + ort + "_" + nummer, i);
                    var zeilenumbruch = document.createElement("BR");
                    profioptionenspalterechts.appendChild(neueselement);
                    profioptionenspalterechts.appendChild(zeilenumbruch);
                    break;
                case 3:
                    //Anlegeschritt-Dropdown einfügen
                    var anlegeschrittdropdown = document.createElement("SELECT");
                    anlegeschrittdropdown.id = "anlegeschritt_" + ort + "_" + nummer;
                    for (var ianlegeschtitt = 1; ianlegeschtitt <= 5; ianlegeschtitt++) {
                        var neueoption = document.createElement("OPTION");
                        neueoption.value = ianlegeschtitt;
                        neueoption.text = "Im " + ianlegeschtitt + ". Schritt anlegen";
                        neueoption.id = "anlegeschritt_" + ort + "_" + nummer + "_" + ianlegeschtitt;
                        if (ianlegeschtitt == 1) {
                            neueoption.selected = true;
                        } else {
                            neueoption.selected = false;
                        }
                        anlegeschrittdropdown.appendChild(neueoption);
                    }
                    profioptionenspalterechts.appendChild(anlegeschrittdropdown);
                    break;
                case 4:
                    var vgsbevorzugendiv = document.createElement("DIV");
                    vgsbevorzugendiv.id = "vgsbevorzugendiv_" + ort + "_" + nummer;
                    var divinhalt = 'VGs bevorzugen(Haupt/Alt1/Alt2): ';
                    for (var idropdown = 0; idropdown <= 2; idropdown++) {
                        divinhalt += '<select id="bevorzugtevollstaendigkeit_' + ort + '_' + nummer + '_' + idropdown + '">' +
                            '<option id="bevorzugtevollstaendigkeit_' + ort + '_' + nummer + '_' + idropdown + '_0" value="100" selected="selected">100%</option>' +
                            '<option id="bevorzugtevollstaendigkeit_' + ort + '_' + nummer + '_' + idropdown + '_1" value="75">75%</option>' +
                            '<option id="bevorzugtevollstaendigkeit_' + ort + '_' + nummer + '_' + idropdown + '_2" value="50">50%</option>' +
                            '<option id="bevorzugtevollstaendigkeit_' + ort + '_' + nummer + '_' + idropdown + '_3" value="25">25%</option>' +
                            '<option id="bevorzugtevollstaendigkeit_' + ort + '_' + nummer + '_' + idropdown + '_4" value="1">1%</option>' +
                            '</select>&nbsp;';
                    }
                    vgsbevorzugendiv.innerHTML = divinhalt;
                    profioptionenspalterechts.appendChild(vgsbevorzugendiv);
                    for (var idropdown = 0; idropdown <= 2; idropdown++) {
                        var bevorzugtevollstaendigkeit = document.getElementById("bevorzugtevollstaendigkeit_" + ort + "_" + nummer + "_" + idropdown);
                        bevorzugtevollstaendigkeit.addEventListener("focus", function (e) {
                            switch (this.selectedIndex) {
                                case 0:
                                    this.selectedIndex = 4;
                                    break;
                                case 4:
                                    this.selectedIndex = 0;
                                    break;
                                default:
                                    this.selectedIndex = 0;
                                    break;
                            }
                        }, false);
                    }
                    break;
                default:
                    break;
            }
        }
        profioptionenzeile.style.visibility = "collapse";
    }
    return gefunden;
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Sucht alle Dropdown-Menüs der Ausrüstungsseite und fügt die 3 Profioptionen hinzu
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function profiOptionenHinzufuegen() {
    var alledropdowns = document.getElementsByTagName("SELECT");
    for (var idropdown = 0; idropdown < alledropdowns.length; idropdown++) {
        if (alledropdowns[idropdown].name.search(/LocationEquip/) != -1) {
            //Es handelt sich um ein Ausrüstungsdropdown
            var name = alledropdowns[idropdown].name
            var ortpos1 = name.search(/\[go_/);
            var ortpos2 = name.search(/\]\[/);
            var ort = name.substring(ortpos1 + 4, ortpos2);
            var nummer = name.match(/\d+/);
            zeileProfiOptionenHinzufuegen(ort, nummer);
        }
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Blendet alle Profioptionen ein
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function profiOptionenEinblenden() {
    var allezeilen = document.getElementsByTagName('TR');
    for (var izeile = 0; izeile < allezeilen.length; izeile++) {
        if (allezeilen[izeile].id.search(/profioptionenzeile/) != -1) {
            allezeilen[izeile].style.visibility = "visible";
        }
    }
    zeilenFarbeAendern(true);
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Blendet alle Profioptionen aus
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function profiOptionenAusblenden() {
    var allezeilen = document.getElementsByTagName('TR');
    for (var izeile = 0; izeile < allezeilen.length; izeile++) {
        if (allezeilen[izeile].id.search(/profioptionenzeile/) != -1) {
            allezeilen[izeile].style.visibility = "collapse";
        }
    }
    zeilenFarbeAendern(false);
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Prüft, ob der übergebene String ein Gruppengegenstand ist (also ob hinten ein "!" vorhanden ist)
//Erwartet: String mit Itemnamen aus Dropdown
//Gibt aus: true wenn es ein Gruppengegestand ist, sonst false
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function itemAufGruppenitemPruefen(itemname) {
    if (itemname.search(/\<b\>!\<\/b\>$/) != -1) {
        return true;
    } else {
        return false;
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Prüft, ob der übergebene String ein Verbrauchsgegenstand ist (also ob hinten ein "(X/Y)" vorhanden ist) und berechnet wie viel Prozent voll es ist.
//Erwartet: String mit Itemnamen aus Dropdown
//Gibt aus: Integer 0 bis 100 wenn es ein VG ist, -1 wenn es kein VG ist
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function itemAufLadungenPruefen(itemname) {
    var ladungssubstring = itemname.match(/\((\d+)\/(\d+)\)/);
    var ausgabe = -1;
    if (ladungssubstring) {
        ausgabe = Math.ceil(100 * RegExp.$1 / RegExp.$2);
    }
    return ausgabe;
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Prüft, ob ein Gegenstand abgelegt werden darf, also das ablegen keinen Resetpunkt kosten würde
//Erwartet: String mit Itemnamen aus Dropdown
//Gibt aus: true wenn es abgelegt werden darf, sonst false
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function itemAufAblegbarkeitPruefen(itemname) {
    if (itemname.search(/^!!/) != -1) {
        return false;
    } else {
        return true;
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Entfernt vom Eingabestring alles außer den Namen
//Erwartet: String mit Itemnamen aus Dropdown
//Gibt aus: String nur mit Itemnamen
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function itemnameHerausfinden(itemname) {
    var itemnameneu = itemname;
    //Das "!! " entfernen
    if (itemnameneu.search(/^!!/) != -1) {
        itemnameneu = itemnameneu.substr(3);
    }
    //Das "<b>!</b>" entfernen
    if (itemnameneu.search(/!$/) != -1) {
        itemnameneu = itemnameneu.substring(0, itemnameneu.length - 1);
    }
    //Das " (X/Y)" entfernen
    var ladungssubstring = itemnameneu.match(/\(\d+\/\d+\)/);
    if (ladungssubstring != undefined) {
        ladungssubstring += '';
        itemnameneu = itemnameneu.substring(0, (itemnameneu.length) - (ladungssubstring.length + 1));
    }
    return itemnameneu;
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Geht die Anlegeschritt-Dropdowns durch und berichtigt diese, falls Schritte ausgelassen wurden.
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function anlegeschrittBerichtigen() {
    var schritteanzahl = 1;
    if (GM_getValue("expertenmodus_" + held, false) == true) {
        var dropdowns = document.getElementsByTagName("SELECT");
        var schrittgenutzt = new Array(false, false, false, false, false);
        //Prüfen welche Schritte alles genutzt werden
        for (var dropdownnummer = 0; dropdownnummer < dropdowns.length; dropdownnummer++) {
            if (dropdowns[dropdownnummer].id.search(/anlegeschritt/) != -1) {
                schrittgenutzt[dropdowns[dropdownnummer].selectedIndex] = true;
            }
        }
        //Neue Anlegeshritte berechnen
        var schrittwirdzu = new Array(-1, -1, -1, -1, -1);
        for (var ischritt = 0; ischritt <= 4; ischritt++) {
            if (schrittgenutzt[ischritt] == false) {
                for (var ischritt2 = ischritt + 1; ischritt2 <= 4; ischritt2++) {
                    if (schrittgenutzt[ischritt2] == true) {
                        schrittwirdzu[ischritt2] = ischritt;
                        schrittgenutzt[ischritt] = true;
                        schrittgenutzt[ischritt2] = false;
                        break;
                    }
                }
            }
        }
        //Schritte ändern
        var berichtigungendurchgefuehrt = false;
        for (var dropdownnummer = 0; dropdownnummer < dropdowns.length; dropdownnummer++) {
            if (dropdowns[dropdownnummer].id.search(/anlegeschritt/) != -1) {
                if (schrittwirdzu[dropdowns[dropdownnummer].selectedIndex] != -1) {
                    berichtigungendurchgefuehrt = true;
                    dropdowns[dropdownnummer].selectedIndex = schrittwirdzu[dropdowns[dropdownnummer].selectedIndex];
                }
            }
        }
        //Genutzte Schritte zählen
        var schritteanzahl = 0;
        for (var ischritt3 = 0; ischritt3 <= 4; ischritt3++) {
            if (schrittgenutzt[ischritt3] == true) {
                schritteanzahl++;
            }
        }
        //Berichten
        if (berichtigungendurchgefuehrt == true) {
            ergeignisHinzufuegen(true, "Bei den angegebenen Anlegeschritten gab es Lücken. Die Reihenfolge wurde automatisch korrigiert.");
        }
    }
    return schritteanzahl;
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Speichert die Einstellungen für einen Gegenstandslot
//Erwartet: Strings mit Slotname und Slotnummer aus WoD-Dropdown und einen Integer mit den Profilslot
//Gibt aus: true wenn ein Dropdown gefunden wurde, sonst false
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function itemSpeichern(ort, nummer, slot) {
    console.log("SPeichern");
    var gefunden = false;
    //Daten des WoD DropDowns sammeln
    var dropdown = document.getElementsByName("LocationEquip[go_" + ort + "][" + nummer + "]")[0];
    if (dropdown != undefined) {
        gefunden = true;
        var gruppenitem = itemAufGruppenitemPruefen(dropdown.options[dropdown.selectedIndex].text);
        var ladungen = itemAufLadungenPruefen(dropdown.options[dropdown.selectedIndex].text);
        if (ladungen != -1) {
            var verbrausgegenstand = true;
        } else {
            var verbrausgegenstand = false;
        }
        var ablegbar = itemAufAblegbarkeitPruefen(dropdown.options[dropdown.selectedIndex].text);
        var itemname = itemnameHerausfinden(dropdown.options[dropdown.selectedIndex].text);
        //Profioptionen sammeln
        if (GM_getValue("expertenmodus_" + held, false) == true) {
            //Daten des 1. Alternativitem-DropDowns sammeln
            var dropdown = document.getElementById("alternativitem_1_" + ort + "_" + nummer);
            if (dropdown != undefined) {
                var gruppenitemalternativ1 = itemAufGruppenitemPruefen(dropdown.options[dropdown.selectedIndex].text);
                var ladungenalternativ1 = itemAufLadungenPruefen(dropdown.options[dropdown.selectedIndex].text);
                if (ladungenalternativ1 != -1) {
                    var verbrausgegenstandalternativ1 = true;
                } else {
                    var verbrausgegenstandalternativ1 = false;
                }
                var ablegbaralternativ1 = itemAufAblegbarkeitPruefen(dropdown.options[dropdown.selectedIndex].text);
                var itemnamealternativ1 = itemnameHerausfinden(dropdown.options[dropdown.selectedIndex].text);
            } else {
                ergeignisHinzufuegen(true, "Fehler: Dropdown für 1. Alternativgegenstand von '" + ort + " " + nummer + "' wurde nicht gefunden.");
                var itemnamealternativ1 = "Alternativgegenstand 1. Grades";
                var ablegbaralternativ1 = true;
                var verbrausgegenstandalternativ1 = false;
                var ladungenalternativ1 = -1;
                var gruppenitemalternativ1 = false;
            }
            //Daten des 2. Alternativitem-DropDowns sammeln
            var dropdown = document.getElementById("alternativitem_2_" + ort + "_" + nummer);
            if (dropdown != undefined) {
                var gruppenitemalternativ2 = itemAufGruppenitemPruefen(dropdown.options[dropdown.selectedIndex].text);
                var ladungenalternativ2 = itemAufLadungenPruefen(dropdown.options[dropdown.selectedIndex].text);
                if (ladungenalternativ2 != -1) {
                    var verbrausgegenstandalternativ2 = true;
                } else {
                    var verbrausgegenstandalternativ2 = false;
                }
                var ablegbaralternativ2 = itemAufAblegbarkeitPruefen(dropdown.options[dropdown.selectedIndex].text);
                var itemnamealternativ2 = itemnameHerausfinden(dropdown.options[dropdown.selectedIndex].text);
            } else {
                ergeignisHinzufuegen(true, "Fehler: Dropdown für 2. Alternativgegenstand von '" + ort + " " + nummer + "' wurde nicht gefunden.");
                var itemnamealternativ2 = "Alternativgegenstand 2. Grades";
                var ablegbaralternativ2 = true;
                var verbrausgegenstandalternativ2 = false;
                var ladungenalternativ2 = -1;
                var gruppenitemalternativ2 = false;
            }
            //Daten des DropDowns für den Anlegeschritt sammeln
            var dropdown = document.getElementById("anlegeschritt_" + ort + "_" + nummer);
            if (dropdown != undefined) {
                var anlegeschritt = parseInt(dropdown.options[dropdown.selectedIndex].value);
            } else {
                ergeignisHinzufuegen(true, "Fehler: Dropdown für den Anlegeschritt von '" + ort + " " + nummer + "' wurde nicht gefunden.");
                var anlegeschritt = 1;
            }
            //Daten des 1. der 3 Dropdowns für bevorzuge VGs sammeln
            var dropdown = document.getElementById("bevorzugtevollstaendigkeit_" + ort + "_" + nummer + "_0");
            if (dropdown != undefined) {
                var vgbevorzugen0 = parseInt(dropdown.options[dropdown.selectedIndex].value);
            } else {
                ergeignisHinzufuegen(true, "Fehler: Dropdown für die bevorzugte VG-Vollständigkeit von '" + ort + " " + nummer + "' für den Hauptgegenstand wurde nicht gefunden.");
                var vgbevorzugen0 = 100;
            }
            //Daten des 2. der 3 Dropdowns für bevorzuge VGs sammeln
            var dropdown = document.getElementById("bevorzugtevollstaendigkeit_" + ort + "_" + nummer + "_1");
            if (dropdown != undefined) {
                var vgbevorzugen1 = parseInt(dropdown.options[dropdown.selectedIndex].value);
            } else {
                ergeignisHinzufuegen(true, "Fehler: Dropdown für die bevorzugte VG-Vollständigkeit von '" + ort + " " + nummer + "' für den Alternativgegenstand 1. Grades wurde nicht gefunden.");
                var vgbevorzugen1 = 100;
            }
            //Daten des 3. der 3 Dropdowns für bevorzuge VGs sammeln
            var dropdown = document.getElementById("bevorzugtevollstaendigkeit_" + ort + "_" + nummer + "_2");
            if (dropdown != undefined) {
                var vgbevorzugen2 = parseInt(dropdown.options[dropdown.selectedIndex].value);
            } else {
                ergeignisHinzufuegen(true, "Fehler: Dropdown für die bevorzugte VG-Vollständigkeit von '" + ort + " " + nummer + "' für den Alternativgegenstand 2. Grades  wurde nicht gefunden.");
                var vgbevorzugen2 = 100;
            }
        } else {
            var itemnamealternativ1 = "Alternativgegenstand 1. Grades";
            var ablegbaralternativ1 = true;
            var verbrausgegenstandalternativ1 = false;
            var ladungenalternativ1 = -1;
            var gruppenitemalternativ1 = false;
            var itemnamealternativ2 = "Alternativgegenstand 2. Grades";
            var ablegbaralternativ2 = true;
            var verbrausgegenstandalternativ2 = false;
            var ladungenalternativ2 = -1;
            var gruppenitemalternativ2 = false;
            var anlegeschritt = 1;
            var vgbevorzugen0 = 100;
            var vgbevorzugen1 = 100;
            var vgbevorzugen2 = 100;
        }
    } else {
        var itemnamealternativ1 = "Alternativgegenstand 1. Grades";
        var ablegbaralternativ1 = true;
        var verbrausgegenstandalternativ1 = false;
        var ladungenalternativ1 = -1;
        var gruppenitemalternativ1 = false;
        var itemnamealternativ2 = "Alternativgegenstand 2. Grades";
        var ablegbaralternativ2 = true;
        var verbrausgegenstandalternativ2 = false;
        var ladungenalternativ2 = -1;
        var gruppenitemalternativ2 = false;
        var anlegeschritt = 1;
        var vgbevorzugen0 = 100;
        var vgbevorzugen1 = 100;
        var vgbevorzugen2 = 100;
    }
    //Item ins Profil speichern
    if (gefunden == true) {
        //Hauptitem speichern
        GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_hauptitem_name", itemname);
        if (gruppenitem == true) {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_hauptitem_gruppenitem", true);
        } else {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_hauptitem_gruppenitem", false);
        }
        GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_hauptitem_ladungen", ladungen);
        if (verbrausgegenstand == true) {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_hauptitem_verbrauchsgegenstand", true);
        } else {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_hauptitem_verbrauchsgegenstand", false);
        }
        if (ablegbar == true) {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_hauptitem_ablegbar", true);
        } else {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_hauptitem_ablegbar", false);
        }
        //Alternativitem 1 speichern
        GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_1_name", itemnamealternativ1);
        if (gruppenitemalternativ1 == true) {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_1_gruppenitem", true);
        } else {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_1_gruppenitem", false);
        }
        GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_1_ladungen", ladungenalternativ1);
        if (verbrausgegenstandalternativ1 == true) {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_1_verbrauchsgegenstand", true);
        } else {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_1_verbrauchsgegenstand", false);
        }
        if (ablegbaralternativ1 == true) {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_1_ablegbar", true);
        } else {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_1_ablegbar", false);
        }
        //Alternativitem 2 speichern
        GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_2_name", itemnamealternativ2);
        if (gruppenitemalternativ2 == true) {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_2_gruppenitem", true);
        } else {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_2_gruppenitem", false);
        }
        GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_2_ladungen", ladungenalternativ2);
        if (verbrausgegenstandalternativ2 == true) {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_2_verbrauchsgegenstand", true);
        } else {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_2_verbrauchsgegenstand", false);
        }
        if (ablegbaralternativ2 == true) {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_2_ablegbar", true);
        } else {
            GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_2_ablegbar", false);
        }
        //Anlegeschritt speichern
        GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_anlegeschritt", anlegeschritt);
        //Bevorzugte VG-Vollständigkeit speichern
        GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_vgbevorzugen_0", vgbevorzugen0);
        GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_vgbevorzugen_1", vgbevorzugen1);
        GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_vgbevorzugen_2", vgbevorzugen2);
    } else {
        GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_hauptitem_name", "Kein Gegenstand");
        GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_1_name", "Alternativgegenstand 1. Grades");
        GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_2_name", "Alternativgegenstand 2. Grades");
        GM_setValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_anlegeschritt", 1);
    }
    return gefunden;
}


function insertNewOption(liste, text, value, selected) {
    var opt = document.createElement("option");

    var content = document.createTextNode(text);
    opt.appendChild(content);

    var attr = document.createAttribute("value");
    attr.nodeValue = value;
    opt.setAttributeNode(attr);

    if (selected) {
        var sel = document.createAttribute("selected");
        sel.nodeValue = selected;
        opt.setAttributeNode(sel);
    }

    liste.appendChild(opt);
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Läd die Profilnamen und fügt diese dem Profildropdown hinzu
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function profildropdownAktualisieren() {
    var profildropdown = document.getElementById('profilliste');
    if (profildropdown != undefined) {
        profildropdown.options[0].text = "bitte Profil wählen";
        profildropdown.selectedIndex = 0;

        //alte Einträge löschen
        for (var i = profildropdown.length - 1; i >= 1; i--) {
            profildropdown.options[i] = null;
        }
        //neue Einträge hinzufügen
        for (var i = 1; i <= 21; i++) {
            var profilname = GM_getValue("profil_" + held + "_" + i + "_profilname", "nicht vorhanden");
            profilname = i + ".) " + profilname;

            var markieren = false;
            if (GM_getValue("gewaehltesprofil_" + held, -1) == i) {
                markieren = true;
            }


            // var NeuerEintrag = new Option(profilname, i, false, markieren);
            // profildropdown.options[profildropdown.length] = NeuerEintrag;
            insertNewOption(profildropdown, profilname, i, markieren);
        }
    } else {
        ergeignisHinzufuegen(true, "Fehler: Die Profilliste konnte nicht gefunden werden!");
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Geht alle Items durch und speichert diese
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function speichern(slot) {
    console.log("Speichern alle");
    if (initialisiert == true) {
        var profilname = GM_getValue("profil_" + held + "_" + slot + "_profilname", "nicht vorhanden");
        if (profilname == "nicht vorhanden") {
            profilname = "";
        }
        var profilname = prompt("Bitte einen Namen nennen, unter dem das Profil gespeichert werden soll.", profilname);
        if (profilname != null) {
            warteEbeneAnzeigen();
            var schrittegenutzt = anlegeschrittBerichtigen();
            GM_setValue("profil_" + held + "_" + slot + "_genutzteschritte", schrittegenutzt);
            itemSpeichern('kopf', 0, slot);
            itemSpeichern('ohren', 0, slot);
            itemSpeichern('brille', 0, slot);
            itemSpeichern('hals', 0, slot);
            itemSpeichern('torso', 0, slot);
            itemSpeichern('schaerpe', 0, slot);
            itemSpeichern('umhang', 0, slot);
            itemSpeichern('arme', 0, slot);
            itemSpeichern('hand', 0, slot);
            itemSpeichern('beide_haende', 0, slot);
            itemSpeichern('waffen_hand', 0, slot);
            itemSpeichern('schild_hand', 0, slot);
            itemSpeichern('beine', 0, slot);
            itemSpeichern('fuss', 0, slot);
            for (var ordennummer = 0; ordennummer <= 10; ordennummer++) {
                itemSpeichern('orden', ordennummer, slot);
            }
            for (var taschennummer = 0; taschennummer <= 22; taschennummer++) {
                itemSpeichern('tasche', taschennummer, slot);
            }
            for (var ringnummer = 0; ringnummer <= 5; ringnummer++) {
                itemSpeichern('ring', ringnummer, slot);
            }
            GM_setValue("profil_" + held + "_" + slot + "_profilname", profilname.substr(0, 29));
            ergeignisHinzufuegen(false, "Ihre Einstellugnen wurden unter dem Namen '" + profilname + "' erfolgreich gespeichert.");
            GM_setValue("gewaehltesprofil_" + held, slot);
            profildropdownAktualisieren();
            warteEbeneAusblenden();
        } else {
            ergeignisHinzufuegen(false, "Das Speichern wurde abgebrochen.");
        }
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Geht alle Items durch und speichert diese
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function itemLadenExpertenmodus(ort, nummer, slot) {
    var dropdown = document.getElementsByName("LocationEquip[go_" + ort + "][" + nummer + "]")[0];
    if (dropdown != undefined) {
        var dropdownalternativ1 = document.getElementById("alternativitem_1_" + ort + "_" + nummer);
        var dropdownalternativ2 = document.getElementById("alternativitem_2_" + ort + "_" + nummer);
        var dropdownanlegeschritt = document.getElementById("anlegeschritt_" + ort + "_" + nummer);
        var dropdownbevorzugtevollstaendigkeit = new Array();
        dropdownbevorzugtevollstaendigkeit[0] = document.getElementById("bevorzugtevollstaendigkeit_" + ort + "_" + nummer + "_0");
        dropdownbevorzugtevollstaendigkeit[1] = document.getElementById("bevorzugtevollstaendigkeit_" + ort + "_" + nummer + "_1");
        dropdownbevorzugtevollstaendigkeit[2] = document.getElementById("bevorzugtevollstaendigkeit_" + ort + "_" + nummer + "_2");
        //Hauptitem Laden
        var hauptitemname = GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_hauptitem_name", "Kein Gegenstand");
        if (hauptitemname == "Kein Gegenstand") {
            dropdown.selectedIndex = 0;
            dropdownalternativ1.selectedIndex = dropdownalternativ1.length - 1;
            dropdownalternativ2.selectedIndex = dropdownalternativ2.length - 1;
            dropdownanlegeschritt.selectedIndex = 0;
            ergeignisHinzufuegen(false, 'Für den Ort "' + ort + ' ' + (nummer + 1) + '" war kein Gegenstand gespeichert, also wurde auch keiner ausgewählt.');
        } else {
            var gefunden = false;
            for (var optionsnummer = 0; optionsnummer < dropdown.length; optionsnummer++) {
                var itemname = itemnameHerausfinden(dropdown.options[optionsnummer].text);
                if (itemname == hauptitemname) {
                    gefunden = true;
                    dropdown.selectedIndex = optionsnummer;
                    ergeignisHinzufuegen(false, 'Für den Ort "' + ort + ' ' + (nummer + 1) + '" wurde der Gegenstand "' + itemname + '" ausgewählt.');
                    break;
                }
            }
            if (gefunden == false) {
                dropdown.selectedIndex = 0;
                ergeignisHinzufuegen(true, 'Für den Ort "' + ort + ' ' + (nummer + 1) + '" konnte der Gegenstand "' + itemname + '" nicht ausgewählt werden.');
            }
            //Alternativgegenstand1 laden
            var alternativitem1name = GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_1_name", "Alternativgegenstand 1. Grades");
            if (alternativitem1name == "Alternativgegenstand 1. Grades") {
                ergeignisHinzufuegen(false, 'Für den Ort "' + ort + ' ' + (nummer + 1) + '" wurde kein Alternativgegenstand 1. Grades gespeichert, also wird auch keiner ausgewählt.');
                dropdownalternativ1.selectedIndex = dropdownalternativ1.length - 1;
            } else {
                var gefunden = false;
                for (var optionsnummer = 0; optionsnummer < dropdownalternativ1.length - 1; optionsnummer++) {
                    var itemname = itemnameHerausfinden(dropdownalternativ1.options[optionsnummer].text);
                    if (itemname == GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_1_name", "Alternativgegenstand 1. Grades")) {
                        gefunden = true;
                        dropdownalternativ1.selectedIndex = optionsnummer;
                        ergeignisHinzufuegen(false, 'Für den Ort "' + ort + ' ' + (nummer + 1) + '" wurde als Alternativgegenstand 1. Grades der Gegenstand "' + itemname + '" ausgewählt.');
                        break;
                    }
                }
                if (gefunden == false) {
                    dropdownalternativ1.selectedIndex = dropdownalternativ1.length - 1;
                    ergeignisHinzufuegen(true, 'Für den Ort "' + ort + ' ' + (nummer + 1) + '" konnte der Alternativgegenstand 1. Grades "' + itemname + '" nicht ausgewählt werden.');
                }
            }
            //Alternativgegenstand2 laden
            var alternativitem2name = GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_2_name", "Alternativgegenstand 2. Grades");
            if (alternativitem2name == "Alternativgegenstand 2. Grades") {
                ergeignisHinzufuegen(false, 'Für den Ort "' + ort + ' ' + (nummer + 1) + '" wurde kein Alternativgegenstand 2. Grades gespeichert, also wird auch keiner ausgewählt.');
                dropdownalternativ2.selectedIndex = dropdownalternativ2.length - 1;
            } else {
                var gefunden = false;
                for (var optionsnummer = 0; optionsnummer < dropdownalternativ2.length - 1; optionsnummer++) {
                    var itemname = itemnameHerausfinden(dropdownalternativ2.options[optionsnummer].text);
                    if (itemname == GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_2_name", "Alternativgegenstand 2. Grades")) {
                        gefunden = true;
                        dropdownalternativ2.selectedIndex = optionsnummer;
                        ergeignisHinzufuegen(false, 'Für den Ort "' + ort + ' ' + (nummer + 1) + '" wurde als Alternativgegenstand 2. Grades der Gegenstand "' + itemname + '" ausgewählt.');
                        break;
                    }
                }
                if (gefunden == false) {
                    dropdownalternativ2.selectedIndex = dropdownalternativ2.length - 1;
                    ergeignisHinzufuegen(true, 'Für den Ort "' + ort + ' ' + (nummer + 1) + '" konnte der Alternativgegenstand 2. Grades "' + itemname + '" nicht ausgewählt werden.');
                }
            }
            //Anlegeschritt laden
            dropdownanlegeschritt.selectedIndex = GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_anlegeschritt", 1) - 1;
            ergeignisHinzufuegen(false, 'Für den Ort "' + ort + ' ' + (nummer + 1) + '" wurde Schritt "' + GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_anlegeschritt", 1) + '" als Anlegeschritt ausgewählt.');
            //Dropdowns der bevorzugten Vollständigkeit von VGs laden
            for (var ivgbevorzugt = 0; ivgbevorzugt <= 2; ivgbevorzugt++) {
                switch (GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_vgbevorzugen_" + ivgbevorzugt, -1)) {
                    case 100:
                        dropdownbevorzugtevollstaendigkeit[ivgbevorzugt].selectedIndex = 0;
                        break;
                    case 75:
                        dropdownbevorzugtevollstaendigkeit[ivgbevorzugt].selectedIndex = 1;
                        break;
                    case 50:
                        dropdownbevorzugtevollstaendigkeit[ivgbevorzugt].selectedIndex = 2;
                        break;
                    case 25:
                        dropdownbevorzugtevollstaendigkeit[ivgbevorzugt].selectedIndex = 3;
                        break;
                    case 1:
                        dropdownbevorzugtevollstaendigkeit[ivgbevorzugt].selectedIndex = 4;
                        break;
                    default:
                        dropdownbevorzugtevollstaendigkeit[ivgbevorzugt].selectedIndex = 0;
                        break;
                }
            }

        }
    } else {
        var itemname = GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_hauptitem_name", "Kein Gegenstand");
        if (itemname != "Kein Gegenstand") {
            ergeignisHinzufuegen(true, 'Die Einstellungen für den Ort "' + ort + ' ' + (nummer + 1) + '" konnten nicht geladen werden, da Sie für diesen Ort keine Gegenstände im Lager besitzen. Der Gegenstand "' + itemname + '" wurde also nicht ausgewählt.');
        }
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Lad die Einstellungen für die Orte Ring, Orden und Tasche
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function multiItemLadenExpertenmodus(ort, slot) {
    if (ort == "orden") {
        var endnummer = 10;
    } else {
        if (ort == "tasche") {
            var endnummer = 22;
        } else {
            var endnummer = 5;
        }
    }
    var hauptitemsnameprofil = new Array();
    var alt1nameprofil = new Array();
    var alt2nameprofil = new Array();
    var anlegeschritt = new Array();
    var vgbevorzugen0 = new Array();
    var vgbevorzugen1 = new Array();
    var vgbevorzugen2 = new Array();
    for (var i = 0; i <= endnummer; i++) {
        var itemname = GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + i + "_hauptitem_name", "Kein Gegenstand");
        if (itemname != "Kein Gegenstand") {
            hauptitemsnameprofil.push(itemname);
            alt1nameprofil.push(GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + i + "_alternativitem_1_name", "Alternativgegenstand 1. Grades"));
            alt2nameprofil.push(GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + i + "_alternativitem_2_name", "Alternativgegenstand 2. Grades"));
            anlegeschritt.push(GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + i + "_anlegeschritt", 1));
            vgbevorzugen0.push(GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + i + "_vgbevorzugen_0", 100));
            vgbevorzugen1.push(GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + i + "_vgbevorzugen_1", 100));
            vgbevorzugen2.push(GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + i + "_vgbevorzugen_2", 100));
        }
    }
    var dropdowngenutzt = new Array();
    for (var i = 0; i <= endnummer; i++) {
        var dropdown = document.getElementsByName("LocationEquip[go_" + ort + "][" + i + "]")[0];
        if (dropdown != undefined) {
            dropdowngenutzt.push(false);
        }
    }
    if (dropdowngenutzt.length >= 1) {
        var istart = hauptitemsnameprofil.length - 1;
        for (var i = istart; i >= 0; i--) {
            for (var ii = 0; ii < dropdowngenutzt.length; ii++) {
                if (dropdowngenutzt[ii] == false) {
                    var dropdown = document.getElementsByName("LocationEquip[go_" + ort + "][" + ii + "]")[0];
                    var gewaehlteoption = -1;
                    for (var iii = 0; iii < dropdown.length; iii++) {
                        if (parseInt(dropdown.options[iii].value) == 0) {
                            var itemname = itemnameHerausfinden(dropdown.options[iii].text);
                            gewaehlteoption = iii;
                            break;
                        }
                    }
                    if (itemname == hauptitemsnameprofil[i]) {
                        dropdown.selectedIndex = gewaehlteoption;
                        var dropdownalternativ1 = document.getElementById("alternativitem_1_" + ort + "_" + ii);
                        if (alt1nameprofil[i] != "Alternativgegenstand 1. Grades") {
                            var gefunden = false;
                            for (var ialt1 = 0; ialt1 < dropdownalternativ1.length; ialt1++) {
                                if (itemnameHerausfinden(dropdownalternativ1.options[ialt1].text) == alt1nameprofil[i]) {
                                    dropdownalternativ1.selectedIndex = ialt1;
                                    gefunden = true;
                                    break;
                                }
                            }
                            if (gefunden == false) {
                                ergeignisHinzufuegen(true, 'Der Alternativgegenstand 1. Grades "' + alt1nameprofil[i] + '" für den Ort "' + ort + ' konnten nicht geladen werden, da sich dieser Gegenstand nicht im Lager befindet.');
                            }
                        } else {
                            dropdownalternativ1.selectedIndex = dropdownalternativ1.length - 1;
                        }
                        var dropdownalternativ2 = document.getElementById("alternativitem_2_" + ort + "_" + ii);
                        if (alt2nameprofil[i] != "Alternativgegenstand 2. Grades") {
                            var gefunden = false;
                            for (var ialt2 = 0; ialt2 < dropdownalternativ2.length; ialt2++) {
                                if (itemnameHerausfinden(dropdownalternativ2.options[ialt2].text) == alt2nameprofil[i]) {
                                    dropdownalternativ2.selectedIndex = ialt2;
                                    gefunden = true;
                                    break;
                                }
                            }
                            if (gefunden == false) {
                                ergeignisHinzufuegen(true, 'Der Alternativgegenstand 2. Grades "' + alt2nameprofil[i] + '" für den Ort "' + ort + ' konnten nicht geladen werden, da sich dieser Gegenstand nicht im Lager befindet.');
                            }
                        } else {
                            dropdownalternativ2.selectedIndex = dropdownalternativ2.length - 1;
                        }
                        //Anlegeschritt-Dropdown setzen
                        var dropdownanlegeschritt = document.getElementById("anlegeschritt_" + ort + "_" + ii);
                        dropdownanlegeschritt.selectedIndex = anlegeschritt[i] - 1;
                        //VG-Bevorzugen-Dropdowns setzen
                        for (var ivgbevorzugt = 0; ivgbevorzugt <= 2; ivgbevorzugt++) {
                            var dropdownvgbevorzugen = document.getElementById("bevorzugtevollstaendigkeit_" + ort + "_" + ii + "_" + ivgbevorzugt);
                            if (ivgbevorzugt == 0) {
                                var vgbevorzugentemp = vgbevorzugen0;
                            } else {
                                if (ivgbevorzugt == 1) {
                                    var vgbevorzugentemp = vgbevorzugen1;
                                } else {
                                    var vgbevorzugentemp = vgbevorzugen2;
                                }
                            }
                            switch (vgbevorzugentemp[i]) {
                                case 100:
                                    dropdownvgbevorzugen.selectedIndex = 0;
                                    break;
                                case 75:
                                    dropdownvgbevorzugen.selectedIndex = 1;
                                    break;
                                case 50:
                                    dropdownvgbevorzugen.selectedIndex = 2;
                                    break;
                                case 25:
                                    dropdownvgbevorzugen.selectedIndex = 3;
                                    break;
                                case 1:
                                    dropdownvgbevorzugen.selectedIndex = 4;
                                    break;
                                default:
                                    dropdownvgbevorzugen.selectedIndex = 0;
                                    break;
                            }
                        }
                        dropdownanlegeschritt.selectedIndex = anlegeschritt[i] - 1;
                        dropdowngenutzt[ii] = true;
                        hauptitemsnameprofil.splice(i, 1);
                        alt1nameprofil.splice(i, 1);
                        alt2nameprofil.splice(i, 1);
                        anlegeschritt.splice(i, 1);
                        vgbevorzugen0.splice(i, 1);
                        vgbevorzugen1.splice(i, 1);
                        vgbevorzugen2.splice(i, 1);
                        break;
                    }
                }
            }
        }
        var istart = hauptitemsnameprofil.length - 1;
        for (var i = istart; i >= 0; i--) {
            for (var ii = 0; ii < dropdowngenutzt.length; ii++) {
                if (dropdowngenutzt[ii] == false) {
                    if (hauptitemsnameprofil.length >= 1) {
                        var dropdown = document.getElementsByName("LocationEquip[go_" + ort + "][" + ii + "]")[0];
                        var gefunden = false;
                        for (var iii = 0; iii < dropdown.length; iii++) {
                            var itemname = itemnameHerausfinden(dropdown.options[iii].text);
                            if (itemname == hauptitemsnameprofil[i]) {
                                dropdown.selectedIndex = iii;
                                gefunden = true;
                                break;
                            }
                        }
                        if (gefunden == false) {
                            ergeignisHinzufuegen(true, 'Der Gegenstand "' + hauptitemsnameprofil[i] + '" für den Ort "' + ort + '" konnten nicht geladen werden, da sich dieser Gegenstand nicht im Lager befindet.');
                        }
                        var dropdownalternativ1 = document.getElementById("alternativitem_1_" + ort + "_" + ii);
                        if (alt1nameprofil[i] != "Alternativgegenstand 1. Grades") {
                            var gefunden = false;
                            for (var ialt1 = 0; ialt1 < dropdownalternativ1.length; ialt1++) {
                                if (itemnameHerausfinden(dropdownalternativ1.options[ialt1].text) == alt1nameprofil[i]) {
                                    dropdownalternativ1.selectedIndex = ialt1;
                                    gefunden = true;
                                    break;
                                }
                            }
                            if (gefunden == false) {
                                ergeignisHinzufuegen(true, 'Der Alternativgegenstand 1. Grades "' + alt1nameprofil[i] + '" für den Ort "' + ort + '" konnte nicht geladen werden, da sich dieser Gegenstand nicht im Lager befindet.');
                            }
                        } else {
                            dropdownalternativ1.selectedIndex = dropdownalternativ1.length - 1;
                        }
                        var dropdownalternativ2 = document.getElementById("alternativitem_2_" + ort + "_" + ii);
                        if (alt2nameprofil[i] != "Alternativgegenstand 2. Grades") {
                            var gefunden = false;
                            for (var ialt2 = 0; ialt2 < dropdownalternativ2.length; ialt2++) {
                                if (itemnameHerausfinden(dropdownalternativ2.options[ialt2].text) == alt2nameprofil[i]) {
                                    dropdownalternativ2.selectedIndex = ialt2;
                                    gefunden = true;
                                    break;
                                }
                            }
                            if (gefunden == false) {
                                ergeignisHinzufuegen(true, 'Der Alternativgegenstand 2. Grades "' + alt2nameprofil[i] + '" für den Ort "' + ort + '" konnte nicht geladen werden, da sich dieser Gegenstand nicht im Lager befindet.');
                            }
                        } else {
                            dropdownalternativ2.selectedIndex = dropdownalternativ2.length - 1;
                        }
                        //Anlegeschritt setzen
                        var dropdownanlegeschritt = document.getElementById("anlegeschritt_" + ort + "_" + ii);
                        dropdownanlegeschritt.selectedIndex = anlegeschritt[i] - 1;
                        //VG-Bevorzugen-Dropdowns setzen
                        for (var ivgbevorzugt = 0; ivgbevorzugt <= 2; ivgbevorzugt++) {
                            var dropdownvgbevorzugen = document.getElementById("bevorzugtevollstaendigkeit_" + ort + "_" + ii + "_" + ivgbevorzugt);
                            if (ivgbevorzugt == 0) {
                                var vgbevorzugentemp = vgbevorzugen0;
                            } else {
                                if (ivgbevorzugt == 1) {
                                    var vgbevorzugentemp = vgbevorzugen1;
                                } else {
                                    var vgbevorzugentemp = vgbevorzugen2;
                                }
                            }
                            switch (vgbevorzugentemp[i]) {
                                case 100:
                                    dropdownvgbevorzugen.selectedIndex = 0;
                                    break;
                                case 75:
                                    dropdownvgbevorzugen.selectedIndex = 1;
                                    break;
                                case 50:
                                    dropdownvgbevorzugen.selectedIndex = 2;
                                    break;
                                case 25:
                                    dropdownvgbevorzugen.selectedIndex = 3;
                                    break;
                                case 1:
                                    dropdownvgbevorzugen.selectedIndex = 4;
                                    break;
                                default:
                                    dropdownvgbevorzugen.selectedIndex = 0;
                                    break;
                            }
                        }
                    } else {
                        var dropdown = document.getElementsByName("LocationEquip[go_" + ort + "][" + ii + "]")[0];
                        dropdown.selectedIndex = 0;
                        var dropdownalternativ1 = document.getElementById("alternativitem_1_" + ort + "_" + ii);
                        dropdownalternativ1.selectedIndex = dropdownalternativ1.length - 1;
                        var dropdownalternativ2 = document.getElementById("alternativitem_2_" + ort + "_" + ii);
                        dropdownalternativ2.selectedIndex = dropdownalternativ2.length - 1;
                        var dropdownanlegeschritt = document.getElementById("anlegeschritt_" + ort + "_" + ii);
                        dropdownanlegeschritt.selectedIndex = 0;
                        for (var ivgbevorzugt = 0; ivgbevorzugt <= 2; ivgbevorzugt++) {
                            var dropdownvgbevorzugen = document.getElementById("bevorzugtevollstaendigkeit_" + ort + "_" + ii + "_" + ivgbevorzugt);
                            dropdownvgbevorzugen.selectedIndex = 0;
                        }
                    }
                    dropdowngenutzt[ii] = true;
                    hauptitemsnameprofil.splice(i, 1);
                    alt1nameprofil.splice(i, 1);
                    alt2nameprofil.splice(i, 1);
                    anlegeschritt.splice(i, 1);
                    vgbevorzugen0.splice(i, 1);
                    vgbevorzugen1.splice(i, 1);
                    vgbevorzugen2.splice(i, 1);
                    break;
                }
            }
            var alleplaetzegenutzt = true;
            for (var iplatz = 0; iplatz < dropdowngenutzt.length; iplatz++) {
                if (dropdowngenutzt[iplatz] == false) {
                    alleplaetzegenutzt = false;
                    break;
                }
            }
            if (hauptitemsnameprofil.length >= 1 && alleplaetzegenutzt == true) {
                ergeignisHinzufuegen(true, 'Die Gegenstände "' + hauptitemsnameprofil.join(",") + '" für den Ort "' + ort + '" konnten nicht geladen werden, da Sie keine freien Plätze mehr zur Verfügung hatten.');
                break;
            }
        }
    } else {
        ergeignisHinzufuegen(true, 'Die Einstellungen für den Ort "' + ort + '" konnten nicht geladen werden, da Sie für diesen Ort keine Gegenstände im Lager besitzen.');
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Läd die im Profil gespeicherten Einstellungen und setzt die Dropdowns im Expertenmodus
//Erwartet: Integer mit zu ladendem Profil
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function ladenExpertenmodus(slot) {
    if (initialisiert == true) {
        var profildropdown = document.getElementById("profilliste");
        var gewaehltesprofil = GM_getValue("gewaehltesprofil_" + held, 0);
        if (profildropdown.options[gewaehltesprofil].text.search(/nicht vorhanden/) == -1 && gewaehltesprofil != 0) {
            warteEbeneAnzeigen();
            itemLadenExpertenmodus('kopf', 0, slot);
            itemLadenExpertenmodus('ohren', 0, slot);
            itemLadenExpertenmodus('brille', 0, slot);
            itemLadenExpertenmodus('hals', 0, slot);
            itemLadenExpertenmodus('torso', 0, slot);
            itemLadenExpertenmodus('schaerpe', 0, slot);
            itemLadenExpertenmodus('umhang', 0, slot);
            itemLadenExpertenmodus('arme', 0, slot);
            itemLadenExpertenmodus('hand', 0, slot);
            itemLadenExpertenmodus('beide_haende', 0, slot);
            itemLadenExpertenmodus('waffen_hand', 0, slot);
            itemLadenExpertenmodus('schild_hand', 0, slot);
            itemLadenExpertenmodus('beine', 0, slot);
            itemLadenExpertenmodus('fuss', 0, slot);
            multiItemLadenExpertenmodus('orden', slot);
            multiItemLadenExpertenmodus('tasche', slot);
            multiItemLadenExpertenmodus('ring', slot);
            ergeignisHinzufuegen(false, "Die Einstellungen des Profils wurden geladen.");
            warteEbeneAusblenden();
        }
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Läd die im Profil gespeicherten Einstellungen und setzt die Dropdowns im Expertenmodus
//Erwartet: Integer mit zu ladendem Profil
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function ausruestungsmenueAusblenden() {
    var ausruestungsmenue = document.getElementById("ausruestungsmenue");
    if (ausruestungsmenue != undefined) {
        ausruestungsmenue.style.visibility = "collapse";
    }
    var warteebene = document.getElementById("warteebene");
    if (warteebene != undefined) {
        if (warteebene.style.visibility != "visible") {
            abdunklungsEbeneAusblenden();
        }
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Stoppt das LAden eines Profils und setzt die Einstellungen zurück
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function ausruestungsSchrittBeenden() {
    GM_setValue("ausruestungsschritt_" + held, -1);
    GM_setValue("restueberspringen_" + held, false)
    ausruestungsmenueAusblenden();
    var ladenknopf = document.getElementById("ladenknopf");
    ladenknopf.disabled = false;
    var profildropdown = document.getElementById("profilliste");
    profildropdown.disabled = false;
    ergeignisHinzufuegen(true, "Der Ausrüstungsvorgang wurde abgebrochen.");
}


//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Legt die aktuell getragenen Gegenstände ab(außer es würde einen Resetpunkt kosten)
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function alleGegenstaendeAblegen() {
    warteEbeneAnzeigen();
    var alledropdowns = document.getElementsByTagName("SELECT");
    for (var iselect = 0; iselect < alledropdowns.length; iselect++) {
        var angelegtergegenstand = '';
        for (var ioption = 0; ioption < alledropdowns[iselect].length; ioption++) {
            if (parseInt(alledropdowns[iselect].options[ioption].value) == 0) {
                angelegtergegenstand = alledropdowns[iselect].options[ioption].text;
                break;
            }
        }
        if (alledropdowns[iselect].name.search(/LocationEquip/) != -1) {
            if (itemAufAblegbarkeitPruefen(angelegtergegenstand)) {
                alledropdowns[iselect].selectedIndex = 0;
            }
        }
    }
    ergeignisHinzufuegen(false, "Die getragenen Gegenstände wurden abgelegt.");
    warteEbeneAusblenden();
    seiteAbschicken();
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Läd den Gegenstand aus Profil Nr SLOT an Dropdown ORT NUMMER, wenn der Gegenstand dem Anlegeschritt SCHRITT zugeordnet ist
//Erwartet: String für Ort, Rest Integer
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function itemLadenSimplermodus(ort, nummer, slot, schritt, nachfuellen) {
    //Prüfen ob ein Item für den Slot gespeichert ist
    var itemname = GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_hauptitem_name", "Kein Gegenstand");
    if (itemname != "Kein Gegenstand") {
        //Prüfen ob das Item dem aktuellen Schritt zugeordnet ist
        if (nachfuellen == false) {
            var anlegeschritttemp = GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_anlegeschritt", 1);
        } else {
            var anlegeschritttemp = 1;
        }
        if (anlegeschritttemp == schritt) {
            //Prüfen ob Dropdown vorhanden
            var dropdown = document.getElementsByName("LocationEquip[go_" + ort + "][" + nummer + "]")[0];
            if (dropdown != undefined) {
                //Prüfen ob der aktuelle Gegenstand an dem Ort abgelegt werden darf
                var aktuellesitemname = '';
                for (var ioption = 0; ioption < dropdown.length; ioption++) {
                    if (parseInt(dropdown.options[ioption].value) == 0) {
                        aktuellesitemname = dropdown.options[ioption].text;
                        break;
                    }
                }
                if (itemAufAblegbarkeitPruefen(aktuellesitemname)) {
                    if (ort != "ring" && ort != "tasche" && ort != "orden") {
                        //Prüfen ob Hauptitem vorhanden
                        var optionauswaehlen = -1;
                        var meisteladungen = 100;
                        var bevorzugteladungen = GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_vgbevorzugen_0", 100);
                        var vgabweichungmin = GM_getValue("vgabweichungmin", 100);
                        var vgabweichungmax = GM_getValue("vgabweichungmax", 100);
                        for (var ioption = 0; ioption < dropdown.length; ioption++) {
                            if (itemnameHerausfinden(dropdown.options[ioption].text) == itemname) {
                                var anlegeschrittschildhand = GM_getValue("profil_" + held + "_" + slot + "_schild_hand_0_anlegeschritt", 1);
                                var anlegeschrittwaffenhand = GM_getValue("profil_" + held + "_" + slot + "_waffen_hand_0_anlegeschritt", 1);
                                if (ort != 'schild_hand' && ort != 'waffen_hand') {
                                    var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                    if (ladungen == -1) {
                                        optionauswaehlen = ioption;
                                        break;
                                    } else {
                                        if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                            var ladungendifferenz = ladungen - bevorzugteladungen;
                                            if (ladungendifferenz < meisteladungen) {
                                                optionauswaehlen = ioption;
                                                meisteladungen = ladungendifferenz;
                                            }
                                        } else {
                                            if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                var ladungendifferenz = bevorzugteladungen - ladungen;
                                                if (ladungendifferenz < meisteladungen) {
                                                    optionauswaehlen = ioption;
                                                    meisteladungen = ladungendifferenz;
                                                }
                                            } else {
                                                if (ladungen == bevorzugteladungen) {
                                                    optionauswaehlen = ioption;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    if (ort == "schild_hand") {
                                        if (anlegeschrittschildhand >= anlegeschrittwaffenhand) {
                                            var waffenhanddropdown = document.getElementsByName("LocationEquip[go_waffen_hand][0]")[0];
                                            if (waffenhanddropdown != undefined) {
                                                var itemssindverschieden = true;
                                                if (parseInt(waffenhanddropdown.options[waffenhanddropdown.selectedIndex].value) == 0) {
                                                    var itemablegenid = Math.abs(parseInt(waffenhanddropdown.options[0].value));
                                                    if (itemablegenid == parseInt(dropdown.options[ioption].value)) {
                                                        if (waffenhanddropdown.selectedIndex >= 1) {
                                                            itemssindverschieden = false;
                                                        }
                                                    }
                                                } else {
                                                    if (parseInt(waffenhanddropdown.options[waffenhanddropdown.selectedIndex].value) == parseInt(dropdown.options[ioption].value)) {
                                                        if (waffenhanddropdown.selectedIndex >= 1) {
                                                            itemssindverschieden = false;
                                                        }
                                                    }
                                                }
                                                if (itemssindverschieden == true) {
                                                    var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                    if (ladungen == -1) {
                                                        optionauswaehlen = ioption;
                                                        break;
                                                    } else {
                                                        if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                            var ladungendifferenz = ladungen - bevorzugteladungen;
                                                            if (ladungendifferenz < meisteladungen) {
                                                                optionauswaehlen = ioption;
                                                                meisteladungen = ladungendifferenz;
                                                            }
                                                        } else {
                                                            if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                                var ladungendifferenz = bevorzugteladungen - ladungen;
                                                                if (ladungendifferenz < meisteladungen) {
                                                                    optionauswaehlen = ioption;
                                                                    meisteladungen = ladungendifferenz;
                                                                }
                                                            } else {
                                                                if (ladungen == bevorzugteladungen) {
                                                                    optionauswaehlen = ioption;
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            } else {
                                                var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                if (ladungen == -1) {
                                                    optionauswaehlen = ioption;
                                                    break;
                                                } else {
                                                    if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                        var ladungendifferenz = ladungen - bevorzugteladungen;
                                                        if (ladungendifferenz < meisteladungen) {
                                                            optionauswaehlen = ioption;
                                                            meisteladungen = ladungendifferenz;
                                                        }
                                                    } else {
                                                        if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                            var ladungendifferenz = bevorzugteladungen - ladungen;
                                                            if (ladungendifferenz < meisteladungen) {
                                                                optionauswaehlen = ioption;
                                                                meisteladungen = ladungendifferenz;
                                                            }
                                                        } else {
                                                            if (ladungen == bevorzugteladungen) {
                                                                optionauswaehlen = ioption;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        } else {
                                            var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                            if (ladungen == -1) {
                                                optionauswaehlen = ioption;
                                                break;
                                            } else {
                                                if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                    var ladungendifferenz = ladungen - bevorzugteladungen;
                                                    if (ladungendifferenz < meisteladungen) {
                                                        optionauswaehlen = ioption;
                                                        meisteladungen = ladungendifferenz;
                                                    }
                                                } else {
                                                    if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                        var ladungendifferenz = bevorzugteladungen - ladungen;
                                                        if (ladungendifferenz < meisteladungen) {
                                                            optionauswaehlen = ioption;
                                                            meisteladungen = ladungendifferenz;
                                                        }
                                                    } else {
                                                        if (ladungen == bevorzugteladungen) {
                                                            optionauswaehlen = ioption;
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    if (ort == "waffen_hand") {
                                        if (anlegeschrittwaffenhand > anlegeschrittschildhand) {
                                            var schildhanddropdown = document.getElementsByName("LocationEquip[go_schild_hand][0]")[0];
                                            if (schildhanddropdown != undefined) {
                                                var itemssindverschieden = true;
                                                if (parseInt(schildhanddropdown.options[schildhanddropdown.selectedIndex].value) == 0) {
                                                    var itemablegenid = Math.abs(parseInt(schildhanddropdown.options[0].value));
                                                    if (itemablegenid == parseInt(dropdown.options[ioption].value)) {
                                                        if (schildhanddropdown.selectedIndex >= 1) {
                                                            itemssindverschieden = false;
                                                        }
                                                    }
                                                } else {
                                                    if (parseInt(schildhanddropdown.options[schildhanddropdown.selectedIndex].value) == parseInt(dropdown.options[ioption].value)) {
                                                        if (schildhanddropdown.selectedIndex >= 1) {
                                                            itemssindverschieden = false;
                                                        }
                                                    }
                                                }
                                                if (itemssindverschieden == true) {
                                                    var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                    if (ladungen == -1) {
                                                        optionauswaehlen = ioption;
                                                        break;
                                                    } else {
                                                        if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                            var ladungendifferenz = ladungen - bevorzugteladungen;
                                                            if (ladungendifferenz < meisteladungen) {
                                                                optionauswaehlen = ioption;
                                                                meisteladungen = ladungendifferenz;
                                                            }
                                                        } else {
                                                            if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                                var ladungendifferenz = bevorzugteladungen - ladungen;
                                                                if (ladungendifferenz < meisteladungen) {
                                                                    optionauswaehlen = ioption;
                                                                    meisteladungen = ladungendifferenz;
                                                                }
                                                            } else {
                                                                if (ladungen == bevorzugteladungen) {
                                                                    optionauswaehlen = ioption;
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            } else {
                                                var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                if (ladungen == -1) {
                                                    optionauswaehlen = ioption;
                                                    break;
                                                } else {
                                                    if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                        var ladungendifferenz = ladungen - bevorzugteladungen;
                                                        if (ladungendifferenz < meisteladungen) {
                                                            optionauswaehlen = ioption;
                                                            meisteladungen = ladungendifferenz;
                                                        }
                                                    } else {
                                                        if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                            var ladungendifferenz = bevorzugteladungen - ladungen;
                                                            if (ladungendifferenz < meisteladungen) {
                                                                optionauswaehlen = ioption;
                                                                meisteladungen = ladungendifferenz;
                                                            }
                                                        } else {
                                                            if (ladungen == bevorzugteladungen) {
                                                                optionauswaehlen = ioption;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        } else {
                                            var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                            if (ladungen == -1) {
                                                optionauswaehlen = ioption;
                                                break;
                                            } else {
                                                if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                    var ladungendifferenz = ladungen - bevorzugteladungen;
                                                    if (ladungendifferenz < meisteladungen) {
                                                        optionauswaehlen = ioption;
                                                        meisteladungen = ladungendifferenz;
                                                    }
                                                } else {
                                                    if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                        var ladungendifferenz = bevorzugteladungen - ladungen;
                                                        if (ladungendifferenz < meisteladungen) {
                                                            optionauswaehlen = ioption;
                                                            meisteladungen = ladungendifferenz;
                                                        }
                                                    } else {
                                                        if (ladungen == bevorzugteladungen) {
                                                            optionauswaehlen = ioption;
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        //Prüfen ob Hauptitem gefunden wurde
                        if (optionauswaehlen != -1) {
                            dropdown.selectedIndex = optionauswaehlen;
                            ergeignisHinzufuegen(false, 'Der Gegenstand "' + itemname + '" für Stelle "' + ort + nummer + '" wurde gefunden und wird angelegt.');
                        } else {
                            //Prüfen ob Alternativitem 1 vorganden
                            var alternativitem1name = GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_1_name", "Alternativgegenstand 1. Grades");
                            var optionauswaehlen = -1;
                            if (alternativitem1name != "Alternativgegenstand 1. Grades") {
                                var meisteladungen = 100;
                                var bevorzugteladungen = GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_vgbevorzugen_1", 100);
                                for (var ioption = 0; ioption < dropdown.length; ioption++) {
                                    if (itemnameHerausfinden(dropdown.options[ioption].text) == alternativitem1name) {
                                        var anlegeschrittschildhand = GM_getValue("profil_" + held + "_" + slot + "_schild_hand_0_anlegeschritt", 1);
                                        var anlegeschrittwaffenhand = GM_getValue("profil_" + held + "_" + slot + "_waffen_hand_0_anlegeschritt", 1);
                                        if (ort != 'schild_hand' && ort != 'waffen_hand') {
                                            var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                            if (ladungen == -1) {
                                                optionauswaehlen = ioption;
                                                break;
                                            } else {
                                                if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                    var ladungendifferenz = ladungen - bevorzugteladungen;
                                                    if (ladungendifferenz < meisteladungen) {
                                                        optionauswaehlen = ioption;
                                                        meisteladungen = ladungendifferenz;
                                                    }
                                                } else {
                                                    if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                        var ladungendifferenz = bevorzugteladungen - ladungen;
                                                        if (ladungendifferenz < meisteladungen) {
                                                            optionauswaehlen = ioption;
                                                            meisteladungen = ladungendifferenz;
                                                        }
                                                    } else {
                                                        if (ladungen == bevorzugteladungen) {
                                                            optionauswaehlen = ioption;
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                        } else {
                                            if (ort == "schild_hand") {
                                                if (anlegeschrittschildhand >= anlegeschrittwaffenhand) {
                                                    var waffenhanddropdown = document.getElementsByName("LocationEquip[go_waffen_hand][0]")[0];
                                                    if (waffenhanddropdown != undefined) {
                                                        var itemssindverschieden = true;
                                                        if (parseInt(waffenhanddropdown.options[waffenhanddropdown.selectedIndex].value) == 0) {
                                                            var itemablegenid = Math.abs(parseInt(waffenhanddropdown.options[0].value));
                                                            if (itemablegenid == parseInt(dropdown.options[ioption].value)) {
                                                                if (waffenhanddropdown.selectedIndex >= 1) {
                                                                    itemssindverschieden = false;
                                                                }
                                                            }
                                                        } else {
                                                            if (parseInt(waffenhanddropdown.options[waffenhanddropdown.selectedIndex].value) == parseInt(dropdown.options[ioption].value)) {
                                                                if (waffenhanddropdown.selectedIndex >= 1) {
                                                                    itemssindverschieden = false;
                                                                }
                                                            }
                                                        }
                                                        if (itemssindverschieden == true) {
                                                            var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                            if (ladungen == -1) {
                                                                optionauswaehlen = ioption;
                                                                break;
                                                            } else {
                                                                if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                                    var ladungendifferenz = ladungen - bevorzugteladungen;
                                                                    if (ladungendifferenz < meisteladungen) {
                                                                        optionauswaehlen = ioption;
                                                                        meisteladungen = ladungendifferenz;
                                                                    }
                                                                } else {
                                                                    if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                                        var ladungendifferenz = bevorzugteladungen - ladungen;
                                                                        if (ladungendifferenz < meisteladungen) {
                                                                            optionauswaehlen = ioption;
                                                                            meisteladungen = ladungendifferenz;
                                                                        }
                                                                    } else {
                                                                        if (ladungen == bevorzugteladungen) {
                                                                            optionauswaehlen = ioption;
                                                                            break;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    } else {
                                                        var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                        if (ladungen == -1) {
                                                            optionauswaehlen = ioption;
                                                            break;
                                                        } else {
                                                            if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                                var ladungendifferenz = ladungen - bevorzugteladungen;
                                                                if (ladungendifferenz < meisteladungen) {
                                                                    optionauswaehlen = ioption;
                                                                    meisteladungen = ladungendifferenz;
                                                                }
                                                            } else {
                                                                if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                                    var ladungendifferenz = bevorzugteladungen - ladungen;
                                                                    if (ladungendifferenz < meisteladungen) {
                                                                        optionauswaehlen = ioption;
                                                                        meisteladungen = ladungendifferenz;
                                                                    }
                                                                } else {
                                                                    if (ladungen == bevorzugteladungen) {
                                                                        optionauswaehlen = ioption;
                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                } else {
                                                    var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                    if (ladungen == -1) {
                                                        optionauswaehlen = ioption;
                                                        break;
                                                    } else {
                                                        if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                            var ladungendifferenz = ladungen - bevorzugteladungen;
                                                            if (ladungendifferenz < meisteladungen) {
                                                                optionauswaehlen = ioption;
                                                                meisteladungen = ladungendifferenz;
                                                            }
                                                        } else {
                                                            if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                                var ladungendifferenz = bevorzugteladungen - ladungen;
                                                                if (ladungendifferenz < meisteladungen) {
                                                                    optionauswaehlen = ioption;
                                                                    meisteladungen = ladungendifferenz;
                                                                }
                                                            } else {
                                                                if (ladungen == bevorzugteladungen) {
                                                                    optionauswaehlen = ioption;
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                            if (ort == "waffen_hand") {
                                                if (anlegeschrittwaffenhand > anlegeschrittschildhand) {
                                                    var schildhanddropdown = document.getElementsByName("LocationEquip[go_schild_hand][0]")[0];
                                                    if (schildhanddropdown != undefined) {
                                                        var itemssindverschieden = true;
                                                        if (parseInt(schildhanddropdown.options[schildhanddropdown.selectedIndex].value) == 0) {
                                                            var itemablegenid = Math.abs(parseInt(schildhanddropdown.options[0].value));
                                                            if (itemablegenid == parseInt(dropdown.options[ioption].value)) {
                                                                if (schildhanddropdown.selectedIndex >= 1) {
                                                                    itemssindverschieden = false;
                                                                }
                                                            }
                                                        } else {
                                                            if (parseInt(schildhanddropdown.options[schildhanddropdown.selectedIndex].value) == parseInt(dropdown.options[ioption].value)) {
                                                                if (schildhanddropdown.selectedIndex >= 1) {
                                                                    itemssindverschieden = false;
                                                                }
                                                            }
                                                        }
                                                        if (itemssindverschieden == true) {
                                                            var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                            if (ladungen == -1) {
                                                                optionauswaehlen = ioption;
                                                                break;
                                                            } else {
                                                                if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                                    var ladungendifferenz = ladungen - bevorzugteladungen;
                                                                    if (ladungendifferenz < meisteladungen) {
                                                                        optionauswaehlen = ioption;
                                                                        meisteladungen = ladungendifferenz;
                                                                    }
                                                                } else {
                                                                    if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                                        var ladungendifferenz = bevorzugteladungen - ladungen;
                                                                        if (ladungendifferenz < meisteladungen) {
                                                                            optionauswaehlen = ioption;
                                                                            meisteladungen = ladungendifferenz;
                                                                        }
                                                                    } else {
                                                                        if (ladungen == bevorzugteladungen) {
                                                                            optionauswaehlen = ioption;
                                                                            break;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    } else {
                                                        var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                        if (ladungen == -1) {
                                                            optionauswaehlen = ioption;
                                                            break;
                                                        } else {
                                                            if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                                var ladungendifferenz = ladungen - bevorzugteladungen;
                                                                if (ladungendifferenz < meisteladungen) {
                                                                    optionauswaehlen = ioption;
                                                                    meisteladungen = ladungendifferenz;
                                                                }
                                                            } else {
                                                                if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                                    var ladungendifferenz = bevorzugteladungen - ladungen;
                                                                    if (ladungendifferenz < meisteladungen) {
                                                                        optionauswaehlen = ioption;
                                                                        meisteladungen = ladungendifferenz;
                                                                    }
                                                                } else {
                                                                    if (ladungen == bevorzugteladungen) {
                                                                        optionauswaehlen = ioption;
                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                } else {
                                                    var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                    if (ladungen == -1) {
                                                        optionauswaehlen = ioption;
                                                        break;
                                                    } else {
                                                        if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                            var ladungendifferenz = ladungen - bevorzugteladungen;
                                                            if (ladungendifferenz < meisteladungen) {
                                                                optionauswaehlen = ioption;
                                                                meisteladungen = ladungendifferenz;
                                                            }
                                                        } else {
                                                            if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                                var ladungendifferenz = bevorzugteladungen - ladungen;
                                                                if (ladungendifferenz < meisteladungen) {
                                                                    optionauswaehlen = ioption;
                                                                    meisteladungen = ladungendifferenz;
                                                                }
                                                            } else {
                                                                if (ladungen == bevorzugteladungen) {
                                                                    optionauswaehlen = ioption;
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            if (optionauswaehlen != -1) {
                                dropdown.selectedIndex = optionauswaehlen;
                                ergeignisHinzufuegen(true, 'Der Gegenstand "' + itemname + '" für Stelle "' + ort + nummer + '" wurde nicht gefunden, dafür wird der Alternativgegenstand "' + alternativitem1name + '" genutzt.');
                            } else {
                                //Prüfen ob Alternativitem 2 vorganden
                                var alternativitem2name = GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_alternativitem_2_name", "Alternativgegenstand 2. Grades");
                                var optionauswaehlen = -1;
                                if (alternativitem2name != "Alternativgegenstand 2. Grades") {
                                    var meisteladungen = 100;
                                    var bevorzugteladungen = GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + nummer + "_vgbevorzugen_2", 100);
                                    for (var ioption = 0; ioption < dropdown.length; ioption++) {
                                        if (itemnameHerausfinden(dropdown.options[ioption].text) == alternativitem2name) {
                                            var anlegeschrittschildhand = GM_getValue("profil_" + held + "_" + slot + "_schild_hand_0_anlegeschritt", 1);
                                            var anlegeschrittwaffenhand = GM_getValue("profil_" + held + "_" + slot + "_waffen_hand_0_anlegeschritt", 1);
                                            if (ort != 'schild_hand' && ort != 'waffen_hand') {
                                                var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                if (ladungen == -1) {
                                                    optionauswaehlen = ioption;
                                                    break;
                                                } else {
                                                    if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                        var ladungendifferenz = ladungen - bevorzugteladungen;
                                                        if (ladungendifferenz < meisteladungen) {
                                                            optionauswaehlen = ioption;
                                                            meisteladungen = ladungendifferenz;
                                                        }
                                                    } else {
                                                        if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                            var ladungendifferenz = bevorzugteladungen - ladungen;
                                                            if (ladungendifferenz < meisteladungen) {
                                                                optionauswaehlen = ioption;
                                                                meisteladungen = ladungendifferenz;
                                                            }
                                                        } else {
                                                            if (ladungen == bevorzugteladungen) {
                                                                optionauswaehlen = ioption;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                            } else {
                                                if (ort == "schild_hand") {
                                                    if (anlegeschrittschildhand >= anlegeschrittwaffenhand) {
                                                        var waffenhanddropdown = document.getElementsByName("LocationEquip[go_waffen_hand][0]")[0];
                                                        if (waffenhanddropdown != undefined) {
                                                            var itemssindverschieden = true;
                                                            if (parseInt(waffenhanddropdown.options[waffenhanddropdown.selectedIndex].value) == 0) {
                                                                var itemablegenid = Math.abs(parseInt(waffenhanddropdown.options[0].value));
                                                                if (itemablegenid == parseInt(dropdown.options[ioption].value)) {
                                                                    if (waffenhanddropdown.selectedIndex >= 1) {
                                                                        itemssindverschieden = false;
                                                                    }
                                                                }
                                                            } else {
                                                                if (parseInt(waffenhanddropdown.options[waffenhanddropdown.selectedIndex].value) == parseInt(dropdown.options[ioption].value)) {
                                                                    if (waffenhanddropdown.selectedIndex >= 1) {
                                                                        itemssindverschieden = false;
                                                                    }
                                                                }
                                                            }
                                                            if (itemssindverschieden == true) {
                                                                var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                                if (ladungen == -1) {
                                                                    optionauswaehlen = ioption;
                                                                    break;
                                                                } else {
                                                                    if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                                        var ladungendifferenz = ladungen - bevorzugteladungen;
                                                                        if (ladungendifferenz < meisteladungen) {
                                                                            optionauswaehlen = ioption;
                                                                            meisteladungen = ladungendifferenz;
                                                                        }
                                                                    } else {
                                                                        if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                                            var ladungendifferenz = bevorzugteladungen - ladungen;
                                                                            if (ladungendifferenz < meisteladungen) {
                                                                                optionauswaehlen = ioption;
                                                                                meisteladungen = ladungendifferenz;
                                                                            }
                                                                        } else {
                                                                            if (ladungen == bevorzugteladungen) {
                                                                                optionauswaehlen = ioption;
                                                                                break;
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        } else {
                                                            var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                            if (ladungen == -1) {
                                                                optionauswaehlen = ioption;
                                                                break;
                                                            } else {
                                                                if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                                    var ladungendifferenz = ladungen - bevorzugteladungen;
                                                                    if (ladungendifferenz < meisteladungen) {
                                                                        optionauswaehlen = ioption;
                                                                        meisteladungen = ladungendifferenz;
                                                                    }
                                                                } else {
                                                                    if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                                        var ladungendifferenz = bevorzugteladungen - ladungen;
                                                                        if (ladungendifferenz < meisteladungen) {
                                                                            optionauswaehlen = ioption;
                                                                            meisteladungen = ladungendifferenz;
                                                                        }
                                                                    } else {
                                                                        if (ladungen == bevorzugteladungen) {
                                                                            optionauswaehlen = ioption;
                                                                            break;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    } else {
                                                        var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                        if (ladungen == -1) {
                                                            optionauswaehlen = ioption;
                                                            break;
                                                        } else {
                                                            if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                                var ladungendifferenz = ladungen - bevorzugteladungen;
                                                                if (ladungendifferenz < meisteladungen) {
                                                                    optionauswaehlen = ioption;
                                                                    meisteladungen = ladungendifferenz;
                                                                }
                                                            } else {
                                                                if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                                    var ladungendifferenz = bevorzugteladungen - ladungen;
                                                                    if (ladungendifferenz < meisteladungen) {
                                                                        optionauswaehlen = ioption;
                                                                        meisteladungen = ladungendifferenz;
                                                                    }
                                                                } else {
                                                                    if (ladungen == bevorzugteladungen) {
                                                                        optionauswaehlen = ioption;
                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                                if (ort == "waffen_hand") {
                                                    if (anlegeschrittwaffenhand > anlegeschrittschildhand) {
                                                        var schildhanddropdown = document.getElementsByName("LocationEquip[go_schild_hand][0]")[0];
                                                        if (schildhanddropdown != undefined) {
                                                            var itemssindverschieden = true;
                                                            if (parseInt(schildhanddropdown.options[schildhanddropdown.selectedIndex].value) == 0) {
                                                                var itemablegenid = Math.abs(parseInt(schildhanddropdown.options[0].value));
                                                                if (itemablegenid == parseInt(dropdown.options[ioption].value)) {
                                                                    if (schildhanddropdown.selectedIndex >= 1) {
                                                                        itemssindverschieden = false;
                                                                    }
                                                                }
                                                            } else {
                                                                if (parseInt(schildhanddropdown.options[schildhanddropdown.selectedIndex].value) == parseInt(dropdown.options[ioption].value)) {
                                                                    if (schildhanddropdown.selectedIndex >= 1) {
                                                                        itemssindverschieden = false;
                                                                    }
                                                                }
                                                            }
                                                            if (itemssindverschieden == true) {
                                                                var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                                if (ladungen == -1) {
                                                                    optionauswaehlen = ioption;
                                                                    break;
                                                                } else {
                                                                    if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                                        var ladungendifferenz = ladungen - bevorzugteladungen;
                                                                        if (ladungendifferenz < meisteladungen) {
                                                                            optionauswaehlen = ioption;
                                                                            meisteladungen = ladungendifferenz;
                                                                        }
                                                                    } else {
                                                                        if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                                            var ladungendifferenz = bevorzugteladungen - ladungen;
                                                                            if (ladungendifferenz < meisteladungen) {
                                                                                optionauswaehlen = ioption;
                                                                                meisteladungen = ladungendifferenz;
                                                                            }
                                                                        } else {
                                                                            if (ladungen == bevorzugteladungen) {
                                                                                optionauswaehlen = ioption;
                                                                                break;
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        } else {
                                                            var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                            if (ladungen == -1) {
                                                                optionauswaehlen = ioption;
                                                                break;
                                                            } else {
                                                                if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                                    var ladungendifferenz = ladungen - bevorzugteladungen;
                                                                    if (ladungendifferenz < meisteladungen) {
                                                                        optionauswaehlen = ioption;
                                                                        meisteladungen = ladungendifferenz;
                                                                    }
                                                                } else {
                                                                    if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                                        var ladungendifferenz = bevorzugteladungen - ladungen;
                                                                        if (ladungendifferenz < meisteladungen) {
                                                                            optionauswaehlen = ioption;
                                                                            meisteladungen = ladungendifferenz;
                                                                        }
                                                                    } else {
                                                                        if (ladungen == bevorzugteladungen) {
                                                                            optionauswaehlen = ioption;
                                                                            break;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    } else {
                                                        var ladungen = itemAufLadungenPruefen(dropdown.options[ioption].text);
                                                        if (ladungen == -1) {
                                                            optionauswaehlen = ioption;
                                                            break;
                                                        } else {
                                                            if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                                                var ladungendifferenz = ladungen - bevorzugteladungen;
                                                                if (ladungendifferenz < meisteladungen) {
                                                                    optionauswaehlen = ioption;
                                                                    meisteladungen = ladungendifferenz;
                                                                }
                                                            } else {
                                                                if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                                                    var ladungendifferenz = bevorzugteladungen - ladungen;
                                                                    if (ladungendifferenz < meisteladungen) {
                                                                        optionauswaehlen = ioption;
                                                                        meisteladungen = ladungendifferenz;
                                                                    }
                                                                } else {
                                                                    if (ladungen == bevorzugteladungen) {
                                                                        optionauswaehlen = ioption;
                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                if (optionauswaehlen != -1) {
                                    dropdown.selectedIndex = optionauswaehlen;
                                    ergeignisHinzufuegen(true, 'Der Gegenstand "' + itemname + '" für Stelle "' + ort + nummer + '" wurde nicht gefunden, dafür wird der Alternativgegenstand "' + alternativitem2name + '" genutzt.');
                                } else {
                                    if (GM_getValue("warnungen_anzeigen_aktiv", true) == true) {
                                        pulsierenderRahmen(dropdown, 1, true);
                                    }
                                    ergeignisHinzufuegen(true, 'Für Stelle "' + ort + nummer + '" wurden keine passenden Gegenstände im Lager gefunden!');
                                }
                            }
                        }
                    } else {
                        alert("Fehler!");
                    }
                } else {
                    if (GM_getValue("warnungen_anzeigen_aktiv", true) == true) {
                        pulsierenderRahmen(dropdown, 1, true);
                    }
                    ergeignisHinzufuegen(true, 'Der Gegenstand "' + itemname + '" konnte nicht an Stelle "' + ort + nummer + '" angelegt werden, da dort ein Gegenstand angelegt ist, welches einen Resetpunkt zum Entfernen benötigen würde.');
                }
            } else {
                if (itemname != "") {
                    ergeignisHinzufuegen(true, 'Der Gegenstand "' + itemname + '" konnte nicht an Stelle "' + ort + nummer + '" angelegt werden, da sich keine nutzbaren Gegenstände für diese Stelle im Lager befinden oder die Gegenstände noch nicht angelegt wurden, welche die Anzahl der tragbaren Gegenstände für diesen Ort erhöhen.');
                }
            }
        }
    }
}


//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Läd den Gegenstand aus Profil Nr SLOT an Dropdown ORT NUMMER, wenn der Gegenstand dem Anlegeschritt SCHRITT zugeordnet ist
//Erwartet: String für Ort, integer für Slot und Schritt, boolean für Nachfüllen
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function mehrfachItemLadenSimplermodus(ort, slot, schritt, nachfuellen) {
    if (ort == "orden") {
        var endnummer = 10;
    } else {
        if (ort == "tasche") {
            var endnummer = 22;
        } else {
            var endnummer = 5;
        }
    }
    //Arrays erstellen
    var vgabweichungmin = GM_getValue("vgabweichungmin", 100);
    var vgabweichungmax = GM_getValue("vgabweichungmax", 100);
    var hauptitemsunverarbeitet = new Array();
    var alt1itemsunverarbeitet = new Array();
    var alt2itemsunverarbeitet = new Array();
    var vgbevorzugen0 = new Array();
    var vgbevorzugen1 = new Array();
    var vgbevorzugen2 = new Array();
    var warteliste = new Array();
    var wartelisteid = new Array();
    var angelegteitems = new Array();
    var angelegteitemsoption = new Array();
    var unangelegteitems = new Array();
    var unangelegteitemsid = new Array();
    for (var i = 0; i <= endnummer; i++) {
        if (nachfuellen == false) {
            var anlegeschritttemp = GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + i + "_anlegeschritt", 1);
        } else {
            var anlegeschritttemp = 1;
        }
        if (anlegeschritttemp <= schritt && GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + i + "_hauptitem_name", "Kein Gegenstand") != "Kein Gegenstand") {
            hauptitemsunverarbeitet.push(GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + i + "_hauptitem_name", "Kein Gegenstand"));
            alt1itemsunverarbeitet.push(GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + i + "_alternativitem_1_name", "Alternativgegenstand 1. Grades"));
            alt2itemsunverarbeitet.push(GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + i + "_alternativitem_2_name", "Alternativgegenstand 2. Grades"));
            vgbevorzugen0.push(GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + i + "_vgbevorzugen_0", 100));
            vgbevorzugen1.push(GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + i + "_vgbevorzugen_1", 100));
            vgbevorzugen2.push(GM_getValue("profil_" + held + "_" + slot + "_" + ort + "_" + i + "_vgbevorzugen_2", 100));
        }
    }
    var alledropdowns = document.getElementsByTagName("SELECT");
    var richtigedropdowns = new Array();
    if (ort == "orden") {
        var suchstring = /LocationEquip\[go_orden\]\[\d+\]/;
    } else {
        if (ort == "tasche") {
            var suchstring = /LocationEquip\[go_tasche\]\[\d+\]/;
        } else {
            var suchstring = /LocationEquip\[go_ring\]\[\d+\]/;
        }
    }
    for (var i = 0; i < alledropdowns.length; i++) {
        if (alledropdowns[i].name.search(suchstring) != -1) {
            richtigedropdowns.push(alledropdowns[i]);
        }
    }
    if (richtigedropdowns.length > 0) {
        var zuloeschen = new Array();
        for (var i = 0; i < richtigedropdowns.length; i++) {
            for (var ii = 0; ii < richtigedropdowns[i].length; ii++) {
                if (parseInt(richtigedropdowns[i].options[ii].value) == 0) {
                    if (itemAufAblegbarkeitPruefen(richtigedropdowns[i].options[ii].text) == true) {
                        angelegteitems.push(richtigedropdowns[i].options[ii].text);
                        angelegteitemsoption.push(richtigedropdowns[i].options[ii]);
                        break;
                    } else {
                        zuloeschen.push(i);
                        break;
                    }
                }
            }
        }
        var mod = 0;
        for (var i = 0; i < zuloeschen.length; i++) {
            richtigedropdowns.splice(zuloeschen[i] + mod, 1);
            mod = mod - 1;
        }
        for (var i = 0; i < richtigedropdowns[0].length; i++) {
            if (parseInt(richtigedropdowns[0].options[i].value) != 0) {
                unangelegteitems.push(richtigedropdowns[0].options[i].text);
                unangelegteitemsid.push(parseInt(richtigedropdowns[0].options[i].value));
            }
        }
        //Jeden der Gegenstände des Profils durchgehen
        for (var i = hauptitemsunverarbeitet.length - 1; i >= 0; i--) {
            //Aktuelles Profilitem auf Hauptgegenstände untersuchen
            var hauptitemgefunden = false;
            for (var ii = angelegteitems.length - 1; ii >= 0; ii--) {
                if (itemnameHerausfinden(angelegteitems[ii]) == hauptitemsunverarbeitet[i]) {
                    hauptitemgefunden = true;
                    angelegteitemsoption[ii].selected = true;
                    angelegteitemsoption.splice(ii, 1);
                    angelegteitems.splice(ii, 1);
                    hauptitemsunverarbeitet.splice(i, 1);
                    alt1itemsunverarbeitet.splice(i, 1);
                    alt2itemsunverarbeitet.splice(i, 1);
                    vgbevorzugen0.splice(i, 1);
                    vgbevorzugen1.splice(i, 1);
                    vgbevorzugen2.splice(i, 1);
                    break;
                }
            }
            if (hauptitemgefunden == false) {
                var maxladungen = 101;
                var bevorzugteladungen = vgbevorzugen0[i];
                var itemmitmeistenladungen = "";
                for (var ii = unangelegteitems.length - 1; ii >= 0; ii--) {
                    if (itemnameHerausfinden(unangelegteitems[ii]) == hauptitemsunverarbeitet[i]) {
                        var ladungen = itemAufLadungenPruefen(unangelegteitems[ii]);
                        if (ladungen == -1) {
                            hauptitemgefunden = true;
                            warteliste.push(unangelegteitems[ii]);
                            wartelisteid.push(unangelegteitemsid[ii]);
                            unangelegteitems.splice(ii, 1);
                            unangelegteitemsid.splice(ii, 1);
                            hauptitemsunverarbeitet.splice(i, 1);
                            alt1itemsunverarbeitet.splice(i, 1);
                            alt2itemsunverarbeitet.splice(i, 1);
                            vgbevorzugen0.splice(i, 1);
                            vgbevorzugen1.splice(i, 1);
                            vgbevorzugen2.splice(i, 1);
                            break;
                        } else {
                            if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                var ladungendifferenz = ladungen - bevorzugteladungen;
                                if (ladungendifferenz < maxladungen) {
                                    itemmitmeistenladungen = ii;
                                    maxladungen = ladungendifferenz;
                                }
                            } else {
                                if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                    var ladungendifferenz = bevorzugteladungen - ladungen;
                                    if (ladungendifferenz < maxladungen) {
                                        itemmitmeistenladungen = ii;
                                        maxladungen = ladungendifferenz;
                                    }
                                } else {
                                    if (ladungen == bevorzugteladungen) {
                                        itemmitmeistenladungen = ii;
                                        maxladungen = 0;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                if (maxladungen < 101) {
                    hauptitemgefunden = true;
                    warteliste.push(unangelegteitems[itemmitmeistenladungen]);
                    wartelisteid.push(unangelegteitemsid[itemmitmeistenladungen]);
                    unangelegteitems.splice(itemmitmeistenladungen, 1);
                    unangelegteitemsid.splice(itemmitmeistenladungen, 1);
                    hauptitemsunverarbeitet.splice(i, 1);
                    alt1itemsunverarbeitet.splice(i, 1);
                    alt2itemsunverarbeitet.splice(i, 1);
                    vgbevorzugen0.splice(i, 1);
                    vgbevorzugen1.splice(i, 1);
                    vgbevorzugen2.splice(i, 1);
                }
            }
            //Aktuelles Profilitem auf Alternativgegenstände 1. Grades untersuchen
            if (hauptitemgefunden == false && alt1itemsunverarbeitet[i] != "Alternativgegenstand 1. Grades") {
                var alt1itemgefunden = false;
                for (var ii = angelegteitems.length - 1; ii >= 0; ii--) {
                    if (itemnameHerausfinden(angelegteitems[ii]) == alt1itemsunverarbeitet[i]) {
                        alt1itemgefunden = true;
                        angelegteitemsoption[ii].selected = true;
                        angelegteitemsoption.splice(ii, 1);
                        angelegteitems.splice(ii, 1);
                        hauptitemsunverarbeitet.splice(i, 1);
                        alt1itemsunverarbeitet.splice(i, 1);
                        alt2itemsunverarbeitet.splice(i, 1);
                        vgbevorzugen0.splice(i, 1);
                        vgbevorzugen1.splice(i, 1);
                        vgbevorzugen2.splice(i, 1);
                        break;
                    }
                }
                if (alt1itemgefunden == false) {
                    var maxladungen = 101;
                    var bevorzugteladungen = vgbevorzugen1[i];
                    var itemmitmeistenladungen = "";
                    for (var ii = unangelegteitems.length - 1; ii >= 0; ii--) {
                        if (itemnameHerausfinden(unangelegteitems[ii]) == alt1itemsunverarbeitet[i]) {
                            var ladungen = itemAufLadungenPruefen(unangelegteitems[ii]);
                            if (ladungen == -1) {
                                alt1itemgefunden = true;
                                warteliste.push(unangelegteitems[ii]);
                                wartelisteid.push(unangelegteitemsid[ii]);
                                unangelegteitems.splice(ii, 1);
                                unangelegteitemsid.splice(ii, 1);
                                hauptitemsunverarbeitet.splice(i, 1);
                                alt1itemsunverarbeitet.splice(i, 1);
                                alt2itemsunverarbeitet.splice(i, 1);
                                vgbevorzugen0.splice(i, 1);
                                vgbevorzugen1.splice(i, 1);
                                vgbevorzugen2.splice(i, 1);
                                break;
                            } else {
                                if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                    var ladungendifferenz = ladungen - bevorzugteladungen;
                                    if (ladungendifferenz < maxladungen) {
                                        itemmitmeistenladungen = ii;
                                        maxladungen = ladungendifferenz;
                                    }
                                } else {
                                    if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                        var ladungendifferenz = bevorzugteladungen - ladungen;
                                        if (ladungendifferenz < maxladungen) {
                                            itemmitmeistenladungen = ii;
                                            maxladungen = ladungendifferenz;
                                        }
                                    } else {
                                        if (ladungen == bevorzugteladungen) {
                                            itemmitmeistenladungen = ii;
                                            maxladungen = 0;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (maxladungen < 101) {
                        alt1itemgefunden = true;
                        warteliste.push(unangelegteitems[itemmitmeistenladungen]);
                        wartelisteid.push(unangelegteitemsid[itemmitmeistenladungen]);
                        unangelegteitems.splice(itemmitmeistenladungen, 1);
                        unangelegteitemsid.splice(itemmitmeistenladungen, 1);
                        hauptitemsunverarbeitet.splice(i, 1);
                        alt1itemsunverarbeitet.splice(i, 1);
                        alt2itemsunverarbeitet.splice(i, 1);
                        vgbevorzugen0.splice(i, 1);
                        vgbevorzugen1.splice(i, 1);
                        vgbevorzugen2.splice(i, 1);
                    }
                }
                if (alt1itemgefunden == false && alt2itemsunverarbeitet[i] != "Alternativgegenstand 2. Grades") {
                    //Aktuelles Profilitem auf Alternativgegenstände 2. Grades untersuchen
                    var alt2itemgefunden = false;
                    for (var ii = angelegteitems.length - 1; ii >= 0; ii--) {
                        if (itemnameHerausfinden(angelegteitems[ii]) == alt2itemsunverarbeitet[i]) {
                            alt2itemgefunden = true;
                            angelegteitemsoption[ii].selected = true;
                            angelegteitemsoption.splice(ii, 1);
                            angelegteitems.splice(ii, 1);
                            hauptitemsunverarbeitet.splice(i, 1);
                            alt1itemsunverarbeitet.splice(i, 1);
                            alt2itemsunverarbeitet.splice(i, 1);
                            vgbevorzugen0.splice(i, 1);
                            vgbevorzugen1.splice(i, 1);
                            vgbevorzugen2.splice(i, 1);
                            break;
                        }
                    }
                    if (alt2itemgefunden == false) {
                        var maxladungen = 101;
                        var bevorzugteladungen = vgbevorzugen2[i];
                        var itemmitmeistenladungen = "";
                        for (var ii = unangelegteitems.length - 1; ii >= 0; ii--) {
                            if (itemnameHerausfinden(unangelegteitems[ii]) == alt2itemsunverarbeitet[i]) {
                                var ladungen = itemAufLadungenPruefen(unangelegteitems[ii]);
                                if (ladungen == -1) {
                                    alt2itemgefunden = true;
                                    warteliste.push(unangelegteitems[ii]);
                                    wartelisteid.push(unangelegteitemsid[ii]);
                                    unangelegteitems.splice(ii, 1);
                                    unangelegteitemsid.splice(ii, 1);
                                    hauptitemsunverarbeitet.splice(i, 1);
                                    alt1itemsunverarbeitet.splice(i, 1);
                                    alt2itemsunverarbeitet.splice(i, 1);
                                    vgbevorzugen0.splice(i, 1);
                                    vgbevorzugen1.splice(i, 1);
                                    vgbevorzugen2.splice(i, 1);
                                    break;
                                } else {
                                    if (ladungen > bevorzugteladungen && ladungen <= (vgabweichungmax + bevorzugteladungen)) {
                                        var ladungendifferenz = ladungen - bevorzugteladungen;
                                        if (ladungendifferenz < maxladungen) {
                                            itemmitmeistenladungen = ii;
                                            maxladungen = ladungendifferenz;
                                        }
                                    } else {
                                        if (ladungen < bevorzugteladungen && ladungen >= (bevorzugteladungen - vgabweichungmin)) {
                                            var ladungendifferenz = bevorzugteladungen - ladungen;
                                            if (ladungendifferenz < maxladungen) {
                                                itemmitmeistenladungen = ii;
                                                maxladungen = ladungendifferenz;
                                            }
                                        } else {
                                            if (ladungen == bevorzugteladungen) {
                                                itemmitmeistenladungen = ii;
                                                maxladungen = 0;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        if (maxladungen < 101) {
                            alt2itemgefunden = true;
                            warteliste.push(unangelegteitems[itemmitmeistenladungen]);
                            wartelisteid.push(unangelegteitems[itemmitmeistenladungen]);
                            unangelegteitems.splice(itemmitmeistenladungen, 1);
                            unangelegteitemsid.splice(itemmitmeistenladungen, 1);
                            hauptitemsunverarbeitet.splice(i, 1);
                            alt1itemsunverarbeitet.splice(i, 1);
                            alt2itemsunverarbeitet.splice(i, 1);
                            vgbevorzugen0.splice(i, 1);
                            vgbevorzugen1.splice(i, 1);
                            vgbevorzugen2.splice(i, 1);
                        }
                    }
                }
                if (alt2itemgefunden == false) {
                    ergeignisHinzufuegen(true, 'Der Gegenstand "' + hauptitemsunverarbeitet[i] + '" für die Stelle "' + ort + '" konnte nicht gefunden werden. Auch keine der Alternativgegenstände.');
                    hauptitemsunverarbeitet.splice(i, 1);
                    alt1itemsunverarbeitet.splice(i, 1);
                    alt2itemsunverarbeitet.splice(i, 1);
                    vgbevorzugen0.splice(i, 1);
                    vgbevorzugen1.splice(i, 1);
                    vgbevorzugen2.splice(i, 1);
                }
            }
        }
        //Items von der Warteliste auf die unbenutzten Plätze verteilen
        for (var i = angelegteitemsoption.length - 1; i >= 0; i--) {
            if (warteliste.length - 1 >= 0) {
                for (var ii = angelegteitemsoption[i].parentNode.length - 1; ii >= 0; ii--) {
                    if (angelegteitemsoption[i].parentNode.options[ii].value == wartelisteid[wartelisteid.length - 1]) {
                        angelegteitemsoption[i].parentNode.selectedIndex = ii;
                        warteliste.pop();
                        wartelisteid.pop();
                        break;
                    }
                }
            } else {
                angelegteitemsoption[i].parentNode.selectedIndex = 0;
            }
        }
        //Nicht angelegte Items ausgeben
        if (warteliste.length > 0) {
            ergeignisHinzufuegen(true, 'Die Gegenstände "' + warteliste.join("") + '" für die Stelle "' + ort + '" kontnen nicht angelegt werden, da kein Platz mehr frei war. Um dies zu vermeiden sollte im Expertenmodus der Anlegeschritt passend eingestellt werden.');
        }
    } else {
        ergeignisHinzufuegen(true, 'Die Gegenstände für die Stelle "' + ort + '" kontnen nicht angelegt werden, da sich für diese Stelle keine Gegenstände im Lager befinden.');
    }
}


//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Läd ein Profil direkt, also ohne Ausrüstungsmenü und ignoriert alle anlegeschritte
//Erwartet: Integer mit Nummer des zu ladenden Profils
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function nachfuellen(slot) {
    warteEbeneAnzeigen();
    itemLadenSimplermodus('kopf', 0, slot, 1, true);
    itemLadenSimplermodus('ohren', 0, slot, 1, true);
    itemLadenSimplermodus('brille', 0, slot, 1, true);
    itemLadenSimplermodus('hals', 0, slot, 1, true);
    itemLadenSimplermodus('torso', 0, slot, 1, true);
    itemLadenSimplermodus('schaerpe', 0, slot, 1, true);
    itemLadenSimplermodus('umhang', 0, slot, 1, true);
    itemLadenSimplermodus('arme', 0, slot, 1, true);
    itemLadenSimplermodus('hand', 0, slot, 1, true);
    itemLadenSimplermodus('beide_haende', 0, slot, 1, true);
    itemLadenSimplermodus('waffen_hand', 0, slot, 1, true);
    itemLadenSimplermodus('schild_hand', 0, slot, 1, true);
    itemLadenSimplermodus('beine', 0, slot, 1, true);
    itemLadenSimplermodus('fuss', 0, slot, 1, true);
    mehrfachItemLadenSimplermodus('orden', slot, 1, true);
    mehrfachItemLadenSimplermodus('tasche', slot, 1, true);
    mehrfachItemLadenSimplermodus('ring', slot, 1, true);
    ergeignisHinzufuegen(false, "Die fehlenden Verbrauchsgegenstände wurden nachgefüllt.");
    seiteAbschicken();
}


//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Legt die Gegenstände des Profils Nr. SLOT an, die dem Anlegeschritt Nr. SCHRITT zugeordnet sind
//Erwartet: Integer mit Nummer des zu ladenden Profils und integer mit Anlegeschritt
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function ladenSimplermodus(slot, schritt) {
    warteEbeneAnzeigen();
    itemLadenSimplermodus('kopf', 0, slot, schritt, false);
    itemLadenSimplermodus('ohren', 0, slot, schritt, false);
    itemLadenSimplermodus('brille', 0, slot, schritt, false);
    itemLadenSimplermodus('hals', 0, slot, schritt, false);
    itemLadenSimplermodus('torso', 0, slot, schritt, false);
    itemLadenSimplermodus('schaerpe', 0, slot, schritt, false);
    itemLadenSimplermodus('umhang', 0, slot, schritt, false);
    itemLadenSimplermodus('arme', 0, slot, schritt, false);
    itemLadenSimplermodus('hand', 0, slot, schritt, false);
    itemLadenSimplermodus('beide_haende', 0, slot, schritt, false);
    itemLadenSimplermodus('waffen_hand', 0, slot, schritt, false);
    itemLadenSimplermodus('schild_hand', 0, slot, schritt, false);
    itemLadenSimplermodus('beine', 0, slot, schritt, false);
    itemLadenSimplermodus('fuss', 0, slot, schritt, false);
    mehrfachItemLadenSimplermodus('orden', slot, schritt, false);
    mehrfachItemLadenSimplermodus('tasche', slot, schritt, false);
    mehrfachItemLadenSimplermodus('ring', slot, schritt, false);
    ergeignisHinzufuegen(false, "Die Gegenstände des " + schritt + ". Anlegeschritts wurden angelegt.");
    seiteAbschicken();
}


//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Steuert das Menü zum Laden von Items
//Erwartet: interger bei Schritt (für Schritt 0-6 bei dem man gerade ist)
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function ausruestungsmenueEinblenden(schritt) {
    abdunklungsEbeneAnzeigen();
    var ersteselement = document.getElementsByTagName("BODY")[0].firstChild;
    var ausruestungsmenue = document.createElement("div");
    var hoehedesanzeigebereichs2 = window.innerHeight;
    var breitedesanzeigebereichs2 = window.innerWidth;
    var abstandoben2 = Math.round((hoehedesanzeigebereichs2 - 302) / 2);
    var abstandlinks2 = Math.round((breitedesanzeigebereichs2 - 402) / 2);
    ausruestungsmenue.id = "ausruestungsmenue";
    ausruestungsmenue.style.visibility = "visible";
    var gewaehltesprofil = GM_getValue("gewaehltesprofil_" + held, 0);
    var profilname = GM_getValue("profil_" + held + "_" + gewaehltesprofil + "_profilname", "FEHLER");
    var schrittegenutzt = GM_getValue("profil_" + held + "_" + gewaehltesprofil + "_genutzteschritte", -1);
    //Schritt anzeigen
    switch (schritt) {
        case 0:
            var schritttext = "(0.) Aktuell getragende Ausrüstung ablegen";
            break;
        case 1:
            var schritttext = "(1.) Ausrüstung mit Anlegeschritt 1 anlegen";
            break;
        case 2:
            var schritttext = "(2.) Ausrüstung mit Anlegeschritt 2 anlegen";
            break;
        case 3:
            var schritttext = "(3.) Ausrüstung mit Anlegeschritt 3 anlegen";
            break;
        case 4:
            var schritttext = "(4.) Ausrüstung mit Anlegeschritt 4 anlegen";
            break;
        case 5:
            var schritttext = "(5.) Ausrüstung mit Anlegeschritt 5 anlegen";
            break;
        default:
            var schritttext = "FEHLER";
            break;
    }
    //Schrittinfo
    switch (schritt) {
        case 0:
            var schrittinfo = 'Aktuell getragene Gegenstände vorher ablegen?<br /><input type="radio" name="itemablegen" id="itemablegen_1" value="1" /> ja ; <input type="radio" name="itemablegen" id="itemablegen_0" value="0" /> nein';
            break;
        case 1:
            var schrittinfo = 'Bitte auf "Weiter" klicken, damit die Gegenstände mit Anlegeschritt 1 angelegt werden.';
            break;
        case 2:
            var schrittinfo = 'Bitte auf "Weiter" klicken, damit die Gegenstände mit Anlegeschritt 2 angelegt werden.';
            break;
        case 3:
            var schrittinfo = 'Bitte auf "Weiter" klicken, damit die Gegenstände mit Anlegeschritt 3 angelegt werden.';
            break;
        case 4:
            var schrittinfo = 'Bitte auf "Weiter" klicken, damit die Gegenstände mit Anlegeschritt 4 angelegt werden.';
            break;
        case 5:
            var schrittinfo = 'Bitte auf "Weiter" klicken, damit die Gegenstände mit Anlegeschritt 5 angelegt werden.';
            break;
        default:
            var schrittinfo = "FEHLER.";
            break;
    }
    var farbcode = new Array();
    if (GM_getValue("gegenstaendeablegen", 1) == 0 || GM_getValue("gegenstaendeablegen", 1) == 2) {
        farbcode[0] = "#999999";
    } else {
        if (GM_getValue("gegenstaendeablegen", 1) == 1 && schritt == 0) {
            farbcode[0] = "#FF0000";
        } else {
            farbcode[0] = "#FFFF00";
        }
    }
    for (var ifarbe = 1; ifarbe <= 5; ifarbe++) {
        if (schritt == ifarbe) {
            farbcode[ifarbe] = "#FF0000";
        } else {
            if (ifarbe <= schrittegenutzt) {
                farbcode[ifarbe] = "#FFFF00";
            } else {
                farbcode[ifarbe] = "#999999";
            }
        }
    }
    ausruestungsmenue.innerHTML = '' +
        '<div id="optionsmenuediv" style="width: 400px; heigth: 300px; position: fixed; z-index: 101; top: ' + abstandoben2 + 'px; left: ' + abstandlinks2 + 'px;">' +
        '<form name="ausruestungsmenueform" id="ausruestungsmenueform" style="margin: 0px;" >' +
        '<table width="400" border="0" cellspacing="0" cellpadding="0" style="border-color:#000000; border-style:solid; border-width:1px;">' +
        '<tr>' +
        '<td width="42" height="25" style="background-color: #660000;color: #FFFFFF; font-weight: bold; border-bottom-color:#000000; border-bottom-style:solid; border-bottom-width:1px;"> </td>' +
        '<td width="309" style="background-color: #660000;color: #FFFFFF; font-weight: bold; border-bottom-color:#000000; border-bottom-style:solid; border-bottom-width:1px;"><div align="center">Ausrüstungs-Menü</div></td>' +
        '<td width="45" style="background-color: #660000;color: #FFFFFF; font-weight: bold; border-bottom-color:#000000; border-bottom-style:solid; border-bottom-width:1px;"><div align="center">' +
        '<input type="button" name="verschiebenknopf" id="verschiebenknopf" value="&hArr;" />' +
        '</div></td>' +
        '</tr>' +
        '<tr>' +
        '<td height="62" colspan="3" style="background-color:#FECD38;"><table width="380" border="0" align="center" cellpadding="0" cellspacing="0">' +
        '<tr>' +
        '<td height="28" style="color: #000000;"><div align="left"><strong>Profil:</strong></div></td>' +
        '<td colspan="14" style="color: #000000;"><div align="left"><strong><em id="profilfeld" >' + profilname + '</em></strong></div></td>' +
        '</tr>' +
        '<tr>' +
        '<td width="45" style="color: #000000;"><div align="left"><strong>Schritte:</strong></div></td>' +
        '<td id="nummernfeldschritt0" width="30" style="color: #000000; background-color: ' + farbcode[0] + '; border-color: #000000; border-style:solid; border-width:1px;"><div align="center" id="___wodToolTip_UniqueId__9980" onmouseover="return wodToolTip(this,\'<strong>(0.) Aktuelle Ausrüstung ablegen</strong>\');"><strong>0</strong></div></td>' +
        '<td width="3"></td>' +
        '<td id="nummernfeldschritt1" width="30" style="color: #000000; background-color: ' + farbcode[1] + '; border-color: #000000; border-style:solid; border-width:1px;"><div align="center" id="___wodToolTip_UniqueId__9981" onmouseover="return wodToolTip(this,\'<strong>(1.) Gegenstände mit Anlegeschritt 1 anlegen</strong>\');"><strong>1</strong></div></td>' +
        '<td width="3"></td>' +
        '<td id="nummernfeldschritt2" width="30" style="color: #000000; background-color: ' + farbcode[2] + '; border-color: #000000; border-style:solid; border-width:1px;"><div align="center" id="___wodToolTip_UniqueId__9982" onmouseover="return wodToolTip(this,\'<strong>(2.) Gegenstände mit Anlegeschritt 2 anlegen</strong>\');"><strong>2</strong></div></td>' +
        '<td width="3"></td>' +
        '<td id="nummernfeldschritt3" width="30" style="color: #000000; background-color: ' + farbcode[3] + '; border-color: #000000; border-style:solid; border-width:1px;"><div align="center" id="___wodToolTip_UniqueId__9983" onmouseover="return wodToolTip(this,\'<strong>(3.) Gegenstände mit Anlegeschritt 3 anlegen</strong>\');"><strong>3</strong></div></td>' +
        '<td width="3"></td>' +
        '<td id="nummernfeldschritt4" width="30" style="color: #000000; background-color: ' + farbcode[4] + '; border-color: #000000; border-style:solid; border-width:1px;"><div align="center" id="___wodToolTip_UniqueId__9984" onmouseover="return wodToolTip(this,\'<strong>(4.) Gegenstände mit Anlegeschritt 4 anlegen</strong>\');"><strong>4</strong></div></td>' +
        '<td width="3"></td>' +
        '<td id="nummernfeldschritt5" width="30" style="color: #000000; background-color: ' + farbcode[5] + '; border-color: #000000; border-style:solid; border-width:1px;"><div align="center" id="___wodToolTip_UniqueId__9985" onmouseover="return wodToolTip(this,\'<strong>(5.) Gegenstände mit Anlegeschritt 5 anlegen</strong>\');"><strong>5</strong></div></td>' +
        '<td width="36"></td>' +
        '</tr>' +
        '<tr>' +
        '<td height="28" style="color: #000000;"><div align="left"><strong>Aktuell:</strong></div></td>' +
        '<td colspan="14" style="color: #000000;"><div align="left"><strong><em id="schrittfeld" >' + schritttext + '</em></strong></div></td>' +
        '</tr>' +
        '</table></td>' +
        '</tr>' +
        '<tr>' +
        '<td height="70" colspan="3" style="background-color:#FECD38; color: #000000;"><div align="center" id="fragefeld" >' +
        schrittinfo +
        '</div></td>' +
        '</tr>' +
        '<tr>' +
        '<td colspan="3" style="background-color:#FECD38;"><table width="390" height="37" border="0" align="center" cellpadding="0" cellspacing="0">' +
        '<tr>' +
        '<td width="195" height="31"><div align="center"><input type="button" name="abbrechenknopf" id="abbrechenknopf" value="Abbrechen" /></div></td>' +
        '<td width="195"><div align="center"><input type="button" name="weiterknopf" id="weiterknopf" value="Nächster Schritt" /></div></td>' +
        '</tr>' +
        '</table></td>' +
        '</tr>' +
        '</table>' +
        '</form>' +
        '</div>';
    ersteselement.parentNode.insertBefore(ausruestungsmenue, ersteselement);
    //Ablegeauswahl vorauswählen
    if (schritt == 0) {
        if (GM_getValue("letztesablegenauswahl_" + held, 1) == 1) {
            var radio = document.getElementById('itemablegen_0');
        } else {
            var radio = document.getElementById('itemablegen_1');
        }
        radio.checked = true;
    }
    warteEbeneAusblenden();

    //Aktionen für den Verschiebenknopf
    var verschiebenknopf = document.getElementById("verschiebenknopf");
    verschiebenknopf.addEventListener("mousedown", function (e) {
        verschiebenaktiv = true;
        verschiebenxalt = e.screenX;
        verschiebenyalt = e.screenY;
        verschiebenxneu = e.screenX;
        verschiebenyneu = e.screenY;
    }, false);
    verschiebenknopf.addEventListener("mouseup", function (e) {
        verschiebenaktiv = false;
    }, false);
    verschiebenknopf.addEventListener("mouseout", function (e) {
        verschiebenaktiv = false;
    }, false);
    var verschiebenknopf = document.getElementById("verschiebenknopf");
    verschiebenknopf.addEventListener("mousemove", function (e) {
        if (verschiebenaktiv == true) {
            verschiebenxalt = verschiebenxneu;
            verschiebenxneu = e.screenX;
            verschiebenyalt = verschiebenyneu;
            verschiebenyneu = e.screenY;
            var verschiebungx = verschiebenxneu - verschiebenxalt;
            var verschiebungy = verschiebenyneu - verschiebenyalt;
            var toppixel = document.getElementById("optionsmenuediv").style.top;
            document.getElementById("optionsmenuediv").style.top = parseInt(toppixel) + verschiebungy + 'px';
            var leftpixel = document.getElementById("optionsmenuediv").style.left;
            document.getElementById("optionsmenuediv").style.left = parseInt(leftpixel) + verschiebungx + 'px';
        }
    }, false);
    //Aktionen für den Abbrechen Knopf
    var abbrechenknopf = document.getElementById("abbrechenknopf");
    abbrechenknopf.addEventListener("click", function (e) {
        ausruestungsSchrittBeenden();
    }, false);
    //Aktionen für den Weiter Knopf
    var weiterknopf = document.getElementById("weiterknopf");
    weiterknopf.addEventListener("click", function (e) {
        weiterknopf.disabled = true;
        var schrittegenutzt = GM_getValue("profil_" + held + "_" + gewaehltesprofil + "_genutzteschritte", -1);
        switch (schritt) {
            case 0:
                var radio2 = document.getElementById('itemablegen_0');
                if (radio2.checked == true) {
                    GM_setValue("letztesablegenauswahl_" + held, 1);
                    GM_setValue("ausruestungsschritt_" + held, 1);
                    ergeignisHinzufuegen(false, "Das Ablegen der aktuell getragenen Gegenstände wird übersprungen.");
                    ausruestungsmenueAusblenden();
                    ausruestungsSchrittSteuerung();
                } else {
                    GM_setValue("restueberspringen_" + held, true);
                    GM_setValue("letztesablegenauswahl_" + held, 0);
                    GM_setValue("ausruestungsschritt_" + held, 1);
                    ergeignisHinzufuegen(false, "Das Ablegen der aktuell getragenen Gegenstände wird durchgeführt.");
                    alleGegenstaendeAblegen();
                }
                break;
            case 1:
                ergeignisHinzufuegen(false, "Gegenstände mit Anlegeschritt 1 werden ausgerüstet.");
                if (schrittegenutzt == schritt) {
                    GM_setValue("ausruestungsschritt_" + held, -1);
                    ergeignisHinzufuegen(false, "Das Ausrüsten wurde abgeschlossen.");
                } else {
                    GM_setValue("ausruestungsschritt_" + held, 2);
                }
                ausruestungsmenueAusblenden();
                GM_setValue("restueberspringen_" + held, false);
                ladenSimplermodus(GM_getValue("gewaehltesprofil_" + held, 0), 1);
                break;
            case 2:
                ergeignisHinzufuegen(false, "Gegenstände mit Anlegeschritt 2 werden ausgerüstet.");
                if (schrittegenutzt == schritt) {
                    GM_setValue("ausruestungsschritt_" + held, -1);
                    ergeignisHinzufuegen(false, "Das Ausrüsten wurde abgeschlossen.");
                } else {
                    GM_setValue("ausruestungsschritt_" + held, 3);
                }
                ausruestungsmenueAusblenden();
                ladenSimplermodus(GM_getValue("gewaehltesprofil_" + held, 0), 2);
                break;
            case 3:
                ergeignisHinzufuegen(false, "Gegenstände mit Anlegeschritt 3 werden ausgerüstet.");
                if (schrittegenutzt == schritt) {
                    GM_setValue("ausruestungsschritt_" + held, -1);
                    ergeignisHinzufuegen(false, "Das Ausrüsten wurde abgeschlossen.");
                } else {
                    GM_setValue("ausruestungsschritt_" + held, 4);
                }
                ausruestungsmenueAusblenden();
                ladenSimplermodus(GM_getValue("gewaehltesprofil_" + held, 0), 3);
                break;
            case 4:
                ergeignisHinzufuegen(false, "Gegenstände mit Anlegeschritt 4 werden ausgerüstet.");
                if (schrittegenutzt == schritt) {
                    GM_setValue("ausruestungsschritt_" + held, -1);
                    ergeignisHinzufuegen(false, "Das Ausrüsten wurde abgeschlossen.");
                } else {
                    GM_setValue("ausruestungsschritt_" + held, 5);
                }
                ausruestungsmenueAusblenden();
                ladenSimplermodus(GM_getValue("gewaehltesprofil_" + held, 0), 4);
                break;
            case 5:
                ergeignisHinzufuegen(false, "Gegenstände mit Anlegeschritt 5 werden ausgerüstet.");
                GM_setValue("ausruestungsschritt_" + held, -1);
                ergeignisHinzufuegen(false, "Das Ausrüsten wurde abgeschlossen.");
                ausruestungsmenueAusblenden();
                ladenSimplermodus(GM_getValue("gewaehltesprofil_" + held, 0), 1);
                break;
            default:
                break;
        }
    }, false);
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Regelt den Ablauf der einzelnen Schritte beim Laden eines Profils
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function ausruestungsSchrittSteuerung() {
    if (pruefenDassNichtZuVieleItemsGefundenWurden() == true) {
        ausruestungsschrittalt = GM_getValue("ausruestungsschritt_" + held, -1);
        var ladenknopf = document.getElementById("ladenknopf");
        ladenknopf.disabled = true;
        var profildropdown = document.getElementById("profilliste");
        profildropdown.disabled = true;
        var gewaehltesprofil = GM_getValue("gewaehltesprofil_" + held, 0);
        var restueberspringen = false;
        //Prüfen, ob erst neu mit dem Ausrüsten begonnen wurde
        if (ausruestungsschrittalt == -1) {
            if (GM_getValue("gegenstaendeablegen", 1) == 0) {
                GM_setValue("ausruestungsschritt_" + held, 1);
                ergeignisHinzufuegen(false, "Das Ablegen der aktuell getragenen Gegenstände wird übersprungen.");
            } else {
                if (GM_getValue("gegenstaendeablegen", 1) == 2) {
                    GM_setValue("ausruestungsschritt_" + held, 1);
                    GM_setValue("restueberspringen_" + held, true);
                    restueberspringen = true;
                    ergeignisHinzufuegen(false, "Das Ablegen der aktuell getragenen Gegenstände wird automatisch durchgeführt.");
                    alleGegenstaendeAblegen();
                } else {
                    GM_setValue("ausruestungsschritt_" + held, 0);
                    ausruestungsmenueEinblenden(0);
                }
            }
        }
        if (GM_getValue("ausruestungsschritt_" + held, -2) >= 1 && GM_getValue("restueberspringen_" + held, true) == false) {
            var gewaehltesprofil = GM_getValue("gewaehltesprofil_" + held, 0);
            var schrittegenutzt = GM_getValue("profil_" + held + "_" + gewaehltesprofil + "_genutzteschritte", -1);
            if (schrittegenutzt == 1 && GM_getValue("ausruestungsschritt_" + held, -2) == 1) {
                ergeignisHinzufuegen(false, "Gegenstände mit Anlegeschritt 1 werden ausgerüstet.");
                GM_setValue("ausruestungsschritt_" + held, -1);
                ergeignisHinzufuegen(false, "Das Ausrüsten wurde abgeschlossen.");
                ladenSimplermodus(GM_getValue("gewaehltesprofil_" + held, 0), 1);
            } else {
                ausruestungsmenueEinblenden(GM_getValue("ausruestungsschritt_" + held, -2));
            }
        } else {
            if (GM_getValue("ausruestungsschritt_" + held, -2) == 1 && GM_getValue("restueberspringen_" + held, true) == true && restueberspringen == false) {
                ausruestungsmenueEinblenden(GM_getValue("ausruestungsschritt_" + held, -2));
            }
        }
        if (GM_getValue("restueberspringen_" + held, true) == true && restueberspringen == false) {
            GM_setValue("restueberspringen_" + held, false);
        }
    } else {
        ausruestungsSchrittBeenden();
        ergeignisHinzufuegen(true, "Der Ausrüstungsvorgang wird abgebrochen, da sie inzwischen einen überfüllten Rucksack besitzen. Bitte ein paar Gegenstände wegwerfen und dann das Ausrüsten erneut starten.");
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Entfernt das " (Standard)", " (Nächster Dungeon)", "(Standard,Nächster Dungeon)", ,"(Standard,Nächster Dungeon, Duelle)", "(Standard,Duelle)" und " (Duelle)" aus dem Konfignamen und gibt diesen aus
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function konfigNameBereinigen(konfigname) {
    var neuername = "";
    if (konfigname.search(/.+\(Standard\)$/) != -1) {
        neuername = konfigname.substring(0, konfigname.length - 11);
    } else {
        if (konfigname.search(/.+\(Nächster Dungeon\)$/) != -1) {
            neuername = konfigname.substring(0, konfigname.length - 19);
        } else {
            if (konfigname.search(/.+\(Duelle\)$/) != -1) {
                neuername = konfigname.substring(0, konfigname.length - 9);
            } else {
                if (konfigname.search(/.+\(Standard,Nächster Dungeon\)$/) != -1) {
                    neuername = konfigname.substring(0, konfigname.length - 28);
                } else {
                    if (konfigname.search(/.+\(Standard,Duelle\)$/) != -1) {
                        neuername = konfigname.substring(0, konfigname.length - 18);
                    } else {
                        if (konfigname.search(/.+\(Nächster Dungeon,Duelle\)$/) != -1) {
                            neuername = konfigname.substring(0, konfigname.length - 26);
                        } else {
                            if (konfigname.search(/.+\(Standard,Nächster Dungeon,Duelle\)$/) != -1) {
                                neuername = konfigname.substring(0, konfigname.length - 35);
                            } else {
                                neuername = konfigname;
                            }
                        }
                    }
                }
            }
        }
    }
    return neuername;
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Prüft, ob für die ausgewählte Konfig ein Profil gespeichert ist und wählt dieses ggf. aus
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function profilZurKonfigAuswaehlen() {
    var konfigdropdown = document.getElementById("konfigdropdown");
    var profildropdown = document.getElementById("profildropdown");
    var ausgewaehlterkonfigname = konfigNameBereinigen(konfigdropdown.options[konfigdropdown.selectedIndex].text);
    var verknuepfunggefunden = false;
    for (var profilslot = 1; profilslot <= 21; profilslot++) {
        var allekonfigs = GM_getValue("profil_" + held + "_" + profilslot + "_verknuepftekonfig", "nicht vorhanden");
        if (allekonfigs != "nicht vorhanden") {
            var konfig = allekonfigs.split("#konfigende#");
            for (var ikonfig = 0; ikonfig < konfig.length; ikonfig++) {
                if (konfig[ikonfig] == ausgewaehlterkonfigname) {
                    verknuepfunggefunden = true;
                    var profilname = GM_getValue("profil_" + held + "_" + profilslot + "_profilname", "nicht vorhanden");
                    for (var ioption = 1; ioption < profildropdown.length; ioption++) {
                        if (profildropdown.options[ioption].text == profilname) {
                            profildropdown.selectedIndex = ioption;
                            break;
                        }
                    }
                    break;
                }
            }
            if (verknuepfunggefunden == true) {
                break;
            }
        }
    }
    if (verknuepfunggefunden == false) {
        profildropdown.selectedIndex = 0;
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Erstellt einen String mit XML, der alle Variablen der 20 Profile des übergebenen Helden enthält
//Erwartet: Die ID des Helden(Integer), dessen Profile xportiert werden sollen
//Gibt aus: String mit XML für späteren Import
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function profileEinesHeldenExportieren(heldenid) {
    var alleschluessel = GM_listValues();
    alert(alleschluessel);
    var fehler = false;
    alleschluessel.sort(function (a, b) {
        return a.toLowerCase() - b.toLowerCase()
    });
    var zeilenumbruch = "\n";
    var exportstring = '    <held id="' + heldenid + '">' + zeilenumbruch;
    for (var ischluessel = 0; ischluessel < alleschluessel.length; ischluessel++) {
        var regexpstring = new RegExp('^profil_' + heldenid + '_.?');
        if (alleschluessel[ischluessel].search(regexpstring) != -1) {
            var wert = GM_getValue(alleschluessel[ischluessel], "leere Variable");
            switch (typeof wert) {
                case "number":
                    if (wert.toString().search(/\./) != -1) {
                        var werttyp = "Float";
                        var wertalsstring = wert.toString();
                    } else {
                        var werttyp = "Integer";
                        var wertalsstring = wert.toString();
                    }
                    break;
                case "boolean":
                    var werttyp = "Boolean";
                    if (wert == true) {
                        var wertalsstring = "true";
                    } else {
                        var wertalsstring = "false";
                    }
                    break;
                case "string":
                    var werttyp = "String";
                    var wertalsstring = wert;
                    break;
                default:
                    fehler = true;
                    var werttyp = "Fehler";
                    var wertalsstring = "Fehler";
                    break;
            }
            exportstring += '      <variable>' + zeilenumbruch +
                '        <schluessel>' + alleschluessel[ischluessel] + '</schluessel>' + zeilenumbruch +
                '        <wert typ="' + werttyp + '">' + wertalsstring + '</wert>' + zeilenumbruch +
                '      </variable>' + zeilenumbruch;
        }
    }
    exportstring += '    </held>' + zeilenumbruch;
    if (fehler == true) {
        alert("Fehler: Mindestens eine Variable konnte nicht ausgelesen werden!");
    }
    return exportstring;
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Erstellt einen String mit XML, der alle Variablen enthält, die nicht mit "profil" anfangen
//Erwartet: -
//Gibt aus: String mit XML für späteren Import
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function einstellungenExportieren() {
    var alleschluessel = GM_listValues();
    var fehler = false;
    alleschluessel.sort(function (a, b) {
        return a.toLowerCase() - b.toLowerCase()
    });
    var zeilenumbruch = "\n";
    var exportstring = '  <einstellungen>' + zeilenumbruch;
    for (var ischluessel = 0; ischluessel < alleschluessel.length; ischluessel++) {
        if (alleschluessel[ischluessel].search(/^profil_.+?/) == -1) {
            var wert = GM_getValue(alleschluessel[ischluessel], "leere Variable");
            switch (typeof wert) {
                case "number":
                    if (wert.toString().search(/\./) != -1) {
                        var werttyp = "Float";
                        var wertalsstring = wert.toString();
                    } else {
                        var werttyp = "Integer";
                        var wertalsstring = wert.toString();
                    }
                    break;
                case "boolean":
                    var werttyp = "Boolean";
                    if (wert == true) {
                        var wertalsstring = "true";
                    } else {
                        var wertalsstring = "false";
                    }
                    break;
                case "string":
                    var werttyp = "String";
                    var wertalsstring = wert;
                    break;
                default:
                    fehler = true;
                    var werttyp = "Fehler";
                    var wertalsstring = "Fehler";
                    break;
            }
            exportstring += '    <variable>' + zeilenumbruch +
                '      <schluessel>' + alleschluessel[ischluessel] + '</schluessel>' + zeilenumbruch +
                '      <wert typ="' + werttyp + '">' + wertalsstring + '</wert>' + zeilenumbruch +
                '    </variable>' + zeilenumbruch;
        }
    }
    exportstring += '  </einstellungen>' + zeilenumbruch;
    if (fehler == true) {
        alert("Fehler: Mindestens eine Variable konnte nicht ausgelesen werden!");
    }
    return exportstring;
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Erstellt einen String mit XML, der alle Variablen der 20 Profile des übergebenen Helden enthält
//Erwartet: Die ID des Helden(Integer), dessen Profile xportiert werden sollen
//Gibt aus: String mit XML für späteren Import
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function exportieren(einstellungenexportieren, onlinespeichern, zuexportierendehelden) {
    var zeilenumbruch = "\n";
    //XML-Kopf erstellen
    var exportstring = '<ausruesterxml>' + zeilenumbruch;
    exportstring += '  <kopf>' + zeilenumbruch;
    exportstring += '    <datum>' + aktuellesDatum() + '</datum>' + zeilenumbruch;
    exportstring += '    <version>' + aktuelleversion + '</version>' + zeilenumbruch;
    exportstring += '    <einstellungenvorhanden>' + einstellungenexportieren + '</einstellungenvorhanden>' + zeilenumbruch;
    exportstring += '    <heldenliste>' + zeilenumbruch;
    for (var i = 0; i < zuexportierendehelden.length; i++) {
        exportstring += '      <heldeneintrag>' + zeilenumbruch;
        var allehelden = heldenLaden();
        for (var ii = 0; ii < allehelden.length; ii++) {
            if (allehelden[ii]["id"] == zuexportierendehelden[i]) {
                exportstring += '        <id>' + allehelden[ii]["id"] + '</id>' + zeilenumbruch;
                exportstring += '        <name>' + allehelden[ii]["name"] + '</name>' + zeilenumbruch;
                exportstring += '        <welt>' + allehelden[ii]["welt"] + '</welt>' + zeilenumbruch;
                break;
            }
        }
        exportstring += '      </heldeneintrag>' + zeilenumbruch;
    }
    exportstring += '    </heldenliste>' + zeilenumbruch;
    exportstring += '  </kopf>' + zeilenumbruch;
    //Einstellungen exportieren
    if (einstellungenexportieren == true) {
        exportstring += einstellungenExportieren();
    }
    //Heldenprofile exportieren
    if (zuexportierendehelden.length >= 1) {
        exportstring += '  <profile>' + zeilenumbruch;
    }
    for (var iexport = 0; iexport < zuexportierendehelden.length; iexport++) {
        exportstring += profileEinesHeldenExportieren(zuexportierendehelden[iexport]);
    }
    if (zuexportierendehelden.length >= 1) {
        exportstring += '  </profile>' + zeilenumbruch;
    }
    exportstring += '</ausruesterxml>';
    //Onlinespeichern
    if (onlinespeichern == true) {
        GM_xmlhttpRequest({
            method: "POST",
            url: "http://www.stumpenhagen.net/bm/dunuins_wod_scripte/ausruester/transfer.php",
            data: "exportxml=" + escape(exportstring),
            headers: {
                "User-agent": "Ausruester",
                "Connection": "close",
                "Content-length": "1",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            onload: function (response) {
                if (response.responseText.indexOf("<zugriffscode>") > -1) {
                    alert('Der Export-XML-Code wurde erfolgreich online gespeichert.\n\nGebe im Importmenü des Ausrüsters unter "Zugriffscode" folgendes ein, um den XML-Code herunterzuladen:\n\n' + response.responseText + '\n\nDer Export-XML-Code ist ab jetzt nur noch 24 Stunden online verfügbar.');
                } else {
                    alert('Der Export-XML-Code konnte nicht online gespeichert werden!');
                }
            }
        });
    }
    return exportstring;
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Erstellt das Exportfenster und blendet es ein
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function exportfensterAnzeigen() {
    abdunklungsEbeneAnzeigen();
    //alert("exportfensterAnzeigen");
    var ersteselement = document.getElementsByTagName("BODY")[0].firstChild;
    var exportfenster = document.createElement("div");
    var exportfensterhoehe = 400;
    var exportfensterbreite = 600;
    var hoehedesanzeigebereichs = window.innerHeight;
    var breitedesanzeigebereichs = window.innerWidth;
    var abstandoben = hoehedesanzeigebereichs - exportfensterhoehe;
    if (abstandoben <= 1) {
        abstandoben = 2;
    }
    var abstandoben = Math.round(abstandoben / 2);
    var abstandlinks = breitedesanzeigebereichs - exportfensterbreite;
    if (abstandlinks <= 1) {
        abstandlinks = 2;
    }
    abstandlinks = Math.round(abstandlinks / 2);
    exportfenster.id = "exportfenster";
    exportfenster.style.visibility = "visible";
    //Heldenliste laden
    var heldenlistenstring = "";
    var heldenarray = heldenLaden();
    if (heldenarray === false) {
        heldenlistenstring = '<option value="-1">Keine Helden gefunden</option>';
    } else {
        for (var iheld = 0; iheld < heldenarray.length; iheld++) {
            heldenlistenstring += '<option value="' + heldenarray[iheld]["id"] + '">' + heldenarray[iheld]["name"].substr(0, 20) + '@' + heldenarray[iheld]["welt"].substr(0, 2) + '</option>';
        }
    }
    exportfenster.innerHTML = '<div style="width: ' + exportfensterbreite + 'px; height: ' + exportfensterhoehe + 'px; background-color:#FECD38; padding-top:10px; padding-bottom; 10px; border: 2px; border-bottom-color:#F98F02; border-right-color:#F98F02; border-top-color:#FDF780; border-left-color:#FDF780; border-style:solid; text-align:center; vertical-align: middle; position: fixed; z-index: 101; top: ' + abstandoben + 'px; left: ' + abstandlinks + 'px; color: #000000;">' +
        '<h1 style="color: #000000;">Exportierung</h1>' +
        '<table width="95%" border="0" cellspacing="0" cellpadding="0" align="center">' +
        '	<tr>' +
        '		<td><div align="left"><strong>Profile von folgenden Helden exportieren:</strong><br />' +
        '			<span style="font-size: smaller;">(STRG/UMSCHALT für Mehrfachauswahl)</span></div></td>' +
        '		<td><select name="exportheldenliste" id="exportheldenliste" size="3" multiple="multiple">' +
        '			' + heldenlistenstring +
        '			</select></td>' +
        '	</tr>' +
        '	<tr>' +
        '		<td><div align="left"><strong>Einstellungen exportieren:</strong></div></td>' +
        '		<td><input type="radio" name="einstellungenexportieren" id="einstellungenexportieren_1" value="1" />ja  ;  <input type="radio" name="einstellungenexportieren" id="einstellungenexportieren_0" value="0" checked="checked" />nein</td>' +
        '	</tr>' +
        '	<tr>' +
        '		<td><div align="left"><strong>Für 24 Stunden online speichern:</strong></div></td>' +
        '		<td><input type="radio" name="onlinespeicherung" id="onlinespeicherung_1" value="1" />ja  ;  <input type="radio" name="onlinespeicherung" id="onlinespeicherung_0" value="0" checked="checked"/>nein</td>' +
        '	</tr>' +
        '	<tr>' +
        '		<td colspan="2"><div align="center"><input type="button" name="exportabbrechenknopf" id="exportabbrechenknopf" value="Schließen" />&nbsp;&nbsp;&nbsp;<input type="button" name="exportierenokknopf" id="exportierenokknopf" value="Exportieren" /></div></td>' +
        '	</tr>' +
        '</table>' +
        '<p><textarea name="exporttextfeld" id="exporttextfeld" cols="45" rows="10" style="width: 95%;"></textarea></p>' +
        '</div>';
    ersteselement.parentNode.insertBefore(exportfenster, ersteselement);
    var exportabbrechenknopf = document.getElementById("exportabbrechenknopf");
    exportabbrechenknopf.addEventListener("click", function (e) {
        //Schließen
        var exportfenster = document.getElementById("exportfenster");
        exportfenster.parentNode.removeChild(exportfenster);
        abdunklungsEbeneAusblenden();
    }, false);
    var exportierenokknopf = document.getElementById("exportierenokknopf");
    exportierenokknopf.addEventListener("click", function (e) {
        //Exportieren
        var einstellungenexportierung1 = document.getElementById("einstellungenexportieren_1");
        if (einstellungenexportierung1.checked == true) {
            var einstellungenexportieren = true;
        } else {
            var einstellungenexportieren = false;
        }
        var onlinespeicherung0 = document.getElementById("onlinespeicherung_1");
        if (onlinespeicherung0.checked == true) {
            var onlinespeichern = true;
        } else {
            var onlinespeichern = false;
        }
        var exportheldenliste = document.getElementById("exportheldenliste");
        var zuexportierendehelden = new Array();
        for (var i = 0; i < exportheldenliste.length; i++) {
            if (exportheldenliste.options[i].selected == true && parseInt(exportheldenliste.options[i].value) != -1) {
                zuexportierendehelden.push(parseInt(exportheldenliste.options[i].value));
            }
        }
        var exportxml = exportieren(einstellungenexportieren, onlinespeichern, zuexportierendehelden);
        var exporttextfeld = document.getElementById("exporttextfeld");
        exporttextfeld.value = exportxml;
        //exporttextfeld.focus();
        //exporttextfeld.select();
    }, false);
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Importiert die Variablen, die in dem, über IMPORTXML übergebenen, XML-Code gespeichert wird. Dabei werden nur die Profilvariablen von den Helden Importiert, dessen Heldennummern über das Array HELDENIMPORTLISTE übergeben wurden und es werden nur die Einstellungen importiert, wenn EINSTELLUNGEN true ist.
//Erwartet: String mit XML-Code, true oder false und ein Integerarray mit HeldenIDs
//Gibt aus: false bei Fehler, sonst true
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function importieren(importxml, einstellungen, heldenimportliste) {
    var zeilenumbruch = "\n";
    var importstring = importxml.replace(/\n/g, " ");
    var allesok = true;
    var meldungen = "";
    var importstringtemp = "";
    //AusrüsterXML-Tags und Kopf entfernen
    importstringtemp = importstring;
    importstring = importstring.replace(/\s*\<ausruesterxml\>.+?\<kopf\>.+?\<datum\>(.+?)\<\/datum\>.+?\<version\>(.+?)\<\/version\>.+?\<\/kopf\>(.+?)\<\/ausruesterxml\>\s*/, "");
    if (importstring != importstringtemp) {
        var xmldatum = RegExp.$1;
        var xmlversion = RegExp.$2;
        var xmlkoerper = RegExp.$3;
        //Bestätigung einholen
        var eingabe = confirm("Erstellt mit: Ausrüster " + xmlversion + "\nAm: " + xmldatum + "\n\nWollen sie wirklich die ausgewählten Profile und Einstellungen Importieren?\nBereits vorhandene Daten werden dabei ggf. überschrieben.");
        if (eingabe == true) {
            //Einstellungen erfassen
            var einstellungsarray = new Array();
            if (einstellungen == true) {
                importstringtemp = xmlkoerper;
                xmlkoerper = xmlkoerper.replace(/\s*\<einstellungen\>(.+?)\<\/einstellungen\>\s*/, "");
                if (xmlkoerper != importstringtemp) {
                    var einstellungsstring = RegExp.$1;
                    while (einstellungsstring.search(/\s*\<variable\>.+?\<schluessel\>.+?\<\/schluessel\>.+?\<wert typ=".+?"\>.+?\<\/wert\>.+?\<\/variable\>\s*/) != -1) {
                        importstringtemp = einstellungsstring;
                        einstellungsstring = einstellungsstring.replace(/\s*\<variable\>.+?\<schluessel\>(.+?)\<\/schluessel\>.+?\<wert typ="(.+?)"\>(.+?)\<\/wert\>.+?\<\/variable\>\s*/, "");
                        if (einstellungsstring != importstringtemp) {
                            var subarray = new Object();
                            subarray['schluessel'] = RegExp.$1;
                            var werttyp = RegExp.$2;
                            var wert = RegExp.$3;
                            switch (werttyp) {
                                case "Float":
                                    wert = parseFloat(wert);
                                    break;
                                case "Integer":
                                    wert = parseInt(wert);
                                    break;
                                case "Boolean":
                                    if (wert == "true") {
                                        wert = true;
                                    } else {
                                        wert = false;
                                    }
                                    break;
                                case "String":
                                    break;
                                default:
                                    //alert("Werttyp nicht erkannt: "+werttyp+";"+wert);
                                    allesok = false;
                                    var wert = "!Fehler!";
                                    break;
                            }
                            subarray['wert'] = wert;
                            if (wert != "!Fehler!") {
                                einstellungsarray.push(subarray);
                            }
                        }
                    }
                } else {
                    allesok = false;
                    meldungen += "Fehler: Die Einstellungen konnten nicht importiert werden, da der <einstellungen>-Bereich nicht gefunden wurde!\n";
                }
            }
            if (allesok == true) {
                //Helden auslesen
                var heldenvariablenarray = new Array();
                if (heldenimportliste.length > 0) {
                    importstringtemp = xmlkoerper;
                    xmlkoerper = xmlkoerper.replace(/\s*\<profile\>(.+?)\<\/profile\>\s*/, "");
                    if (xmlkoerper != importstringtemp) {
                        //alert("vor schleife 1");
                        var profilstring = RegExp.$1;
                        var heldenimportlistetemp = heldenimportliste;
                        while (profilstring.search(/\<held id="\d+"\>.+?\<\/held\>/) != -1 && allesok == true) {
                            //alert("in schleife 1");
                            profilstring = profilstring.replace(/\<held id="(\d+)"\>(.+?)\<\/held\>/, "");
                            var heldenid = RegExp.$1;
                            var heldenvariablenstring = RegExp.$2;
                            var heldgefunden = false;
                            for (var i = heldenimportlistetemp.length - 1; i >= 0; i--) {
                                //alert("in schleife 2");
                                if (parseInt(heldenid) == heldenimportlistetemp[i]) {
                                    heldenimportlistetemp.splice(i, 1);
                                    heldgefunden = true;
                                    break;
                                }
                            }
                            if (heldgefunden == true) {
                                while (heldenvariablenstring.search(/\<variable\>.+?\<schluessel\>.+?\<\/schluessel\>.+?\<wert typ=".+?"\>.+?\<\/wert\>.+?\<\/variable\>/) != -1 && allesok == true) {
                                    //alert("in schleife 3");
                                    heldenvariablenstring = heldenvariablenstring.replace(/\<variable\>.+?\<schluessel\>(.+?)\<\/schluessel\>.+?\<wert typ="(.+?)"\>(.+?)\<\/wert\>.+?\<\/variable\>/, "");
                                    var subarray = new Object();
                                    subarray['schluessel'] = RegExp.$1;
                                    var werttyp = RegExp.$2;
                                    var wert = RegExp.$3;
                                    switch (werttyp) {
                                        case "Float":
                                            wert = parseFloat(wert);
                                            break;
                                        case "Integer":
                                            wert = parseInt(wert);
                                            break;
                                        case "Boolean":
                                            if (wert == "true") {
                                                wert = true;
                                            } else {
                                                wert = false;
                                            }
                                            break;
                                        case "String":
                                            break;
                                        default:
                                            allesok = false;
                                            var wert = "!Fehler!";
                                            alert("Werttyp nicht erkannt: " + werttyp + ";" + wert);
                                            break;
                                    }
                                    subarray['wert'] = wert;
                                    if (wert != "!Fehler!") {
                                        heldenvariablenarray.push(subarray);
                                    } else {
                                        break;
                                    }
                                }
                            }
                        }
                        if (allesok == false) {
                            meldungen += "Fehler: Mindestens eine Variable der Profile konnte nicht identifiziert werden!\n";
                        }
                    } else {
                        allesok = false;
                        meldungen += "Fehler: Der <profile>-Bereich konnte nicht gefunden werden!\n";
                    }
                }
            } else {
                meldungen += "Fehler: Mindestens eine Variable der Einstellungen konnte nicht identifiziert werden!\n";
            }
        } else {
            allesok = false;
            meldungen += "Importierung wurde vom Nutzer abgebrochen!\n";
        }
    } else {
        allesok = false;
        meldungen += "Fehler: Die <ausrüsterxml>-Tags oder der Kopf konnten nicht gefunden werden!\n";
    }
    if (allesok == true) {
        //Alte Profile löschen
        var alleschluessel = GM_listValues();
        alleschluessel.sort(function (a, b) {
            return a.toLowerCase() - b.toLowerCase()
        });
        for (var ischluessel = 0; ischluessel < alleschluessel.length; ischluessel++) {
            for (var i = 0; i < heldenimportliste.length; i++) {
                var profilsucheregexp = new RegExp("^profil_" + heldenimportliste[i] + "_.+?");
                if (alleschluessel[ischluessel].search(profilsucheregexp) == -1) {
                    GM_deleteValue(alleschluessel[ischluessel]);
                    break;
                }
            }
        }
        //Importierte Einstellungsvariablen speichern
        for (var i = 0; i < einstellungsarray.length; i++) {
            GM_setValue(einstellungsarray[i]['schluessel'], einstellungsarray[i]['wert']);
        }
        //Importierte Profilvariablen speichern
        for (var i = 0; i < heldenvariablenarray.length; i++) {
            GM_setValue(heldenvariablenarray[i]['schluessel'], heldenvariablenarray[i]['wert']);
        }
        meldungen += "Das Importieren wurde erfolgreich abgeschlossen!\n";
    }
    alert(meldungen);


    //Test
    //alert(meldungen);
    //alert(allesok);
    //if(heldenvariablenarray.length == 0){
    //	alert("Fehler beim Laden der ProfilListe");
    //}else{
    //	var teststring2 = "";
    //	for(var i = 0; i < heldenvariablenarray.length; i++){
    //		teststring2 += "("+heldenvariablenarray[i]["schluessel"]+"|"+heldenvariablenarray[i]["wert"]+");\n";
    //	}
    //	alert(teststring2);
    //}
    //if(einstellungsarray.length == 0 || einstellungsarray == false){
    //	alert("Fehler beim Laden der EinstellungsListe");
    //}else{
    //	var teststring2 = "";
    //	for(var i = 0; i < einstellungsarray.length; i++){
    //		teststring2 += "("+einstellungsarray[i]["schluessel"]+"|"+einstellungsarray[i]["wert"]+");\n";
    //	}
    //	alert(teststring2);
    //}
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Prüft, ob der XML-Code vollständig zu sein scheint, sucht nach dem Kopf, wertet diesen aus und setzt dem entsprechnd die Optionen im Importfenster
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function xmlKopfAuslesenUndElementeSetzen() {
    var zeilenumbruch = "\n";
    var fehler = false;
    var importierbarkeit = false;
    var importtextfeld = document.getElementById("importtextfeld");
    var xml = importtextfeld.value.replace(/\n/g, " ");
    //Prüfen ob der XML-Code OK zu sein scheint
    if (xml.search(/\s*\<ausruesterxml\>.+?\<kopf\>(.+?)\<\/kopf\>.+?\<\/ausruesterxml\>\s*/) != -1) {
        var kopfinhalt = RegExp.$1;
        //Datum, Version, Heldenliste und ob Einstellungen gespeichert wurden herauslesen
        if (kopfinhalt.search(/\<datum\>(.+?)\<\/datum\>.+?\<version\>(.+?)\<\/version\>.+?\<einstellungenvorhanden\>(.+?)\<\/einstellungenvorhanden\>.+?\<heldenliste\>(.+?)\<\/heldenliste\>/) != -1) {
            var xmldatum = RegExp.$1;
            var xmlversion = RegExp.$2;
            var xmleinstellungenvorhanden = RegExp.$3;
            var xmlheldenliste = RegExp.$4;
            if (1 == 1) { //Platzhalter für Versionsüberpruefung
                //Einstellungs-Optionsschalter einblenden
                if (xmleinstellungenvorhanden == "true") {
                    importierbarkeit = true;
                    var importzeile3 = document.getElementById("importzeile3");
                    importzeile3.style.visibility = "visible";
                } else {
                    var importzeile3 = document.getElementById("importzeile3");
                    importzeile3.style.visibility = "collapse";
                }
                //Heldenliste erstellen
                var importheldenliste = document.getElementById("importheldenliste");
                while (importheldenliste.length > 0) {
                    importheldenliste.options[importheldenliste.length - 1] = null;
                }
                while (xmlheldenliste.search(/\<heldeneintrag\>.+?\<id\>\d+\<\/id\>.+?\<name\>.+?\<\/name\>.+?\<welt\>.+?\<\/welt\>.+?\<\/heldeneintrag\>/) != -1) {
                    var xmlheldenlistetemp = xmlheldenliste;
                    var xmlheldenliste = xmlheldenliste.replace(/\<heldeneintrag\>.+?\<id\>(\d+)\<\/id\>.+?\<name\>(.+?)\<\/name\>.+?\<welt\>(.+?)\<\/welt\>.+?\<\/heldeneintrag\>/, "");
                    if (xmlheldenliste != xmlheldenlistetemp) {
                        var heldenid = RegExp.$1;
                        var heldenname = RegExp.$2;
                        var heldenwelt = RegExp.$3;
                        var neueoption = document.createElement("OPTION");
                        neueoption.value = parseInt(heldenid);
                        neueoption.text = heldenname.substr(0, 19) + "@" + heldenwelt.substr(0, 2);
                        importheldenliste.appendChild(neueoption);
                    } else {
                        importtextfeld.value = "Fehler: Die Heldenliste konnte nicht erstellt werden!";
                        fehler = true;
                        break;
                    }
                }
                if (fehler == false) {
                    var importzeile1 = document.getElementById("importzeile1");
                    importzeile1.style.visibility = "visible";
                    var importzeile2 = document.getElementById("importzeile2");
                    importzeile2.style.visibility = "visible";
                    var importzeile4 = document.getElementById("importzeile4");
                    importzeile4.style.visibility = "visible";
                }
            } else {
                importtextfeld.value = "Fehler: Dieser Ausrüster-XML-Code ist nicht mehr mit der aktuellen Ausrüster-Version kompatibel!";
                fehler = true;
            }
        } else {
            importtextfeld.value = "Fehler: Der Kopfteil des Ausrüster-XML-Codes konnte nicht gelesen werden!";
            fehler = true;
        }
    } else {
        importtextfeld.value = "Fehler: Der Ausrüster-XML-Code ist nicht vollständig!";
        fehler = true;
    }
    //Bei Fehler alle Optionen ausblenden
    if (fehler == true) {
        var importzeile1 = document.getElementById("importzeile1");
        importzeile1.style.visibility = "collapse";
        var importzeile2 = document.getElementById("importzeile2");
        importzeile2.style.visibility = "collapse";
        var importzeile3 = document.getElementById("importzeile3");
        importzeile3.style.visibility = "collapse";
        var importzeile4 = document.getElementById("importzeile4");
        importzeile4.style.visibility = "collapse";
    }
}

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Erstellt das Importfenster und blendet es ein
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function importfensterAnzeigen() {
    abdunklungsEbeneAnzeigen();
    var ersteselement = document.getElementsByTagName("BODY")[0].firstChild;
    var importfenster = document.createElement("div");
    var importfensterhoehe = 400;
    var importfensterbreite = 600;
    var hoehedesanzeigebereichs = window.innerHeight;
    var breitedesanzeigebereichs = window.innerWidth;
    var abstandoben = hoehedesanzeigebereichs - importfensterhoehe;
    if (abstandoben <= 1) {
        abstandoben = 2;
    }
    var abstandoben = Math.round(abstandoben / 2);
    var abstandlinks = breitedesanzeigebereichs - importfensterbreite;
    if (abstandlinks <= 1) {
        abstandlinks = 2;
    }
    abstandlinks = Math.round(abstandlinks / 2);
    importfenster.id = "importfenster";
    importfenster.style.visibility = "visible";
    importfenster.innerHTML = '<div style="width: ' + importfensterbreite + 'px; height: ' + importfensterhoehe + 'px; background-color:#FECD38; padding-top:10px; padding-bottom; 10px; border: 2px; border-bottom-color:#F98F02; border-right-color:#F98F02; border-top-color:#FDF780; border-left-color:#FDF780; border-style:solid; text-align:center; vertical-align: middle; position: fixed; z-index: 101; top: ' + abstandoben + 'px; left: ' + abstandlinks + 'px; color: #000000;">' +
        '<h1 style="color: #000000;">Importierung</h1>' +
        '<p style="font-size: large; padding-left: 15px" align="left"><strong>Schritt 1: XML einlesen</strong></p>' +
        '<p><textarea name="importtextfeld" id="importtextfeld" cols="45" rows="3" style="width: 95%;">Bitte hier den kompletten  Ausrüster-XML-Code (&lt;ausruesterxml&gt;...&lt;/ausruesterxml&gt;) oder Zugriffscode (&lt;zugriffscode&gt;...&lt;/zugriffscode&gt;) eingeben und auf den Einlesen-Knopf klicken.</textarea></p>' +
        '<div align="center"><input type="button" name="xmleinlesenknopf" id="xmleinlesenknopf" value="Einlesen" /></div>' +
        '<table width="95%" border="0" cellspacing="0" cellpadding="0" align="center">' +
        '	<tr id="importzeile1" style="visibility: collapse;">' +
        '		<td colspan="2" style="font-size: large; "><div align="left"><strong>Schritt 2: Importierung</strong></div></td>' +
        '	</tr>' +
        '	<tr id="importzeile2" style="visibility: collapse;">' +
        '		<td><div align="left"><strong>Profile von folgenden Helden importieren:</strong><br />' +
        '			<span style="font-size: smaller;">(STRG/UMSCHALT für Mehrfachauswahl)</span></div></td>' +
        '		<td><select name="importheldenliste" id="importheldenliste" size="3" multiple="multiple">' +
        '			   <option value="-1">erst XML einlesen</option>' +
        '			</select></td>' +
        '	</tr>' +
        '	<tr id="importzeile3" style="visibility: collapse;">' +
        '		<td><div align="left"><strong>Einstellungen importieren:</strong></div></td>' +
        '		<td><input type="radio" name="einstellungenimportieren" id="einstellungenimportieren_1" value="1" />ja  ;  <input type="radio" name="einstellungenimportieren" id="einstellungenimportieren_0" value="0" checked="checked" />nein</td>' +
        '	</tr>' +
        '	<tr id="importzeile4" style="visibility: collapse;">' +
        '		<td colspan="2"><div align="center"><input type="button" name="importierenokknopf" id="importierenokknopf" value="Importieren"/></div></td>' +
        '	</tr>' +
        '</table>' +
        '<div align="center"><input type="button" name="importabbrechenknopf" id="importabbrechenknopf" value="Schließen" /></div>' +
        '</div>';
    ersteselement.parentNode.insertBefore(importfenster, ersteselement);
    var importabbrechenknopf = document.getElementById("importabbrechenknopf");
    importabbrechenknopf.addEventListener("click", function (e) {
        //Schließen
        var importfenster = document.getElementById("importfenster");
        importfenster.parentNode.removeChild(importfenster);
        abdunklungsEbeneAusblenden();
    }, false);
    var importtextfeld = document.getElementById("importtextfeld");
    importtextfeld.addEventListener("click", function (e) {
        //Starttext löschen
        if (importtextfeld.value.search(/Bitte hier den kompletten/) != -1) {
            importtextfeld.value = "";
        }
    }, false);
    var xmleinlesenknopf = document.getElementById("xmleinlesenknopf");
    xmleinlesenknopf.addEventListener("click", function (e) {
        //XML einlesen
        //Prüfen ob ein gültiger Zugriffscode eingegeben wurde
        var importtextfeld = document.getElementById("importtextfeld");
        if (importtextfeld.value.search(/^\s*\<zugriffscode\>(............)\<\/zugriffscode\>\s*$/) != -1) {
            //XML downloaden
            GM_xmlhttpRequest({
                method: 'GET',
                url: 'http://www.stumpenhagen.net/bm/dunuins_wod_scripte/ausruester/transfer.php?zugriffscode=' + escape(RegExp.$1) + '&timestamp=' + new Date().getTime(),
                headers: {
                    'User-agent': 'Ausruester',
                    'Accept': 'application/atom+xml,application/xml,text/xml',
                    'If-Modified-Since': 'Sat, 1 Jan 2005 00:00:00 GMT'
                },
                onload: function (response) {
                    var importtextfeld = document.getElementById("importtextfeld");
                    if (response.responseText.indexOf("<ausruesterxml>") > -1) {
                        importtextfeld.value = response.responseText;
                        xmlKopfAuslesenUndElementeSetzen();
                    } else {
                        importtextfeld.value = "Fehler: XML konnte nicht heruntergeladen werden!";
                    }
                }
            });
        } else {
            xmlKopfAuslesenUndElementeSetzen();
        }
    }, false);
    var importierenokknopf = document.getElementById("importierenokknopf");
    importierenokknopf.addEventListener("click", function (e) {
        //Importieren starten
        var importtextfeld = document.getElementById("importtextfeld");
        var einstellungenimportieren1 = document.getElementById("einstellungenimportieren_1");
        if (einstellungenimportieren1.checked == true) {
            var einstellungenimportierenwert = true;
        } else {
            var einstellungenimportierenwert = false;
        }
        var importheldenliste = document.getElementById("importheldenliste");
        var importheldenlistearray = new Array();
        for (var i = 0; i < importheldenliste.length; i++) {
            if (importheldenliste.options[i].selected == true) {
                importheldenlistearray.push(parseInt(importheldenliste.options[i].value));
            }
        }
        importieren(importtextfeld.value, einstellungenimportierenwert, importheldenlistearray);
    }, false);
}

//###########################################################################################################################################################
//###################################################################### Hauptprogramm ######################################################################
//###########################################################################################################################################################

//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Die Hauptfunktion die alles auf der Ausr+stungsseite steuert.
//Erwartet: boolean (true = Seite wurde über Navi betreten)
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function mainAusruestung(neubetreten) {
    //Allgemeines
    warteEbeneAnzeigen();
    patchen();
    erststartPruefenUndDurchfuehren(); //Prüfen ob es sich um den 1. Start des Lagertools handelt und ggf. GM-Variablen setzen
    individuellenErststartPruefenUndDurchfuehren();
    tabellenIdsVergeben();
    aufUpdatePruefen(aktuelleversion); //Nach Updates prüfen und ggf. Warnung anzeigen
    hauptNaviEinblenden(); //Navibalken einblenden
    profildropdownAktualisieren();
    profiOptionenHinzufuegen(); //Profioptionen unsichtbar hinzufügen
    //Protokoll leeren falls Autolöschung aktiv
    if (GM_getValue("protokollautoloeschung", false) == true && neubetreten == true) {
        ergeignisSpeicherLoeschen();
    }
    //in den Expertenmodus gehen falls eingestellt
    if (GM_getValue("expertenmodus_" + held, false) == false) {
        expertenModusDeaktivieren();
    } else {
        if (pruefenDassNichtZuVieleItemsGefundenWurden() == true) {
            if (GM_getValue("ausruestenvongruppe_" + held, false) == false) {
                expertenModusAktivieren();
            } else {
                expertenModusDeaktivieren();
            }
        } else {
            ergeignisHinzufuegen(false, "Sie haben mehr als 10 Gegenstände im Dungeon gefunden und befanden sich im Expertenmodus. Es wird nun in den Simplenmodus gewechselt.");
            expertenModusDeaktivieren();
        }
    }
    //Protokoll einblenden falls Einträge vorhanden
    if (GM_getValue("ereignisliste_" + held, '') != "") {
        var ereignisliste = document.getElementById("ergeignisliste");
        if (ereignisliste == undefined) {
            infoBereichEinblenden();
        }
    }
    //Ladevorgang löschen/fortsetzen
    if (GM_getValue("ausruestungsschritt_" + held, -1) != -1) {
        if (neubetreten == true) {
            //Ladevorgang abbrechen
            ergeignisHinzufuegen(true, "Sie haben die Ausrüstungsseite neu betreten und daher wird der Ausrüstungsvorgang abgebrochen.");
            ausruestungsSchrittBeenden();
        } else {
            if (GM_getValue("expertenmodus_" + held, false) == false) {
                //Ladevorgang weitermachen
                ausruestungsSchrittSteuerung();
            }
        }
    } else {
        if (GM_getValue("ausruestenvongruppe_" + held, false) == false) {
            warteEbeneAusblenden();
        }
    }
    //Ausrüsten von der Gruppenseite wird druchgeführt
    if (GM_getValue("ausruestenvongruppe_" + held, false) == true && GM_getValue("ausruestungsschritt_" + held, -1) == -1) {
        if (pruefenDassNichtZuVieleItemsGefundenWurden() == true) {
            var zielprofil = GM_getValue("ausruestenvongruppe_" + held + "_profilslot", -1);
            GM_setValue("gewaehltesprofil_" + held, zielprofil);
            var profilliste = document.getElementById("profilliste");
            profilliste.selectedIndex = zielprofil;
            GM_setValue("ausruestenvongruppe_" + held, false);
            ausruestungsSchrittSteuerung();
        } else {
            GM_setValue("ausruestenvongruppe_" + held, false);
            ergeignisHinzufuegen(true, "Das Ausrüsten wurde abgebrochen, da sie mehr als 10 Gegenstände im Rucksack haben.");
        }
        warteEbeneAusblenden();
    }
    initialisiert = true;
}


//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Die Hauptfunktion die alles auf der Gruppenseite steuert.
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function mainGruppe() {
    warteEbeneAnzeigen();
    patchen();
    erststartPruefenUndDurchfuehren();
    individuellenErststartPruefenUndDurchfuehren();
    aufUpdatePruefen(aktuelleversion);
    var konfigdropdown = document.getElementsByName("config[" + held + "]")[0];
    if (konfigdropdown != undefined) {
        konfigdropdown.id = "konfigdropdown";
        var profildropdown = document.createElement("SELECT");
        profildropdown.id = "profildropdown";
        var neueoption = document.createElement("OPTION");
        neueoption.value = 0;
        neueoption.text = "kein verknüpftes Profil";
        neueoption.id = "profildropdown_0";
        neueoption.selected = true;
        profildropdown.appendChild(neueoption);
        for (var profilslot = 1; profilslot <= 21; profilslot++) {
            var proilname = GM_getValue("profil_" + held + "_" + profilslot + "_profilname", "nicht vorhanden");
            if (proilname != "nicht vorhanden") {
                var neueoption = document.createElement("OPTION");
                neueoption.value = profilslot;
                neueoption.text = proilname;
                neueoption.id = "profildropdown_" + profilslot;
                neueoption.selected = false;
                profildropdown.appendChild(neueoption);
            }
        }
        konfigdropdown.parentNode.parentNode.insertBefore(profildropdown, konfigdropdown.parentNode.nextSibling);
        var verknuepfenknopf = document.createElement("INPUT");
        verknuepfenknopf.type = "button";
        verknuepfenknopf.name = "verknuepfenknopf";
        verknuepfenknopf.id = "verknuepfenknopf";
        verknuepfenknopf.value = "√";
        verknuepfenknopf.className = "button";
        profildropdown.parentNode.insertBefore(verknuepfenknopf, profildropdown.nextSibling);
        var ausruestenknopf = document.createElement("INPUT");
        ausruestenknopf.type = "button";
        ausruestenknopf.name = "ausruestenknopf";
        ausruestenknopf.id = "ausruestenknopf";
        ausruestenknopf.value = "Ausrüsten";
        ausruestenknopf.className = "button";
        //<input type="button" name="ausruestenbutton" id="expertenmodusknopf" value="+" class="button"/>
        verknuepfenknopf.parentNode.insertBefore(ausruestenknopf, verknuepfenknopf.nextSibling);
        var infodiv = document.createElement("SPAN");
        infodiv.innerHTML = '<img alt="" src="http://www.stumpenhagen.net/bm/dunuins_wod_scripte/ausruester/inf.gif" border="0" id="___wodToolTip_UniqueId__9997" onmouseover="return wodToolTip(this,\'' +
            'Mit einem Klick auf den Ausrüsten-Knopf gelangt man direkt auf die Ausrüstungsseite, wo das Profil geladen wird,' +
            'welches man hier in dem Dropdown, mit den Ausrüstungsprofilen, gewählt hat.' +
            'Klickt man auf den √-Knopf, rechts neben dem Dropdown mit den Ausrüstungsprofilen,' +
            'dann wird das gerade ausgewählte Ausrüstungsprofil der gerade ausgewählten Konfig zugeordnet.' +
            'Ist ein Profil einer Konfig zugeordnet, wird es immer automatisch ausgewählt, sobald man die wechselt.' +
            '\');">';
        ausruestenknopf.parentNode.insertBefore(infodiv, ausruestenknopf.nextSibling);
        if (GM_getValue("erststarthinweis_4_gelesen", false) == false) {
            var infoicon = document.getElementById("___wodToolTip_UniqueId__9997");
            infoicon.addEventListener("mouseover", function (e) {
                GM_setValue("erststarthinweis_4_gelesen", true);
            }, false);
            pulsierenderRahmen(infoicon, 1004, true);
        }
        profilZurKonfigAuswaehlen();
        //Aktion für das Ändern des Konfigdropdowns
        konfigdropdown.addEventListener("change", function (e) {
            profilZurKonfigAuswaehlen();
        }, false);
        //Aktion für das Klicken des Verknüpfungsknopfes
        verknuepfenknopf.addEventListener("click", function (e) {
            var konfigdropdown = document.getElementById("konfigdropdown");
            var profildropdown = document.getElementById("profildropdown");
            var ausgewaehlterprofilslot = parseInt(profildropdown.options[profildropdown.selectedIndex].value);
            var konfigname = konfigNameBereinigen(konfigdropdown.options[konfigdropdown.selectedIndex].text);
            for (var profilslot = 1; profilslot <= 21; profilslot++) {
                var allekonfigs = GM_getValue("profil_" + held + "_" + profilslot + "_verknuepftekonfig", "nicht vorhanden");
                if (profildropdown.selectedIndex > 0) {
                    //Konfig soll hinzugefügt werden
                    if (profilslot == ausgewaehlterprofilslot) {
                        if (allekonfigs != "nicht vorhanden") {
                            //Konfig hinzufügen falls nicht vorhanden
                            var konfig = allekonfigs.split("#konfigende#");
                            var konfigvorhanden = false;
                            for (var ikonfig = 0; ikonfig < konfig.length; ikonfig++) {
                                if (konfig[ikonfig] == konfigname) {
                                    konfigvorhanden = true;
                                    break;
                                }
                            }
                            if (konfigvorhanden == false) {
                                //konfig ist nicht vorhanden also hinzufügen
                                konfig[konfig.length] = konfigname;
                                var verknuepfungsstring = "";
                                for (var istring = 0; istring < konfig.length; istring++) {
                                    verknuepfungsstring += konfig[istring] + "#konfigende#";
                                }
                                GM_setValue("profil_" + held + "_" + profilslot + "_verknuepftekonfig", verknuepfungsstring);
                            }
                        } else {
                            GM_setValue("profil_" + held + "_" + profilslot + "_verknuepftekonfig", konfigname + "#konfigende#");
                        }
                    } else {
                        //Konfig entfernen falls vorhanden
                        if (allekonfigs != "nicht vorhanden") {
                            var konfig = allekonfigs.split("#konfigende#");
                            for (var ikonfig = konfig.length - 1; ikonfig >= 0; ikonfig--) {
                                if (konfig[ikonfig] == konfigname) {
                                    if (konfig.length == 1) {
                                        GM_setValue("profil_" + held + "_" + profilslot + "_verknuepftekonfig", "nicht vorhanden");
                                    } else {
                                        konfig.splice(ikonfig, 1);
                                        var verknuepfungsstring = "";
                                        for (var istring = 0; istring < konfig.length; istring++) {
                                            verknuepfungsstring += konfig[istring] + "#konfigende#";
                                        }
                                        GM_setValue("profil_" + held + "_" + profilslot + "_verknuepftekonfig", verknuepfungsstring);
                                    }
                                    break;
                                }
                            }
                        }
                    }
                } else {
                    //Konfig soll entfernt werden
                    if (allekonfigs != "nicht vorhanden") {
                        var konfig = allekonfigs.split("#konfigende#");
                        for (var ikonfig = konfig.length - 1; ikonfig >= 0; ikonfig--) {
                            if (konfig[ikonfig] == konfigname) {
                                if (konfig.length == 1) {
                                    GM_setValue("profil_" + held + "_" + profilslot + "_verknuepftekonfig", "nicht vorhanden");
                                } else {
                                    konfig.splice(ikonfig, 1);
                                    var verknuepfungsstring = "";
                                    for (var istring = 0; istring < konfig.length; istring++) {
                                        verknuepfungsstring += konfig[istring] + "#konfigende#";
                                    }
                                    GM_setValue("profil_" + held + "_" + profilslot + "_verknuepftekonfig", verknuepfungsstring);
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }, false);
        //Aktion für das Klicken des Ausrüstenknopfes
        ausruestenknopf.addEventListener("click", function (e) {
            var profildropdown = document.getElementById("profildropdown");
            var profilslot = parseInt(profildropdown.options[profildropdown.selectedIndex].value);
            if (profilslot > 0) {
                GM_setValue("ausruestenvongruppe_" + held, true);
                GM_setValue("ausruestenvongruppe_" + held + "_profilslot", profilslot);
                window.location.href = window.location.protocol + "//" + window.location.hostname + "/wod/spiel/hero/items.php?view=gear";
            } else {
                alert("Bitte erst ein Ausrüstungsprofil auswählen.");
            }
        }, false);
    }
    warteEbeneAusblenden();
}


//-----------------------------------------------------------------------------------------------------------------------------------------------------------
//Beschreibung: Die Hauptfunktion die alles steuert.
//Erwartet: -
//Gibt aus: -
//-----------------------------------------------------------------------------------------------------------------------------------------------------------
function main() {
    var url = window.location.href;
    //Prüfen, ob man sich auf der Gruppenseite befindet
    if (url.search(/.+group\.php.*/) != -1) {
        //Man befindet sich auf der Gruppenseite
        mainGruppe();
    } else {
        //Prüfen ob man sich auf der Ausrüstungsseite befindet.
        if (url.search(/.+items\.php.*/) != -1) {
            var view = document.getElementsByName("view")[0];
            if (view != undefined && view.value == "gear") {
                //Prüfen, ob man die Ausrüstungsseite über die Navigation betreten hat
                if (window.location.search.search(/view=gear/) != -1) {
                    //Seite wurde neu betreten
                    var neubetreten = true;
                } else {
                    //Seite wurde neu geladen
                    var neubetreten = false;
                }
                mainAusruestung(neubetreten);
            }
        }
    }
}


main();
//Test
//alert(profileEinesHeldenExportieren(held));
//var testarray = new Array();
//testarray[0] = "Puit";
//testarray[1] = 5;
//testarray[2] = 3.12;
//testarray[3] = false;
//testarray[4] = "puit123.1";
//testarray[5] = "[bala/]";
//GM_setArray('Bla_1234_zoot', testarray);
//var testarray2 = GM_getArray('Bla_1234_zoot');
//if(testarray2 == false){
//	alert("Fehler beim Lesen des Arrays");
//}else{
//	alert(testarray2.join());
//}
//var neueheldenliste = heldenLaden();
//if(neueheldenliste === false){
//	alert("Fehler beim Laden der Liste");
//}else{
//	var teststring2 = "";
//	for(var i = 0; i < neueheldenliste.length; i++){
//		teststring2 += "("+neueheldenliste[i]["id"]+"|"+neueheldenliste[i]["name"]+"|"+neueheldenliste[i]["welt"]+");\n";
//	}
//	alert(teststring2);
//	alert(neueheldenliste.length);
//}