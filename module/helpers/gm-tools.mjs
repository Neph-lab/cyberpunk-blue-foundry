const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const GM_MACROS = [
  {
    name: 'Request Skill Check',
    img: 'icons/svg/d10-grey.svg',
    command: `// Cyberpunk Blue - Request Skill Check
// Select tokens first (optional) or leave unselected for all players

const skillOptions = Object.entries(CONFIG.CYBER_BLUE.skills)
  .map(([slug, data]) => \`<option value="\${slug}">\${data.label} (\${data.stat.toUpperCase()})</option>\`)
  .join('');

const result = await foundry.applications.api.DialogV2.wait({
  window: { title: 'Request Skill Check' },
  content: \`
    <div class="cyberpunk-blue" style="padding:0.5rem; display:flex; flex-direction:column; gap:0.5rem;">
      <label>Skill: <select id="skill-select">\${skillOptions}</select></label>
      <label>DV: <input type="number" id="dv-input" value="15" min="1" style="width:5rem;" /></label>
      <label style="display:flex;align-items:center;gap:0.5rem;"><input type="checkbox" id="secret-check" /> Secret roll</label>
    </div>
  \`,
  buttons: [
    { action: 'request', label: 'Send Request', icon: 'fas fa-dice-d10', default: true,
      callback: (e, btn) => ({
        skill: btn.form.elements['skill-select'].value,
        dv: Number(btn.form.elements['dv-input'].value),
        secret: btn.form.elements['secret-check'].checked,
      })
    },
    { action: 'cancel', label: 'Cancel', icon: 'fas fa-xmark', callback: () => null },
  ],
});

if (!result) return;
const skillData = CONFIG.CYBER_BLUE.skills[result.skill];
const dvText = result.dv > 0 ? \` (DV \${result.dv})\` : '';
const secretText = result.secret ? ' [SECRET]' : '';

await ChatMessage.create({
  content: \`
    <div class="cyberpunk-blue chat-card">
      <h3>Skill Check Request\${secretText}</h3>
      <p>Roll <strong>\${skillData.label}</strong> (\${skillData.stat.toUpperCase()})\${dvText}</p>
      <p><em>Click your character's skill on your sheet to roll.</em></p>
    </div>
  \`,
  type: result.secret ? CONST.CHAT_MESSAGE_STYLES.WHISPER : CONST.CHAT_MESSAGE_STYLES.OTHER,
  whisper: result.secret ? ChatMessage.getWhisperRecipients('GM') : [],
});`,
    type: CONST.MACRO_TYPES.SCRIPT,
  },
  {
    name: 'Apply Damage',
    img: 'icons/svg/sword.svg',
    command: `// Cyberpunk Blue - Apply Damage to Selected Tokens
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
  const net = outcome.hpLoss;
  ChatMessage.create({
    content: \`
      <div class="cyberpunk-blue chat-card">
        <h3>Damage Applied: \${token.name}</h3>
        <p>Raw: \${result.damage}${blocked ? \` — SP blocked: \${blocked}\` : ''} — HP lost: <strong>\${net}</strong></p>
      </div>
    \`,
  });
}`,
    type: CONST.MACRO_TYPES.SCRIPT,
  },
  {
    name: 'Heal / Restore HP',
    img: 'icons/svg/heal.svg',
    command: `// Cyberpunk Blue - Heal Selected Tokens
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
  const actor = token.actor;
  if (!actor) continue;
  const current = actor.system.resources.hp.value ?? 0;
  const max = actor.system.resources.hp.max ?? current;
  const next = Math.min(current + result.amount, max);
  await actor.update({ 'system.resources.hp.value': next });
}
ui.notifications.info(\`Restored \${result.amount} HP to \${tokens.length} token(s).\`);`,
    type: CONST.MACRO_TYPES.SCRIPT,
  },
];

export class CyberBlueMacroCreator extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'cyberpunk-blue-macro-creator',
    window: { title: 'CYBER_BLUE.Settings.CreateMacros.Label' },
    position: { width: 400 },
  };

  async _renderHTML() {
    const div = document.createElement('div');
    div.style.cssText = 'padding:1rem; display:flex; flex-direction:column; gap:0.5rem;';
    div.innerHTML = `
      <p>Creates useful GM macros in your Macro directory:</p>
      <ul style="margin:0.5rem 0 0.5rem 1rem;">
        ${GM_MACROS.map((m) => `<li><strong>${m.name}</strong></li>`).join('')}
      </ul>
      <p style="color:var(--color-text-light-6);font-size:0.9em;">Existing macros with the same name will be updated.</p>
      <button id="create-macros-btn" type="button">
        <i class="fas fa-code"></i> Create Macros
      </button>
    `;
    div.querySelector('#create-macros-btn').addEventListener('click', async () => {
      await this._createMacros();
      this.close();
    });
    return div;
  }

  async _createMacros() {
    let created = 0;
    let updated = 0;
    for (const macroData of GM_MACROS) {
      const existing = game.macros.find((m) => m.name === macroData.name);
      if (existing) {
        await existing.update({ command: macroData.command, img: macroData.img });
        updated++;
      } else {
        await Macro.create({ ...macroData, ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER } });
        created++;
      }
    }
    ui.notifications.info(`Cyberpunk Blue: Created ${created} macro(s), updated ${updated}.`);
  }
}

export class CyberBlueJsonImportDialog extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: 'cyberpunk-blue-json-import',
    window: { title: 'CYBER_BLUE.Settings.ImportItems.Label' },
    position: { width: 500 },
  };

  async _renderHTML() {
    const div = document.createElement('div');
    div.style.cssText = 'padding:1rem; display:flex; flex-direction:column; gap:0.75rem;';
    div.innerHTML = `
      <p>Import items from a JSON file. The file should be an array of item objects, or a single item object.</p>
      <label>
        <span>Target folder (optional):</span>
        <select id="import-folder-select" style="width:100%;">
          <option value="">(No folder)</option>
          ${game.folders.filter((f) => f.type === 'Item').map((f) => `<option value="${f.id}">${f.name}</option>`).join('')}
        </select>
      </label>
      <label>
        JSON File: <input type="file" id="import-file" accept=".json" />
      </label>
      <div id="import-preview" style="max-height:200px;overflow-y:auto;font-size:0.85em;color:var(--color-text-light-6);"></div>
      <button id="import-btn" type="button" disabled>
        <i class="fas fa-file-import"></i> Import Items
      </button>
      <div id="import-status"></div>
    `;

    let parsedItems = [];
    const preview = div.querySelector('#import-preview');
    const importBtn = div.querySelector('#import-btn');

    div.querySelector('#import-file').addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          parsedItems = Array.isArray(data) ? data : [data];
          preview.innerHTML = `<strong>${parsedItems.length} item(s) found:</strong><br>${parsedItems.slice(0, 10).map((i) => `• ${i.name ?? '(unnamed)'} (${i.type ?? '?'})`).join('<br>')}${parsedItems.length > 10 ? `<br>…and ${parsedItems.length - 10} more` : ''}`;
          importBtn.disabled = false;
        } catch (err) {
          preview.innerHTML = `<span style="color:var(--color-level-error);">Invalid JSON: ${err.message}</span>`;
          importBtn.disabled = true;
        }
      };
      reader.readAsText(file);
    });

    importBtn.addEventListener('click', async () => {
      const folderId = div.querySelector('#import-folder-select').value || undefined;
      const status = div.querySelector('#import-status');
      importBtn.disabled = true;
      status.textContent = 'Importing…';
      try {
        const toCreate = parsedItems
          .filter((item) => item.type && CONFIG.Item.dataModels[item.type])
          .map((item) => ({ ...item, folder: folderId ?? item.folder }));
        if (!toCreate.length) throw new Error('No valid item types found in data.');
        const created = await Item.createDocuments(toCreate);
        status.innerHTML = `<span style="color:var(--color-level-success);">Imported ${created.length} item(s) successfully.</span>`;
        ui.notifications.info(`Cyberpunk Blue: Imported ${created.length} items.`);
        parsedItems = [];
      } catch (err) {
        status.innerHTML = `<span style="color:var(--color-level-error);">Error: ${err.message}</span>`;
        importBtn.disabled = false;
      }
    });

    return div;
  }
}
