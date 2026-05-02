import { buildWeaponUpdate, getWeaponTypeDefinition, COMBAT_CONFIG } from './combat.mjs';
import { getEffectiveItemWeapons } from './mods.mjs';
import { resolveConeAttack, resolveExplosionAttack, resolveAfflictionConeAttack, resolveAfflictionExplosionAttack } from './cone-attack.mjs';
import { recordCombatAttack } from './combat-tracker.mjs';
import { detectCriticalDice, confirmDamageDialog, rollCriticalInjury } from './critical-injury.mjs';
import { resolveAfflictionAttack } from './affliction-attack.mjs';

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

  // Distance and range DV
  const distanceMeters = getDistanceMeters(attacker, targetToken);
  const rangeDV = distanceMeters !== null ? getDvForRange(definition, distanceMeters) : null;

  // Abort if out of range
  if (rangeDV === 0) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.OutOfRange'));
    return;
  }

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

  const dialogContent = `
    <div class="cyberpunk-blue" style="padding:0.5rem;">
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
  // weapon.isJammed is a transient flag (item flag) set when a previous shot jammed.
  if (item.getFlag('cyberpunk-blue', `jammed-${weaponIndex}`)) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.WeaponJammed'));
    return;
  }

  // ── Minimum BODY check ────────────────────────────────────────────────────
  // HVY weapons (MG Helix, Defenders) require a BODY minimum to fire without a mount.
  const minBodyReq = Number(item.system?.minBodyReq) || 0;
  if (minBodyReq > 0) {
    const attackerBody = Number(attacker.system?.stats?.body?.value) || 0;
    if (attackerBody < minBodyReq) {
      ui.notifications.warn(game.i18n.format('CYBER_BLUE.Combat.MinBodyReqWarning', { weapon: item.name, body: attackerBody, required: minBodyReq }));
      // Continue anyway — this is a warning, not a hard block.
    }
  }

  // ── Weapon attack-roll modifier ────────────────────────────────────────────
  // Sum of: Target Vitals penalty, Smart Weapon (+1), Excellent Quality (+1).
  const targetVitals = item.getFlag('cyberpunk-blue', `targetVitals-${weaponIndex}`) ?? false;
  const targetVitalsPenalty = -(weapon.targetVitalsPenalty ?? 8);

  let attackModifier = 0;
  if (targetVitals) attackModifier += targetVitalsPenalty;
  if (weapon.isSmartWeapon) attackModifier += 1;
  if (weapon.isExcellentQuality) attackModifier += 1;

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

  // Consume ammo on attack (regardless of hit/miss)
  const shots = item.system.weapons?.[weaponIndex]?.shots ?? weapon.shots ?? 0;
  await consumeAmmo(item, weaponIndex, shots);

  const hit = resolvedDV === null || attackRoll.total >= resolvedDV;
  if (!hit) return;

  const damageFormula = weapon.damage ?? definition.damage ?? '1d6';
  const damageRoll = await new Roll(damageFormula).evaluate();

  const sp = targetSP !== null ? targetSP : null;

  // ── Critical Injury detection ──────────────────────────────────────────────
  const { count: critDiceCount } = detectCriticalDice(damageRoll);
  // Penetration check uses the original roll (before any bonus) so the bonus
  // cannot self-validate the critical trigger.
  const penetratesWithoutBonus = sp === null ? damageRoll.total > 0 : damageRoll.total > sp;
  const isCritical = critDiceCount >= 2 && penetratesWithoutBonus;

  // Target Vitals: +5 damage if any damage gets through SP (independent of crit)
  const vitalsBonus = (targetVitals && penetratesWithoutBonus) ? 5 : 0;
  const critBonus = isCritical ? 5 : 0;
  // Toxic Payload (Yanari MP, Hercules 3AX): +N damage on penetration
  const payloadBonus = (penetratesWithoutBonus && weapon.payloadDmgBonus) ? Number(weapon.payloadDmgBonus) : 0;
  const finalDamage = damageRoll.total + critBonus + vitalsBonus + payloadBonus;

  // Critical table: head when targeting vitals, body otherwise
  const tableType = targetVitals ? 'head' : 'body';

  const netDamage = sp !== null ? Math.max(finalDamage - sp, 0) : finalDamage;
  const ablatesArmor = sp !== null && finalDamage >= sp;

  const bonusNotes = [];
  if (isCritical) bonusNotes.push(game.i18n.localize('CYBER_BLUE.CriticalInjury.CritBonus'));
  if (vitalsBonus) bonusNotes.push(game.i18n.localize('CYBER_BLUE.Combat.TargetVitalsBonus'));
  if (payloadBonus) bonusNotes.push(game.i18n.format('CYBER_BLUE.Combat.PayloadBonus', { n: payloadBonus }));
  const totalBonus = critBonus + vitalsBonus + payloadBonus;
  const critLine = bonusNotes.length
    ? `<p class="crit-roll-note"><i class="fas fa-skull"></i> ${bonusNotes.join(' · ')}</p>`
    : '';
  const spLine = sp !== null
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.SP')}: ${sp} → ${game.i18n.localize('CYBER_BLUE.Combat.NetDamage')}: <strong>${netDamage}</strong>${ablatesArmor ? ' (SP -1)' : ''}${totalBonus ? ` (+${totalBonus})` : ''}</p>`
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
      await targetActor.applyDamage(finalDamage);
      if (isCritical) {
        await rollCriticalInjury(targetActor, tableType, { attackerActor: attacker });
      }
    }
  } else {
    // No applicable damage (no target or zero damage) — still show the roll result
    await damageRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      flavor: damageFlavorHtml,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }
}

export async function resolveAutofireAttack(attacker, item, weaponIndex) {
  const effectiveWeapons = item.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(item);
  const weapon = effectiveWeapons[weaponIndex];
  if (!weapon) return;

  const AUTOFIRE_AMMO_COST = 10;
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
      <p><strong>${game.i18n.localize('CYBER_BLUE.Combat.Autofire')}</strong> — ${game.i18n.format('CYBER_BLUE.Combat.AutofireConsumes', { ammo: AUTOFIRE_AMMO_COST })} | ×${multiplier}</p>
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

  // Roll attack using custom formula (skill override)
  const formula = `1d10 + ${totalBonus}`;
  const attackRoll = await (new Roll(formula)).evaluate();
  await attackRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    flavor: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Combat.Autofire')}: ${item.name}</h3>${resolvedDV !== null ? `<p>DV ${resolvedDV}</p>` : ''}</div>`,
    rollMode: game.settings.get('core', 'rollMode'),
  });

  // Consume 10 ammo
  await consumeAmmo(item, weaponIndex, AUTOFIRE_AMMO_COST);

  const hit = resolvedDV === null || attackRoll.total >= resolvedDV;
  if (!hit) return;

  const damageFormula = weapon.damage ?? definition.damage ?? '1d6';
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
  const finalDamage = isCritical ? rawDamage + 5 : rawDamage;

  const netDamage = sp !== null ? Math.max(finalDamage - sp, 0) : finalDamage;
  const ablatesArmor = sp !== null && finalDamage >= sp;

  const critLine = isCritical
    ? `<p class="crit-roll-note"><i class="fas fa-skull"></i> ${game.i18n.format('CYBER_BLUE.CriticalInjury.CritDetected', { count: critDiceCount })} ${game.i18n.localize('CYBER_BLUE.CriticalInjury.CritBonus')}</p>`
    : '';
  const spLine = sp !== null
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.SP')}: ${sp} → ${game.i18n.localize('CYBER_BLUE.Combat.NetDamage')}: <strong>${netDamage}</strong>${ablatesArmor ? ' (SP -1)' : ''}${isCritical ? ` (+5)` : ''}</p>`
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
      await targetActor.applyDamage(finalDamage);
      if (isCritical) {
        // Autofire always uses the body table
        await rollCriticalInjury(targetActor, 'body', { attackerActor: attacker });
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
