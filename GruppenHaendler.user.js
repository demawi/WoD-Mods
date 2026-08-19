// ==UserScript==
// @name           [WoD] GruppenHaendler
// @version        0.1.0
// @author         demawi
// @namespace      demawi
// @description    Evtl. hilfreiche Funktionailtäten für den Gruppen-Händler
//
// @match          *://*.world-of-dungeons.de/wod/spiel/hero/items.php*
// @require        repo/DemawiRepository.js
//
// @require        libs/jszip.min.js
// @require        https://code.jquery.com/jquery-3.7.1.min.js#sha512=v2CJ7UaYy4JwqLDIrZUI/4hqeoQieOmAZNXBeQyjo21dadnwR+8ZaIJVT8EE2iyI61OV8e6M8PP2/4hpQINQ/g==
// @require        https://code.jquery.com/ui/1.14.1/jquery-ui.js#sha512=ETeDoII5o/Zv6W1AtLiNDwfdkH684h6M/S8wd2N0vMEAeL3UAOf7a1SHdP1LGDieDrofe1KZpp9k6yLkR90E6A==
// @require	       https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js#sha512=2ImtlRlf2VVmiGZsjm9bEyhjGW4dU7B6TNwh/hx/iSByxNENtj3WVE6o/9Lj4TJeVXPi4bnOIMXFIJJAeufa0A==
// ==/UserScript==
// *************************************************************
// *** WoD-GruppenHaendler                                   ***
// *** Dieses Script ist Freeware                            ***
// *** Wer es verbessern will, moege dies tun, aber bitte    ***
// *** nicht meinen Namen entfernen.                         ***
// *** Danke! demawi                                         ***
// *************************************************************
(function () {
    'use strict';

    const _ = demawiRepository;

    class Mod {
        static modname = "GruppenHaendler";
        static version = GM.info.script.version;
        static reduktionProTag = 0.01;

        static async startMod() {
            const view = _.WoD.getView(window);
            if (view === _.WoD.VIEW.MARKET) {
                await this.onMarketPage();
            }
        }

        static async onMarketPage() {
            const searchContainer = document.querySelector(".search_container");
            const container = document.createElement("div");
            container.classList.add("layout_clear");
            searchContainer.parentElement.insertBefore(container, searchContainer.nextSibling);

            const niedrigsterPreisButton = _.UI.createWodButton("NonVGs: Setze auf Tiefstpreis");
            niedrigsterPreisButton.addEventListener("click", () => this.loop(this.niedrigsterPreisNonVGs));
            container.append(niedrigsterPreisButton);

            const niedrigsterPreisButtonMinus1 = _.UI.createWodButton("NonVGs: Setze auf Tiefstpreis - 1");
            niedrigsterPreisButtonMinus1.addEventListener("click", () => this.loop(this.niedrigsterPreisNonVGsMinus1));
            container.append(niedrigsterPreisButtonMinus1);

            const constPreisButton = _.UI.createWodButton("Alles: Konstante Reduktion (-1% pro Tag noch ohne Schwelle)");
            constPreisButton.addEventListener("click", () => this.loop(this.constantReduction.bind(this)));
            container.append(constPreisButton);

            console.log("GruppenHaendler geladen2", document.querySelectorAll(".content_table tbody tr"));
        }

        static loop(fn) {
            for (const curTr of document.querySelectorAll(".content_table tbody tr")) {
                const name = curTr.children[1].textContent.replaceAll("\n", "").trim();
                const festpreis = Number.parseInt(curTr.children[3].textContent.replaceAll("\n", "").trim());
                const preisInput = curTr.children[4].children[0]; // der Preis-Input
                const meinBisherigerPreis = Number.parseInt(curTr.children[4].querySelectorAll("input")[1].value); // Mein aktueller Preis-Input
                let vorschlag = curTr.children[4].querySelector("span");
                if (vorschlag) {
                    vorschlag = Number.parseInt(vorschlag.textContent.replaceAll("\n", "").replaceAll("[", "").replaceAll("]", "").trim());
                }
                const aktuellerTiefstpreis = Number.parseInt(curTr.children[5].textContent.replaceAll("\n", "").trim());
                const lagerdauerComplete = curTr.children[7].textContent.replaceAll("\n", "").trim();
                let lagerdauer = Number.parseInt(lagerdauerComplete.split(" ")[0]);
                const isVG = _.WoDItemDb.isVGName(name);
                if (lagerdauerComplete.includes("Tage")) {
                    lagerdauer = lagerdauer * 24;
                } else if (lagerdauerComplete.includes("Std")) {
                    // korrekt
                } else if (lagerdauerComplete.includes("Sek")) {
                    lagerdauer = lagerdauer / 60 / 60;
                } else if (lagerdauerComplete.includes("Min")) {
                    lagerdauer = lagerdauer / 60;
                }
                const entry = new SellEntry(name, festpreis, aktuellerTiefstpreis, meinBisherigerPreis, vorschlag, isVG, lagerdauer);
                const result = fn(entry);
                console.log("Entry: ", entry, result);
                if (result) {
                    preisInput.value = result;
                }
            }
        }

        static niedrigsterPreisNonVGs(sellEntry) {
            if(sellEntry.isVG) {
                return; //  sellEntry.vorschlag; // Riskant durch Scheinverkäufe
            } else {
                return sellEntry.tiefspreis;
            }
        }

        static niedrigsterPreisNonVGsMinus1(sellEntry) {
            if(sellEntry.isVG) {
                return; //  sellEntry.vorschlag; // Riskant durch Scheinverkäufe
            } else {
                return sellEntry.tiefspreis - 1;
            }
        }

        static constantReduction(sellEntry) {
            const lagerdauerH = sellEntry.lagerdauer;
            console.log("Lagerdauer: ", lagerdauerH);
            if(lagerdauerH > 1) {
                const reduktion = 1 - (lagerdauerH/24 * this.reduktionProTag);
                return Math.floor(sellEntry.bisherigerPreis * reduktion);
            }
        }
    }

    class SellEntry {
        constructor(name, festpreis, tiefstpreis, bisherigerPreis, vorschlag, isVG, lagerdauer) {
            this.name = name;
            this.festpreis = festpreis;
            this.tiefspreis = tiefstpreis;
            this.bisherigerPreis = bisherigerPreis;
            this.vorschlag = vorschlag;
            this.isVG = isVG;
            this.lagerdauer = lagerdauer;
        }
    }

    try {
        Mod.startMod();
    } catch (e) {
        console.error(e);
        throw e;
    }
})();