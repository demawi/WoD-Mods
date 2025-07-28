// ==UserScript==
// @name           [WoD] Klassen-Völker Statistik
// @namespace      demawi
// @description    Ein weiterer Menü-Eintrag für Favoriten
// @grant   	   GM.getValue
// @grant  		   GM.setValue
// @include        http*://*.world-of-dungeons.de/wod/spiel/ranking/fame_hero.php*
// ==/UserScript==

(async function () {
    'use strict';

    var pathname = window.location.pathname.split("/");
    var pageSection = pathname[pathname.length - 2];
    var page = pathname[pathname.length - 1];

    const createResultTable = async function () {
        const data = await GM.getValue("data");
        const klassen = {};
        const voelker = {};
        const alleKlassenMap = {};
        const alleVoelkerMap = {};

        data.forEach(cur => {
            const klasse = cur.klasse;
            const volk = cur.volk;
            alleKlassenMap[klasse] = true;
            alleVoelkerMap[volk] = true;
            var voelkerMap = klassen[klasse];
            if (!voelkerMap) {
                voelkerMap = {};
                klassen[klasse] = voelkerMap;
            }
            var volkCount = voelkerMap[volk];
            if (!(volkCount >= 0)) {
                volkCount = 0;
            }
            volkCount++;
            voelkerMap[volk] = volkCount;

            var heldenMap = voelker[volk];
            if (!heldenMap) {
                heldenMap = {};
                voelker[volk] = heldenMap;
            }
            var klasseCount = heldenMap[klasse];
            if (!(klasseCount >= 0)) {
                klasseCount = 0;
            }
            klasseCount++;
            heldenMap[klasse] = klasseCount;

        });

        function pickHex(color1, color2, weight) {
            var w1 = weight;
            var w2 = 1 - w1;
            var rgb = [Math.round(color1[0] * w2 + color2[0] * w1),
                Math.round(color1[1] * w2 + color2[1] * w1),
                Math.round(color1[2] * w2 + color2[2] * w1)];
            return rgb;
        }


        const createTable = function (aMap, bMap) {
            const table = document.createElement("table");
            table.className = "content_table";
            table.border = 1;
            table.style.backgroundColor = "black";

            const alleKlassen = Object.keys(aMap).sort();
            const alleVoelker = Object.keys(bMap).sort();

            var countAll = 0;
            for (const [aKey, abMap] of Object.entries(aMap)) {
                for (const [bKey, value] of Object.entries(abMap)) {
                    countAll += value;
                }
            }

            var tr = "<td style='text-align:center;color:white;'>" + countAll + "</td>";
            var tc = "<td style='text-align:center;color:white;'>#</td>";
            const maxes = {};
            alleVoelker.forEach(volk => {
                tr += "<td style='text-align:center;color:white;'>" + volk + "</td>";
                var allCount = 0;
                alleKlassen.forEach(klasse => {
                    var curMax = maxes[volk] || 0;
                    var curCount = aMap[klasse][volk] || 0;
                    maxes[volk] = Math.max(curMax, curCount);
                    allCount += curCount;
                });
                tc += "<td style='text-align:center;color:white;'>" + allCount + "</td>";
            });
            table.innerHTML += tr;
            table.innerHTML += tc;
            console.log(maxes);

            alleKlassen.forEach(klasse => {
                tr = "<td style='color:white'>" + klasse + "</td>";
                alleVoelker.forEach(volk => {
                    const count = aMap[klasse][volk] || 0;
                    if (count == 0) {
                        tr += "<td></td>";
                        return;
                    }
                    const color = pickHex(Array(255, 0, 0), Array(0, 255, 0), count / maxes[volk]);
                    console.log(color);
                    tr += "<td style='text-align:center;font-weight:bold;color:rgb(" + color[0] + "," + color[1] + "," + color[2] + ")'>" + (aMap[klasse][volk] || "") + "</td>";
                });
                table.innerHTML += tr;
            });
            return table;
        }
        // Anzeigen
        const div = document.createElement("div");
        div.style.position = "absolute";
        div.style.zIndex = 1000;
        div.append(createTable(klassen, voelker));
        div.append(createTable(voelker, klassen));
        document.body.append(div);
    }

    if (page === "fame_hero.php") {
        const button = document.createElement("a");
        button.href = "#";
        button.className = "button";
        button.innerText = "Daten für die Statistik einlesen";

        const searchContainer = document.getElementsByClassName("search_container")[0].children[0].children[0].children[0];
        console.log(searchContainer);
        const td = document.createElement("td");
        searchContainer.append(td);
        td.append(button);

        button.onclick = function () {
            const data = [];
            const table = document.getElementsByClassName("content_table")[0];
            const tbody = table.children[1].children;
            const klassenMapping = {
                "Barbarin": "Barbar",
                "Bardin": "Barde",
                "Diebin": "Dieb",
                "Gauklerin": "Gaukler",
                "Gelehrte": "Gelehrter",
                "Gestaltwandlerin": "Gestaltwandler",
                "Gladiatorin": "Gladiator",
                "Hasardeurin": "Hasardeur",
                "Jägerin": "Jäger",
                "Klingenmagierin": "Klingenmagier",
                "Magierin": "Magier",
                "Priesterin": "Priester",
                "Prophet": "Prophetin",
                "Quacksalberin": "Quacksalber",
                "Ritterin": "Ritter",
                "Schamanin": "Schamane",
                "Schützin": "Schütze",
            }
            const voelkerMapping = {
                "Mag-Mor-Elfe": "Mag-Mor-Elf",
                "Tirem-Ag-Elfe": "Tirem-Ag-Elf",
                "Gnerka": "Gnerk",
                "Kerasa": "Kerasi",
                "Rashana": "Rashani",
                "Grenzländerin": "Grenzländer",
            };
            for (var i = 0, l = tbody.length; i < l; i++) {
                const tr = tbody[i];
                const nameAndclassTd = tr.children[1];
                const classTd = nameAndclassTd.children[nameAndclassTd.children.length - 1];
                const hrefs = classTd.getElementsByTagName("a");
                var volk = hrefs[0].innerText.trim();
                volk = voelkerMapping[volk] || volk;
                var klasse = hrefs[1].innerText.trim();
                klasse = klassenMapping[klasse] || klasse;
                const ep = tr.children[2].innerText.replaceAll(" ", "");
                data.push({
                    klasse: klasse,
                    volk: volk,
                    ep: ep,
                });
                // console.log(klasse, spezies, ep);
            }
            GM.setValue("data", data);
            console.log("Bevölkerungs-Daten wurden geschrieben", data.length);
            createResultTable();
        }
    }

})();