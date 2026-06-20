/**
 * Starting gear for each role.
 *
 * Each entry maps a role name (matching the compendium) to an array of
 * grantedItemGroup descriptors.  Item names must exactly match the
 * catalogue (weapon / equipment / ammo / cyberware / mod catalogues).
 *
 * mode: 'all'    — every item in the group is granted
 * mode: 'choice' — the player picks `count` items from the list
 */

/** @param {string} id  @param {string} label  @param {'all'|'choice'} mode
 *  @param {number} count  @param {Array<{name:string,quantity?:number}>} items */
function group(id, label, mode, count, items) {
  return {
    id,
    label,
    mode,
    count,
    items: items.map(({ name, quantity = 1 }, idx) => ({
      id: `${id}-${idx}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20)}`,
      uuid: '',
      name,
      type: 'item',
      img: '',
      quantity,
    })),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const all  = (id, label, items) => group(id, label, 'all', items.length, items);
const pick = (id, label, count, items) => group(id, label, 'choice', count, items);

// ─── Role starting-gear definitions ───────────────────────────────────────────

export const ROLE_STARTING_GEAR = {

  // ── Bandit ──────────────────────────────────────────────────────────────────
  Bandit: [
    pick('bandit-rifle-or-sg',    'Primary Weapon', 1, [
      { name: 'Arasaka Nowaki' },
      { name: 'Constitutional Arms M2038 Tactician' },
      { name: 'Rostovic DB-4 Palica' },
      { name: 'Militech M251s Ajax' },
    ]),
    all('bandit-sidearm',         'Sidearm', [
      { name: 'Militech M-10AF Lexington' },
    ]),
    pick('bandit-melee',          'Heavy Melee', 1, [
      { name: 'Sledgehammer' },
      { name: 'Baseball Bat' },
    ]),
    pick('bandit-primary-ammo',   'Primary Ammo (×100)', 1, [
      { name: 'Basic Rifle Ammo',      quantity: 100 },
      { name: 'Basic Shotgun Shells',  quantity: 100 },
      { name: 'Basic Shotgun Slugs',   quantity: 100 },
    ]),
    all('bandit-hp-ammo',         'Sidearm Ammo', [
      { name: 'Basic Heavy Pistol Ammo', quantity: 30 },
    ]),
    all('bandit-armor',           'Armor', [
      { name: 'Light Armorjack' },
    ]),
    all('bandit-outfit',          'Outfit', [
      { name: 'Airhypo' },
      { name: 'Disposable Phone' },
      { name: 'Duct Tape' },
      { name: 'Glow Paint' },
      { name: 'Glow Stick', quantity: 2 },
    ]),
    pick('bandit-drugs',          'Drugs (choose 1)', 1, [
      { name: 'Black Lace',  quantity: 2 },
      { name: 'Blue Glass',  quantity: 5 },
      { name: 'Synthcoke',   quantity: 5 },
    ]),
    all('bandit-cyberware',       'Cyberware', [
      { name: 'Neuroport' },
      { name: 'Standard Cyberarm' },
      { name: 'Hidden Holster' },
      { name: 'Wolvers' },
    ]),
  ],

  // ── Corpo ───────────────────────────────────────────────────────────────────
  Corpo: [
    all('corpo-weapon',           'Weapon', [
      { name: 'Tsunami Nue' },
    ]),
    all('corpo-ammo',             'Ammo', [
      { name: 'Basic Very Heavy Pistol Ammo', quantity: 50 },
    ]),
    all('corpo-armor',            'Armor', [
      { name: 'Light Armorjack' },
    ]),
    all('corpo-outfit',           'Outfit', [
      { name: 'Radio Communicator',     quantity: 4 },
      { name: 'Scrambler / Descrambler' },
    ]),
    pick('corpo-chipware',        'Chipware (choose 1)', 1, [
      { name: 'Olfactory Boost Chip' },
      { name: 'Language Chip' },
    ]),
    all('corpo-cyberware',        'Cyberware', [
      { name: 'Neuroport' },
      { name: 'Dermal Display' },
    ]),
    pick('corpo-fashionware',     'Fashionware (choose 1)', 1, [
      { name: 'Tech Hair' },
      { name: 'Light Tattoo' },
    ]),
    pick('corpo-internal-cw',     'Internal Cyberware (choose 1)', 1, [
      { name: 'Toxin Binders' },
      { name: 'Nasal Filters' },
    ]),
  ],

  // ── Fixer ───────────────────────────────────────────────────────────────────
  Fixer: [
    pick('fixer-primary',         'Primary Weapon', 1, [
      { name: 'Constitutional Arms Unity' },
      { name: 'Constitutional Arms Liberty' },
    ]),
    pick('fixer-secondary',       'Secondary Weapon', 1, [
      { name: 'Tsunami Kappa' },
      { name: 'Militech Ticon' },
    ]),
    all('fixer-melee',            'Melee', [
      { name: 'Baseball Bat' },
    ]),
    pick('fixer-ammo-primary',    'Primary Ammo (×50)', 1, [
      { name: 'Basic Heavy Pistol Ammo',      quantity: 50 },
      { name: 'Basic Very Heavy Pistol Ammo', quantity: 50 },
    ]),
    pick('fixer-ammo-secondary',  'Secondary Ammo (×50)', 1, [
      { name: 'Basic Heavy Pistol Ammo',   quantity: 50 },
      { name: 'Basic Medium Pistol Ammo',  quantity: 50 },
    ]),
    all('fixer-armor',            'Armor', [
      { name: 'Light Armorjack' },
    ]),
    all('fixer-outfit',           'Outfit', [
      { name: 'Bug Detector' },
      { name: 'Disposable Phone', quantity: 2 },
      { name: 'Duct Tape' },
      { name: 'Laptop, Advanced' },
    ]),
    all('fixer-cyberware',        'Cyberware', [
      { name: 'Neuroport' },
      { name: 'Standard Cyberaudio Suite' },
      { name: 'Subdermal Pocket' },
    ]),
    pick('fixer-cyberaudio-ext',  'Cyberaudio Extension', 1, [
      { name: 'Voice Stress Analyzer' },
      { name: 'Amplified Hearing' },
    ]),
  ],

  // ── Guide ───────────────────────────────────────────────────────────────────
  Guide: [
    all('guide-primary',          'Primary Weapon', [
      { name: 'Constitutional Arms Unity' },
    ]),
    pick('guide-secondary',       'Secondary Weapon', 1, [
      { name: 'Militech Stun Baton' },
      { name: 'Kendachi RA-5 Powered Knife' },
      { name: 'Bow' },
    ]),
    pick('guide-melee',           'Melee (choose 1)', 1, [
      { name: 'Baseball Bat' },
      { name: 'Throwing Axe' },
      { name: 'Militech M2 Combat Knife' },
    ]),
    all('guide-grenade',          'Grenade', [
      { name: 'Smoke Grenade' },
    ]),
    all('guide-ammo',             'Ammo', [
      { name: 'Basic Heavy Pistol Ammo', quantity: 50 },
    ]),
    all('guide-armor',            'Armor', [
      { name: 'Light Armorjack' },
    ]),
    all('guide-outfit',           'Outfit', [
      { name: 'Duct Tape' },
      { name: 'Flashlight' },
      { name: 'Glow Stick' },
      { name: 'Radio / Music Player' },
      { name: 'Video Camera' },
    ]),
    pick('guide-chipware-a',      'Chipware (choose 1)', 1, [
      { name: 'Language Chip' },
      { name: 'Skill Chip' },
    ]),
    pick('guide-chipware-b',      'Chipware (choose 1)', 1, [
      { name: 'Olfactory Boost Chip' },
      { name: 'Tactile Boost Chip' },
    ]),
    all('guide-cyberware',        'Cyberware', [
      { name: 'Neuroport' },
      { name: 'Light Tattoo' },
      { name: 'Skin-Weave' },
      { name: 'Subdermal Pocket' },
    ]),
    pick('guide-fashionware',     'Fashionware (choose 1)', 1, [
      { name: 'Shift Tacts' },
      { name: 'Tech Hair' },
    ]),
  ],

  // ── Law ─────────────────────────────────────────────────────────────────────
  Law: [
    pick('law-primary',           'Primary Weapon', 1, [
      { name: 'Arasaka Nowaki' },
      { name: 'Constitutional Arms M2038 Tactician' },
    ]),
    all('law-sidearm',            'Sidearm', [
      { name: 'Militech M-10AF Lexington' },
    ]),
    pick('law-primary-ammo',      'Primary Ammo (×50)', 1, [
      { name: 'Basic Rifle Ammo',     quantity: 50 },
      { name: 'Basic Shotgun Shells', quantity: 50 },
      { name: 'Basic Shotgun Slugs',  quantity: 50 },
    ]),
    all('law-sidearm-ammo',       'Sidearm Ammo', [
      { name: 'Basic Heavy Pistol Ammo', quantity: 50 },
    ]),
    pick('law-secondary-gear',    'Shield or Grenades', 1, [
      { name: 'Bulletproof Shield' },
      { name: 'Smoke Grenade', quantity: 2 },
    ]),
    all('law-armor',              'Armor', [
      { name: 'Light Armorjack' },
    ]),
    all('law-outfit',             'Outfit', [
      { name: 'Flashlight' },
      { name: 'Handcuffs', quantity: 2 },
      { name: 'Radio Communicator' },
      { name: 'Road Flare', quantity: 10 },
    ]),
    all('law-cyberware',          'Cyberware', [
      { name: 'Neuroport' },
      { name: 'Hidden Holster' },
      { name: 'Subdermal Pocket' },
    ]),
  ],

  // ── Media ───────────────────────────────────────────────────────────────────
  Media: [
    all('media-weapon',           'Weapon', [
      { name: 'Constitutional Arms Unity' },
    ]),
    all('media-ammo',             'Ammo', [
      { name: 'Basic Heavy Pistol Ammo', quantity: 50 },
    ]),
    all('media-armor',            'Armor', [
      { name: 'Light Armorjack' },
    ]),
    all('media-outfit',           'Outfit', [
      { name: 'Audio Recorder' },
      { name: 'Binoculars' },
      { name: 'Flashlight' },
      { name: 'Laptop' },
      { name: 'Radio / Music Player' },
      { name: 'Video Camera' },
    ]),
    pick('media-outfit-choice',   'Outfit (choose 1)', 1, [
      { name: 'Disposable Phone', quantity: 2 },
      { name: 'Grapple Gun' },
    ]),
    all('media-cyberware',        'Cyberware', [
      { name: 'Neuroport' },
      { name: 'Standard Cyberaudio Suite' },
    ]),
    pick('media-cyberaudio-ext',  'Cyberaudio Extension', 1, [
      { name: 'Amplified Hearing' },
      { name: 'Voice Stress Analyzer' },
    ]),
    pick('media-recon-gear',      'Recon Gear (choose 1)', 1, [
      { name: 'Scrambler / Descrambler' },
      { name: 'Bug Detector' },
    ]),
  ],

  // ── Medtech ─────────────────────────────────────────────────────────────────
  Medtech: [
    pick('medtech-primary',       'Primary Weapon', 1, [
      { name: 'Rostovic DB-4 Palica' },
      { name: 'Militech M251s Ajax' },
    ]),
    pick('medtech-primary-ammo',  'Primary Ammo (×100)', 1, [
      { name: 'Basic Shotgun Shells', quantity: 100 },
      { name: 'Basic Rifle Ammo',     quantity: 100 },
    ]),
    pick('medtech-incendiary',    'Incendiary Ammo (×10)', 1, [
      { name: 'Incendiary Shotgun Shells', quantity: 10 },
      { name: 'Incendiary Rifle Ammo',     quantity: 10 },
    ]),
    all('medtech-grenades',       'Grenades', [
      { name: 'Smoke Grenade', quantity: 2 },
    ]),
    all('medtech-armor',          'Armor', [
      { name: 'Light Armorjack' },
      { name: 'Bulletproof Shield' },
    ]),
    all('medtech-outfit',         'Outfit', [
      { name: 'Airhypo' },
      { name: 'Handcuffs' },
      { name: 'Flashlight' },
      { name: 'Glow Paint' },
      { name: 'Medtech Bag' },
    ]),
    all('medtech-cyberware',      'Cyberware', [
      { name: 'Neuroport' },
      { name: 'Standard Cybereye' },
      { name: 'TeleOptics' },
      { name: 'MicroOptics' },
    ]),
    pick('medtech-internal',      'Internal Cyberware', 1, [
      { name: 'Nasal Filters' },
      { name: 'Toxin Binders' },
    ]),
  ],

  // ── Netrunner ───────────────────────────────────────────────────────────────
  Netrunner: [
    all('netrunner-weapon',       'Weapon', [
      { name: 'Militech Ticon' },
    ]),
    all('netrunner-ammo',         'Ammo', [
      { name: 'Basic Heavy Pistol Ammo', quantity: 50 },
    ]),
    all('netrunner-armor',        'Armor', [
      { name: 'Light Bodyweight Suit' },
    ]),
    all('netrunner-cyberdeck',    'Cyberdeck', [
      { name: 'Cyberdeck, Standard' },
    ]),
    all('netrunner-gear',         'Gear', [
      { name: 'Glow Paint' },
    ]),
    all('netrunner-programs',     'Programs', [
      { name: 'Armor' },
      { name: 'Sword' },
    ]),
    pick('netrunner-prog-a',      'Program (choose 1)', 1, [
      { name: 'See-Ya' },
      { name: 'Eraser' },
    ]),
    pick('netrunner-prog-b',      'Program (choose 1)', 1, [
      { name: 'Sword' },
      { name: 'Vrizzbolt' },
    ]),
    pick('netrunner-prog-c',      'Program (choose 1)', 1, [
      { name: 'Sword' },
      { name: 'Worm' },
    ]),
    all('netrunner-cyberware',    'Cyberware', [
      { name: 'Neuroport' },
      { name: 'Standard Cybereye' },
      { name: 'Standard Cybereye' },
      { name: 'Virtuality' },
      { name: 'Shift Tacts' },
    ]),
  ],

  // ── Ninja ───────────────────────────────────────────────────────────────────
  Ninja: [
    all('ninja-melee-primary',    'Primary Melee', [
      { name: 'Katana' },
      { name: 'Kendachi RA-5 Powered Knife' },
    ]),
    pick('ninja-melee-secondary', 'Secondary Melee (choose 1)', 1, [
      { name: 'Militech Stun Baton' },
      { name: 'Katana' },
    ]),
    pick('ninja-sidearm',         'Sidearm (choose 1)', 1, [
      { name: 'Constitutional Arms Liberty' },
      { name: 'Tsunami Yanari' },
    ]),
    pick('ninja-longarm',         'Long Arm (choose 1)', 1, [
      { name: 'Militech M-179 Achilles' },
      { name: 'Arasaka Nowaki' },
    ]),
    pick('ninja-throwable',       'Throwable (choose 1)', 1, [
      { name: 'Throwing Axe' },
      { name: 'Bow' },
    ]),
    pick('ninja-ammo-throwable',  'Throwable Ammo (choose 1)', 1, [
      { name: 'Throwing Axe' },
      { name: 'Basic Arrows', quantity: 50 },
    ]),
    all('ninja-ammo',             'Ammo', [
      { name: 'Basic Medium Pistol Ammo', quantity: 50 },
    ]),
    pick('ninja-longarm-ammo',    'Long Arm Ammo (×50)', 1, [
      { name: 'Basic Sniper Ammo',  quantity: 50 },
      { name: 'Basic Rifle Ammo',   quantity: 50 },
    ]),
    all('ninja-armor',            'Armor', [
      { name: 'Light Armorjack' },
    ]),
    all('ninja-outfit',           'Outfit', [
      { name: 'Binoculars' },
      { name: 'Caltrops' },
      { name: 'Lock-Picking Kit' },
      { name: 'Radio Communicator' },
      { name: 'Toxin' },
    ]),
    all('ninja-cyberware',        'Cyberware', [
      { name: 'Neuroport' },
      { name: 'Hidden Holster' },
      { name: 'Subdermal Pocket' },
      { name: 'Toxin Binders' },
    ]),
  ],

  // ── Operative ───────────────────────────────────────────────────────────────
  Operative: [
    all('operative-weapons',      'Weapons', [
      { name: 'Constitutional Arms Unity' },
      { name: 'Militech M2 Combat Knife' },
    ]),
    pick('operative-scope',       'Scope Mod (choose 1)', 1, [
      { name: 'Amutek XC-10 Cetus' },
      { name: 'Amutek XC-10 Strix' },
    ]),
    all('operative-ammo',         'Ammo', [
      { name: 'Basic Heavy Pistol Ammo', quantity: 50 },
    ]),
    all('operative-armor',        'Armor', [
      { name: 'Light Armorjack' },
    ]),
    all('operative-outfit',       'Outfit', [
      { name: 'Audio Recorder' },
      { name: 'Bug Detector' },
      { name: 'Disposable Phone', quantity: 2 },
      { name: 'Radio Communicator' },
      { name: 'Scrambler / Descrambler' },
    ]),
    all('operative-cyberware',    'Cyberware', [
      { name: 'Neuroport' },
      { name: 'Standard Cybereye' },
      { name: 'MicroOptics' },
      { name: 'Standard Cyberaudio Suite' },
      { name: 'Amplified Hearing' },
      { name: 'Shift Tacts' },
    ]),
  ],

  // ── Rocker ──────────────────────────────────────────────────────────────────
  Rocker: [
    all('rocker-weapon',          'Weapon', [
      { name: 'Tsunami Nue' },
    ]),
    pick('rocker-secondary',      'Secondary (choose 1)', 1, [
      { name: 'Baseball Bat' },
      { name: 'Flashbang Grenade' },
    ]),
    all('rocker-grenades',        'Grenades', [
      { name: 'Teargas Grenade', quantity: 2 },
    ]),
    all('rocker-ammo',            'Ammo', [
      { name: 'Basic Very Heavy Pistol Ammo', quantity: 50 },
    ]),
    all('rocker-armor',           'Armor', [
      { name: 'Light Armorjack' },
    ]),
    all('rocker-outfit',          'Outfit', [
      { name: 'Laptop' },
      { name: 'Electric Guitar' },
      { name: 'Pocket Amplifier' },
      { name: 'Glow Paint', quantity: 5 },
      { name: 'Radio / Music Player' },
    ]),
    all('rocker-cyberware',       'Cyberware', [
      { name: 'Neuroport' },
      { name: 'Standard Cyberaudio Suite' },
      { name: 'Level Dampener' },
      { name: 'Chemskin' },
      { name: 'Tech Hair' },
    ]),
  ],

  // ── Solo ────────────────────────────────────────────────────────────────────
  Solo: [
    all('solo-weapons',           'Weapons', [
      { name: 'Tsunami Nue' },
      { name: 'Constitutional Arms M2038 Tactician' },
      { name: 'Nokota D5 Copperhead' },
      { name: 'Militech M2 Combat Knife' },
    ]),
    pick('solo-scope',            'Scope Mod (choose 1)', 1, [
      { name: 'Kang Tao Type-2067' },
      { name: 'Militech Mk.2X Grandstand' },
    ]),
    all('solo-ammo',              'Ammo', [
      { name: 'Basic Very Heavy Pistol Ammo', quantity: 50 },
      { name: 'Basic Rifle Ammo',             quantity: 50 },
    ]),
    pick('solo-sg-ammo',          'Shotgun Ammo (×20)', 1, [
      { name: 'Basic Shotgun Slugs',  quantity: 20 },
      { name: 'Basic Shotgun Shells', quantity: 20 },
    ]),
    all('solo-armor',             'Armor', [
      { name: 'Light Armorjack' },
    ]),
    all('solo-outfit',            'Outfit', [
      { name: 'Binoculars' },
      { name: 'Backpack' },
      { name: 'Duct Tape' },
      { name: 'Flashlight' },
      { name: 'Rope' },
    ]),
    all('solo-cyberware',         'Cyberware', [
      { name: 'Neuroport' },
      { name: 'Standard Cyberarm' },
      { name: 'Wolvers' },
    ]),
    pick('solo-reflex-cw',        'Reflex Cyberware (choose 1)', 1, [
      { name: 'Sandevistan' },
      { name: 'Kerenzikov' },
    ]),
  ],

  // ── Techie ──────────────────────────────────────────────────────────────────
  Techie: [
    pick('techie-primary',        'Primary Weapon', 1, [
      { name: 'Techtronika VST-37 Pozhar' },
      { name: 'Nokota D5 Copperhead' },
    ]),
    pick('techie-primary-ammo',   'Primary Ammo (×50)', 1, [
      { name: 'Basic Shotgun Shells', quantity: 50 },
      { name: 'Basic Shotgun Slugs',  quantity: 50 },
      { name: 'Basic Rifle Ammo',     quantity: 50 },
    ]),
    all('techie-grenade',         'Grenade', [
      { name: 'Flashbang Grenade' },
    ]),
    all('techie-armor',           'Armor', [
      { name: 'Light Armorjack' },
    ]),
    all('techie-outfit',          'Outfit', [
      { name: 'Anti-Smog Breathing Mask' },
      { name: 'Disposable Phone' },
      { name: 'Duct Tape',   quantity: 5 },
      { name: 'Flashlight' },
      { name: 'Road Flare',  quantity: 6 },
      { name: 'Tech Bag' },
      { name: 'Techtool' },
    ]),
    all('techie-cyberware',       'Cyberware', [
      { name: 'Neuroport' },
      { name: 'Standard Cybereye' },
      { name: 'MicroOptics' },
      { name: 'Dermal Display' },
      { name: 'Standard Cyberarm' },
      { name: 'Tool Hand' },
    ]),
  ],
};
