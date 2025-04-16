// ==UserScript==
// @name           [WoD] Kampfkonfig Plus
// @namespace      demawi
// @description    Erweiterungen für die Kampfkonfigs. Aktuell CSV-Export.
// @version        0.1
// @include        https://*.world-of-dungeons.de/wod/spiel/hero/skillconf_nojs.php*
// @include        https://*.world-of-dungeons.de/wod/spiel/hero/skillconfig.php*
// @require        https://raw.githubusercontent.com/demawi/WoD-Mods/refs/heads/master/repo/DemawiRepository.js
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

    class Mod {
        static async startMod() {
            // Expertenansicht:  /wod/spiel/hero/skillconf_nojs.php
            // Einfache Ansicht: /wod/spiel//hero/skillconf_nojs.php
            console.log("Kampfkonfig found!");

            const ueberschrift = document.getElementsByTagName("h1")[1];
            const button = document.createElement("span");
            button.classList.add("nowod");
            button.innerHTML = " 💾";
            button.style.fontSize = "12px";
            button.style.cursor = "pointer";
            button.onclick = function () {
                Mod.exportKonfig(ueberschrift);
            }
            ueberschrift.append(button);
        }

        static exportKonfig(ueberschrift) {
            var profilName = ueberschrift.childNodes[0].textContent.substring(8);
            const result = this.getKonfig();
            console.log(result);
            const resultStr = JSON.stringify(result);
            const name = _WoD.getMyHeroName() + "_" + profilName + ".json";
            _File.forDownload(name, resultStr);
        }

        static getKonfig() {
            var tables = document.querySelectorAll('div + .wod-list .wod-list-table .wod-list-items');
            console.log("tables", tables);
            // Level Tabs
            var level = document.querySelectorAll('.wod-tabs')[1].querySelectorAll('li');
            console.log("level", level);
            const result = [];

            for (let i = 0; i < level.length; i++) {
                const resultLevel = {
                    name: "Level " + i
                };
                result[i] = resultLevel;
                console.log('Level ' + i);
                // DOM Content laden
                level[i].click();

                // Standard überschreiben - Frage
                if (i > 0 && !document.querySelector('input[type="checkbox"]').checked) {
                    resultLevel.standard = true;
                    console.log("Level disabled..");
                    continue;
                } else {
                    resultLevel.standard = false;
                }

                // Vorrunde
                var resultTable = [];
                resultLevel.vorrunde = resultTable;
                this.getKonfigTable(resultTable, tables[0].querySelectorAll('.wod-list-item, wod-list-item-selected')); // -> function getItems(configitems)

                // Runde
                resultTable = [];
                resultLevel.runde = resultTable;
                this.getKonfigTable(resultTable, tables[1].querySelectorAll('.wod-list-item, wod-list-item-selected')); // -> function getItems(configitems)
            }
            level[0].click();
            return result;
        }

        static getKonfigTable(resultTable, configNodes) {
            for (let i = 0; i < configNodes.length; i++) {
                // Wenn disabled: skip
                if (configNodes[i].querySelector('.disabled')) continue;
                var skill = configNodes[i].querySelector('.wod-list-item-label-skill').textContent.trim();
                if (skill === "Klicke hier, um eine Fertigkeit auszuwählen.") continue;
                var item = this.getItemName(configNodes[i].querySelector('.wod-list-item-label-item').textContent.trim());
                var ammo = configNodes[i].querySelector('.wod-list-item-label-ammo').textContent.trim();
                var positions = configNodes[i].querySelector('.wod-list-item-label-positions').textContent.trim();
                const newEntry = {};
                if (skill) newEntry.skill = skill;
                if (item) newEntry.item = item;
                if (ammo) newEntry.ammo = ammo;
                if (positions) newEntry.positions = positions;
                resultTable.push(newEntry);
                console.log(newEntry);
            }
        }

        static getItemName(text) {
            if (text.startsWith("!!")) text = text.substring(3).trim();
            if (text.endsWith("(Lager)")) text = text.substring(0, text.length - 7).trim();
            return text;
        }
    }

    Mod.startMod();
})();