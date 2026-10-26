// ==UserScript==
// @name           [WoD] ItemVerwaltung
// @version        0.1.2
// @author         demawi
// @namespace      demawi
// @description    Hilfe bei der ItemVerwaltung innerhalb einer Gruppe
//
// @match          *://*.world-of-dungeons.de/wod/spiel/*
// @exclude-match  *://*.world-of-dungeons.de/wod/spiel/*item.php*
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
// @icon         https://world-of-dungeons.de/wod/css/WOD.gif
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
            await _.startMod();
            const view = _.WoD.getView(window);
            this.standardSortierungenLinks();
            if(view === _.WoD.VIEW.MY_GROUP) {
                await this.synchronizeGroupHeroes();
            }
            if (view === _.WoD.VIEW.SCHATZKAMMER || view === _.WoD.VIEW.GRUPPENLAGER) {
                this.formularStandardSortierung();
            }
            if (view === _.WoD.VIEW.SCHATZKAMMER || view === _.WoD.VIEW.GRUPPENLAGER || view === _.WoD.VIEW.ITEMS_STORE) {
                this.resetFilterStateForLinkedPage();
                this.insertGroupRepositoryUi();
            }
        }

        static async synchronizeGroupHeroes() {
            try {
                const heroes = _.MyGroupView.getHeroes();
                const currentHeroId = String(_.WoD.getMyHeroId());
                const currentHeroName = _.WoD.getMyHeroName() || "Unbekannter Held";
                const repository = await firebase.connectScoped(
                    "group",
                    "meta",
                    undefined,
                    _.WoD.getMyHeroId(),
                    currentHeroName,
                    false
                );
                const repositoryHeroes = repository.initialData.heroes || {};
                const synchronizedHeroes = {};
                for (const [heroId, hero] of Object.entries(repositoryHeroes)) {
                    if (!hero || typeof hero !== "object") continue;
                    synchronizedHeroes[heroId] = {
                        id: String(hero.id || heroId),
                        name: typeof hero.name === "string" ? hero.name : "",
                        ...(typeof hero.playerName === "string" && hero.playerName
                            ? {playerName: hero.playerName}
                            : {}),
                    };
                }
                for (const hero of heroes) {
                    if (!hero || hero.id === undefined || hero.id === null) continue;
                    const heroId = String(hero.id);
                    if (heroId === "") continue;
                    synchronizedHeroes[heroId] = {
                        ...(synchronizedHeroes[heroId] || {}),
                        id: heroId,
                        name: typeof hero.name === "string" ? hero.name : "",
                    };
                }
                synchronizedHeroes[currentHeroId] = {
                    ...(synchronizedHeroes[currentHeroId] || {}),
                    id: currentHeroId,
                    name: synchronizedHeroes[currentHeroId]
                        && synchronizedHeroes[currentHeroId].name || currentHeroName,
                    playerName: _.WoD.getMyUserName() || "",
                };
                const metadataUpdates = {
                    [`meta/access/${currentHeroId}`]: {
                        name: currentHeroName,
                        accessAt: {".sv": "timestamp"},
                    },
                };
                for (const [heroId, hero] of Object.entries(synchronizedHeroes)) {
                    metadataUpdates[`meta/heroes/${heroId}`] = hero;
                }
                await repository.update("", metadataUpdates);
            } catch (error) {
                console.warn("Gruppenhelden konnten nicht mit Firebase synchronisiert werden.", error);
            }
        }

        /**
         * Seiten, welche die Gegenstandsliste direkt beim ersten Aufruf ausliefern müssen auch direkt die Sortierung mit übergeben.
         * Dies ist für die Seite "Lager" und "Meine Verkäufe" der Fall.
         * "Keller" zwar auch, aber dort wollen wir keine Standardsortierung.
         */
        static standardSortierungenLinks() {
            // Meine Verkäufe: Älteste zuerst
            document.querySelectorAll("a[href*=\"items.php?view=market\"]").forEach(a => a.href += "&ITEMS_MARKET_SORT_DIR=ASC&ITEMS_MARKET_SORT_COL=8");
            // Lager: Neueste zuerst
            document.querySelectorAll("a[href*=\"items.php\"]:not([href*=\"goto=\"]):not([href*=\"view=\"])").forEach(a => a.href += "&ITEMS_LAGER_DO_SORT[8_DESC_PAGE_1]=Lager-");
        }

        static formularStandardSortierung() {
            // Standarsuche nach Lagerdauer für die Schatzkammer
            var checkInitial = document.getElementsByClassName("message_success")[0];
            if (checkInitial && checkInitial.innerText.includes("Gib bitte deine Suchkriterien ein und klicke auf Suchen")) {
                var input = document.createElement("input");
                input.type = "hidden";
                input.name = "ITEMS_GROUPCELLAR_DO_SORT[6_DESC_PAGE_1]";
                document.getElementsByName("the_form")[0].append(input);

            }
        }

        static insertGroupRepositoryUi() {
            const itemSelect = document.querySelector(
                "table.content_table tbody select[name^=\"EquipItem[\"]"
            );
            if (!itemSelect) return;
            const container = firebase.createRepositoryUi(
                "group",
                (repository, repositoryData) => this.addItemVotes(repository, repositoryData),
                {dataPath: "meta", recordAccess: false}
            );
            container.dataset.wodItemverwaltungRepository = "true";
            const contentTable = itemSelect.closest("table");
            contentTable.parentElement.insertBefore(container, contentTable);
        }

        static async addItemVotes(repository, initialRepositoryData) {
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
            for (const cell of header.cells) {
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

            const repositoryData = initialRepositoryData
                && initialRepositoryData.meta
                ? initialRepositoryData
                : {meta: initialRepositoryData || {}};
            const items = {};
            const pageItems = new Map();
            for (const row of rows) {
                const itemLink = row.children[1] && row.children[1].querySelector("a");
                if (!itemLink) continue;
                const itemName = itemLink.textContent.replace(/!$/, "").trim();
                const itemBaseName = _.WoDItemDb.getBaseName(itemName);
                if (!itemBaseName) continue;
                pageItems.set(this.getItemKey(itemBaseName), itemBaseName);
            }
            await Promise.all(Array.from(pageItems.keys()).map(async itemKey => {
                items[itemKey] = await repository.get(`items/${itemKey}`) || {};
            }));
            const characterId = _.WoD.getMyHeroId();
            table._wodCharacterId = characterId;
            const characterName = _.WoD.getMyHeroName() || "Unbekannter Held";
            const playerName = _.WoD.getMyUserName() || "";
            if (characterId !== undefined && characterId !== null) {
                const currentHero = {
                    id: String(characterId),
                    name: characterName,
                    playerName,
                };
                try {
                    await repository.update("", {
                        [`meta/access/${characterId}`]: {
                            name: characterName,
                            accessAt: {".sv": "timestamp"},
                        },
                        [`meta/heroes/${characterId}`]: currentHero,
                    });
                    repositoryData.meta = repositoryData.meta || {};
                    repositoryData.meta.heroes = repositoryData.meta.heroes || {};
                    repositoryData.meta.heroes[String(characterId)] = currentHero;
                } catch (error) {
                    console.warn("Aktueller Held konnte nicht mit Firebase synchronisiert werden.", error);
                }
            }
            const access = repositoryData.meta && repositoryData.meta.access || {};
            const heroes = repositoryData.meta && repositoryData.meta.heroes || {};
            const memberIds = Array.from(new Set([
                ...Object.keys(heroes),
                ...Object.keys(access),
            ]));
            const memberNames = Object.fromEntries(
                Object.entries(heroes)
                    .map(([memberId, hero]) => [memberId, hero && hero.name || memberId])
            );
            const ownHeroIds = new Set(
                Object.entries(heroes)
                    .filter(([, hero]) =>
                        hero && hero.playerName
                        && hero.playerName === _.WoD.getMyUserName()
                    )
                    .map(([heroId]) => heroId)
            );
            ownHeroIds.add(String(characterId));
            Object.defineProperty(memberNames, "_ownHeroIds", {
                value: ownHeroIds,
                enumerable: false,
            });
            Object.assign(
                memberNames,
                Object.fromEntries(
                    Object.entries(access)
                        .map(([memberId, entry]) => [memberId, entry && entry.name || memberId])
                )
            );
            memberNames[characterId] = characterName;
            if (!memberIds.includes(characterId)) {
                memberIds.push(characterId);
            }
            const voteViews = new Map();
            const itemNames = new Map();
            const ensureItemName = async (itemKey, itemBaseName) => {
                const itemData = items[itemKey];
                if (itemData && typeof itemData.name === "string" && itemData.name !== "") {
                    return;
                }
                await repository.set(`items/${itemKey}/name`, itemBaseName);
                items[itemKey] = {
                    ...(itemData || {}),
                    name: itemBaseName,
                };
            };
            const saveGroupDecision = async (itemKey, decision, selectedPrimaryHero) => {
                const itemData = items[itemKey] || {};
                const groupDecision = itemData.groupDecision || {};
                const primaryHero = selectedPrimaryHero
                    || groupDecision.primaryHero
                    || itemData.primaryHero
                    || "";
                if (groupDecision.value === decision
                    && (groupDecision.primaryHero || "") === primaryHero) {
                    return null;
                }
                await ensureItemName(itemKey, itemNames.get(itemKey));
                const nextGroupDecision = {
                    value: decision,
                    primaryHero,
                    decidedBy: {
                        id: characterId,
                        name: characterName,
                    },
                    decidedAt: {".sv": "timestamp"},
                };
                await repository.set(`items/${itemKey}/groupDecision`, nextGroupDecision);
                items[itemKey] = {
                    ...items[itemKey],
                    groupDecision: nextGroupDecision,
                };
                return nextGroupDecision;
            };
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
                    await ensureItemName(itemKey, itemBaseName);
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
                row.dataset.wodPrimaryHero = itemData.groupDecision
                    && itemData.groupDecision.primaryHero
                    || itemData.primaryHero
                    || "";
                row.dataset.wodItemKey = itemKey;
                row.dataset.wodVoteUnusable = isUnusable ? "true" : "false";
                // Create vote cell and insert it before the "Lager-dauer" cell when possible
                const voteCell = document.createElement('td');
                voteCell.align = "center";
                voteCell.style.position = "relative";
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
                const cellBackgroundColor = this.getEffectiveBackgroundColor(refCell || row);
                voteCell.style.backgroundColor = cellBackgroundColor;

                let currentVote = isUnusable ? "no" : itemData.votes && itemData.votes[characterId] || "";
                row.dataset.wodIndividualVote = currentVote;
                const characterVoteContainer = document.createElement("span");
                characterVoteContainer.title = "Eigene Entscheidung";
                characterVoteContainer.style.position = "absolute";
                characterVoteContainer.style.top = "0";
                characterVoteContainer.style.left = "0";
                characterVoteContainer.style.bottom = "0";
                characterVoteContainer.style.width = "65%";
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
                yesButton.style.cursor = "pointer";
                noButton.style.cursor = "pointer";
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
                characterDecisionIndicator.style.flex = "0 0 65%";
                characterDecisionIndicator.style.backgroundColor = itemData.groupDecision
                    ? currentVote ? this.getCharacterVoteColor(currentVote) : "transparent"
                    : this.getCharacterVoteColor(currentVote);

                const groupDecisionIndicator = document.createElement("span");
                groupDecisionIndicator.style.flex = "0 0 35%";
                groupDecisionIndicator.style.borderLeft = `2px solid ${cellBackgroundColor}`;
                groupDecisionIndicator.style.boxSizing = "border-box";
                let currentGroupDecision = itemData.groupDecision || itemData.primaryHero
                    ? {
                        ...(itemData.groupDecision || {}),
                        primaryHero: itemData.groupDecision
                            && itemData.groupDecision.primaryHero
                            || itemData.primaryHero
                            || "",
                    }
                    : null;
                groupDecisionIndicator.style.backgroundColor = this.getVoteColor(
                    currentGroupDecision || itemData.votes,
                    memberIds
                );
                groupDecisionIndicator.textContent = this.getPrimaryHeroMarker(
                    currentGroupDecision && currentGroupDecision.primaryHero,
                    memberNames
                );
                groupDecisionIndicator.style.textAlign = "center";
                groupDecisionIndicator.style.display = "flex";
                groupDecisionIndicator.style.alignItems = "center";
                groupDecisionIndicator.style.justifyContent = "center";
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
                        const displayDecision = decision || items[itemKey] && items[itemKey].primaryHero
                            ? {
                                ...(decision || {}),
                                primaryHero: decision && decision.primaryHero
                                    || items[itemKey] && items[itemKey].primaryHero
                                    || "",
                            }
                            : null;
                        groupDecisionIndicator.style.backgroundColor = this.getVoteColor(
                            decision || votes,
                            updatedMemberIds
                        );
                        groupDecisionIndicator.textContent = this.getPrimaryHeroMarker(
                            displayDecision && displayDecision.primaryHero,
                            memberNames
                        );
                        groupDecisionIndicator.title = this.getVoteSummary(
                            displayDecision,
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
                        row.dataset.wodPrimaryHero = decision
                            && decision.primaryHero
                            || items[itemKey] && items[itemKey].primaryHero
                            || "";
                        currentVote = votes && votes[characterId] || "";
                        row.dataset.wodIndividualVote = currentVote;
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
                        await ensureItemName(itemKey, itemBaseName);
                        if (nextVote === "") {
                            await repository.remove(`items/${itemKey}/votes/${characterId}`);
                        } else {
                            await repository.set(`items/${itemKey}/votes/${characterId}`, nextVote);
                        }
                        currentVote = nextVote;
                        const updatedItem = {
                            ...(items[itemKey] || {}),
                            votes: {...(items[itemKey] && items[itemKey].votes || {})},
                        };
                        if (nextVote === "") {
                            delete updatedItem.votes[characterId];
                        } else {
                            updatedItem.votes[characterId] = nextVote;
                        }
                        items[itemKey] = updatedItem;
                        const updatedMemberIds = memberIds;
                        for (const view of voteViews.get(itemKey) || []) {
                            view.setState(
                                updatedItem && updatedItem.groupDecision,
                                updatedItem && updatedItem.votes,
                                updatedMemberIds
                            );
                        }
                        this.updateVoteFilter(table, filter.value, table._wodVoteCombineItems.checked);
                        updateBulkDecisionIndicators();
                    } catch (error) {
                        console.error("Einzelentscheidung konnte nicht gespeichert werden.", error);
                    } finally {
                        yesButton.style.pointerEvents = "";
                        noButton.style.pointerEvents = "";
                    }
                };
                const saveDecision = async (decision, selectedPrimaryHero) => {
                    try {
                        const groupDecision = await saveGroupDecision(
                            itemKey,
                            decision,
                            selectedPrimaryHero
                        );
                        if (!groupDecision) {
                            return;
                        }
                        for (const view of voteViews.get(itemKey) || []) {
                            view.setState(
                                groupDecision,
                                items[itemKey].votes,
                                memberIds
                            );
                        }
                        this.updateVoteFilter(table, filter.value, table._wodVoteCombineItems.checked);
                        updateBulkDecisionIndicators();
                    } catch (error) {
                        console.error("Gruppenentscheidung konnte nicht gespeichert werden.", error);
                    }
                };
                const savePrimaryHero = async primaryHero => {
                    try {
                        if (!currentGroupDecision || !currentGroupDecision.value) {
                            await ensureItemName(itemKey, itemBaseName);
                            if (primaryHero) {
                                await repository.set(`items/${itemKey}/primaryHero`, primaryHero);
                            } else {
                                await repository.remove(`items/${itemKey}/primaryHero`);
                            }
                            items[itemKey] = {
                                ...(items[itemKey] || {}),
                                primaryHero,
                            };
                            currentGroupDecision = {primaryHero};
                            row.dataset.wodPrimaryHero = primaryHero;
                            groupDecisionIndicator.textContent = this.getPrimaryHeroMarker(
                                primaryHero,
                                memberNames
                            );
                            groupDecisionIndicator.title = this.getVoteSummary(
                                currentGroupDecision,
                                items[itemKey].votes,
                                memberIds,
                                memberNames
                            );
                            this.updateVoteFilter(table, filter.value, table._wodVoteCombineItems.checked);
                            updateBulkDecisionIndicators();
                            return;
                        }
                        await repository.set(`items/${itemKey}/groupDecision`, {
                            ...currentGroupDecision,
                            primaryHero,
                            decidedBy: {
                                id: characterId,
                                name: characterName,
                            },
                            decidedAt: {".sv": "timestamp"},
                        });
                        currentGroupDecision = {
                            ...currentGroupDecision,
                            primaryHero,
                        };
                        items[itemKey] = {
                            ...(items[itemKey] || {}),
                            groupDecision: currentGroupDecision,
                        };
                        row.dataset.wodPrimaryHero = primaryHero;
                        groupDecisionIndicator.textContent = this.getPrimaryHeroMarker(
                            primaryHero,
                            memberNames
                        );
                        items[itemKey] = {
                            ...(items[itemKey] || {}),
                            groupDecision: currentGroupDecision,
                        };
                        groupDecisionIndicator.title = this.getVoteSummary(
                            currentGroupDecision,
                            items[itemKey].votes,
                            memberIds,
                            memberNames
                        );
                        this.updateVoteFilter(table, filter.value, table._wodVoteCombineItems.checked);
                        updateBulkDecisionIndicators();
                    } catch (error) {
                        console.error("Primärer Held konnte nicht gespeichert werden.", error);
                    }
                };
                groupDecisionIndicator.addEventListener("click", () => {
                    this.showDecisionChoice(
                        groupDecisionIndicator,
                        saveDecision,
                        currentGroupDecision || {
                            primaryHero: items[itemKey] && items[itemKey].primaryHero || "",
                        },
                        memberNames,
                        savePrimaryHero
                    );
                });
            }
            const voteHeader = header.querySelector("[data-wod-vote-header-cell]");
            const getCommonPrimaryHero = () => {
                const visibleItemKeys = new Set(
                    rows
                        .filter(row => row.parentElement === tbody)
                        .map(row => row.dataset.wodItemKey)
                        .filter(Boolean)
                );
                if (visibleItemKeys.size === 0) return "";
                const primaryHeroes = Array.from(visibleItemKeys).map(itemKey => {
                    const itemData = items[itemKey];
                    return itemData && itemData.groupDecision
                        && itemData.groupDecision.primaryHero
                        || itemData && itemData.primaryHero
                        || "";
                });
                const firstPrimaryHero = primaryHeroes[0];
                return primaryHeroes.every(primaryHero => primaryHero === firstPrimaryHero)
                    ? firstPrimaryHero
                    : "";
            };
            const updateBulkDecisionIndicators = () => {
                const visibleItemKeys = new Set(
                    rows
                        .filter(row => row.parentElement === tbody)
                        .map(row => row.dataset.wodItemKey)
                        .filter(Boolean)
                );
                const visibleItems = Array.from(visibleItemKeys)
                    .map(itemKey => items[itemKey])
                    .filter(Boolean);
                const visibleRows = rows.filter(row => row.parentElement === tbody);
                const individualVotes = visibleRows.map(
                    row => row.dataset.wodIndividualVote || ""
                );
                const groupDecisions = visibleItems.map(
                    itemData => itemData.groupDecision && itemData.groupDecision.value || ""
                );
                const individualVoteControlsVisible = visibleRows.map(
                    row => row.dataset.wodVoteUnusable !== "true"
                );
                const commonValue = values => values.length > 0
                && values.every(value => value === values[0])
                    ? values[0]
                    : "";
                const commonBoolean = values => values.length > 0
                && values.every(value => value === values[0])
                    ? values[0]
                    : null;
                const voteContainer = voteHeader.querySelector("[data-wod-bulk-vote]");
                const groupContainer = voteHeader.querySelector("[data-wod-bulk-group-decision]");
                if (voteContainer) {
                    const commonVote = commonValue(individualVotes);
                    const backgroundColor = commonVote
                        ? this.getCharacterVoteColor(commonVote)
                        : "transparent";
                    voteContainer.style.setProperty(
                        "background-color",
                        backgroundColor,
                        "important"
                    );
                    const controlsVisible = commonBoolean(individualVoteControlsVisible);
                    for (const button of voteContainer.children) {
                        button.style.display = controlsVisible === false ? "none" : "";
                    }
                }
                if (groupContainer) {
                    const commonDecision = commonValue(groupDecisions);
                    groupContainer.style.backgroundColor = commonDecision
                        ? this.getVoteColor({value: commonDecision}, memberIds)
                        : "#ffe07a";
                    groupContainer.textContent = this.getPrimaryHeroMarker(
                        getCommonPrimaryHero(),
                        memberNames
                    );
                    groupContainer.style.display = "flex";
                    groupContainer.style.alignItems = "center";
                    groupContainer.style.justifyContent = "center";
                }
            };
            this.createBulkDecisionControls(voteHeader, async (decision, primaryHero) => {
                try {
                    const visibleItemKeys = new Set(
                        rows
                            .filter(row => row.parentElement === tbody)
                            .map(row => row.dataset.wodItemKey)
                            .filter(Boolean)
                    );
                    for (const itemKey of visibleItemKeys) {
                        await saveGroupDecision(itemKey, decision, primaryHero);
                    }
                    const updatedMemberIds = memberIds;
                    for (const [itemKey, views] of voteViews) {
                        const updatedItem = items[itemKey];
                        for (const view of views) {
                            view.setState(
                                updatedItem && updatedItem.groupDecision,
                                updatedItem && updatedItem.votes,
                                updatedMemberIds
                            );
                        }
                    }
                    this.updateVoteFilter(table, filter.value, table._wodVoteCombineItems.checked);
                    updateBulkDecisionIndicators();
                } catch (error) {
                    console.error("Gruppenentscheidung für alle Items konnte nicht gespeichert werden.", error);
                }
            }, memberNames, async primaryHero => {
                try {
                    const visibleItemKeys = new Set(
                        rows
                            .filter(row => row.parentElement === tbody)
                            .map(row => row.dataset.wodItemKey)
                            .filter(Boolean)
                    );
                    for (const itemKey of visibleItemKeys) {
                        const itemData = items[itemKey];
                        if (!itemData) {
                            continue;
                        }
                        await ensureItemName(itemKey, itemNames.get(itemKey));
                        let updatedItem = itemData;
                        if (itemData.groupDecision) {
                            if ((itemData.groupDecision.primaryHero || "") === (primaryHero || "")) {
                                continue;
                            }
                            const groupDecision = {
                                ...itemData.groupDecision,
                                primaryHero,
                                decidedBy: {
                                    id: characterId,
                                    name: characterName,
                                },
                                decidedAt: {".sv": "timestamp"},
                            };
                            await repository.set(`items/${itemKey}/groupDecision`, groupDecision);
                            updatedItem = {...itemData, groupDecision};
                        } else {
                            if ((itemData.primaryHero || "") === (primaryHero || "")) {
                                continue;
                            }
                            if (primaryHero) {
                                await repository.set(`items/${itemKey}/primaryHero`, primaryHero);
                            } else {
                                await repository.remove(`items/${itemKey}/primaryHero`);
                            }
                            updatedItem = {...itemData, primaryHero};
                        }
                        items[itemKey] = updatedItem;
                        for (const view of voteViews.get(itemKey) || []) {
                            view.setState(
                                updatedItem.groupDecision,
                                updatedItem.votes,
                                memberIds
                            );
                        }
                    }
                    this.updateVoteFilter(table, filter.value, table._wodVoteCombineItems.checked);
                    updateBulkDecisionIndicators();
                } catch (error) {
                    console.error("Primäre Helden konnten nicht gespeichert werden.", error);
                }
            }, () => ({
                primaryHero: getCommonPrimaryHero(),
            }));
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
                        const itemData = items[itemKey];
                        if (itemData && itemData.votes
                            && itemData.votes[characterId] === vote) {
                            continue;
                        }
                        await ensureItemName(itemKey, itemBaseName);
                        await repository.set(`items/${itemKey}/votes/${characterId}`, vote);
                        items[itemKey] = {
                            ...(items[itemKey] || {}),
                            votes: {
                                ...(items[itemKey] && items[itemKey].votes || {}),
                                [characterId]: vote,
                            },
                        };
                    }
                    const updatedMemberIds = memberIds;
                    for (const [itemKey, views] of voteViews) {
                        const updatedItem = items[itemKey];
                        for (const view of views) {
                            view.setState(
                                updatedItem && updatedItem.groupDecision,
                                updatedItem && updatedItem.votes,
                                updatedMemberIds
                            );
                        }
                    }
                    this.updateVoteFilter(table, filter.value, table._wodVoteCombineItems.checked);
                    updateBulkDecisionIndicators();
                } catch (error) {
                    console.error("Einzelentscheidung für alle Items konnte nicht gespeichert werden.", error);
                }
            });
            updateBulkDecisionIndicators();
            this.updateVoteFilter(table, filter.value, table._wodVoteCombineItems.checked);
        }

        static showDecisionChoice(
            anchor,
            saveDecision,
            currentDecision,
            memberNames,
            savePrimaryHero
        ) {
            const existingChoice = document.querySelector("[data-wod-group-decision-choice]");
            if (existingChoice) existingChoice.remove();

            const choice = document.createElement("span");
            choice.dataset.wodGroupDecisionChoice = "true";
            choice.style.position = "absolute";
            choice.style.zIndex = "2";
            choice.style.display = "inline-flex";
            choice.style.alignItems = "center";
            choice.style.width = "max-content";
            choice.style.backgroundColor = "white";
            choice.style.border = "1px solid #888";
            choice.style.padding = "0";
            choice.style.margin = "0";
            choice.style.whiteSpace = "nowrap";
            const primaryHero = document.createElement("select");
            primaryHero.title = "Primär nutzender Held";
            primaryHero.style.margin = "0 2px";
            const emptyOption = document.createElement("option");
            emptyOption.value = "";
            emptyOption.textContent = "Primärer Held";
            primaryHero.append(emptyOption);
            const sortedHeroes = Object.entries(memberNames || {})
                .sort(([heroIdA, heroNameA], [heroIdB, heroNameB]) =>
                    Number(memberNames._ownHeroIds && memberNames._ownHeroIds.has(heroIdB))
                    - Number(memberNames._ownHeroIds && memberNames._ownHeroIds.has(heroIdA))
                    || String(heroNameA).localeCompare(String(heroNameB), "de", {
                        sensitivity: "base",
                    }) || heroIdA.localeCompare(heroIdB)
                );
            const ownHeroIds = memberNames._ownHeroIds || new Set();
            const ownHeroes = sortedHeroes.filter(([heroId]) => ownHeroIds.has(heroId));
            const otherHeroes = sortedHeroes.filter(([heroId]) => !ownHeroIds.has(heroId));
            const appendHeroOption = ([heroId, heroName]) => {
                const option = document.createElement("option");
                option.value = heroId;
                option.textContent = heroName;
                primaryHero.append(option);
            };
            ownHeroes.forEach(appendHeroOption);
            if (ownHeroes.length > 0 && otherHeroes.length > 0) {
                const separator = document.createElement("option");
                separator.disabled = true;
                separator.textContent = "────────────";
                primaryHero.append(separator);
            }
            otherHeroes.forEach(appendHeroOption);
            primaryHero.value = currentDecision && currentDecision.primaryHero || "";
            primaryHero.addEventListener("change", () => {
                if (savePrimaryHero) savePrimaryHero(primaryHero.value);
            });
            choice.append(primaryHero);
            const decisionButtons = document.createElement("span");
            decisionButtons.style.display = "inline-flex";
            decisionButtons.style.alignItems = "center";
            decisionButtons.style.backgroundColor = this.getVoteColor(
                currentDecision,
                []
            );
            for (const [value, sign, labelText] of [
                ["yes", _.UI.WOD_SIGNS.YES, "Ja"],
                ["no", _.UI.WOD_SIGNS.NO, "Nein"],
            ]) {
                const button = _.UI.createImgButton("20px", sign, () => {
                    choice.remove();
                    saveDecision(value, primaryHero.value);
                });
                button.title = labelText;
                button.style.cursor = "pointer";
                button.style.margin = "0 2px";
                decisionButtons.append(button);
            }
            choice.append(decisionButtons);
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
            choice.style.top = `${anchorBounds.top + window.scrollY}px`;
            choice.style.left = `${Math.max(
                0,
                anchorBounds.right + window.scrollX - choice.offsetWidth
            )}px`;
            return primaryHero;
        }

        static createBulkDecisionControls(
            header,
            saveDecision,
            memberNames,
            savePrimaryHero,
            getCurrentDecision
        ) {
            if (header.dataset.wodBulkGroupDecision) return;
            header.dataset.wodBulkGroupDecision = "true";
            header.title = "Gruppenentscheidung für alle Items\nDie hier getroffenen Entscheidungen gelten für alle Gegenstands-Zeilen";
            const container = document.createElement("span");
            container.dataset.wodBulkGroupDecision = "true";
            container.style.position = "absolute";
            container.style.right = "0";
            container.style.bottom = "0";
            container.style.width = "35%";
            container.style.height = "20px";
            container.style.borderLeft =
                `2px solid ${this.getEffectiveBackgroundColor(header)}`;
            container.style.boxSizing = "border-box";
            container.style.backgroundColor = "#ffe07a";
            container.style.cursor = "pointer";
            container.title = "Gruppenentscheidung für alle Items";
            header.append(container);
            container.addEventListener("click", () => {
                this.showDecisionChoice(
                    container,
                    (decision, primaryHero) => saveDecision(decision, primaryHero),
                    getCurrentDecision ? getCurrentDecision() : null,
                    memberNames,
                    savePrimaryHero
                );
            });
        }

        static createBulkVoteControls(header, saveVote) {
            if (header.dataset.wodBulkVote) return;
            header.dataset.wodBulkVote = "true";
            const container = document.createElement("span");
            container.dataset.wodBulkVote = "true";
            container.style.position = "absolute";
            container.style.left = "0";
            container.style.bottom = "0";
            container.style.width = "65%";
            container.style.height = "20px";
            container.style.display = "inline-flex";
            container.style.alignItems = "center";
            container.style.justifyContent = "center";
            container.style.gap = "2px";
            container.style.zIndex = "1";
            container.title = "Einzelentscheidung für alle angezeigten Items";
            header.append(container);
            for (const [value, sign, title] of [
                ["yes", _.UI.WOD_SIGNS.YES, "Behalten für alle angezeigten Items"],
                ["no", _.UI.WOD_SIGNS.NO, "Verkaufen für alle angezeigten Items"],
            ]) {
                const button = _.UI.createImgButton("20px", sign, () => saveVote(value));
                button.title = title;
                button.style.cursor = "pointer";
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
            container.textContent = "Votingfilter: ";

            filter = document.createElement("select");
            filter.title = "Gegenstandstabelle nach dem Gruppenentscheid filtern";
            const options = [
                ["all", "Alle"],
                ["me-open", "Eigen: Offen"],
                ["me-primary", "Eigen: Für mich"],
                ["group-open", "Gruppe: Offen"],
                ["group-keep", "Gruppe: Behalten"],
                ["group-sell", "Gruppe: Verkaufen"],
            ];
            for (const [value, text] of options) {
                const option = document.createElement("option");
                option.value = value;
                option.dataset.wodFilterLabel = text;
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
            combineItems.checked = savedState ? savedState.combineItems === true : false;
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
            table._wodVoteFilter = filter;
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
                "Übergeben an",
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
                    const getColumnCount = row => Array.from(row.cells)
                        .reduce((count, cell) => count + (cell.colSpan || 1), 0);
                    const itemRows = Array.from(table.tBodies)
                        .flatMap(body => Array.from(body.rows))
                        .filter(row => row.querySelector('select[name^="EquipItem["]'));
                    const bodyColumnCount = Math.max(
                        0,
                        ...itemRows.map(getColumnCount)
                    );
                    const sortHeaderRows = headerRows.filter(row =>
                        row.querySelector('input[name*="_DO_SORT"]')
                    );
                    const sortHeaderColumnCount = Math.max(
                        0,
                        ...sortHeaderRows.map(getColumnCount)
                    );
                    const columnCount = Math.max(
                        bodyColumnCount,
                        sortHeaderColumnCount
                    );
                    const existingColgroup = table.querySelector(
                        "colgroup[data-wod-sale-column-group]"
                    );
                    if (existingColgroup) existingColgroup.remove();
                    const colgroup = document.createElement("colgroup");
                    colgroup.dataset.wodSaleColumnGroup = "true";
                    const columns = [];
                    for (let index = 0; index < columnCount; index++) {
                        const column = document.createElement("col");
                        colgroup.append(column);
                        columns.push(column);
                    }
                    table.insertBefore(colgroup, table.tHead || table.firstChild);
                    tableColumns.push({table, columnIndexes, columns});
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
                for (const {table, columnIndexes, columns} of tableColumns) {
                    for (const [index, column] of columns.entries()) {
                        column.style.visibility = columnIndexes.has(index) && !checkbox.checked
                            ? "collapse"
                            : "";
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
            this.updateVoteFilterCounts(table, rows, combineItems);
            const visibleItemKeys = new Set();
            const visibleRows = [];
            for (const row of rows) {
                if (!row.dataset.wodVoteResult) continue;
                const matchesFilter = filterValue === "all"
                    || filterValue === "me-open"
                    && row.dataset.wodIndividualVoteOpen === "true"
                    || filterValue === "me-primary"
                    && row.dataset.wodPrimaryHero === table._wodCharacterId
                    || filterValue === "group-open"
                    && row.dataset.wodGroupDecisionOpen === "true"
                    || filterValue === "group-keep" && row.dataset.wodVoteResult === "Behalten"
                    || filterValue === "group-sell" && row.dataset.wodVoteResult === "Verkaufen";
                const isDuplicate = combineItems
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

        static updateVoteFilterCounts(table, rows, combineItems) {
            const filter = table._wodVoteFilter;
            if (!filter) return;

            const options = Array.from(filter.options);
            const counts = Object.fromEntries(options.map(option => [option.value, 0]));
            const countedItems = Object.fromEntries(
                options.map(option => [option.value, new Set()])
            );
            const matchesFilter = (row, filterValue) => filterValue === "all"
                || filterValue === "me-open"
                && row.dataset.wodIndividualVoteOpen === "true"
                || filterValue === "me-primary"
                && row.dataset.wodPrimaryHero === table._wodCharacterId
                || filterValue === "group-open"
                && row.dataset.wodGroupDecisionOpen === "true"
                || filterValue === "group-keep"
                && row.dataset.wodVoteResult === "Behalten"
                || filterValue === "group-sell"
                && row.dataset.wodVoteResult === "Verkaufen";

            for (const [rowIndex, row] of rows.entries()) {
                if (!row.dataset.wodVoteResult) continue;
                for (const option of options) {
                    if (!matchesFilter(row, option.value)) continue;
                    if (!combineItems) {
                        counts[option.value] += 1;
                        continue;
                    }
                    const itemKey = row.dataset.wodItemKey || `row-${rowIndex}`;
                    if (countedItems[option.value].has(itemKey)) continue;
                    countedItems[option.value].add(itemKey);
                    counts[option.value] += 1;
                }
            }
            for (const option of options) {
                option.textContent = `${option.dataset.wodFilterLabel} (${counts[option.value]})`;
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

        static getEffectiveBackgroundColor(element) {
            let current = element;
            while (current) {
                const backgroundColor = getComputedStyle(current).backgroundColor;
                if (backgroundColor !== "transparent"
                    && backgroundColor !== "rgba(0, 0, 0, 0)") {
                    return backgroundColor;
                }
                current = current.parentElement;
            }
            return "transparent";
        }

        static getPrimaryHeroMarker(primaryHero, memberNames) {
            if (!primaryHero) return "";
            const heroName = memberNames && memberNames[primaryHero] || primaryHero;
            return Array.from(heroName.trim()).slice(0, 2).join("");
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
            if (decision && decision.primaryHero) {
                const primaryHero = memberNames && memberNames[decision.primaryHero]
                    || decision.primaryHero;
                summary.unshift(`=> ${primaryHero}`);
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