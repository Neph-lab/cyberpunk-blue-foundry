/**
 * Affliction attack resolution.
 *
 * Affliction weapons don't deal HP damage.  Instead, on a successful hit that
 * would have penetrated the target's SP (or bypasses it entirely when damage
 * is 0), the target makes a 1d10 + Primary + Skill check vs the weapon's
 * afflictionDv.  On failure the weapon's referenced disabled ActiveEffect is
 * copied to the target and enabled.  The GM may remove it from the Health
 * Effects panel when appropriate.
 *
 * Affliction Cone and Affliction Explosion share the same targeting geometry
 * as their damage-dealing counterparts — see cone-attack.mjs.
 */

import { buildWeaponUpdate, getWeaponTypeDefinition, COMBAT_CONFIG } from './combat.mjs';
import { getEffectiveItemWeapons } from './mods.mjs';
import { getActiveAEFlag } from './effects.mjs';

/** Flag key written onto every affliction AE applied to an actor. */
export const AFFLICTION_EFFECT_FLAG = 'isAffliction';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTarget() {
  const token = game.user.targets.first() ?? null;
  return { token, actor: token?.actor ?? null };
}

function getDistanceMeters(attacker, targetToken) {
  if (!canvas?.scene || !canvas?.grid || !targetToken) return null;
  const attackerToken = attacker.getActiveTokens()[0];
  if (!attackerToken) return null;
  const gridSize = canvas.grid.size;
  const ax = attackerToken.document.x + (attackerToken.document.width * gridSize) / 2;
  const ay = attackerToken.document.y + (attackerToken.document.height * gridSize) / 2;
  const tx = targetToken.document.x + (targetToken.document.width * gridSize) / 2;
  const ty = targetToken.document.y + (targetToken.document.height * gridSize) / 2;
  const pixelDist = Math.hypot(ax - tx, ay - ty);
  const gridUnitDist = pixelDist / gridSize;
  const gridDistance = canvas.scene.grid?.distance ?? 1;
  const gridUnits = (canvas.scene.grid?.units ?? '').toLowerCase().trim();
  const metersPerUnit = ['m', 'meter', 'meters'].includes(gridUnits) ? gridDistance : 2;
  return gridUnitDist * metersPerUnit;
}

function getDvForRange(definition, distanceMeters, rangeTableOverride = null) {
  if (!definition.usesRangeTable && !rangeTableOverride) return null;
  const breakpoints = COMBAT_CONFIG.rangeBreakpoints;
  const bandIndex = breakpoints.slice(1).findIndex((bp) => distanceMeters < bp);
  if (bandIndex === -1) return 0;
  const table = rangeTableOverride ?? definition.rangeTable;
  return table[bandIndex] ?? 0;
}

/**
 * Roll the target's affliction defense check.
 * @param {Actor}  targetActor
 * @param {object} weapon        — the weapon entry (effective weapon data)
 * @param {number} resistBonus   — +2 for outer-zone targets
 * @returns {Roll}
 */
export async function rollAfflictionDefense(targetActor, weapon, resistBonus = 0) {
  const statSlug = weapon.afflictionPrimary || 'body';
  const skillSlug = weapon.afflictionSkill || '';
  const statValue = targetActor.system?.stats?.[statSlug]?.value ?? 0;
  const statRollMod = targetActor.system?.stats?.[statSlug]?.rollMod ?? 0;
  const skillRank = skillSlug ? (targetActor.system?.skills?.[skillSlug]?.rank ?? 0) : 0;
  const skillBonus = skillSlug ? (targetActor.system?.skills?.[skillSlug]?.bonus ?? 0) : 0;

  const flatBonus = statValue + skillRank + (statRollMod ?? 0) + skillBonus + resistBonus;
  const formula = `1d10 + ${flatBonus}`;
  const roll = await new Roll(formula).evaluate();

  const statLabel = CONFIG.CYBER_BLUE.stats?.[statSlug]?.shortLabel ?? statSlug.toUpperCase();
  const skillLabel = skillSlug ? (CONFIG.CYBER_BLUE.skills?.[skillSlug]?.label ?? skillSlug) : null;
  const bonusParts = [
    `${statLabel} ${statValue}`,
    skillLabel ? `${skillLabel} ${skillRank}` : null,
    statRollMod ? `Mod ${statRollMod}` : null,
    skillBonus ? `Bonus ${skillBonus}` : null,
    resistBonus ? `+${resistBonus} (${game.i18n.localize('CYBER_BLUE.Combat.AfflictionOuterZone')})` : null,
  ].filter(Boolean).join(' + ');

  const dv = weapon.afflictionDv ?? 13;
  const resultKey = roll.total >= dv
    ? 'CYBER_BLUE.Combat.AfflictionResisted'
    : 'CYBER_BLUE.Combat.AfflictionFailed';

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: targetActor }),
    flavor: `
      <div class="cyberpunk-blue chat-card">
        <h3>${game.i18n.localize('CYBER_BLUE.Combat.AfflictionDefense')}: ${targetActor.name}</h3>
        <p>${bonusParts}</p>
        <p>DV <strong>${dv}</strong> — <strong>${game.i18n.localize(resultKey)}</strong></p>
      </div>`,
    rollMode: game.settings.get('core', 'rollMode'),
  });
  return roll;
}

/**
 * Determine whether the affliction would penetrate the target's SP.
 * Returns true when affliction may proceed; false when SP blocks it.
 *
 * @param {object} weapon       — effective weapon data
 * @param {Actor}  targetActor
 * @param {boolean} isHalfDamage — halve the damage roll before comparing to SP
 */
export async function checkAfflictionSP(weapon, targetActor, isHalfDamage = false) {
  const damageFormula = (weapon.damage ?? '').trim();
  // Damage 0 or empty → bypass SP entirely
  if (!damageFormula || damageFormula === '0') return true;

  const sp = targetActor.system?.resources?.armor?.value ?? 0;
  const dmgRoll = await new Roll(damageFormula).evaluate();
  let dmg = dmgRoll.total;
  if (isHalfDamage) dmg = Math.ceil(dmg / 2);
  return dmg > sp;
}

/**
 * Copy the weapon's affliction AE to the target actor and enable it.
 *
 * Resolution order:
 *  1. If `weapon.afflictionEffectId` is set, find the AE by that _id.
 *  2. Otherwise fall back to the first AE on the item that carries
 *     `flags.cyberpunk-blue.isAfflictionEffect = true`.
 */
export async function applyAfflictionEffect(item, weapon, targetActor) {
  let sourceEffect = null;

  if (weapon.afflictionEffectId) {
    sourceEffect = item.effects.get(weapon.afflictionEffectId);
    if (!sourceEffect) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.AfflictionEffectMissing'));
      return false;
    }
  } else {
    sourceEffect = item.effects.find(
      (e) => e.getFlag?.('cyberpunk-blue', 'isAfflictionEffect'),
    ) ?? null;
    if (!sourceEffect) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.AfflictionNoEffect'));
      return false;
    }
  }

  const aeData = sourceEffect.toObject();
  aeData.disabled = false;
  foundry.utils.setProperty(aeData, `flags.cyberpunk-blue.${AFFLICTION_EFFECT_FLAG}`, true);
  delete aeData._id;

  await targetActor.createEmbeddedDocuments('ActiveEffect', [aeData]);

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: targetActor }),
    content: `
      <div class="cyberpunk-blue chat-card">
        <p><i class="fas fa-biohazard"></i>
          <strong>${targetActor.name}</strong> ${game.i18n.format('CYBER_BLUE.Combat.AfflictionApplied', { effect: sourceEffect.name })}
        </p>
      </div>`,
  });
  return true;
}

// ─── Standard Affliction attack ─────────────────────────────────────────────

export async function resolveAfflictionAttack(attacker, item, weaponIndex) {
  const effectiveWeapons = item.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(item);
  const weapon = effectiveWeapons[weaponIndex];
  if (!weapon) return;

  const definition = getWeaponTypeDefinition(weapon.type);
  const skillSlug = CONFIG.CYBER_BLUE.skills[weapon.skill] ? weapon.skill
    : (item.system.weapons?.[weaponIndex]?.skill ?? weapon.skill);

  const { token: targetToken, actor: targetActor } = getTarget();
  const targetSP = targetActor ? (targetActor.system?.resources?.armor?.value ?? 0) : null;
  const targetRflx = targetActor?.system?.stats?.rflx?.value ?? 0;

  const distanceMeters = getDistanceMeters(attacker, targetToken);
  const rangeDV = distanceMeters !== null ? getDvForRange(definition, distanceMeters) : null;

  if (rangeDV === 0) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.OutOfRange'));
    return;
  }

  const isMelee = definition.category === 'melee';
  const isRanged = definition.category === 'ranged';
  const evasionEligible = targetActor && (
    (isMelee && distanceMeters !== null && distanceMeters <= 2)
    || (isRanged && targetRflx >= 8)
  );
  const needsManualDV = rangeDV === null;

  const statSlug = weapon.afflictionPrimary || 'body';
  const skillLabel = weapon.afflictionSkill
    ? (CONFIG.CYBER_BLUE.skills?.[weapon.afflictionSkill]?.label ?? weapon.afflictionSkill)
    : '—';
  const statLabel = CONFIG.CYBER_BLUE.stats?.[statSlug]?.shortLabel ?? statSlug.toUpperCase();

  const targetLine = targetActor
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.Target')}: <strong>${targetActor.name}</strong>${targetSP !== null ? ` (SP ${targetSP})` : ''}</p>`
    : '';
  const distanceLine = distanceMeters !== null
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.Distance')}: <strong>${distanceMeters.toFixed(1)} m</strong>${rangeDV !== null ? ` — DV <strong>${rangeDV}</strong>` : ''}</p>`
    : '';
  const afflictionLine = `<p><i class="fas fa-biohazard"></i> ${statLabel} + ${skillLabel} vs DV <strong>${weapon.afflictionDv ?? 13}</strong></p>`;
  const dvInputLine = needsManualDV ? `
    <label style="display:flex;align-items:center;gap:0.5rem;">
      <span>${game.i18n.localize('CYBER_BLUE.Combat.DV')}:</span>
      <input type="number" id="attack-dv" value="" min="0" style="width:5rem;" placeholder="—" />
    </label>` : '';
  const evasionLine = evasionEligible ? `
    <label style="display:flex;align-items:center;gap:0.5rem;">
      <input type="checkbox" id="roll-evasion" checked />
      <span>${game.i18n.localize('CYBER_BLUE.Combat.RollTargetEvasion')}</span>
    </label>` : '';

  const dialogContent = `
    <div class="cyberpunk-blue" style="padding:0.5rem;">
      ${targetLine}${distanceLine}${afflictionLine}
      <div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem;">
        ${dvInputLine}${evasionLine}
      </div>
    </div>`;

  let dvResult;
  try {
    dvResult = await new Promise((resolve) => {
      const dialog = new foundry.applications.api.DialogV2({
        window: { title: `${game.i18n.localize('CYBER_BLUE.Combat.AfflictionAttack')}: ${item.name}` },
        content: dialogContent,
        buttons: [
          {
            action: 'roll',
            icon: 'fa-solid fa-dice-d10',
            label: game.i18n.localize('CYBER_BLUE.Combat.RollAttack'),
            default: true,
            callback: (_event, button) => {
              const manualDvRaw = button.form?.elements['attack-dv']?.value?.trim();
              const rollEvasion = button.form?.elements['roll-evasion']?.checked ?? false;
              const dv = manualDvRaw ? Number(manualDvRaw) : rangeDV;
              return { dv, rollEvasion };
            },
          },
          {
            action: 'cancel',
            icon: 'fa-solid fa-xmark',
            label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'),
            callback: () => null,
          },
        ],
        submit: resolve,
      });
      dialog.addEventListener('close', () => resolve(null), { once: true });
      dialog.render(true);
    });
  } catch {
    return;
  }
  if (!dvResult) return;

  const { dv: rawDV, rollEvasion } = dvResult;

  let resolvedDV = null;
  if (rollEvasion && targetActor) {
    const rflx = targetActor.system?.stats?.rflx?.value ?? 0;
    const rflxMod = targetActor.system?.stats?.rflx?.rollMod ?? 0;
    const evasionRank = targetActor.system?.skills?.evasion?.rank
      ?? targetActor.system?.skills?.athletics?.rank ?? 0;
    const evasionBonus = targetActor.system?.skills?.evasion?.bonus
      ?? targetActor.system?.skills?.athletics?.bonus ?? 0;
    const formulaParts = [`1d10 + ${rflx} + ${evasionRank}`];
    if (rflxMod) formulaParts.push(`${rflxMod}`);
    if (evasionBonus) formulaParts.push(`${evasionBonus}`);
    const formula = formulaParts.join(' + ');
    const evasionRoll = await new Roll(formula).evaluate();
    await evasionRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: targetActor }),
      flavor: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Combat.EvasionRoll')}: ${targetActor.name}</h3><p>RFLX ${rflx} + ${game.i18n.localize('CYBER_BLUE.Combat.EvasionSkill')} ${evasionRank}</p></div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });
    resolvedDV = (rawDV !== null && Number.isFinite(rawDV))
      ? Math.max(evasionRoll.total, rawDV)
      : evasionRoll.total;
  } else if (rawDV !== null && Number.isFinite(rawDV)) {
    resolvedDV = rawDV;
  }

  // Attack roll
  const precisionBonus = getActiveAEFlag(attacker, 'soloPrecisionAttack') ?? 0;
  const attackRoll = await attacker.rollSkill({ skillSlug, modifier: precisionBonus, dv: resolvedDV });

  // Consume ammo
  const shots = item.system.weapons?.[weaponIndex]?.shots ?? weapon.shots ?? 0;
  if (shots > 0) {
    const currentAmmo = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
    await item.update(buildWeaponUpdate(item, weaponIndex, { ammoCurrent: Math.max(currentAmmo - shots, 0) }));
  }

  const hit = resolvedDV === null || attackRoll.total >= resolvedDV;
  if (!hit) return;

  // ── Shockwave (Kang Tao Mámù): BODY < 8 target pushed 2m ────────────────
  if ((weapon.shockwave ?? false) && targetActor) {
    const targetBody = targetActor.system?.stats?.body?.value ?? 0;
    if (targetBody < 8) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-wind"></i> <strong>${game.i18n.localize('CYBER_BLUE.Combat.Shockwave')}</strong> — ${game.i18n.format('CYBER_BLUE.Combat.ShockwavePush', { target: targetActor.name, dist: 2 })}</p></div>`,
      });
    }
  }

  if (!targetActor) {
    ui.notifications.info(game.i18n.localize('CYBER_BLUE.Combat.AfflictionHitNoTarget'));
    return;
  }

  // SP check
  const penetrates = await checkAfflictionSP(weapon, targetActor, false);
  if (!penetrates) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="cyberpunk-blue chat-card"><p>${game.i18n.format('CYBER_BLUE.Combat.AfflictionBlockedBySP', { target: targetActor.name })}</p></div>`,
    });
    return;
  }

  // Defense roll
  const defenseRoll = await rollAfflictionDefense(targetActor, weapon, 0);
  const dv = weapon.afflictionDv ?? 13;
  if (defenseRoll.total >= dv) return; // resisted

  // Apply AE
  await applyAfflictionEffect(item, weapon, targetActor);
}
