import { getWeaponTypeDefinition } from './combat.mjs';
import { getEffectiveItemWeapons } from './mods.mjs';

function getTargetActor() {
  const target = game.user.targets.first();
  return target?.actor ?? null;
}

function getTargetSP(targetActor) {
  if (!targetActor) return null;
  return targetActor.system?.resources?.armor?.value ?? 0;
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

export async function resolveWeaponAttack(attacker, item, weaponIndex) {
  const effectiveWeapons = item.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(item);
  const weapon = effectiveWeapons[weaponIndex];
  if (!weapon) return;

  const definition = getWeaponTypeDefinition(weapon.type);
  const baseSkill = item.system.weapons?.[weaponIndex]?.skill ?? weapon.skill;
  const skillSlug = CONFIG.CYBER_BLUE.skills[weapon.skill] ? weapon.skill : baseSkill;
  const targetActor = getTargetActor();
  const targetSP = getTargetSP(targetActor);
  const isMelee = !definition.usesMagazine && definition.rangeTable?.every((v) => v === 0);

  const targetLine = targetActor
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.Target')}: <strong>${targetActor.name}</strong>${targetSP !== null ? ` (SP ${targetSP})` : ''}</p>`
    : '';

  let dvResult;
  try {
    dvResult = await new Promise((resolve, reject) => {
      const dialog = new foundry.applications.api.DialogV2({
        window: { title: `${game.i18n.localize('CYBER_BLUE.Combat.Attack')}: ${item.name}` },
        content: `
          <div class="cyberpunk-blue" style="padding: 0.5rem;">
            ${targetLine}
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <label>
                <span>${game.i18n.localize('CYBER_BLUE.Combat.DV')}:</span>
                <input type="number" id="attack-dv" value="" min="0" style="width: 5rem; margin-left: 0.5rem;" placeholder="—" />
              </label>
              ${(isMelee && targetActor) ? `
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                  <input type="checkbox" id="roll-evasion" />
                  <span>${game.i18n.localize('CYBER_BLUE.Combat.RollTargetEvasion')}</span>
                </label>
              ` : ''}
            </div>
          </div>
        `,
        buttons: [
          {
            action: 'roll',
            icon: 'fa-solid fa-dice-d10',
            label: game.i18n.localize('CYBER_BLUE.Combat.RollAttack'),
            default: true,
            callback: (event, button, dialog) => ({
              dv: button.form?.elements['attack-dv']?.value?.trim()
                ? Number(button.form.elements['attack-dv'].value)
                : null,
              rollEvasion: button.form?.elements['roll-evasion']?.checked ?? false,
            }),
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
  } catch (e) {
    return;
  }

  if (!dvResult) return;

  const { dv: rawDV, rollEvasion } = dvResult;

  let resolvedDV = null;
  if (rollEvasion && targetActor) {
    const evasionRoll = await rollTargetEvasion(targetActor);
    resolvedDV = evasionRoll.total;
  } else if (rawDV !== null && Number.isFinite(rawDV)) {
    resolvedDV = rawDV;
  }

  const attackRoll = await attacker.rollSkill({ skillSlug, dv: resolvedDV });
  const hit = resolvedDV === null || attackRoll.total >= resolvedDV;

  if (!hit) return;

  const damageFormula = weapon.damage ?? definition.damage ?? '1d6';
  const damageRoll = await new Roll(damageFormula).evaluate();

  const sp = (targetActor && targetSP !== null) ? targetSP : null;
  const netDamage = sp !== null ? Math.max(damageRoll.total - sp, 0) : damageRoll.total;
  const spLine = sp !== null
    ? `<p>${game.i18n.localize('CYBER_BLUE.Combat.SP')}: ${sp} → ${game.i18n.localize('CYBER_BLUE.Combat.NetDamage')}: <strong>${netDamage}</strong></p>`
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
      </div>
    `,
    rollMode: game.settings.get('core', 'rollMode'),
  });

  if (targetActor && netDamage > 0) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('CYBER_BLUE.Combat.ApplyDamage') },
      content: `<p>${game.i18n.format('CYBER_BLUE.Combat.ApplyDamagePrompt', { damage: netDamage, target: targetActor.name })}</p>`,
    });
    if (confirmed) {
      await targetActor.applyDamage(netDamage, { ignoreArmor: true });
    }
  }
}
