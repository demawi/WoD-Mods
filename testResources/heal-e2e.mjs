/**
 * E2E: Kampfreport-Fixture → Demawi ReportParser → EKS SearchEngine.doQuery(heal).
 * Läuft wie im Browser: Scripts per <script> im JSDOM-Window (realm mit window/document).
 * Embedded <script>-Tags aus dem Fixture entfernen (sonst Loads/Hänger); DOM-Inhalt bleibt.
 *
 * Run: node testResources/heal-e2e.mjs
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
    /** `Mod.startMod();` steht vor `})();`, kein Ende-`$`-Match */
    if (!/\bMod\.startMod\s*\(\s*\)\s*;/.test(body)) {
        throw new Error("EKS: Mod.startMod(); nicht gefunden — Export angepasst?");
    }
    body = body.replace(/\s*Mod\.startMod\s*\(\s*\)\s*;/, `
    window.__healE2eExport = { SearchEngine, QueryModel, LevelData };
    `);
    return body;
}

/**
 * Direktes <script>-text würde bei Demawi mit `/**` als Dateianfang vom Parser fälschlich
 * wie RegExp gelesen. Function-Konstruktor nutzt Funktionsrumpf-Kontext → Blockkommentar ok.
 */
function runScriptInWindow(window, jsText) {
    const run = new window.Function(jsText);
    run();
}

/** jsdom lässt `innerText` auf manchen Knoten undefined — ReportParser braucht `=== "Runde 1"` (Demawi Round-Loop). */
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

function collectHealSkillNames(actions) {
    const out = [];
    for (const action of actions) {
        const n = action && action.skill && action.skill.name;
        if (n) out.push(n);
    }
    return out;
}

function traverseParsedHealingActions(levelData) {
    const list = [];
    if (!levelData || !levelData.areas) return list;
    for (const area of levelData.areas) {
        for (const round of area.rounds || []) {
            const buckets = [round.actions.vorrunde, round.actions.regen, round.actions.initiative, round.actions.runde];
            for (const bucket of buckets) {
                if (!bucket) continue;
                for (const action of bucket) {
                    if (!action || !action.targets) continue;
                    for (const tgt of action.targets) {
                        if (tgt && tgt.typ === "Heilung") {
                            list.push({ action, skill: action.skill && action.skill.name });
                        }
                    }
                }
            }
        }
    }
    return list;
}

/** Regression: dieselbe Kampfzeile darf in der Ausklapp-Liste nicht mehrfach erscheinen (Ingress-Dedupe). */
function assertNoDuplicateEventKeys(SearchEngine, label, actions) {
    if (!actions || actions.length === 0) return;
    const keys = [];
    for (const a of actions) {
        keys.push(SearchEngine.getListedActionEventKey(a));
    }
    const nonempty = keys.filter(k => k && String(k).trim() !== "");
    const uniq = new Set(nonempty);
    assert(
        nonempty.length === uniq.size,
        `${label}: doppelte Event-Keys in der Aktionsliste (${nonempty.length} Einträge, ${uniq.size} eindeutige Keys). Beispiel: ${findFirstDupKey(nonempty)}`,
    );
}

function findFirstDupKey(keys) {
    const seen = new Set();
    for (const k of keys) {
        if (seen.has(k)) return k;
        seen.add(k);
    }
    return "?";
}

/** Parser-UID und EKS-Key müssen zusammenpassen (stabile „cr|…“-Zeilen-ID). */
function assertCrKeysMatchReportUid(SearchEngine, actions) {
    for (const a of actions || []) {
        const uid = a && a.reportCombatRowDedupeUid;
        if (uid == null || String(uid).trim() === "") continue;
        const key = SearchEngine.getListedActionEventKey(a);
        assert(key === "cr|" + String(uid), `cr|-Key passt nicht zu reportCombatRowDedupeUid: key=${key} uid=${uid}`);
    }
}

(async function main() {
    assert(fs.existsSync(reportPath), "Fixture fehlt: " + reportPath);
    assert(fs.existsSync(demawiPath), "demawi-repo fehlt: " + demawiPath);
    assert(fs.existsSync(eksPath), "EKS fehlt: " + eksPath);

    const fixtureRaw = fs.readFileSync(reportPath, "utf8");
    const fixtureHtml = stripEmbeddedScripts(fixtureRaw);
    assert(fixtureHtml.includes("content_table"), "Fixture ohne content_table");

    const dom = new JSDOM(fixtureHtml, {
        url: "https://www.world-of-dungeons.de/wod/spiel/report/report.php?id=fixture",
        pretendToBeVisual: true,
        /** Browser-ähnliche window.*-Globals für Function()-Injection (ohne Fixture-Skripte ausführen) */
        runScripts: "outside-only",
    });
    const { window } = dom;

    window.alert = () => {};
    window.unsafeWindow = window;
    window.GM = {
        info: {
            script: { name: "[WoD] Erweiterte Kampfstatistik", version: "0.22.2" },
            scriptHandler: "JSDOM-heal-e2e",
        },
    };

    polyfillInnerTextForReports(window);

    runScriptInWindow(window, fs.readFileSync(demawiPath, "utf8"));
    assert(window.demawiRepository && window.demawiRepository.ReportParser, "demawiRepository nach Script-Injection fehlt.");

    const dr = window.demawiRepository;
    dr.WoDSkillsDb.getSkill = async function () {
        return null;
    };

    runScriptInWindow(window, prepareEksEvalSource(fs.readFileSync(eksPath, "utf8")));
    const exp = window.__healE2eExport;
    assert(exp && exp.SearchEngine && exp.QueryModel, "EKS Export fehlt (Mod.startMod ersetzt?).");

    /** Im Fixture ist EKS-HTML eingebettet (.nowod vor dem Kampftableau) — sonst #getContentTable das falsche Tableau. */
    for (const n of [...window.document.querySelectorAll(".nowod")]) {
        n.remove();
    }

    const log = console.log;
    console.log = (...args) => {
        if (typeof args[0] === "string" && args[0].startsWith("Parsed Report in")) return;
        log.apply(console, args);
    };
    let levelData;
    let warnings;
    try {
        [levelData, warnings] = await dr.ReportParser.parseKampfbericht(window.document, false);
    } finally {
        console.log = log;
    }
    assert(levelData && levelData.areas && levelData.areas.length > 0, "parseKampfbericht liefert keine areas.");

    const healTargetsParsed = traverseParsedHealingActions(levelData);
    assert(healTargetsParsed.length >= 3, `Erwartet ≥3 Heilungs-Targets nach Parse, haben ${healTargetsParsed.length}.`);

    let healActionsWithHealTarget = 0;
    let healActionsWithUid = 0;
    for (const { action } of healTargetsParsed) {
        healActionsWithHealTarget++;
        if (action && action.reportCombatRowDedupeUid != null && String(action.reportCombatRowDedupeUid).trim() !== "") {
            healActionsWithUid++;
        }
    }
    assert(
        healActionsWithUid === healActionsWithHealTarget,
        `Parse: jede Heil-Zielzeile sollte reportCombatRowDedupeUid haben (${healActionsWithUid}/${healActionsWithHealTarget}).`,
    );

    const listedSkills = [...new Set(healTargetsParsed.map(x => x.skill).filter(Boolean))];
    assert(
        listedSkills.some(s => /Lied der Lebensfreude/i.test(s)),
        `Parse-E2E: „Lied der Lebensfreude“ unter Heil-Zielen fehlt: ${listedSkills.join(", ")}`,
    );

    const statQuery = new exp.QueryModel.StatQuery("heroes", "heal", []);
    const stats = exp.SearchEngine.doQuery(statQuery, [levelData]);

    assert(stats && stats.healValue > 0, `EKS healValue sollte > 0 sein (ist ${stats && stats.healValue}).`);
    assert(stats.actions && stats.actions.length > 0, "EKS Heilungs-Aktionsliste leer.");

    const namesInListed = collectHealSkillNames(stats.actions);
    assert(
        namesInListed.some(s => /Lied der Lebensfreude/i.test(s)),
        `EKS Aktionsliste: „Lied der Lebensfreude“ fehlt: ${namesInListed.slice(0, 15).join(" | ")}`,
    );
    assert(
        namesInListed.some(s => /Vorbeugende Heilung/i.test(s)),
        `EKS Aktionsliste: „Vorbeugende Heilung“ fehlt: ${namesInListed.slice(0, 20).join(" | ")}`,
    );
    assert(
        namesInListed.some(s => /Fröhlicher Gesang/i.test(s)),
        `EKS Aktionsliste: HoT „Fröhlicher Gesang“ (Tooltip Heilung Hitpoints) fehlt — Parser-Fallback: ${namesInListed.slice(0, 25).join(" | ")}`,
    );
    const vorbeugCount = namesInListed.filter(s => /Vorbeugende Heilung/i.test(s)).length;
    assert(
        vorbeugCount >= 3,
        `EKS: „Vorbeugende Heilung“ sollte pro Cast in der Chronologie erscheinen (Fixture: 3+), ist ${vorbeugCount}.`,
    );

    const uidsHero = stats.actions.filter(a => a && a.reportCombatRowDedupeUid != null && String(a.reportCombatRowDedupeUid).startsWith("0|"));
    assert(uidsHero.length > 0, "Mindestens eine Action sollte reportCombatRowDedupeUid haben.");

    assertNoDuplicateEventKeys(exp.SearchEngine, "Heilungs-Ansicht stats.actions", stats.actions);
    assertNoDuplicateEventKeys(exp.SearchEngine, "Heilungs-Ansicht stats.actionsHelden", stats.actionsHelden);
    assertCrKeysMatchReportUid(exp.SearchEngine, stats.actions);

    assert(
        stats._listedActionEventKeys == null || stats._listedActionEventKeys.size === stats.actions.length,
        "Set der Event-Keys sollte zur Aktionslisten-Länge passen (alle Einträge über denselben Dedupe-Pfad).",
    );

    console.log("[OK] heal-e2e — parse Heil-Ziele:", healTargetsParsed.length, "; EKS healValue:", stats.healValue, "; listedActions:", stats.actions.length, "; warns:", warnings && warnings.length);
})().catch(err => {
    console.error("[FAIL] heal-e2e:", err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
});
