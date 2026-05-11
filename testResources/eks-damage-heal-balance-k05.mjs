/**
 * Kampfreport_05_Heilung — automatisierte Checks rund um Schaden/Heilung (Helden, gleiche Phasen).
 *
 * 1) **Phasenparität**: Verteidigung und Heilung sollen Vorrunde + Initiative mitzählen. Dafür wird
 *    dieselbe Abfrage auf geklonten Leveldaten ausgeführt, bei denen `vorrunde` und `initiative`
 *    leer sind: die vollen Summen müssen **mindestens** so groß sein wie die gestrippten.
 * 2) **Goldwerte** (Helden, Einheiten-Filter): fängt Regressionen ab (Parser-/EKS-Änderungen).
 * 3) Indirekte Schäden/Heilung bilanzrelevant nur über die Regenerationsphase (EKS).
 * 4) **Snapshot−Buchung**: Summe ΔHP(Statustafel) − (gebuchte Heilung − Schaden) pro Runde
 *    gleich `healRoundBilanzKorrektur` nach `applyRoundHpReconciliation` (keine „verlorenen“ Korrekturen).
 * 5) **HP-Heilung (erhalten)** vs. **HP-Heilung (ausgehend)**: gleiche Root-Roh-Summe (ohne Rundenkorrektur) bei leerem Filter
 *    (pro Kante einmal auf die Wurzel gebucht; Unterteilung nach Einheit ist nur andere Schnittrichtung).
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
const GOLDEN_HEROES_DEFENSE_SUM = 572;
/** Summe „Gesamt Heilung“ inkl. healRoundBilanzKorrektur (Statuslisten-ΔHP vs. gebuchte Mengen). */
const GOLDEN_HEROES_HEAL_SUM = 533;
/** healValue + Auto-Regen + Gefährten über Helden-Zeilen ohne Bilanzkorrektur — Rohwerte aus dem Bericht. */
const GOLDEN_HEROES_HEAL_RAW_SUB_ROWS = 566;

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
    let rrk = 0;
    for (const row of Object.values(stats.sub || {})) {
        if (!row || typeof row !== "object") continue;
        heal += Number(row.healValue || 0);
        autoR += Number(row.autoRegenHealValue || 0);
        comp += Number(row.companionValue || 0);
        rrk += Number(row.healRoundBilanzKorrektur || 0);
    }
    return { healValue: heal, autoRegen: autoR, companion: comp, roundKorr: rrk, gesamt: heal + autoR + comp + rrk };
}

/** Root: direkt + Auto + Gefährten ohne Rundenkorrektur — einmalige Aggregation (Filter []). */
function rootHealRawNoRoundKorr(stats) {
    return (
        Number(stats.healValue || 0) +
        Number(stats.autoRegenHealValue || 0) +
        Number(stats.companionValue || 0)
    );
}

/**
 * Summe aller Runden: ΔHP(Snapshot) − gebuchte (Heilung − Schaden), analog zu applyRoundHpReconciliation.
 * Vor Reconciliation; muss danach gleich healStats.healRoundBilanzKorrektur (und Sub-rbk-Summe) sein.
 */
function computeGrandSnapshotBookingResidual(SE, levelDataArray, wantHeroes) {
    let grand = 0;
    const healBooked = SE._bookingRoundHealByKey || {};
    const dmgBooked = SE._bookingRoundDmgByKey || {};
    for (let levelNr = 1; levelNr <= levelDataArray.length; levelNr++) {
        const level = levelDataArray[levelNr - 1];
        if (!level || !level.areas) continue;
        level.nr = level.nr || levelNr;
        for (let areaNr = 1; areaNr <= level.areas.length; areaNr++) {
            const area = level.areas[areaNr - 1];
            if (!area) continue;
            area.nr = area.nr || areaNr;
            const rounds = area.rounds || [];
            for (let ri = 0; ri < rounds.length; ri++) {
                const round = rounds[ri];
                if (!round) continue;
                round.nr = round.nr || ri + 1;
                const rk = SE.roundBookingCompositeKey(level, area, round);
                const deltaByKey = SE.computeRoundHpDeltaByTargetKey(area, ri, wantHeroes);
                const hMap = healBooked[rk] || {};
                const dMap = dmgBooked[rk] || {};
                const keys = new Set();
                Object.keys(deltaByKey || {}).forEach(k => keys.add(k));
                Object.keys(hMap).forEach(k => keys.add(k));
                Object.keys(dMap).forEach(k => keys.add(k));
                keys.forEach(k => {
                    const d = deltaByKey[k] != null ? Number(deltaByKey[k]) : 0;
                    const h = hMap[k] || 0;
                    const dm = dMap[k] || 0;
                    grand += Math.round(d - (h - dm));
                });
            }
        }
    }
    return grand;
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

function collectRoundRegenEffectsForUnit(levelDataOne, roundNr, unitName) {
    const out = [];
    const levels = levelDataOne || [];
    const norm = s => String(s || "").toLowerCase();
    for (const level of levels) {
        for (const area of (level.areas || [])) {
            for (let ri = 0; ri < (area.rounds || []).length; ri++) {
                const round = area.rounds[ri];
                const curRoundNr = Number(round && round.nr || (ri + 1));
                if (curRoundNr !== Number(roundNr)) continue;
                for (const action of (round.actions && round.actions.regen) || []) {
                    const tu = (action && action.targets && action.targets[0] && action.targets[0].unit) || (action && action.unit);
                    if (!tu || !tu.id) continue;
                    if (norm(tu.id.name) !== norm(unitName)) continue;
                    const effects = action.eksRegenIndirectEffects || [];
                    effects.forEach(e => out.push(e));
                }
            }
        }
    }
    return out;
}

function hasEffect(effects, pred) {
    return (effects || []).some(e => !!e && pred(e));
}

function collectAllRegenActions(levelDataOne) {
    const out = [];
    const levels = levelDataOne || [];
    for (const level of levels) {
        for (const area of (level.areas || [])) {
            for (let ri = 0; ri < (area.rounds || []).length; ri++) {
                const round = area.rounds[ri];
                for (const action of ((round.actions && round.actions.regen) || [])) {
                    out.push({ level, area, round, action });
                }
            }
        }
    }
    return out;
}

function collectEksRowsForTargetFromStats(stats, roundNr, unitName) {
    const out = [];
    const norm = s => String(s || "").toLowerCase();
    for (const sub of Object.values((stats && stats.sub) || {})) {
        if (!sub || typeof sub !== "object") continue;
        for (const action of (sub.actions || [])) {
            const effects = (action && action.eksRegenIndirectEffects) || [];
            if (effects.length === 0) continue;
            const targetUnit = action && action.targets && action.targets[0] && action.targets[0].unit;
            const actionRound = Number(action && action.round && action.round.nr || 0);
            if (!targetUnit || !targetUnit.id) continue;
            if (actionRound !== Number(roundNr)) continue;
            if (norm(targetUnit.id.name) !== norm(unitName)) continue;
            out.push({
                actionUnit: action && action.unit && action.unit.id && action.unit.id.name,
                target: targetUnit.id.name,
                round: actionRound,
                effects: effects.map(e => ({
                    kind: e.kind,
                    value: Number(e.value || 0),
                    role: e.role,
                    sourceName: e.sourceName,
                })),
            });
        }
    }
    return out;
}

function collectEksRowsFromStats(stats) {
    const rows = [];
    for (const sub of Object.values((stats && stats.sub) || {})) {
        if (!sub || typeof sub !== "object") continue;
        for (const action of (sub.actions || [])) {
            const effects = action && action.eksRegenIndirectEffects;
            if (!effects || effects.length === 0) continue;
            const actionUnit = action && action.unit;
            const targetUnit = action && action.targets && action.targets[0] && action.targets[0].unit;
            rows.push({ action, effects, actionUnit, targetUnit });
        }
    }
    return rows;
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
    exp.SearchEngine.ensureRegenIndirectEnrichment(levelArray);
    const counts = countVorrundeInitiativeActions(levelArray);
    assert(counts.vorrunde > 0 || counts.initiative > 0, "Fixture soll Vorrunden- oder Initiativ-Aktionen enthalten (sonst ist Phasen-Test wirkungslos).");

    const QF = exp.QueryModel.QueryFilter;
    const unitFilter = [new QF("unit", null)];

    {
        exp.SearchEngine.resetRoundHpBooking();
        const healInRaw = exp.SearchEngine.doQuery(new exp.QueryModel.StatQuery("heroes", "heal", []), levelArray);
        const healOutRaw = exp.SearchEngine.doQuery(new exp.QueryModel.StatQuery("heroes", "heal_out", []), levelArray);
        const rin = rootHealRawNoRoundKorr(healInRaw);
        const rout = rootHealRawNoRoundKorr(healOutRaw);
        assert(rin === rout, `Helden Heilung erhalten vs. ausgehend (Root, ohne Rundenkorrektur): ${rin} vs. ${rout}`);
        assert(
            Number(healOutRaw.healRoundBilanzKorrektur || 0) === 0,
            "heal_out ohne Reconciliation: healRoundBilanzKorrektur am Root muss 0 sein.",
        );
    }

    exp.SearchEngine.resetRoundHpBooking();
    const defenseFull = exp.SearchEngine.doQuery(new exp.QueryModel.StatQuery("heroes", "defense", unitFilter), levelArray);
    const healFull = exp.SearchEngine.doQuery(new exp.QueryModel.StatQuery("heroes", "heal", unitFilter), levelArray);
    const grandResidualFull = computeGrandSnapshotBookingResidual(exp.SearchEngine, levelArray, true);
    exp.SearchEngine.applyRoundHpReconciliation(levelArray, healFull, defenseFull, true);
    assert(
        grandResidualFull === Number(healFull.healRoundBilanzKorrektur || 0),
        `K05 Snapshot−Buchung: Gesamtrest ${grandResidualFull} muss healRoundBilanzKorrektur ${healFull.healRoundBilanzKorrektur} sein (Helden, voll).`,
    );

    const stripped = levelDataStripVorrundeInitiative(levelArray);
    exp.SearchEngine.resetRoundHpBooking();
    const defenseStripped = exp.SearchEngine.doQuery(new exp.QueryModel.StatQuery("heroes", "defense", unitFilter), stripped);
    const healStripped = exp.SearchEngine.doQuery(new exp.QueryModel.StatQuery("heroes", "heal", unitFilter), stripped);
    const grandResidualStrip = computeGrandSnapshotBookingResidual(exp.SearchEngine, stripped, true);
    exp.SearchEngine.applyRoundHpReconciliation(stripped, healStripped, defenseStripped, true);
    assert(
        grandResidualStrip === Number(healStripped.healRoundBilanzKorrektur || 0),
        `K05 Snapshot−Buchung: Gesamtrest ${grandResidualStrip} muss healRoundBilanzKorrektur ${healStripped.healRoundBilanzKorrektur} sein (Helden, gestrippt).`,
    );

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

    {
        const SE = exp.SearchEngine;
        const round3 = levelArray[0].areas[0].rounds[2];
        const thor = (round3.helden || []).find(u => u && u.id && u.id.name === "Thorambur");
        assert(!!thor, "Fixture: Thorambur fehlt in Runde 3");
        const histVorOnly = {};
        SE.registerVorrundeEffectSourcesOnly(histVorOnly, round3);
        const rawLoss = SE.resolveHpLossContributors(round3, thor, histVorOnly);
        const augLoss = SE.resolveHpLossContributorsAugmented(round3, thor, histVorOnly);
        assert(!(rawLoss.knownWeight > 0), "Roher Loss-Contributor ohne ausreichende Historie soll hier 0 knownWeight haben.");
        assert(
            augLoss.knownWeight === 9 && SE.sumStatusHeilungHitpointsLossBudget(round3, thor) === 9,
            "Augment: Status-„Heilung Hitpoints“-DoT soll bei Historien-Lücke wie DoT nominal 9 setzen.",
        );
    }

    {
        const SE = exp.SearchEngine;
        const round3 = levelArray[0].areas[0].rounds[2];
        const ad = (round3.helden || []).find(u => u && u.id && u.id.name === "Adalbert");
        assert(!!ad, "Fixture: Adalbert in Kampfrunde 3");
        const histHeal = {};
        for (let ri = 0; ri < 2; ri++) {
            const rr = levelArray[0].areas[0].rounds[ri];
            SE.registerVorrundeEffectSourcesOnly(histHeal, rr);
            SE.registerInitiativeAndRundeEffectSourcesOnly(histHeal, rr);
        }
        SE.registerVorrundeEffectSourcesOnly(histHeal, round3);
        const hctx = SE.resolveHpHealContributors(round3, ad, histHeal);
        const names = (hctx.contributors || []).map(c => ("" + (c.sourceName || "")).toLowerCase()).join("|");
        assert(
            names.includes("experimentelle") && names.includes("lebensfreude") && names.includes("vorbeugende"),
            "Adalbert R3: sämtliche Status-HoTs (Experimentelle Stärkung, Lied der Lebensfreude, Vorbeugende Heilung) müssen buchbare Contributors haben.",
        );
    }

    {
        const SE = exp.SearchEngine;
        assert(
            SE.parseHpLossFromWirkung({ name: "Heilung Hitpoints", wirkung: "-7,00 n\u00e4chste Runde" }) === 0,
            "Future-Filter: \"n\u00e4chste Runde\" darf nicht als aktueller HP-Verlust gez\u00e4hlt werden.",
        );
        assert(
            SE.parseHpGainFromWirkung({ name: "Heilung Hitpoints", wirkung: "+5,00 n\u00e4chste Runde" }) === 0,
            "Future-Filter: \"n\u00e4chste Runde\" darf nicht als aktuelle Heilung gez\u00e4hlt werden.",
        );
        assert(
            SE.parseHpLossFromWirkung({ name: "Heilung Hitpoints", wirkung: "-7,00 in5 Runden" }) === 0,
            "Future-Filter: auch kompakte Schreibweise wie \"in5 Runden\" darf nicht aktuell gezählt werden.",
        );
        assert(
            SE.parseHpLossFromWirkung({ name: "Heilung Hitpoints", wirkung: "-7,00 5 Runden" }) === 0,
            "Future-Filter: auch Schreibweise ohne \"in\" (\"5 Runden\") darf nicht aktuell gezählt werden.",
        );
        assert(
            SE.parseHpLossFromWirkung({ name: "Heilung Hitpoints", wirkung: "-7,00", wann: "in 5 Runden" }) === 0,
            "Future-Filter: separater Parser-\"wann\"-Hinweis (in 5 Runden) darf nicht aktuell zählen.",
        );
        assert(
            SE.parseHpLossFromWirkung({ name: "Heilung Hitpoints", wirkung: "-7,00", wann: "in einer Runde" }) === 0,
            "Future-Filter: separater Parser-\"wann\"-Hinweis (in einer Runde) darf nicht aktuell zählen.",
        );
        assert(
            SE.parseHpLossFromWirkung({ name: "Heilung Hitpoints", wirkung: "-7,00", wann: "nächste Runde" }) === 0,
            "Future-Filter: separater Parser-\"wann\"-Hinweis (nächste Runde) darf nicht aktuell zählen.",
        );
    }

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
    assert(
        subComp === GOLDEN_HEROES_HEAL_RAW_SUB_ROWS - rootNoComp,
        `Gefährten-Summe: erwartet ${GOLDEN_HEROES_HEAL_RAW_SUB_ROWS - rootNoComp}, ist ${subComp}`,
    );

    const balorR1RegenEffects = collectRoundRegenEffectsForUnit(levelArray, 1, "Balor");
    const futurePoxInR1 = balorR1RegenEffects.filter(e =>
        e && e.kind === "damage" && /gr\u00fcnen pocken|gruenen pocken|pocken/i.test(String(e.sourceName || "")),
    );
    assert(
        futurePoxInR1.length === 0,
        "Runde 1 Balor: \"Fluch der gr\u00fcnen Pocken\" darf noch nicht als indirekter Schaden verbucht werden (in X Runden).",
    );
    const balorR1SyntheticDamage = balorR1RegenEffects.filter(e => e && e.kind === "damage");
    assert(
        balorR1SyntheticDamage.length === 0,
        "Runde 1 Balor: synthetische Regenerations-Debugzeile darf keinen indirekten Schaden buchen.",
    );
    const balorR1DefenseRows = collectEksRowsForTargetFromStats(defenseFull, 1, "Balor");
    assert(
        balorR1DefenseRows.length === 0,
        `Runde 1 Balor: keine EKS-Verteidigungsbuchung erwartet, gefunden: ${JSON.stringify(balorR1DefenseRows)}`,
    );
    const balorR1HealRows = collectEksRowsForTargetFromStats(healFull, 1, "Balor");
    assert(
        balorR1HealRows.length === 0,
        `Runde 1 Balor: keine EKS-Heilbuchung erwartet, gefunden: ${JSON.stringify(balorR1HealRows)}`,
    );

    const terkasR5 = collectRoundRegenEffectsForUnit(levelArray, 5, "Terkas");
    assert(
        terkasR5.length === 0,
        `Runde 5 Terkas: ohne effektive HP-Änderung darf keine EKS-Buchung entstehen, gefunden: ${JSON.stringify(terkasR5)}`,
    );

    {
        const SE = exp.SearchEngine;
        const allEksRows = collectEksRowsFromStats(defenseFull).concat(collectEksRowsFromStats(healFull));
        const invalid = allEksRows.filter(row => {
            const au = row.actionUnit;
            const tu = row.targetUnit;
            return !SE.isUnitEligibleForRegenBooking(au) || !SE.isUnitEligibleForRegenBooking(tu);
        });
        assert(
            invalid.length === 0,
            "EKS-Invariante: synthetische Regen-/Status-Buchungen dürfen nur aktive Kampfeinheiten betreffen.",
        );
    }

    {
        const SE = exp.SearchEngine;
        const allRegen = collectAllRegenActions(levelArray);
        allRegen.forEach(({ level, area, round, action }) => {
            if (!action || !Array.isArray(action.eksRegenIndirectEffects) || action.eksRegenIndirectEffects.length === 0) return;
            const net = action.eksRegenIndirectEffects.reduce((sum, e) => {
                const v = Math.floor(Number((e && e.value) || 0));
                if (!(v > 0)) return sum;
                if (e.kind === "heal") return sum + v;
                if (e.kind === "damage") return sum - v;
                return sum;
            }, 0);
            const expectedNet = (() => {
                if (action.syntheticRegenBilanzZeile) return 0;
                if (!action.event) return 0;
                const v = Math.floor(Number(action.event.value || action.event.loss || 0));
                if (action.event.kind === "hpgain") return Math.max(0, v);
                if (action.event.kind === "hploss") return -Math.max(0, v);
                return 0;
            })();
            const tu = (action.targets && action.targets[0] && action.targets[0].unit) || action.unit;
            const targetName = tu && tu.id && tu.id.name || "?";
            assert(
                net === expectedNet,
                `Regen-Bilanzfehler L${level.nr || 1}.A${area.nr || 1}.R${round.nr || 0} ${targetName}: netto ${net} statt erwartet ${expectedNet}`,
            );
        });
    }

    const thoramburR2 = collectRoundRegenEffectsForUnit(levelArray, 2, "Thorambur");
    assert(
        hasEffect(thoramburR2, e =>
            e.kind === "damage" &&
            Number(e.value || 0) === 9 &&
            /gesang des hohnes/i.test(String(e.sourceName || "")),
        ),
        "Runde 2 Thorambur: erwarteter Brutto-DoT-Schaden 9 durch \"Gesang des Hohnes\" fehlt.",
    );
    assert(
        hasEffect(thoramburR2, e =>
            e.kind === "heal" &&
            Number(e.value || 0) === 2 &&
            /experimentelle st\u00e4rkung/i.test(String(e.sourceName || "")),
        ),
        "Runde 2 Thorambur: erwartete +2 Heilung aus \"Experimentelle St\u00e4rkung\" fehlt.",
    );
    assert(
        hasEffect(thoramburR2, e =>
            e.kind === "heal" &&
            Number(e.value || 0) === 2 &&
            /lied der lebensfreude/i.test(String(e.sourceName || "")),
        ),
        "Runde 2 Thorambur: erwartete +2 Heilung aus \"Lied der Lebensfreude\" fehlt.",
    );
    assert(
        hasEffect(thoramburR2, e =>
            e.kind === "heal" &&
            Number(e.value || 0) === 2 &&
            e.role === "remainder_auto",
        ),
        "Runde 2 Thorambur: erwartete Auto-Regeneration +2 (remainder_auto) fehlt.",
    );

    const thoramburR3 = collectRoundRegenEffectsForUnit(levelArray, 3, "Thorambur");
    assert(
        hasEffect(thoramburR3, e =>
            e.kind === "damage" &&
            Number(e.value || 0) === 9 &&
            /gesang des hohnes/i.test(String(e.sourceName || "")),
        ),
        "Runde 3 Thorambur: erwarteter DoT-Schaden 9 durch \"Gesang des Hohnes\" fehlt.",
    );
    assert(
        hasEffect(thoramburR3, e =>
            e.kind === "heal" &&
            Number(e.value || 0) === 8 &&
            /vorbeugende heilung/i.test(String(e.sourceName || "")),
        ),
        "Runde 3 Thorambur: erwartete +8 Heilung aus \"Vorbeugende Heilung\" fehlt.",
    );
    assert(
        hasEffect(thoramburR3, e =>
            e.kind === "heal" &&
            Number(e.value || 0) === 2 &&
            /experimentelle st\u00e4rkung/i.test(String(e.sourceName || "")),
        ),
        "Runde 3 Thorambur: erwartete +2 Heilung aus \"Experimentelle St\u00e4rkung\" fehlt.",
    );
    assert(
        hasEffect(thoramburR3, e =>
            e.kind === "heal" &&
            Number(e.value || 0) === 1 &&
            e.role === "remainder_auto",
        ),
        "Runde 3 Thorambur: erwartete Auto-Regeneration +1 (remainder_auto) fehlt.",
    );

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
