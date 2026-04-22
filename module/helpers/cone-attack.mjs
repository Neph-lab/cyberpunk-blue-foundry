import { getWeaponTypeDefinition } from './combat.mjs';
import { getEffectiveItemWeapons } from './mods.mjs';

function getPixelsPerMeter() {
  const gridSize = canvas.grid.size;
  const gridDistance = canvas.scene.grid?.distance ?? 1;
  const gridUnits = (canvas.scene.grid?.units ?? '').toLowerCase().trim();
  const metersPerUnit = ['m', 'meter', 'meters'].includes(gridUnits) ? gridDistance : 2;
  return gridSize / metersPerUnit;
}

function getTokenCenter(tokenDoc) {
  const gridSize = canvas.grid.size;
  return {
    x: tokenDoc.x + (tokenDoc.width * gridSize) / 2,
    y: tokenDoc.y + (tokenDoc.height * gridSize) / 2,
  };
}

function isBlockedByWalls(origin, destination) {
  try {
    return canvas.walls.checkCollision(
      new Ray({ x: origin.x, y: origin.y }, { x: destination.x, y: destination.y }),
      { type: 'move', mode: 'any' }
    );
  } catch {
    return false;
  }
}

function drawConeGraphics(graphics, ax, ay, spreadPx, halfDamagePx, halfAngleRad, directionRad) {
  graphics.clear();

  const startAngle = directionRad - halfAngleRad;
  const endAngle = directionRad + halfAngleRad;

  if (halfDamagePx > 0 && halfDamagePx < spreadPx) {
    // Full-damage inner zone (brighter orange)
    graphics.beginFill(0xff8c00, 0.45);
    graphics.lineStyle(2, 0xff8c00, 1);
    graphics.moveTo(ax, ay);
    graphics.lineTo(ax + halfDamagePx * Math.cos(startAngle), ay + halfDamagePx * Math.sin(startAngle));
    graphics.arc(ax, ay, halfDamagePx, startAngle, endAngle);
    graphics.closePath();
    graphics.endFill();

    // Half-damage outer ring (dimmer red-orange)
    graphics.beginFill(0xff4500, 0.25);
    graphics.lineStyle(2, 0xff6600, 0.8);
    graphics.moveTo(ax + halfDamagePx * Math.cos(startAngle), ay + halfDamagePx * Math.sin(startAngle));
    graphics.arc(ax, ay, halfDamagePx, startAngle, endAngle);
    graphics.arc(ax, ay, spreadPx, endAngle, startAngle, true);
    graphics.closePath();
    graphics.endFill();
  } else {
    // Single zone
    graphics.beginFill(0xff6600, 0.35);
    graphics.lineStyle(2, 0xff8c00, 1);
    graphics.moveTo(ax, ay);
    graphics.lineTo(ax + spreadPx * Math.cos(startAngle), ay + spreadPx * Math.sin(startAngle));
    graphics.arc(ax, ay, spreadPx, startAngle, endAngle);
    graphics.closePath();
    graphics.endFill();
  }
}

async function placeConeOverlay(ax, ay, spreadPx, halfDamagePx, angleDeg) {
  return new Promise((resolve) => {
    const graphics = new PIXI.Graphics();
    graphics.eventMode = 'static';
    graphics.hitArea = new PIXI.Rectangle(-1e6, -1e6, 2e6, 2e6);
    canvas.stage.addChild(graphics);

    const halfAngleRad = (angleDeg * Math.PI / 180) / 2;
    let currentAngle = 0;

    drawConeGraphics(graphics, ax, ay, spreadPx, halfDamagePx, halfAngleRad, currentAngle);

    function cleanup() {
      graphics.off('pointermove', onMove);
      graphics.off('pointerdown', onDown);
      canvas.stage.removeChild(graphics);
      graphics.destroy();
    }

    const onMove = (event) => {
      const pos = event.getLocalPosition(canvas.stage);
      currentAngle = Math.atan2(pos.y - ay, pos.x - ax);
      drawConeGraphics(graphics, ax, ay, spreadPx, halfDamagePx, halfAngleRad, currentAngle);
    };

    const onDown = (event) => {
      if (event.button === 0) {
        cleanup();
        resolve(currentAngle);
      } else if (event.button === 2) {
        cleanup();
        resolve(null);
      }
    };

    graphics.on('pointermove', onMove);
    graphics.on('pointerdown', onDown);
  });
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
    flavor: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Combat.EvasionRoll')}: ${targetActor.name}</h3><p>RFLX ${rflx} + ${game.i18n.localize('CYBER_BLUE.Combat.EvasionSkill')} ${evasionRank}</p></div>`,
    rollMode: game.settings.get('core', 'rollMode'),
  });
  return roll;
}

export async function resolveConeAttack(attacker, item, weaponIndex) {
  const effectiveWeapons = item.getEffectiveWeapons?.() ?? getEffectiveItemWeapons(item);
  const weapon = effectiveWeapons[weaponIndex];
  if (!weapon) return;

  const definition = getWeaponTypeDefinition(weapon.type);
  const skillSlug = CONFIG.CYBER_BLUE.skills[weapon.skill] ? weapon.skill
    : (item.system.weapons?.[weaponIndex]?.skill ?? weapon.skill);

  const attackerToken = attacker.getActiveTokens()[0];
  if (!attackerToken) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.NeedActiveToken'));
    return;
  }

  const spread = weapon.coneSpread ?? 0;
  const angleDeg = weapon.coneAngle ?? 45;
  const halfDamageDistance = weapon.coneHalfDamageDistance ?? 0;

  if (spread <= 0) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.ConeNoSpread'));
    return;
  }

  const pixelsPerMeter = getPixelsPerMeter();
  const spreadPx = spread * pixelsPerMeter;
  const halfDamagePx = halfDamageDistance * pixelsPerMeter;
  const halfAngleRad = (angleDeg * Math.PI / 180) / 2;

  const attackerCenter = getTokenCenter(attackerToken.document);

  ui.notifications.info(game.i18n.localize('CYBER_BLUE.Combat.ConeAimPrompt'));
  const confirmedAngle = await placeConeOverlay(attackerCenter.x, attackerCenter.y, spreadPx, halfDamagePx, angleDeg);
  if (confirmedAngle === null) return;

  // Roll attack
  const attackRoll = await attacker.rollSkill({ skillSlug });
  const attackTotal = attackRoll.total;

  // Consume ammo (shots)
  const shots = item.system.weapons?.[weaponIndex]?.shots ?? weapon.shots ?? 0;
  if (shots > 0) {
    const currentAmmo = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
    await item.update({ [`system.weapons.${weaponIndex}.ammoCurrent`]: Math.max(currentAmmo - shots, 0) });
  }

  // Find tokens in cone
  const targets = [];
  for (const token of canvas.tokens.objects?.children ?? []) {
    if (token === attackerToken || !token.actor) continue;

    const tc = getTokenCenter(token.document);
    const dx = tc.x - attackerCenter.x;
    const dy = tc.y - attackerCenter.y;
    const dist = Math.hypot(dx, dy);

    if (dist > spreadPx) continue;

    // Angle check
    const tokenAngle = Math.atan2(dy, dx);
    let angleDiff = Math.abs(tokenAngle - confirmedAngle);
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
    if (angleDiff > halfAngleRad) continue;

    // Wall collision check
    if (isBlockedByWalls(attackerCenter, tc)) continue;

    const distMeters = dist / pixelsPerMeter;
    const isFullDamage = halfDamageDistance <= 0 || distMeters <= halfDamageDistance;
    targets.push({ token, actor: token.actor, isFullDamage, distMeters });
  }

  if (targets.length === 0) {
    ui.notifications.info(game.i18n.localize('CYBER_BLUE.Combat.ConeNoTargets'));
    return;
  }

  const damageFormula = weapon.damage ?? definition.damage ?? '1d6';
  const damageRoll = await new Roll(damageFormula).evaluate();
  const baseDamage = damageRoll.total;

  const weaponLabel = (item.system.weapons?.length ?? 0) > 1
    ? `${item.name} - ${definition.label}`
    : item.name;

  await damageRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    flavor: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Combat.ConeDamage')}: ${weaponLabel}</h3><p>${game.i18n.format('CYBER_BLUE.Combat.ConeTargetCount', { count: targets.length })}</p></div>`,
    rollMode: game.settings.get('core', 'rollMode'),
  });

  for (const { actor: targetActor, isFullDamage } of targets) {
    const evasionRoll = await rollTargetEvasion(targetActor);
    const evaded = evasionRoll.total > attackTotal;

    let damage = baseDamage;
    if (!isFullDamage) damage = Math.ceil(damage / 2);
    if (evaded) damage = Math.ceil(damage / 2);

    const sp = targetActor.system?.resources?.armor?.value ?? 0;
    const netDamage = Math.max(damage - sp, 0);
    const ablatesArmor = damage >= sp && sp > 0;

    const zone = isFullDamage
      ? game.i18n.localize('CYBER_BLUE.Combat.ConeFullDamage')
      : game.i18n.localize('CYBER_BLUE.Combat.ConeHalfDamage');
    const evasionNote = evaded ? ` (${game.i18n.localize('CYBER_BLUE.Combat.Evaded')})` : '';

    const confirmContent = `<p><strong>${targetActor.name}</strong> — ${zone}${evasionNote}</p>`
      + `<p>${game.i18n.localize('CYBER_BLUE.Combat.SP')}: ${sp} → ${game.i18n.localize('CYBER_BLUE.Combat.NetDamage')}: <strong>${netDamage}</strong>${ablatesArmor ? ' (SP -1)' : ''}</p>`;

    if (netDamage > 0 || ablatesArmor) {
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: game.i18n.localize('CYBER_BLUE.Combat.ApplyDamage') },
        content: `<div class="cyberpunk-blue">${confirmContent}</div>`,
      });
      if (confirmed) await targetActor.applyDamage(damage);
    }
  }
}
