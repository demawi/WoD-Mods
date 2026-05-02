/**
 * EKS Aktionsliste — Stable Event-Keys + Ingress wie SearchEngine.appendListedActionIfNewEvent (v0.22.2+).
 * Run: node testResources/eks-expanded-dedupe-test.mjs
 */

function normalizeStatListLabel(str) {
    let s = String(str || "").trim().toLowerCase();
    if (s.normalize) {
        s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    return s.replace(/\s+/g, " ").trim();
}

function getStatActionListActorDedupeSig(unit) {
    if (!unit || !unit.id) return "?";
    const name = normalizeStatListLabel(unit.id.name || "?");
    const side = !!unit.id.isHero ? "h" : "m";
    return name + "|" + side;
}

function getActionListDisplayRoundNr(action) {
    if (!action) return 0;
    if (action.actionListDisplayRoundNr != null && Number.isFinite(Number(action.actionListDisplayRoundNr))) {
        return Math.max(0, Math.floor(Number(action.actionListDisplayRoundNr)));
    }
    if (!action.round) return 0;
    const base = Number(action.round.nr) || 0;
    if (!base) return 0;
    return action.type === "vorrunde" ? base + 1 : base;
}

function getActionListDedupeRoundNr(action) {
    let r = getActionListDisplayRoundNr(action);
    if (r > 0) return r;
    if (!action || !action.round || action.round.nr == null) return 0;
    const base = Number(action.round.nr) || 0;
    if (!base) return 0;
    return action.type === "vorrunde" ? base + 1 : base;
}

function getActionListPhaseRank(action) {
    if (!action) return 99;
    if (action.type === "vorrunde") return 0;
    if (action.type === "regen" && action.appliedActionWasVorrunde) return 1;
    if (action.type === "regen") return 2;
    if (action.type === "initiative") return 3;
    return 4;
}

function getActionListDedupeTickPart(action) {
    if (!action || action.actionListRegenTickRoundNr == null || !Number.isFinite(Number(action.actionListRegenTickRoundNr))) {
        return "";
    }
    const tick = Math.max(0, Math.floor(Number(action.actionListRegenTickRoundNr)));
    const tgtUnit = action.targets && action.targets[0] && action.targets[0].unit;
    return "t" + tick + "_" + (tgtUnit ? getStatActionListActorDedupeSig(tgtUnit) : "");
}

function getStableSkillDedupeSig(skill) {
    if (!skill) return "_";
    if (skill.wodSkillId != null && String(skill.wodSkillId).trim() !== "") {
        return "w" + String(skill.wodSkillId).trim();
    }
    const nm = normalizeStatListLabel(skill.name || skill.typ || "");
    return nm || "_";
}

function getStatActionExpandedDedupeStructKey(action) {
    if (!action) return "st|";
    const area = action.area && action.area.nr != null ? action.area.nr : "×";
    const rn = getActionListDedupeRoundNr(action);
    const phase = getActionListPhaseRank(action);
    const tickPart = getActionListDedupeTickPart(action);
    const sk = getStableSkillDedupeSig(action.skill);
    const actor = getStatActionListActorDedupeSig(action.unit);
    const tgts = (action.targets || [])
        .map(t => (t && t.unit ? getStatActionListActorDedupeSig(t.unit) : ""))
        .filter(Boolean)
        .sort()
        .join(",");
    const ev = (action.event && action.event.kind) ? String(action.event.kind) : "";
    const typ = action.type != null && String(action.type) !== "" ? String(action.type) : "";
    return "st|A" + area + "|R" + rn + "|p" + phase + "|" + tickPart + "|" + sk + "|" + actor + "|" + tgts + "|e" + ev + "|y" + typ;
}

function getListedActionEventKey(action) {
    if (!action) return "";
    const uidRaw = action.reportCombatRowDedupeUid;
    if (uidRaw != null && String(uidRaw).trim() !== "") {
        return "cr|" + String(uidRaw);
    }
    return getStatActionExpandedDedupeStructKey(action);
}

/** Wie SearchEngine.appendListedActionIfNewEvent — nur actions[] zum Zählen. */
function appendListedActionIfNewEventLikeProd(toStat, action) {
    if (!toStat || !action) return;
    const key = getListedActionEventKey(action);
    if (key) {
        if (!toStat._listedActionEventKeys) toStat._listedActionEventKeys = new Set();
        if (toStat._listedActionEventKeys.has(key)) return;
        toStat._listedActionEventKeys.add(key);
    }
    if (!toStat.actions.includes(action)) {
        toStat.actions.push(action);
    }
}

function assert(cond, msg) {
    if (!cond) throw new Error(msg || "Assertion failed");
}

(function run() {
    const level = { nr: 1 };
    const area = { nr: 1 };
    const round = { nr: 1 };
    const actor = { id: { name: "atrix, 2. (Al)", isHero: true } };
    const tBalor = { unit: { id: { name: "Balor", isHero: false } } };
    const tDh = { unit: { id: { name: "Dharigaaz", isHero: false } } };

    const baseParsed = {
        reportCombatRowDedupeUid: "0|R1|tr42",
        level,
        area,
        round,
        type: "action",
        unit: actor,
        targets: [tBalor, tDh],
        skill: { name: "Experimentelle Stärkung", wodSkillId: "12345" },
    };

    const cloneA = { ...baseParsed, src: "<tr data-a='1'>x</tr>" };
    const cloneB = { ...baseParsed, src: "<tr data-b='9'>y</tr>" };
    assert(
        getListedActionEventKey(cloneA) === "cr|" + baseParsed.reportCombatRowDedupeUid,
        "Parser-UID cr|… unabhängig von action.src"
    );
    assert(getListedActionEventKey(cloneA) === getListedActionEventKey(cloneB), "gleiches cr bei identischer reportCombatRowDedupeUid");
    let st = { actions: [] };
    [cloneA, cloneB, { ...cloneA }].forEach(a => appendListedActionIfNewEventLikeProd(st, a));
    assert(st.actions.length === 1, "Ingress: drei Klone gleicher UID ⇒ eine Zeile in actions");

    const noUid1 = {
        level,
        area,
        round,
        type: "action",
        unit: actor,
        targets: [tBalor, tDh],
        skill: { name: "Experimentelle Stärkung", wodSkillId: "12345" },
    };
    const noUid2 = { ...noUid1, src: "irrelevant" };
    assert(getListedActionEventKey(noUid1) === getListedActionEventKey(noUid2), "ohne UID: strukturelle Keys ignorieren HTML");
    st = { actions: [] };
    [noUid1, noUid2, { ...noUid1 }].forEach(a => appendListedActionIfNewEventLikeProd(st, a));
    assert(st.actions.length === 1, "ohne UID: strukturelle Duplikate am Ingress unterdrückt");

    const otherRound = { ...noUid1, round: { nr: 2 } };
    assert(getListedActionEventKey(noUid1) !== getListedActionEventKey(otherRound), "andere Runde ⇒ anderer Key");

    const level2 = { nr: 2 };
    const sameFightOtherLevelSlot = { ...noUid1, level: level2 };
    assert(
        getListedActionEventKey(noUid1) === getListedActionEventKey(sameFightOtherLevelSlot),
        "Abenteuer-Level-Slot steuert den Event-Key nicht"
    );

    const otherSkill = { ...noUid1, skill: { name: "Anderer Buff", wodSkillId: "999" } };
    assert(getListedActionEventKey(noUid1) !== getListedActionEventKey(otherSkill), "andere Skill-ID ⇒ anderer Key");

    const vor = { ...noUid1, type: "vorrunde" };
    const ini = { ...noUid1, type: "initiative" };
    assert(getListedActionEventKey(vor) !== getListedActionEventKey(ini), "Phase/type steuert den Key");

    const tickA = {
        ...noUid1,
        type: "regen",
        actionListRegenTickRoundNr: 2,
        targets: [{ unit: { id: { name: "Ziel", isHero: true } } }],
    };
    const tickB = { ...tickA, actionListRegenTickRoundNr: 3 };
    assert(getListedActionEventKey(tickA) !== getListedActionEventKey(tickB), "Regen-Tick unterscheidet Keys");

    const order1 = { ...noUid1, targets: [tDh, tBalor] };
    assert(getListedActionEventKey(order1) === getListedActionEventKey(noUid1), "Ziele sortiert ⇒ gleicher Key");

    /** Erste Referenz gewinnt (zweites append ignoriert) */
    const first = { ...noUid1, _tag: "first" };
    const second = { ...noUid1, _tag: "second" };
    st = { actions: [] };
    appendListedActionIfNewEventLikeProd(st, first);
    appendListedActionIfNewEventLikeProd(st, second);
    assert(st.actions.length === 1 && st.actions[0]._tag === "first", "Ingress behält erste Aktion bei gleichem Event-Key");

    const hpGain = {
        level,
        area,
        round,
        type: "regen",
        unit: actor,
        targets: [tBalor],
        event: { kind: "hpgain" },
    };
    assert(getStatActionExpandedDedupeStructKey(hpGain).includes("ehpgain"), "event.kind im strukturellen Key");

    console.log("eks-expanded-dedupe-test: OK");
})();
