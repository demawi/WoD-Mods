// ==UserScript==
// @name           [WoD] Kampfbericht Archiv
// @namespace      demawi
// @description    Lässt einen die Seiten der Kampfberichte direkt downloaden
// @version        0.1
// @grant          GM.getValue
// @grant          GM.setValue
// @grant          GM.deleteValue
// @include        http*://*.world-of-dungeons.de/wod/spiel/*dungeon/report.php*
// @include        http*://*/wod/spiel/*dungeon/report.php*
// @include        http*://*.world-of-dungeons.de/*combat_report.php*
// @include        http*://*/wod/spiel/*dungeon/combat_report.php*
// ==/UserScript==
// *************************************************************
// *** WoD-Erweiterte Kammpfstatistik                        ***
// *** Dieses Script ist Freeware                            ***
// *** Wer es verbessern will, moege dies tun, aber bitte    ***
// *** nicht meinen Namen entfernen.                         ***
// *** Danke! demawi                                         ***
// *************************************************************

(function () {
    'use strict';

    class Mod {
        static startMod() {
            const title = document.getElementsByTagName("h1")[0];
            if (title.textContent.trim() !== "Kampfberichte") {
                const button = document.createElement("span");
                button.classList.add("nowod");
                button.innerHTML = " 💾";
                button.style.fontSize = "12px";
                button.style.cursor = "pointer";
                button.onclick = function () {
                    util.htmlExport();
                }
                title.appendChild(button);
            }
        }
    }


    class util {

        static forEach(array, fn) {
            for (var i = 0, l = array.length; i < l; i++) {
                fn(array[i]);
            }
        }

        static hatClassName(node, className) {
            return node.classList && node.classList.contains(className);
        }

        static htmlExport() {
            const myDocument = document.cloneNode(true);

            function remove(node) {
                node.parentElement.removeChild(node);
            }

            function removeNoWodNodes(node) {
                for (var i = 0; i < node.children.length; i++) {
                    const cur = node.children[i];
                    if (cur.classList.contains("nowod")) {
                        remove(cur);
                        i--;
                    } else removeNoWodNodes(cur);
                }
            }

            remove(myDocument.getElementById("gadgettable-left-td"));
            remove(myDocument.getElementById("gadgettable-right-td"));
            const mainContent = myDocument.getElementsByClassName("gadget main_content lang-de")[0];
            for (var i = 0; i < mainContent.parentElement.children.length; i++) {
                const cur = mainContent.parentElement.children[i];
                if (cur !== mainContent) {
                    remove(cur);
                    i--;
                }
            }
            removeNoWodNodes(myDocument.documentElement);

            const tooltip = myDocument.getElementsByClassName("tooltip")[0];
            if (tooltip) remove(tooltip);

            util.forEach(myDocument.getElementsByTagName("a"), a => {
                if (a.href.startsWith("http") && !a.href.includes("#")) {
                    a.href = new URL(a.href).href;
                }
            });

            util.forEach(myDocument.getElementsByTagName("img"), a => {
                a.src = new URL(a.src).href;
            });

            util.forEach(myDocument.getElementsByTagName("script"), a => {
                if (a.src) a.src = new URL(a.src).href;
            });

            util.forEach(myDocument.getElementsByTagName("link"), a => {
                if (a.href) a.href = new URL(a.href).href;
            });

            function buttonReplaceWithElement(element, text, href) {
                if (element) {
                    const newButton = document.createElement("a");
                    newButton.classList = element.classList;
                    newButton.value = element.value;
                    newButton.innerText = text;
                    newButton.href = href;
                    element.parentElement.replaceChild(newButton, element);
                }
            }

            function buttonReplace(buttonName, text, href) {
                buttonReplaceWithElement(myDocument.getElementsByName(buttonName)[0], text, href);
            }

            buttonReplaceWithElement((myDocument.getElementsByName("stats[0]")[0] || myDocument.getElementsByName("items[0]")[0]).parentElement.children[0], "Übersicht", "../");
            buttonReplace("stats[0]", "Statistik", "Statistik.html");
            buttonReplace("items[0]", "Gegenstände", "Gegenstaende.html");
            buttonReplace("details[0]", "Bericht", "Level1.html");
            for (var i = 1; i <= 12; i++) {
                buttonReplace("level[" + i + "]", "Level " + i, "Level" + i + ".html");
            }

            var fileName;

            var curElement = myDocument.getElementsByName("current_level")[0];
            if (curElement) {
                fileName = "Level" + curElement.value;
            } else {
                curElement = myDocument.getElementsByName("disabled")[0];
                fileName = curElement.value.replace("ä", "ae");
            }

            this.forDownload(fileName + ".html", myDocument.documentElement.outerHTML);
        }

        static forDownload(filename, data) {
            const blob = new Blob([data], {type: 'text/plain'});
            const fileURL = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = fileURL;
            downloadLink.download = filename;
            downloadLink.click();
            URL.revokeObjectURL(fileURL);
        }

    }

    Mod.startMod();

})();