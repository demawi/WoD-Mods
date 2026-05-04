/**
 * Kampfreport_05 — Bilanz **pro Runde** und **pro Held**:
 *
 *   ΔHP_report(r,h) = HP nach Runde r − HP vor Runde r
 *   (aus aufeinanderfolgenden `rep_status_table`-Heldenlisten: `rounds[r].helden` → `rounds[r+1].helden`,
 *   letzte Runde: `heldenEnd`.)
 *
 *   ΔHP_modell(r,h) = marginalHeal_EKS(r,h) − marginalSchaden_EKS(r,h)
 *   mit Kumulation über `doQuery` auf Level-Slices `Runden 1…n` (wie heal-kampfreport05-rounds-e2e).
 *
 * Erwartung bei konsistenter Buchhaltung: ΔHP_report ≈ ΔHP_modell (Toleranz ±1 HP Rundung).
 * Ausnahme im Diagnose: Reiner Max-HP-Buff (z. B. Vitalitätsschub: Δcurrent ≈ Δmax, keine Heil-/Schaden-Marginalwerte)
 * ist kein Heilungs-Bilanzfehler — EKS zählt das nicht als Heilung.
 *
 * Run: node testResources/heal-balance-per-round-k05.mjs
 * Strict (Exit 1 bei Abweichung): setze Umgebungsvariable STRICT_PER_ROUND_BALANCE=1
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

const STRICT = process.env.STRICT_PER_ROUND_BALANCE === "1";
const TOLERANCE = 1;

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
    window.__perRoundBalanceExport = { SearchEngine, QueryModel, LevelData };
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
    const fullRounds = A.rounds;
    const rounds = fullRounds.slice(0, n).map((r, i) => Object.assign({}, r, { nr: i + 1 }));
    const area = { nr: 1, rounds };
    if (n < fullRounds.length) {
        const next = fullRounds[n];
        if (next) {
            area._prescanNextHeldend = next.helden;
            area._prescanNextMonster = next.monster;
        }
    } else {
        if (A.heldenEnd) area.heldenEnd = A.heldenEnd;
        if (A.monsterEnd) area.monsterEnd = A.monsterEnd;
    }
    return [{ nr: 1, areas: [area] }];
}

function parseHpCurrent(hp) {
    const text = String(hp || "").replace(/\s+/g, " ").trim();
    if (!text) return 0;
    const ratioMatch = text.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/);
    if (ratioMatch) return Number(ratioMatch[1].replace(",", ".")) || 0;
    const singleMatch = text.match(/(\d+(?:[.,]\d+)?)/);
    return singleMatch ? Number(singleMatch[1].replace(",", ".")) || 0 : 0;
}

/** Wie EKS parseHpSnapshotValue: current/max aus „aktuell/max“ oder eine Zahl (= max≈current). */
function parseHpSnapshotLikeEks(hp) {
    const text = String(hp || "").replace(/\s+/g, " ").trim();
    if (!text) return { current: 0, max: 0 };
    const ratioMatch = text.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/);
    if (ratioMatch) {
        return {
            current: Number(ratioMatch[1].replace(",", ".")) || 0,
            max: Number(ratioMatch[2].replace(",", ".")) || 0,
        };
    }
    const singleMatch = text.match(/(\d+(?:[.,]\d+)?)/);
    const c = singleMatch ? Number(singleMatch[1].replace(",", ".")) || 0 : 0;
    return { current: c, max: c };
}

/** Map DisplayName → { current, max } aus Heldenliste */
function hpSnapMapFromHeldendisplay(helden, SearchEngine) {
    const m = new Map();
    for (const u of helden || []) {
        if (!u || !u.id) continue;
        const key = SearchEngine.getDisplayUnitName(u);
        m.set(key, parseHpSnapshotLikeEks(u.hp));
    }
    return m;
}

function sumHealRow(stats, heroKey) {
    const row = stats.sub && stats.sub[heroKey];
    if (!row) return 0;
    return (
        Number(row.healValue || 0) +
        Number(row.autoRegenHealValue || 0) +
        Number(row.companionValue || 0)
    );
}

function sumDmgRow(stats, heroKey) {
    const row = stats.sub && stats.sub[heroKey];
    if (!row) return 0;
    return (
        Number(row.directValue || 0) +
        Number(row.indirectValue || 0) +
        Number(row.companionValue || 0)
    );
}

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
    window.demawiRepository.WoDSkillsDb.getSkill = async () => null;

    runScriptInWindow(window, prepareEksEvalSource(fs.readFileSync(eksPath, "utf8")));
    const exp = window.__perRoundBalanceExport;
    const SE = exp.SearchEngine;

    for (const n of [...window.document.querySelectorAll(".nowod")]) n.remove();

    const [levelData] = await window.demawiRepository.ReportParser.parseKampfbericht(window.document, false);
    const area = levelData.areas[0];
    const rounds = area.rounds;
    const R = rounds.length;
    assert(R > 0, "Fixture: keine Runden");

    const heroKeys = [];
    for (const h of rounds[0].helden || []) {
        if (h && h.id) heroKeys.push(SE.getDisplayUnitName(h));
    }

    const QF = exp.QueryModel.QueryFilter;
    const unitFilter = [new QF("unit", null)];
    const healQ = new exp.QueryModel.StatQuery("heroes", "heal", unitFilter);
    const defQ = new exp.QueryModel.StatQuery("heroes", "defense", unitFilter);

    /** Kumulierte Summen pro Held nach n verarbeiteten Runden */
    const cumHeal = [];
    const cumDmg = [];
    for (let n = 0; n <= R; n++) {
        if (n === 0) {
            cumHeal.push(Object.fromEntries(heroKeys.map(k => [k, 0])));
            cumDmg.push(Object.fromEntries(heroKeys.map(k => [k, 0])));
            continue;
        }
        const ld = levelDataFirstNRounds(levelData, n);
        const hs = SE.doQuery(healQ, ld);
        const ds = SE.doQuery(defQ, ld);
        const oh = {};
        const od = {};
        for (const k of heroKeys) {
            oh[k] = sumHealRow(hs, k);
            od[k] = sumDmgRow(ds, k);
        }
        cumHeal.push(oh);
        cumDmg.push(od);
    }

    const mismatches = [];
    const partyRows = [];

    for (let ri = 0; ri < R; ri++) {
        const startMap = hpSnapMapFromHeldendisplay(rounds[ri].helden, SE);
        const endHeld =
            ri < R - 1
                ? rounds[ri + 1].helden
                : area.heldenEnd && area.heldenEnd.length
                  ? area.heldenEnd
                  : rounds[ri].helden;
        const endMap = hpSnapMapFromHeldendisplay(endHeld, SE);

        let partyReport = 0;
        let partyModel = 0;

        for (const k of heroKeys) {
            const startSnap = startMap.has(k) ? startMap.get(k) : { current: 0, max: 0 };
            const endSnap = endMap.has(k) ? endMap.get(k) : startSnap;
            const before = startSnap.current;
            const after = endSnap.current;
            const beforeMax = startSnap.max;
            const afterMax = endSnap.max;
            const dReport = after - before;
            const dMaxDelta = afterMax - beforeMax;

            const mHeal = cumHeal[ri + 1][k] - cumHeal[ri][k];
            const mDmg = cumDmg[ri + 1][k] - cumDmg[ri][k];
            const dModel = mHeal - mDmg;
            let diff = dModel - dReport;

            /** Max-HP-Aufstockung ohne Heil-/Schadensmarginal: nicht als Diskrepanz werten. */
            if (
                Math.abs(diff) > TOLERANCE &&
                Math.abs(mHeal) <= TOLERANCE &&
                Math.abs(mDmg) <= TOLERANCE &&
                Math.abs(dMaxDelta) > TOLERANCE &&
                Math.abs(dReport - dMaxDelta) <= TOLERANCE
            ) {
                diff = 0;
            }

            partyReport += dReport;
            partyModel += dModel;

            if (Math.abs(diff) > TOLERANCE) {
                mismatches.push({
                    Runde: ri + 1,
                    Held: k,
                    dReport,
                    mHeal,
                    mDmg,
                    dModel,
                    diff,
                });
            }
        }

        const partyDiff = partyModel - partyReport;
        partyRows.push({
            Runde: ri + 1,
            partyReport,
            partyModel,
            partyDiff,
        });
    }

    console.log("=== Kampfreport_05 — Bilanz pro Runde (Report vs. EKS-Marginal) ===\n");
    console.log("Party (Summe Helden):");
    console.table(partyRows);

    if (mismatches.length > 0) {
        console.log("\nAbweichungen pro Held (|diff| > " + TOLERANCE + "), sortiert nach |diff|:");
        mismatches.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
        console.table(mismatches.slice(0, 80));
        if (mismatches.length > 80) {
            console.log("… und " + (mismatches.length - 80) + " weitere Zeilen.");
        }
    } else {
        console.log("\nKeine Abweichung > " + TOLERANCE + " HP pro Held/Runde.");
    }

    const summary =
        "[OK] heal-balance-per-round-k05 — max |diff|=" +
        (mismatches.length ? Math.max(...mismatches.map(m => Math.abs(m.diff))) : 0) +
        ", problem cells=" +
        mismatches.length;

    if (STRICT && mismatches.length > 0) {
        console.error("[FAIL]", summary);
        process.exit(1);
    }
    console.log(summary + (STRICT ? " (strict)" : " (set STRICT_PER_ROUND_BALANCE=1 to fail on mismatch)"));
})().catch(err => {
    console.error("[FAIL] heal-balance-per-round-k05:", err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
});
