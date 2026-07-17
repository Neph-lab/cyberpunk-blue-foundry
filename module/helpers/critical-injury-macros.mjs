/**
 * Macro script strings for the Critical Injury compendium.
 *
 * Each export is a self-contained JS string stored as a Foundry Macro document.
 * They are auto-populated into the 'cyberpunk-blue.macros' pack on first GM load.
 *
 * Assumptions:
 *  - The treating character = ChatMessage.getSpeaker().actor (or game.user.character)
 *  - The injured actor = the single targeted token
 *  - Critical injury flag key = 'criticalInjury' on the AE
 *  - Medicine skill slug = 'medicine', uses INT stat
 *  - Medtech role check: role item with category 'medtech'
 *  - Surgery specialization: specialty named 'Surgery' on the Medtech role item
 */

// ─── Shared helpers embedded in every macro ──────────────────────────────────

const _MACRO_SHARED = `
// ── Helpers ──────────────────────────────────────────────────────────────────
function _getTreatingActor() {
  const speakerData = ChatMessage.getSpeaker({});
  if (speakerData.actor) {
    const a = game.actors.get(speakerData.actor);
    if (a) return a;
  }
  return game.user.character ?? null;
}

function _getInjuries(actor) {
  return actor.effects.filter(e => e.getFlag('cyberpunk-blue', 'criticalInjury'));
}

function _getMedicineRank(actor) {
  return actor.system?.skills?.medicine?.rank ?? 0;
}

function _getIntStat(actor) {
  return { value: actor.system?.stats?.int?.value ?? 0, mod: actor.system?.stats?.int?.rollMod ?? 0 };
}

function _getMedtechRole(actor) {
  return actor.items.find(i => i.type === 'role' && i.system?.category === 'medtech') ?? null;
}

function _getSurgeryRank(actor) {
  const role = _getMedtechRole(actor);
  if (!role) return 0;
  const spec = role.system?.specialties?.find(s => s.name?.toLowerCase().includes('surgery'));
  return spec?.rank ?? 0;
}

async function _rollMedicine(actor, dv, label) {
  const medRank = _getMedicineRank(actor);
  const { value: intVal, mod: intMod } = _getIntStat(actor);
  const terms = ['1d10', \`+ \${intVal}\`, \`+ \${medRank}\`];
  if (intMod) terms.push(intMod > 0 ? \`+ \${intMod}\` : \`- \${Math.abs(intMod)}\`);
  const roll = await new Roll(terms.join(' ')).evaluate();
  const success = roll.total >= dv;
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: \`<div class="cyberpunk-blue chat-card"><h3>\${label}</h3><p>INT \${intVal} + Medicine \${medRank}\${intMod ? ' + mod ' + intMod : ''} vs DV \${dv}: <strong>\${success ? 'Success' : 'Failure'}</strong></p></div>\`,
    rollMode: game.settings.get('core', 'rollMode'),
  });
  return roll;
}

async function _rollMedicineWithSurgery(actor, dv, label) {
  const medRank = _getMedicineRank(actor);
  const surgRank = _getSurgeryRank(actor);
  const effectiveRank = Math.min(medRank, surgRank);
  const { value: intVal, mod: intMod } = _getIntStat(actor);
  const terms = ['1d10', \`+ \${intVal}\`, \`+ \${effectiveRank}\`];
  if (intMod) terms.push(intMod > 0 ? \`+ \${intMod}\` : \`- \${Math.abs(intMod)}\`);
  const roll = await new Roll(terms.join(' ')).evaluate();
  const success = roll.total >= dv;
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: \`<div class="cyberpunk-blue chat-card"><h3>\${label}</h3><p>INT \${intVal} + Medicine/Surgery \${effectiveRank} (Medicine \${medRank}, Surgery \${surgRank}) vs DV \${dv}: <strong>\${success ? 'Success' : 'Failure'}</strong></p></div>\`,
    rollMode: game.settings.get('core', 'rollMode'),
  });
  return { roll, effectiveRank, medRank, surgRank };
}

async function _pickInjury(injuries, title) {
  if (injuries.length === 0) return null;
  if (injuries.length === 1) return injuries[0];
  return new Promise((resolve) => {
    const buttons = injuries.map((inj, idx) => ({
      action: String(idx),
      label: inj.name,
      callback: () => injuries[idx],
    }));
    buttons.push({ action: 'cancel', label: 'Cancel', callback: () => null });
    const dialog = new foundry.applications.api.DialogV2({
      window: { title },
      content: '<p>Select which injury to treat:</p>',
      buttons,
      submit: resolve,
    });
    dialog.addEventListener('close', () => resolve(null), { once: true });
    dialog.render(true);
  });
}
`;

// ─── Quick Fix macro ──────────────────────────────────────────────────────────

export const QUICK_FIX_MACRO = `
(async () => {
${_MACRO_SHARED}
// ── Quick Fix ─────────────────────────────────────────────────────────────────
// Target an injured actor. Make a Medicine check to suppress the injury for 1 hour.
// Only usable once per injury (until fully treated).

const targets = [...game.user.targets];
if (targets.length !== 1) { ui.notifications.warn('Target exactly one actor.'); return; }
const targetActor = targets[0].actor;
if (!targetActor) { ui.notifications.warn('No valid target actor.'); return; }

const injuries = _getInjuries(targetActor);
if (!injuries.length) { ui.notifications.warn(\`\${targetActor.name} has no critical injuries.\`); return; }

const injury = await _pickInjury(injuries, 'Quick Fix — Select Injury');
if (!injury) return;

const flags = injury.getFlag('cyberpunk-blue', 'criticalInjury') ?? {};

if (flags.noQuickFix) {
  ui.notifications.warn(\`\${injury.name}: no quick fix possible for this injury.\`);
  return;
}
if (flags.quickFixUsed) {
  ui.notifications.warn(\`\${injury.name}: quick fix already used — the injury must be fully treated first.\`);
  return;
}
if (injury.disabled) {
  ui.notifications.warn(\`\${injury.name}: effects are already suppressed.\`);
  return;
}

const dv = flags.quickFixDv;
if (!dv) { ui.notifications.warn(\`\${injury.name}: no quick fix DV defined.\`); return; }

const treater = _getTreatingActor();
if (!treater) { ui.notifications.warn('Could not identify treating character.'); return; }

const roll = await _rollMedicine(treater, dv, \`Quick Fix: \${injury.name}\`);
if (roll.total >= dv) {
  await injury.update({
    disabled: true,
    'duration.seconds': 3600,
    'duration.startTime': game.time.worldTime,
    'flags.cyberpunk-blue.criticalInjury.quickFixUsed': true,
  });
  ui.notifications.info(\`Quick fix successful! \${injury.name} on \${targetActor.name} suppressed for 1 hour.\`);
} else {
  ui.notifications.warn(\`Quick fix failed (rolled \${roll.total} vs DV \${dv}).\`);
}
})();
`;

// ─── Treatment macro ──────────────────────────────────────────────────────────

export const TREATMENT_MACRO = `
(async () => {
${_MACRO_SHARED}
// ── Treatment ─────────────────────────────────────────────────────────────────
// Target an injured actor. Make a Medicine (or Medicine+Surgery) check.
// On success: permanently remove the critical injury AE.
// If Surgery required: treater must have the Medtech role with Surgery invested.
// Uses LOWER of Medicine rank and Surgery specialization rank.

const targets = [...game.user.targets];
if (targets.length !== 1) { ui.notifications.warn('Target exactly one actor.'); return; }
const targetActor = targets[0].actor;
if (!targetActor) { ui.notifications.warn('No valid target actor.'); return; }

const injuries = _getInjuries(targetActor);
if (!injuries.length) { ui.notifications.warn(\`\${targetActor.name} has no critical injuries.\`); return; }

const injury = await _pickInjury(injuries, 'Treatment — Select Injury');
if (!injury) return;

const flags = injury.getFlag('cyberpunk-blue', 'criticalInjury') ?? {};

if (!flags.treatmentDv) { ui.notifications.warn(\`\${injury.name}: no treatment DV defined.\`); return; }

const treater = _getTreatingActor();
if (!treater) { ui.notifications.warn('Could not identify treating character.'); return; }

let dv = flags.treatmentDv;
let useSurgery = false;

if (flags.surgeryRequired) {
  // Surgery is required: treater must have Medtech role with Surgery invested
  if (!_getMedtechRole(treater)) {
    ui.notifications.warn(\`Treatment of \${injury.name} requires the Medtech role with Surgery. \${treater.name} does not have it.\`);
    return;
  }
  const surgRank = _getSurgeryRank(treater);
  if (surgRank <= 0) {
    ui.notifications.warn(\`Treatment of \${injury.name} requires Surgery (Medtech specialization). \${treater.name} has Surgery rank 0.\`);
    return;
  }
  useSurgery = true;
} else if (flags.surgeryDv && _getMedtechRole(treater) && _getSurgeryRank(treater) > 0) {
  // Surgery is optional — offer the lower DV if the treater has Surgery
  const surgDv = flags.surgeryDv;
  const choice = await new Promise((resolve) => {
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: \`Treatment: \${injury.name}\` },
      content: \`<p>\${treater.name} has Surgery. Treat with Surgery (DV \${surgDv}) or standard Medicine (DV \${dv})?</p>\`,
      buttons: [
        { action: 'surgery', label: \`Surgery (DV \${surgDv})\`, default: true, callback: () => 'surgery' },
        { action: 'standard', label: \`Standard (DV \${dv})\`, callback: () => 'standard' },
        { action: 'cancel', label: 'Cancel', callback: () => null },
      ],
      submit: resolve,
    });
    dialog.addEventListener('close', () => resolve(null), { once: true });
    dialog.render(true);
  });
  if (!choice) return;
  if (choice === 'surgery') { dv = surgDv; useSurgery = true; }
}

let roll;
if (useSurgery) {
  const result = await _rollMedicineWithSurgery(treater, dv, \`Treatment (Surgery): \${injury.name}\`);
  roll = result.roll;
} else {
  roll = await _rollMedicine(treater, dv, \`Treatment: \${injury.name}\`);
}

if (roll.total >= dv) {
  await injury.delete();
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: treater }),
    content: \`<div class="cyberpunk-blue chat-card"><p><i class="fas fa-check-circle"></i> <strong>\${injury.name}</strong> successfully treated on <strong>\${targetActor.name}</strong>.</p></div>\`,
  });
} else {
  ui.notifications.warn(\`Treatment failed (rolled \${roll.total} vs DV \${dv}).\`);
}
})();
`;

// ─── Stabilize macro ──────────────────────────────────────────────────────────

export const STABILIZE_MACRO = `
(async () => {
${_MACRO_SHARED}
// ── Stabilize ─────────────────────────────────────────────────────────────────
// Target a token that has the "Needs Stabilization" effect. The acting Actor
// makes a Medicine check; success removes the effect so the target can benefit
// from Natural Healing again.
//   Mortally Wounded (HP ≤ 0): DV 15 — success sets them to 1 HP and Unconscious.
//   Seriously Wounded (0 < HP < SWT): DV 13.
//   Otherwise: DV 10.
// The acting Actor must be the target itself or within 2m of it. The GM running
// this macro succeeds automatically and needs no token nearby.

const targets = [...game.user.targets];
if (targets.length !== 1) { ui.notifications.warn('Target exactly one token.'); return; }
const targetToken = targets[0];
const targetActor = targetToken.actor;
if (!targetActor) { ui.notifications.warn('No valid target actor.'); return; }

const needsStab = targetActor.effects.find(e => e.getFlag('cyberpunk-blue', 'needsStabilization'));
if (!needsStab) {
  ui.notifications.warn(\`\${targetActor.name} does not need stabilization.\`);
  return;
}

const hp = targetActor.system?.resources?.hp?.value ?? 0;
const hpMax = targetActor.system?.resources?.hp?.max ?? 1;
const swt = targetActor.system?.resources?.seriousWoundThreshold?.value ?? Math.floor(hpMax / 2);
const isMortal = hp <= 0;
const isSeriouslyWounded = hp > 0 && hp < swt;

let dv, situationLabel;
if (isMortal) { dv = 15; situationLabel = 'Mortally Wounded (DV 15)'; }
else if (isSeriouslyWounded) { dv = 13; situationLabel = 'Seriously Wounded (DV 13)'; }
else { dv = 10; situationLabel = 'Wounded (DV 10)'; }

const finishSuccess = async (byWhom) => {
  await needsStab.delete();
  let extra = '';
  if (isMortal) {
    // HP 1 reactively clears Mortally Wounded; apply the Unconscious condition.
    await targetActor.update({ 'system.resources.hp.value': 1 });
    await targetActor.toggleStatusEffect('unconscious', { active: true });
    extra = ' Set to 1 HP and now Unconscious.';
  }
  ChatMessage.create({
    content: \`<div class="cyberpunk-blue chat-card"><p><i class="fas fa-heartbeat"></i> <strong>\${targetActor.name}</strong> has been stabilized\${byWhom ? ' by ' + byWhom : ''}.\${extra} They can now benefit from Natural Healing.</p></div>\`,
  });
};

// GM auto-succeeds — no proximity, no roll.
if (game.user.isGM) { await finishSuccess(null); return; }

const treater = _getTreatingActor();
if (!treater) { ui.notifications.warn('Could not identify your character.'); return; }

// Proximity: the treater must be the target, or have a token within 2m of it.
if (treater.id !== targetActor.id) {
  const treaterToken = treater.getActiveTokens?.()[0];
  if (!treaterToken) { ui.notifications.warn(\`\${treater.name} has no token in this scene.\`); return; }
  let dist = Infinity;
  try { dist = canvas.grid.measurePath([treaterToken.center, targetToken.center]).distance; } catch (e) {}
  if (dist > 2) {
    ui.notifications.warn(\`\${treater.name} must be within 2m of \${targetActor.name} (currently ~\${Math.round(dist)}m).\`);
    return;
  }
}

const roll = await _rollMedicine(treater, dv, \`Stabilize \${targetActor.name} — \${situationLabel}\`);
if (roll.total >= dv) { await finishSuccess(treater.name); }
else { ui.notifications.warn(\`Stabilization failed (rolled \${roll.total} vs DV \${dv}).\`); }
})();
`;

// ─── Natural Healing macro ───────────────────────────────────────────────────

export const NATURAL_HEALING_MACRO = `
(async () => {
${_MACRO_SHARED}
// ── Natural Healing ───────────────────────────────────────────────────────────
// GM macro. Represents a full day of rest. For every player-owned character that
// is stabilized (no "Needs Stabilization" effect):
//   - They regain HP equal to their BODY (×2 with Enhanced Antibodies cyberware),
//     plus any naturalHealingBonus effects (e.g. Antibiotics +2).
//   - A Medtech may instead distribute 2 × their Medtech rank in bonus HP to
//     OTHER characters; doing so means the Medtech does not rest.
//   - The cyberpunk-blue.naturalHealing hook fires for each resting actor so
//     per-rest abilities (e.g. Bandit "Tough" uses) reset.

if (!game.user.isGM) { ui.notifications.warn('Natural Healing is a GM-only macro.'); return; }

const allPCs = game.actors.filter(a => a.type === 'character' && a.hasPlayerOwner);
if (!allPCs.length) { ui.notifications.warn('No player-owned characters found.'); return; }

const isStabilized = (a) => !a.effects.some(e => e.getFlag('cyberpunk-blue', 'needsStabilization'));
const stabilized = allPCs.filter(isStabilized);
if (!stabilized.length) {
  ui.notifications.warn('No stabilized characters — they must be stabilized before they can rest and heal.');
  return;
}

// Per-actor base healing (BODY, ×2 with Enhanced Antibodies) plus additive
// naturalHealingBonus from active effects.
const baseHealFor = (a) => {
  const body = a.system?.stats?.body?.value ?? 1;
  const enhanced = a.items.some(i => i.type === 'cyberware' && i.system.installed !== false && i.name === 'Enhanced Antibodies');
  const base = enhanced ? body * 2 : body;
  let bonus = 0;
  for (const e of a.effects) {
    if (e.disabled) continue;
    const b = e.getFlag('cyberpunk-blue', 'naturalHealingBonus');
    if (typeof b === 'number') bonus += b;
  }
  return { base, bonus, enhanced };
};

// Healing candidates = stabilized AND below max HP.
const healingMap = new Map();
for (const a of stabilized) {
  const hp = a.system?.resources?.hp?.value ?? 0;
  const hpMax = a.system?.resources?.hp?.max ?? 1;
  if (hp >= hpMax) continue;
  const h = baseHealFor(a);
  healingMap.set(a.id, { actor: a, base: h.base, bonus: h.bonus, enhanced: h.enhanced, medtechBonus: 0 });
}

// ── Medtech bonus healing dialog ──
const medtechActors = stabilized.filter(a => _getMedtechRole(a) !== null);
let medtechResting = new Set(medtechActors.map(a => a.id));

for (const medtech of medtechActors) {
  const medtechRank = _getMedtechRole(medtech)?.system?.rank ?? 0;
  if (medtechRank <= 0) continue;
  const bonusPool = medtechRank * 2;

  const recipients = [...healingMap.values()].map(e => e.actor).filter(a => a.id !== medtech.id);
  if (!recipients.length) continue;

  const recipientOptions = recipients.map(a => {
    const missing = (a.system?.resources?.hp?.max ?? 1) - (a.system?.resources?.hp?.value ?? 0);
    return \`<label style="display:flex;gap:.4rem;align-items:center;">
      <span style="min-width:10rem;">\${a.name} (missing \${missing} HP)</span>
      <input type="number" min="0" max="\${Math.min(bonusPool, missing)}" value="0"
        data-actor-id="\${a.id}" style="width:4rem;" />
    </label>\`;
  }).join('');

  const choice = await new Promise((resolve) => {
    const dialog = new foundry.applications.api.DialogV2({
      window: { title: \`\${medtech.name} — Medtech Bonus Healing\` },
      content: \`
        <div class="cyberpunk-blue" style="padding:.5rem;">
          <p><strong>\${medtech.name}</strong> (Medtech rank \${medtechRank}) can distribute up to <strong>\${bonusPool} bonus HP</strong> among other characters.</p>
          <p style="color:var(--color-level-warning,#e07000);">⚠ If \${medtech.name} distributes any healing, they will not rest and will not gain their own Natural Healing HP today.</p>
          <div style="display:flex;flex-direction:column;gap:.3rem;margin-top:.5rem;">\${recipientOptions}</div>
        </div>\`,
      buttons: [
        { action: 'apply', label: 'Apply Bonus Healing', default: true,
          callback: (_e, btn) => {
            const inputs = btn.form?.querySelectorAll('input[data-actor-id]') ?? [];
            const result = [];
            for (const inp of inputs) {
              const v = parseInt(inp.value) || 0;
              if (v > 0) result.push({ actorId: inp.dataset.actorId, hp: v });
            }
            return result;
          }},
        { action: 'skip', label: 'Rest (no bonus healing)', callback: () => [] },
      ],
      submit: resolve,
    });
    dialog.addEventListener('close', () => resolve([]), { once: true });
    dialog.render(true);
  });

  if (choice && choice.length > 0) {
    medtechResting.delete(medtech.id);
    for (const { actorId, hp } of choice) {
      if (healingMap.has(actorId)) healingMap.get(actorId).medtechBonus += hp;
    }
  }
}

// Resting actors = all stabilized PCs except Medtechs who distributed instead.
const restingActors = stabilized.filter(a => medtechResting.has(a.id) || !medtechActors.some(m => m.id === a.id));
const isResting = (id) => restingActors.some(a => a.id === id);

// ── Apply healing ──
const lines = [];
for (const { actor, base, bonus, enhanced, medtechBonus } of healingMap.values()) {
  const selfHeal = isResting(actor.id) ? (base + bonus) : 0;
  const totalHp = selfHeal + medtechBonus;
  if (totalHp <= 0) continue;
  const currentHp = actor.system?.resources?.hp?.value ?? 0;
  const hpMax = actor.system?.resources?.hp?.max ?? 1;
  const newHp = Math.min(currentHp + totalHp, hpMax);
  await actor.update({ 'system.resources.hp.value': newHp });
  const parts = [];
  if (isResting(actor.id)) {
    parts.push(\`\${base}\${enhanced ? ' (BODY×2)' : ''} base\`);
    if (bonus) parts.push(\`\${bonus} drug\`);
  }
  if (medtechBonus) parts.push(\`\${medtechBonus} Medtech\`);
  lines.push(\`<li><strong>\${actor.name}</strong>: +\${newHp - currentHp} HP (to \${newHp}/\${hpMax})\${parts.length ? ' — ' + parts.join(' + ') : ''}</li>\`);
}

for (const medtech of medtechActors) {
  if (!medtechResting.has(medtech.id)) {
    lines.push(\`<li><em>\${medtech.name}</em> distributed bonus healing and did not rest.</li>\`);
  }
}

// Per-rest upkeep: decrement use-limited healing effects (e.g. Antibiotic, 7
// uses) and fire the rest hook so role abilities reset.
for (const actor of restingActors) {
  for (const e of [...actor.effects]) {
    const uses = e.getFlag('cyberpunk-blue', 'naturalHealingUses');
    if (typeof uses === 'number') {
      if (uses <= 1) await e.delete();
      else await e.setFlag('cyberpunk-blue', 'naturalHealingUses', uses - 1);
    }
  }
  Hooks.callAll('cyberpunk-blue.naturalHealing', actor);
}

ChatMessage.create({
  content: \`<div class="cyberpunk-blue chat-card">
    <h3><i class="fas fa-bed"></i> Natural Healing</h3>
    \${lines.length ? \`<ul style="margin:.3rem 0 0 1rem;">\${lines.join('')}</ul>\` : '<p>Everyone rested; no HP needed restoring.</p>'}
  </div>\`,
});
})();
`;

// ─── Apply Table Effect macro ─────────────────────────────────────────────────

export const APPLY_TABLE_EFFECT_MACRO = `
(async () => {
// ── Apply Table Effect ────────────────────────────────────────────────────────
// GM macro. Select one or more tokens, then run.
// Rolls on a chosen world Roll Table and applies an AE named after the result
// to every selected token's actor. The AE carries a rollTableEffect flag so it
// can be bulk-removed with the "Remove Table Effects" macro.

if (!game.user.isGM) { ui.notifications.warn('This macro is for GMs only.'); return; }

const tokens = canvas.tokens.controlled;
if (!tokens.length) { ui.notifications.warn('Select one or more tokens first.'); return; }

const tables = game.tables.contents;
if (!tables.length) { ui.notifications.warn('No Roll Tables found in this world.'); return; }

// Build table picker options
const tableOptions = tables
  .sort((a, b) => a.name.localeCompare(b.name))
  .map(t => \`<option value="\${t.id}">\${t.name}</option>\`)
  .join('');

const chosenId = await new Promise((resolve) => {
  const dialog = new foundry.applications.api.DialogV2({
    window: { title: 'Apply Table Effect' },
    content: \`<div class="cyberpunk-blue" style="padding:.5rem 0;">
      <label style="display:flex;gap:.5rem;align-items:center;">
        <span style="min-width:6rem;">Roll Table:</span>
        <select name="tableId" style="flex:1;">\${tableOptions}</select>
      </label>
    </div>\`,
    buttons: [
      { action: 'roll', label: 'Roll & Apply', default: true,
        callback: (_e, btn) => btn.form.elements.tableId.value },
      { action: 'cancel', label: 'Cancel', callback: () => null },
    ],
    submit: resolve,
  });
  dialog.addEventListener('close', () => resolve(null), { once: true });
  dialog.render(true);
});
if (!chosenId) return;

const table = game.tables.get(chosenId);
if (!table) return;

// Roll on the table (suppress default chat message — we'll make our own)
const draw = await table.draw({ displayChat: false });
const result = draw.results[0];
if (!result) { ui.notifications.warn('Table returned no result.'); return; }

const effectName = result.text || result.description || 'Unknown Effect';

// Apply AE to each selected token's actor
const applied = [];
for (const token of tokens) {
  const actor = token.actor;
  if (!actor) continue;
  await actor.createEmbeddedDocuments('ActiveEffect', [{
    name: effectName,
    icon: 'icons/svg/aura.svg',
    changes: [],
    flags: {
      'cyberpunk-blue': {
        rollTableEffect: true,
        rollTableId: table.id,
        rollTableName: table.name,
      },
    },
  }]);
  applied.push(actor.name);
}

if (!applied.length) { ui.notifications.warn('No valid actors on selected tokens.'); return; }

ChatMessage.create({
  content: \`<div class="cyberpunk-blue chat-card">
    <h3><i class="fas fa-dice"></i> \${table.name}</h3>
    <p><strong>Result:</strong> \${effectName}</p>
    <p><em>Applied to: \${applied.join(', ')}</em></p>
  </div>\`,
});
})();
`;

// ─── Clear Role-Granted Items macro ──────────────────────────────────────────

export const CLEAR_ROLE_GRANTED_ITEMS_MACRO = `
(async () => {
// ── Clear Role-Granted Items ──────────────────────────────────────────────────
// GM macro. Select a token (or set a default character) and run.
// Finds every item on the actor whose name appears in the role's
// grantedItemGroups list and offers to delete them, giving a clean slate for
// manual setup. Delete and re-add the Role item afterwards to re-trigger the
// automatic gear grant with current behaviour.
// If the role has no grantedItemGroups data, run
// Settings → Re-sync Role Starting Gear first.

if (!game.user.isGM) { ui.notifications.warn('GM only.'); return; }

const token = canvas.tokens.controlled[0];
const actor = token?.actor ?? game.user.character;
if (!actor) {
  ui.notifications.warn('Select a token or set a default character first.');
  return;
}

const roleItems = actor.items.filter(i => i.type === 'role');
if (!roleItems.length) {
  ui.notifications.warn(\`\${actor.name} has no Role items.\`);
  return;
}

const grantedNames = new Set();
let anyGroups = false;
for (const role of roleItems) {
  for (const group of role.system?.grantedItemGroups ?? []) {
    for (const ref of group.items ?? []) {
      if (ref.name) { grantedNames.add(ref.name); anyGroups = true; }
    }
  }
}

if (!anyGroups) {
  ui.notifications.warn(
    'No starting gear data on the role item(s). ' +
    'Run Settings → Re-sync Role Starting Gear first, then try again.'
  );
  return;
}

const toRemove = actor.items.filter(i => i.type !== 'role' && grantedNames.has(i.name));
if (!toRemove.length) {
  ui.notifications.info(\`No role-granted items found on \${actor.name}.\`);
  return;
}

const listHtml = toRemove
  .map(i => \`<li>\${foundry.utils.escapeHTML(i.name)} <em style="opacity:.7">(\${i.type})</em></li>\`)
  .join('');

const confirmed = await foundry.applications.api.DialogV2.confirm({
  window: { title: 'Clear Role-Granted Items' },
  content: \`
    <p>Remove the following items from <strong>\${foundry.utils.escapeHTML(actor.name)}</strong>?</p>
    <ul style="margin:.4em 0 .4em 1.2em">\${listHtml}</ul>
    <p style="margin-top:.5em"><em>Delete and re-add the Role item to re-trigger automatic gear grant.</em></p>
  \`,
  rejectClose: false,
});
if (!confirmed) return;

await actor.deleteEmbeddedDocuments('Item', toRemove.map(i => i.id));
ui.notifications.info(\`Cleared \${toRemove.length} role-granted item(s) from \${actor.name}.\`);
})();
`;

// ─── Remove Table Effects macro ───────────────────────────────────────────────

export const REMOVE_TABLE_EFFECTS_MACRO = `
(async () => {
// ── Remove Table Effects ──────────────────────────────────────────────────────
// GM macro. Select one or more tokens, then run.
// Removes all AEs that were applied by the "Apply Table Effect" macro
// (identified by the rollTableEffect flag on the AE).

if (!game.user.isGM) { ui.notifications.warn('This macro is for GMs only.'); return; }

const tokens = canvas.tokens.controlled;
if (!tokens.length) { ui.notifications.warn('Select one or more tokens first.'); return; }

let totalRemoved = 0;
const summary = [];

for (const token of tokens) {
  const actor = token.actor;
  if (!actor) continue;
  const toDelete = actor.effects
    .filter(e => e.getFlag('cyberpunk-blue', 'rollTableEffect'))
    .map(e => e.id);
  if (!toDelete.length) continue;
  await actor.deleteEmbeddedDocuments('ActiveEffect', toDelete);
  totalRemoved += toDelete.length;
  summary.push(\`\${actor.name}: \${toDelete.length} removed\`);
}

if (!totalRemoved) {
  ui.notifications.warn('No table effects found on selected tokens.');
  return;
}

ChatMessage.create({
  content: \`<div class="cyberpunk-blue chat-card">
    <h3><i class="fas fa-eraser"></i> Table Effects Removed</h3>
    <ul style="margin:.3rem 0 0 1rem;">\${summary.map(s => \`<li>\${s}</li>\`).join('')}</ul>
  </div>\`,
});
})();
`;

// ─── Adjust Improvement Points macro ──────────────────────────────────────────

export const ADJUST_IMPROVEMENT_POINTS_MACRO = `
(async () => {
// ── Adjust Improvement Points ─────────────────────────────────────────────────
// GM macro. Grant or remove IP across one or more player-owned characters.
// Positive amount grants IP (raising both current and total). Negative amount
// removes IP, lowering both current IP and total IP equally (total IP is only
// a measure of overall power level). Pre-checks the characters of any selected
// tokens.

if (!game.user.isGM) { ui.notifications.warn('Only the GM can adjust IP.'); return; }

const playerChars = game.actors.filter(a => a.type === 'character' && a.hasPlayerOwner);
if (!playerChars.length) { ui.notifications.warn('No player-owned characters found.'); return; }

const selectedIds = new Set((canvas.tokens?.controlled ?? []).map(t => t.actor?.id).filter(Boolean));

const checkboxes = playerChars.map(a =>
  \`<label style="display:flex;align-items:center;gap:0.5rem;padding:0.15rem 0;">
    <input type="checkbox" name="a_\${a.id}" \${selectedIds.has(a.id) ? 'checked' : ''} />
    <span><strong>\${foundry.utils.escapeHTML(a.name)}</strong> <span style="font-size:0.8em;color:var(--color-text-light-6);">(IP \${a.system.ip ?? 0} / Total \${a.system.totIP ?? 0})</span></span>
  </label>\`
).join('');

const result = await foundry.applications.api.DialogV2.wait({
  window: { title: 'Adjust Improvement Points' },
  content: \`
    <div class="cyberpunk-blue" style="padding:0.5rem;display:flex;flex-direction:column;gap:0.6rem;">
      <p style="margin:0;font-size:0.85em;color:var(--color-text-light-6);">Positive = grant IP. Negative = remove IP (also lowers Total IP).</p>
      <label>Amount: <input type="number" name="amount" value="0" style="width:6rem;" /></label>
      <fieldset style="border:1px solid var(--color-border-light-2);padding:0.4rem 0.6rem;border-radius:3px;">
        <legend style="font-size:0.85em;">Characters</legend>
        \${checkboxes}
      </fieldset>
    </div>
  \`,
  buttons: [
    {
      action: 'apply', label: 'Apply', icon: 'fas fa-check', default: true,
      callback: (_e, btn) => ({
        amount: Number(btn.form.elements['amount'].value) || 0,
        actorIds: playerChars.filter(a => btn.form.elements[\`a_\${a.id}\`]?.checked).map(a => a.id),
      }),
    },
    { action: 'cancel', label: 'Cancel', icon: 'fas fa-xmark', callback: () => null },
  ],
});

if (!result || !result.actorIds.length) return;
if (result.amount === 0) { ui.notifications.warn('Amount is 0 — nothing to do.'); return; }

const lines = [];
for (const id of result.actorIds) {
  const actor = game.actors.get(id);
  if (!actor) continue;
  const prev = actor.system.ip ?? 0;
  const prevTot = actor.system.totIP ?? 0;
  const newIp = Math.max(0, prev + result.amount);
  const newTot = Math.max(0, prevTot + result.amount);
  await actor.update({ 'system.ip': newIp, 'system.totIP': newTot });
  lines.push(\`<li>\${foundry.utils.escapeHTML(actor.name)}: \${prev} → \${newIp} IP\${result.amount < 0 ? \` (Total: \${prevTot} → \${newTot})\` : ''}</li>\`);
}

const verb = result.amount > 0 ? \`+\${result.amount}\` : String(result.amount);
ChatMessage.create({ content: \`<div class="cyberpunk-blue chat-card"><h3>IP Adjusted (\${verb})</h3><ul style="margin:.3rem 0 0 1rem;">\${lines.join('')}</ul></div>\` });
})();
`;

// ─── Request Skill Check macro ────────────────────────────────────────────────

export const REQUEST_SKILL_CHECK_MACRO = `
(async () => {
// ── Request Skill Check ───────────────────────────────────────────────────────
// GM macro. Rolls a Skill (and, for skills that have Components, a required
// Component) for one or more player characters. Each roll is made by that actor
// via actor.rollSkill, so it uses the actor's own stat, ranks, Component, and
// any active effects. "Secret roll" (default ON) whispers the results to the GM.

const SKILLS = CONFIG.CYBER_BLUE.skills;
const COMPONENTS = CONFIG.CYBER_BLUE.components;

const playerChars = game.actors.filter(a => a.type === 'character' && a.hasPlayerOwner);
if (!playerChars.length) { ui.notifications.warn('No player-owned characters found.'); return; }

const selectedIds = new Set((canvas.tokens?.controlled ?? []).map(t => t.actor?.id).filter(Boolean));

const skillOptions = Object.entries(SKILLS)
  .sort((a, b) => a[1].label.localeCompare(b[1].label))
  .map(([slug, d]) => \`<option value="\${slug}" \${slug === 'perception' ? 'selected' : ''}>\${d.label} (\${d.stat.toUpperCase()})</option>\`)
  .join('');

// Markup for the Component picker — empty for skills without Components.
const componentMarkup = (skillSlug) => {
  const comps = SKILLS[skillSlug]?.components ?? [];
  if (!comps.length) return '';
  const opts = comps.map(cs => \`<option value="\${cs}">\${COMPONENTS[cs]?.label ?? cs}</option>\`).join('');
  return \`<label>Component: <select name="component-select">\${opts}</select></label>\`;
};

const checkboxes = playerChars.map(a =>
  \`<label style="display:flex;align-items:center;gap:0.5rem;padding:0.15rem 0;">
    <input type="checkbox" name="a_\${a.id}" \${selectedIds.has(a.id) ? 'checked' : ''} />
    <span>\${foundry.utils.escapeHTML(a.name)}</span>
  </label>\`
).join('');

const result = await foundry.applications.api.DialogV2.wait({
  window: { title: 'Request Skill Check' },
  content: \`
    <div class="cyberpunk-blue" style="padding:0.5rem;display:flex;flex-direction:column;gap:0.6rem;">
      <label>Skill: <select name="skill-select">\${skillOptions}</select></label>
      <div id="rsc-component-wrap">\${componentMarkup('perception')}</div>
      <label>DV: <input type="number" name="dv-input" value="15" min="0" style="width:5rem;" /></label>
      <label style="display:flex;align-items:center;gap:0.5rem;"><input type="checkbox" name="secret-check" checked /> Secret roll (GM only)</label>
      <fieldset style="border:1px solid var(--color-border-light-2);padding:0.4rem 0.6rem;border-radius:3px;">
        <legend style="font-size:0.85em;">Roll for</legend>
        \${checkboxes}
      </fieldset>
    </div>
  \`,
  render: (event, dialog) => {
    const root = dialog.element;
    const skillSel = root.querySelector('[name="skill-select"]');
    const wrap = root.querySelector('#rsc-component-wrap');
    skillSel?.addEventListener('change', () => { wrap.innerHTML = componentMarkup(skillSel.value); });
  },
  buttons: [
    { action: 'roll', label: 'Roll', icon: 'fas fa-dice-d10', default: true,
      callback: (e, btn) => {
        const f = btn.form;
        return {
          skill: f.elements['skill-select'].value,
          component: f.elements['component-select']?.value ?? null,
          dv: Number(f.elements['dv-input'].value) || 0,
          secret: f.elements['secret-check'].checked,
          actorIds: playerChars.filter(a => f.elements[\`a_\${a.id}\`]?.checked).map(a => a.id),
        };
      }
    },
    { action: 'cancel', label: 'Cancel', icon: 'fas fa-xmark', callback: () => null },
  ],
});

if (!result) return;
if (!result.actorIds.length) { ui.notifications.warn('Select at least one character to roll for.'); return; }

// v14 message visibility: 'gm' = whispered to GMs only, 'public' = everyone.
const messageMode = result.secret ? 'gm' : 'public';
for (const id of result.actorIds) {
  const actor = game.actors.get(id);
  if (!actor?.rollSkill) continue;
  await actor.rollSkill({
    skillSlug: result.skill,
    componentSlug: result.component,
    dv: result.dv > 0 ? result.dv : null,
    messageMode,
  });
}
})();
`;

// ─── Apply Damage macro ───────────────────────────────────────────────────────

export const APPLY_DAMAGE_MACRO = `
(async () => {
// ── Apply Damage ──────────────────────────────────────────────────────────────
// GM: applies damage to the SELECTED tokens, no checks, optional ignore-armor.
//     SP ablation and HP loss are handled by the actor's damage pipeline.
// Player: applies damage to the ONE token they TARGET. The write is routed to
//     the GM if the player doesn't own the target (game.cyberpunkblue.delegate).
//     Armor (SP) always applies for players — ignore-armor is a GM adjudication.

if (game.user.isGM) {
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn('Select one or more tokens first.');
    return;
  }
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: 'Apply Damage' },
    content: \`
      <div class="cyberpunk-blue" style="padding:0.5rem; display:flex; flex-direction:column; gap:0.5rem;">
        <p>Apply to: <strong>\${tokens.map(t => t.name).join(', ')}</strong></p>
        <label>Damage: <input type="number" id="dmg-input" value="0" min="0" style="width:5rem;" /></label>
        <label style="display:flex;align-items:center;gap:0.5rem;"><input type="checkbox" id="ignore-armor" /> Ignore armor (SP)</label>
      </div>
    \`,
    buttons: [
      { action: 'apply', label: 'Apply', icon: 'fas fa-heart-crack', default: true,
        callback: (e, btn) => ({
          damage: Number(btn.form.elements['dmg-input'].value),
          ignoreArmor: btn.form.elements['ignore-armor'].checked,
        })
      },
      { action: 'cancel', label: 'Cancel', icon: 'fas fa-xmark', callback: () => null },
    ],
  });
  if (!result || result.damage <= 0) return;

  for (const token of tokens) {
    const actor = token.actor;
    if (!actor?.applyDamage) continue;
    const outcome = await actor.applyDamage(result.damage, { ignoreArmor: result.ignoreArmor });
    const blocked = result.ignoreArmor ? 0 : outcome.armorBlocked;
    ChatMessage.create({
      content: \`
        <div class="cyberpunk-blue chat-card">
          <h3>Damage Applied: \${token.name}</h3>
          <p>Raw: \${result.damage}\${blocked ? ' — SP blocked: ' + blocked : ''} — HP lost: <strong>\${outcome.hpLoss}</strong></p>
        </div>
      \`,
    });
  }
  return;
}

// ── Player branch ──
const targets = [...game.user.targets];
if (targets.length !== 1) { ui.notifications.warn('Target exactly one token.'); return; }
const targetActor = targets[0].actor;
if (!targetActor?.applyDamage) { ui.notifications.warn('No valid target actor.'); return; }

const result = await foundry.applications.api.DialogV2.wait({
  window: { title: 'Apply Damage' },
  content: \`
    <div class="cyberpunk-blue" style="padding:0.5rem; display:flex; flex-direction:column; gap:0.5rem;">
      <p>Apply to: <strong>\${targetActor.name}</strong></p>
      <label>Damage: <input type="number" id="dmg-input" value="0" min="0" style="width:5rem;" /></label>
      <p style="opacity:0.7; font-size:0.9em;">Armor (SP) is applied automatically.</p>
    </div>
  \`,
  buttons: [
    { action: 'apply', label: 'Apply', icon: 'fas fa-heart-crack', default: true,
      callback: (e, btn) => ({ damage: Number(btn.form.elements['dmg-input'].value) }) },
    { action: 'cancel', label: 'Cancel', icon: 'fas fa-xmark', callback: () => null },
  ],
});
if (!result || result.damage <= 0) return;

// Owned target → apply directly and report the outcome; unowned → delegate to
// the GM (who computes SP/HP silently), so we can only announce the raw amount.
if (targetActor.isOwner) {
  const outcome = await targetActor.applyDamage(result.damage);
  ChatMessage.create({
    content: \`<div class="cyberpunk-blue chat-card"><h3>Damage Applied: \${targetActor.name}</h3><p>Raw: \${result.damage}\${outcome.armorBlocked ? ' — SP blocked: ' + outcome.armorBlocked : ''} — HP lost: <strong>\${outcome.hpLoss}</strong></p></div>\`,
  });
} else {
  await game.cyberpunkblue.delegate.applyDamage(targetActor, result.damage);
  ChatMessage.create({
    content: \`<div class="cyberpunk-blue chat-card"><h3>Damage Sent: \${targetActor.name}</h3><p>Raw: <strong>\${result.damage}\</strong> (armor applied by the GM).</p></div>\`,
  });
}
})();
`;

// ─── Heal / Restore HP macro ──────────────────────────────────────────────────

export const HEAL_HP_MACRO = `
(async () => {
// ── Heal / Restore HP ─────────────────────────────────────────────────────────
// GM: restores HP to the SELECTED tokens (capped at max HP), no checks.
// Player: restores HP to the ONE token they TARGET. The write is routed to the
//     GM if the player doesn't own the target (game.cyberpunkblue.delegate).

const healActor = async (actor, amount) => {
  const current = actor.system.resources.hp.value ?? 0;
  const max = actor.system.resources.hp.max ?? current;
  const next = Math.min(current + amount, max);
  if (next === current) return 0;
  await game.cyberpunkblue.delegate.updateActor(actor, { 'system.resources.hp.value': next });
  return next - current;
};

if (game.user.isGM) {
  const tokens = canvas.tokens.controlled;
  if (!tokens.length) {
    ui.notifications.warn('Select one or more tokens first.');
    return;
  }
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: 'Heal / Restore HP' },
    content: \`
      <div class="cyberpunk-blue" style="padding:0.5rem; display:flex; flex-direction:column; gap:0.5rem;">
        <p>Heal: <strong>\${tokens.map(t => t.name).join(', ')}</strong></p>
        <label>HP to restore: <input type="number" id="heal-input" value="0" min="0" style="width:5rem;" /></label>
      </div>
    \`,
    buttons: [
      { action: 'heal', label: 'Heal', icon: 'fas fa-heart', default: true,
        callback: (e, btn) => ({ amount: Number(btn.form.elements['heal-input'].value) })
      },
      { action: 'cancel', label: 'Cancel', icon: 'fas fa-xmark', callback: () => null },
    ],
  });
  if (!result || result.amount <= 0) return;
  for (const token of tokens) {
    if (token.actor) await healActor(token.actor, result.amount);
  }
  ui.notifications.info(\`Restored up to \${result.amount} HP to \${tokens.length} token(s).\`);
  return;
}

// ── Player branch ──
const targets = [...game.user.targets];
if (targets.length !== 1) { ui.notifications.warn('Target exactly one token.'); return; }
const targetActor = targets[0].actor;
if (!targetActor) { ui.notifications.warn('No valid target actor.'); return; }

const result = await foundry.applications.api.DialogV2.wait({
  window: { title: 'Heal / Restore HP' },
  content: \`
    <div class="cyberpunk-blue" style="padding:0.5rem; display:flex; flex-direction:column; gap:0.5rem;">
      <p>Heal: <strong>\${targetActor.name}</strong></p>
      <label>HP to restore: <input type="number" id="heal-input" value="0" min="0" style="width:5rem;" /></label>
    </div>
  \`,
  buttons: [
    { action: 'heal', label: 'Heal', icon: 'fas fa-heart', default: true,
      callback: (e, btn) => ({ amount: Number(btn.form.elements['heal-input'].value) }) },
    { action: 'cancel', label: 'Cancel', icon: 'fas fa-xmark', callback: () => null },
  ],
});
if (!result || result.amount <= 0) return;
const healed = await healActor(targetActor, result.amount);
ChatMessage.create({
  content: \`<div class="cyberpunk-blue chat-card"><p><i class="fas fa-heart"></i> <strong>\${targetActor.name}</strong> restored <strong>\${healed}</strong> HP.</p></div>\`,
});
})();
`;

// ─── Advance Death State macro ────────────────────────────────────────────────

export const ADVANCE_DEATH_STATE_MACRO = `
(async () => {
// ── Advance Death State ───────────────────────────────────────────────────────
// GM macro. Adds the per-minute Death State increase to the selected dead
// token(s). (Base penalty, post-death damage and post-death critical injuries
// are tracked automatically; this covers the GM-handled "1 per minute" part.)

if (!game.user.isGM) { ui.notifications.warn('GM only.'); return; }

const dead = canvas.tokens.controlled.map(t => t.actor).filter(a => a?.isDead?.());
if (!dead.length) { ui.notifications.warn('Select one or more dead tokens.'); return; }

const result = await foundry.applications.api.DialogV2.wait({
  window: { title: 'Advance Death State' },
  content: \`<div class="cyberpunk-blue" style="padding:0.5rem;">
    <p>Add elapsed minutes (+1 Death State each) to: <strong>\${dead.map(a => a.name).join(', ')}</strong></p>
    <label>Minutes: <input type="number" name="minutes" value="1" min="1" style="width:5rem;" /></label>
  </div>\`,
  buttons: [
    { action: 'apply', label: 'Advance', icon: 'fas fa-hourglass-half', default: true,
      callback: (_e, btn) => Math.max(1, Number(btn.form.elements['minutes'].value) || 1) },
    { action: 'cancel', label: 'Cancel', icon: 'fas fa-xmark', callback: () => null },
  ],
});
if (!result) return;

for (const a of dead) await a.advanceDeathState(result);
const lines = dead.map(a => {
  const ds = a.getDeadEffect()?.getFlag('cyberpunk-blue', 'deathState')?.total ?? '?';
  return \`<li><strong>\${a.name}</strong>: Death State \${ds}/10</li>\`;
}).join('');
ChatMessage.create({ content: \`<div class="cyberpunk-blue chat-card"><h3>Death State advanced (+\${result} min)</h3><ul style="margin:.3rem 0 0 1rem;">\${lines}</ul></div>\` });
})();
`;

// ─── Catalogue ────────────────────────────────────────────────────────────────

export const MACRO_CATALOGUE = [
  {
    name: 'Advance Death State',
    type: 'script',
    img: 'icons/svg/tombstone.svg',
    command: ADVANCE_DEATH_STATE_MACRO,
    _folder: 'GM Tools',
  },
  {
    name: 'Request Skill Check',
    type: 'script',
    img: 'icons/svg/d10-grey.svg',
    command: REQUEST_SKILL_CHECK_MACRO,
    _folder: 'GM Tools',
  },
  {
    name: 'Apply Damage',
    type: 'script',
    img: 'icons/svg/sword.svg',
    command: APPLY_DAMAGE_MACRO,
    _folder: 'GM Tools',
  },
  {
    name: 'Heal / Restore HP',
    type: 'script',
    img: 'icons/svg/heal.svg',
    command: HEAL_HP_MACRO,
    _folder: 'GM Tools',
  },
  {
    name: 'Quick Fix',
    type: 'script',
    img: 'icons/svg/heal.svg',
    command: QUICK_FIX_MACRO,
    _folder: 'Medical',
  },
  {
    name: 'Treatment',
    type: 'script',
    img: 'icons/svg/aura.svg',
    command: TREATMENT_MACRO,
    _folder: 'Medical',
  },
  {
    name: 'Stabilize',
    type: 'script',
    img: 'icons/svg/anchor.svg',
    command: STABILIZE_MACRO,
    _folder: 'Medical',
  },
  {
    name: 'Natural Healing',
    type: 'script',
    img: 'icons/svg/sun.svg',
    command: NATURAL_HEALING_MACRO,
    _folder: 'Medical',
  },
  {
    name: 'Apply Table Effect',
    type: 'script',
    img: 'icons/svg/dice-target.svg',
    command: APPLY_TABLE_EFFECT_MACRO,
    _folder: 'Combat Effects',
  },
  {
    name: 'Remove Table Effects',
    type: 'script',
    img: 'icons/svg/cancel.svg',
    command: REMOVE_TABLE_EFFECTS_MACRO,
    _folder: 'Combat Effects',
  },
  {
    name: 'Clear Role-Granted Items',
    type: 'script',
    img: 'icons/svg/item-bag.svg',
    command: CLEAR_ROLE_GRANTED_ITEMS_MACRO,
    _folder: 'GM Tools',
  },
  {
    name: 'Adjust Improvement Points',
    type: 'script',
    img: 'icons/svg/upgrade.svg',
    command: ADJUST_IMPROVEMENT_POINTS_MACRO,
    _folder: 'GM Tools',
  },
];
