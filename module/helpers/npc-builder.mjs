/**
 * NPC Quick Creation — the build pipeline.
 *
 * Two halves, deliberately separated:
 *   buildNpcRecipe(selection)      — synchronous, no document access. Merges the
 *                                    three catalogue entries and resolves every
 *                                    random choice into a concrete recipe.
 *   createNpcFromRecipe(name, r)   — everything that touches documents.
 *
 * The cyberware de-duplication rules need each entry's real `integration`,
 * `cyberwareType` and `multipleInstalls`, which only exist on the resolved
 * documents — so that step lives in the async half (`normalizeCyberware`) rather
 * than duplicating catalogue metadata here.
 *
 * See docs/NPC-Quick-Creation.md for the rules this implements.
 */

import { getQuickEntry, PRIMARY_STATS, QUICK_MAX } from '../data/npc-quick-catalogue.mjs';
import { getEligiblePlatforms } from './cyberware.mjs';
import { normalizeRoleSystemData, syncAllRoleConditionAEs, syncAllProteanFociAEs } from './roles.mjs';

const FOLDER_NAME = 'NPCs';

/**
 * Flag marking cyberware whose PSYCHE cost has already been accounted for —
 * CyberBlueItem.PSYCHE_PROMPT_FLAG. Read off the registered document class
 * rather than imported, so this module stays loadable without Foundry globals.
 */
const psychePromptFlag = () => CONFIG.Item.documentClass.PSYCHE_PROMPT_FLAG;

/**
 * Anatomical cyberware: capped at two copies and pre-named (Left)/(Right).
 * The spec caps eyes, arms and legs "at 2 each" — per catalogue entry, so a
 * Standard Cyberarm and a Gorilla Arm are counted separately and a combination
 * can hand the GM three arms to prune. That's the intended failure mode.
 */
const ARM_NAMES = ['Standard Cyberarm', 'Gorilla Arm'];
const HAND_NAMES = ['Standard Cyberhand'];
const LEG_NAMES = ['Standard Cyberleg'];
const FOOT_NAMES = ['Standard Cyberfoot'];
const PAIRED_PLATFORMS = ['Standard Cybereye', ...ARM_NAMES, ...HAND_NAMES, ...LEG_NAMES, ...FOOT_NAMES];

/** Random element of an array. Returns null for an empty array. */
function pick(list) {
  return list.length ? list[Math.floor(Math.random() * list.length)] : null;
}

/** Components of one skill, from CONFIG. */
function componentsOf(skillSlug) {
  return CONFIG.CYBER_BLUE.skills?.[skillSlug]?.components ?? [];
}

// ─── Half one: the recipe ─────────────────────────────────────────────────────

/**
 * Merge one Base type + Background + Purpose and apply the Extras.
 *
 * @param {{ baseType: string, background: string, purpose: string,
 *           extras: { focused: number, scattered: number, skilled: number, hobbies: number } }} selection
 * @returns {object|null} recipe, or null if any of the three keys is unknown
 */
export function buildNpcRecipe(selection) {
  const base = getQuickEntry('baseType', selection.baseType);
  const background = getQuickEntry('background', selection.background);
  const purpose = getQuickEntry('purpose', selection.purpose);
  if (!base || !background || !purpose) return null;

  const sources = [base, background, purpose];
  const notes = [];

  // ── Stats: base type is absolute, the other two are deltas ──
  const stats = { ...base.stats };
  for (const entry of [background, purpose]) {
    for (const [slug, delta] of Object.entries(entry.statDeltas ?? {})) {
      stats[slug] = (stats[slug] ?? 0) + delta;
    }
    // Mundane's "[Random Primary Stat]: +1"
    if (entry.randomStatDelta) {
      const slug = pick(PRIMARY_STATS);
      stats[slug] += entry.randomStatDelta;
      notes.push(`Random stat bonus went to ${slug.toUpperCase()}.`);
    }
  }

  // ── Skills and components: summed across all three ──
  const skills = {};
  const components = {};
  for (const entry of sources) {
    for (const [slug, rank] of Object.entries(entry.skills ?? {})) skills[slug] = (skills[slug] ?? 0) + rank;
    for (const [slug, rank] of Object.entries(entry.components ?? {})) components[slug] = (components[slug] ?? 0) + rank;
  }

  // ── Extras ──
  // Pool membership for Skilled and Hobbies is frozen here, BEFORE any Extra
  // runs: the spec says "a Skill already assigned points in the steps before
  // Extras". So a skill Hobbies lifts from 0 to 1 never becomes eligible for
  // Skilled, and Hobbies may draw the same skill again on a later iteration.
  // Only the rank cap is re-checked per +1.
  const allSkills = Object.keys(CONFIG.CYBER_BLUE.skills ?? {});
  const trainedPool = allSkills.filter((slug) => (skills[slug] ?? 0) > 0);
  const untrainedPool = allSkills.filter((slug) => (skills[slug] ?? 0) === 0);

  const extras = selection.extras ?? {};
  const skipped = { focused: 0, scattered: 0, skilled: 0, hobbies: 0 };

  const bumpStat = (candidates) => {
    const slug = pick(candidates);
    if (!slug) return false;
    stats[slug] += 1;
    return true;
  };

  for (let i = 0; i < (extras.focused ?? 0); i += 1) {
    // Highest Primary Stats still under the cap — every tied stat is a candidate.
    const eligible = PRIMARY_STATS.filter((slug) => stats[slug] < QUICK_MAX);
    const best = Math.max(...eligible.map((slug) => stats[slug]), -Infinity);
    if (!bumpStat(eligible.filter((slug) => stats[slug] === best))) skipped.focused += 1;
  }

  for (let i = 0; i < (extras.scattered ?? 0); i += 1) {
    if (!bumpStat(PRIMARY_STATS.filter((slug) => stats[slug] < QUICK_MAX))) skipped.scattered += 1;
  }

  for (let i = 0; i < (extras.skilled ?? 0); i += 1) {
    const slug = pick(trainedPool.filter((s) => (skills[s] ?? 0) + 1 < QUICK_MAX));
    if (!slug) { skipped.skilled += 1; continue; }
    skills[slug] += 1;
    // Its Components: only ones that already have points.
    const comps = componentsOf(slug).filter((c) => (components[c] ?? 0) > 0 && (components[c] ?? 0) + 1 < QUICK_MAX);
    const comp = pick(comps);
    if (comp) components[comp] += 1;
  }

  for (let i = 0; i < (extras.hobbies ?? 0); i += 1) {
    const slug = pick(untrainedPool.filter((s) => (skills[s] ?? 0) + 1 < QUICK_MAX));
    if (!slug) { skipped.hobbies += 1; continue; }
    skills[slug] = (skills[slug] ?? 0) + 1;
    // Its Components: any of them, this is a brand-new interest.
    const comp = pick(componentsOf(slug).filter((c) => (components[c] ?? 0) + 1 < QUICK_MAX));
    if (comp) components[comp] = (components[comp] ?? 0) + 1;
  }

  // ── Cyberware requests, merged with counts (normalized later, needs the docs) ──
  const cyberware = [];
  for (const entry of sources) {
    for (const request of entry.cyberware ?? []) {
      const existing = cyberware.find((r) => r.name === request.name);
      if (existing) existing.count += request.count;
      else cyberware.push({ name: request.name, count: request.count });
    }
  }

  // ── Gear: one entry per name with the quantities summed ──
  const gear = [];
  for (const entry of sources) {
    for (const request of entry.gear ?? []) {
      const existing = gear.find((r) => r.name === request.name);
      if (existing) existing.qty += request.qty;
      else gear.push({ name: request.name, qty: request.qty });
    }
  }

  // ── Abilities: merge by name, keep the higher rank ──
  const abilities = [];
  for (const entry of sources) {
    for (const request of entry.abilities ?? []) {
      const existing = abilities.find((a) => a.name === request.name);
      if (existing) existing.rank = Math.max(existing.rank, request.rank);
      else abilities.push({ ...request });
    }
  }

  const programs = sources.flatMap((entry) => entry.programs ?? []);

  return {
    labels: { baseType: base.label, background: background.label, purpose: purpose.label },
    stats,
    skills,
    components,
    cyberware,
    gear,
    abilities,
    programs,
    role: purpose.role ? { ...purpose.role } : null,
    notes,
    skipped,
  };
}

// ─── Half two: the documents ──────────────────────────────────────────────────

/**
 * Name → source Item document, resolved from the COMPENDIUMS ONLY.
 *
 * Deliberately not `resolveItemUuidByName` (helpers/world-init.mjs), which checks
 * world items first. World items drift: a duplicate that merely shares a name can
 * differ on exactly the fields these rules depend on — `multipleInstalls` and
 * `paired` drive the cyberware caps and slot maths, and `componentTraining` /
 * `specialties` / `proteanFoci` drive the Role sub-allocations. A stale world copy
 * therefore degrades a build silently (a Netrunner losing its component-training
 * picks, because `normalizeRoleSystemData` treats a blank skill as "feature off").
 *
 * The compendium is what `_sync*Entries` maintains from the catalogue files, so it
 * is the reproducible source: the same three choices always give the same NPC. A
 * name that exists only as a world item is reported as unresolved instead, and
 * lands in the summary card.
 */
class ItemResolver {
  constructor() {
    this._cache = new Map();
    this._index = null;
    this.missing = [];
  }

  /** One pass over every Item pack index, keyed exactly and case-insensitively. */
  async _buildIndex() {
    if (this._index) return this._index;
    const exact = new Map();
    const loose = new Map();
    for (const pack of game.packs.filter((p) => p.documentName === 'Item')) {
      await pack.getIndex({ fields: ['name', 'type'] });
      for (const entry of pack.index) {
        const uuid = `Compendium.${pack.collection}.${entry._id}`;
        const exactKey = `${entry.type}::${entry.name}`;
        const looseKey = `${entry.type}::${entry.name.toLowerCase()}`;
        if (!exact.has(exactKey)) exact.set(exactKey, uuid);
        if (!loose.has(looseKey)) loose.set(looseKey, uuid);
      }
    }
    this._index = { exact, loose };
    return this._index;
  }

  /**
   * @param {string} name
   * @param {string[]} types — tried in order; the first hit wins
   * @returns {Promise<Item|null>}
   */
  async get(name, types) {
    const key = `${types.join('|')}::${name}`;
    if (this._cache.has(key)) return this._cache.get(key);

    const { exact, loose } = await this._buildIndex();
    let uuid = null;
    for (const itemType of types) {
      uuid = exact.get(`${itemType}::${name}`);
      if (uuid) break;
      uuid = loose.get(`${itemType}::${name.toLowerCase()}`);
      if (uuid) {
        // The catalogue names are meant to match exactly; a loose hit means one
        // of them has drifted from the compendium and is worth fixing.
        console.warn(`Cyberpunk Blue | NPC Quick: "${name}" only matched case-insensitively as ${itemType}`);
        break;
      }
    }

    const doc = uuid ? await fromUuid(uuid).catch(() => null) : null;
    if (!doc) this.missing.push(name);
    this._cache.set(key, doc);
    return doc;
  }

  /** Gear, weapons, armor, drugs and grenades all arrive as one "gear" list. */
  async getGearLike(name) {
    return this.get(name, ['gear', 'drug', 'ammo']);
  }
}

/** Create-data for one item, with the source `_id` stripped. */
function createDataFor(doc) {
  const data = doc.toObject();
  delete data._id;
  return data;
}

/**
 * Apply the spec's cyberware combination rules, then produce create-data.
 *
 * Rules, in order:
 *  - anything with multipleInstalls === false is capped at one copy, except the
 *    five anatomical pairs which cap at two;
 *  - a MultiOptic Mount lifts the cybereye cap entirely;
 *  - two or more cyberarms means no cyberhands at all (same for legs / feet);
 *  - Sensor Array plus a Cyberaudio Suite gives the suite 7 slots;
 *  - pair copies are pre-named "(Left)" / "(Right)", copies 3+ get " 3", " 4", …
 *
 * Exported so the rules can be exercised without a live world.
 *
 * @returns {Promise<{ platforms: object[], extensions: object[], dropped: string[] }>}
 */
export async function normalizeCyberware(requests, resolver) {
  const dropped = [];

  // Resolve first — every rule below needs the real catalogue metadata.
  const entries = [];
  for (const request of requests) {
    const doc = await resolver.get(request.name, ['cyberware']);
    if (!doc) continue;
    entries.push({ name: request.name, count: request.count, doc, system: doc.system });
  }

  const has = (name) => entries.some((e) => e.name === name);
  const totalOf = (names) => entries
    .filter((e) => names.includes(e.name))
    .reduce((total, e) => total + e.count, 0);

  const multiOptic = has('MultiOptic Mount');
  const sensorArray = has('Sensor Array');

  // Two or more arms means the hands are redundant. Same for legs and feet.
  // Judged on the raw request counts, before any capping.
  const dropHands = totalOf(ARM_NAMES) >= 2;
  const dropFeet = totalOf(LEG_NAMES) >= 2;

  const platforms = [];
  const extensions = [];

  for (const entry of entries) {
    if (dropHands && HAND_NAMES.includes(entry.name)) {
      dropped.push(`${entry.name} (superseded by two cyberarms)`);
      continue;
    }
    if (dropFeet && FOOT_NAMES.includes(entry.name)) {
      dropped.push(`${entry.name} (superseded by two cyberlegs)`);
      continue;
    }

    // How many copies actually get built.
    const isPair = PAIRED_PLATFORMS.includes(entry.name);
    // A MultiOptic Mount lifts the two-eye limit — but only for the eyes
    // themselves, not for the optics extensions that share their cyberwareType.
    const uncapped = multiOptic
      && entry.system.cyberwareType === 'cyberoptics'
      && entry.system.integration === 'platform';

    let count = entry.count;
    if (!uncapped) {
      const cap = isPair ? 2 : (entry.system.multipleInstalls ? count : 1);
      if (count > cap) {
        dropped.push(`${entry.name} ×${count - cap} (only ${cap} may be installed)`);
        count = cap;
      }
    }

    for (let copy = 1; copy <= count; copy += 1) {
      const data = createDataFor(entry.doc);
      // Catalogue cyberware ships uninstalled; a quick-built NPC already has it.
      data.system.installed = true;

      // Left/Right only makes sense for the anatomical pairs. Other legitimate
      // duplicates (Self-ICE, Light Tattoo) get numbered instead — the engine's
      // own rename would have called them "(Left)"/"(Right)", which reads wrong.
      if (count > 1) {
        if (isPair && copy === 1) data.name = `${entry.name} (Left)`;
        else if (isPair && copy === 2) data.name = `${entry.name} (Right)`;
        else if (copy > 1) data.name = `${entry.name} ${copy}`;
      }

      // Sensor Array upgrades the suite it accompanies to 7 slots.
      if (sensorArray && entry.system.cyberwareType === 'cyberaudio' && entry.system.integration === 'platform') {
        data.system.slotsProvided = 7;
      }

      if (data.system.integration === 'extension') extensions.push(data);
      else platforms.push(data);
    }
  }

  return { platforms, extensions, dropped };
}

/** Create-data for the Role, with rank, specialties, foci and picks applied. */
function buildRoleData(doc, spec) {
  const data = createDataFor(doc);
  const system = normalizeRoleSystemData(data.system);
  system.rank = spec.rank;

  for (const [name, rank] of Object.entries(spec.specialties ?? {})) {
    const specialty = system.specialties?.find((s) => s.name === name);
    if (specialty) specialty.rank = rank;
    else console.warn(`Cyberpunk Blue | NPC Quick: ${doc.name} has no specialty "${name}"`);
  }

  for (const [name, points] of Object.entries(spec.foci ?? {})) {
    const focus = system.proteanFoci?.find((f) => f.name === name);
    if (focus) focus.points = points;
    else console.warn(`Cyberpunk Blue | NPC Quick: ${doc.name} has no protean focus "${name}"`);
  }

  if (spec.componentPicks?.length) {
    // normalizeRoleSystemData drops every pick when componentTraining.skill is
    // blank, which is how a stale source document loses these without a peep.
    if (!system.componentTraining?.skill) {
      console.warn(`Cyberpunk Blue | NPC Quick: ${doc.name} has no componentTraining skill — dropping picks ${spec.componentPicks.join(', ')}`);
    }
    system.componentTraining.picks = [...spec.componentPicks];
  }

  // Re-normalize so the clamps run against the ranks just written.
  data.system = normalizeRoleSystemData(system);

  // Report anything the normalizer clamped away, so a silently-degraded role
  // shows up instead of looking like a correct build.
  const wantedPicks = spec.componentPicks?.length ?? 0;
  const gotPicks = data.system.componentTraining?.picks?.length ?? 0;
  if (gotPicks !== wantedPicks) {
    console.warn(`Cyberpunk Blue | NPC Quick: ${doc.name} kept ${gotPicks}/${wantedPicks} component picks`);
  }
  for (const [name, rank] of Object.entries(spec.specialties ?? {})) {
    const got = data.system.specialties?.find((s) => s.name === name)?.rank;
    if (got !== rank) console.warn(`Cyberpunk Blue | NPC Quick: ${doc.name} specialty "${name}" wanted ${rank}, got ${got}`);
  }
  for (const [name, points] of Object.entries(spec.foci ?? {})) {
    const got = data.system.proteanFoci?.find((f) => f.name === name)?.points;
    if (got !== points) console.warn(`Cyberpunk Blue | NPC Quick: ${doc.name} focus "${name}" wanted ${points}, got ${got}`);
  }

  return data;
}

/** Create-data for one ability, cloned from its catalogue template. */
function buildAbilityData(doc, spec) {
  const data = createDataFor(doc);
  data.name = spec.name;
  const maxRank = data.system.maxRank;
  data.system.rank = maxRank ? Math.min(spec.rank, maxRank) : spec.rank;
  return data;
}

/** Find the `NPCs` Actor folder, creating it on first use. */
async function ensureNpcFolder() {
  return game.folders.find((f) => f.type === 'Actor' && f.name === FOLDER_NAME)
    ?? await Folder.create({ name: FOLDER_NAME, type: 'Actor' });
}

/**
 * Turn a recipe into an `npc` Actor.
 *
 * @param {string} name
 * @param {object} recipe — from buildNpcRecipe
 * @returns {Promise<Actor|null>}
 */
export async function createNpcFromRecipe(name, recipe) {
  const resolver = new ItemResolver();

  // ── Skill / component `active` flags ──
  // Setting skills in *creation* data bypasses CyberBlueActor#_preUpdate, which is
  // normally what flips these. Mirror what it would have done: every ranked skill
  // is listed, and so is every Component of every ranked skill — even the ones
  // that got no ranks of their own.
  const skillData = {};
  const componentData = {};
  for (const [slug, rank] of Object.entries(recipe.skills)) {
    if (rank <= 0) continue;
    skillData[slug] = { rank, active: true };
    for (const comp of componentsOf(slug)) {
      componentData[comp] = { rank: recipe.components[comp] ?? 0, active: true };
    }
  }
  for (const [slug, rank] of Object.entries(recipe.components)) {
    if (rank <= 0) continue;
    componentData[slug] = { rank, active: true };
  }

  const statData = Object.fromEntries(Object.entries(recipe.stats).map(([slug, value]) => [slug, { value }]));

  const folder = await ensureNpcFolder();
  const actor = await Actor.create({
    name,
    type: 'npc',
    folder: folder.id,
    system: { stats: statData, skills: skillData, components: componentData },
  });
  if (!actor) return null;

  // HP and PSYCHE are deliberately NOT seeded here. Cyberware carries stat AEs —
  // Grafted Muscle & Bone Lace alone is +2 BODY — so `hp.max` grows once the items
  // land, and anything written now would leave the NPC short of full. Both are set
  // at the end, once every effect is in place.

  // ── Resolve and order every item ──
  const { platforms, extensions, dropped } = await normalizeCyberware(recipe.cyberware, resolver);

  const gearData = [];
  for (const request of recipe.gear) {
    const doc = await resolver.getGearLike(request.name);
    if (!doc) continue;
    const data = createDataFor(doc);
    if (request.qty > 1 && data.system && 'quantity' in data.system) data.system.quantity = request.qty;
    gearData.push(data);
  }

  for (const programName of recipe.programs) {
    const doc = await resolver.get(programName, ['programExecutable']);
    if (doc) gearData.push(createDataFor(doc));
  }

  const abilityData = [];
  for (const spec of recipe.abilities) {
    const doc = await resolver.get(spec.base, ['ability']);
    if (doc) abilityData.push(buildAbilityData(doc, spec));
  }

  let roleData = null;
  if (recipe.role) {
    const doc = await resolver.get(recipe.role.name, ['role']);
    if (doc) roleData = buildRoleData(doc, recipe.role);
  }

  // ── Write, in dependency order ──
  //
  // cyberBlueSkipRoleGrant does two jobs we want: the Role brings none of its
  // starting gear, and extension platforms are auto-assigned with no prompt.
  // cyberBlueSkipLRRename keeps the (Left)/(Right) names assigned above.
  //
  // PSYCHE is deliberately handled here rather than by the createItem hook.
  // That hook is async and Foundry does not await hook callbacks, so a batch of
  // 30 cyberware would have every callback read the same starting value and only
  // the last deduction would survive. cyberBlueSkipPsychePrompt turns the hook
  // off; applySuggestedPsycheLoss below does the whole sum in one update. The
  // separate hook that builds each item's max-PSYCHE ActiveEffect is untouched.
  const opts = {
    cyberBlueSkipRoleGrant: true,
    cyberBlueSkipLRRename: true,
    cyberBlueSkipPsychePrompt: true,
  };

  // Platforms must be persisted before extensions: _preCreate reads actor.items
  // to find an eligible platform. Platforms consume no slots themselves, so they
  // can go in one batch.
  if (platforms.length) await actor.createEmbeddedDocuments('Item', platforms, opts);

  // Extensions go in ONE AT A TIME. getEligiblePlatforms only sees persisted
  // items, so a batch would have every extension in it independently decide the
  // same 3-slot suite had room and over-subscribe it. Created singly, each one
  // sees the slots its predecessors already took; when nothing has room left,
  // parentCyberwareId stays null and the item lands Disconnected — which is the
  // spec's "leave what's left over as not installed". Recipe order therefore
  // decides who wins the scarce slots.
  for (const data of extensions) {
    spreadDuplicateExtension(actor, data);
    await actor.createEmbeddedDocuments('Item', [data], opts);
  }

  if (roleData) await actor.createEmbeddedDocuments('Item', [roleData], opts);
  if (abilityData.length) await actor.createEmbeddedDocuments('Item', abilityData, opts);
  if (gearData.length) await actor.createEmbeddedDocuments('Item', gearData, opts);

  // Extensions that found no free slot stay Disconnected — mark them uninstalled
  // so it's obvious the GM has a choice to make. They cost no PSYCHE either way,
  // since promptCyberwarePsycheLoss skips unconnected extensions.
  const unconnected = actor.items.filter(
    (i) => i.type === 'cyberware' && i.system.integration === 'extension' && !i.system.parentCyberwareId,
  );
  if (unconnected.length) {
    await actor.updateEmbeddedDocuments(
      'Item',
      unconnected.map((i) => ({ _id: i.id, 'system.installed': false })),
      opts,
    );
  }

  await installPrograms(actor);

  if (roleData) {
    await syncAllRoleConditionAEs(actor);
    await syncAllProteanFociAEs(actor);
  }

  const psycheSpent = await applySuggestedPsycheLoss(actor);

  // Full HP last of all, against the max the finished actor actually has.
  await actor.update({ 'system.resources.hp.value': actor.system.resources.hp.max });

  await postSummary(actor, recipe, {
    psycheSpent,
    unconnected: unconnected.map((i) => i.name),
    dropped,
    missing: resolver.missing,
    stacked: findStackedDuplicates(actor),
  });

  actor.sheet.render(true);
  return actor;
}

/**
 * Put a second copy of an extension on a DIFFERENT platform from the first.
 *
 * Two Mantis Blades belong in two separate cyberarms — that's the rule, and it is
 * also what makes their RoF 1 combined strike available. Left alone, `_preCreate`
 * takes `eligiblePlatforms[0]`, and a 4-slot cyberarm still has room for a second
 * 2-slot blade, so both would stack in the same arm.
 *
 * Mutates `data.system.parentCyberwareId` in place. Only touches non-paired
 * extensions: setting one parent on a paired item would make `_preCreate` skip its
 * auto-assign entirely and leave `parentCyberwareId2` null (i.e. unconnected). If no
 * free platform is left over, it does nothing and the default behaviour stands.
 */
function spreadDuplicateExtension(actor, data) {
  if (data.system?.integration !== 'extension' || data.system.paired) return;
  if (data.system.parentCyberwareId) return;

  const twins = actor.items.filter((i) => i.type === 'cyberware' && i.name === data.name);
  if (!twins.length) return;

  const taken = new Set(twins.map((i) => i.system.parentCyberwareId).filter(Boolean));
  const free = getEligiblePlatforms(actor, null, data.system).filter((p) => !taken.has(p.id));
  if (free.length) data.system.parentCyberwareId = free[0].id;
}

/**
 * Copies of one extension that ended up sharing a platform.
 *
 * spreadDuplicateExtension puts duplicates on separate platforms whenever one has
 * room, but it can't always win: a 4-slot cyberarm already holding a 1-slot and a
 * 2-slot extension has no room for a second 2-slot Mantis Blade, so both blades
 * land in the same arm. That's a legal slot layout but the wrong anatomy — the two
 * blades are meant to sit in different arms — and rearranging it properly is a
 * bin-packing problem. Report it so the GM can move one rather than not notice.
 */
function findStackedDuplicates(actor) {
  // How many platforms of each type exist — two copies sharing the only platform
  // of their type had no alternative, so that is not worth reporting.
  const platformsPerType = new Map();
  for (const item of actor.items) {
    if (item.type !== 'cyberware' || item.system.integration !== 'platform') continue;
    const type = item.system.cyberwareType;
    platformsPerType.set(type, (platformsPerType.get(type) ?? 0) + 1);
  }

  const groups = new Map();
  for (const item of actor.items) {
    if (item.type !== 'cyberware' || item.system.integration !== 'extension') continue;
    const platform = item.system.parentCyberwareId;
    if (!platform) continue;
    // "Mantis Blades" and "Mantis Blades 2" are copies of one entry.
    const base = item.name.replace(/ \d+$/, '');
    const key = `${base}@@${platform}`;
    const group = groups.get(key) ?? { count: 0, type: item.system.cyberwareType };
    group.count += 1;
    groups.set(key, group);
  }

  const stacked = [];
  for (const [key, { count, type }] of groups) {
    if (count < 2) continue;
    // Only a genuine misplacement if another platform of that type exists.
    if ((platformsPerType.get(type) ?? 0) < 2) continue;
    const [base, platformId] = key.split('@@');
    stacked.push(`${count} × ${base} share ${actor.items.get(platformId)?.name ?? 'one platform'}`);
  }
  return stacked;
}

/**
 * Deduct the summed suggested PSYCHE loss for all installed cyberware, in one
 * update, and stamp each item as already accounted for so nothing prompts later.
 *
 * Filters exactly as `promptCyberwarePsycheLoss` would: connected cyberware with
 * a parsable loss formula. Unconnected extensions cost nothing, which is what
 * makes overflow cyberware free until the GM finds it a slot.
 *
 * @returns {Promise<number>} PSYCHE actually deducted
 */
async function applySuggestedPsycheLoss(actor) {
  const cyberware = actor.items.filter((i) => i.type === 'cyberware' && !i.isUnconnectedExtension());

  const flagKey = `flags.cyberpunk-blue.${psychePromptFlag()}`;
  let total = 0;
  const flagged = [];
  for (const item of cyberware) {
    const loss = item.getCyberwarePsycheLossData();
    if (loss.valid) total += loss.suggested;
    flagged.push({ _id: item.id, [flagKey]: true });
  }

  // Flag first: these updates don't touch installed/integration/parentCyberwareId,
  // so the update hook ignores them.
  if (flagged.length) await actor.updateEmbeddedDocuments('Item', flagged);

  // Deduct from the max the actor now has, not from 60. The cyberware AEs have
  // already pulled `psyche.max` down by each item's die count, and the engine's
  // own install path likewise clamps to the reduced max before subtracting — so
  // this reproduces what installing the same cyberware by hand would give.
  const start = actor.system.resources.psyche.max ?? 0;
  await actor.update({ 'system.resources.psyche.value': Math.max(start - total, 0) });
  return total;
}

/**
 * Wire every uninstalled program executable onto the primary cyberdeck.
 * Mirrors the role-grant path in helpers/roles.mjs so behaviour matches.
 */
async function installPrograms(actor) {
  const programs = actor.items.filter((i) => i.type === 'programExecutable' && !i.system.installedOnId);
  if (!programs.length) return;

  const decks = actor.items.filter((i) => i.type === 'gear' && i.system.computer?.isCyberdeck);
  const deck = decks.find((i) => i.system.equipped) ?? decks[0] ?? null;
  if (!deck) return;

  await actor.updateEmbeddedDocuments(
    'Item',
    programs.map((i) => ({ _id: i.id, 'system.installedOnId': deck.id })),
  );
}

/** One chat card covering everything the GM might want to know or fix. */
async function postSummary(actor, recipe, { psycheSpent, unconnected, dropped, missing, stacked }) {
  const { baseType, background, purpose } = recipe.labels;
  const lines = [`<p><strong>${baseType} / ${background} / ${purpose}</strong></p>`];

  if (psycheSpent > 0) {
    lines.push(`<p>Cyberware cost <strong>−${psycheSpent}</strong> Psyche (suggested values).</p>`);
  }
  for (const note of recipe.notes) lines.push(`<p>${note}</p>`);

  const list = (label, items) => (items.length
    ? `<p><strong>${label}:</strong></p><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`
    : '');

  lines.push(list('Not installed — no free slots', unconnected));
  lines.push(list('Sharing a platform — may want moving', stacked ?? []));
  lines.push(list('Left out of the combination', dropped));
  if (missing.length) {
    lines.push(`<p style="color: var(--cpb-error);"><strong>Could not be found:</strong></p><ul>${
      missing.map((i) => `<li>${i}</li>`).join('')}</ul>`);
  }

  const skippedNotes = Object.entries(recipe.skipped)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${count} × ${key} had no eligible target`);
  lines.push(list('Extras with nowhere to go', skippedNotes));

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    whisper: ChatMessage.getWhisperRecipients('GM').map((u) => u.id),
    content: `<div class="cyberpunk-blue chat-card"><h3>${
      game.i18n.format('CYBER_BLUE.NpcQuick.SummaryTitle', { name: actor.name })
    }</h3>${lines.filter(Boolean).join('')}</div>`,
  });
}
