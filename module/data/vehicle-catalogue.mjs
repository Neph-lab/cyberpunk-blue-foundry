/**
 * Sample vehicle catalogue — starter Actors for the "Vehicles" compendium.
 *
 * Each entry is Actor create-data ready for `Actor.createDocuments`.
 * `_folder` drives pack-folder placement and is stripped before creation.
 *
 * Stats are placeholder values — GMs are expected to tune them to their
 * campaign's vehicle tables.
 */

const NOTES = '<p><em>Placeholder stats — adjust to match your source material.</em></p>';

/** Build a blueprint region entry with sensible defaults filled in. */
function region(regionId, label, behaviorType, shape, behaviorConfig = {}) {
  return { regionId, label, shape, offset: { x: 0, y: 0 }, behaviorType, behaviorConfig };
}

const VITAL = (entryId = '') => ({ criticalDamageEntryId: entryId, subsystemItemId: null });

export const VEHICLE_CATALOGUE = [
  // ── Ground vehicles ───────────────────────────────────────────────────────

  {
    _folder: 'Ground',
    name: 'Light Car',
    type: 'vehicle',
    img: 'icons/svg/mystery-man.svg',
    prototypeToken: { width: 2, height: 4 },
    system: {
      stats: {
        maxMove:      { value: 24, bonus: 0 },
        acc:          { value: 8,  bonus: 0 },
        handling:     { base: 1,   bonus: 0 },
        size:         { value: 2, label: 'Small', bonus: 0 },
        currentSpeed: { value: 0 },
      },
      resources: {
        hp:    { value: 40, max: 40 },
        armor: { value: 11, max: 11 },
      },
      classification: {
        primary: 'land',
        categories: ['land'],
        submersible: false,
        enclosesRiders: true,
      },
      seats: {
        driver:     { value: 1 },
        gunners:    { value: 0 },
        passengers: { value: 3 },
      },
      state: 'operational',
      pivot: { x: 0, y: 0 },
      critTableId: '',
      // Authored at 100px/square on a 2×4 footprint (200×400 token-local px),
      // front toward the top of the token (-y).
      blueprint: {
        referenceGrid: 100,
        regions: [
          region('lightcar-driver', 'Driver', 'driverSeat',
            { type: 'rectangle', x: 12, y: 48, width: 84, height: 104 }),
          region('lightcar-passenger-front', 'Front passenger', 'passengerSeat',
            { type: 'rectangle', x: 104, y: 48, width: 84, height: 104 }),
          region('lightcar-passenger-rear', 'Rear seats', 'passengerSeat',
            { type: 'rectangle', x: 18, y: 176, width: 164, height: 120 }),
          region('lightcar-engine', 'Engine', 'vitalArea',
            { type: 'circle', x: 100, y: 28, radius: 34 }, VITAL()),
        ],
        tiles: [],
      },
      description: '<p>Compact civilian vehicle. Fast and nimble but lightly armoured.</p>',
      notes: NOTES,
    },
  },

  {
    _folder: 'Ground',
    name: 'Heavy Truck',
    type: 'vehicle',
    img: 'icons/svg/mystery-man.svg',
    prototypeToken: { width: 3, height: 6 },
    system: {
      stats: {
        maxMove:      { value: 16, bonus: 0 },
        acc:          { value: 4,  bonus: 0 },
        handling:     { base: -1,  bonus: 0 },
        size:         { value: 4, label: 'Large', bonus: 0 },
        currentSpeed: { value: 0 },
      },
      resources: {
        hp:    { value: 80, max: 80 },
        armor: { value: 18, max: 18 },
      },
      classification: {
        primary: 'land',
        categories: ['land'],
        submersible: false,
        enclosesRiders: true,
      },
      seats: {
        driver:     { value: 1 },
        gunners:    { value: 0 },
        passengers: { value: 2 },
      },
      state: 'operational',
      pivot: { x: 0, y: 0 },
      critTableId: '',
      // Authored at 100px/square on a 3×6 footprint (300×600 token-local px),
      // cab toward the top of the token (-y), cargo bed at the rear.
      blueprint: {
        referenceGrid: 100,
        regions: [
          region('truck-driver', 'Driver', 'driverSeat',
            { type: 'rectangle', x: 25, y: 70, width: 110, height: 120 }),
          region('truck-passenger', 'Cab passenger', 'passengerSeat',
            { type: 'rectangle', x: 165, y: 70, width: 110, height: 120 }),
          region('truck-cargo', 'Cargo bed', 'passengerSeat',
            { type: 'rectangle', x: 30, y: 220, width: 240, height: 340 }),
          region('truck-engine', 'Engine block', 'vitalArea',
            { type: 'circle', x: 150, y: 42, radius: 46 }, VITAL()),
        ],
        tiles: [],
      },
      description: '<p>Heavy cargo and transport vehicle. Very tough but slow to manoeuvre.</p>',
      notes: NOTES,
    },
  },

  // ── Air vehicles ──────────────────────────────────────────────────────────

  {
    _folder: 'Air',
    name: 'Attack Helicopter',
    type: 'vehicle',
    img: 'icons/svg/mystery-man.svg',
    prototypeToken: { width: 3, height: 5 },
    system: {
      stats: {
        maxMove:      { value: 32, bonus: 0 },
        acc:          { value: 12, bonus: 0 },
        handling:     { base: 0,   bonus: 0 },
        size:         { value: 3, label: 'Medium', bonus: 0 },
        currentSpeed: { value: 0 },
      },
      resources: {
        hp:    { value: 60, max: 60 },
        armor: { value: 13, max: 13 },
      },
      classification: {
        primary: 'air',
        categories: ['air'],
        submersible: false,
        enclosesRiders: true,
      },
      seats: {
        driver:     { value: 1 },
        gunners:    { value: 2 },
        passengers: { value: 0 },
      },
      state: 'operational',
      pivot: { x: 0, y: 0 },
      critTableId: '',
      // Authored at 100px/square on a 3×5 footprint (300×500 token-local px),
      // nose toward the top of the token (-y); two gunner stations flank the pilot.
      blueprint: {
        referenceGrid: 100,
        regions: [
          region('heli-pilot', 'Pilot', 'driverSeat',
            { type: 'rectangle', x: 95, y: 55, width: 110, height: 120 }),
          region('heli-gunner-left', 'Gunner (port)', 'gunnerSeat',
            { type: 'rectangle', x: 35, y: 190, width: 105, height: 120 }, { seatIndex: 0 }),
          region('heli-gunner-right', 'Gunner (starboard)', 'gunnerSeat',
            { type: 'rectangle', x: 160, y: 190, width: 105, height: 120 }, { seatIndex: 1 }),
          region('heli-engine', 'Engine', 'vitalArea',
            { type: 'circle', x: 150, y: 340, radius: 58 }, VITAL()),
        ],
        tiles: [],
      },
      description: '<p>Armed rotary-wing aircraft. Fast and well-armed; fragile compared to ground armour.</p>',
      notes: NOTES,
    },
  },
];

// ── Pack seeding ──────────────────────────────────────────────────────────────

/**
 * Populate the vehicles compendium pack on first load.
 * Only creates entries if the pack is empty — will not overwrite GMs' edits.
 * Call from the `ready` hook (GM only).
 */
export async function ensureVehicleCatalogue() {
  if (!game.user.isGM) return;

  const PACK_ID = 'cyberpunk-blue.vehicles';
  const pack = game.packs.get(PACK_ID);
  if (!pack) {
    console.warn(`Cyberpunk Blue | Vehicle catalogue pack "${PACK_ID}" not found.`);
    return;
  }

  try {
    await pack.getIndex();
    if (pack.index.size > 0) return; // already populated — respect GM edits

    const byFolder = new Map();
    for (const actorData of VEHICLE_CATALOGUE) {
      const folderName = actorData._folder ?? 'General';
      if (!byFolder.has(folderName)) byFolder.set(folderName, []);
      byFolder.get(folderName).push(actorData);
    }

    let created = 0;
    await pack.configure({ locked: false });
    try {
      for (const [folderName, group] of byFolder.entries()) {
        const folder = await _ensureActorFolderInPack(pack, folderName);
        const cleaned = group.map((a) => {
          const copy = foundry.utils.deepClone(a);
          delete copy._folder;
          copy.folder = folder?.id ?? null;
          return copy;
        });
        const docs = await Actor.createDocuments(cleaned, { pack: PACK_ID });
        created += docs.length;
      }
    } finally {
      await pack.configure({ locked: true });
    }

    if (created > 0) {
      console.log(`Cyberpunk Blue | Vehicle catalogue imported: ${created} vehicles.`);
      ui.notifications.info(
        `Cyberpunk Blue: ${created} sample vehicles added to the Vehicles compendium.`,
      );
    }
  } catch (err) {
    console.error('Cyberpunk Blue | Failed to import vehicle catalogue:', err);
  }
}

async function _ensureActorFolderInPack(pack, name) {
  await pack.getIndex({ fields: ['name', 'type'] });
  const existing = pack.folders.find((f) => f.name === name);
  if (existing) return existing;
  return Folder.create({ name, type: 'Actor', sorting: 'a', color: null }, { pack: pack.collection });
}
