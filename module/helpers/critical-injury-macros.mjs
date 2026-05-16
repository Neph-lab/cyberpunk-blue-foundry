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
// Target a wounded actor. Make a Medicine check.
//   Dying (HP ≤ 0): DV 15. Success sets them to 1 HP and makes them Unconscious.
//   Seriously Wounded (HP ≤ SWT) but not Dying: DV 13.
//   Below max HP but not Seriously Wounded: DV 10.
// A stabilized character can regain HP from Natural Healing.

const targets = [...game.user.targets];
if (targets.length !== 1) { ui.notifications.warn('Target exactly one actor.'); return; }
const targetActor = targets[0].actor;
if (!targetActor) { ui.notifications.warn('No valid target actor.'); return; }

const hp = targetActor.system?.resources?.hp?.value ?? 0;
const hpMax = targetActor.system?.resources?.hp?.max ?? 1;
const swt = targetActor.system?.resources?.seriousWoundThreshold?.value ?? Math.floor(hpMax / 2);

if (hp >= hpMax) {
  ui.notifications.warn(\`\${targetActor.name} is at full HP and does not need stabilization.\`);
  return;
}

// Check if already stabilized
const alreadyStabilized = targetActor.getFlag('cyberpunk-blue', 'stabilized');
if (alreadyStabilized) {
  ui.notifications.warn(\`\${targetActor.name} is already stabilized.\`);
  return;
}

const isDying = hp <= 0;
const isSeriouslyWounded = hp <= swt;

let dv;
let situationLabel;
if (isDying) {
  dv = 15;
  situationLabel = 'Dying (DV 15)';
} else if (isSeriouslyWounded) {
  dv = 13;
  situationLabel = 'Seriously Wounded (DV 13)';
} else {
  dv = 10;
  situationLabel = 'Wounded (DV 10)';
}

const treater = _getTreatingActor();
if (!treater) { ui.notifications.warn('Could not identify treating character.'); return; }

const roll = await _rollMedicine(treater, dv, \`Stabilize \${targetActor.name} — \${situationLabel}\`);

if (roll.total >= dv) {
  const updates = {};
  if (isDying) {
    updates['system.resources.hp.value'] = 1;
    // Apply Unconscious condition via Foundry's built-in system
    await targetActor.toggleStatusEffect('unconscious', { active: true });
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: treater }),
      content: \`<div class="cyberpunk-blue chat-card"><p><i class="fas fa-heartbeat"></i> <strong>\${targetActor.name}</strong> has been stabilized from Dying. Set to 1 HP and is now Unconscious.</p></div>\`,
    });
  } else {
    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: treater }),
      content: \`<div class="cyberpunk-blue chat-card"><p><i class="fas fa-heartbeat"></i> <strong>\${targetActor.name}</strong> has been stabilized and can now benefit from Natural Healing.</p></div>\`,
    });
  }
  await targetActor.setFlag('cyberpunk-blue', 'stabilized', true);
} else {
  ui.notifications.warn(\`Stabilization failed (rolled \${roll.total} vs DV \${dv}).\`);
}
})();
`;

// ─── Natural Healing macro ───────────────────────────────────────────────────

export const NATURAL_HEALING_MACRO = `
(async () => {
${_MACRO_SHARED}
// ── Natural Healing ───────────────────────────────────────────────────────────
// GM macro. Run once per day of rest.
//   - Stabilized actors on the current scene regain HP equal to their BODY stat.
//   - If a Medtech character has a token in the scene, they can distribute
//     bonus healing equal to 2 × their Medtech rank to OTHER actors.
//     Doing so means THEY do not rest and do not gain their own HP.

if (!game.user.isGM) { ui.notifications.warn('Natural Healing is a GM-only macro.'); return; }

const scene = canvas?.scene;
if (!scene) { ui.notifications.warn('No active scene.'); return; }

// Find all actors with tokens on the current scene
const sceneTokens = scene.tokens.contents;
const sceneActors = sceneTokens
  .map(t => t.actor)
  .filter(a => a && (a.type === 'character' || a.type === 'npc'));

if (!sceneActors.length) { ui.notifications.warn('No character actors have tokens in the current scene.'); return; }

// Find actors who are stabilized (or have HP below max but are not at max and not dying)
const healingCandidates = sceneActors.filter(a => {
  const hp = a.system?.resources?.hp?.value ?? 0;
  const hpMax = a.system?.resources?.hp?.max ?? 1;
  if (hp >= hpMax) return false; // at full HP, no need to heal
  if (hp <= 0) return false; // dying — must be stabilized first
  const stabilized = a.getFlag('cyberpunk-blue', 'stabilized') ?? false;
  return stabilized;
});

// Find Medtech actors in the scene
const medtechActors = sceneActors.filter(a => _getMedtechRole(a) !== null);

// Build base healing amounts: BODY per stabilized actor
const healingMap = new Map();
for (const actor of healingCandidates) {
  const body = actor.system?.stats?.body?.value ?? 1;
  healingMap.set(actor.id, { actor, baseHp: body, bonusHp: 0 });
}

if (!healingMap.size) {
  ui.notifications.warn('No stabilized characters in the scene need healing.');
  return;
}

// ── Medtech bonus healing dialog ──
let medtechHealing = []; // { medtech, targets: [ {actor, hp} ] }
let medtechResting = new Set(medtechActors.map(a => a.id)); // Medtechs who rest (get their own healing)

for (const medtech of medtechActors) {
  const medtechRole = _getMedtechRole(medtech);
  const medtechRank = medtechRole?.system?.rank ?? 0;
  if (medtechRank <= 0) continue;
  const bonusPool = medtechRank * 2;

  // Potential recipients: stabilized actors OTHER than the medtech themselves
  const recipients = healingCandidates.filter(a => a.id !== medtech.id);
  if (!recipients.length) continue;

  const recipientOptions = recipients.map(a => {
    const entry = healingMap.get(a.id);
    const hpMax = a.system?.resources?.hp?.max ?? 1;
    const hp = a.system?.resources?.hp?.value ?? 0;
    const missing = hpMax - hp;
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
          <div style="display:flex;flex-direction:column;gap:.3rem;margin-top:.5rem;">
            \${recipientOptions}
          </div>
          <p id="remaining-label" style="margin-top:.4rem;">Remaining: \${bonusPool}</p>
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
    // Medtech is distributing — they do not rest
    medtechResting.delete(medtech.id);
    for (const { actorId, hp } of choice) {
      if (healingMap.has(actorId)) {
        healingMap.get(actorId).bonusHp += hp;
      }
    }
  }
}

// ── Apply healing ──
const lines = [];
for (const { actor, baseHp, bonusHp } of healingMap.values()) {
  // Only resting actors get base healing
  const isResting = medtechResting.has(actor.id) || !medtechActors.some(m => m.id === actor.id);
  const totalHp = (isResting ? baseHp : 0) + bonusHp;
  if (totalHp <= 0) continue;
  const currentHp = actor.system?.resources?.hp?.value ?? 0;
  const hpMax = actor.system?.resources?.hp?.max ?? 1;
  const newHp = Math.min(currentHp + totalHp, hpMax);
  await actor.update({ 'system.resources.hp.value': newHp });
  const gained = newHp - currentHp;
  lines.push(\`<li><strong>\${actor.name}</strong>: +\${gained} HP (to \${newHp}/\${hpMax})\${bonusHp ? \` (\${baseHp} base + \${bonusHp} Medtech bonus)\` : ''}</li>\`);
}

// Non-resting Medtechs don't get base healing
for (const medtech of medtechActors) {
  if (!medtechResting.has(medtech.id)) {
    lines.push(\`<li><em>\${medtech.name}</em> distributed bonus healing and did not rest — no HP recovery.</li>\`);
  }
}

if (!lines.length) {
  ui.notifications.info('Natural Healing: no HP was gained (nothing to heal).');
  return;
}

ChatMessage.create({
  content: \`<div class="cyberpunk-blue chat-card">
    <h3><i class="fas fa-bed"></i> Natural Healing</h3>
    <ul style="margin:.3rem 0 0 1rem;">\${lines.join('')}</ul>
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

// ─── Catalogue ────────────────────────────────────────────────────────────────

export const MACRO_CATALOGUE = [
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
];
