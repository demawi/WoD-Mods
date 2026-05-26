/**
 * Kampfreport_07 — Level-Vorbereitung „Wahre Köstlichkeiten“ (keine Kampfaktion als Auslöser).
 * Indirekte Heilung darf nicht Thorambur/Nachtigall zugeschrieben werden, sondern „(Level)“.
 *
 * Run: node testResources/eks-damage-heal-balance-k07.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const reportPath = path.join(__dirname, "Kampfreport_07.html");
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

function wahreKoestlichkeitenHealLines(effects) {
    return (effects || []).filter(
        e =>
            e &&
            e.kind === "heal" &&
            /wahre\s+köstlichkeiten/i.test(String(e.sourceName || "")),
    );
}

(async function main() {
    assert(fs.existsSync(reportPath), "Fixture fehlt: " + reportPath);

    const fixtureHtml = stripEmbeddedScripts(fs.readFileSync(reportPath, "utf8"));
    const dom = new JSDOM(fixtureHtml, {
        url: "https://www.world-of-dungeons.de/wod/spiel/report/report.php?id=fixture-k07",
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
    const SE = exp.SearchEngine;

    for (const n of [...window.document.querySelectorAll(".nowod")]) n.remove();

    const [levelData] = await dr.ReportParser.parseKampfbericht(window.document, false);
    const levelArray = [levelData];
    SE.ensureRegenIndirectEnrichment(levelArray);

    const round1 = levelArray[0].areas[0].rounds[0];
    assert(!!round1, "K07: Runde 1 fehlt");

    const hist = {};
    SE.registerVorrundeEffectSourcesOnly(hist, round1);
    SE.registerInitiativeAndRundeEffectSourcesOnly(hist, round1);

    for (const heroName of ["Thorambur", "Nachtigall"]) {
        const hero = (round1.helden || []).find(u => u && u.id && u.id.name === heroName);
        assert(!!hero, `K07: ${heroName} in Runde 1 fehlt`);

        const ctx = SE.resolveHpHealContributors(round1, hero, hist);
        const wkContrib = (ctx.contributors || []).find(c =>
            /wahre\s+köstlichkeiten/i.test(String((c && c.sourceName) || "")),
        );
        assert(!!wkContrib, `K07 ${heroName}: Contributor für Wahre Köstlichkeiten fehlt`);
        assert(
            wkContrib.unit && wkContrib.unit.id && wkContrib.unit.id.name === "(Level)",
            `K07 ${heroName}: erwartet Contributor „(Level)“, ist „${wkContrib.unit && wkContrib.unit.id && wkContrib.unit.id.name}“`,
        );

        const regenKinds = [];
        for (const level of levelArray) {
            for (const area of level.areas || []) {
                const round = (area.rounds || [])[0];
                for (const action of (round && round.actions && round.actions.regen) || []) {
                    const tu =
                        (action.targets && action.targets[0] && action.targets[0].unit) ||
                        action.unit;
                    if (tu && tu.id && tu.id.name === heroName) {
                        regenKinds.push(action.event && action.event.kind);
                    }
                }
            }
        }
        const allRegenFx = [];
        for (const level of levelArray) {
            for (const area of level.areas || []) {
                const round = (area.rounds || [])[0];
                for (const action of (round && round.actions && round.actions.regen) || []) {
                    const tu =
                        (action.targets && action.targets[0] && action.targets[0].unit) ||
                        action.unit;
                    if (tu && tu.id && tu.id.name === heroName) {
                        for (const e of action.eksRegenIndirectEffects || []) allRegenFx.push(e);
                    }
                }
            }
        }
        const wkHeal = wahreKoestlichkeitenHealLines(allRegenFx);
        assert(
            wkHeal.length > 0,
            `K07 ${heroName}: Regen-Tooltip ohne Wahre-Köstlichkeiten-Heilung (Kinds: ${regenKinds.join(",")}; Effekte: ${JSON.stringify(allRegenFx.map(e => ({ k: e.kind, v: e.value, src: e.sourceName, c: e.contributorUnitName })))})`,
        );
        for (const e of wkHeal) {
            assert(
                e.role === "attributed_split" && Number(e.value || 0) >= 1,
                `K07 ${heroName}: erwartet attributed_split mit Wert ≥1, ist ${e.role} ${e.value}`,
            );
            assert(
                String(e.contributorUnitName || "") === "(Level)",
                `K07 ${heroName}: contributorUnitName muss „(Level)“ sein, ist „${e.contributorUnitName}“`,
            );
            assert(
                !/^(thorambur|nachtigall)$/i.test(String(e.contributorUnitName || "")),
                `K07 ${heroName}: falsche Helden-Zuweisung ${e.contributorUnitName}`,
            );
        }
    }

    const wkHistKey = SE.normalizeEffectSourceName("Wahre Köstlichkeiten");
    assert(
        !SE.effectSourceHistoryHasContributors(hist[wkHistKey] || {}),
        "K07: Wahre Köstlichkeiten darf keine Effect-Source-Historie haben (Level-Buff).",
    );

    console.log("eks-damage-heal-balance-k07: OK");
})().catch(err => {
    console.error(err);
    process.exit(1);
});
