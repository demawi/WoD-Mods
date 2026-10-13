// ==UserScript==
// @name           [WoD] GruppenHaendler
// @version        0.2.2
// @author         demawi
// @namespace      demawi
// @description    Evtl. hilfreiche Funktionailtäten für den Gruppen-Händler
//
// @match          *://*.world-of-dungeons.de/wod/spiel/hero/items.php*
// @require        repo/DemawiRepository.js
// @require        repo/connect_firebase.js
// @grant          GM_getValue
// @grant          GM_setValue
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
            } else if (view === _.WoD.VIEW.SCHATZKAMMER || view === _.WoD.VIEW.GRUPPENLAGER || view === _.WoD.VIEW.ITEMS_STORE) {
                this.insertGroupRepositoryUi();
            }
        }

        static insertGroupRepositoryUi() {
            const container = firebase.createRepositoryUi("group", repository => this.addItemVotes(repository));
            const contentTable = document.querySelector(".content_table");
            if (contentTable) {
                contentTable.parentElement.insertBefore(container, contentTable);
            } else {
                document.body.prepend(container);
            }
        }

        static async addItemVotes(repository) {
            const itemSelect = document.querySelector('table.content_table tbody select[name^="EquipItem["]');
            const table = itemSelect && itemSelect.closest("table");
            const tbody = table && table.tBodies[0];
            if (!table || !tbody) {
                console.error("Die Schatzkammer-Tabelle für die Gruppenabstimmung wurde nicht gefunden.");
                return;
            }
            const rows = Array.from(tbody.rows);
            if (rows.length === 0) return;
            table._wodVoteRows = rows;
            const filter = this.createVoteFilter(table);

            const header = table.tHead && table.tHead.rows[1];
            if (!header) {
                console.error("Die zweite Kopfzeile der Schatzkammer-Tabelle wurde nicht gefunden.");
                return;
            }
            if (!header.dataset.wodVoteHeader) {
                const voteHeader = document.createElement("th");
                voteHeader.textContent = "behalten?";
                voteHeader.style.position = "relative";
                voteHeader.style.textAlign = "right";
                voteHeader.style.verticalAlign = "top";
                voteHeader.dataset.wodVoteHeaderCell = "true";
                header.appendChild(voteHeader);
                header.dataset.wodVoteHeader = "true";
            }

            const repositoryData = await repository.get("") || {};
            const items = repositoryData.items || {};
            const characterId = _.WoD.getMyHeroId();
            const characterName = _.WoD.getMyHeroName() || "Unbekannter Charakter";
            const memberIds = Object.keys(repositoryData.meta && repositoryData.meta.access || {});
            if (!memberIds.includes(characterId)) {
                memberIds.push(characterId);
            }
            const voteViews = new Map();
            const itemNames = new Map();
            for (const row of rows) {
                const itemSelect = row.querySelector('select[name^="EquipItem["]');
                const itemLink = row.children[1] && row.children[1].querySelector("a");
                if (!itemSelect || !itemLink) continue;

                const itemIdMatch = itemSelect.name.match(/^EquipItem\[(.+)\]$/);
                if (!itemIdMatch) continue;
                const itemName = itemLink.textContent.replace(/!$/, "").trim();
                const itemBaseName = _.WoDItemDb.getBaseName(itemName);
                if (!itemBaseName) continue;
                const itemKey = this.getItemKey(itemBaseName);
                itemNames.set(itemKey, itemBaseName);
                const itemData = items[itemKey] || { name: itemBaseName };
                const isUnusable = itemLink.classList.contains("item_unusable");
                if (isUnusable && (!itemData.votes || itemData.votes[characterId] !== "no")) {
                    await repository.set(`items/${itemKey}/name`, itemBaseName);
                    await repository.set(`items/${itemKey}/votes/${characterId}`, "no");
                    itemData.votes = Object.assign({}, itemData.votes, { [characterId]: "no" });
                    items[itemKey] = itemData;
                }
                row.dataset.wodVoteResult = this.getVoteResult(itemData.groupDecision || itemData.votes, memberIds);
                row.dataset.wodIndividualVoteOpen = !itemData.groupDecision
                    && !isUnusable
                    && !(itemData.votes && itemData.votes[characterId])
                    ? "true"
                    : "false";
                row.dataset.wodGroupDecisionOpen = itemData.groupDecision ? "false" : "true";
                row.dataset.wodItemKey = itemKey;
                row.dataset.wodVoteUnusable = isUnusable ? "true" : "false";
                const voteCell = row.insertCell(-1);
                voteCell.align = "center";
                voteCell.style.position = "relative";
                voteCell.style.backgroundColor = "transparent";

                let currentVote = isUnusable ? "no" : itemData.votes && itemData.votes[characterId] || "";
                const characterVoteContainer = document.createElement("span");
                characterVoteContainer.title = "Eigene Entscheidung";
                characterVoteContainer.style.position = "relative";
                characterVoteContainer.style.zIndex = "1";
                const yesButton = _.UI.createImgButton("20px", _.UI.WOD_SIGNS.YES, () =>
                    saveVote("yes")
                );
                const noButton = _.UI.createImgButton("20px", _.UI.WOD_SIGNS.NO, () =>
                    saveVote("no")
                );
                if (!isUnusable) {
                    yesButton.title = "Behalten";
                    noButton.title = "Verkaufen";
                    characterVoteContainer.append(yesButton, noButton);
                }
                voteCell.append(characterVoteContainer);

                const voteBackground = document.createElement("span");
                voteBackground.style.position = "absolute";
                voteBackground.style.top = "0";
                voteBackground.style.right = "0";
                voteBackground.style.bottom = "0";
                voteBackground.style.left = "0";
                voteBackground.style.display = "flex";
                voteBackground.style.zIndex = "0";

                const characterDecisionIndicator = document.createElement("span");
                characterDecisionIndicator.style.flex = "0 0 80%";
                characterDecisionIndicator.style.backgroundColor = itemData.groupDecision
                    ? currentVote ? this.getCharacterVoteColor(currentVote) : "transparent"
                    : this.getCharacterVoteColor(currentVote);

                const groupDecisionIndicator = document.createElement("span");
                groupDecisionIndicator.style.flex = "0 0 20%";
                let currentGroupDecision = itemData.groupDecision;
                groupDecisionIndicator.style.backgroundColor = this.getVoteColor(
                    currentGroupDecision || itemData.votes,
                    memberIds
                );
                groupDecisionIndicator.title = this.getVoteSummary(
                    currentGroupDecision,
                    itemData.votes,
                    memberIds
                );
                groupDecisionIndicator.style.cursor = "pointer";
                voteBackground.append(characterDecisionIndicator, groupDecisionIndicator);
                voteCell.append(voteBackground);

                const voteView = {
                    row,
                    setState: (decision, votes, updatedMemberIds) => {
                        currentGroupDecision = decision;
                        groupDecisionIndicator.style.backgroundColor = this.getVoteColor(
                            decision || votes,
                            updatedMemberIds
                        );
                        groupDecisionIndicator.title = this.getVoteSummary(
                            decision,
                            votes,
                            updatedMemberIds
                        );
                        row.dataset.wodVoteResult = this.getVoteResult(
                            decision || votes,
                            updatedMemberIds
                        );
                        row.dataset.wodIndividualVoteOpen = !decision
                            && row.dataset.wodVoteUnusable !== "true"
                            && !(votes && votes[characterId])
                            ? "true"
                            : "false";
                        row.dataset.wodGroupDecisionOpen = decision ? "false" : "true";
                        currentVote = votes && votes[characterId] || "";
                        characterDecisionIndicator.style.backgroundColor = decision
                            ? currentVote ? this.getCharacterVoteColor(currentVote) : "transparent"
                            : this.getCharacterVoteColor(currentVote);
                    },
                };
                const itemViews = voteViews.get(itemKey) || [];
                itemViews.push(voteView);
                voteViews.set(itemKey, itemViews);

                const saveVote = async vote => {
                    if (isUnusable) return;
                    const nextVote = currentVote === vote ? "" : vote;
                    yesButton.style.pointerEvents = "none";
                    noButton.style.pointerEvents = "none";
                    try {
                        await repository.set(`items/${itemKey}/name`, itemBaseName);
                        if (nextVote === "") {
                            await repository.remove(`items/${itemKey}/votes/${characterId}`);
                        } else {
                            await repository.set(`items/${itemKey}/votes/${characterId}`, nextVote);
                        }
                        currentVote = nextVote;
                        const updatedRepositoryData = await repository.get("");
                        const updatedItem = updatedRepositoryData.items
                            && updatedRepositoryData.items[itemKey];
                        const updatedMemberIds = Object.keys(
                            updatedRepositoryData.meta && updatedRepositoryData.meta.access || {}
                        );
                        for (const view of voteViews.get(itemKey) || []) {
                            view.setState(
                                updatedItem && updatedItem.groupDecision,
                                updatedItem && updatedItem.votes,
                                updatedMemberIds
                            );
                        }
                        this.updateVoteFilter(table, filter.value, table._wodVoteCombineItems.checked);
                    } catch (error) {
                        console.error("Einzelentscheidung konnte nicht gespeichert werden.", error);
                    } finally {
                        yesButton.style.pointerEvents = "";
                        noButton.style.pointerEvents = "";
                    }
                };
                const saveDecision = async decision => {
                    try {
                        const nextDecision = currentGroupDecision && currentGroupDecision.value === decision
                            ? null
                            : decision;
                        await repository.set(`items/${itemKey}/name`, itemBaseName);
                        if (nextDecision === null) {
                            await repository.remove(`items/${itemKey}/groupDecision`);
                        } else {
                            await repository.set(`items/${itemKey}/groupDecision`, {
                                value: nextDecision,
                                decidedBy: {
                                    id: characterId,
                                    name: characterName,
                                },
                                decidedAt: {".sv": "timestamp"},
                            });
                        }
                        const updatedRepositoryData = await repository.get("");
                        const updatedItem = updatedRepositoryData.items
                            && updatedRepositoryData.items[itemKey];
                        for (const view of voteViews.get(itemKey) || []) {
                            view.setState(
                                updatedItem && updatedItem.groupDecision,
                                updatedItem && updatedItem.votes,
                                memberIds
                            );
                        }
                        this.updateVoteFilter(table, filter.value, table._wodVoteCombineItems.checked);
                    } catch (error) {
                        console.error("Gruppenentscheidung konnte nicht gespeichert werden.", error);
                    }
                };
                groupDecisionIndicator.addEventListener("click", () => {
                    this.showDecisionChoice(groupDecisionIndicator, saveDecision);
                });
            }
            const voteHeader = header.querySelector("[data-wod-vote-header-cell]");
            this.createBulkDecisionControls(voteHeader, async decision => {
                try {
                    const visibleItemKeys = new Set(
                        rows
                            .filter(row => row.parentElement === tbody)
                            .map(row => row.dataset.wodItemKey)
                            .filter(Boolean)
                    );
                    for (const itemKey of visibleItemKeys) {
                        const itemBaseName = itemNames.get(itemKey);
                        await repository.set(`items/${itemKey}/name`, itemBaseName);
                        await repository.set(`items/${itemKey}/groupDecision`, {
                            value: decision,
                            decidedBy: {
                                id: characterId,
                                name: characterName,
                            },
                            decidedAt: {".sv": "timestamp"},
                        });
                    }
                    const updatedRepositoryData = await repository.get("");
                    const updatedMemberIds = Object.keys(
                        updatedRepositoryData.meta && updatedRepositoryData.meta.access || {}
                    );
                    for (const [itemKey, views] of voteViews) {
                        const updatedItem = updatedRepositoryData.items
                            && updatedRepositoryData.items[itemKey];
                        for (const view of views) {
                            view.setState(
                                updatedItem && updatedItem.groupDecision,
                                updatedItem && updatedItem.votes,
                                updatedMemberIds
                            );
                        }
                    }
                    this.updateVoteFilter(table, filter.value, table._wodVoteCombineItems.checked);
                } catch (error) {
                    console.error("Gruppenentscheidung für alle Items konnte nicht gespeichert werden.", error);
                }
            });
            this.updateVoteFilter(table, filter.value, table._wodVoteCombineItems.checked);
        }

        static showDecisionChoice(anchor, saveDecision) {
            const existingChoice = document.querySelector("[data-wod-group-decision-choice]");
            if (existingChoice) existingChoice.remove();

            const choice = document.createElement("span");
            choice.dataset.wodGroupDecisionChoice = "true";
            choice.style.position = "fixed";
            choice.style.zIndex = "2";
            choice.style.display = "inline-flex";
            choice.style.alignItems = "center";
            choice.style.width = "max-content";
            choice.style.backgroundColor = "white";
            choice.style.border = "1px solid #888";
            choice.style.padding = "0";
            choice.style.margin = "0";
            choice.style.whiteSpace = "nowrap";
            for (const [value, sign, labelText] of [
                ["yes", _.UI.WOD_SIGNS.YES, "Ja"],
                ["no", _.UI.WOD_SIGNS.NO, "Nein"],
            ]) {
                const button = _.UI.createImgButton("20px", sign, () => {
                    choice.remove();
                    saveDecision(value);
                });
                button.title = labelText;
                button.style.margin = "0 2px";
                choice.append(button);
            }
            const closeButton = document.createElement("input");
            closeButton.type = "button";
            closeButton.value = "×";
            closeButton.className = "button clickable";
            closeButton.title = "Auswahl schließen";
            closeButton.style.marginLeft = "4px";
            closeButton.addEventListener("click", () => choice.remove());
            choice.append(closeButton);
            document.body.append(choice);
            const anchorBounds = anchor.getBoundingClientRect();
            choice.style.top = `${anchorBounds.top}px`;
            choice.style.left = `${Math.max(0, anchorBounds.right - choice.offsetWidth)}px`;
        }

        static createBulkDecisionControls(header, saveDecision) {
            if (header.dataset.wodBulkGroupDecision) return;
            header.dataset.wodBulkGroupDecision = "true";
            header.title = "Gruppenentscheidung für alle Items";
            const container = document.createElement("span");
            container.dataset.wodBulkGroupDecision = "true";
            container.style.position = "absolute";
            container.style.right = "0";
            container.style.bottom = "0";
            container.style.width = "20%";
            container.style.height = "20px";
            container.style.backgroundColor = "#ffe07a";
            container.style.cursor = "pointer";
            container.title = "Gruppenentscheidung für alle Items";
            header.append(container);
            container.addEventListener("click", () => this.showDecisionChoice(container, saveDecision));
        }

        static createVoteFilter(table) {
            let filter = table.parentElement.querySelector("[data-wod-vote-filter]");
            if (filter) return filter;

            const container = document.createElement("label");
            container.dataset.wodVoteFilter = "true";
            container.style.display = "inline-block";
            container.style.marginBottom = "8px";
            container.textContent = "Voting anzeigen: ";

            filter = document.createElement("select");
            filter.title = "Gegenstandstabelle nach dem Gruppenentscheid filtern";
            const options = [
                ["all", "Alle"],
                ["me-open", "Eigen: Offen"],
                ["group-open", "Gruppe: Offen"],
                ["group-keep", "Gruppe: Behalten"],
                ["group-sell", "Gruppe: Verkaufen"],
            ];
            for (const [value, text] of options) {
                const option = document.createElement("option");
                option.value = value;
                option.textContent = text;
                filter.append(option);
            }
            filter.addEventListener("change", () => {
                this.updateVoteFilter(table, filter.value, combineItems.checked);
            });
            container.append(filter);
            const combineLabel = document.createElement("label");
            combineLabel.style.marginLeft = "12px";
            combineLabel.textContent = "Gleiche Namen zusammenfassen ";
            const combineItems = document.createElement("input");
            combineItems.type = "checkbox";
            combineItems.checked = true;
            combineItems.title = "Namensgleiche Gegenstände für die Abstimmung zusammenfassen\nZusammenfassen ist gut für die Voting-Übersicht\nNicht zusammenfassen ist gut für Transfer/Verkaufen-Aktionen";
            combineItems.dataset.wodVoteCombineItems = "true";
            combineItems.addEventListener("change", () => {
                this.updateVoteFilter(table, filter.value, combineItems.checked);
            });
            combineLabel.append(combineItems);
            container.append(combineLabel);
            table._wodVoteCombineItems = combineItems;
            table.parentElement.insertBefore(container, table);
            return filter;
        }

        static updateVoteFilter(table, filterValue, combineItems = true) {
            const tbody = table.tBodies[0];
            const rows = table._wodVoteRows || Array.from(tbody.rows);
            const visibleItemKeys = new Set();
            const visibleRows = [];
            const groupFilter = filterValue === "group-open"
                || filterValue === "group-keep"
                || filterValue === "group-sell";
            for (const row of rows) {
                if (!row.dataset.wodVoteResult) continue;
                const matchesFilter = filterValue === "all"
                    || filterValue === "me-open"
                        && row.dataset.wodIndividualVoteOpen === "true"
                    || filterValue === "group-open"
                        && row.dataset.wodGroupDecisionOpen === "true"
                    || filterValue === "group-keep" && row.dataset.wodVoteResult === "Behalten"
                    || filterValue === "group-sell" && row.dataset.wodVoteResult === "Verkaufen";
                const isDuplicate = groupFilter
                    && combineItems
                    && visibleItemKeys.has(row.dataset.wodItemKey);
                if (matchesFilter && !isDuplicate) {
                    visibleItemKeys.add(row.dataset.wodItemKey);
                    visibleRows.push(row);
                }
            }
            const rowsToKeep = rows.filter(row =>
                !row.dataset.wodVoteResult || visibleRows.includes(row)
            );
            for (const row of rows) {
                if (row.parentElement === tbody) {
                    tbody.removeChild(row);
                }
            }
            for (const row of rowsToKeep) {
                tbody.appendChild(row);
            }
        }

        static getItemKey(itemName) {
            const byteLength = new TextEncoder().encode(itemName).length;
            if (!/[.#$[\]/]/.test(itemName) && byteLength <= 768) {
                return itemName;
            }
            const bytes = new TextEncoder().encode(itemName);
            const encodedName = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
            return `item_${encodedName}`;
        }

        static getCharacterVoteColor(vote) {
            return vote === "yes" ? "#80c995" : vote === "no" ? "#ed9696" : "#ffe07a";
        }

        static getVoteSummary(decision, votes, memberIds) {
            const result = this.getVoteResult(decision || votes, memberIds);
            const members = memberIds || [];
            const values = members.map(memberId => votes && votes[memberId]);
            const yesVotes = values.filter(value => value === "yes").length;
            const noVotes = values.filter(value => value === "no").length;
            const openVotes = members.length - yesVotes - noVotes;
            const summary = [
                `Einzel-Votes: Ja: ${yesVotes}, Nein: ${noVotes}, Offen: ${openVotes}`,
                `Einzel-Ergebnis: ${this.getVoteResult(votes, members)}`,
            ];
            if (decision && decision.decidedBy) {
                const decidedBy = decision.decidedBy.name || decision.decidedBy.id || "Unbekannter Charakter";
                summary.unshift(`Direkte Gruppenentscheidung: ${result}`);
                summary.splice(1, 0, `Direkt entschieden von: ${decidedBy}`);
            } else {
                summary.unshift(`Gruppenentscheidung: ${result}`);
            }
            return summary.join("\n");
        }

        static getVoteResult(decisionOrVotes, memberIds) {
            if (decisionOrVotes && decisionOrVotes.value === "yes") return "Behalten";
            if (decisionOrVotes && decisionOrVotes.value === "no") return "Verkaufen";
            const members = memberIds || [];
            const values = members.map(memberId => decisionOrVotes && decisionOrVotes[memberId]);
            if (values.includes("yes")) return "Behalten";
            if (members.length > 0 && values.every(value => value === "no")) return "Verkaufen";
            return "Offen";
        }

        static getVoteColor(decisionOrVotes, memberIds) {
            const result = this.getVoteResult(decisionOrVotes, memberIds);
            return result === "Behalten"
                ? "#80c995"
                : result === "Verkaufen" ? "#ed9696" : "#ffe07a";
        }

        static async onMarketPage() {
            const searchContainer = document.querySelector(".search_container");
            const container = document.createElement("div");
            container.classList.add("layout_clear");
            searchContainer.parentElement.insertBefore(container, searchContainer.nextSibling);

            const bestandAktualisieren = _.UI.createWodButton("Verkäufe aktualisieren");
            bestandAktualisieren.title = "NonVGs (erster Treffer zählt): \nWenn Tiefstpreis < Altpreis: Neupreis=Tiefstpreis-1\nWenn Lagerdauer > 20 Tage: Neupreis = Altpreis - 1%";
            bestandAktualisieren.title += "\n\nVGs (erster Treffer zählt): \nPreisreduktion alle 20 Tage um 1%. Schwellwert 24h.";
            bestandAktualisieren.addEventListener("click", () =>
                this.loop(sellEntry => {
                    if (!sellEntry.isVG) {
                        if (sellEntry.tiefspreis < sellEntry.bisherigerPreis) {
                            return sellEntry.tiefspreis - 1;
                        } else {
                            return Mod.constantReduction(sellEntry, 24, 0.0005); // 1% pro 20 Tage
                        }
                    } else {
                        return Mod.constantReduction(sellEntry, 24, 0.0005); // 1% pro 20 Tage
                    }
                }));
            container.append(bestandAktualisieren);

            const niedrigsterPreisButton = _.UI.createWodButton("NonVGs: Setze auf Tiefstpreis");
            niedrigsterPreisButton.addEventListener("click", () => this.loop(this.niedrigsterPreisNonVGs));
            container.append(niedrigsterPreisButton);

            const niedrigsterPreisButtonMinus1 = _.UI.createWodButton("NonVGs: Setze auf Tiefstpreis - 1");
            niedrigsterPreisButtonMinus1.addEventListener("click", () => this.loop(this.niedrigsterPreisNonVGsMinus1));
            container.append(niedrigsterPreisButtonMinus1);

            const constPreisButton = _.UI.createWodButton("Alles: Konstante Reduktion (-1% pro 20 Tage, Schwellwert 24h)");
            constPreisButton.addEventListener("click", () => this.loop(Mod.constantReduction));
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
                if (result) {
                    console.log("Neuer Preis: ", entry, result);
                    preisInput.value = result;
                    let color = "darkblue";
                    if (result - entry.bisherigerPreis < -100) color = "darkred";
                    preisInput.style.backgroundColor = color;
                    preisInput.title = entry.bisherigerPreis + " => " + result + " (" + (result - entry.bisherigerPreis) + ")";
                }
            }
        }

        static niedrigsterPreisNonVGs(sellEntry) {
            if (sellEntry.isVG) {
                return; //  sellEntry.vorschlag; // Riskant durch Scheinverkäufe
            } else {
                return sellEntry.tiefspreis;
            }
        }

        static niedrigsterPreisNonVGsMinus1(sellEntry) {
            if (sellEntry.isVG) {
                return; //  sellEntry.vorschlag; // Riskant durch Scheinverkäufe
            } else {
                return sellEntry.tiefspreis - 1;
            }
        }

        static constantReduction(sellEntry, schwellwertInH = 12, reduktionProTag = 0.0005) { // 1% pro 20 Tage
            const lagerdauerH = sellEntry.lagerdauer;
            if (lagerdauerH > schwellwertInH) {
                const reduktion = 1 - (lagerdauerH / 24 * reduktionProTag); // 1% auf 20 Tage
                const result = Math.ceil(sellEntry.bisherigerPreis * reduktion);
                if (result === sellEntry.bisherigerPreis) {
                    return;
                }
                return result;
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