import { buildWeaponUpdate, getWeaponTypeDefinition, COMBAT_CONFIG, spendWeaponUse } from './combat.mjs';
import { getEffectiveItemWeapons, getInstalledWeaponMods } from './mods.mjs';
import { resolveConeAttack, resolveExplosionAttack, resolveAfflictionConeAttack, resolveAfflictionExplosionAttack, resolveScatterEffect } from './cone-attack.mjs';
import {
  recordCombatAttack,
  getTurnState,
  markSpotWeaknessUsed,
  markDamageDeflectionUsed,
} from './combat-tracker.mjs';
import { detectCriticalDice, confirmDamageDialog, rollCriticalInjury } from './critical-injury.mjs';
import { resolveAfflictionAttack, resolveAppliedAffliction } from './affliction-attack.mjs';
import { applyDamageWithPermission, rollCriticalInjuryWithPermission, rollVehicleCriticalWithPermission, deleteActorItemWithPermission, ablateArmorExtraWithPermission, applyForcedCriticalInjuryWithPermission, applyDamageToSubsystemWithPermission } from './socket.mjs';
import { getVitalAreaSubsystem } from './vehicle-damage.mjs';
import { clearWeaponCharge, countWallsBetweenTokens } from './tech-charge.mjs';
import { getActiveAEFlag } from './effects.mjs';
import { playUiSound, suppressNextFailSound, playSfx } from './audio.mjs';
import { computeVisibilityPenalty } from './visibility.mjs';

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

/** Resolve the loaded ammo Item document, or null if none / not found. */
async function getLoadedAmmoItem(item, weaponIndex) {
  const uuid = item.system.weapons?.[weaponIndex]?.ammoTypeUuid ?? '';
  if (!uuid) return null;
  try {
    return await fromUuid(uuid);
  } catch {
    return null;
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
  // Delegates to the shared helper so consumable-thrown grenades spend from
  // quantity (and self-delete at 0) instead of decrementing ammoCurrent.
  await spendWeaponUse(item, weaponIndex, shots);
}

/** Set a pending chomp-ammo flag on the attacker for detonation on their next turn. */
async function _setChompPending(attacker, targetToken) {
  const round = game.combat?.round ?? 0;
  const turnIdx = game.combat?.turn ?? 0;
  const combatantIdx = game.combat?.combatants.contents.findIndex((c) => c.actorId === attacker.id) ?? -1;
  const key = `chompPending-${Date.now()}`;
  await attacker.setFlag('cyberpunk-blue', key, {
    targetTokenId: targetToken.id,
    setAtRound: round,
    setAtTurnIdx: turnIdx,
    attackerCombatantIdx: combatantIdx,
  });
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-bone"></i> ${game.i18n.format('CYBER_BLUE.Combat.ChompAmmoStuck', { target: targetToken.name })}</p></div>`,
  });
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

  // ── Tech Weapon charge state ──────────────────────────────────────────────
  const isCharged = !!(item.getFlag?.('cyberpunk-blue', `charged-${weaponIndex}`) ?? false);
  const isCs3     = isCharged && (weapon.cs3 ?? false);

  // Block attack if the magazine is empty (or not enough ammo for CS3)
  if (definition.usesMagazine) {
    const ammoCurrent = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
    if (ammoCurrent <= 0) {
      suppressNextFailSound();
      playUiSound('gun-empty');
      ui.notifications.warn(game.i18n.format('CYBER_BLUE.Combat.NoAmmo', { weapon: item.name }));
      return;
    }
    // minimumAmmoToFire (Kang Tao L-69 Zhuo): refuses to fire below threshold
    const minAmmo = weapon.minimumAmmoToFire ?? 0;
    if (minAmmo > 0 && ammoCurrent < minAmmo) {
      suppressNextFailSound();
      playUiSound('gun-empty');
      ui.notifications.warn(game.i18n.format('CYBER_BLUE.Combat.MinAmmoToFire', { weapon: item.name, min: minAmmo, current: ammoCurrent }));
      return;
    }
  }

  const { token: targetToken, actor: targetActor } = getTarget();
  let targetSP = targetActor ? (targetActor.system?.resources?.armor?.value ?? 0) : null;
  const targetRflx = targetActor?.system?.stats?.rflx?.value ?? 0;

  // Distance measurement
  const distanceMeters = getDistanceMeters(attacker, targetToken);

  // ── Installed mods (needed for range improvement and dialog bonuses) ───────
  const installedMods = getInstalledWeaponMods(item, weaponIndex, attacker);

  // ── Loaded ammo item (for ammo-specific bonuses) ──────────────────────────
  const loadedAmmoItem = await getLoadedAmmoItem(item, weaponIndex);
  const loadedAmmoData = loadedAmmoItem?.system ?? null;

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

  // Show manual DV input only for ranged weapons with no range table result
  const needsManualDV = rangeDV === null;

  const targetLine = targetActor
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.Target')}: <strong>${targetActor.name}</strong>${targetSP !== null ? ` (SP ${targetSP})` : ''}</p>`
    : '';

  const distanceLine = distanceMeters !== null
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.Distance')}: <strong>${distanceMeters.toFixed(1)} m</strong>${rangeDV !== null ? ` — DV <strong>${rangeDV}</strong>` : ''}</p>`
    : '';

  const dvInputLine = (needsManualDV && !isMelee) ? `
    <label style="display:flex;align-items:center;gap:0.5rem;">
      <span>${game.i18n.localize('CYBER_BLUE.Combat.DV')}:</span>
      <input type="number" id="attack-dv" value="" min="0" style="width:5rem;" placeholder="—" />
    </label>` : '';

  // Melee: evasion is always auto-rolled after dialog; show info note instead of checkbox.
  const meleeEvasionNote = (isMelee && targetActor)
    ? `<p><em><i class="fas fa-person-running"></i> ${game.i18n.localize('CYBER_BLUE.Combat.MeleeAutoEvasion')}</em></p>`
    : '';
  const evasionLine = (evasionEligible && !isMelee) ? `
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

  // TeleOptics + Targeting Scope eligibility evaluated here (before modifier assembly) for the dialog.
  const hasTeleOptics = getActiveAEFlag(attacker, 'teleOptics');
  const teleOpticsBonusPreview = (hasTeleOptics && distanceMeters !== null && distanceMeters > 50) ? 1 : 0;

  // Targeting Scope: +1 to aimed attacks. Pre-read targetVitals flag for dialog preview.
  const hasTargetingScope = getActiveAEFlag(attacker, 'targetingScope');
  const preTargetVitals = item.getFlag('cyberpunk-blue', `targetVitals-${weaponIndex}`) ?? false;
  const targetingScopeBonus = (hasTargetingScope && preTargetVitals) ? 1 : 0;

  // ── Vitals targeting penalty preview ──────────────────────────────────────
  // Surfaced in the dialog so the to-hit penalty is legible before rolling.
  // Covers both character vitals (targetVitals flag) and vehicle vital areas
  // (targetVehicleVitalRegionId flag + vehicle target). Mirrors the actual
  // penalty math applied after the dialog (rawVitalsPenalty − modReduction).
  const preTargetVehicleVitalRegionId = item.getFlag('cyberpunk-blue', `targetVehicleVitalRegionId-${weaponIndex}`) ?? null;
  const isPreTargetingVehicleVital = preTargetVehicleVitalRegionId !== null && targetActor?.type === 'vehicle';
  const preModVitalsPenaltyReduction = installedMods.reduce((sum, m) => sum + (m.targetVitalsPenaltyReduction ?? 0), 0);
  const previewVitalsPenalty = Math.max(0, (weapon.targetVitalsPenalty ?? 8) - preModVitalsPenaltyReduction);
  const showVitalsPenalty = (preTargetVitals || isPreTargetingVehicleVital) && previewVitalsPenalty > 0;

  const distanceBonusLines = [
    showVitalsPenalty ? `<p style="color:var(--cpb-error, #ff4444);margin:0;"><i class="fas fa-crosshairs"></i> ${game.i18n.format('CYBER_BLUE.Combat.TargetVitalsPenalty', { n: previewVitalsPenalty })}</p>` : '',
    trajectoryBonus ? `<p style="color:var(--cpb-accent);margin:0;"><i class="fas fa-ruler-combined"></i> ${game.i18n.localize('CYBER_BLUE.Combat.TrajectoryCalculations')}</p>` : '',
    closeRangeBonusVal ? `<p style="color:var(--cpb-accent);margin:0;"><i class="fas fa-crosshairs"></i> ${game.i18n.localize('CYBER_BLUE.Combat.CloseRangeBonus')}</p>` : '',
    calibrationBonus > 0 ? `<p style="color:var(--cpb-accent);margin:0;"><i class="fas fa-bullseye"></i> ${game.i18n.format('CYBER_BLUE.Combat.CalibrationActive', { n: calibrationBonus })}</p>` : '',
    (isCharged && (weapon.chargedAttackBonus ?? 0) > 0) ? `<p style="color:var(--cpb-accent);margin:0;"><i class="fas fa-bolt"></i> ${game.i18n.format('CYBER_BLUE.Combat.ChargedAttackBonus', { n: weapon.chargedAttackBonus })}</p>` : '',
    teleOpticsBonusPreview > 0 ? `<p style="color:var(--cpb-accent);margin:0;"><i class="fas fa-eye"></i> TeleOptics +1 (range &gt;50m)</p>` : '',
    targetingScopeBonus > 0 ? `<p style="color:var(--cpb-accent);margin:0;"><i class="fas fa-crosshairs"></i> Targeting Scope +1 (aimed)</p>` : '',
    (weapon.isSmartWeapon && (loadedAmmoData?.attackBonus ?? 0) > 0) ? `<p style="color:var(--cpb-accent);margin:0;"><i class="fas fa-microchip"></i> ${game.i18n.localize('CYBER_BLUE.Combat.SmartAmmoBonus')} +${loadedAmmoData.attackBonus}</p>` : '',
  ].filter(Boolean).join('');

  const dialogContent = `
    <div class="cyberpunk-blue" style="padding:0.5rem;">
      ${targetLine}
      ${distanceLine}
      ${distanceBonusLines}
      <div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem;">
        ${dvInputLine}
        ${meleeEvasionNote}
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

  // Resolve final DV.
  // Melee: always auto-roll target evasion; evasion result IS the DV (no target = auto-hit).
  // Ranged: use range-table DV, optionally raised by an evasion roll when eligible.
  let resolvedDV = null;
  if (isMelee) {
    if (targetActor) {
      const evasionRoll = await rollTargetEvasion(targetActor);
      resolvedDV = evasionRoll.total;
    }
  } else if (rollEvasion && targetActor) {
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
  // Vehicle vital-area targeting: attacker picked a specific vital area on the
  // target vehicle.  Applies the same to-hit penalty as character vitals and
  // fires the bound crit entry deterministically on a critical hit.
  const targetVehicleVitalRegionId = item.getFlag('cyberpunk-blue', `targetVehicleVitalRegionId-${weaponIndex}`) ?? null;
  const isTargetingVehicleVital     = targetVehicleVitalRegionId !== null
                                    && targetActor?.type === 'vehicle';
  // Resolve the subsystem item linked to the targeted vital area. When present
  // and not yet destroyed, damage is routed to the subsystem's own HP/SP pools
  // instead of the vehicle's main armour/structure.
  const vitalSubsystem = isTargetingVehicleVital
    ? getVitalAreaSubsystem(targetActor, targetVehicleVitalRegionId)
    : null;
  const vitalSubsystemActive = !!vitalSubsystem && !(vitalSubsystem.system?.destroyed ?? false);
  if (vitalSubsystemActive) {
    targetSP = vitalSubsystem.system?.sp?.value ?? 0;
  }
  const rawVitalsPenalty = weapon.targetVitalsPenalty ?? 8;
  const targetVitalsPenalty = -(rawVitalsPenalty - modVitalsPenaltyReduction);

  let attackModifier = 0;
  if (targetVitals || isTargetingVehicleVital) attackModifier += targetVitalsPenalty;
  if (weapon.isSmartWeapon) attackModifier += 1;
  // Smart Ammo: additional attack bonus (only applies when fired from a Smart Weapon).
  if (weapon.isSmartWeapon && (loadedAmmoData?.attackBonus ?? 0) > 0) {
    attackModifier += loadedAmmoData.attackBonus;
  }
  if (weapon.isExcellentQuality) attackModifier += 1;
  attackModifier += modRecoilBonus;
  attackModifier += beginnerBonus;
  attackModifier += trajectoryBonus;
  attackModifier += closeRangeBonusVal;
  attackModifier += digitalLinkActive ? 1 : 0;
  attackModifier += steadyActive ? 1 : 0;
  attackModifier += handlingComputerActive ? 1 : 0;
  attackModifier += calibrationBonus;
  // Charged Attack Bonus (Sanroo Hello Cutie+ Stabilizers: +2 while charged)
  if (isCharged) attackModifier += (weapon.chargedAttackBonus ?? 0);
  // Ricochet penalty: -4 normally, -3 with Directed Recoil mod
  if (isRicochet) {
    const hasDirectedRecoil = installedMods.some((m) => m.directedRecoil);
    attackModifier += hasDirectedRecoil ? -3 : -4;
  }

  // ── TeleOptics cyberware: +1 attack vs targets beyond 50m (not Autofire) ──
  // teleOpticsBonusPreview was computed before the dialog (same value); reuse it.
  attackModifier += teleOpticsBonusPreview;

  // ── Targeting Scope: +1 attack on aimed shots (Target Vitals) ────────────
  // targetingScopeBonus was computed before the dialog using the same flag.
  attackModifier += targetingScopeBonus;

  // ── Solo Precision Attack: +1 to all attacks per 3 pts allocated ─────────
  attackModifier += getActiveAEFlag(attacker, 'soloPrecisionAttack') ?? 0;

  // ── Visibility penalty ────────────────────────────────────────────────────
  // Thermal-imaging scopes (thermalImaging: true on any installed mod) grant the
  // same effect as ignoreDarknessPenalty + ignoreObscurationPenalty — the scope
  // data is easier to read here than via a transferring AE, since scopes are
  // per-weapon rather than per-actor.
  const _hasThermalImaging = installedMods.some((m) => m.thermalImaging);
  const _visAttackerToken = attacker.getActiveTokens()[0];
  const _vis = _hasThermalImaging
    ? { blocked: false, penalty: 0, darkEff: 0, obscEff: 0, notes: [] }
    : computeVisibilityPenalty(attacker, _visAttackerToken, targetToken);
  if (_vis.blocked) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="cyberpunk-blue chat-card">
        <h3><i class="fas fa-eye-slash"></i> ${game.i18n.localize('CYBER_BLUE.Visibility.BlockedTitle')}</h3>
        <p>${_vis.notes.join(' ')}</p>
      </div>`,
    });
    return;
  }
  attackModifier += _vis.penalty;

  if (isMelee) {
    playSfx('melee-weapon-attack');
  } else if (isRanged && weapon.type !== 'bowCrossbow' && !isCharged) {
    playSfx('gunshot');
  }

  const attackRoll = await attacker.rollSkill({ skillSlug, dv: resolvedDV, modifier: attackModifier });

  // ── Jam-on-1 detection (Cheap = JAM, Poor Quality = POQ) ──────────────────
  // jamOnRoll is a threshold; jamFiresFirst differentiates POQ (shot lands)
  // from JAM (shot is lost).
  const d10Term = attackRoll.terms?.find((t) => t instanceof foundry.dice.terms.Die && t.faces === 10);
  const d10Result = d10Term?.results?.[0]?.result ?? null;

  // ── Solo Fumble Recovery: auto-post a re-roll when d10=1 ─────────────────
  // If the attacker has an active AE with flags.cyberpunk-blue.soloFumbleRecovery,
  // and the raw attack die is 1, immediately roll a fresh 1d10 and post it to
  // chat so the player can use the better result.  No dialog needed — the
  // roll is visible and the player/GM uses it if beneficial.
  if (d10Result === 1 && getActiveAEFlag(attacker, 'soloFumbleRecovery')) {
    const recoveryRoll = await new Roll('1d10').evaluate();
    await recoveryRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      flavor: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-rotate-right"></i> <strong>Solo Fumble Recovery</strong> — d10 was 1; use this re-roll if it improves the result.</p></div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }

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

  // ── Auto-fire-on-10 redirect (Kang Tao S9 Daishi Tang) ───────────────────
  // On a single-shot (SS) attack: if the raw d10 result = 10 and the weapon has
  // ≥ 10 rounds loaded, the shot is treated as autofire instead.
  if (weapon.autoFireOn10 && d10Result === 10) {
    const afAmmo = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
    if (afAmmo >= 10) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-fire"></i> ${game.i18n.format('CYBER_BLUE.Combat.AutoFireOn10', { weapon: item.name })}</p></div>`,
      });
      return resolveAutofireAttack(attacker, item, weaponIndex);
    }
  }

  // ── Accidental Discharge (Rostovic RC-7 Strigoi mod) ─────────────────────
  // On a single-shot attack (rateOfFire=1 or the weapon fired exactly 1 shot),
  // if the raw d10 attack die result is odd: consume an extra round (if available)
  // and flag for +1 damage per die later.
  const hasAccidentalDischarge = installedMods.some((m) => m.accidentalDischarge);
  const isSingleShot = (weapon.rateOfFire ?? 1) <= 1;
  let accidentalDischargeBonusDice = 0;
  if (hasAccidentalDischarge && isSingleShot && d10Result !== null && (d10Result % 2 !== 0)) {
    const currentAmmoAD = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
    if (currentAmmoAD >= 2) {
      // Consume extra round now (normal shot consumed below)
      await item.update(buildWeaponUpdate(item, weaponIndex, { ammoCurrent: currentAmmoAD - 1 }));
      accidentalDischargeBonusDice = 1;
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-bolt"></i> ${game.i18n.format('CYBER_BLUE.Combat.AccidentalDischarge', { weapon: item.name, die: d10Result })}</p></div>`,
      });
    }
  }

  // Record this attack for RoF tracking
  const attackerToken = attacker.getActiveTokens()[0];
  const attackerCombatant = (attackerToken && game.combat?.started)
    ? (game.combat.combatants.find((c) => c.tokenId === attackerToken.id) ?? null)
    : null;
  if (attackerCombatant) {
    const rof = Math.max(Number(weapon.rateOfFire) || 1, 1);
    await recordCombatAttack(attackerCombatant, item.id, weaponIndex, rof);
  }

  // ── CS3 (Charged Shot 3) ammo handling ────────────────────────────────────
  // When charged and cs3, the weapon requires 3 shots per attack.
  // If only 1–2 remain, fire all with the cs3FallbackDamage formula.
  let cs3ShotsRequired = 0;
  let useFallbackAmmoWasCs3 = false;
  if (isCs3) {
    cs3ShotsRequired = 3;
    const cs3AmmoCurrent = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
    if (cs3AmmoCurrent >= cs3ShotsRequired) {
      // Normal CS3: consume 3 rounds
    } else if (cs3AmmoCurrent > 0) {
      // Short CS3: fire remaining rounds with fallback formula
      cs3ShotsRequired = cs3AmmoCurrent;
      useFallbackAmmoWasCs3 = true;
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-triangle-exclamation"></i> ${game.i18n.format('CYBER_BLUE.Combat.Cs3ShortAmmo', { weapon: item.name, formula: weapon.cs3FallbackDamage || weapon.damage })}</p></div>`,
      });
    }
    // cs3ShotsRequired now holds how many rounds to consume
  }

  // ── Short-ammo fallback (Brunswick 4d6/5rnd, Osprey burst 6d6/3rnd) ──────
  // When fewer rounds remain than the weapon needs but more than zero:
  // fire all remaining using the fallback formula.
  const shotsRequired = item.system.weapons?.[weaponIndex]?.shots ?? weapon.shots ?? 0;
  const ammoCurrent = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
  let actualShots = isCs3 ? cs3ShotsRequired : shotsRequired;
  let useFallbackDamage = false;
  if (
    !isCs3 &&
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

  // ── Smart Ammo near-miss re-roll ──────────────────────────────────────────
  // When Smart Ammo (smartMissReroll: true) is loaded in a Smart Weapon and
  // the attack misses by ≤5: the guided round self-corrects — roll 1d10+14 as
  // a replacement attack total.  The re-roll cannot itself trigger another re-roll.
  let effectiveAttackTotal = attackRoll.total;
  if (!hit && weapon.isSmartWeapon && loadedAmmoData?.smartMissReroll && resolvedDV !== null) {
    const missMargin = resolvedDV - attackRoll.total;
    if (missMargin > 0 && missMargin <= 5) {
      const rerollRoll = await new Roll('1d10 + 14').evaluate();
      await rerollRoll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        flavor: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-microchip"></i> <strong>${game.i18n.localize('CYBER_BLUE.Combat.SmartAmmoReroll')}</strong> — ${game.i18n.format('CYBER_BLUE.Combat.SmartAmmoRerollDetail', { margin: missMargin, dv: resolvedDV })}</p></div>`,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      effectiveAttackTotal = rerollRoll.total;
    }
  }
  const effectiveHit = resolvedDV === null || effectiveAttackTotal >= resolvedDV;

  // ── ISA miss-redirect (Malorian Arms Sonnet beacon system) ───────────────
  // Smart weapons that miss by ≤5 check if the target has a Beacon Tag AE.
  // If so the ISA round self-guides: consume the tag and treat the attack as a hit.
  // Beacon redirect is checked after the Smart Ammo re-roll so it only fires if
  // the guided re-roll also failed (or no smart ammo was loaded).
  let beaconRedirected = false;
  if (!effectiveHit && weapon.isSmartWeapon && resolvedDV !== null) {
    const missMargin = resolvedDV - effectiveAttackTotal;
    if (missMargin > 0 && missMargin <= 5 && targetActor) {
      const beaconAE = targetActor.effects.find((e) => e.getFlag('cyberpunk-blue', 'beaconTagged'));
      if (beaconAE) {
        beaconRedirected = true;
        await beaconAE.delete();
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: attacker }),
          content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-crosshairs"></i> <strong>${game.i18n.localize('CYBER_BLUE.Combat.BeaconRedirect')}</strong> — ${item.name} ${game.i18n.format('CYBER_BLUE.Combat.BeaconRedirectDetail', { target: targetActor.name, margin: missMargin })}</p></div>`,
        });
      }
    }
  }
  if (!effectiveHit && !beaconRedirected) return;

  // ── Chomp Ammo (KTech Terrier): stick ammo to target on SS hit ────────────
  if ((weapon.chompAmmo ?? false) && targetToken) {
    await _setChompPending(attacker, targetToken);
  }

  // ── Beacon weapon: tag the target with a Beacon Tag AE ───────────────────
  // When a Tracker Dart (isBeaconWeapon) hits, apply a Beacon Tag AE to the
  // target. The tag is consumed by the first ISA near-miss from any smart weapon.
  if ((weapon.isBeaconWeapon ?? false) && targetActor) {
    const existingTag = targetActor.effects.find((e) => e.getFlag('cyberpunk-blue', 'beaconTagged'));
    if (!existingTag) {
      await targetActor.createEmbeddedDocuments('ActiveEffect', [{
        name: game.i18n.localize('CYBER_BLUE.Combat.BeaconTagName'),
        icon: 'icons/svg/target.svg',
        changes: [],
        flags: { 'cyberpunk-blue': { beaconTagged: true } },
      }]);
    }
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-location-crosshairs"></i> <strong>${targetActor.name}</strong> ${game.i18n.localize('CYBER_BLUE.Combat.BeaconTagApplied')}</p></div>`,
    });
  }

  // ── Solo Spot Weakness / Ninja Weak-Spot: SP bypass on first hit ──────────
  // If the attacker has an active AE with flags.cyberpunk-blue.soloSpotWeakness
  // or flags.cyberpunk-blue.ninjaWeakSpot, AND the combatant hasn't used it yet
  // this turn, the first hit of the turn treats the target's SP as 0.
  let spBypassActive = false;
  if (attackerCombatant && targetActor) {
    const ats = getTurnState(attackerCombatant);
    if (!ats.spotWeaknessUsed) {
      const hasSpotWeakness = getActiveAEFlag(attacker, 'soloSpotWeakness');
      const hasNinjaWeakSpot = getActiveAEFlag(attacker, 'ninjaWeakSpot');
      if (hasSpotWeakness || hasNinjaWeakSpot) {
        spBypassActive = true;
        await markSpotWeaknessUsed(attackerCombatant);
        const tacticLabel = hasSpotWeakness ? 'Solo Spot Weakness' : 'Ninja Weak-Spot';
        ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: attacker }),
          content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-bullseye"></i> <strong>${tacticLabel}</strong> — target SP bypassed for this hit.</p></div>`,
        });
      }
    }
  }

  // CS3 damage formula selection: use cs3FallbackDamage when ammo was short.
  const cs3WasShortAmmo = isCs3 && useFallbackAmmoWasCs3;
  const baseDamageFormula = cs3WasShortAmmo
    ? (weapon.cs3FallbackDamage || weapon.damage || definition.damage || '1d6')
    : useFallbackDamage
      ? (weapon.shortAmmoFallbackDamage ?? weapon.damage ?? definition.damage ?? '1d6')
      : (weapon.damage ?? definition.damage ?? '1d6');
  const damageRoll = await new Roll(baseDamageFormula).evaluate();

  // Charged: effective SP is halved (ignore ½ SP).
  const rawSP = targetSP !== null ? targetSP : null;
  // Spot Weakness / Ninja Weak-Spot: treat SP as 0 for this hit.
  // Burning Edge (Mono-Three): blade ignores any target SP < 11 (treat as 0).
  const hasBurningEdge = !!(weapon.burningEdge ?? false);
  const spAfterBurningEdge = spBypassActive ? 0
    : (rawSP !== null && hasBurningEdge && rawSP < 11 ? 0 : rawSP);
  // halveSP (Kendachi Shi Bayonet): treat target SP as Math.ceil(SP / 2).
  const hasHalveSP = !!(weapon.halveSP ?? false);
  const spAfterHalve = (!spBypassActive && spAfterBurningEdge !== null && hasHalveSP)
    ? Math.ceil(spAfterBurningEdge / 2)
    : spAfterBurningEdge;
  const sp    = spAfterHalve !== null ? (isCharged ? Math.floor(spAfterHalve / 2) : spAfterHalve) : null;
  const damageDiceCount = countDamageDice(damageRoll);

  // ── Ammo-based bonuses ─────────────────────────────────────────────────────
  const loadedAmmoName = await getLoadedAmmoName(item, weaponIndex);
  const ammoNameLower = loadedAmmoName.toLowerCase();
  const isIncendiaryAmmo = ammoNameLower.includes('incendiary');
  const isToxicAmmo = ammoNameLower.includes('toxic');
  const isExplosiveAmmo = ammoNameLower.includes('explosive');

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
  // Target Vitals / Vehicle Vital Area: +5 damage if any damage gets through SP
  const aimingAtVitals = targetVitals || isTargetingVehicleVital;
  const vitalsBonus = (aimingAtVitals && penetratesWithoutBonus) ? 5 : 0;
  // Critical damage bonus:
  // • All weapons:    +5 on crit  (+10 when targeting vitals)
  // • Power Weapons: +10 on crit  (+20 when targeting vitals)
  // • Vicious (Cut-O-Matic): +5 extra on top of the normal crit bonus
  const critBonusBase = isCritical ? ((weapon.isPowerWeapon ?? false) ? 10 : 5) : 0;
  const viciousBonus = (isCritical && (weapon.vicious ?? false)) ? 5 : 0;
  const critBonus = (aimingAtVitals ? critBonusBase * 2 : critBonusBase) + viciousBonus;
  // Payload: weapon's built-in Toxic Payload (Yanari MP, Hercules 3AX) OR ammo name
  const weaponPayloadBonus = penetratesWithoutBonus ? (Number(weapon.payloadDmgBonus) || 0) : 0;
  // Incendiary ammo: +2 on penetration. Explosive (Concussive MA70): +2 regardless.
  // Toxic ammo: +2 on penetration (only when weapon has no built-in payload bonus).
  const ammoPayloadBonus = (isIncendiaryAmmo && penetratesWithoutBonus ? 2 : 0)
    + (isExplosiveAmmo ? 2 : 0)
    + (!weapon.payloadDmgBonus && isToxicAmmo && penetratesWithoutBonus ? 2 : 0);
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
  // Accidental Discharge (Strigoi): +1 bonus per damage die on odd SS attack die
  const accidentalDischargeDmgBonus = accidentalDischargeBonusDice * damageDiceCount;
  // SR Capacity (Militech SR Capacity mod): +2 electrical damage on charged TW
  // hit that bypasses SP. Applies even if penetration was only due to charge ½ SP.
  const hasSRCapacityMod = isCharged && installedMods.some((m) => m.srCapacity);
  const srCapacityBonus = (hasSRCapacityMod && penetratesWithoutBonus) ? 2 : 0;
  // Silencer: -1 per damage die (applied last, after other bonuses)
  const silencerDmgReduction = installedMods.some((m) => m.reduceDmgPerDie) ? damageDiceCount : 0;

  // Charged TW: count wall intersections; each reduces damage by 10.
  const chargeWallCount = isCharged
    ? countWallsBetweenTokens(attackerToken, targetToken)
    : 0;
  const chargeWallReduction = chargeWallCount * 10;

  // Base final damage (goes through SP as normal)
  const finalDamage = Math.max(
    0,
    damageRoll.total + critBonus + vitalsBonus + targetedShotBonus + payloadBonus + synergyBonus + improvedRicochetBonus + accidentalDischargeDmgBonus + srCapacityBonus - silencerDmgReduction - chargeWallReduction,
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
  if (isCharged) bonusNotes.push(game.i18n.format('CYBER_BLUE.Combat.ChargedShot', { sp: rawSP ?? 0, halfSp: sp ?? 0 }));
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
  if (viciousBonus) bonusNotes.push(game.i18n.localize('CYBER_BLUE.Combat.ViciousBonus'));
  if (accidentalDischargeDmgBonus) bonusNotes.push(game.i18n.format('CYBER_BLUE.Combat.AccidentalDischargeDmg', { n: accidentalDischargeDmgBonus }));
  if (srCapacityBonus) bonusNotes.push(game.i18n.localize('CYBER_BLUE.Combat.SRCapacityBonus'));
  if (hasBurningEdge && rawSP !== null && rawSP < 11) bonusNotes.push(game.i18n.format('CYBER_BLUE.Combat.BurningEdge', { sp: rawSP }));
  if (silencerDmgReduction) bonusNotes.push(game.i18n.format('CYBER_BLUE.Combat.SilencerReduction', { n: silencerDmgReduction }));
  if (chargeWallReduction) bonusNotes.push(game.i18n.format('CYBER_BLUE.Combat.ChargeWallReduction', { walls: chargeWallCount, dmg: chargeWallReduction }));
  if (vitalsExtraRoll) bonusNotes.push(`${game.i18n.localize('CYBER_BLUE.Combat.HighlightedVitalsRoll')}: [${vitalsExtraRoll.total}]${highlightedVitalsAutoCrit ? ' ★' : ''}`);
  const totalBonus = critBonus + vitalsBonus + targetedShotBonus + payloadBonus + synergyBonus + improvedRicochetBonus + accidentalDischargeDmgBonus + srCapacityBonus - silencerDmgReduction - chargeWallReduction;
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

  const targetVitalsLine = (targetVitals || isTargetingVehicleVital)
    ? `<p class="target-vitals-note"><i class="fas fa-crosshairs"></i> ${game.i18n.localize(isTargetingVehicleVital ? 'CYBER_BLUE.VehicleVitals.TargetVitalAreaHint' : 'CYBER_BLUE.Combat.TargetVitalsActive')}</p>`
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

      // ── Solo Damage Deflection: reduce first damage received this turn ───
      // If the target has an active AE with flags.cyberpunk-blue.soloDamageDeflection
      // (numeric value = reduction amount), and their combatant hasn't used it
      // this turn, reduce effectiveFinalDamage by that amount (minimum 0).
      let actualDamage = effectiveFinalDamage;
      const defenderCombatant = targetActor
        ? (game.combat?.combatants.find((c) => c.actor?.id === targetActor.id) ?? null)
        : null;
      if (defenderCombatant) {
        const dts = getTurnState(defenderCombatant);
        if (!dts.damageDeflectionUsed) {
          const deflection = getActiveAEFlag(targetActor, 'soloDamageDeflection');
          if (deflection > 0) {
            actualDamage = Math.max(0, effectiveFinalDamage - deflection);
            await markDamageDeflectionUsed(defenderCombatant);
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: targetActor }),
              content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-shield-halved"></i> <strong>Solo Damage Deflection</strong> — ${deflection} damage deflected (${effectiveFinalDamage} → ${actualDamage}).</p></div>`,
            });
          }
        }
      }

      if (vitalSubsystemActive) {
        // Route raw damage to the linked vital-area subsystem's own HP/SP pools.
        // The subsystem applies its own SP ablation, so the vehicle's main armour
        // is untouched (no extra Armor-Piercing ablation against main SP).
        await applyDamageToSubsystemWithPermission(targetActor, vitalSubsystem.id, actualDamage);
      } else {
        await applyDamageWithPermission(targetActor, actualDamage);
        // Armor Piercing: ablate 1 extra SP (Tactician slug)
        if ((weapon.armorPiercing ?? false) && ablatesArmor) {
          await ablateArmorExtraWithPermission(targetActor);
        }
      }
      if (isCritical) {
        if (targetActor.type === 'vehicle') {
          await rollVehicleCriticalWithPermission(targetActor, targetToken, targetVehicleVitalRegionId);
        } else {
          await rollCriticalInjuryWithPermission(targetActor, tableType, { attackerActor: attacker, weaponFlags });
        }
      }
      // ── Electric Charge (Kendachi RA-5 Powered Knife) ──────────────────────
      // On a hit that deals net damage, if the weapon has charges remaining:
      // target must pass DV 15 TECH + Endurance or take 2d6 direct HP damage.
      if ((weapon.electricCharge ?? false) && netDamage > 0) {
        const chargeKey = `electricCharge-${weaponIndex}`;
        const chargesRemaining = item.getFlag('cyberpunk-blue', chargeKey) ?? (weapon.electricChargeMax ?? 0);
        if (chargesRemaining > 0) {
          await item.setFlag('cyberpunk-blue', chargeKey, chargesRemaining - 1);
          const targetTech = targetActor.system?.stats?.tech?.value ?? 0;
          const targetEndurance = targetActor.system?.skills?.endurance?.level ?? 0;
          const ecRoll = await new Roll('1d10 + @tech + @end', { tech: targetTech, end: targetEndurance }).evaluate();
          if (ecRoll.total >= 15) {
            await ecRoll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: targetActor }),
              flavor: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-bolt"></i> ${game.i18n.format('CYBER_BLUE.Combat.ElectricChargeResisted', { target: targetActor.name, roll: ecRoll.total, dv: 15 })}</p></div>`,
              rollMode: game.settings.get('core', 'rollMode'),
            });
          } else {
            const shockRoll = await new Roll('2d6').evaluate();
            await ecRoll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: targetActor }),
              flavor: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-bolt"></i> ${game.i18n.format('CYBER_BLUE.Combat.ElectricChargeFailed', { target: targetActor.name, roll: ecRoll.total, dv: 15 })}</p></div>`,
              rollMode: game.settings.get('core', 'rollMode'),
            });
            await shockRoll.toMessage({
              speaker: ChatMessage.getSpeaker({ actor: targetActor }),
              flavor: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-bolt"></i> ${game.i18n.format('CYBER_BLUE.Combat.ElectricChargeDamage', { target: targetActor.name, dmg: shockRoll.total })}</p></div>`,
              rollMode: game.settings.get('core', 'rollMode'),
            });
            await applyDamageWithPermission(targetActor, shockRoll.total);
          }
          if (chargesRemaining - 1 === 0) {
            ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: attacker }),
              content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-battery-empty"></i> ${game.i18n.format('CYBER_BLUE.Combat.ElectricChargeDepleted', { weapon: item.name })}</p></div>`,
            });
          }
        }
      }
    }
  } else {
    await damageRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      flavor: damageFlavorHtml,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }

  // ── Tech Weapon charge: clear charge on attack ───────────────────────────
  if (isCharged) {
    await clearWeaponCharge(attacker, item, weaponIndex, false);
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-bolt-lightning"></i> ${game.i18n.format('CYBER_BLUE.Combat.ChargeExpendedOnAttack', { weapon: item.name })}</p></div>`,
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

  // ── Applied toxins (weapon-coated affliction Mods) ────────────────────────
  // A coated toxin is delivered when the attack draws blood (hit penetrates SP).
  if (hit && targetActor && netDamage > 0) {
    const toxinMods = installedMods.filter((m) => m.appliesAffliction);
    for (const m of toxinMods) {
      const modDoc = attacker.items.get(m._docId);
      if (modDoc) await resolveAppliedAffliction(attacker, modDoc, targetActor);
    }
  }

  // ── Scatter (Brunswick AR-9 single-shot) ─────────────────────────────────
  if ((weapon.scatter ?? false) && attackerToken && targetToken) {
    await resolveScatterEffect(attacker, attackerToken, targetToken, finalDamage, damageRoll, weaponLabel);
  }

  // ── Shockwave (Kang Tao Mámù): BODY < 8 target pushed 2m ────────────────
  if (hit && (weapon.shockwave ?? false) && targetActor) {
    const targetBody = targetActor.system?.stats?.body?.value ?? 0;
    if (targetBody < 8) {
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-wind"></i> <strong>${game.i18n.localize('CYBER_BLUE.Combat.Shockwave')}</strong> — ${game.i18n.format('CYBER_BLUE.Combat.ShockwavePush', { target: targetActor.name, dist: 2 })}</p></div>`,
      });
    }
  }

  // ── Heavy Recoil (Rostovic Kolac): attacker BODY < 8 takes 1d6 to HP ────
  if ((weapon.heavyRecoil ?? false) && attackerBody < 8) {
    const recoilRoll = await new Roll('1d6').evaluate();
    await recoilRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      flavor: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Combat.HeavyRecoil')}</h3><p>${game.i18n.format('CYBER_BLUE.Combat.HeavyRecoilDamage', { name: attacker.name, dmg: recoilRoll.total })}</p></div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });
    await applyDamageWithPermission(attacker, recoilRoll.total);
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
    suppressNextFailSound();
    playUiSound('gun-empty');
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

  // ── Solo Precision Attack: +1 to all attacks per 3 pts allocated ─────────
  const autofirePrecisionBonus = getActiveAEFlag(attacker, 'soloPrecisionAttack') ?? 0;

  playSfx('autofire');

  // Roll attack using custom formula (skill override + recoil mod bonus)
  const autofireTotal = totalBonus + autofirePrecisionBonus;
  const formula = modRecoilBonus !== 0
    ? `1d10 + ${autofireTotal} + ${modRecoilBonus}`
    : `1d10 + ${autofireTotal}`;
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
  if (!hit) {
    // ── Chomp Ammo: stick on autofire miss by ≤ 5 ─────────────────────────
    if ((weapon.chompAmmo ?? false) && targetToken && resolvedDV !== null && (resolvedDV - attackRoll.total) <= 5) {
      await _setChompPending(attacker, targetToken);
    }
    return;
  }

  // ── Chomp Ammo: stick on autofire hit ──────────────────────────────────
  if ((weapon.chompAmmo ?? false) && targetToken) {
    await _setChompPending(attacker, targetToken);
  }

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

// ── Double Lock (Tsunami Kappa) ───────────────────────────────────────────────
// Spend 4 ammo for a single attack roll vs both targets (must be ≤ 6m apart).
// Roll once; apply the result — hit or miss — independently vs each target's DV.
export async function resolveDoubleLockAttack(attacker, item, weaponIndex) {
  const effectiveWeapons = item.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(item);
  const weapon = effectiveWeapons[weaponIndex];
  if (!weapon) return;

  const AMMO_COST = 4;
  const currentAmmo = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
  if (currentAmmo < AMMO_COST) {
    ui.notifications.warn(game.i18n.format('CYBER_BLUE.Combat.DoubleLockNotEnoughAmmo', { cost: AMMO_COST, ammo: currentAmmo }));
    return;
  }

  // Gather targets (exactly 2 required)
  const targets = [...game.user.targets];
  if (targets.length !== 2) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.DoubleLockNeedTwoTargets'));
    return;
  }

  const [tokenA, tokenB] = targets;
  const actorA = tokenA.actor;
  const actorB = tokenB.actor;

  // Warn if targets are more than 6m apart
  const gridSize = canvas.grid.size;
  const axA = tokenA.document.x + (tokenA.document.width * gridSize) / 2;
  const ayA = tokenA.document.y + (tokenA.document.height * gridSize) / 2;
  const axB = tokenB.document.x + (tokenB.document.width * gridSize) / 2;
  const ayB = tokenB.document.y + (tokenB.document.height * gridSize) / 2;
  const targetDist = Math.hypot(axA - axB, ayA - ayB) / gridSize;
  const gridDistance = canvas.scene.grid?.distance ?? 1;
  const gridUnits = (canvas.scene.grid?.units ?? '').toLowerCase().trim();
  const metersPerUnit = ['m', 'meter', 'meters'].includes(gridUnits) ? gridDistance : 2;
  const targetDistMeters = targetDist * metersPerUnit;
  if (targetDistMeters > 6) {
    ui.notifications.warn(game.i18n.format('CYBER_BLUE.Combat.DoubleLockTooFarApart', { dist: targetDistMeters.toFixed(1) }));
    return;
  }

  const definition = getWeaponTypeDefinition(weapon.type);
  const skillSlug = CONFIG.CYBER_BLUE.skills[weapon.skill] ? weapon.skill
    : (item.system.weapons?.[weaponIndex]?.skill ?? weapon.skill);

  // DV for each target from range table
  const attackerToken = attacker.getActiveTokens()[0];
  function distTo(tok) {
    if (!attackerToken || !canvas?.scene || !canvas?.grid) return null;
    const px = attackerToken.document.x + (attackerToken.document.width * gridSize) / 2;
    const py = attackerToken.document.y + (attackerToken.document.height * gridSize) / 2;
    const tx = tok.document.x + (tok.document.width * gridSize) / 2;
    const ty = tok.document.y + (tok.document.height * gridSize) / 2;
    return (Math.hypot(px - tx, py - ty) / gridSize) * metersPerUnit;
  }

  const distA = distTo(tokenA);
  const distB = distTo(tokenB);
  const dvA = distA !== null ? getDvForRange(definition, distA) : null;
  const dvB = distB !== null ? getDvForRange(definition, distB) : null;

  if (dvA === 0 || dvB === 0) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.OutOfRange'));
    return;
  }

  // Check for jammed weapon
  if (item.getFlag('cyberpunk-blue', `jammed-${weaponIndex}`)) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.WeaponJammed'));
    return;
  }

  // Installed mod bonuses (non-AF recoil only)
  const installedMods = getInstalledWeaponMods(item, weaponIndex, attacker);
  const modRecoilBonus = installedMods.reduce((sum, m) => sum + (!m.recoilAFOnly ? (m.recoilBonus ?? 0) : 0), 0);

  const spA = actorA ? (actorA.system?.resources?.armor?.value ?? 0) : null;
  const spB = actorB ? (actorB.system?.resources?.armor?.value ?? 0) : null;

  const dialogContent = `
    <div class="cyberpunk-blue" style="padding:0.5rem;">
      <p><strong>${game.i18n.localize('CYBER_BLUE.Combat.DoubleLock')}</strong> — ${game.i18n.format('CYBER_BLUE.Combat.DoubleLockAmmoCost', { cost: AMMO_COST })}</p>
      <p>${actorA?.name ?? tokenA.name}${spA !== null ? ` (SP ${spA})` : ''}${dvA !== null ? ` — DV ${dvA}` : ''}</p>
      <p>${actorB?.name ?? tokenB.name}${spB !== null ? ` (SP ${spB})` : ''}${dvB !== null ? ` — DV ${dvB}` : ''}</p>
    </div>`;

  let confirmed = false;
  try {
    confirmed = await new Promise((resolve) => {
      const dialog = new foundry.applications.api.DialogV2({
        window: { title: `${game.i18n.localize('CYBER_BLUE.Combat.DoubleLock')}: ${item.name}` },
        content: dialogContent,
        buttons: [
          { action: 'roll', icon: 'fa-solid fa-dice-d10', label: game.i18n.localize('CYBER_BLUE.Combat.RollAttack'), default: true, callback: () => true },
          { action: 'cancel', icon: 'fa-solid fa-xmark', label: game.i18n.localize('CYBER_BLUE.Sheet.Labels.Cancel'), callback: () => false },
        ],
        submit: resolve,
      });
      dialog.addEventListener('close', () => resolve(false), { once: true });
      dialog.render(true);
    });
  } catch {
    return;
  }
  if (!confirmed) return;

  // Consume 4 ammo
  await item.update(buildWeaponUpdate(item, weaponIndex, { ammoCurrent: currentAmmo - AMMO_COST }));

  // Roll once (use primary target DV — lower DV = easier = more favourable for single-roll)
  const primaryDV = dvA !== null && dvB !== null ? Math.min(dvA, dvB) : (dvA ?? dvB);
  const attackRoll = await attacker.rollSkill({ skillSlug, dv: primaryDV, modifier: modRecoilBonus });

  // Determine hits
  const hitA = dvA === null || attackRoll.total >= dvA;
  const hitB = dvB === null || attackRoll.total >= dvB;

  const summaryLines = [
    `${actorA?.name ?? tokenA.name}: ${hitA ? `<strong>${game.i18n.localize('CYBER_BLUE.Combat.Hit')}</strong>` : game.i18n.localize('CYBER_BLUE.Combat.Miss')}`,
    `${actorB?.name ?? tokenB.name}: ${hitB ? `<strong>${game.i18n.localize('CYBER_BLUE.Combat.Hit')}</strong>` : game.i18n.localize('CYBER_BLUE.Combat.Miss')}`,
  ];
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `<div class="cyberpunk-blue chat-card"><h3><i class="fas fa-crosshairs"></i> ${game.i18n.localize('CYBER_BLUE.Combat.DoubleLock')}</h3><p>${summaryLines.join('<br>')}</p></div>`,
  });

  if (!hitA && !hitB) return;

  const baseDamageFormula = weapon.damage ?? definition.damage ?? '1d6';
  const damageRoll = await new Roll(baseDamageFormula).evaluate();

  // Apply to each target that was hit
  for (const [hit, actor, sp] of [[hitA, actorA, spA], [hitB, actorB, spB]]) {
    if (!hit || !actor) continue;
    const netDmg = sp !== null ? Math.max(damageRoll.total - sp, 0) : damageRoll.total;
    if (netDmg > 0) {
      const result = await confirmDamageDialog({
        targetActor: actor, finalDamage: damageRoll.total, sp, netDamage: netDmg,
        ablatesArmor: sp !== null && damageRoll.total >= sp, isCritical: false, critDiceCount: 0,
      });
      if (result?.confirmed) {
        await damageRoll.toMessage({
          speaker: ChatMessage.getSpeaker({ actor: attacker }),
          flavor: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-crosshairs"></i> ${game.i18n.format('CYBER_BLUE.Combat.DoubleLockDamage', { target: actor.name })}</p></div>`,
          rollMode: game.settings.get('core', 'rollMode'),
        });
        await applyDamageWithPermission(actor, netDmg);
      }
    }
  }
}
