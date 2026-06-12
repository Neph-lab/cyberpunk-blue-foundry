/**
 * Roll-modifier previews for the unified "roll" buttons.
 *
 * Every check button (skill, component, weapon attack, martial arts, program
 * ATK/PER) shows the deterministic modifier that will be added to the 1d10 —
 * the part that is known up-front, including Active Effects (e.g. Seriously
 * Wounded) — but NOT situational additions that depend on outside information
 * (range, visibility, target vitals, …). The tooltip lists each contributor.
 */
import { getInstalledWeaponMods } from './mods.mjs';
import { getActiveAEFlag } from './effects.mjs';

/** Format a number as a signed string, e.g. 5 → "+5", -2 → "-2", 0 → "+0". */
export function signedModifier(value) {
  const n = Number(value) || 0;
  return n >= 0 ? `+${n}` : `${n}`;
}

/**
 * Attribute the actor's roll-channel Active Effects (stat rollMod / skill+
 * component bonus) to their source effect names, so the tooltip can show e.g.
 * "Seriously Wounded -2". Value-targeting AEs (permanent stat/rank boosts) are
 * excluded — they're already folded into the base stat/rank shown separately.
 */
function activeEffectContributions(actor, { statSlug, skillSlug, componentSlug } = {}) {
  const keys = new Set();
  if (statSlug) keys.add(`system.stats.${statSlug}.rollMod`);
  if (skillSlug) keys.add(`system.skills.${skillSlug}.bonus`);
  if (componentSlug) keys.add(`system.components.${componentSlug}.bonus`);
  if (!keys.size) return [];

  const parts = [];
  for (const effect of actor.appliedEffects ?? []) {
    for (const change of effect.changes ?? []) {
      if (!keys.has(change.key)) continue;
      const value = Number(change.value) || 0;
      if (!value) continue;
      parts.push({ label: effect.name, value });
    }
  }
  return parts;
}

/** Sum the part values into a signed total + an HTML tooltip breakdown. */
function finalisePreview(parts) {
  const total = parts.reduce((sum, part) => sum + (Number(part.value) || 0), 0);
  const tooltip = parts
    .map((part) => `${part.label} ${signedModifier(part.value)}`)
    .join('<br>');
  return { total, mod: signedModifier(total), tooltip, parts };
}

/**
 * Preview for a skill (optionally + component) check: stat + rank + AE channels.
 * Mirrors the terms that CyberBlueActor#rollSkill adds before the user modifier.
 */
export function getSkillCheckPreview(actor, skillSlug, componentSlug = null, { rankCap = null } = {}) {
  const ctx = actor.getSkillRollContext(skillSlug, componentSlug);
  const usedRank = rankCap != null ? Math.min(ctx.usedRank, rankCap) : ctx.usedRank;
  const parts = [{ label: ctx.statShortLabel, value: ctx.statValue }];
  if (usedRank) {
    const rankLabel = componentSlug
      ? `${ctx.skillLabel}/${ctx.componentLabel}`
      : ctx.skillLabel;
    parts.push({ label: rankLabel, value: usedRank });
  }
  const statSlug = actor.getSkillDefinition?.(skillSlug)?.stat ?? null;
  parts.push(...activeEffectContributions(actor, { statSlug, skillSlug, componentSlug }));
  return finalisePreview(parts);
}

/**
 * Preview for a weapon attack: the weapon-skill check plus the always-on weapon
 * bonuses (those applied regardless of target/range). Excludes situational
 * modifiers (range, close-range, visibility, target vitals, autofire recoil,
 * aiming/stance toggles) that can't be known before the shot is declared.
 */
export function getWeaponAttackPreview(actor, item, weapon, weaponIndex, { rankCap = null } = {}) {
  const skillSlug = CONFIG.CYBER_BLUE.skills[weapon.skill]
    ? weapon.skill
    : (item.system?.weapons?.[weaponIndex]?.skill ?? weapon.skill);

  const base = getSkillCheckPreview(actor, skillSlug, null, { rankCap });
  const parts = [...base.parts];

  if (weapon.isExcellentQuality) parts.push({ label: game.i18n.localize('CYBER_BLUE.Combat.ExcellentQuality'), value: 1 });
  if (weapon.isSmartWeapon) parts.push({ label: game.i18n.localize('CYBER_BLUE.Combat.SmartWeapon'), value: 1 });

  const mods = getInstalledWeaponMods(item, weaponIndex, actor) ?? [];
  const recoil = mods.reduce((sum, m) => sum + (!m.recoilAFOnly ? (m.recoilBonus ?? 0) : 0), 0);
  if (recoil) parts.push({ label: game.i18n.localize('CYBER_BLUE.Combat.RecoilMod'), value: recoil });
  if (mods.some((m) => m.beginnerFriendly) && (actor.system?.skills?.handgun?.rank ?? 0) === 0) {
    parts.push({ label: game.i18n.localize('CYBER_BLUE.Combat.BeginnerFriendly'), value: 1 });
  }

  const calibration = Number(item.getFlag?.('cyberpunk-blue', `calibration-${weaponIndex}`)) || 0;
  if (calibration) parts.push({ label: game.i18n.localize('CYBER_BLUE.Combat.Calibrated'), value: calibration });

  const isCharged = !!item.getFlag?.('cyberpunk-blue', `charged-${weaponIndex}`);
  if (isCharged && (weapon.chargedAttackBonus ?? 0)) {
    parts.push({ label: game.i18n.localize('CYBER_BLUE.Combat.Charged'), value: weapon.chargedAttackBonus });
  }

  const precision = getActiveAEFlag(actor, 'soloPrecisionAttack') ?? 0;
  if (precision) parts.push({ label: game.i18n.localize('CYBER_BLUE.Combat.PrecisionAttack'), value: precision });

  return finalisePreview(parts);
}

/**
 * Preview for a simple stat check (Program ATK/PER). These actors roll
 * `1d10 + stat.value`; any stat-altering AEs are already folded into the value.
 */
export function getStatCheckPreview(actor, statKey, label) {
  const value = actor.system?.stats?.[statKey]?.value ?? 0;
  return finalisePreview([{ label: label ?? statKey.toUpperCase(), value }]);
}

/**
 * Preview from a precomputed modifier (e.g. Netrunner component rolls, whose
 * modifier is already derived as INT + Netrunner rank + min(skill, component)).
 */
export function getFlatPreview(total, parts = null) {
  if (parts) return finalisePreview(parts);
  return { total, mod: signedModifier(total), tooltip: signedModifier(total), parts: [] };
}
