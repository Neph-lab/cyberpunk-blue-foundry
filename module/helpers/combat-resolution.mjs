import { buildWeaponUpdate, getWeaponTypeDefinition, COMBAT_CONFIG } from './combat.mjs';
import { getEffectiveItemWeapons, getInstalledWeaponMods } from './mods.mjs';
import { resolveConeAttack, resolveExplosionAttack, resolveAfflictionConeAttack, resolveAfflictionExplosionAttack, resolveScatterEffect } from './cone-attack.mjs';
import { recordCombatAttack } from './combat-tracker.mjs';
import { detectCriticalDice, confirmDamageDialog, rollCriticalInjury } from './critical-injury.mjs';
import { resolveAfflictionAttack } from './affliction-attack.mjs';
import { applyDamageWithPermission, rollCriticalInjuryWithPermission, deleteActorItemWithPermission, ablateArmorExtraWithPermission, applyForcedCriticalInjuryWithPermission } from './socket.mjs';

/** Count the number of d6s in a damage roll (using their face count, not total). */
function countDamageDice(roll) {
  let count = 0;
  for (const term of roll.terms) {
    if (term instanceof foundry.dice.terms.Die && term.faces === 6) {
      count += term.number;
    }
  }
  return count;
}

/** Resolve the name of the ammo loaded into a weapon slot, or '' if unknown. */
async function getLoadedAmmoName(item, weaponIndex) {
  const uuid = item.system.weapons?.[weaponIndex]?.ammoTypeUuid ?? '';
  if (!uuid) return '';
  try {
    const ammoDoc = await fromUuid(uuid);
    return ammoDoc?.name ?? '';
  } catch {
    return '';
  }
}

function getTarget() {
  const token = game.user.targets.first() ?? null;
  return { token, actor: token?.actor ?? null };
}

/** Returns distance in meters between the attacker's first active token and the given target token. */
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

/** Returns the DV from a weapon's range table for a given distance, or null if no range table. */
function getDvForRange(definition, distanceMeters, rangeTableOverride = null) {
  if (!definition.usesRangeTable && !rangeTableOverride) return null;

  const breakpoints = COMBAT_CONFIG.rangeBreakpoints; // [0, 6, 12, 25, 50, 100, 200, 400, 800]
  const bandIndex = breakpoints.slice(1).findIndex((bp) => distanceMeters < bp);
  if (bandIndex === -1) return 0; // beyond maximum range

  const table = rangeTableOverride ?? definition.rangeTable;
  return table[bandIndex] ?? 0;
}

async function rollTargetEvasion(targetActor) {
  const rflx = targetActor.system?.stats?.rflx?.value ?? 0;
  const rflxMod = targetActor.system?.stats?.rflx?.rollMod ?? 0;
  const evasionRank = targetActor.system?.skills?.evasion?.rank
    ?? targetActor.system?.skills?.athletics?.rank
    ?? 0;
  const formula = `1d10 + ${rflx} + ${evasionRank}${rflxMod ? ` + ${rflxMod}` : ''}`;
  const roll = await new Roll(formula).evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: targetActor }),
    flavor: `
      <div class="cyberpunk-blue chat-card">
        <h3>${game.i18n.localize('CYBER_BLUE.Combat.EvasionRoll')}: ${targetActor.name}</h3>
        <p>RFLX ${rflx} + ${game.i18n.localize('CYBER_BLUE.Combat.EvasionSkill')} ${evasionRank}</p>
      </div>
    `,
    rollMode: game.settings.get('core', 'rollMode'),
  });
  return roll;
}

async function consumeAmmo(item, weaponIndex, shots) {
  if (shots <= 0) return;
  const currentAmmo = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
  await item.update(buildWeaponUpdate(item, weaponIndex, { ammoCurrent: Math.max(currentAmmo - shots, 0) }));
}

export async function resolveWeaponAttack(attacker, item, weaponIndex) {
  const effectiveWeapons = item.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(item);
  const weapon = effectiveWeapons[weaponIndex];
  if (!weapon) return;

  // Route special attack types to their own resolvers
  const damageType = weapon.damageType ?? '';
  if (damageType === 'cone') return resolveConeAttack(attacker, item, weaponIndex);
  if (damageType === 'explosion') return resolveExplosionAttack(attacker, item, weaponIndex);
  if (damageType === 'affliction') return resolveAfflictionAttack(attacker, item, weaponIndex);
  if (damageType === 'affliction-cone') return resolveAfflictionConeAttack(attacker, item, weaponIndex);
  if (damageType === 'affliction-explosion') return resolveAfflictionExplosionAttack(attacker, item, weaponIndex);

  const definition = getWeaponTypeDefinition(weapon.type);
  const skillSlug = CONFIG.CYBER_BLUE.skills[weapon.skill] ? weapon.skill
    : (item.system.weapons?.[weaponIndex]?.skill ?? weapon.skill);

  // Block attack if the magazine is empty
  if (definition.usesMagazine) {
    const ammoCurrent = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
    if (ammoCurrent <= 0) {
      ui.notifications.warn(game.i18n.format('CYBER_BLUE.Combat.NoAmmo', { weapon: item.name }));
      return;
    }
  }

  const { token: targetToken, actor: targetActor } = getTarget();
  const targetSP = targetActor ? (targetActor.system?.resources?.armor?.value ?? 0) : null;
  const targetRflx = targetActor?.system?.stats?.rflx?.value ?? 0;

  // Distance measurement
  const distanceMeters = getDistanceMeters(attacker, targetToken);

  // ── Installed mods (needed for range improvement and dialog bonuses) ───────
  const installedMods = getInstalledWeaponMods(item, weaponIndex, attacker);

  // ── Range DV with scope range improvement ─────────────────────────────────
  // For each mod with rangeImprovementMeters: compute DV for adjusted distances
  // and use the most favourable (lowest non-zero) DV.
  let rangeDV = distanceMeters !== null ? getDvForRange(definition, distanceMeters) : null;
  if (distanceMeters !== null && rangeDV !== null) {
    for (const mod of installedMods) {
      const N = mod.rangeImprovementMeters ?? 0;
      if (N <= 0) continue;
      const dvCloser = getDvForRange(definition, Math.max(0, distanceMeters - N));
      if (dvCloser !== null && dvCloser > 0 && (rangeDV === 0 || dvCloser < rangeDV)) rangeDV = dvCloser;
      if (mod.rangeImprovementBidirectional) {
        const dvFarther = getDvForRange(definition, distanceMeters + N);
        if (dvFarther !== null && dvFarther > 0 && (rangeDV === 0 || dvFarther < rangeDV)) rangeDV = dvFarther;
      }
    }
  }

  // Abort if out of range
  if (rangeDV === 0) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.OutOfRange'));
    return;
  }

  // ── Distance-conditional attack bonuses ────────────────────────────────────
  const trajectoryBonus = (installedMods.some((m) => m.trajectoryCalculations) && distanceMeters !== null && distanceMeters > 40) ? 1 : 0;
  const closeRangeBonusVal = (installedMods.some((m) => m.closeRangeBonus) && distanceMeters !== null && distanceMeters <= 20) ? 1 : 0;

  // ── Movement-conditional bonus availability ────────────────────────────────
  const hasDigitalLink = installedMods.some((m) => m.digitalLink);
  const hasSteady = installedMods.some((m) => m.steady);
  const hasHandlingComputer = installedMods.some((m) => m.handlingComputer);

  // ── Calibration bonus (set by Calibrate action on sheet) ─────────────────
  const hasCalibratable = installedMods.some((m) => m.calibration);
  const calibrationBonus = hasCalibratable ? (item.getFlag('cyberpunk-blue', `calibration-${weaponIndex}`) ?? 0) : 0;

  const isMelee = definition.category === 'melee';
  const isRanged = definition.category === 'ranged';

  // Evasion eligibility: melee within 2 m OR ranged vs RFLX ≥ 8
  const evasionEligible = targetActor && (
    (isMelee && distanceMeters !== null && distanceMeters <= 2)
    || (isRanged && targetRflx >= 8)
  );

  // Show manual DV input when no range table result is available
  const needsManualDV = rangeDV === null;

  const targetLine = targetActor
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.Target')}: <strong>${targetActor.name}</strong>${targetSP !== null ? ` (SP ${targetSP})` : ''}</p>`
    : '';

  const distanceLine = distanceMeters !== null
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.Distance')}: <strong>${distanceMeters.toFixed(1)} m</strong>${rangeDV !== null ? ` — DV <strong>${rangeDV}</strong>` : ''}</p>`
    : '';

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

  const digitalLinkLine = hasDigitalLink ? `
    <label style="display:flex;align-items:center;gap:0.5rem;">
      <input type="checkbox" id="digital-link-active" />
      <span>${game.i18n.localize('CYBER_BLUE.Combat.DigitalLinkBonus')}</span>
    </label>` : '';

  const steadyLine = hasSteady ? `
    <label style="display:flex;align-items:center;gap:0.5rem;">
      <input type="checkbox" id="steady-active" />
      <span>${game.i18n.localize('CYBER_BLUE.Combat.SteadyBonus')}</span>
    </label>` : '';

  const handlingComputerLine = hasHandlingComputer ? `
    <label style="display:flex;align-items:center;gap:0.5rem;">
      <input type="checkbox" id="handling-computer-active" />
      <span>${game.i18n.localize('CYBER_BLUE.Combat.HandlingComputerBonus')}</span>
    </label>` : '';

  const distanceBonusLines = [
    trajectoryBonus ? `<p style="color:var(--cpb-accent);margin:0;"><i class="fas fa-ruler-combined"></i> ${game.i18n.localize('CYBER_BLUE.Combat.TrajectoryCalculations')}</p>` : '',
    closeRangeBonusVal ? `<p style="color:var(--cpb-accent);margin:0;"><i class="fas fa-crosshairs"></i> ${game.i18n.localize('CYBER_BLUE.Combat.CloseRangeBonus')}</p>` : '',
    calibrationBonus > 0 ? `<p style="color:var(--cpb-accent);margin:0;"><i class="fas fa-bullseye"></i> ${game.i18n.format('CYBER_BLUE.Combat.CalibrationActive', { n: calibrationBonus })}</p>` : '',
  ].filter(Boolean).join('');

  const dialogContent = `
    <div class="cyberpunk-blue" style="padding:0.5rem;">
      ${targetLine}
      ${distanceLine}
      ${distanceBonusLines}
      <div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem;">
        ${dvInputLine}
        ${evasionLine}
        ${digitalLinkLine}
        ${steadyLine}
        ${handlingComputerLine}
      </div>
    </div>`;

  let dvResult;
  try {
    dvResult = await new Promise((resolve) => {
      const dialog = new foundry.applications.api.DialogV2({
        window: { title: `${game.i18n.localize('CYBER_BLUE.Combat.Attack')}: ${item.name}` },
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
              const digitalLinkActive = button.form?.elements['digital-link-active']?.checked ?? false;
              const steadyActive = button.form?.elements['steady-active']?.checked ?? false;
              const handlingComputerActive = button.form?.elements['handling-computer-active']?.checked ?? false;
              const dv = manualDvRaw ? Number(manualDvRaw) : rangeDV;
              return { dv, rollEvasion, digitalLinkActive, steadyActive, handlingComputerActive };
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

  const { dv: rawDV, rollEvasion, digitalLinkActive, steadyActive, handlingComputerActive } = dvResult;

  // Resolve final DV: evasion result vs range DV (take the higher)
  let resolvedDV = null;
  if (rollEvasion && targetActor) {
    const evasionRoll = await rollTargetEvasion(targetActor);
    resolvedDV = (rawDV !== null && Number.isFinite(rawDV))
      ? Math.max(evasionRoll.total, rawDV)
      : evasionRoll.total;
  } else if (rawDV !== null && Number.isFinite(rawDV)) {
    resolvedDV = rawDV;
  }

  // ── Jam check ─────────────────────────────────────────────────────────────
  if (item.getFlag('cyberpunk-blue', `jammed-${weaponIndex}`)) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.WeaponJammed'));
    return;
  }

  // ── BODY requirement check ────────────────────────────────────────────────
  const attackerBody = Number(attacker.system?.stats?.body?.value) || 0;
  const minBodyReq = Number(item.system?.minBodyReq) || 0;
  const critOnBodyReq = Number(weapon.critOnBodyReq) || 0;
  // Soft requirement (Carnage): attack allowed but Torn Muscle applied afterwards.
  // Hard requirement (Hurricane, Helix, MA70, Defender): UI disables button; show warning.
  if (minBodyReq > 0 && attackerBody < minBodyReq && critOnBodyReq === 0) {
    ui.notifications.warn(game.i18n.format('CYBER_BLUE.Combat.MinBodyReqWarning', { weapon: item.name, body: attackerBody, required: minBodyReq }));
    return;
  }

  // ── Aggregate mod bonuses ─────────────────────────────────────────────────
  const modRecoilBonus = installedMods.reduce(
    (sum, m) => sum + (!m.recoilAFOnly ? (m.recoilBonus ?? 0) : 0),
    0,
  );
  const modVitalsPenaltyReduction = installedMods.reduce(
    (sum, m) => sum + (m.targetVitalsPenaltyReduction ?? 0),
    0,
  );
  const hasBeginnerFriendly = installedMods.some((m) => m.beginnerFriendly);
  const handgunRank = attacker.system?.skills?.handgun?.rank ?? 0;
  const beginnerBonus = (hasBeginnerFriendly && handgunRank === 0) ? 1 : 0;

  // ── Clear calibration flag — it's consumed by attacking ──────────────────
  if (calibrationBonus > 0) {
    await item.unsetFlag('cyberpunk-blue', `calibration-${weaponIndex}`);
  }

  // ── Ricochet point check ──────────────────────────────────────────────────
  // Power Weapons can use a pre-set ricochet point (actor flag) to bounce
  // shots around cover. Attack check takes -4 (-3 with Directed Recoil mod).
  const ricochetPoint = (weapon.isPowerWeapon ?? false)
    ? (attacker.getFlag?.('cyberpunk-blue', 'ricochetPoint') ?? null)
    : null;
  const isRicochet = !!ricochetPoint;

  // ── Weapon attack-roll modifier ────────────────────────────────────────────
  const targetVitals = item.getFlag('cyberpunk-blue', `targetVitals-${weaponIndex}`) ?? false;
  const rawVitalsPenalty = weapon.targetVitalsPenalty ?? 8;
  const targetVitalsPenalty = -(rawVitalsPenalty - modVitalsPenaltyReduction);

  let attackModifier = 0;
  if (targetVitals) attackModifier += targetVitalsPenalty;
  if (weapon.isSmartWeapon) attackModifier += 1;
  if (weapon.isExcellentQuality) attackModifier += 1;
  attackModifier += modRecoilBonus;
  attackModifier += beginnerBonus;
  attackModifier += trajectoryBonus;
  attackModifier += closeRangeBonusVal;
  attackModifier += digitalLinkActive ? 1 : 0;
  attackModifier += steadyActive ? 1 : 0;
  attackModifier += handlingComputerActive ? 1 : 0;
  attackModifier += calibrationBonus;
  // Ricochet penalty: -4 normally, -3 with Directed Recoil mod
  if (isRicochet) {
    const hasDirectedRecoil = installedMods.some((m) => m.directedRecoil);
    attackModifier += hasDirectedRecoil ? -3 : -4;
  }

  const attackRoll = await attacker.rollSkill({ skillSlug, dv: resolvedDV, modifier: attackModifier });

  // ── Jam-on-1 detection (Cheap = JAM, Poor Quality = POQ) ──────────────────
  // jamOnRoll is a threshold; jamFiresFirst differentiates POQ (shot lands)
  // from JAM (shot is lost).
  const d10Term = attackRoll.terms?.find((t) => t instanceof foundry.dice.terms.Die && t.faces === 10);
  const d10Result = d10Term?.results?.[0]?.result ?? null;
  const jammed = (weapon.jamOnRoll ?? 0) > 0 && d10Result !== null && d10Result <= weapon.jamOnRoll;
  if (jammed) {
    await item.setFlag('cyberpunk-blue', `jammed-${weaponIndex}`, true);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-exclamation-triangle"></i> <strong>${item.name}</strong> ${game.i18n.localize(weapon.jamFiresFirst ? 'CYBER_BLUE.Combat.WeaponJammedAfterShot' : 'CYBER_BLUE.Combat.WeaponJammedNoShot')}</p></div>`,
    });
    if (!weapon.jamFiresFirst) {
      // JAM: shot is lost — no ammo consumed, no damage
      return;
    }
    // POQ: fall through, the shot still lands
  }

  // Record this attack for RoF tracking
  const attackerToken = attacker.getActiveTokens()[0];
  if (attackerToken && game.combat?.started) {
    recordCombatAttack(attackerToken.document.id, item.id, weaponIndex);
  }

  // ── Short-ammo fallback (Brunswick 4d6/5rnd, Osprey burst 6d6/3rnd) ──────
  // When fewer rounds remain than the weapon needs but more than zero:
  // fire all remaining using the fallback formula.
  const shotsRequired = item.system.weapons?.[weaponIndex]?.shots ?? weapon.shots ?? 0;
  const ammoCurrent = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
  let actualShots = shotsRequired;
  let useFallbackDamage = false;
  if (
    shotsRequired > 1 &&
    ammoCurrent > 0 &&
    ammoCurrent < shotsRequired &&
    weapon.shortAmmoFallbackDamage
  ) {
    actualShots = ammoCurrent; // consume all remaining
    useFallbackDamage = true;
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-triangle-exclamation"></i> ${game.i18n.format('CYBER_BLUE.Combat.ShortAmmoFallback', { weapon: item.name, formula: weapon.shortAmmoFallbackDamage })}</p></div>`,
    });
  }

  // Consume ammo on attack (regardless of hit/miss)
  await consumeAmmo(item, weaponIndex, actualShots);

  // ── Silence system ────────────────────────────────────────────────────────
  // Post a public chat message with the DV to hear the silenced shot.
  // Handle silencer destruction by Tech Weapon discharge or RoF2+ firing.
  const silencedMods = installedMods.filter((m) => (m.silenceDV ?? 0) > 0);
  if (silencedMods.length > 0) {
    const silenceDV = Math.max(...silencedMods.map((m) => m.silenceDV));
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-volume-xmark"></i> ${game.i18n.format('CYBER_BLUE.Combat.SilencedShot', { dv: silenceDV })}</p></div>`,
    });
  }
  // destroyedByTech: silencer destroyed when weapon is a Tech Weapon
  const isTechWeapon = !!weapon.isTechWeapon;
  // destroyedByRof2: silencer destroyed when weapon fires 2+ shots per trigger pull
  const shotsPerAttack = actualShots;
  for (const mod of installedMods) {
    if (!mod._docId) continue;
    const shouldDestroy = (mod.destroyedByTech && isTechWeapon) || (mod.destroyedByRof2 && shotsPerAttack >= 2);
    if (shouldDestroy) {
      await deleteActorItemWithPermission(attacker, mod._docId);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-triangle-exclamation"></i> ${game.i18n.format('CYBER_BLUE.Combat.SilencerDestroyed', { weapon: item.name })}</p></div>`,
      });
    }
  }

  const hit = resolvedDV === null || attackRoll.total >= resolvedDV;

  // ── Shattered Projectiles (Techtronika Metel) — trigger on MISS ──────────
  // Roll damage; if total > 15, post a 2d6 splash message for GM resolution.
  if (!hit && (weapon.shatteredProjectiles ?? false)) {
    const shatterRoll = await new Roll(weapon.damage ?? definition.damage ?? '1d6').evaluate();
    if (shatterRoll.total > 15) {
      const splashRoll = await new Roll('2d6').evaluate();
      await shatterRoll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        flavor: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-burst"></i> ${game.i18n.localize('CYBER_BLUE.Combat.ShatteredProjectilesTrigger')}</p></div>`,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      await splashRoll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        flavor: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-burst"></i> ${game.i18n.localize('CYBER_BLUE.Combat.ShatteredProjectilesSplash')}</p></div>`,
        rollMode: game.settings.get('core', 'rollMode'),
      });
    }
    return;
  }

  if (!hit) return;

  const baseDamageFormula = useFallbackDamage
    ? (weapon.shortAmmoFallbackDamage ?? weapon.damage ?? definition.damage ?? '1d6')
    : (weapon.damage ?? definition.damage ?? '1d6');
  const damageRoll = await new Roll(baseDamageFormula).evaluate();

  const sp = targetSP !== null ? targetSP : null;
  const damageDiceCount = countDamageDice(damageRoll);

  // ── Ammo-based bonuses ─────────────────────────────────────────────────────
  const loadedAmmoName = await getLoadedAmmoName(item, weaponIndex);
  const ammoNameLower = loadedAmmoName.toLowerCase();
  const isIncendiaryAmmo = ammoNameLower.includes('incendiary');
  const isToxicAmmo = ammoNameLower.includes('toxic');

  // ── Highlighted Vitals: roll extra die before crit detection ──────────────
  const hasHighlightedVitals = installedMods.some((m) => m.highlightedVitals);
  let highlightedVitalsAutoCrit = false;
  let vitalsExtraRoll = null;
  if (hasHighlightedVitals) {
    vitalsExtraRoll = await new Roll('1d6').evaluate();
    const anyDamageDie6 = damageRoll.terms.some(
      (t) =>
        t instanceof foundry.dice.terms.Die &&
        t.faces === 6 &&
        t.results.some((r) => r.active && r.result === 6),
    );
    if (vitalsExtraRoll.total === 6 && anyDamageDie6) {
      highlightedVitalsAutoCrit = true;
    }
  }

  // ── Critical Injury detection ──────────────────────────────────────────────
  const { count: critDiceCount } = detectCriticalDice(damageRoll);
  // Penetration check uses the original roll (before any bonus) so the bonus
  // cannot self-validate the critical trigger.
  const penetratesWithoutBonus = sp === null ? damageRoll.total > 0 : damageRoll.total > sp;
  // Lost Force raises the crit threshold from 2 to 3 dice showing 6.
  const hasLostForce = installedMods.some((m) => m.lostForce);
  const critThreshold = hasLostForce ? 3 : 2;
  // Highlighted Vitals can auto-trigger a crit regardless of the Lost Force threshold.
  const isCritical = (highlightedVitalsAutoCrit || critDiceCount >= critThreshold) && penetratesWithoutBonus;

  // ── Stealth Advantage whisper ─────────────────────────────────────────────
  // When a silencer with stealthAdvantage is installed, targeting vitals,
  // at least one damage die = 6, and no crit triggered → whisper GM.
  if (targetVitals && !isCritical && installedMods.some((m) => m.stealthAdvantage)) {
    const anyDie6 = damageRoll.terms.some(
      (t) => t instanceof foundry.dice.terms.Die && t.faces === 6 && t.results.some((r) => r.active && r.result === 6),
    );
    if (anyDie6) {
      const gmIds = game.users.filter((u) => u.isGM).map((u) => u.id);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        whisper: gmIds,
        content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-eye-slash"></i> ${game.i18n.format('CYBER_BLUE.Combat.StealthAdvantageAlert', { name: attacker.name, target: targetActor?.name ?? '?' })}</p></div>`,
      });
    }
  }

  // ── Targeted Shot extra dice (Liberty, Unity, Overture) ───────────────────
  // When targeting vitals with a weapon that has targetedShotDamageDice, roll
  // the bonus dice and add them to damage (they go through SP normally).
  let targetedShotBonus = 0;
  let targetedShotRoll = null;
  if (targetVitals && weapon.targetedShotDamageDice) {
    targetedShotRoll = await new Roll(weapon.targetedShotDamageDice).evaluate();
    targetedShotBonus = targetedShotRoll.total;
  }

  // ── Barrier Penetration (Tsunami Ketsuretsu) ──────────────────────────────
  // Each damage die showing 5 or 6 adds 1 point of damage that bypasses SP.
  let barrierPenBonus = 0;
  if (installedMods.some((m) => m.barrierPenetration)) {
    for (const term of damageRoll.terms) {
      if (!(term instanceof foundry.dice.terms.Die && term.faces === 6)) continue;
      for (const result of term.results) {
        if (result.active && result.result >= 5) barrierPenBonus++;
      }
    }
  }

  // ── Improved Ricochet (Malorian Critical Ricochet) ────────────────────────
  // +1 damage per base damage die when using a ricochet point.
  const hasImprovedRicochet = isRicochet && installedMods.some((m) => m.improvedRicochet);
  const improvedRicochetBonus = hasImprovedRicochet ? damageDiceCount : 0;

  // ── Damage bonuses ─────────────────────────────────────────────────────────
  // Target Vitals: +5 damage if any damage gets through SP (independent of crit)
  const vitalsBonus = (targetVitals && penetratesWithoutBonus) ? 5 : 0;
  // Critical damage bonus:
  // • All weapons:    +5 on crit  (+10 when targeting vitals)
  // • Power Weapons: +10 on crit  (+20 when targeting vitals)
  const critBonusBase = isCritical ? ((weapon.isPowerWeapon ?? false) ? 10 : 5) : 0;
  const critBonus = targetVitals ? critBonusBase * 2 : critBonusBase;
  // Payload: weapon's built-in Toxic Payload (Yanari MP, Hercules 3AX) OR ammo name
  const weaponPayloadBonus = penetratesWithoutBonus ? (Number(weapon.payloadDmgBonus) || 0) : 0;
  const ammoPayloadBonus = penetratesWithoutBonus
    ? (isIncendiaryAmmo ? 2 : 0) + (!weapon.payloadDmgBonus && isToxicAmmo ? 2 : 0)
    : 0;
  const payloadBonus = weaponPayloadBonus + ammoPayloadBonus;
  // Synergy brand: +1 (and +1 more if dice ≥ threshold) per matching mod
  const weaponManufacturer = item.system?.manufacturer ?? '';
  let synergyBonus = 0;
  for (const mod of installedMods) {
    if (mod.synergyBrand && mod.synergyBrand === weaponManufacturer) {
      synergyBonus += 1;
      if (mod.synergyDiceThreshold > 0 && damageDiceCount >= mod.synergyDiceThreshold) {
        synergyBonus += 1;
      }
    }
  }
  // Silencer: -1 per damage die (applied last, after other bonuses)
  const silencerDmgReduction = installedMods.some((m) => m.reduceDmgPerDie) ? damageDiceCount : 0;

  // Base final damage (goes through SP as normal)
  const finalDamage = Math.max(
    0,
    damageRoll.total + critBonus + vitalsBonus + targetedShotBonus + payloadBonus + synergyBonus + improvedRicochetBonus - silencerDmgReduction,
  );

  // Critical table: head when targeting vitals, body otherwise
  const tableType = targetVitals ? 'head' : 'body';

  const netDamage = sp !== null ? Math.max(finalDamage - sp, 0) : finalDamage;
  const ablatesArmor = sp !== null && finalDamage >= sp;

  // Barrier Penetration: bonus points bypass SP entirely.
  // Compute what preSP value to pass so that applyDamage (which deducts SP
  // internally) delivers finalDamage through-SP + barrierPenBonus bypassing it.
  const effectiveFinalDamagePreBarrier = finalDamage; // used for stun check
  const barrierPenFinalDamage = barrierPenBonus > 0
    ? (sp ?? 0) + Math.max(finalDamage - (sp ?? 0), 0) + barrierPenBonus
    : finalDamage;

  const bonusNotes = [];
  if (isCritical) {
    if (highlightedVitalsAutoCrit) bonusNotes.push(game.i18n.localize('CYBER_BLUE.Combat.HighlightedVitalsCrit'));
    else bonusNotes.push(game.i18n.localize('CYBER_BLUE.CriticalInjury.CritBonus'));
  }
  if (vitalsBonus) bonusNotes.push(game.i18n.localize('CYBER_BLUE.Combat.TargetVitalsBonus'));
  if (targetedShotBonus) bonusNotes.push(game.i18n.format('CYBER_BLUE.Combat.TargetedShotBonus', { n: targetedShotBonus, dice: weapon.targetedShotDamageDice }));
  if (payloadBonus) bonusNotes.push(game.i18n.format('CYBER_BLUE.Combat.PayloadBonus', { n: payloadBonus }));
  if (synergyBonus) bonusNotes.push(game.i18n.format('CYBER_BLUE.Combat.SynergyBonus', { n: synergyBonus }));
  if (improvedRicochetBonus) bonusNotes.push(game.i18n.format('CYBER_BLUE.Combat.ImprovedRicochet', { n: improvedRicochetBonus }));
  if (barrierPenBonus) bonusNotes.push(game.i18n.format('CYBER_BLUE.Combat.BarrierPenetration', { n: barrierPenBonus }));
  if (silencerDmgReduction) bonusNotes.push(game.i18n.format('CYBER_BLUE.Combat.SilencerReduction', { n: silencerDmgReduction }));
  if (vitalsExtraRoll) bonusNotes.push(`${game.i18n.localize('CYBER_BLUE.Combat.HighlightedVitalsRoll')}: [${vitalsExtraRoll.total}]${highlightedVitalsAutoCrit ? ' ★' : ''}`);
  const totalBonus = critBonus + vitalsBonus + targetedShotBonus + payloadBonus + synergyBonus + improvedRicochetBonus - silencerDmgReduction;
  const bonusDisplay = totalBonus > 0 ? ` (+${totalBonus})` : totalBonus < 0 ? ` (${totalBonus})` : '';
  const spLineAblate = ablatesArmor ? ` (SP ${(weapon.armorPiercing ?? false) ? '-2' : '-1'})` : '';
  const critLine = bonusNotes.length
    ? `<p class="crit-roll-note"><i class="fas fa-skull"></i> ${bonusNotes.join(' · ')}</p>`
    : '';
  const spLine = sp !== null
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.SP')}: ${sp} → ${game.i18n.localize('CYBER_BLUE.Combat.NetDamage')}: <strong>${netDamage}</strong>${spLineAblate}${bonusDisplay}</p>`
    : '';

  const weaponLabel = (item.system.weapons?.length ?? 0) > 1
    ? `${item.name} - ${definition.label}`
    : item.name;

  const targetVitalsLine = targetVitals
    ? `<p class="target-vitals-note"><i class="fas fa-crosshairs"></i> ${game.i18n.localize('CYBER_BLUE.Combat.TargetVitalsActive')}</p>`
    : '';

  const damageFlavorHtml = `
    <div class="cyberpunk-blue chat-card">
      <h3>${game.i18n.localize('CYBER_BLUE.Sheet.Labels.Damage')}: ${weaponLabel}</h3>
      ${targetVitalsLine}${spLine}${critLine}
    </div>`;

  // ── Weapon crit flags ─────────────────────────────────────────────────────
  const weaponFlags = {
    critSlicing: !!weapon.critSlicing,
    critBlunt: !!weapon.critBlunt,
    critCrushing: !!weapon.critCrushing,
  };

  // ── Stun mechanic (Stun Baton, Mámù): target at 0–(−10) HP → 1 HP unconscious ──
  let effectiveFinalDamage = barrierPenFinalDamage;
  if (weapon.critStun && targetActor) {
    const targetHp = targetActor.system?.resources?.hp?.value ?? 0;
    if (netDamage > 0 && targetHp - netDamage < 0 && targetHp - netDamage >= -10) {
      effectiveFinalDamage = Math.max(0, (targetHp - 1) + (sp ?? 0));
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-bolt"></i> <strong>${game.i18n.localize('CYBER_BLUE.Combat.StunEffect')}</strong> — ${targetActor.name} ${game.i18n.localize('CYBER_BLUE.Combat.StunKnockedOut')}</p></div>`,
      });
    }
  }

  if (targetActor && (netDamage > 0 || ablatesArmor)) {
    const result = await confirmDamageDialog({
      targetActor, finalDamage, sp, netDamage, ablatesArmor, isCritical, critDiceCount,
    });
    if (result?.confirmed) {
      await damageRoll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        flavor: damageFlavorHtml,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      await applyDamageWithPermission(targetActor, effectiveFinalDamage);
      // Armor Piercing: ablate 1 extra SP (Tactician slug)
      if ((weapon.armorPiercing ?? false) && ablatesArmor) {
        await ablateArmorExtraWithPermission(targetActor);
      }
      if (isCritical) {
        await rollCriticalInjuryWithPermission(targetActor, tableType, { attackerActor: attacker, weaponFlags });
      }
    }
  } else {
    await damageRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      flavor: damageFlavorHtml,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }

  // ── Carnage BODY requirement — Torn Muscle on attacker ────────────────────
  if (critOnBodyReq > 0 && attackerBody < critOnBodyReq) {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-person-falling-burst"></i> ${game.i18n.format('CYBER_BLUE.Combat.CarnageCritOnBody', { name: attacker.name, required: critOnBodyReq, body: attackerBody })}</p></div>`,
    });
    await applyForcedCriticalInjuryWithPermission(attacker, 'tornMuscle', null);
  }

  // ── Scatter (Brunswick AR-9 single-shot) ─────────────────────────────────
  if ((weapon.scatter ?? false) && attackerToken && targetToken) {
    await resolveScatterEffect(attacker, attackerToken, targetToken, finalDamage, damageRoll, weaponLabel);
  }
}

export async function resolveAutofireAttack(attacker, item, weaponIndex) {
  const effectiveWeapons = item.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(item);
  const weapon = effectiveWeapons[weaponIndex];
  if (!weapon) return;

  // ── Installed mod checks ───────────────────────────────────────────────────
  const installedMods = getInstalledWeaponMods(item, weaponIndex, attacker);
  // compressRof (silencers): block autofire entirely
  if (installedMods.some((m) => m.compressRof)) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.SilencerBlocksAutofire'));
    return;
  }
  // burstControlAmmoReduction (ClearVue Mk.8): reduce ammo cost, minimum 8
  const burstReduction = installedMods.reduce((sum, m) => sum + (m.burstControlAmmoReduction ?? 0), 0);
  const AUTOFIRE_AMMO_COST = Math.max(8, 10 - burstReduction);
  // recoilBonus: AF-only mods (Strigoi, Zaar) + general mods
  const modRecoilBonus = installedMods.reduce(
    (sum, m) => sum + (m.recoilBonus ?? 0),
    0,
  );

  const currentAmmo = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? weapon.ammoCurrent ?? 0;
  if (currentAmmo < AUTOFIRE_AMMO_COST) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.AutofireNotEnoughAmmo'));
    return;
  }

  const definition = getWeaponTypeDefinition(weapon.type);
  const baseSkill = item.system.weapons?.[weaponIndex]?.skill ?? weapon.skill;
  const skillSlug = CONFIG.CYBER_BLUE.skills[weapon.skill] ? weapon.skill : baseSkill;

  // Use lower of weapon skill rank and autofire rank
  const weaponSkillRank = attacker.system?.skills?.[skillSlug]?.rank ?? 0;
  const autofireRank = attacker.system?.skills?.autofire?.rank ?? 0;
  const usedRank = Math.min(weaponSkillRank, autofireRank);
  const statSlug = CONFIG.CYBER_BLUE.skills[skillSlug]?.stat ?? 'rflx';
  const statValue = attacker.system?.stats?.[statSlug]?.value ?? 0;
  const statRollMod = attacker.system?.stats?.[statSlug]?.rollMod ?? 0;

  const autofireRangeTable = weapon.autofireRangeTable?.length ? weapon.autofireRangeTable : null;
  const multiplier = weapon.autofireMultiplier ?? 1;

  const { token: targetToken, actor: targetActor } = getTarget();
  const targetSP = targetActor ? (targetActor.system?.resources?.armor?.value ?? 0) : null;
  const targetRflx = targetActor?.system?.stats?.rflx?.value ?? 0;

  const distanceMeters = getDistanceMeters(attacker, targetToken);

  // DV from autofire range table (falls back to weapon range table)
  const effectiveTable = autofireRangeTable ?? (definition.usesRangeTable ? definition.rangeTable : null);
  const rangeDV = distanceMeters !== null && effectiveTable
    ? getDvForRange(definition, distanceMeters, effectiveTable)
    : null;

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

  const totalBonus = statValue + usedRank + statRollMod;
  const needsManualDV = rangeDV === null;

  const targetLine = targetActor
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.Target')}: <strong>${targetActor.name}</strong>${targetSP !== null ? ` (SP ${targetSP})` : ''}</p>`
    : '';
  const distanceLine = distanceMeters !== null
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.Distance')}: <strong>${distanceMeters.toFixed(1)} m</strong>${rangeDV !== null ? ` — DV <strong>${rangeDV}</strong>` : ''}</p>`
    : '';
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
      <p><strong>${game.i18n.localize('CYBER_BLUE.Combat.Autofire')}</strong> — ${game.i18n.format('CYBER_BLUE.Combat.AutofireConsumes', { ammo: AUTOFIRE_AMMO_COST })}${burstReduction > 0 ? ` <em>(${game.i18n.localize('CYBER_BLUE.Combat.BurstControl')})</em>` : ''} | ×${multiplier}</p>
      <p>${game.i18n.localize('CYBER_BLUE.Combat.AutofireRollNote', { bonus: totalBonus >= 0 ? `+${totalBonus}` : `${totalBonus}` })}</p>
      ${targetLine}
      ${distanceLine}
      <div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem;">
        ${dvInputLine}
        ${evasionLine}
      </div>
    </div>`;

  let dvResult;
  try {
    dvResult = await new Promise((resolve) => {
      const dialog = new foundry.applications.api.DialogV2({
        window: { title: `${game.i18n.localize('CYBER_BLUE.Combat.Autofire')}: ${item.name}` },
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
    const evasionRoll = await rollTargetEvasion(targetActor);
    resolvedDV = (rawDV !== null && Number.isFinite(rawDV))
      ? Math.max(evasionRoll.total, rawDV)
      : evasionRoll.total;
  } else if (rawDV !== null && Number.isFinite(rawDV)) {
    resolvedDV = rawDV;
  }

  // Roll attack using custom formula (skill override + recoil mod bonus)
  const formula = modRecoilBonus !== 0
    ? `1d10 + ${totalBonus} + ${modRecoilBonus}`
    : `1d10 + ${totalBonus}`;
  const attackRoll = await (new Roll(formula)).evaluate();
  await attackRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    flavor: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Combat.Autofire')}: ${item.name}</h3>${resolvedDV !== null ? `<p>DV ${resolvedDV}</p>` : ''}</div>`,
    rollMode: game.settings.get('core', 'rollMode'),
  });

  // Consume ammo
  await consumeAmmo(item, weaponIndex, AUTOFIRE_AMMO_COST);

  // ── Silence system (autofire) ─────────────────────────────────────────────
  // Autofire always counts as RoF2+, destroying any destroyedByRof2 silencers.
  const silencedModsAF = installedMods.filter((m) => (m.silenceDV ?? 0) > 0);
  if (silencedModsAF.length > 0) {
    const silenceDVAF = Math.max(...silencedModsAF.map((m) => m.silenceDV));
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-volume-xmark"></i> ${game.i18n.format('CYBER_BLUE.Combat.SilencedShot', { dv: silenceDVAF })}</p></div>`,
    });
  }
  for (const mod of installedMods) {
    if (!mod._docId) continue;
    if (mod.destroyedByRof2 || (mod.destroyedByTech && !!weapon.isTechWeapon)) {
      await deleteActorItemWithPermission(attacker, mod._docId);
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-triangle-exclamation"></i> ${game.i18n.format('CYBER_BLUE.Combat.SilencerDestroyed', { weapon: item.name })}</p></div>`,
      });
    }
  }

  const hit = resolvedDV === null || attackRoll.total >= resolvedDV;
  if (!hit) return;

  // autofireDamage holds the per-bullet AF value when SS and AF damage differ.
  // Falls back to weapon.damage so non-split weapons (e.g. Helix) work unchanged.
  const damageFormula = weapon.autofireDamage || weapon.damage || definition.damage || '1d6';
  const damageRoll = await new Roll(damageFormula).evaluate();
  const effectiveMultiplier = (resolvedDV !== null && Number.isFinite(resolvedDV))
    ? Math.min(multiplier, Math.max(1, attackRoll.total - resolvedDV))
    : multiplier;
  const rawDamage = Math.round(damageRoll.total * effectiveMultiplier);

  // ── Critical Injury detection ──────────────────────────────────────────────
  const { count: critDiceCount } = detectCriticalDice(damageRoll);
  const sp = targetSP !== null ? targetSP : null;
  // Penetration check uses rawDamage (post-multiplier, pre-bonus)
  const penetratesWithoutBonus = sp === null ? rawDamage > 0 : rawDamage > sp;
  const isCritical = critDiceCount >= 2 && penetratesWithoutBonus;
  // Crit bonus: all weapons +5, PW +10. Autofire cannot target vitals so no doubling.
  const critBonusAF = isCritical ? ((weapon.isPowerWeapon ?? false) ? 10 : 5) : 0;
  const finalDamage = rawDamage + critBonusAF;

  const netDamage = sp !== null ? Math.max(finalDamage - sp, 0) : finalDamage;
  const ablatesArmor = sp !== null && finalDamage >= sp;

  const critLine = isCritical
    ? `<p class="crit-roll-note"><i class="fas fa-skull"></i> ${game.i18n.format('CYBER_BLUE.CriticalInjury.CritDetected', { count: critDiceCount })} ${game.i18n.localize('CYBER_BLUE.CriticalInjury.CritBonus')}</p>`
    : '';
  const spLine = sp !== null
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.SP')}: ${sp} → ${game.i18n.localize('CYBER_BLUE.Combat.NetDamage')}: <strong>${netDamage}</strong>${ablatesArmor ? ' (SP -1)' : ''}${isCritical ? ` (+${critBonusAF})` : ''}</p>`
    : '';

  const weaponLabel = (item.system.weapons?.length ?? 0) > 1 ? `${item.name} - ${definition.label}` : item.name;
  const multNote = effectiveMultiplier !== 1 ? ` ×${effectiveMultiplier}${effectiveMultiplier !== multiplier ? ` (capped from ×${multiplier})` : ''} = ${rawDamage}` : '';

  const autofireFlavorHtml = `
    <div class="cyberpunk-blue chat-card">
      <h3>${game.i18n.localize('CYBER_BLUE.Combat.Autofire')} ${game.i18n.localize('CYBER_BLUE.Sheet.Labels.Damage')}: ${weaponLabel}</h3>
      <p>${damageFormula}${multNote}</p>
      ${spLine}${critLine}
    </div>`;

  if (targetActor && (netDamage > 0 || ablatesArmor)) {
    const result = await confirmDamageDialog({
      targetActor, finalDamage, sp, netDamage, ablatesArmor, isCritical, critDiceCount,
    });
    if (result?.confirmed) {
      await damageRoll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        flavor: autofireFlavorHtml,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      await applyDamageWithPermission(targetActor, finalDamage);
      if (isCritical) {
        // Autofire always uses the body table
        await rollCriticalInjuryWithPermission(targetActor, 'body', { attackerActor: attacker });
      }
    }
  } else {
    await damageRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      flavor: autofireFlavorHtml,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }
}
