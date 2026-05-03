/**
 * Zerlegt **indirekte Heilung** in Runde 3 nach **Zielheld** und **Auslöser** (atrix vs. Nachtigall …),
 * über SearchEngine._indirectHealAttributionLog (nur wenn INDIRECT_HEAL_ATTRIBUTION_LOG = true).
 *
 * Runde 2 / Thorambur: Im Fixture weist das Protokoll **2** HP indirekte Heilung von der Nachtigall zu
 * (Pool 4, „Lied der Lebensfreude“) — die kumulierte **empfangene** Party-Indirektheilung pro Runde sichert
 * `heal-kampfreport05-rounds-e2e.mjs` (Golden `GOLDEN_PARTY_INDIRECT_RECEIVED_MARGINAL`).
 *
 * Erwartungswerte aus der Nutzer-Erklärung (Referenz zum Abgleich mit dem Originalbericht):
 *
 * - Adalbert: atrix +8, Nachtigall +1
 * - Balor: atrix +10, Auto +1 auf Balor
 * - Dharigaaz: atrix +10
 * - Thorambur: atrix +10, Auto +1
 * - nibora regaj: atrix +8, Nachtigall +1
 *
 * Run:
 *   node testResources/heal-kampfreport05-r3-per-hero-breakdown.mjs [Runde|all]
 * Beispiele: … 3   (Standard)  |  … 1  |  … all  (Runden 1–3)
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

function heroBase(name) {
    return ("" + (name || ""))
        .replace(/\s+/g, " ")
        .trim()
        .split(",")[0]
        .trim()
        .toLowerCase();
}

function matchHero(healeeDisplay, shortName) {
    return heroBase(healeeDisplay) === heroBase(shortName);
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
    window.GM = { info: { script: { version: "e2e" }, scriptHandler: "node" } };
    polyfillInnerTextForReports(window);

    runScriptInWindow(window, fs.readFileSync(demawiPath, "utf8"));
    window.demawiRepository.WoDSkillsDb.getSkill = async () => null;

    runScriptInWindow(window, prepareEksEvalSource(fs.readFileSync(eksPath, "utf8")));
    const exp = window.__healE2eExport;
    const SE = exp.SearchEngine;

    for (const n of [...window.document.querySelectorAll(".nowod")]) n.remove();

    const [levelData] = await window.demawiRepository.ReportParser.parseKampfbericht(window.document, false);

    SE.INDIRECT_HEAL_ATTRIBUTION_LOG = true;

    const QF = exp.QueryModel.QueryFilter;
    const statQuery = new exp.QueryModel.StatQuery("heroes", "heal", [new QF("unit", null)]);
    exp.SearchEngine.doQuery(statQuery, [levelData]);

    SE.INDIRECT_HEAL_ATTRIBUTION_LOG = false;

    const log = SE._indirectHealAttributionLog || [];
    const arg = process.argv[2];
    const rounds =
        arg === "all" ? [1, 2, 3] : [Math.min(99, Math.max(1, Number(arg) || 3))];

    const EXPECT_R1 = { Thorambur: { atrix: 2, auto: 1 } };
    const EXPECT_R2 = {
        Adalbert: { atrix: 2 },
        Balor: { atrix: 2 },
        Dharigaaz: { atrix: 2 },
        Thorambur: { atrix: 2, nachtigall: 2 },
    };
    const EXPECT_R3 = {
        Adalbert: { atrix: 8, nachtigall: 1 },
        Balor: { atrix: 10, auto: 1 },
        Dharigaaz: { atrix: 10 },
        Thorambur: { atrix: 10, auto: 1 },
        "nibora regaj": { atrix: 8, nachtigall: 1 },
    };

    for (const R of rounds) {
    const slice = log.filter(e => e && e.round === R);
    const EXPECT = R === 1 ? EXPECT_R1 : R === 2 ? EXPECT_R2 : R === 3 ? EXPECT_R3 : {};

    const indirectRows = slice.filter(e => e.kind === "indirect");
    const remainderRows = slice.filter(e => e.kind === "remainderAuto");
    const allAutoRows = slice.filter(e => e.kind === "allAuto");

    /** Summiert indirectHp nach Ziel und Auslöcher (Basisnamen). */
    const sumByHealeeContributor = {};
    for (const e of indirectRows) {
        const h = e.healee || "?";
        const c = e.contributor || "?";
        const key = heroBase(h) + "||" + heroBase(c);
        if (!sumByHealeeContributor[key]) {
            sumByHealeeContributor[key] = { healee: h, contributor: c, hp: 0 };
        }
        sumByHealeeContributor[key].hp += Number(e.indirectHp || 0);
    }

    function sumFor(healeeShort, contributorPattern) {
        let s = 0;
        for (const row of Object.values(sumByHealeeContributor)) {
            if (!matchHero(row.healee, healeeShort)) continue;
            if (!contributorPattern.test(row.contributor)) continue;
            s += row.hp;
        }
        return s;
    }

    function sumAuto(healeeShort) {
        let s = 0;
        for (const e of remainderRows) {
            if (matchHero(e.healee, healeeShort)) s += Number(e.autoHp || 0);
        }
        for (const e of allAutoRows) {
            if (matchHero(e.healee, healeeShort)) s += Number(e.autoHp || 0);
        }
        return s;
    }

    const heroes =
        R === 3
            ? ["Adalbert", "Balor", "Dharigaaz", "Thorambur", "nibora regaj"]
            : R === 2
              ? ["Adalbert", "Balor", "Dharigaaz", "Thorambur"]
              : ["Thorambur"];

    console.log(`=== Kampfreport_05 — Runde ${R}: indirekte Heilung nach Zielheld (EKS-Protokoll) ===\n`);
    console.log(`Runde-${R}-Einträge gesamt:`, slice.length, "| indirect:", indirectRows.length, "| remainderAuto:", remainderRows.length, "| allAuto:", allAutoRows.length);
    console.log("");

    const table = [];
    for (const h of heroes) {
        const ex = EXPECT[h];
        const atrixI = sumFor(h, /^atrix/i);
        const nachtI = sumFor(h, /nachtigall/i);
        const autoI = sumAuto(h);
        table.push({
            Ziel: h,
            atrix_Ist: atrixI,
            nachtigall_Ist: nachtI,
            auto_Ist: autoI,
            atrix_Soll: ex && ex.atrix != null ? ex.atrix : "—",
            nacht_Soll: ex && ex.nachtigall != null ? ex.nachtigall : "—",
            auto_Soll: ex && ex.auto != null ? ex.auto : "—",
            d_atrix: ex && ex.atrix != null ? atrixI - ex.atrix : "—",
            d_nacht: ex && ex.nachtigall != null ? nachtI - ex.nachtigall : "—",
            d_auto: ex && ex.auto != null ? autoI - ex.auto : "—",
        });
    }

    console.table(table);

    console.log(`\n--- Rohdaten R${R}: indirect (Auslöser → Ziel) ---`);
    const grouped = {};
    for (const e of indirectRows) {
        const line = `${e.contributor} → ${e.healee}: ${e.indirectHp} HP (Pool gesamt ${e.poolHp}, Report-Zeile ${e.reportHp}) [${e.sourceName}]`;
        grouped[line] = (grouped[line] || 0) + 1;
    }
    Object.keys(grouped)
        .sort()
        .forEach(k => console.log(k + (grouped[k] > 1 ? ` ×${grouped[k]}` : "")));

    console.log(`\n--- Rohdaten R${R}: remainderAuto / allAuto ---`);
    for (const e of [...remainderRows, ...allAutoRows]) {
        console.log(
            `${e.kind} ${e.healee}: ${e.autoHp} HP (pool ${e.poolHp}, report ${e.reportHp})`,
        );
    }

    const totalAtrixR = indirectRows
        .filter(e => /^atrix/i.test(e.contributor || ""))
        .reduce((s, e) => s + Number(e.indirectHp || 0), 0);
    console.log(`\nSumme indirectHp mit Auslöser atrix (R${R}):`, totalAtrixR);
    console.log("\n" + "—".repeat(60) + "\n");
    }
})().catch(err => {
    console.error(err);
    process.exit(1);
});
