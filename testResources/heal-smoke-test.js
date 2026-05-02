// Heal smoke test for ErweiterteKampfstatistik.user.js
// Run:
//   cscript //nologo C:\Portables\Workspaces\WoD-Mods\testResources\heal-smoke-test.js

var fso = new ActiveXObject('Scripting.FileSystemObject');
var scriptDir = fso.GetParentFolderName(WScript.ScriptFullName);
var repoRoot = fso.GetParentFolderName(scriptDir);
var reportPath = fso.BuildPath(scriptDir, 'Kampfreport_05_Heilung.html');

function readText(path) {
    var stream = fso.OpenTextFile(path, 1, false, 0);
    var text = stream.ReadAll();
    stream.Close();
    return text;
}

function assert(cond, message) {
    if (!cond) {
        throw new Error(message);
    }
}

function countOccurrences(text, needle) {
    var count = 0;
    var pos = 0;
    while (true) {
        pos = text.indexOf(needle, pos);
        if (pos === -1) break;
        count++;
        pos += needle.length;
    }
    return count;
}

function parsePositiveNumber(value) {
    var parsed = parseFloat(String(value || '').replace(',', '.'));
    return isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseHpGainFromWirkung(effect) {
    if (!effect || !effect.name) return 0;
    if (!/Heilung\s+Hitpoints/i.test(String(effect.name))) return 0;
    var match = String(effect.wirkung || '').match(/([-+]?\d+(?:[.,]\d+)?)/);
    if (!match) return 0;
    return parsePositiveNumber(match[1]);
}

function getDirectHealingPotential(action, target) {
    var directTargetValue = parsePositiveNumber(target && target.wirkung && target.wirkung.value);
    if (target && target.typ === 'Heilung' && directTargetValue > 0) {
        return directTargetValue;
    }
    var fallbackHpGain = parsePositiveNumber(action && action.skill && action.skill.hpGain);
    return fallbackHpGain > 0 ? fallbackHpGain : 0;
}

function parseHpSnapshotValue(value) {
    var text = String(value || '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    var ratioMatch, singleMatch;
    if (!text) return { current: 0, max: 0 };
    ratioMatch = text.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/);
    if (ratioMatch) {
        return {
            current: parsePositiveNumber(ratioMatch[1]),
            max: parsePositiveNumber(ratioMatch[2])
        };
    }
    singleMatch = text.match(/(\d+(?:[.,]\d+)?)/);
    if (singleMatch) {
        return { current: parsePositiveNumber(singleMatch[1]), max: parsePositiveNumber(singleMatch[1]) };
    }
    return { current: 0, max: 0 };
}

function getHealedAmountCap(unit, observedMaxHpByUnitKey) {
    var key, snapshot, current, maxHp;
    if (!unit || !unit.id) return 0;
    key = unit.id.name || unit.id.id || '';
    snapshot = parseHpSnapshotValue(unit.hp);
    current = snapshot.current > 0 ? snapshot.current : 0;
    maxHp = snapshot.max > 0 ? snapshot.max : ((observedMaxHpByUnitKey && observedMaxHpByUnitKey[key]) || 0);
    if (!(maxHp > 0)) return 0;
    return Math.max(0, maxHp - current);
}

function run() {
    var reportText = readText(reportPath);
    var observedMaxHpByUnitKey = { 'Adalbert': 30 };

    // Fixture sanity checks
    assert(reportText.indexOf('Heilung Hitpoints') !== -1, 'Heilungs-Tooltip fehlt im Testreport.');
    assert(reportText.indexOf('Lied der Lebensfreude') !== -1, 'Erwartete Heal-Aktion "Lied der Lebensfreude" fehlt.');
    assert(reportText.indexOf('Vorbeugende Heilung') !== -1, 'Erwartete Heal-Aktion "Vorbeugende Heilung" fehlt.');
    assert(countOccurrences(reportText, 'Heilung Hitpoints') >= 8, 'Zu wenige Heilungs-Treffer im Fixture gefunden.');

    // Behavioral contract checks against representative report values
    assert(parseHpGainFromWirkung({ name: 'Heilung Hitpoints', wirkung: '+2,72' }) === 2.72, 'parseHpGainFromWirkung(+2,72) ist falsch.');
    assert(parseHpGainFromWirkung({ name: 'Heilung Hitpoints', wirkung: '+9' }) === 9, 'parseHpGainFromWirkung(+9) ist falsch.');
    assert(parseHpGainFromWirkung({ name: 'Parade Nahkampf', wirkung: '+4,69' }) === 0, 'Nicht-Heal-Effekt wurde fälschlich als Heilung erkannt.');

    assert(getDirectHealingPotential({ skill: { hpGain: '2,72' } }, { typ: 'Buff', wirkung: { value: '0' } }) === 2.72, 'hpGain-Fallback für direkte Heilung ist falsch.');
    assert(getDirectHealingPotential({ skill: { hpGain: '2,72' } }, { typ: 'Heilung', wirkung: { value: '2,00' } }) === 2, 'Direkte Heilung aus Target-Wert ist falsch.');

    assert(getHealedAmountCap({ id: { name: 'Adalbert' }, hp: '18/30' }, observedMaxHpByUnitKey) === 12, 'Heilungs-Cap aus Snapshot ist falsch.');
    assert(getHealedAmountCap({ id: { name: 'Adalbert' }, hp: '30' }, observedMaxHpByUnitKey) === 0, 'Voller HP-Snapshot sollte Cap 0 ergeben.');

    WScript.Echo('[OK] Heal-Smoke-Test bestanden');
    WScript.Echo(' - Report: ' + reportPath);
}

try {
    run();
} catch (e) {
    WScript.Echo('[FAIL] Heal-Smoke-Test: ' + e.message);
    WScript.Quit(1);
}






