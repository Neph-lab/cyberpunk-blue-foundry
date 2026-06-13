/**
 * NET Combat — shared logic for the "NET Combat" tab on Program actors and
 * Program Executable items. Both document types carry an identical
 * `system.netCombat` block (see actor-program.mjs / item-program-executable.mjs)
 * kept in lockstep by the whole-object sync in netrunning.mjs, so every helper
 * here accepts *either* document and reads through small accessor functions.
 *
 * Responsibilities:
 *   • capability predicates (which modes a programType may use)
 *   • the `isInert` benefit-guard (##ERROR## / not-running)
 *   • sheet context builder for the shared template
 *   • on-hit attack-effect resolution (damage / affliction / effectText)
 *   • the defensive interjection pipeline (Defender / personnel / program)
 *   • Booster boost aggregation
 *
 * Attack orchestration (rolling, DV, applying final damage) stays in
 * `resolveNetAttack` (netrunning.mjs), which calls into this module.
 */

import { rollAfflictionDefense, applyAfflictionEffect } from './affliction-attack.mjs';

// ── ProgramType capability sets ─────────────────────────────────────────────
// Locked with the user:
//   Attack mode  → Anti-Personnel, Anti-Program, ICE, Black ICE, Daemon
//   Support mode → Anti-Personnel, Anti-Program only
//   Adds program/personnel defense → Defender, Booster
//   Booster section → Booster
export const ATTACK_TYPES      = ['antipersonnel', 'antiprogram', 'ice', 'blackice', 'daemon'];
export const SUPPORT_TYPES     = ['antipersonnel', 'antiprogram'];
export const ADD_DEFENSE_TYPES = ['defender', 'booster'];

/**
 * Component → uses map for the Booster authoring dropdown AND boost lookup.
 * Cracker is special: it boosts generic "attack"/"defend", applying to Zap and
 * program attacks (attack) and the Cracker defend roll (defend). Other
 * components mirror their Netrunning-tab use slugs.
 */
export const NET_COMPONENT_USES = {
  cracker:      [{ slug: 'attack', label: 'Attack' }, { slug: 'defend', label: 'Defend' }],
  codebreak:    [{ slug: 'breach', label: 'Breach' }, { slug: 'encryptDecrypt', label: 'Encrypt/Decrypt' }],
  dev:          [{ slug: 'code', label: 'Code' }, { slug: 'deconstruct', label: 'Deconstruct' }],
  ghost:        [{ slug: 'cloak', label: 'Cloak' }, { slug: 'slide', label: 'Slide' }],
  spider:       [{ slug: 'eyeDee', label: 'Eye-Dee' }, { slug: 'pathfinder', label: 'Pathfinder' }, { slug: 'scanner', label: 'Scanner' }],
  quickhacking: [{ slug: 'upload', label: 'Upload' }, { slug: 'quickbreach', label: 'Quickbreach' }],
};
const BOOSTER_COMPONENT_ORDER = ['cracker', 'codebreak', 'dev', 'ghost', 'spider', 'quickhacking'];

// ── Unified accessors (work on a Program actor OR an Executable item) ────────

export function getNetCombat(doc) {
  return doc?.system?.netCombat ?? null;
}
export function getProgramType(doc) {
  return doc?.system?.programType ?? '';
}
export function progAtk(doc) {
  return Number(doc?.system?.stats?.atk?.value ?? doc?.system?.atk ?? 0) || 0;
}
export function progDef(doc) {
  return Number(doc?.system?.stats?.def?.value ?? doc?.system?.def ?? 0) || 0;
}
export function progRez(doc) {
  return Number(doc?.system?.resources?.rez?.value ?? doc?.system?.rez?.value ?? 0) || 0;
}

// ── Capability predicates ────────────────────────────────────────────────────

export const canAttackMode  = (type) => ATTACK_TYPES.includes(type);
export const canSupportMode = (type) => SUPPORT_TYPES.includes(type);
export const canAddDefense  = (type) => ADD_DEFENSE_TYPES.includes(type);
export const isBoosterType  = (type) => type === 'booster';

/** A program is a non-combatant (no NET Combat tab, never in initiative). */
export function isNonCombatant(doc) {
  if (getProgramType(doc) === 'quickhack') return true;
  return progAtk(doc) < 1 && progDef(doc) < 1;
}

/** True when a Program actor is in the ##ERROR## state (or REZ ≤ 0). */
export function programActorInError(programActor) {
  if (!programActor) return false;
  if (programActor.effects?.some((e) => e.getFlag?.('cyberpunk-blue', 'isErrorState'))) return true;
  return progRez(programActor) <= 0;
}

/**
 * Benefit guard: an Executable confers nothing unless it is running and not in
 * the ##ERROR## state. `programActor` (its live spawned actor, if any) is checked
 * for the error AE; the exe's own REZ is a fallback.
 */
export function isInert(exe, programActor = null) {
  if (!exe?.system?.running) return true;
  if (programActor && programActorInError(programActor)) return true;
  if (progRez(exe) <= 0) return true;
  return false;
}

// ── Sheet context ────────────────────────────────────────────────────────────

/**
 * Build the context the shared `net-combat-tab.hbs` partial needs. Accepts a
 * Program actor or an Executable item.
 */
export function buildNetCombatContext(doc) {
  const type = getProgramType(doc);
  const nc = getNetCombat(doc);

  const statOptions = Object.entries(CONFIG.CYBER_BLUE.stats ?? {})
    .filter(([key]) => key !== 'move')
    .map(([key, stat]) => ({ value: key, label: stat.shortLabel ?? key.toUpperCase() }));

  const skillOptions = Object.entries(CONFIG.CYBER_BLUE.skills ?? {})
    .map(([key, skill]) => ({ value: key, label: skill.label ?? key }))
    .sort((a, b) => a.label.localeCompare(b.label));

  // Components for the currently-selected affliction skill (if it has any).
  const selectedSkill = nc?.attack?.affliction?.skill ?? '';
  const componentOptions = componentsForSkill(selectedSkill);

  const disabledEffects = (doc.effects ?? [])
    .filter((e) => e.disabled && !e.getFlag?.('cyberpunk-blue', 'modId'))
    .map((e) => ({ id: e.id, name: e.name }));

  // Attack mode radio options, gated by capability.
  const attackModes = [{ value: 'none', label: game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.NoAttack') }];
  if (canAttackMode(type)) attackModes.push({ value: 'attack', label: game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.Attack') });
  if (canSupportMode(type)) attackModes.push({ value: 'support', label: game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.SupportAttack') });

  // Defense mode radio options. Standard + Defender always; the two "Adds"
  // options only for defender/booster types.
  const defenseModes = [
    { value: 'standard', label: game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.StandardDefense') },
    { value: 'defender', label: game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.Defender') },
  ];
  if (canAddDefense(type)) {
    defenseModes.push({ value: 'personnel', label: game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.AddsPersonnelDefense') });
    defenseModes.push({ value: 'program', label: game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.AddsProgramDefense') });
  }

  // Booster rows, each with its own use-option list derived from its component.
  const boosterComponents = BOOSTER_COMPONENT_ORDER.map((slug) => ({
    value: slug,
    label: CONFIG.CYBER_BLUE.components?.[slug]?.label ?? slug,
  }));
  const boosts = (nc?.booster?.boosts ?? []).map((b, index) => ({
    index,
    component: b.component ?? '',
    use: b.use ?? '',
    value: b.value ?? 0,
    useOptions: NET_COMPONENT_USES[b.component] ?? [],
  }));

  const attackHasEffects = Boolean(
    nc?.attack?.damage?.enabled || nc?.attack?.affliction?.enabled || nc?.attack?.effectText?.enabled,
  );

  return {
    netCombat: nc,
    programType: type,
    caps: {
      attack: canAttackMode(type),
      support: canSupportMode(type),
      addDefense: canAddDefense(type),
      booster: isBoosterType(type),
    },
    isNonCombatant: isNonCombatant(doc),
    attackModes,
    defenseModes,
    statOptions,
    skillOptions,
    componentOptions,
    hasComponentOptions: componentOptions.length > 0,
    disabledEffects,
    boosterComponents,
    boosts,
    attackHasEffects,
  };
}

/** Component options (sub-skills) for a given skill slug, or [] if none. */
export function componentsForSkill(skillSlug) {
  const comps = CONFIG.CYBER_BLUE.skills?.[skillSlug]?.components ?? [];
  return comps.map((slug) => ({
    value: slug,
    label: CONFIG.CYBER_BLUE.components?.[slug]?.label
      ?? CONFIG.CYBER_BLUE.skills?.[slug]?.label
      ?? slug,
  }));
}

// ── Attack effect resolution ─────────────────────────────────────────────────

/**
 * Roll the configured on-hit effects for a program attack into a `resolution`
 * object the defense pipeline can then modify. Does NOT apply anything yet.
 *
 * @param {Item|Actor} sourceDoc      - program actor (Attack) or exe (Support);
 *                                       owns the affliction template AE.
 * @param {object}     attack         - `system.netCombat.attack`
 * @returns {Promise<{damage:number, damageRoll:Roll|null,
 *   affliction:object|null, effectText:string}>}
 */
export async function buildAttackResolution(sourceDoc, attack) {
  const out = { damage: 0, damageRoll: null, affliction: null, effectText: '' };
  if (!attack) return out;

  if (attack.damage?.enabled && (attack.damage.formula ?? '').trim()) {
    out.damageRoll = await new Roll(attack.damage.formula.trim()).evaluate();
    out.damage = out.damageRoll.total;
  }

  if (attack.affliction?.enabled) {
    const a = attack.affliction;
    const tpl = a.effectId ? sourceDoc.effects?.get(a.effectId) : null;
    const isBurning = Boolean(
      tpl?.statuses?.has?.('burning') || /\bburn/i.test(tpl?.name ?? ''),
    );
    out.affliction = {
      sourceDoc,
      effectId: a.effectId ?? '',
      primary: a.primary || 'body',
      skill: a.skill || '',
      component: a.component || '',
      dv: Number(a.dv) || 13,
      isBurning,
    };
  }

  if (attack.effectText?.enabled && (attack.effectText.text ?? '').trim()) {
    out.effectText = attack.effectText.text.trim();
  }

  return out;
}

/**
 * Apply a pending affliction (after the defense pipeline may have adjusted its
 * DV or removed it). Rolls the target's Primary + Skill (+ Component) check and,
 * on failure, copies the template AE from the source document.
 */
export async function applyAfflictionFromConfig(affliction, targetActor) {
  if (!affliction || !targetActor) return;
  const weaponLike = {
    afflictionPrimary:   affliction.primary,
    afflictionSkill:     affliction.skill,
    afflictionComponent: affliction.component,
    afflictionDv:        affliction.dv,
    afflictionEffectId:  affliction.effectId,
  };
  const roll = await rollAfflictionDefense(targetActor, weaponLike, 0);
  if (roll.total >= affliction.dv) return; // resisted
  await applyAfflictionEffect(affliction.sourceDoc, weaponLike, targetActor);
}

// ── Defensive interjection ───────────────────────────────────────────────────

/**
 * Find every Executable eligible to defend against a NET attack on `targetActor`.
 * Returns descriptors `{ exe, programActor, config, label }`, already filtered to
 * running, non-inert programs.
 *
 * @param {Actor} targetActor
 * @returns {Promise<Array>}
 */
export async function gatherDefenders(targetActor) {
  if (!targetActor) return [];
  const { getLinkedExecutable, getNetConnection, getPrimaryCyberdeck, PROGRAM_ACTOR_FLAG } =
    await import('./netrunning.mjs');

  const defenders = [];
  const seen = new Set();

  const pushDefender = (exe, programActor) => {
    if (!exe || seen.has(exe.id)) return;
    if (isInert(exe, programActor)) return;
    seen.add(exe.id);
    defenders.push({ exe, programActor, config: getNetCombat(exe)?.defense ?? null, label: exe.name });
  };
  const liveActorFor = (exe) => {
    const id = exe.getFlag?.('cyberpunk-blue', PROGRAM_ACTOR_FLAG);
    return id ? game.actors.get(id) : null;
  };

  if (targetActor.type === 'program') {
    // The target program itself (if a Defender) + sibling programs on the same
    // cyberdeck with "Adds program defense".
    const targetExe = await getLinkedExecutable(targetActor);
    const netrunner = targetExe?.parent;
    const deckId = targetExe?.system?.installedOnId ?? null;

    if (getNetCombat(targetActor)?.defense?.mode === 'defender' && targetExe) {
      pushDefender(targetExe, targetActor);
    }
    if (netrunner && deckId) {
      for (const exe of netrunner.items) {
        if (exe.type !== 'programExecutable' || exe.id === targetExe?.id) continue;
        if (exe.system.installedOnId !== deckId) continue;
        if (getNetCombat(exe)?.defense?.mode !== 'program') continue;
        pushDefender(exe, liveActorFor(exe));
      }
    }
  } else {
    // Character / netrunner target: programs on THEIR cyberdeck with "Adds
    // personnel defense".
    const conn = getNetConnection(targetActor);
    const deckId = conn?.cyberdeckId || getPrimaryCyberdeck(targetActor)?.id || null;
    if (deckId) {
      for (const exe of targetActor.items) {
        if (exe.type !== 'programExecutable') continue;
        if (exe.system.installedOnId !== deckId) continue;
        if (getNetCombat(exe)?.defense?.mode !== 'personnel') continue;
        pushDefender(exe, liveActorFor(exe));
      }
    }
  }
  return defenders;
}

/**
 * Run the defenders (random order) against a mutable `resolution`
 * `{ damage:number, affliction:object|null }`. Returns chat notes plus a list of
 * post-resolution effects (MemHandler / JunkData) to run *after* damage applies.
 *
 * @param {object} resolution
 * @param {Array}  defenders
 * @returns {Promise<{ notes:string[], postEffects:Array }>}
 */
export async function applyDefensePipeline(resolution, defenders) {
  const notes = [];
  const postEffects = [];
  if (!defenders?.length) return { notes, postEffects };

  // Random order.
  const order = [...defenders].sort(() => Math.random() - 0.5);

  for (const def of order) {
    const c = def.config;
    if (!c) continue;
    const parts = [];

    if (c.ablate) {
      const rez = def.programActor ? progRez(def.programActor) : progRez(def.exe);
      const before = resolution.damage;
      resolution.damage = Math.max(resolution.damage - rez, 0);
      parts.push(game.i18n.format('CYBER_BLUE.Netrunning.NetCombat.DefAblate', { rez, blocked: before - resolution.damage }));
      // Spend 1 REZ off the defender.
      if (def.programActor) {
        await def.programActor.update({ 'system.resources.rez.value': Math.max(rez - 1, 0) });
      } else {
        await def.exe.update({ 'system.rez.value': Math.max(rez - 1, 0) });
      }
    }
    if (c.reduce?.enabled && (c.reduce.formula ?? '').trim()) {
      const r = await new Roll(c.reduce.formula.trim()).evaluate();
      const before = resolution.damage;
      resolution.damage = Math.max(resolution.damage - r.total, 0);
      parts.push(game.i18n.format('CYBER_BLUE.Netrunning.NetCombat.DefReduce', { amount: r.total, blocked: before - resolution.damage }));
    }
    if (c.block?.enabled && resolution.damage > 0 && resolution.damage <= (Number(c.block.amount) || 0)) {
      resolution.damage = 0;
      parts.push(game.i18n.format('CYBER_BLUE.Netrunning.NetCombat.DefBlock', { amount: c.block.amount }));
    }
    if (c.strengthen?.enabled && resolution.affliction) {
      resolution.affliction.dv = Math.max(resolution.affliction.dv - (Number(c.strengthen.amount) || 0), 0);
      parts.push(game.i18n.format('CYBER_BLUE.Netrunning.NetCombat.DefStrengthen', { amount: c.strengthen.amount, dv: resolution.affliction.dv }));
    }
    if (c.cool && resolution.affliction?.isBurning) {
      resolution.affliction = null;
      parts.push(game.i18n.localize('CYBER_BLUE.Netrunning.NetCombat.DefCool'));
    }
    if ((c.effectText ?? '').trim()) {
      parts.push(c.effectText.trim());
    }
    if (c.memHandler) postEffects.push({ kind: 'memHandler', def });
    if (c.junkData)   postEffects.push({ kind: 'junkData', def });

    if (parts.length) {
      notes.push(`<strong>${def.label}</strong>: ${parts.join('; ')}`);
    }
  }
  return { notes, postEffects };
}

/** Run MemHandler / JunkData post-effects after the attack has fully resolved. */
export async function runDefensePostEffects(postEffects) {
  if (!postEffects?.length) return;
  const { PROGRAM_ACTOR_FLAG } = await import('./netrunning.mjs');
  for (const pe of postEffects) {
    const { exe, programActor } = pe.def;
    if (pe.kind === 'memHandler') {
      // Flip not-running; the updateItem hook despawns the token.
      if (exe?.system?.running) await exe.update({ 'system.running': false });
    } else if (pe.kind === 'junkData') {
      // Permanent destruction: tokens + program actor + the executable itself.
      const actorId = programActor?.id ?? exe?.getFlag?.('cyberpunk-blue', PROGRAM_ACTOR_FLAG);
      if (actorId) {
        for (const scene of game.scenes) {
          const tIds = scene.tokens.filter((t) => t.actorId === actorId).map((t) => t.id);
          if (tIds.length) await scene.deleteEmbeddedDocuments('Token', tIds);
        }
        await game.actors.get(actorId)?.delete();
      }
      if (exe?.id && exe?.parent) await exe.delete();
    }
  }
}

// ── Booster boosts ───────────────────────────────────────────────────────────

/**
 * Sum the boost value contributed by running, non-inert Booster executables on
 * `deckId` for a given component/use. The caller maps Zap→(cracker,attack) and
 * the Cracker Defend button→(cracker,defend).
 *
 * @param {Actor}  netrunner
 * @param {string} deckId
 * @param {string} componentSlug
 * @param {string} useSlug
 * @returns {number}
 */
export function getBoost(netrunner, deckId, componentSlug, useSlug) {
  if (!netrunner || !deckId) return 0;
  let total = 0;
  for (const exe of netrunner.items) {
    if (exe.type !== 'programExecutable') continue;
    if (exe.system.installedOnId !== deckId) continue;
    if (!isBoosterType(getProgramType(exe))) continue;
    if (isInert(exe)) continue;
    for (const b of (getNetCombat(exe)?.booster?.boosts ?? [])) {
      if (b.component === componentSlug && b.use === useSlug) total += Number(b.value) || 0;
    }
  }
  return total;
}
