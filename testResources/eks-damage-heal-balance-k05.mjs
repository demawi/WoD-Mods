/**
 * Kampfreport_05_Heilung — automatisierte Checks rund um Schaden/Heilung (Helden, gleiche Phasen).
 *
 * 1) **Phasenparität**: Verteidigung und Heilung sollen Vorrunde + Initiative mitzählen. Dafür wird
 *    dieselbe Abfrage auf geklonten Leveldaten ausgeführt, bei denen `vorrunde` und `initiative`
 *    leer sind: die vollen Summen müssen **mindestens** so groß sein wie die gestrippten.
 * 2) **Goldwerte** (Helden, Einheiten-Filter): fängt Regressionen ab (Parser-/EKS-Änderungen).
 * 3) **Keine naive Bilanz** Summe(Heil-Zeilen) − Summe(Schaden) = ΔHP: Die EKS bucht Heilung
 *    auslöserseitig inkl. indirekter Zuschreibung; die Summe der Helden-„Gesamt Heilung“-Zeilen
 *    ist kein Maß für „tatsächlich zugeflossene Gruppen-HP“ (mehrfache Zuschreibung möglich).
 *
 * Run: node testResources/eks-damage-heal-balance-k05.mjs
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

/** Referenzwerte Stand EKS 0.21.48 + Fixture Kampfreport_05_Heilung.html — bei bewusstem Rebalance anpassen. */
const GOLDEN_HEROES_DEFENSE_SUM = 415;
/** Summe „Gesamt Heilung“ über Helden-Zeilen (healValue + Auto-Regen + Gefährten). */
const GOLDEN_HEROES_HEAL_SUM = 741;

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
    window.__balanceE2eExport = { SearchEngine, QueryModel, LevelData };
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

function sumSubDefenseTotals(stats) {
    let direct = 0;
    let indirect = 0;
    let companion = 0;
    for (const row of Object.values(stats.sub || {})) {
        if (!row || typeof row !== "object") continue;
        direct += Number(row.directValue || 0);
        indirect += Number(row.indirectValue || 0);
        companion += Number(row.companionValue || 0);
    }
    return { direct, indirect, companion, gesamt: direct + indirect + companion };
}

function sumSubHealGesamt(stats) {
    let heal = 0;
    let autoR = 0;
    let comp = 0;
    for (const row of Object.values(stats.sub || {})) {
        if (!row || typeof row !== "object") continue;
        heal += Number(row.healValue || 0);
        autoR += Number(row.autoRegenHealValue || 0);
        comp += Number(row.companionValue || 0);
    }
    return { healValue: heal, autoRegen: autoR, companion: comp, gesamt: heal + autoR + comp };
}

/** Klon: Vorrunde + Initiative leer (simuliert fehlende Phasen in der Auswertung). */
function levelDataStripVorrundeInitiative(levelDataOne) {
    const level = levelDataOne[0];
    const areas = level.areas.map(a => ({
        ...a,
        rounds: a.rounds.map(r => ({
            ...r,
            actions: {
                ...r.actions,
                vorrunde: [],
                initiative: [],
            },
        })),
    }));
    return [{ ...level, areas }];
}

function countVorrundeInitiativeActions(levelDataOne) {
    let v = 0;
    let i = 0;
    for (const a of levelDataOne[0].areas || []) {
        for (const r of a.rounds || []) {
            v += (r.actions && r.actions.vorrunde && r.actions.vorrunde.length) || 0;
            i += (r.actions && r.actions.initiative && r.actions.initiative.length) || 0;
        }
    }
    return { vorrunde: v, initiative: i };
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
    const dr = window.demawiRepository;
    dr.WoDSkillsDb.getSkill = async () => null;

    runScriptInWindow(window, prepareEksEvalSource(fs.readFileSync(eksPath, "utf8")));
    const exp = window.__balanceE2eExport;

    for (const n of [...window.document.querySelectorAll(".nowod")]) n.remove();

    const [levelData] = await dr.ReportParser.parseKampfbericht(window.document, false);
    const levelArray = [levelData];
    const counts = countVorrundeInitiativeActions(levelArray);
    assert(counts.vorrunde > 0 || counts.initiative > 0, "Fixture soll Vorrunden- oder Initiativ-Aktionen enthalten (sonst ist Phasen-Test wirkungslos).");

    const QF = exp.QueryModel.QueryFilter;
    const unitFilter = [new QF("unit", null)];

    const defenseFull = exp.SearchEngine.doQuery(new exp.QueryModel.StatQuery("heroes", "defense", unitFilter), levelArray);
    const healFull = exp.SearchEngine.doQuery(new exp.QueryModel.StatQuery("heroes", "heal", unitFilter), levelArray);

    const stripped = levelDataStripVorrundeInitiative(levelArray);
    const defenseStripped = exp.SearchEngine.doQuery(new exp.QueryModel.StatQuery("heroes", "defense", unitFilter), stripped);
    const healStripped = exp.SearchEngine.doQuery(new exp.QueryModel.StatQuery("heroes", "heal", unitFilter), stripped);

    const dFull = sumSubDefenseTotals(defenseFull);
    const dStrip = sumSubDefenseTotals(defenseStripped);
    const hFull = sumSubHealGesamt(healFull);
    const hStrip = sumSubHealGesamt(healStripped);

    assert(dFull.gesamt >= dStrip.gesamt, `Verteidigung: voll (${dFull.gesamt}) muss ≥ gestrippt (${dStrip.gesamt}) sein`);
    assert(hFull.gesamt >= hStrip.gesamt, `Heilung: voll (${hFull.gesamt}) muss ≥ gestrippt (${hStrip.gesamt}) sein`);

    assert(
        dFull.gesamt > dStrip.gesamt || hFull.gesamt > hStrip.gesamt,
        "Erwartet strikt größere Summe in mindestens einer Kategorie (Schaden oder Heilung), sonst bringt Vorrunde/Initiative hier keinen messbaren Unterschied.",
    );

    assert(dFull.gesamt === GOLDEN_HEROES_DEFENSE_SUM, `Helden-Verteidigung Gesamt: erwartet ${GOLDEN_HEROES_DEFENSE_SUM}, ist ${dFull.gesamt}`);
    assert(hFull.gesamt === GOLDEN_HEROES_HEAL_SUM, `Helden-Heilung Gesamt: erwartet ${GOLDEN_HEROES_HEAL_SUM}, ist ${hFull.gesamt}`);

    const emptyHeal = exp.SearchEngine.doQuery(new exp.QueryModel.StatQuery("heroes", "heal", []), levelArray);
    let subHealNoComp = 0;
    let subComp = 0;
    for (const row of Object.values(healFull.sub || {})) {
        subHealNoComp += Number(row.healValue || 0) + Number(row.autoRegenHealValue || 0);
        subComp += Number(row.companionValue || 0);
    }
    const rootNoComp = Number(emptyHeal.healValue || 0) + Number(emptyHeal.autoRegenHealValue || 0);
    assert(
        subHealNoComp === rootNoComp,
        `Interne Konsistenz: Summe(healValue+autoRegen) Heldenzeilen=${subHealNoComp} muss Root (ohne Filter)=${rootNoComp} sein`,
    );
    assert(subComp === GOLDEN_HEROES_HEAL_SUM - rootNoComp, `Gefährten-Summe: erwartet ${GOLDEN_HEROES_HEAL_SUM - rootNoComp}, ist ${subComp}`); // 741 − 723 = 18

    console.log("[OK] eks-damage-heal-balance-k05", {
        vorrundeInitiativeActionRows: counts,
        defense: { full: dFull.gesamt, stripped: dStrip.gesamt },
        heal: { full: hFull.gesamt, stripped: hStrip.gesamt },
    });
})().catch(err => {
    console.error("[FAIL] eks-damage-heal-balance-k05:", err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
});
