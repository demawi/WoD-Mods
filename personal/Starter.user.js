// ==UserScript==
// @name           [WoD] IndexDBBrowser
// @author         demawi
// @namespace      demawi
// @description    Lässt einen die Index des Browsers ansehen und bearbeiten
// @include        https://*.world-of-dungeons.*/wod/spiel/settings/settings.php*
// @require        https://raw.githubusercontent.com/demawi/WoD-Mods/refs/heads/master/repo/DemawiRepository.js?version=1.0.4
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

    const _Storages = demawiRepository.import("Storages");

    class Mod {
        static dbname = "wodDB";

        static async startMod() {
            demawiRepository.startMod();

        }
    }

    Mod.startMod();

})();
