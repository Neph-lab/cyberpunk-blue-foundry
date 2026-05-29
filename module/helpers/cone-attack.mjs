import { buildWeaponUpdate, getWeaponTypeDefinition, COMBAT_CONFIG } from './combat.mjs';
import { playSfx } from './audio.mjs';
import { getEffectiveItemWeapons } from './mods.mjs';
import { detectCriticalDice, confirmDamageDialog, rollCriticalInjury } from './critical-injury.mjs';
import { rollAfflictionDefense, checkAfflictionSP, applyAfflictionEffect } from './affliction-attack.mjs';
import { applyDamageWithPermission, rollCriticalInjuryWithPermission } from './socket.mjs';
import { getActiveAEFlag } from './effects.mjs';
import { computeVisibilityPenalty, makeElevatedPoint } from './visibility.mjs';

// ── Explosion residue region ──────────────────────────────────────────────────

/**
 * After an explosion resolves, optionally create a persistent visibility Region
 * at the blast centre.  Called on activeGM only (visibility setting checked here).
 *
 * @param {Item}   item          the weapon item
 * @param {object} weapon        the effective weapon entry
 * @param {{x:number,y:number}} explosionCenter  pixel coordinates of blast centre
 * @param {number} spreadPx      blast radius in pixels (used as fallback residue radius)
 * @param {number} pixelsPerMeter
 */
async function createResidueRegion(item, weapon, explosionCenter, spreadPx, pixelsPerMeter) {
  if (!game.settings.get('cyberpunk-blue', 'visibilityEnabled')) return;
  if (!weapon.leavesResidue) return;
  if (game.user !== game.users.activeGM) return;

  const scene = canvas.scene;
  if (!scene) return;

  const radiusPx = weapon.residueRadius > 0
    ? weapon.residueRadius * pixelsPerMeter
    : spreadPx;

  const expiresInRounds = weapon.residueRounds ?? 3;
  const kind             = weapon.residueKind           ?? 'obscuration';
  const lightBandWidth   = weapon.residueLightBandWidth ?? 0;
  const enableNoVis      = weapon.residueEnableNoVis    ?? false;
  const noVisInset       = weapon.residueNoVisInset     ?? 0;

  let expiryData;
  if (game.combat?.started) {
    expiryData = {
      mode:           'rounds',
      combatId:       game.combat.id,
      expiresOnRound: game.combat.round + expiresInRounds,
    };
  } else {
    const deleteAt = Date.now() + expiresInRounds * 3 * 1000;
    expiryData = { mode: 'time', deleteAt };
    // Time-based expiry: use a timeout since worldTime may not advance out of combat.
    if (expiresInRounds > 0) {
      setTimeout(async () => {
        const stale = scene.regions.filter((r) => {
          const exp = r.getFlag('cyberpunk-blue', 'visibilityExpiry');
          return exp?.deleteAt === deleteAt;
        });
        for (const r of stale) {
          await r.delete().catch(() => {});
        }
      }, expiresInRounds * 3 * 1000);
    }
  }

  await scene.createEmbeddedDocuments('Region', [{
    name: `${item.name} Residue`,
    shapes: [{
      type:    'ellipse',
      x:       explosionCenter.x,
      y:       explosionCenter.y,
      radiusX: radiusPx,
      radiusY: radiusPx,
      rotation: 0,
      hole:     false,
    }],
    behaviors: [{
      type:   'visibility',
      system: {
        kind,
        lightBandWidth,
        enableNoVisibility: enableNoVis,
        noVisInset,
        expiresInRounds,
      },
    }],
    flags: {
      'cyberpunk-blue': { visibilityExpiry: expiryData },
    },
  }]);
}

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
    const RayCtor = foundry.canvas?.geometry?.Ray ?? Ray;
    return canvas.walls.checkCollision(
      new RayCtor({ x: origin.x, y: origin.y }, { x: destination.x, y: destination.y }),
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

// ─── Explosion helpers ──────────────────────────────────────────────────────

function drawExplosionGraphics(graphics, ax, ay, maxRangePx, spreadPx, halfDamagePx, targetX, targetY, inRange, losBlocked) {
  graphics.clear();
  // Max-range ring (dark grey guide)
  graphics.lineStyle(1, 0x888888, 0.5);
  graphics.drawCircle(ax, ay, maxRangePx);

  // Aim marker at cursor
  const dx = targetX - ax;
  const dy = targetY - ay;
  const dist = Math.hypot(dx, dy);
  if (dist > 0) {
    const validTarget = inRange && !losBlocked;
    const markerColor = validTarget ? 0x00ff88 : 0xff3333;
    const alpha = validTarget ? 0.9 : 0.7;
    // Target crosshair
    const cs = 12;
    graphics.lineStyle(2, markerColor, alpha);
    graphics.moveTo(targetX - cs, targetY);
    graphics.lineTo(targetX + cs, targetY);
    graphics.moveTo(targetX, targetY - cs);
    graphics.lineTo(targetX, targetY + cs);
    graphics.drawCircle(targetX, targetY, cs / 2);

    if (validTarget) {
      // Blast radius preview
      if (halfDamagePx > 0 && halfDamagePx < spreadPx) {
        graphics.beginFill(0xff8c00, 0.35);
        graphics.lineStyle(2, 0xff8c00, 0.9);
        graphics.drawCircle(targetX, targetY, halfDamagePx);
        graphics.endFill();
        graphics.beginFill(0xff4500, 0.15);
        graphics.lineStyle(1, 0xff6600, 0.6);
        graphics.drawCircle(targetX, targetY, spreadPx);
        graphics.endFill();
      } else {
        graphics.beginFill(0xff6600, 0.25);
        graphics.lineStyle(2, 0xff8c00, 0.9);
        graphics.drawCircle(targetX, targetY, spreadPx);
        graphics.endFill();
      }
    }
  }
}

async function placeExplosionPoint(ax, ay, maxRangePx, spreadPx, halfDamagePx) {
  return new Promise((resolve) => {
    const graphics = new PIXI.Graphics();
    graphics.eventMode = 'static';
    graphics.hitArea = new PIXI.Rectangle(-1e6, -1e6, 2e6, 2e6);
    canvas.stage.addChild(graphics);

    let targetX = ax;
    let targetY = ay;

    drawExplosionGraphics(graphics, ax, ay, maxRangePx, spreadPx, halfDamagePx, targetX, targetY, false, false);

    function cleanup() {
      graphics.off('pointermove', onMove);
      graphics.off('pointerdown', onDown);
      canvas.stage.removeChild(graphics);
      graphics.destroy();
    }

    const onMove = (event) => {
      const pos = event.getLocalPosition(canvas.stage);
      targetX = pos.x;
      targetY = pos.y;
      const dist = Math.hypot(pos.x - ax, pos.y - ay);
      const inRange = dist <= maxRangePx;
      const losBlocked = inRange ? isBlockedByWalls({ x: ax, y: ay }, { x: pos.x, y: pos.y }) : false;
      drawExplosionGraphics(graphics, ax, ay, maxRangePx, spreadPx, halfDamagePx, targetX, targetY, inRange, losBlocked);
    };

    const onDown = (event) => {
      if (event.button === 0) {
        const dist = Math.hypot(targetX - ax, targetY - ay);
        const inRange = dist <= maxRangePx;
        const losBlocked = inRange ? isBlockedByWalls({ x: ax, y: ay }, { x: targetX, y: targetY }) : false;
        if (!inRange || losBlocked) {
          const reason = !inRange ? game.i18n.localize('CYBER_BLUE.Combat.ExplosionOutOfRange')
            : game.i18n.localize('CYBER_BLUE.Combat.ExplosionNoLOS');
          ui.notifications.warn(reason);
          return;
        }
        cleanup();
        resolve({ x: targetX, y: targetY });
      } else if (event.button === 2) {
        cleanup();
        resolve(null);
      }
    };

    graphics.on('pointermove', onMove);
    graphics.on('pointerdown', onDown);
  });
}

function scatterPoint(origin, distMeters, pixelsPerMeter) {
  const angle = Math.random() * 2 * Math.PI;
  const maxPx = distMeters * pixelsPerMeter;
  // Walk along scatter direction until wall or max distance
  const step = pixelsPerMeter * 0.5; // 0.5m steps
  let lastX = origin.x;
  let lastY = origin.y;
  for (let traveled = step; traveled <= maxPx; traveled += step) {
    const nx = origin.x + traveled * Math.cos(angle);
    const ny = origin.y + traveled * Math.sin(angle);
    if (isBlockedByWalls({ x: lastX, y: lastY }, { x: nx, y: ny })) break;
    lastX = nx;
    lastY = ny;
  }
  return { x: lastX, y: lastY };
}

// ─── Persistent area-effect overlays ────────────────────────────────────────

/** Show the cone graphic on the canvas for N seconds after an attack resolves. */
export function showAreaEffectCone(ax, ay, spreadPx, halfDamagePx, halfAngleRad, directionRad) {
  if (!canvas?.stage) return;
  const durationSec = game.settings.get('cyberpunk-blue', 'areaEffectDuration') ?? 10;
  const graphics = new PIXI.Graphics();
  graphics.eventMode = 'none';
  canvas.stage.addChild(graphics);
  drawConeGraphics(graphics, ax, ay, spreadPx, halfDamagePx, halfAngleRad, directionRad);
  if (durationSec > 0) {
    setTimeout(() => {
      try { canvas.stage.removeChild(graphics); graphics.destroy(); } catch { /* already removed */ }
    }, durationSec * 1000);
  }
  return graphics;
}

/** Show the explosion circle on the canvas for N seconds after an attack resolves. */
export function showAreaEffectExplosion(centerX, centerY, spreadPx, halfDamagePx) {
  if (!canvas?.stage) return;
  const durationSec = game.settings.get('cyberpunk-blue', 'areaEffectDuration') ?? 10;
  const graphics = new PIXI.Graphics();
  graphics.eventMode = 'none';
  canvas.stage.addChild(graphics);
  // Draw a simple circle (reuse explosion drawing without the aim marker)
  if (halfDamagePx > 0 && halfDamagePx < spreadPx) {
    graphics.beginFill(0xff8c00, 0.35);
    graphics.lineStyle(2, 0xff8c00, 0.9);
    graphics.drawCircle(centerX, centerY, halfDamagePx);
    graphics.endFill();
    graphics.beginFill(0xff4500, 0.15);
    graphics.lineStyle(1, 0xff6600, 0.6);
    graphics.drawCircle(centerX, centerY, spreadPx);
    graphics.endFill();
  } else {
    graphics.beginFill(0xff6600, 0.25);
    graphics.lineStyle(2, 0xff8c00, 0.9);
    graphics.drawCircle(centerX, centerY, spreadPx);
    graphics.endFill();
  }
  if (durationSec > 0) {
    setTimeout(() => {
      try { canvas.stage.removeChild(graphics); graphics.destroy(); } catch { /* already removed */ }
    }, durationSec * 1000);
  }
  return graphics;
}

export async function resolveExplosionAttack(attacker, item, weaponIndex) {
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

  // Upfront ammo check: weapon must have at least `shots` ammo to fire
  const shotsRequiredExp = item.system.weapons?.[weaponIndex]?.shots ?? weapon.shots ?? 0;
  if (shotsRequiredExp > 0) {
    const currentAmmoExp = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
    if (currentAmmoExp < shotsRequiredExp) {
      ui.notifications.warn(game.i18n.format('CYBER_BLUE.Combat.NotEnoughAmmoForShots', { required: shotsRequiredExp, current: currentAmmoExp }));
      return;
    }
  }

  const spread = weapon.coneSpread ?? 0;
  const halfDamageDistance = weapon.coneHalfDamageDistance ?? 0;
  if (spread <= 0) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.ExplosionNoSpread'));
    return;
  }

  // Find max weapon range from range table
  const rangeTable = weapon.rangeTable ?? [];
  const maxRangeIndex = rangeTable.reduce((best, dv, i) => (dv > 0 ? i : best), -1);
  const rangeBands = COMBAT_CONFIG.rangeBands ?? [];
  const maxRangeMeters = maxRangeIndex >= 0 ? (rangeBands[maxRangeIndex]?.max ?? 100) : 100;

  const pixelsPerMeter = getPixelsPerMeter();
  const maxRangePx = maxRangeMeters * pixelsPerMeter;
  const spreadPx = spread * pixelsPerMeter;
  const halfDamagePx = halfDamageDistance * pixelsPerMeter;

  const attackerCenter = getTokenCenter(attackerToken.document);

  ui.notifications.info(game.i18n.localize('CYBER_BLUE.Combat.ExplosionAimPrompt'));
  const aimPoint = await placeExplosionPoint(attackerCenter.x, attackerCenter.y, maxRangePx, spreadPx, halfDamagePx);
  if (aimPoint === null) return;

  // Determine DV from range table at aimed distance
  const aimedDistMeters = Math.hypot(aimPoint.x - attackerCenter.x, aimPoint.y - attackerCenter.y) / pixelsPerMeter;
  let resolvedDV = null;
  for (let i = 0; i < rangeBands.length; i++) {
    const band = rangeBands[i];
    if (aimedDistMeters <= (band.max ?? Infinity) && rangeTable[i] > 0) {
      resolvedDV = rangeTable[i];
      break;
    }
  }
  if (resolvedDV === null) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.OutOfRange'));
    return;
  }

  // ── Visibility check at aim point ─────────────────────────────────────────
  const aimPtElev = makeElevatedPoint(aimPoint.x, aimPoint.y, attackerToken.document.elevation ?? 0);
  const _expVis = computeVisibilityPenalty(attacker, attackerToken, null, aimPtElev);
  if (_expVis.blocked) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="cyberpunk-blue chat-card">
        <h3><i class="fas fa-eye-slash"></i> ${game.i18n.localize('CYBER_BLUE.Visibility.BlockedTitle')}</h3>
        <p>${_expVis.notes.join(' ')}</p>
      </div>`,
    });
    return;
  }

  // Roll attack
  playSfx('explosion');
  const precisionBonus = (getActiveAEFlag(attacker, 'soloPrecisionAttack') ?? 0) + _expVis.penalty;
  const attackRoll = await attacker.rollSkill({ skillSlug, modifier: precisionBonus });
  const hit = attackRoll.total >= resolvedDV;

  // Consume ammo
  const shots = item.system.weapons?.[weaponIndex]?.shots ?? weapon.shots ?? 0;
  if (shots > 0) {
    const currentAmmo = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
    await item.update(buildWeaponUpdate(item, weaponIndex, { ammoCurrent: Math.max(currentAmmo - shots, 0) }));
  }

  // Determine explosion centre (hit or scatter)
  let explosionCenter = aimPoint;
  if (!hit) {
    const scatter = 1 + Math.max(0, resolvedDV - attackRoll.total);
    explosionCenter = scatterPoint(aimPoint, scatter, pixelsPerMeter);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Combat.ExplosionScatter')}</h3>`
        + `<p>${game.i18n.format('CYBER_BLUE.Combat.ExplosionScatterDist', { dist: scatter })}</p></div>`,
    });
    // ── Homing Guidance (Dojigiri RL smart): missed by ≤ 7 → guidance message ─
    if ((weapon.isSmartWeapon ?? false) && resolvedDV !== null && (resolvedDV - attackRoll.total) <= 7) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-satellite-dish"></i> ${game.i18n.format('CYBER_BLUE.Combat.HomingGuidance', { weapon: item.name, scatter })}</p></div>`,
      });
    }
  }

  // Show persistent area graphic now that the explosion centre is finalised
  showAreaEffectExplosion(explosionCenter.x, explosionCenter.y, spreadPx, halfDamagePx);
  await createResidueRegion(item, weapon, explosionCenter, spreadPx, pixelsPerMeter);

  // Find tokens in blast radius
  const targets = [];
  for (const token of canvas.tokens.objects?.children ?? []) {
    if (token === attackerToken || !token.actor) continue;
    const tc = getTokenCenter(token.document);
    const dx = tc.x - explosionCenter.x;
    const dy = tc.y - explosionCenter.y;
    const dist = Math.hypot(dx, dy);
    if (dist > spreadPx) continue;
    if (isBlockedByWalls(explosionCenter, tc)) continue;
    const distMeters = dist / pixelsPerMeter;
    const isFullDamage = halfDamageDistance <= 0 || distMeters <= halfDamageDistance;
    targets.push({ token, actor: token.actor, isFullDamage, distMeters });
  }

  if (targets.length === 0) {
    ui.notifications.info(game.i18n.localize('CYBER_BLUE.Combat.ExplosionNoTargets'));
    return;
  }

  const damageFormula = weapon.damage ?? definition.damage ?? '1d6';
  const damageRoll = await new Roll(damageFormula).evaluate();
  const baseDamage = damageRoll.total;
  const weaponLabel = (item.system.weapons?.length ?? 0) > 1 ? `${item.name} - ${definition.label}` : item.name;
  const explosionDamageFlavorHtml = `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Combat.ExplosionDamage')}: ${weaponLabel}</h3>`
    + `<p>${game.i18n.format('CYBER_BLUE.Combat.ConeTargetCount', { count: targets.length })}</p></div>`;
  let explosionDamagePosted = false;

  // Crit detection uses the single baseDamage roll (same dice for all targets)
  const { count: expCritDiceCount } = detectCriticalDice(damageRoll);

  for (const { actor: targetActor, isFullDamage } of targets) {
    const evasionRoll = await rollTargetEvasion(targetActor);
    const evaded = evasionRoll.total > attackRoll.total;

    // Half-damage: outer zone OR successful evasion → no critical injury
    const halfDamage = !isFullDamage || evaded;

    let damage = baseDamage;
    if (!isFullDamage) damage = Math.ceil(damage / 2);
    if (evaded) damage = Math.ceil(damage / 2);

    const sp = targetActor.system?.resources?.armor?.value ?? 0;

    // Crit: 2+ sixes AND original damage would penetrate AND not half-damage
    const penetratesWithoutBonus = damage > sp;
    const isCritical = expCritDiceCount >= 2 && penetratesWithoutBonus && !halfDamage;
    const finalDamage = isCritical ? damage + 5 : damage;

    const netDamage = Math.max(finalDamage - sp, 0);
    const ablatesArmor = finalDamage >= sp && sp > 0;

    const zone = isFullDamage
      ? game.i18n.localize('CYBER_BLUE.Combat.ConeFullDamage')
      : game.i18n.localize('CYBER_BLUE.Combat.ConeHalfDamage');
    const evasionNote = evaded ? ` (${game.i18n.localize('CYBER_BLUE.Combat.Evaded')})` : '';

    if (netDamage > 0 || ablatesArmor) {
      const result = await confirmDamageDialog({
        targetActor, finalDamage, sp, netDamage, ablatesArmor, isCritical, critDiceCount: expCritDiceCount,
      });
      if (result?.confirmed) {
        if (!explosionDamagePosted) {
          explosionDamagePosted = true;
          await damageRoll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: attacker }),
            flavor: explosionDamageFlavorHtml,
            rollMode: game.settings.get('core', 'rollMode'),
          });
        }
        await applyDamageWithPermission(targetActor, finalDamage);
        if (isCritical) {
          // Explosion/cone always uses the body table
          await rollCriticalInjuryWithPermission(targetActor, 'body', { attackerActor: attacker });
        }
      }
    }
  }
  // If no target confirmed damage, still post the damage roll so the dice are visible
  if (!explosionDamagePosted) {
    await damageRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      flavor: explosionDamageFlavorHtml,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }
}

// ─── Cone attack ────────────────────────────────────────────────────────────

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

  // Upfront ammo check: weapon must have at least `shots` ammo to fire
  const shotsRequired = item.system.weapons?.[weaponIndex]?.shots ?? weapon.shots ?? 0;
  if (shotsRequired > 0) {
    const currentAmmo = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
    if (currentAmmo < shotsRequired) {
      ui.notifications.warn(game.i18n.format('CYBER_BLUE.Combat.NotEnoughAmmoForShots', { required: shotsRequired, current: currentAmmo }));
      return;
    }
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
  const precisionBonus = getActiveAEFlag(attacker, 'soloPrecisionAttack') ?? 0;
  const attackRoll = await attacker.rollSkill({ skillSlug, modifier: precisionBonus });
  const attackTotal = attackRoll.total;

  // Consume ammo (shots)
  const shots = item.system.weapons?.[weaponIndex]?.shots ?? weapon.shots ?? 0;
  if (shots > 0) {
    const currentAmmo = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
    await item.update(buildWeaponUpdate(item, weaponIndex, { ammoCurrent: Math.max(currentAmmo - shots, 0) }));
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
  const coneDamageFlavorHtml = `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Combat.ConeDamage')}: ${weaponLabel}</h3><p>${game.i18n.format('CYBER_BLUE.Combat.ConeTargetCount', { count: targets.length })}</p></div>`;
  let coneDamagePosted = false;

  // Crit detection uses the single baseDamage roll (same dice for all targets)
  const { count: coneCritDiceCount } = detectCriticalDice(damageRoll);

  for (const { token: coneTargetToken, actor: targetActor, isFullDamage } of targets) {
    // Per-target visibility: attacker must be able to see the target to hit them in a cone
    const _coneVis = computeVisibilityPenalty(attacker, attackerToken, coneTargetToken);
    if (_coneVis.blocked) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-eye-slash"></i> <strong>${targetActor.name}</strong>: ${_coneVis.notes.join(' ')}</p></div>`,
      });
      continue;
    }

    const evasionRoll = await rollTargetEvasion(targetActor);
    const evaded = evasionRoll.total > (attackTotal + _coneVis.penalty);

    // Half-damage: outer zone OR successful evasion → no critical injury
    const halfDamage = !isFullDamage || evaded;

    let damage = baseDamage;
    if (!isFullDamage) damage = Math.ceil(damage / 2);
    if (evaded) damage = Math.ceil(damage / 2);

    const sp = targetActor.system?.resources?.armor?.value ?? 0;

    // Crit: 2+ sixes AND original damage would penetrate AND not half-damage
    const penetratesWithoutBonus = damage > sp;
    const isCritical = coneCritDiceCount >= 2 && penetratesWithoutBonus && !halfDamage;
    const finalDamage = isCritical ? damage + 5 : damage;

    const netDamage = Math.max(finalDamage - sp, 0);
    const ablatesArmor = finalDamage >= sp && sp > 0;

    if (netDamage > 0 || ablatesArmor) {
      const result = await confirmDamageDialog({
        targetActor, finalDamage, sp, netDamage, ablatesArmor, isCritical, critDiceCount: coneCritDiceCount,
      });
      if (result?.confirmed) {
        if (!coneDamagePosted) {
          coneDamagePosted = true;
          await damageRoll.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: attacker }),
            flavor: coneDamageFlavorHtml,
            rollMode: game.settings.get('core', 'rollMode'),
          });
        }
        await applyDamageWithPermission(targetActor, finalDamage);
        if (isCritical) {
          // Cone attacks always use the body table
          await rollCriticalInjuryWithPermission(targetActor, 'body', { attackerActor: attacker });
        }
      }
    }
  }
  if (!coneDamagePosted) {
    await damageRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      flavor: coneDamageFlavorHtml,
      rollMode: game.settings.get('core', 'rollMode'),
    });
  }

  // Show cone area effect for N seconds after damage
  showAreaEffectCone(attackerCenter.x, attackerCenter.y, spreadPx, halfDamagePx, halfAngleRad, confirmedAngle);
}

// ─── Scatter Effect (Brunswick AR-9) ────────────────────────────────────────
// Automatically fires a narrow 10° cone along the attack trajectory; targets
// within the cone (excluding the original target) take ½ the main damage roll.
// coneHalfDamageDistance = 0 ⇒ all hits are half-damage (no full-damage zone).

/**
 * @param {Actor}  attacker
 * @param {Token}  attackerToken     The attacker's active placeable token.
 * @param {Token}  mainTargetToken   The original attack target (excluded from scatter).
 * @param {number} baseDamage        Total of the main damage roll (pre-SP).
 * @param {Roll}   damageRoll        The already-evaluated main damage roll (for crit detection).
 * @param {string} weaponLabel       Display name shown in chat.
 */
export async function resolveScatterEffect(attacker, attackerToken, mainTargetToken, baseDamage, damageRoll, weaponLabel) {
  if (!canvas?.tokens || !attackerToken || !mainTargetToken) return;

  const pixelsPerMeter = getPixelsPerMeter();
  const attackerCenter = getTokenCenter(attackerToken.document);
  const targetCenter = getTokenCenter(mainTargetToken.document);

  const dx = targetCenter.x - attackerCenter.x;
  const dy = targetCenter.y - attackerCenter.y;
  const distPx = Math.hypot(dx, dy);
  if (distPx === 0) return;

  const directionRad = Math.atan2(dy, dx);
  const halfAngleRad = (10 * Math.PI / 180) / 2; // 5° each side
  const spreadPx = distPx; // cone extends all the way to the target

  // Find tokens in the scatter cone, excluding attacker and main target
  const scatterTargets = [];
  for (const token of canvas.tokens.objects?.children ?? []) {
    if (token === attackerToken || token === mainTargetToken || !token.actor) continue;

    const tc = getTokenCenter(token.document);
    const tdx = tc.x - attackerCenter.x;
    const tdy = tc.y - attackerCenter.y;
    const dist = Math.hypot(tdx, tdy);

    if (dist > spreadPx) continue;

    // Angle check
    const tokenAngle = Math.atan2(tdy, tdx);
    let angleDiff = Math.abs(tokenAngle - directionRad);
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
    if (angleDiff > halfAngleRad) continue;

    if (isBlockedByWalls(attackerCenter, tc)) continue;
    scatterTargets.push(token.actor);
  }

  if (scatterTargets.length === 0) return;

  const halfDamage = Math.ceil(baseDamage / 2);
  const scatterFlavorHtml = `<div class="cyberpunk-blue chat-card"><h3><i class="fas fa-angles-right"></i> ${game.i18n.localize('CYBER_BLUE.Combat.ScatterEffect')}: ${weaponLabel}</h3><p>${game.i18n.format('CYBER_BLUE.Combat.ScatterTargets', { count: scatterTargets.length, damage: halfDamage })}</p></div>`;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: scatterFlavorHtml,
  });

  for (const targetActor of scatterTargets) {
    const sp = targetActor.system?.resources?.armor?.value ?? 0;
    const netDamage = Math.max(halfDamage - sp, 0);
    const ablatesArmor = halfDamage >= sp && sp > 0;

    if (netDamage > 0 || ablatesArmor) {
      const result = await confirmDamageDialog({
        targetActor, finalDamage: halfDamage, sp, netDamage, ablatesArmor,
        isCritical: false, critDiceCount: 0,
      });
      if (result?.confirmed) {
        await applyDamageWithPermission(targetActor, halfDamage);
      }
    }
  }

  // Show scatter cone briefly
  showAreaEffectCone(attackerCenter.x, attackerCenter.y, spreadPx, 0, halfAngleRad, directionRad);
}

// ─── Affliction Cone ────────────────────────────────────────────────────────

export async function resolveAfflictionConeAttack(attacker, item, weaponIndex) {
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

  // Attack roll (used for evasion comparison per target)
  const precisionBonus = getActiveAEFlag(attacker, 'soloPrecisionAttack') ?? 0;
  const attackRoll = await attacker.rollSkill({ skillSlug, modifier: precisionBonus });
  const attackTotal = attackRoll.total;

  // Consume ammo
  const shots = item.system.weapons?.[weaponIndex]?.shots ?? weapon.shots ?? 0;
  if (shots > 0) {
    const currentAmmo = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
    await item.update(buildWeaponUpdate(item, weaponIndex, { ammoCurrent: Math.max(currentAmmo - shots, 0) }));
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
    let angleDiff = Math.abs(Math.atan2(dy, dx) - confirmedAngle);
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
    if (angleDiff > halfAngleRad) continue;
    if (isBlockedByWalls(attackerCenter, tc)) continue;
    const distMeters = dist / pixelsPerMeter;
    const isFullDamage = halfDamageDistance <= 0 || distMeters <= halfDamageDistance;
    targets.push({ token, actor: token.actor, isFullDamage });
  }

  if (targets.length === 0) {
    ui.notifications.info(game.i18n.localize('CYBER_BLUE.Combat.ConeNoTargets'));
    return;
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `<div class="cyberpunk-blue chat-card">
      <h3><i class="fas fa-biohazard"></i> ${game.i18n.localize('CYBER_BLUE.Combat.AfflictionCone')}: ${item.name}</h3>
      <p>${game.i18n.format('CYBER_BLUE.Combat.ConeTargetCount', { count: targets.length })}</p>
    </div>`,
  });

  for (const { token: affConeTargetToken, actor: targetActor, isFullDamage } of targets) {
    // Per-target visibility check
    const _affConeVis = computeVisibilityPenalty(attacker, attackerToken, affConeTargetToken);
    if (_affConeVis.blocked) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<div class="cyberpunk-blue chat-card"><p><i class="fas fa-eye-slash"></i> <strong>${targetActor.name}</strong>: ${_affConeVis.notes.join(' ')}</p></div>`,
      });
      continue;
    }

    // Evasion check (evaded targets are immune to affliction)
    const rflx = targetActor.system?.stats?.rflx?.value ?? 0;
    const rflxMod = targetActor.system?.stats?.rflx?.rollMod ?? 0;
    const evasionRank = targetActor.system?.skills?.evasion?.rank
      ?? targetActor.system?.skills?.athletics?.rank ?? 0;
    const evasionRoll = await new Roll(`1d10 + ${rflx} + ${evasionRank}${rflxMod ? ` + ${rflxMod}` : ''}`).evaluate();
    await evasionRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: targetActor }),
      flavor: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Combat.EvasionRoll')}: ${targetActor.name}</h3><p>RFLX ${rflx} + ${game.i18n.localize('CYBER_BLUE.Combat.EvasionSkill')} ${evasionRank}</p></div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });
    if (evasionRoll.total > (attackTotal + _affConeVis.penalty)) continue; // evaded (visibility penalty widens the window)

    // SP check — outer zone halves damage for SP purposes; resistBonus +2
    const isHalf = !isFullDamage;
    const penetrates = await checkAfflictionSP(weapon, targetActor, isHalf);
    if (!penetrates) continue;

    const resistBonus = isHalf ? (weapon.outerZoneResistBonus ?? 2) : 0;
    const defenseRoll = await rollAfflictionDefense(targetActor, weapon, resistBonus);
    if (defenseRoll.total >= (weapon.afflictionDv ?? 13)) continue; // resisted

    await applyAfflictionEffect(item, weapon, targetActor);
  }
}

// ─── Affliction Explosion ───────────────────────────────────────────────────

export async function resolveAfflictionExplosionAttack(attacker, item, weaponIndex) {
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

  // Upfront ammo check: weapon must have at least `shots` ammo to fire
  const shotsRequiredAffExp = item.system.weapons?.[weaponIndex]?.shots ?? weapon.shots ?? 0;
  if (shotsRequiredAffExp > 0) {
    const currentAmmoAffExp = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
    if (currentAmmoAffExp < shotsRequiredAffExp) {
      ui.notifications.warn(game.i18n.format('CYBER_BLUE.Combat.NotEnoughAmmoForShots', { required: shotsRequiredAffExp, current: currentAmmoAffExp }));
      return;
    }
  }

  const spread = weapon.coneSpread ?? 0;
  const halfDamageDistance = weapon.coneHalfDamageDistance ?? 0;
  if (spread <= 0) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.ExplosionNoSpread'));
    return;
  }

  const rangeTable = weapon.rangeTable ?? [];
  const maxRangeIndex = rangeTable.reduce((best, dv, i) => (dv > 0 ? i : best), -1);
  const rangeBands = COMBAT_CONFIG.rangeBands ?? [];
  const maxRangeMeters = maxRangeIndex >= 0 ? (rangeBands[maxRangeIndex]?.max ?? 100) : 100;

  const pixelsPerMeter = getPixelsPerMeter();
  const maxRangePx = maxRangeMeters * pixelsPerMeter;
  const spreadPx = spread * pixelsPerMeter;
  const halfDamagePx = halfDamageDistance * pixelsPerMeter;
  const attackerCenter = getTokenCenter(attackerToken.document);

  ui.notifications.info(game.i18n.localize('CYBER_BLUE.Combat.ExplosionAimPrompt'));
  const aimPoint = await placeExplosionPoint(attackerCenter.x, attackerCenter.y, maxRangePx, spreadPx, halfDamagePx);
  if (aimPoint === null) return;

  // DV from range table at aimed distance
  const aimedDistMeters = Math.hypot(aimPoint.x - attackerCenter.x, aimPoint.y - attackerCenter.y) / pixelsPerMeter;
  let resolvedDV = null;
  for (let i = 0; i < rangeBands.length; i++) {
    const band = rangeBands[i];
    if (aimedDistMeters <= (band.max ?? Infinity) && rangeTable[i] > 0) {
      resolvedDV = rangeTable[i];
      break;
    }
  }
  if (resolvedDV === null) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Combat.OutOfRange'));
    return;
  }

  // ── Visibility check at aim point ─────────────────────────────────────────
  const _affExpAimPt = makeElevatedPoint(aimPoint.x, aimPoint.y, attackerToken.document.elevation ?? 0);
  const _affExpVis = computeVisibilityPenalty(attacker, attackerToken, null, _affExpAimPt);
  if (_affExpVis.blocked) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="cyberpunk-blue chat-card">
        <h3><i class="fas fa-eye-slash"></i> ${game.i18n.localize('CYBER_BLUE.Visibility.BlockedTitle')}</h3>
        <p>${_affExpVis.notes.join(' ')}</p>
      </div>`,
    });
    return;
  }

  const precisionBonus = (getActiveAEFlag(attacker, 'soloPrecisionAttack') ?? 0) + _affExpVis.penalty;
  const attackRoll = await attacker.rollSkill({ skillSlug, modifier: precisionBonus });
  const hit = attackRoll.total >= resolvedDV;

  // Consume ammo
  const shots = item.system.weapons?.[weaponIndex]?.shots ?? weapon.shots ?? 0;
  if (shots > 0) {
    const currentAmmo = item.system.weapons?.[weaponIndex]?.ammoCurrent ?? 0;
    await item.update(buildWeaponUpdate(item, weaponIndex, { ammoCurrent: Math.max(currentAmmo - shots, 0) }));
  }

  let explosionCenter = aimPoint;
  if (!hit) {
    const scatter = 1 + Math.max(0, resolvedDV - attackRoll.total);
    explosionCenter = scatterPoint(aimPoint, scatter, pixelsPerMeter);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: attacker }),
      content: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Combat.ExplosionScatter')}</h3>`
        + `<p>${game.i18n.format('CYBER_BLUE.Combat.ExplosionScatterDist', { dist: scatter })}</p></div>`,
    });
  }

  // Show persistent area graphic now that the explosion centre is finalised
  showAreaEffectExplosion(explosionCenter.x, explosionCenter.y, spreadPx, halfDamagePx);
  await createResidueRegion(item, weapon, explosionCenter, spreadPx, pixelsPerMeter);

  // Find tokens in blast radius
  const targets = [];
  for (const token of canvas.tokens.objects?.children ?? []) {
    if (token === attackerToken || !token.actor) continue;
    const tc = getTokenCenter(token.document);
    const dist = Math.hypot(tc.x - explosionCenter.x, tc.y - explosionCenter.y);
    if (dist > spreadPx) continue;
    if (isBlockedByWalls(explosionCenter, tc)) continue;
    const distMeters = dist / pixelsPerMeter;
    const isFullDamage = halfDamageDistance <= 0 || distMeters <= halfDamageDistance;
    targets.push({ token, actor: token.actor, isFullDamage });
  }

  if (targets.length === 0) {
    ui.notifications.info(game.i18n.localize('CYBER_BLUE.Combat.ExplosionNoTargets'));
    return;
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: attacker }),
    content: `<div class="cyberpunk-blue chat-card">
      <h3><i class="fas fa-biohazard"></i> ${game.i18n.localize('CYBER_BLUE.Combat.AfflictionExplosion')}: ${item.name}</h3>
      <p>${game.i18n.format('CYBER_BLUE.Combat.ConeTargetCount', { count: targets.length })}</p>
    </div>`,
  });

  for (const { actor: targetActor, isFullDamage } of targets) {
    // Evasion check
    const rflx = targetActor.system?.stats?.rflx?.value ?? 0;
    const rflxMod = targetActor.system?.stats?.rflx?.rollMod ?? 0;
    const evasionRank = targetActor.system?.skills?.evasion?.rank
      ?? targetActor.system?.skills?.athletics?.rank ?? 0;
    const evasionRoll = await new Roll(`1d10 + ${rflx} + ${evasionRank}${rflxMod ? ` + ${rflxMod}` : ''}`).evaluate();
    await evasionRoll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: targetActor }),
      flavor: `<div class="cyberpunk-blue chat-card"><h3>${game.i18n.localize('CYBER_BLUE.Combat.EvasionRoll')}: ${targetActor.name}</h3><p>RFLX ${rflx} + ${game.i18n.localize('CYBER_BLUE.Combat.EvasionSkill')} ${evasionRank}</p></div>`,
      rollMode: game.settings.get('core', 'rollMode'),
    });
    const evaded = evasionRoll.total > attackRoll.total;
    const isHalf = !isFullDamage || evaded;
    if (evaded && isFullDamage) {
      // Successful evasion from inner zone → fully immune (same as damage version)
      continue;
    }

    // SP check
    const penetrates = await checkAfflictionSP(weapon, targetActor, isHalf);
    if (!penetrates) continue;

    const resistBonus = isHalf ? (weapon.outerZoneResistBonus ?? 2) : 0;
    const defenseRoll = await rollAfflictionDefense(targetActor, weapon, resistBonus);
    if (defenseRoll.total >= (weapon.afflictionDv ?? 13)) continue;

    await applyAfflictionEffect(item, weapon, targetActor);
  }
}
