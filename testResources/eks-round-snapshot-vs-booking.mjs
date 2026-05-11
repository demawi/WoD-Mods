/**
 * Rundenweise: ΔHP aus Statuslisten (vor→nach Runde) vs. gebuchte Heilung/Schaden
 * (SearchEngine._bookingRoundHealByKey / _bookingRoundDmgByKey nach doQuery).
 *
 * Ohne applyRoundHpReconciliation zeigt der Restfehler pro Runde/Held, wo Buchung und Snapshot auseinanderlaufen.
 * Run: node testResources/eks-round-snapshot-vs-booking.mjs
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
    window.__snapExport = { SearchEngine, QueryModel };
    `);
    return body;
}

function runScriptInWindow(window, jsText) {
    new window.Function(jsText)();
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

/**
 * @returns {{ roundNr: number, roundKey: string, sumResidual: number, entries: Array<{targetKey: string, delta: number, heal: number, dmg: number, residual: number}> }[]}
 */
function computeSnapshotVsBookingResiduals(SE, level, area, wantHeroes) {
    const out = [];
    const rounds = area.rounds || [];
    for (let ri = 0; ri < rounds.length; ri++) {
        const round = rounds[ri];
        if (!round) continue;
        round.nr = round.nr || ri + 1;
        const rk = SE.roundBookingCompositeKey(level, area, round);
        const deltaByKey = SE.computeRoundHpDeltaByTargetKey(area, ri, wantHeroes);
        const hMap = (SE._bookingRoundHealByKey && SE._bookingRoundHealByKey[rk]) || {};
        const dMap = (SE._bookingRoundDmgByKey && SE._bookingRoundDmgByKey[rk]) || {};
        const keys = new Set();
        Object.keys(deltaByKey || {}).forEach(k => keys.add(k));
        Object.keys(hMap).forEach(k => keys.add(k));
        Object.keys(dMap).forEach(k => keys.add(k));
        const entries = [];
        let sumResidual = 0;
        keys.forEach(k => {
            const delta = Math.round(Number(deltaByKey[k] || 0));
            const heal = Math.round(Number(hMap[k] || 0));
            const dmg = Math.round(Number(dMap[k] || 0));
            const residual = delta - (heal - dmg);
            if (residual !== 0) {
                entries.push({ targetKey: k, delta, heal, dmg, residual });
                sumResidual += residual;
            }
        });
        if (entries.length > 0) {
            out.push({
                roundNr: round.nr,
                roundKey: rk,
                sumResidual,
                entries: entries.sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual)),
            });
        }
    }
    return out;
}

(async function main() {
    const fixtureHtml = stripEmbeddedScripts(fs.readFileSync(reportPath, "utf8"));
    const dom = new JSDOM(fixtureHtml, {
        url: "https://www.world-of-dungeons.de/wod/spiel/report/report.php?id=fixture",
        pretendToBeVisual: true,
        runScripts: "outside-only",
    });
    const { window } = dom;
    window.alert = () => {};
    window.unsafeWindow = window;
    window.GM = { info: { script: { version: "snap" }, scriptHandler: "node" } };
    polyfillInnerTextForReports(window);

    runScriptInWindow(window, fs.readFileSync(demawiPath, "utf8"));
    const dr = window.demawiRepository;
    dr.WoDSkillsDb.getSkill = async () => null;

    runScriptInWindow(window, prepareEksEvalSource(fs.readFileSync(eksPath, "utf8")));
    const { SearchEngine, QueryModel } = window.__snapExport;

    for (const n of [...window.document.querySelectorAll(".nowod")]) n.remove();

    const [levelData] = await dr.ReportParser.parseKampfbericht(window.document, false);
    const levelArray = [levelData];
    SearchEngine.ensureRegenIndirectEnrichment(levelArray);

    const QF = QueryModel.QueryFilter;
    const unitFilter = [new QF("unit", null)];

    SearchEngine.resetRoundHpBooking();
    const defenseStats = SearchEngine.doQuery(new QueryModel.StatQuery("heroes", "defense", unitFilter), levelArray);
    const healStats = SearchEngine.doQuery(new QueryModel.StatQuery("heroes", "heal", unitFilter), levelArray);

    const level = levelArray[0];
    const residualsByArea = [];
    let grandSum = 0;
    for (let ai = 0; ai < (level.areas || []).length; ai++) {
        const area = level.areas[ai];
        if (!area) continue;
        area.nr = area.nr || ai + 1;
        const res = computeSnapshotVsBookingResiduals(SearchEngine, level, area, true);
        residualsByArea.push({ areaNr: area.nr, rounds: res });
        for (const r of res) grandSum += r.sumResidual;
    }

    SearchEngine.applyRoundHpReconciliation(levelArray, healStats, defenseStats, true);

    let subRrk = 0;
    for (const row of Object.values(healStats.sub || {})) {
        subRrk += Number(row.healRoundBilanzKorrektur || 0);
    }
    const rootRrk = Number(healStats.healRoundBilanzKorrektur || 0);

    console.log(
        "[eks-round-snapshot-vs-booking]",
        JSON.stringify(
            {
                fixture: path.basename(reportPath),
                grandSumResidualBeforeReconcile: grandSum,
                healRoundBilanzKorrekturRoot: rootRrk,
                healRoundBilanzKorrekturSubSum: subRrk,
                residualsByArea,
            },
            null,
            2,
        ),
    );

    if (grandSum !== rootRrk || grandSum !== subRrk) {
        console.warn("[warn] Residual-Summe und healRoundBilanzKorrektur weichen ab:", { grandSum, rootRrk, subRrk });
    }
})().catch(err => {
    console.error("[FAIL]", err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
});
