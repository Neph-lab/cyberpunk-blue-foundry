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
        <p>Raw: \${result.damage}\${blocked ? ' — SP blocked: ' + blocked : ''} — HP lost: <strong>\${net}</strong></p>
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

/**
 * Minimal ApplicationV2 base for the system's simple settings dialogs. Each
 * subclass builds its UI imperatively in `_renderHTML` (returning a single root
 * element); this base supplies the `_replaceHTML` the v14 ApplicationV2 render
 * lifecycle requires to mount that element into the window content. Without it,
 * Foundry throws "does not implement the abstract methods _renderHTML and
 * _replaceHTML" when the dialog is opened.
 */
class CyberBlueSimpleDialog extends ApplicationV2 {
  _replaceHTML(result, content, _options) {
    content.replaceChildren(result);
  }
}

export class CyberBlueMacroCreator extends CyberBlueSimpleDialog {
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
    return div;
  }

  async _onRender(_context, _options) {
    this.element.querySelector('#create-macros-btn')
      ?.addEventListener('click', async () => {
        await this._createMacros();
        this.close();
      });
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

export class CyberBlueJsonImportDialog extends CyberBlueSimpleDialog {
  static DEFAULT_OPTIONS = {
    id: 'cyberpunk-blue-json-import',
    window: { title: 'CYBER_BLUE.Settings.ImportItems.Label' },
    position: { width: 500 },
  };

  _parsedItems = [];

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
    return div;
  }

  async _onRender(_context, _options) {
    const preview = this.element.querySelector('#import-preview');
    const importBtn = this.element.querySelector('#import-btn');

    this.element.querySelector('#import-file')?.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          this._parsedItems = Array.isArray(data) ? data : [data];
          preview.innerHTML = `<strong>${this._parsedItems.length} item(s) found:</strong><br>${this._parsedItems.slice(0, 10).map((i) => `• ${i.name ?? '(unnamed)'} (${i.type ?? '?'})`).join('<br>')}${this._parsedItems.length > 10 ? `<br>…and ${this._parsedItems.length - 10} more` : ''}`;
          importBtn.disabled = false;
        } catch (err) {
          preview.innerHTML = `<span style="color:var(--color-level-error);">Invalid JSON: ${err.message}</span>`;
          importBtn.disabled = true;
        }
      };
      reader.readAsText(file);
    });

    importBtn?.addEventListener('click', async () => {
      const folderId = this.element.querySelector('#import-folder-select').value || undefined;
      const status = this.element.querySelector('#import-status');
      importBtn.disabled = true;
      status.textContent = 'Importing…';
      try {
        const toCreate = this._parsedItems
          .filter((item) => item.type && CONFIG.Item.dataModels[item.type])
          .map((item) => ({ ...item, folder: folderId ?? item.folder }));
        if (!toCreate.length) throw new Error('No valid item types found in data.');
        const created = await Item.createDocuments(toCreate);
        status.innerHTML = `<span style="color:var(--color-level-success);">Imported ${created.length} item(s) successfully.</span>`;
        ui.notifications.info(`Cyberpunk Blue: Imported ${created.length} items.`);
        this._parsedItems = [];
      } catch (err) {
        status.innerHTML = `<span style="color:var(--color-level-error);">Error: ${err.message}</span>`;
        importBtn.disabled = false;
      }
    });
  }
}

/**
 * Import weapon items into the system's `weapons` compendium pack, automatically
 * creating one folder per weapon type (Medium Pistol, Assault Rifle, etc.).
 *
 * Expected JSON format: an array of Foundry Item create-data objects of type
 * 'gear' or 'cyberware', each carrying at least one entry in `system.weapons`.
 * The first weapon entry's `type` determines the folder. Items already declaring
 * `folder` keep their value.
 *
 * Mods (item.type === 'mod') are routed to the `weapon-mods` pack instead, with
 * folders named after their `system.modType` (e.g., "Weapon Mod").
 */
export class CyberBlueWeaponImportDialog extends CyberBlueSimpleDialog {
  static DEFAULT_OPTIONS = {
    id: 'cyberpunk-blue-weapon-import',
    window: { title: 'CYBER_BLUE.Settings.ImportWeapons.Label' },
    position: { width: 560 },
  };

  _parsedItems = [];

  async _renderHTML() {
    const div = document.createElement('div');
    div.style.cssText = 'padding:1rem; display:flex; flex-direction:column; gap:0.75rem;';
    div.innerHTML = `
      <p>Import weapons (gear / cyberware) into the <strong>Weapons</strong> compendium, organised into folders by weapon type. Mod items are routed to <strong>Weapon Mods</strong>.</p>
      <label>JSON file: <input type="file" id="weapon-import-file" accept=".json" /></label>
      <div id="weapon-import-preview" style="max-height:220px;overflow-y:auto;font-size:0.85em;color:var(--color-text-light-6);"></div>
      <button id="weapon-import-btn" type="button" disabled>
        <i class="fas fa-file-import"></i> Import to Compendium
      </button>
      <div id="weapon-import-status"></div>
    `;
    return div;
  }

  async _onRender(_context, _options) {
    const preview = this.element.querySelector('#weapon-import-preview');
    const importBtn = this.element.querySelector('#weapon-import-btn');
    const status = this.element.querySelector('#weapon-import-status');

    this.element.querySelector('#weapon-import-file')?.addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          this._parsedItems = Array.isArray(data) ? data : [data];
          const summary = this._summarise(this._parsedItems);
          preview.innerHTML = `<strong>${this._parsedItems.length} item(s) found:</strong><br>${summary}`;
          importBtn.disabled = false;
        } catch (err) {
          preview.innerHTML = `<span style="color:var(--color-level-error);">Invalid JSON: ${err.message}</span>`;
          importBtn.disabled = true;
        }
      };
      reader.readAsText(file);
    });

    importBtn?.addEventListener('click', async () => {
      importBtn.disabled = true;
      status.textContent = 'Importing…';
      try {
        const result = await this._import(this._parsedItems);
        status.innerHTML = `<span style="color:var(--color-level-success);">Imported ${result.created} item(s) into ${result.folders} folder(s).</span>`;
        ui.notifications.info(`Cyberpunk Blue: Imported ${result.created} items into the Weapons compendium.`);
        this._parsedItems = [];
      } catch (err) {
        status.innerHTML = `<span style="color:var(--color-level-error);">Error: ${err.message}</span>`;
        importBtn.disabled = false;
      }
    });
  }

  _summarise(items) {
    const byFolder = new Map();
    for (const item of items) {
      const { folderName } = this._classify(item);
      byFolder.set(folderName, (byFolder.get(folderName) ?? 0) + 1);
    }
    return [...byFolder.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([folder, count]) => `• <strong>${folder}</strong>: ${count}`)
      .join('<br>');
  }

  /** Decide which compendium pack and folder this item belongs to. */
  _classify(item) {
    if (item?.type === 'mod') {
      const sub = item?.system?.modType ?? 'weaponMod';
      const labels = {
        weaponMod: 'Weapon Mod',
        gearMod: 'Gear Mod',
        cyberwareMod: 'Cyberware Mod',
        hardwareMod: 'Hardware Mod',
      };
      return { packId: 'cyberpunk-blue.weapon-mods', folderName: labels[sub] ?? 'Mods' };
    }
    const firstWeapon = item?.system?.weapons?.[0];
    const typeKey = firstWeapon?.type ?? 'lightMelee';
    const def = game.cyberpunkblue?.combat?.applyWeaponTypeDefaults
      ? Object.values(game.cyberpunkblue.config?.combat?.weaponTypeMap ?? {}).find?.((w) => w?.value === typeKey)
      : null;
    // Fall back to a built-in label table so the dialog never produces a slug-named folder.
    const fallbackLabels = {
      lightMelee: 'Light Melee Weapon', mediumMelee: 'Medium Melee Weapon',
      heavyMelee: 'Heavy Melee Weapon', veryHeavyMelee: 'Very Heavy Melee Weapon',
      mediumPistol: 'Medium Pistol', heavyPistol: 'Heavy Pistol', veryHeavyPistol: 'Very Heavy Pistol',
      smg: 'SMG', heavySmg: 'Heavy SMG', shotgun: 'Shotgun',
      assaultRifle: 'Assault Rifle', precisionRifle: 'Precision Rifle',
      machineGun: 'Machine Gun', sniperRifle: 'Sniper Rifle',
      grenadeLauncher: 'Grenade Launcher', rocketLauncher: 'Rocket Launcher',
      flamethrower: 'Flamethrower', bowCrossbow: 'Bow / Crossbow', thrown: 'Thrown',
    };
    const folderName = def?.label ?? fallbackLabels[typeKey] ?? typeKey;
    return { packId: 'cyberpunk-blue.weapons', folderName };
  }

  /** Find or create a top-level folder of the given name in the given pack. */
  async _ensureFolder(pack, name) {
    await pack.getIndex({ fields: ['name', 'type'] });
    const existing = pack.folders.find((f) => f.name === name);
    if (existing) return existing;
    return Folder.create({
      name,
      type: 'Item',
      sorting: 'a',
      color: null,
    }, { pack: pack.collection });
  }

  /** Import the parsed list, grouped by pack + folder. Unlocks/relocks each pack. */
  async _import(items) {
    if (!items?.length) throw new Error('No items to import.');

    // Group by pack
    const byPack = new Map();
    for (const item of items) {
      const { packId, folderName } = this._classify(item);
      if (!byPack.has(packId)) byPack.set(packId, new Map());
      const byFolder = byPack.get(packId);
      if (!byFolder.has(folderName)) byFolder.set(folderName, []);
      byFolder.get(folderName).push(item);
    }

    let totalCreated = 0;
    let totalFolders = 0;

    for (const [packId, byFolder] of byPack.entries()) {
      const pack = game.packs.get(packId);
      if (!pack) {
        ui.notifications.warn(`Pack "${packId}" not found — skipping its items.`);
        continue;
      }
      await pack.configure({ locked: false });
      try {
        for (const [folderName, group] of byFolder.entries()) {
          const folder = await this._ensureFolder(pack, folderName);
          if (folder) totalFolders++;
          // Strip _id so Foundry mints fresh IDs (avoids collisions across imports)
          const cleaned = group.map((it) => {
            const copy = foundry.utils.deepClone(it);
            delete copy._id;
            copy.folder = folder?.id ?? null;
            return copy;
          });
          if (cleaned.length) {
            const created = await Item.createDocuments(cleaned, { pack: packId });
            totalCreated += created.length;
          }
        }
      } finally {
        await pack.configure({ locked: true });
      }
    }

    return { created: totalCreated, folders: totalFolders };
  }
}

/**
 * Settings-menu action: re-run the role starting-gear sync.
 * Clicking the menu button shows a confirm dialog, then runs the sync.
 */
export class CyberBlueResyncStartingGear extends CyberBlueSimpleDialog {
  static DEFAULT_OPTIONS = {
    id: 'cyberpunk-blue-resync-starting-gear',
    window: { title: 'Re-sync Role Starting Gear' },
    position: { width: 360 },
  };

  async _renderHTML() {
    const div = document.createElement('div');
    div.style.cssText = 'padding:1rem;';
    div.innerHTML = `
      <p>This will resolve all role starting-gear item names to UUIDs and update the Roles compendium.</p>
      <p>Items not yet in the world will be imported from their compendiums.</p>
      <p>Safe to run multiple times.</p>
      <div style="text-align:right; margin-top:0.75rem;">
        <button id="cpb-resync-btn" type="button">
          <i class="fas fa-sync"></i> Run Sync
        </button>
      </div>
    `;
    div.querySelector('#cpb-resync-btn').addEventListener('click', async () => {
      const { syncRoleGrantedItemGroups } = await import('./world-init.mjs');
      await syncRoleGrantedItemGroups();
      this.close();
    });
    return div;
  }
}
