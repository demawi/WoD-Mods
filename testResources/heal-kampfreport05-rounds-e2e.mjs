/**
 * Kampfreport_05_Heilung — Rundenbezogene **indirekte Heilung** (Marginalanteil pro Kampfrunde).
 *
 * Methode: `doQuery` auf Leveldaten, die nur die Kampfrunden **1…n** enthalten (die gleichen
 * Round-Objekte wie im Parser). Kumulierte indirekte Heilung nach n Runden minus Kumulation
 * nach n−1 Runden = Anteil, der **mit Einbezug von Runde n** hinzukommt (Endzustand nach
 * Hauptrunde n; entspricht der sichtbaren Chronologie im Report).
 *
 * Das unterscheidet sich von einem „nur eine Runde im Level-Array“-Slice: dort fehlen u.a.
 * die Vorlauf-Runden in `observedMaxHpByUnitKey` und die Modellkette kann pro isolierter Runde
 * abweichen (Debug: `debug-round1-slice.mjs` falls vorhanden).
 *
 * Kampfphasen: (1) Heldenliste (Start-Status, vor Vorrunde) → (2) Vorrunde → (3) Regenerationsphase
 * → (4) Aktionsphase. Für (3) sind HoTs aus (2) zusätzlich zur Startliste zu berücksichtigen — die
 * erste Status-Tabelle enthält sie noch nicht; die EKS ergänzt sie aus den Vorrunden-Aktionen.
 *
 * Run: node testResources/heal-kampfreport05-rounds-e2e.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const reportPath = path.join(__dirname, "Kampfreport_05_Heilung.html");
const demawiPath = path.join(repoRoot, "repo", "DemawiRepository.js");
const eksPath = path.join(repoRoot, "ErweiterteKampfstatistik.user.js");

function assert(cond, msg) {
    if (!cond) throw new Error(msg || "Assertion failed");
}

function stripEmbeddedScripts(html) {
    return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
}

function stripUserScriptHeader(src) {
    const endMarker = "// ==/UserScript==";
    const idx = src.indexOf(endMarker);
    if (idx === -1) return src;
    return src.slice(idx + endMarker.length).replace(/^\s*\n?/, "");
}

function prepareEksEvalSource(src) {
    let body = stripUserScriptHeader(src);
    if (!/\bMod\.startMod\s*\(\s*\)\s*;/.test(body)) throw new Error("EKS: Mod.startMod nicht gefunden");
    body = body.replace(/\s*Mod\.startMod\s*\(\s*\)\s*;/, `
    window.__healE2eExport = { SearchEngine, QueryModel, LevelData };
    `);
    return body;
}

function runScriptInWindow(window, jsText) {
    const run = new window.Function(jsText);
    run();
}

function polyfillInnerTextForReports(window) {
    const proto = window.HTMLElement && window.HTMLElement.prototype;
    if (!proto) return;
    Object.defineProperty(proto, "innerText", {
        get() {
            const raw = this.textContent == null ? "" : String(this.textContent);
            return raw.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
        },
        configurable: true,
    });
}

function levelDataFirstNRounds(levelData, n) {
    const A = levelData.areas[0];
    const rounds = A.rounds.slice(0, n).map((r, i) => Object.assign({}, r, { nr: i + 1 }));
    return [{ nr: 1, areas: [{ nr: 1, rounds }] }];
}

/** Helden-Sub-Keys wie in der EKS (Anzeigenamen aus Runde 1). */
function heroHealSubKeySet(levelData, SearchEngine) {
    const set = new Set();
    for (const h of levelData.areas[0].rounds[0].helden || []) {
        if (h && h.id) set.add(SearchEngine.getDisplayUnitName(h));
    }
    return set;
}

/** Kumulierte indirekte Heilung, die Helden **empfangen** (Summe indirectHealValue über Helden-Zeilen). */
function sumIndirectReceivedByParty(stats, heroKeys) {
    let s = 0;
    for (const [k, v] of Object.entries(stats.sub || {})) {
        if (!heroKeys.has(k)) continue;
        s += Number((v && v.indirectHealValue) || 0);
    }
    return s;
}

/**
 * Regression: marginale **empfangene** indirekte Heilung der Heldengruppe pro Runde.
 * (Nach Empfänger-Buchung in der EKS; nicht mehr nach Auslöser „atrix“/„Nachtigall“ in sub-Keys.)
 */
const GOLDEN_PARTY_INDIRECT_RECEIVED_MARGINAL = [2, 10, 48, 36, 48, 61, 70, 19, 19, 16, 22, 24, 20, 24, 20, 19, 17, 13];

(async function main() {
    assert(fs.existsSync(reportPath), "Fixture fehlt: " + reportPath);

    const fixtureHtml = stripEmbeddedScripts(fs.readFileSync(reportPath, "utf8"));
    const dom = new JSDOM(fixtureHtml, {
        url: "https://www.world-of-dungeons.de/wod/spiel/report/report.php?id=fixture",
        pretendToBeVisual: true,
        runScripts: "outside-only",
    });
    const { window } = dom;
    window.alert = () => {};
    window.unsafeWindow = window;
    window.GM = { info: { script: { version: "e2e" }, scriptHandler: "node" } };
    polyfillInnerTextForReports(window);

    runScriptInWindow(window, fs.readFileSync(demawiPath, "utf8"));
    const dr = window.demawiRepository;
    dr.WoDSkillsDb.getSkill = async () => null;

    runScriptInWindow(window, prepareEksEvalSource(fs.readFileSync(eksPath, "utf8")));
    const exp = window.__healE2eExport;

    for (const n of [...window.document.querySelectorAll(".nowod")]) n.remove();

    const [levelData] = await dr.ReportParser.parseKampfbericht(window.document, false);
    const totalRounds = levelData.areas[0].rounds.length;

    assert(
        GOLDEN_PARTY_INDIRECT_RECEIVED_MARGINAL.length === totalRounds,
        `Golden-Array anpassen: Fixture hat ${totalRounds} Runden`,
    );

    const QF = exp.QueryModel.QueryFilter;
    const statQuery = new exp.QueryModel.StatQuery("heroes", "heal", [new QF("unit", null)]);
    const heroKeys = heroHealSubKeySet(levelData, exp.SearchEngine);

    let prevParty = 0;
    const table = [];
    for (let n = 1; n <= totalRounds; n++) {
        const stats = exp.SearchEngine.doQuery(statQuery, levelDataFirstNRounds(levelData, n));
        const cumParty = sumIndirectReceivedByParty(stats, heroKeys);
        const marP = cumParty - prevParty;
        prevParty = cumParty;

        assert(
            marP === GOLDEN_PARTY_INDIRECT_RECEIVED_MARGINAL[n - 1],
            `R${n} Party indirekt empfangen marginal: erwartet ${GOLDEN_PARTY_INDIRECT_RECEIVED_MARGINAL[n - 1]}, ist ${marP}`,
        );

        table.push({ n, partyM: marP, partyCum: cumParty });
    }

    const fullStats = exp.SearchEngine.doQuery(statQuery, [levelData]);
    const partyIndirectEnd = sumIndirectReceivedByParty(fullStats, heroKeys);
    assert(partyIndirectEnd === prevParty, `Parität Party indirekt empfangen: Endstand ${partyIndirectEnd} vs. kumulativ ${prevParty}`);

    console.log("Kampfreport_05 — Marginale empfangene indirekte Heilung (Party, Ist = Golden):\n");
    console.table(table);
    console.log("[OK] heal-kampfreport05-rounds-e2e — Endstand Party indirekt empfangen:", prevParty);
})().catch(err => {
    console.error("[FAIL]", err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
});
