// ==UserScript==
// @name           [WoD] ItemVerwaltung
// @version        0.1
// @author         demawi
// @namespace      demawi
// @description    Hilfe bei der ItemVerwaltung innerhalb einer Gruppe
//
// @match          *://*.world-of-dungeons.de/wod/spiel/hero/items.php*
// @require        repo/DemawiRepository.js
// @require        repo/connect_firebase.js
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_deleteValue
//
// @require        libs/jszip.min.js
// @require        https://code.jquery.com/jquery-3.7.1.min.js#sha512=v2CJ7UaYy4JwqLDIrZUI/4hqeoQieOmAZNXBeQyjo21dadnwR+8ZaIJVT8EE2iyI61OV8e6M8PP2/4hpQINQ/g==
// @require        https://code.jquery.com/ui/1.14.1/jquery-ui.js#sha512=ETeDoII5o/Zv6W1AtLiNDwfdkH684h6M/S8wd2N0vMEAeL3UAOf7a1SHdP1LGDieDrofe1KZpp9k6yLkR90E6A==
// @require	       https://cdnjs.cloudflare.com/ajax/libs/select2/4.0.13/js/select2.min.js#sha512=2ImtlRlf2VVmiGZsjm9bEyhjGW4dU7B6TNwh/hx/iSByxNENtj3WVE6o/9Lj4TJeVXPi4bnOIMXFIJJAeufa0A==
// ==/UserScript==
// *************************************************************
// *** WoD-ItemVerwaltung                                   ***
// *** Dieses Script ist Freeware                            ***
// *** Wer es verbessern will, moege dies tun, aber bitte    ***
// *** nicht meinen Namen entfernen.                         ***
// *** Danke! demawi                                         ***
// *************************************************************
(function () {
    'use strict';

    const _ = demawiRepository;

    class Mod {
        static modname = "ItemVerwaltung";
        static version = GM.info.script.version;

        static async startMod() {
            const view = _.WoD.getView(window);
            if (view === _.WoD.VIEW.SCHATZKAMMER || view === _.WoD.VIEW.GRUPPENLAGER || view === _.WoD.VIEW.ITEMS_STORE) {
                this.resetFilterStateForLinkedPage();
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
            table._wodFilterStorageKey = this.getFilterStorageKey(table);
            this.resetFilterStateForLinkedPage(table);
            const rows = Array.from(tbody.rows);
            if (rows.length === 0) return;
            table._wodVoteRows = rows;
            const filter = this.createVoteFilter(table);
            const itemTables = Array.from(document.querySelectorAll("table.content_table"))
                .filter(itemTable =>
                    itemTable.querySelector('tbody select[name^="EquipItem["]')
                );
            this.createSaleColumnControls(itemTables, filter.parentElement);

            const header = table.tHead && table.tHead.rows[1];
            if (!header) {
                console.error("Die zweite Kopfzeile der Schatzkammer-Tabelle wurde nicht gefunden.");
                return;
            }
            const normalizeHeader = text => text
                .replace(/\s+/g, " ")
                .replace(/\s*-\s*/g, "-")
                .trim()
                .toLowerCase();
            const getHeaderLabel = cell => {
                const inputValues = Array.from(cell.querySelectorAll("input"))
                    .map(input => input.value || input.getAttribute("value") || "")
                    .join(" ");
                return normalizeHeader(`${cell.textContent} ${inputValues}`);
            };
            const isStorageDurationHeader = cell => {
                const label = getHeaderLabel(cell);
                const durationSortInput = cell.querySelector(
                    'input[name*="DO_SORT"][value*="Lager-"]'
                );
                return Boolean(durationSortInput)
                    || (label.includes("lager") && label.includes("dauer"));
            };
            let voteColumnIndex = 0;
            let lagerDurationHeader = null;
            let locationColumnIndex = null;
            for (const cell of header.cells) {
                const sortInput = cell.querySelector('input[name*="DO_SORT"]');
                if (sortInput && normalizeHeader(sortInput.value || "") === "ort") {
                    locationColumnIndex = voteColumnIndex;
                    cell.style.textAlign = "center";
                    cell.setAttribute("align", "center");
                }
                if (isStorageDurationHeader(cell)) {
                    lagerDurationHeader = cell;
                    break;
                }
                voteColumnIndex += cell.colSpan || 1;
            }
            if (!lagerDurationHeader) {
                voteColumnIndex = header.cells.length;
            }
            if (!header.dataset.wodVoteHeader) {
                const voteHeader = document.createElement("th");
                voteHeader.textContent = "behalten?";
                voteHeader.style.position = "relative";
                voteHeader.style.textAlign = "center";
                voteHeader.style.verticalAlign = "top";
                voteHeader.dataset.wodVoteHeaderCell = "true";
                if (lagerDurationHeader) {
                    header.insertBefore(voteHeader, lagerDurationHeader);
                } else {
                    header.appendChild(voteHeader);
                }
                header.dataset.wodVoteHeader = "true";
            }

            const repositoryData = await repository.get("") || {};
            const items = repositoryData.items || {};
            const characterId = _.WoD.getMyHeroId();
            const characterName = _.WoD.getMyHeroName() || "Unbekannter Held";
            const memberIds = Object.keys(repositoryData.meta && repositoryData.meta.access || {});
            const memberNames = Object.fromEntries(
                Object.entries(repositoryData.meta && repositoryData.meta.access || {})
                    .map(([memberId, access]) => [memberId, access && access.name || memberId])
            );
            memberNames[characterId] = characterName;
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
                const itemData = items[itemKey] || {name: itemBaseName};
                const isUnusable = itemLink.classList.contains("item_unusable");
                if (isUnusable && (!itemData.votes || itemData.votes[characterId] !== "no")) {
                    await repository.set(`items/${itemKey}/name`, itemBaseName);
                    await repository.set(`items/${itemKey}/votes/${characterId}`, "no");
                    itemData.votes = Object.assign({}, itemData.votes, {[characterId]: "no"});
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
                if (locationColumnIndex !== null) {
                    let rowColumnIndex = 0;
                    for (const cell of Array.from(row.cells)) {
                        const cellEnd = rowColumnIndex + (cell.colSpan || 1);
                        if (locationColumnIndex >= rowColumnIndex && locationColumnIndex < cellEnd) {
                            cell.style.textAlign = "center";
                            cell.setAttribute("align", "center");
                            break;
                        }
                        rowColumnIndex = cellEnd;
                    }
                }
                // Create vote cell and insert it before the "Lager-dauer" cell when possible
                const voteCell = document.createElement('td');
                voteCell.align = "center";
                voteCell.style.position = "relative";
                voteCell.style.backgroundColor = "transparent";
                let refCell = null;
                let logicalIndex = 0;
                for (const cell of Array.from(row.cells)) {
                    if (logicalIndex >= voteColumnIndex) {
                        refCell = cell;
                        break;
                    }
                    logicalIndex += cell.colSpan || 1;
                }
                if (refCell) {
                    row.insertBefore(voteCell, refCell);
                } else {
                    row.appendChild(voteCell);
                }

                let currentVote = isUnusable ? "no" : itemData.votes && itemData.votes[characterId] || "";
                const characterVoteContainer = document.createElement("span");
                characterVoteContainer.title = "Eigene Entscheidung";
                characterVoteContainer.style.position = "absolute";
                characterVoteContainer.style.top = "0";
                characterVoteContainer.style.left = "0";
                characterVoteContainer.style.bottom = "0";
                characterVoteContainer.style.width = "80%";
                characterVoteContainer.style.display = "inline-flex";
                characterVoteContainer.style.alignItems = "center";
                characterVoteContainer.style.justifyContent = "center";
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
                    memberIds,
                    memberNames
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
                            updatedMemberIds,
                            memberNames
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
            this.createBulkVoteControls(voteHeader, async vote => {
                try {
                    const visibleItemKeys = new Set(
                        rows
                            .filter(row => row.parentElement === tbody)
                            .filter(row => row.dataset.wodVoteUnusable !== "true")
                            .map(row => row.dataset.wodItemKey)
                            .filter(Boolean)
                    );
                    for (const itemKey of visibleItemKeys) {
                        const itemBaseName = itemNames.get(itemKey);
                        await repository.set(`items/${itemKey}/name`, itemBaseName);
                        await repository.set(`items/${itemKey}/votes/${characterId}`, vote);
                    }
                    const updatedRepositoryData = await repository.get("");
                    const updatedMemberIds = Object.keys(
                        updatedRepositoryData.meta && updatedRepositoryData.meta.access || {}
                    );
                    if (!updatedMemberIds.includes(characterId)) {
                        updatedMemberIds.push(characterId);
                    }
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
                    console.error("Einzelentscheidung für alle Items konnte nicht gespeichert werden.", error);
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

        static createBulkVoteControls(header, saveVote) {
            if (header.dataset.wodBulkVote) return;
            header.dataset.wodBulkVote = "true";
            const container = document.createElement("span");
            container.dataset.wodBulkVote = "true";
            container.style.position = "absolute";
            container.style.left = "0";
            container.style.bottom = "0";
            container.style.width = "80%";
            container.style.height = "20px";
            container.style.display = "inline-flex";
            container.style.alignItems = "center";
            container.style.justifyContent = "center";
            container.style.gap = "2px";
            container.title = "Einzelentscheidung für alle angezeigten Items";
            header.append(container);
            for (const [value, sign, title] of [
                ["yes", _.UI.WOD_SIGNS.YES, "Behalten für alle angezeigten Items"],
                ["no", _.UI.WOD_SIGNS.NO, "Verkaufen für alle angezeigten Items"],
            ]) {
                const button = _.UI.createImgButton("20px", sign, () => saveVote(value));
                button.title = title;
                container.append(button);
            }
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
            const savedState = this.loadFilterState(table);
            if (savedState && options.some(([value]) => value === savedState.voteFilter)) {
                filter.value = savedState.voteFilter;
            }
            filter.addEventListener("change", () => {
                this.saveFilterState(table, {
                    voteFilter: filter.value,
                    combineItems: combineItems.checked,
                });
                this.updateVoteFilter(table, filter.value, combineItems.checked);
            });
            container.append(filter);
            const combineLabel = document.createElement("label");
            combineLabel.style.marginLeft = "12px";
            combineLabel.textContent = "Namentlich zusammenfassen ";
            const combineItems = document.createElement("input");
            combineItems.type = "checkbox";
            combineItems.checked = savedState ? savedState.combineItems !== false : true;
            table._wodFilterState = {
                ...(savedState || {}),
                voteFilter: filter.value,
                combineItems: combineItems.checked,
            };
            combineItems.title = "Namensgleiche Gegenstände für die Abstimmung zusammenfassen\nZusammenfassen ist gut für die Voting-Übersicht\nNicht zusammenfassen ist gut für Transfer/Verkaufen-Aktionen";
            combineItems.dataset.wodVoteCombineItems = "true";
            combineItems.addEventListener("change", () => {
                this.saveFilterState(table, {
                    voteFilter: filter.value,
                    combineItems: combineItems.checked,
                });
                this.updateVoteFilter(table, filter.value, combineItems.checked);
            });
            combineLabel.append(combineItems);
            container.append(combineLabel);
            table._wodVoteCombineItems = combineItems;
            table.parentElement.insertBefore(container, table);
            return filter;
        }

        static getFilterStorageKey(table) {
            const sortInput = table.querySelector('thead input[name*="_DO_SORT"]');
            const sortName = sortInput && sortInput.name;
            const pagePrefix = sortName
                ? sortName.split("_DO_SORT")[0]
                : this.getFilterPagePrefixFromView();
            return `wod-itemverwaltung-pending-filters:${pagePrefix || window.location.pathname}`;
        }

        static getFilterPagePrefixFromView() {
            const view = new URL(window.location.href).searchParams.get("view") || "";
            if (view.startsWith("groupcellar")) return "ITEMS_GROUPCELLAR";
            if (view.startsWith("lager")) return "ITEMS_LAGER";
            if (view.startsWith("group")) return "ITEMS_GROUP";
            return null;
        }

        static loadFilterState(table) {
            if (Object.prototype.hasOwnProperty.call(table, "_wodLoadedFilterState")) {
                return table._wodLoadedFilterState;
            }
            try {
                if (!this.shouldRestoreFilterState()) {
                    GM_deleteValue(table._wodFilterStorageKey);
                    table._wodLoadedFilterState = null;
                    return null;
                }
                table._wodLoadedFilterState = GM_getValue(table._wodFilterStorageKey, null);
                if (table._wodLoadedFilterState !== null) {
                    GM_deleteValue(table._wodFilterStorageKey);
                }
                return table._wodLoadedFilterState;
            } catch (error) {
                console.warn("Gespeicherte Filter konnten nicht geladen werden.", error);
                table._wodLoadedFilterState = null;
                return null;
            }
        }

        static saveFilterState(table, state) {
            table._wodFilterState = {
                ...(table._wodFilterState || {}),
                ...state,
            };
            try {
                GM_setValue(table._wodFilterStorageKey, table._wodFilterState);
            } catch (error) {
                console.warn("Filter konnten nicht gespeichert werden.", error);
            }
        }

        static shouldRestoreFilterState() {
            return !new URL(window.location.href).searchParams.has("view");
        }

        static resetFilterStateForLinkedPage(table) {
            if (this.shouldRestoreFilterState()) return;
            try {
                const storageKey = table
                    ? table._wodFilterStorageKey
                    : this.getFilterStorageKeyFromView();
                if (!storageKey) return;
                GM_deleteValue(storageKey);
                console.log("Delete Values", storageKey);
            } catch (error) {
                console.warn("Filter konnten für die verlinkte Seite nicht zurückgesetzt werden.", error);
            }
        }

        static getFilterStorageKeyFromView() {
            const pagePrefix = this.getFilterPagePrefixFromView();
            return pagePrefix
                ? `wod-itemverwaltung-pending-filters:${pagePrefix}`
                : null;
        }

        static createSaleColumnControls(tables, container) {
            if (container.querySelector("[data-wod-sale-columns]")) return;

            const saleColumnLabels = [
                "Verkaufe Festpreis",
                "Markt",
                "Aktueller Tiefstpreis",
                "Verkaufskommentar",
                "Gruppen-Gegenst.",
                "Gruppengegenst.",
                "Von",
            ];
            const normalize = text => text
                .replace(/\s+/g, " ")
                .replace(/\s*-\s*/g, "-")
                .trim()
                .toLowerCase();
            const getHeaderLabel = cell => [
                cell.textContent,
                ...Array.from(cell.querySelectorAll("input"))
                    .map(input => input.value || input.getAttribute("value") || ""),
            ].join(" ");
            const isSalePriceHeader = cell =>
                Array.from(cell.querySelectorAll("input"))
                    .some(input => normalize(input.value || "") === "verkaufe")
                && normalize(cell.textContent).includes("festpreis");
            const wantedLabels = saleColumnLabels.map(normalize);
            const tableColumns = [];
            for (const table of tables) {
                const columnIndexes = new Set();
                const saleHeaderCells = new Set();
                const headerGrid = [];
                const headerRows = table.tHead ? Array.from(table.tHead.rows) : [];
                for (let rowIndex = 0; rowIndex < headerRows.length; rowIndex++) {
                    const occupied = headerGrid[rowIndex] || [];
                    headerGrid[rowIndex] = occupied;
                    for (const cell of headerRows[rowIndex].cells) {
                        let columnIndex = 0;
                        while (occupied[columnIndex]) columnIndex++;
                        const columnSpan = cell.colSpan || 1;
                        const rowSpan = cell.rowSpan || 1;
                        const label = normalize(getHeaderLabel(cell));
                        if (isSalePriceHeader(cell) || wantedLabels.some(wanted =>
                            label === wanted || label.includes(wanted)
                        )) {
                            saleHeaderCells.add(cell);
                            for (let offset = 0; offset < columnSpan; offset++) {
                                columnIndexes.add(columnIndex + offset);
                            }
                        }
                        for (let rowOffset = 0; rowOffset < rowSpan; rowOffset++) {
                            const row = headerGrid[rowIndex + rowOffset] || [];
                            for (let offset = 0; offset < columnSpan; offset++) {
                                row[columnIndex + offset] = true;
                            }
                            headerGrid[rowIndex + rowOffset] = row;
                        }
                    }
                }
                if (columnIndexes.size > 0) {
                    tableColumns.push({table, columnIndexes, saleHeaderCells});
                }
            }
            if (tableColumns.length === 0) return;

            const label = document.createElement("label");
            label.style.marginLeft = "12px";
            label.textContent = "Erweiterte Optionen anzeigen ";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            const savedState = this.loadFilterState(tables[0]);
            checkbox.checked = savedState ? savedState.saleColumns === true : false;
            tables[0]._wodFilterState = {
                ...(tables[0]._wodFilterState || {}),
                saleColumns: checkbox.checked,
            };
            checkbox.title = "Erweiterte Optionen in der Tabelle einblenden";
            checkbox.dataset.wodSaleColumns = "true";
            checkbox.addEventListener("change", () => {
                const table = tables[0];
                const currentState = this.loadFilterState(table) || {};
                this.saveFilterState(table, {
                    ...currentState,
                    saleColumns: checkbox.checked,
                });
                for (const {table, columnIndexes, saleHeaderCells} of tableColumns) {
                    for (const cell of saleHeaderCells) {
                        cell.style.display = checkbox.checked ? "" : "none";
                    }
                    const rows = [
                        ...table.tBodies[0].rows,
                        ...(table.tFoot ? table.tFoot.rows : []),
                    ];
                    for (const row of rows) {
                        let cellStart = 0;
                        for (const cell of Array.from(row.cells)) {
                            const cellEnd = cellStart + (cell.colSpan || 1);
                            if (Array.from(columnIndexes).some(index =>
                                index >= cellStart && index < cellEnd
                            )) {
                                cell.style.display = checkbox.checked ? "" : "none";
                            }
                            cellStart = cellEnd;
                        }
                    }
                }
            });
            label.append(checkbox);
            container.append(label);
            checkbox.dispatchEvent(new Event("change"));
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
            return vote === "yes" ? "rgba(128, 201, 149, 0.8)"
                : vote === "no" ? "rgba(237, 150, 150, 0.8)"
                    : "rgba(255, 224, 122, 0.8)";
        }

        static getVoteColor(decisionOrVotes, memberIds) {
            const result = this.getVoteResult(decisionOrVotes, memberIds);
            return result === "Behalten"
                ? "rgba(128, 201, 149, 0.8)"
                : result === "Verkaufen" ? "rgba(237, 150, 150, 0.8)" : "rgba(255, 224, 122, 0.8)";
        }

        static getVoteSummary(decision, votes, memberIds, memberNames) {
            const result = this.getVoteResult(decision || votes, memberIds);
            const members = memberIds || [];
            const values = members.map(memberId => votes && votes[memberId]);
            const yesVotes = values.filter(value => value === "yes").length;
            const noVotes = values.filter(value => value === "no").length;
            const openVotes = members.length - yesVotes - noVotes;
            const summary = [
                `Einzel-Votes: Ja: ${yesVotes}, Nein: ${noVotes}, Offen: ${openVotes}`,
                `Einzel-Ergebnis: ${this.getVoteResult(votes, members)}`,
                "Einzel-Abstimmungen:",
            ];
            for (const memberId of members) {
                const vote = votes && votes[memberId];
                if (vote !== "yes" && vote !== "no") continue;
                const voteText = vote === "yes"
                    ? "Behalten"
                    : "Verkaufen";
                const memberName = memberNames && memberNames[memberId] || memberId;
                summary.push(`- ${memberName}: ${voteText}`);
            }
            if (decision && decision.decidedBy) {
                const decidedBy = decision.decidedBy.name || decision.decidedBy.id || "Unbekannter Held";
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


    }

    try {
        Mod.startMod();
    } catch (e) {
        console.error(e);
        throw e;
    }
})();