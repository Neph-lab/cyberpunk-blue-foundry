import { getWeaponTypeDefinition, COMBAT_CONFIG } from './combat.mjs';
import { getEffectiveItemWeapons } from './mods.mjs';
import { resolveConeAttack } from './cone-attack.mjs';

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
  await item.update({ [`system.weapons.${weaponIndex}.ammoCurrent`]: Math.max(currentAmmo - shots, 0) });
}

export async function resolveWeaponAttack(attacker, item, weaponIndex) {
  const effectiveWeapons = item.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(item);
  const weapon = effectiveWeapons[weaponIndex];
  if (!weapon) return;

  // Route cone attacks to their own resolver
  if ((weapon.damageType ?? '') === 'cone') {
    return resolveConeAttack(attacker, item, weaponIndex);
  }

  const definition = getWeaponTypeDefinition(weapon.type);
  const skillSlug = CONFIG.CYBER_BLUE.skills[weapon.skill] ? weapon.skill
    : (item.system.weapons?.[weaponIndex]?.skill ?? weapon.skill);

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

  const attackRoll = await attacker.rollSkill({ skillSlug, dv: resolvedDV });

  // Consume ammo on attack (regardless of hit/miss)
  const shots = item.system.weapons?.[weaponIndex]?.shots ?? weapon.shots ?? 0;
  await consumeAmmo(item, weaponIndex, shots);

  const hit = resolvedDV === null || attackRoll.total >= resolvedDV;
  if (!hit) return;

  const damageFormula = weapon.damage ?? definition.damage ?? '1d6';
  const damageRoll = await new Roll(damageFormula).evaluate();

  const sp = targetSP !== null ? targetSP : null;
  const netDamage = sp !== null ? Math.max(damageRoll.total - sp, 0) : damageRoll.total;
  const ablatesArmor = sp !== null && damageRoll.total >= sp;
  const spLine = sp !== null
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.SP')}: ${sp} → ${game.i18n.localize('CYBER_BLUE.Combat.NetDamage')}: <strong>${netDamage}</strong>${ablatesArmor ? ' (SP -1)' : ''}</p>`
    : '';

  const weaponLabel = (item.system.weapons?.length ?? 0) > 1
    ? `${item.name} - ${definition.label}`
    : item.name;

  await damageRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    flavor: `
      <div class="cyberpunk-blue chat-card">
        <h3>${game.i18n.localize('CYBER_BLUE.Sheet.Labels.Damage')}: ${weaponLabel}</h3>
        ${spLine}
      </div>`,
    rollMode: game.settings.get('core', 'rollMode'),
  });

  if (targetActor && (netDamage > 0 || ablatesArmor)) {
    const confirmContent = ablatesArmor
      ? `<p>${game.i18n.format('CYBER_BLUE.Combat.ApplyDamageWithSP', { damage: damageRoll.total, hp: netDamage, target: targetActor.name })}</p>`
      : `<p>${game.i18n.format('CYBER_BLUE.Combat.ApplyDamagePrompt', { damage: netDamage, target: targetActor.name })}</p>`;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('CYBER_BLUE.Combat.ApplyDamage') },
      content: confirmContent,
    });
    if (confirmed) {
      await targetActor.applyDamage(damageRoll.total);
    }
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
  const rawDamage = Math.round(damageRoll.total * multiplier);

  const sp = targetSP !== null ? targetSP : null;
  const netDamage = sp !== null ? Math.max(rawDamage - sp, 0) : rawDamage;
  const ablatesArmor = sp !== null && rawDamage >= sp;
  const spLine = sp !== null
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.SP')}: ${sp} → ${game.i18n.localize('CYBER_BLUE.Combat.NetDamage')}: <strong>${netDamage}</strong>${ablatesArmor ? ' (SP -1)' : ''}</p>`
    : '';

  const weaponLabel = (item.system.weapons?.length ?? 0) > 1 ? `${item.name} - ${definition.label}` : item.name;
  const multNote = multiplier !== 1 ? ` ×${multiplier} = ${rawDamage}` : '';

  await damageRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    flavor: `
      <div class="cyberpunk-blue chat-card">
        <h3>${game.i18n.localize('CYBER_BLUE.Combat.Autofire')} ${game.i18n.localize('CYBER_BLUE.Sheet.Labels.Damage')}: ${weaponLabel}</h3>
        <p>${damageFormula}${multNote}</p>
        ${spLine}
      </div>`,
    rollMode: game.settings.get('core', 'rollMode'),
  });

  if (targetActor && (netDamage > 0 || ablatesArmor)) {
    const confirmContent = ablatesArmor
      ? `<p>${game.i18n.format('CYBER_BLUE.Combat.ApplyDamageWithSP', { damage: rawDamage, hp: netDamage, target: targetActor.name })}</p>`
      : `<p>${game.i18n.format('CYBER_BLUE.Combat.ApplyDamagePrompt', { damage: netDamage, target: targetActor.name })}</p>`;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('CYBER_BLUE.Combat.ApplyDamage') },
      content: confirmContent,
    });
    if (confirmed) await targetActor.applyDamage(rawDamage);
  }
}
