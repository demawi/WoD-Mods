/**
 * Fixture: alle auf Max-HP, kein realer Heilungsbedarf → keine indirekte Heilung aus Supplement-HoT.
 * Run: node testResources/heal-keine-heilung-e2e.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const reportPath = path.join(__dirname, "Kampfreport_06_KeineHeilung.html");
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

(async function main() {
    assert(fs.existsSync(reportPath), "Fixture fehlt: " + reportPath);

    const fixtureRaw = fs.readFileSync(reportPath, "utf8");
    const fixtureHtml = stripEmbeddedScripts(fixtureRaw);

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

    const QF = exp.QueryModel.QueryFilter;
    const statQuery = new exp.QueryModel.StatQuery("heroes", "heal", [new QF("unit", null)]);
    const stats = exp.SearchEngine.doQuery(statQuery, [levelData]);

    const sub = stats.sub || {};
    let foundNachtigallIndirect = 0;
    for (const [name, st] of Object.entries(sub)) {
        if (/Nachtigall/i.test(name)) {
            foundNachtigallIndirect += Number((st && st.indirectHealValue) || 0);
        }
    }

    assert(
        stats.indirectHealValue === 0,
        `Root indirectHealValue sollte 0 sein (Max-HP-Fixture), ist ${stats.indirectHealValue}`,
    );
    assert(
        foundNachtigallIndirect === 0,
        `Nachtigall indirekte Heilung sollte 0 sein, Summe Zeilen=${foundNachtigallIndirect}`,
    );

    console.log("[OK] heal-keine-heilung-e2e — indirectHeal root:", stats.indirectHealValue, "; Nachtigall:", foundNachtigallIndirect);
})().catch(err => {
    console.error("[FAIL]", err.message);
    process.exit(1);
});
