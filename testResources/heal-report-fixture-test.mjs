/**
 * Portabler Heilungs-Fixture-Check (wie heal-smoke-test.js, ohne WScript).
 * Liest testResources/Kampfreport_05_Heilung.html und validiert erwarteten Inhalt + Heilungs-Helferlogik.
 *
 * Run: node testResources/heal-report-fixture-test.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const reportPath = path.join(__dirname, "Kampfreport_05_Heilung.html");

function assert(cond, message) {
    if (!cond) throw new Error(message || "Assertion failed");
}

function countOccurrences(text, needle) {
    let count = 0;
    let pos = 0;
    while (true) {
        pos = text.indexOf(needle, pos);
        if (pos === -1) break;
        count++;
        pos += needle.length;
    }
    return count;
}

function parsePositiveNumber(value) {
    const parsed = parseFloat(String(value || "").replace(",", "."));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseHpGainFromWirkung(effect) {
    if (!effect || !effect.name) return 0;
    if (!/Heilung\s+Hitpoints/i.test(String(effect.name))) return 0;
    if (isScheduledHpEffectInFuture(effect)) return 0;
    const match = String(effect.wirkung || "").match(/([-+]?\d+(?:[.,]\d+)?)/);
    if (!match) return 0;
    return parsePositiveNumber(match[1]);
}

function parseHpLossFromWirkung(effect) {
    if (!effect || !effect.name) return 0;
    if (!/Heilung\s+Hitpoints/i.test(String(effect.name))) return 0;
    if (isScheduledHpEffectInFuture(effect)) return 0;
    const match = String(effect.wirkung || "").match(/([-+]?\d+(?:[.,]\d+)?)/);
    if (!match) return 0;
    const parsed = Number(String(match[1]).replace(",", "."));
    if (!Number.isFinite(parsed) || parsed >= 0) return 0;
    return -parsed;
}

function isScheduledHpEffectInFuture(effect) {
    const text = String((effect && effect.wirkung) || "");
    const m = text.match(/\bin\s+(\d+)\s+Runden?\b/i);
    if (!m) return false;
    return Number(m[1]) > 0;
}

function getDirectHealingPotential(action, target) {
    const directTargetValue = parsePositiveNumber(target && target.wirkung && target.wirkung.value);
    if (target && target.typ === "Heilung" && directTargetValue > 0) {
        return directTargetValue;
    }
    const fallbackHpGain = parsePositiveNumber(action && action.skill && action.skill.hpGain);
    return fallbackHpGain > 0 ? fallbackHpGain : 0;
}

function parseHpSnapshotValue(value) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    if (!text) return { current: 0, max: 0 };
    const ratioMatch = text.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/);
    if (ratioMatch) {
        return {
            current: parsePositiveNumber(ratioMatch[1]),
            max: parsePositiveNumber(ratioMatch[2]),
        };
    }
    const singleMatch = text.match(/(\d+(?:[.,]\d+)?)/);
    if (singleMatch) {
        const current = parsePositiveNumber(singleMatch[1]);
        return { current, max: current };
    }
    return { current: 0, max: 0 };
}

function getHealedAmountCap(unit, observedMaxHpByUnitKey) {
    if (!unit || !unit.id) return 0;
    const key = unit.id.name || unit.id.id || "";
    const snapshot = parseHpSnapshotValue(unit.hp);
    const current = snapshot.current > 0 ? snapshot.current : 0;
    let maxHp = snapshot.max > 0 ? snapshot.max : ((observedMaxHpByUnitKey && observedMaxHpByUnitKey[key]) || 0);
    if (!(maxHp > 0)) return 0;
    return Math.max(0, maxHp - current);
}

function run() {
    assert(fs.existsSync(reportPath), `Fixture fehlt: ${reportPath}`);
    const reportText = fs.readFileSync(reportPath, "utf8");
    const observedMaxHpByUnitKey = { Adalbert: 30 };

    assert(reportText.includes("Heilung Hitpoints"), "Heilungs-Tooltip fehlt im Testreport.");
    assert(reportText.includes("Lied der Lebensfreude"), 'Erwartete Heal-Aktion "Lied der Lebensfreude" fehlt.');
    assert(reportText.includes("Vorbeugende Heilung"), 'Erwartete Heal-Aktion "Vorbeugende Heilung" fehlt.');
    assert(countOccurrences(reportText, "Heilung Hitpoints") >= 8, "Zu wenige Heilungs-Treffer im Fixture gefunden.");

    assert(parseHpGainFromWirkung({ name: "Heilung Hitpoints", wirkung: "+2,72" }) === 2.72, "parseHpGainFromWirkung(+2,72) ist falsch.");
    assert(parseHpGainFromWirkung({ name: "Heilung Hitpoints", wirkung: "+9" }) === 9, "parseHpGainFromWirkung(+9) ist falsch.");
    assert(parseHpGainFromWirkung({ name: "Heilung Hitpoints", wirkung: "+7,00 in 5 Runden" }) === 0, "Zukünftiger HoT darf noch nicht zählen (+X in N Runden).");
    assert(parseHpLossFromWirkung({ name: "Heilung Hitpoints", wirkung: "-7,00 in 5 Runden" }) === 0, "Zukünftiger DoT darf noch nicht zählen (-X in N Runden).");
    assert(parseHpLossFromWirkung({ name: "Heilung Hitpoints", wirkung: "-7,00" }) === 7, "parseHpLossFromWirkung(-7,00) ist falsch.");
    assert(parseHpGainFromWirkung({ name: "Parade Nahkampf", wirkung: "+4,69" }) === 0, "Nicht-Heal-Effekt wurde fälschlich als Heilung erkannt.");

    assert(getDirectHealingPotential({ skill: { hpGain: "2,72" } }, { typ: "Buff", wirkung: { value: "0" } }) === 2.72, "hpGain-Fallback für direkte Heilung ist falsch.");
    assert(getDirectHealingPotential({ skill: { hpGain: "2,72" } }, { typ: "Heilung", wirkung: { value: "2,00" } }) === 2, "Direkte Heilung aus Target-Wert ist falsch.");

    assert(getHealedAmountCap({ id: { name: "Adalbert" }, hp: "18/30" }, observedMaxHpByUnitKey) === 12, "Heilungs-Cap aus Snapshot ist falsch.");
    assert(getHealedAmountCap({ id: { name: "Adalbert" }, hp: "30" }, observedMaxHpByUnitKey) === 0, "Voller HP-Snapshot sollte Cap 0 ergeben.");

    console.log("[OK] heal-report-fixture-test — Report:", reportPath);
}

try {
    run();
} catch (e) {
    console.error("[FAIL] heal-report-fixture-test:", e.message);
    process.exit(1);
}
