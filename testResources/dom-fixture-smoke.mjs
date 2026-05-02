/**
 * E2E-DOM-Smoke ohne Tampermonkey: jsdom lädt Kampfreport-HTML und prüft typische Knoten,
 * wie der WoD ReportParser sie sucht (#getContentTable → .content_table mit .rep_status_table).
 *
 * Vollständiger ReportParser + EKS-Heilungs-Pipeline: testResources/heal-e2e.mjs (jsdom + innerText-Polyfill).
 *
 * Setup: npm install
 * Run:   npm run test:dom   (oder: node testResources/dom-fixture-smoke.mjs)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function pickReportPath() {
    const heal = path.join(__dirname, "Kampfreport_05_Heilung.html");
    if (fs.existsSync(heal)) return heal;
    const fallback = path.join(__dirname, "Kampfreport_01.html");
    if (fs.existsSync(fallback)) return fallback;
    throw new Error(`Kein Kampfreport-Fixture unter ${path.join(__dirname, "…html")}`);
}

function getContentTableLikeParser(containerDoc) {
    const contentTables = containerDoc.getElementsByClassName("content_table");
    for (let i = 0, l = contentTables.length; i < l; i++) {
        const cur = contentTables[i];
        if (cur.getElementsByClassName("rep_status_table").length > 0) {
            return cur;
        }
    }
    return null;
}

(function run() {
    const reportPath = pickReportPath();
    const html = fs.readFileSync(reportPath, "utf8");
    const dom = new JSDOM(html, { url: "https://example.world-of-dungeons.de/wod/spiel/report" });
    const { document } = dom.window;

    const contentTable = getContentTableLikeParser(document);
    if (!contentTable) {
        throw new Error("[FAIL] ReportParser.#getContentTable: keine content_table mit rep_status_table");
    }

    const statusTables = contentTable.getElementsByClassName("rep_status_table");
    if (statusTables.length < 1) {
        throw new Error("[FAIL] Zu wenige rep_status_table unter content_table");
    }

    console.log("[OK] dom-fixture-smoke — JSDOM: JS-Engine (V8)+DOM, Datei:", reportPath);
    console.log("     content_table gefunden; rep_status_table:", statusTables.length);
})();
