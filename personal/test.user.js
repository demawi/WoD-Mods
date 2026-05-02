// ==UserScript==
// @name        WOD Dungeon Success State for Groups
// @namespace   http://world-of-dungeons.de
// @description Show success state of visited dungeons at report list and dungeon overview
// @match       *://*.world-of-dungeons.de/wod/spiel/dungeon/dungeon.php*
// @match       *://*.world-of-dungeons.de/wod/spiel/dungeon/report.php*
// @match       *://*.world-of-dungeons.de/wod/spiel//dungeon/report.php*
// @match       *://*.oldages.de/wod/spiel/dungeon/dungeon.php*
// @match       *://*.oldages.de/wod/spiel/dungeon/report.php*
// @match       *://*.oldages.de/wod/spiel//dungeon/report.php*
// @version     1.6.0
// @run-at 	    document-idle
// ==/UserScript==

(function () {
    "use strict";

    const oUpdateEvent = new CustomEvent('checkForUpdates', {
        detail: {
            name: GM.info.script.name,
            version: GM.info.script.version
        }
    });
    document.dispatchEvent(oUpdateEvent);

    const wodDungeonSuccessStateForGroups = {
        PAGE_DUNGEON_LIST: "dungeonList",
        PAGE_REPORT_DETAILS: "reportDetails",
        PAGE_REPORT_LIST: "reportList",

        S_COLOR_STATUS_COMPLETE: "#3e9c3e",
        S_COLOR_STATUS_PARTIAL_COMPLETE: "#c2c229",
        S_COLOR_STATUS_INCOMPLETE: "#cb2f2f",

        S_FONT_COLOR_STATUS_PARTIAL_COMPLETE: "black",

        oDb: {},
        sDbName: "wodDungeonSuccessStateForGroups",
        iDbVersion: 1,
        iDbActiveVersion: 0,
        sDbStoreNameStatusReportList: "statusReportList",
        sDbStoreNameStatusDungeonList: "statusDungeonList",
        sDbIndexReportId: "reportId",
        sDbIndexDungeonName: "dungeonName",
        sDbIndexGroupId: "groupId",
        sDbIndexAvgRates: "avgRates",
        sDbIndexHighestRate: "highestRate",
        sDbIndexLowestRate: "lowestRate",

        iGroupId: Number,
        sDungeonName: String,
        iReportId: Number,

        blIsDungeonList: false,
        blIsReportDetails: false,
        blIsReportList: false,
        sActivePage: String,

        oForm: Element,
        oTables: NodeList,

        init() {
            let me = this;

            me.getElements();
            me.setPageStatus();
            me.getGroupId();

            switch (me.sActivePage) {
                case me.PAGE_DUNGEON_LIST:
                    me.initDb(me.getAllDungeonEntries);
                    break;
                case me.PAGE_REPORT_DETAILS:
                    if (!me.checkIsOwnGroup()) {
                        console.log("Found you, Superuser! ;)");
                        // superuser in anderer gruppe
                        break;
                    }

                    me.getDetailDungeonName();

                    let oSuccess = me.getDetailSuccess();

                    me.getDetailReportId();

                    me.initDb(me.saveDetailReport, oSuccess);

                    break;
                case me.PAGE_REPORT_LIST:
                    me.initDb(me.getAllDetailReports);

                    break;
            }
        },

        getElements() {
            let me = this;

            me.oForm = document.forms["the_form"];
            me.oTables = me.oForm.querySelectorAll(".content_table");
        },

        setPageStatus() {
            let me = this;

            if (location.pathname.match(/dungeon.php$/)) {
                me.blIsDungeonList = true;
                me.sActivePage = me.PAGE_DUNGEON_LIST;
            } else if (location.pathname.match(/report.php$/)) {
                if (me.oForm.querySelector(":scope > input[name='report_id[0]']")) {
                    // check if we are on statistic page and not the item page...
                    if (me.oForm.querySelector(":scope > h1").textContent.match(/^Kampfstatistik:/)) {
                        me.blIsDungeonList = true;
                        me.sActivePage = me.PAGE_REPORT_DETAILS;
                    }
                } else
                    // one report_id -> battle report. report_id > 1 -> page report list
                if (me.oForm.querySelectorAll("input[name^='report_id[']").length > 1) {
                    me.blIsReportList = true;
                    me.sActivePage = me.PAGE_REPORT_LIST;
                }
            }
        },

        getGroupId() {
            let me = this;

            me.iGroupId = parseInt(me.oForm.gruppe_id.value);
        },

        checkIsOwnGroup() {
            let me = this;

            try {
                let sH1GroupName = document.querySelector("h1").textContent.match(/Kampfstatistik:\s(.*)+/)[1];
                let sHiddenGroupName = me.oForm.gruppe_name.value;

                return sH1GroupName === sHiddenGroupName;
            } catch (exception) {
                console.warn("checkIsOwnGroup exception", exception);
                return true;
            }
        },

        getDetailDungeonName() {
            let me = this;

            let sReportTitleSplits = me.oForm.querySelector("h2").textContent;

            /*
             Abfragen für, Beispiele:
             Heute 06:08 - Ein ruhiger Tag im Gasthaus ...
             Gestern 23:10 - Die Hexe von Rialb
             25.05.2019 19:06 - Ein ruhiger Tag im Gasthaus ...
            */
            let regexDungeonName = /(?:[a-z0-9.]+ [0-2][0-9]:[0-5][0-9])+? - (.+)*/gmi;

            me.sDungeonName = regexDungeonName.exec(sReportTitleSplits)[1];
        },

        getDetailReportId() {
            let me = this;

            me.iReportId = parseInt(me.oForm["report_id[0]"].value);
        },

        getDetailSuccess() {
            let me = this;

            let aExpElements = me.oTables[0].querySelector("tr:nth-child(2)").querySelectorAll("td");
            let aRoomsElements = me.oTables[0].querySelector("tr:nth-child(5)").querySelectorAll("td");
            let aSuccessRatesElements = me.oTables[0].querySelector("tr:nth-child(7)").querySelectorAll("td");
            let iGroupSize = 0;
            let iRatesSum = 0;
            let iAverageRate = 0;
            let iHighestRate = 0;
            let iLowestRate = 100;

            for (let i = 1; i < aSuccessRatesElements.length - 1; i++) {
                let oSuccessRateTd = aSuccessRatesElements[i];
                let iSuccessRate = parseInt(oSuccessRateTd.textContent);

                switch (me.sDungeonName) {
                    case "Atreanijsh":
                        // nur "komplett", wenn man mehr als 1700:ep: erhält.
                        if (!aExpElements[i].textContent.match(/17[0-9]{2}/)) {
                            iSuccessRate = 0;
                            // Besuch war nicht die finale Version des Dungeon. Wir setzen den Status auf "Teilweise geschafft" anstatt "Komplett gescheitert"
                            iHighestRate = 100;
                        }
                        break;
                    case "Bühne frei!":
                        if (iSuccessRate === 85) {
                            iSuccessRate = 100;
                        }
                        break;
                    case "Das magische Gefängnis":
                        // nur "komplett", wenn man mehr als 8 Räume hat.
                        if (!aRoomsElements[i].textContent.match(/\/8$/)) {
                            iSuccessRate = 0;
                            // Besuch war nicht die finale Version des Dungeon. Wir setzen den Status auf "Teilweise geschafft" anstatt "Komplett gescheitert"
                            iHighestRate = 100;
                        }
                        break;
                    case "Offene Rechnung":
                        // nur "komplett" wenn 7/8 Räume
                        if (iSuccessRate === 90) {
                            iSuccessRate = 100;
                        }
                        break;
                }

                iGroupSize++;
                iRatesSum += iSuccessRate;

                if (iHighestRate < iSuccessRate) {
                    iHighestRate = iSuccessRate;
                }

                if (iSuccessRate < iLowestRate) {
                    iLowestRate = iSuccessRate;
                }
            }
            iAverageRate = parseInt(iRatesSum / iGroupSize);

            return {
                iAverageRate: iAverageRate,
                iHighestRate: iHighestRate,
                iLowestRate: iLowestRate
            };
        },

        saveDetailReport(oSuccess) {
            let me = this;

            let oSave = {};
            oSave[me.sDbIndexAvgRates] = oSuccess.iAverageRate;
            oSave[me.sDbIndexHighestRate] = oSuccess.iHighestRate;
            oSave[me.sDbIndexLowestRate] = oSuccess.iLowestRate;
            oSave[me.sDbIndexGroupId] = me.iGroupId;
            console.log("save", oSave);

            try {
                let oTransactionStatusReportList = me.oDb.transaction(me.sDbStoreNameStatusReportList, "readwrite");

                oTransactionStatusReportList.oncomplete = function (event) {
                    console.log("transaction oTransactionStatusReportList complete:", event);
                };

                oTransactionStatusReportList.onerror = function (event) {
                    console.warn("transaction oTransactionStatusReportList error", event.target.error, event);
                };

                let objectStoreReportList = oTransactionStatusReportList.objectStore(me.sDbStoreNameStatusReportList);

                me.addReportDetailToDb(oSave, objectStoreReportList);
            } catch (exception) {
                console.warn("objectStoreReportList transaction exception", exception);
            }

            try {
                let oTransactionDungeonList = me.oDb.transaction(me.sDbStoreNameStatusDungeonList, "readwrite");

                oTransactionDungeonList.oncomplete = function (event) {
                    console.log("transaction oTransactionDungeonList complete:", event);
                };

                oTransactionDungeonList.onerror = function (event) {
                    console.warn("transaction oTransactionDungeonList error", event.target.error, event);
                };
                let objectStoreDungeonStatus = oTransactionDungeonList.objectStore(me.sDbStoreNameStatusDungeonList);
                let oDungeonInfo = objectStoreDungeonStatus.index(me.sDbIndexDungeonName);
                let oDungeonCursor = oDungeonInfo.openCursor(IDBKeyRange.only(me.sDungeonName));

                oDungeonCursor.onsuccess = (event) => {
                    let cursor = event.target.result;

                    if (cursor) {
                        let cSavedValues = cursor.value;

                        if (cSavedValues[me.sDbIndexGroupId] !== me.iGroupId) {
                            console.log("different group, continue");
                            cursor.continue();
                        } else {
                            if (cSavedValues[me.sDbIndexAvgRates] === 100) {
                                console.log("already perfect save");
                                return;
                            }

                            if (cSavedValues[me.sDbIndexHighestRate] > oSave[me.sDbIndexHighestRate]) {
                                console.log("highest rate dropped");
                                return;
                            }

                            if (cSavedValues[me.sDbIndexAvgRates] >= oSave[me.sDbIndexAvgRates]) {
                                console.log("avg dropped");
                                return;
                            }

                            me.putDungeonToDb(oSave, objectStoreDungeonStatus);
                        }
                    } else {
                        me.putDungeonToDb(oSave, objectStoreDungeonStatus);
                    }
                };

                oDungeonCursor.onerror = (event) => {
                    console.warn("objectStoreDungeonStatus error", event.target.error);
                    console.warn("objectStoreDungeonStatus error", event);
                };
            } catch (exception) {
                console.warn("objectStoreDungeonStatus transaction exception", exception);
            }
        },

        addReportDetailToDb(oSave, objectStore) {
            let me = this;

            let oSaveReportList = Object.assign(oSave);
            oSaveReportList[me.sDbIndexReportId] = me.iReportId;
            console.log("save addReportDetailToDb", oSaveReportList);
            let saveReportDetails = objectStore.put(oSaveReportList);

            saveReportDetails.onsuccess = function (event) {
                console.log(`${me.iReportId} status has been saved in your database.`);
                console.log("addReportDetailToDb success", event);
            };

            saveReportDetails.onerror = function (event) {
                console.log(`Unable to save data\r\n${me.iReportId}, it already exist in your database!`);
                console.log("save error", event);
            };
        },

        putDungeonToDb(oSave, objectStore) {
            let me = this;

            let oSaveUpdateDungeonStatus = Object.assign(oSave);
            oSaveUpdateDungeonStatus[me.sDbIndexDungeonName] = me.sDungeonName;
            console.log("save putDungeonToDb", oSaveUpdateDungeonStatus);
            let saveDungeonStatus = objectStore.put(oSaveUpdateDungeonStatus);

            saveDungeonStatus.onsuccess = function (event) {
                console.log(`${me.sDungeonName} status has been saved / updated in your database.`);
                console.log("putDungeonToDb success", event);
            };

            saveDungeonStatus.onerror = function (event) {
                console.log(`Unable to save / update data\r\n${me.sDungeonName}, it already exist in your database!`);
                console.log("save error", event);
            };
        },

        getAllDetailReports() {
            let me = this;

            try {
                let oTransaction = me.oDb.transaction(me.sDbStoreNameStatusReportList, "readonly");

                oTransaction.oncomplete = function (event) {
                    console.log("transaction getAllDetailReports complete:", event);
                };

                oTransaction.onerror = function (event) {
                    console.warn("transaction getAllDetailReports error", event.target.error, event);
                };

                let objectStoreStatusReportList = oTransaction.objectStore(me.sDbStoreNameStatusReportList);
                let oIndexStatusReportList = objectStoreStatusReportList.index(me.sDbIndexReportId);

                let oReportInputs = me.oForm.querySelectorAll('input[name^="report_id["]');

                oReportInputs.forEach((oReportInput) => {
                    let oReports = oIndexStatusReportList.openCursor(IDBKeyRange.only(parseInt(oReportInput.value)));
                    // todo: get() should be possible too
                    //let oReports = objectStoreStatusReportList.get(oReportInput.value);

                    oReports.onsuccess = (event) => {
                        let cursor = event.target.result;
                        //console.log("cursor for", oReportInput.value);

                        if (cursor) {
                            console.log("cursor value", cursor.value);
                            me.colorDetailRows(cursor);

                            // report id´s are global unique, they updated group-indecently. So no need to query further data
                            //cursor.continue();
                        } else {
                            //console.log("no saved data for report", oReportInput.value);
                        }
                    };

                    oReports.onerror = (event) => {
                        console.warn("getAllDetailReports error", event.target.error);
                    };
                });

            } catch (exception) {
                console.warn("getAllDetailsReports exception", exception);
            }
        },

        colorDetailRows(cursor) {
            let me = this;

            try {
                let oReportStatistic = cursor.value;
                let oReportInput = me.oForm.querySelector(`input[name^="report_id["][value="${oReportStatistic[me.sDbIndexReportId]}"]`);

                let oReportRow = oReportInput.closest("tr");
                let sRowColor = String;
                let sRowFontColor = "";

                if (oReportStatistic[me.sDbIndexAvgRates] === 100) {
                    sRowColor = me.S_COLOR_STATUS_COMPLETE;
                    //sRowFontColor = me.S_FONT_COLOR_STATUS_PARTIAL_COMPLETE;
                } else {
                    if (oReportStatistic[me.sDbIndexHighestRate] === 100) {
                        sRowColor = me.S_COLOR_STATUS_PARTIAL_COMPLETE;
                        sRowFontColor = me.S_FONT_COLOR_STATUS_PARTIAL_COMPLETE;
                    } else {
                        sRowColor = me.S_COLOR_STATUS_INCOMPLETE;
                    }
                }

                oReportRow.style.backgroundColor = sRowColor;

                if (sRowFontColor.length) {
                    oReportRow.querySelectorAll("td:first-child, td:nth-child(2)").forEach((td) => {
                        td.style.color = sRowFontColor;
                        if (td.querySelector(".hilite")) {
                            td.querySelector(".hilite").style.color = sRowFontColor;
                        }

                    });
                }
            } catch (exception) {
                console.warn(exception);
            }
        },

        getAllDungeonEntries() {
            let me = this;

            try {
                let oTransaction = me.oDb.transaction(me.sDbStoreNameStatusDungeonList, "readwrite");

                oTransaction.oncomplete = function (event) {
                    console.log("transaction getAllDungeonReports complete:", event);
                };

                oTransaction.onerror = function (event) {
                    console.warn("transaction getAllDungeonReports error", event.target.error, event);
                };

                let objectStoreStatusDungeonList = oTransaction.objectStore(me.sDbStoreNameStatusDungeonList);
                let oIndexStatusDungeonList = objectStoreStatusDungeonList.index(me.sDbIndexGroupId);
                let oReports = oIndexStatusDungeonList.openCursor(IDBKeyRange.only(me.iGroupId));
                let aDungeonStatistics = {};

                oReports.onsuccess = (event) => {
                    let cursor = event.target.result;

                    if (cursor) {
                        let oDungeonStatistic = cursor.value;
                        console.log("statistic:", oDungeonStatistic);
                        aDungeonStatistics[oDungeonStatistic[me.sDbIndexDungeonName]] = oDungeonStatistic;

                        cursor.continue();
                    } else {
                        console.log("no more reports");

                        let oStandardDungeons = me.oTables[0].querySelectorAll(":scope > tbody > tr:not([id])");
                        let oTimeDungeons = me.oTables[1].querySelectorAll(":scope > tbody > tr:not([id])");

                        me.colorDungeonsEntry(aDungeonStatistics, oStandardDungeons);
                        me.colorDungeonsEntry(aDungeonStatistics, oTimeDungeons);
                    }
                };

                oReports.onerror = (event) => {
                    console.warn("getAllDetailReports error", event.target.error);
                };

            } catch (exception) {
                console.warn("getAllDetailsReports exception", exception);
            }
        },

        colorDungeonsEntry(aDungeonStatistics, aDungeons) {
            let me = this;

            aDungeons.forEach((dungeonRow) => {
                let sDungeonName = dungeonRow.querySelector("td").textContent.trim();
                if (aDungeonStatistics.hasOwnProperty(sDungeonName)) {
                    let sRowColor = String;
                    let sRowFontColor = "";

                    if (aDungeonStatistics[sDungeonName][me.sDbIndexAvgRates] === 100) {
                        sRowColor = me.S_COLOR_STATUS_COMPLETE;
                    } else {
                        if (aDungeonStatistics[sDungeonName][me.sDbIndexHighestRate] === 100) {
                            sRowColor = me.S_COLOR_STATUS_PARTIAL_COMPLETE;
                            sRowFontColor = me.S_FONT_COLOR_STATUS_PARTIAL_COMPLETE;
                        } else {
                            sRowColor = me.S_COLOR_STATUS_INCOMPLETE;
                        }
                    }

                    dungeonRow.style.backgroundColor = sRowColor;

                    if (sRowFontColor.length) {
                        dungeonRow.querySelectorAll("td, a.small_button").forEach((elem) => {
                            elem.style.color = sRowFontColor;
                        });
                    }
                }
            });
        },

        initDb(nextAction, parameter) {
            let me = this;
            let request;

            try {
                request = indexedDB.open(me.sDbName, me.iDbVersion);
            } catch (exception) {
                console.warn("request open exception", exception);
            }

            request.onblocked = me.initDbBlocked;

            request.onerror = me.initDbError;

            request.onsuccess = function (event) {
                // console.log("db onsuccess");
                me.initDbSuccess(event, request, nextAction, parameter);
            };

            request.onupgradeneeded = me.initDbUpgradeNeeded.bind(me);
        },

        // If some other tab is loaded with the database, then it needs to be closed
        // before we can proceed.
        initDbBlocked(event) {
            console.log("blocked", event);
            alert("Please close all other tabs with this site open!");
        },

        initDbError(event) {
            console.warn("open error", event.target.error, event);
        },

        initDbSuccess(event, request, nextAction, parameter) {
            // console.log("initDbSuccess");
            let me = this;

            me.oDb = request.result;

            me.iDbActiveVersion = event.target.result.version;
            console.log("me.iDbActiveVersion", me.iDbActiveVersion);
            me.useDb();
            console.log("nextAction", nextAction);
            nextAction.bind(me)(parameter);
        },

        initDbUpgradeNeeded(event) {
            console.log("upgradeneeded", this);
            let me = this;

            console.log("db onupgradeneeded ", event);
            console.log("db onupgradeneeded versions", event.newVersion, event.oldVersion, typeof event.oldVersion);

            me.oDb = event.target.result;

            me.useDb();
            if (event.oldVersion === 0) {
                try {
                    let objectStoreStatusReportList = me.oDb.createObjectStore(me.sDbStoreNameStatusReportList, {
                        keyPath: [me.sDbIndexReportId, me.sDbIndexGroupId]
                    });

                    objectStoreStatusReportList.createIndex(me.sDbIndexReportId, me.sDbIndexReportId);
                    objectStoreStatusReportList.createIndex(me.sDbIndexGroupId, me.sDbIndexGroupId);

                    objectStoreStatusReportList.createIndex(me.sDbIndexAvgRates, me.sDbIndexAvgRates);
                    objectStoreStatusReportList.createIndex(me.sDbIndexHighestRate, me.sDbIndexHighestRate);
                    objectStoreStatusReportList.createIndex(me.sDbIndexLowestRate, me.sDbIndexLowestRate);
                } catch (exception) {
                    console.warn("objectStoreStatusReportList", exception);
                }

                try {
                    let objectStoreStatusDungeonList = me.oDb.createObjectStore(me.sDbStoreNameStatusDungeonList, {
                        keyPath: [me.sDbIndexDungeonName, me.sDbIndexGroupId]
                    });

                    objectStoreStatusDungeonList.createIndex(me.sDbIndexDungeonName, me.sDbIndexDungeonName);
                    objectStoreStatusDungeonList.createIndex(me.sDbIndexGroupId, me.sDbIndexGroupId);

                    objectStoreStatusDungeonList.createIndex(me.sDbIndexAvgRates, me.sDbIndexAvgRates);
                    objectStoreStatusDungeonList.createIndex(me.sDbIndexHighestRate, me.sDbIndexHighestRate);
                    objectStoreStatusDungeonList.createIndex(me.sDbIndexLowestRate, me.sDbIndexLowestRate);
                } catch (exception) {
                    console.warn("objectStoreStatusDungeon", exception);
                }
            }
        },

        useDb() {
            let me = this;
            // Make sure to add a handler to be notified if another page requests a version
            // change. We must close the database. This allows the other page to upgrade the database.
            // If you don't do this then the upgrade won't happen until the user close the tab.
            me.oDb.onversionchange = function (event) {
                console.log("onversionchange close db");
                me.oDb.close();
                console.log("db versionschange", event);
                alert("A new version of this page is ready. Please reload!");
            };

            me.oDb.onsuccess = function (event) {
                console.log("db success", event);
            };

            me.oDb.onError = function (event) {
                console.warn("db error", event);
            };
        }
    };

    wodDungeonSuccessStateForGroups.init();
})();