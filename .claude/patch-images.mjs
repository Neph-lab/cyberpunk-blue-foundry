import { readFileSync, writeFileSync } from 'fs';

function patch(file, pairs) {
  let src = readFileSync(file, 'utf8');
  let count = 0;
  for (const [from, to] of pairs) {
    if (src.includes(from)) { src = src.replace(from, to); count++; }
    else console.warn(`  MISS [${file.split('/').pop()}]: ${from.slice(0, 70)}`);
  }
  writeFileSync(file, src);
  console.log(`  ${file.split('/').pop()}: ${count}/${pairs.length} patches`);
}

const BASE = 'D:/FoundryVTT/Data/systems/cyberpunk-blue/module/data';
const AB = 'systems/cyberpunk-blue/assets/items';

// ── equipment-catalogue.mjs ──────────────────────────────────────────────────
{
  const file = `${BASE}/equipment-catalogue.mjs`;
  let src = readFileSync(file, 'utf8');

  // 1. Add asset constants
  if (!src.includes('const ASSET_BASE')) {
    const consts = `
// ── Asset paths ───────────────────────────────────────────────────────────────
const ASSET_BASE = 'systems/cyberpunk-blue/assets/items';
const A_GEAR     = \`\${ASSET_BASE}/gear\`;
const A_AMMO     = \`\${ASSET_BASE}/ammo\`;
const A_ARMOR    = \`\${ASSET_BASE}/armor\`;
const A_CHIPWARE = \`\${ASSET_BASE}/chipware\`;
const A_CLOTHES  = \`\${ASSET_BASE}/clothes\`;

const CLOTHING_IMG = {
  'Bottoms/Entropism': \`\${A_CLOTHES}/entropism-bottoms.png\`,
  'Top/Entropism':     \`\${A_CLOTHES}/entropism-vest.png\`,
  'Jacket/Entropism':  \`\${A_CLOTHES}/entropism-jacket.png\`,
  'Footwear/Kitch':    \`\${A_CLOTHES}/kitsch-footwear.png\`,
  'Jacket/Kitch':      \`\${A_CLOTHES}/kitsch-jacket.png\`,
  'Top/Kitch':         \`\${A_CLOTHES}/kitsch-vest.png\`,
  'Jewelry/Neokitch':  \`\${A_CLOTHES}/neokitsch-jewelery.png\`,
  '_/Entropism':       \`\${A_CLOTHES}/Entropism.png\`,
  '_/Kitch':           \`\${A_CLOTHES}/Kitsch.png\`,
  '_/Neomilitarism':   \`\${A_CLOTHES}/Neomilitarism.png\`,
  '_/Neokitch':        \`\${A_CLOTHES}/Neokitsch.png\`,
};
`;
    src = src.replace("const h = (text) => `<p>${text}</p>`;", "const h = (text) => `<p>${text}</p>`;\n" + consts);
  }

  // 2. gear() function: add imgPath param + use it
  src = src.replace(
    "function gear({\n  name, manufacturer = '', cost, folder, description = '',",
    "function gear({\n  name, manufacturer = '', cost, folder, description = '', imgPath = '',"
  );
  src = src.replace("    name,\n    type: 'gear',\n    img: '',", "    name,\n    type: 'gear',\n    img: imgPath,");

  // 3. clothing() function: pass imgPath
  const oldClothing = `function clothing(type, style, cost) {
  return gear({
    name: \`\${type} (\${style})\`,
    folder: 'Outfit',
    cost,
    description: \`\${type}. \${STYLE_DESC[style]}\`,
  });
}`;
  const newClothing = `function clothing(type, style, cost) {
  const imgPath = CLOTHING_IMG[\`\${type}/\${style}\`] ?? CLOTHING_IMG[\`_/\${style}\`] ?? '';
  return gear({
    name: \`\${type} (\${style})\`,
    folder: 'Outfit',
    cost,
    imgPath,
    description: \`\${type}. \${STYLE_DESC[style]}\`,
  });
}`;
  src = src.replace(oldClothing, newClothing);

  writeFileSync(file, src);

  // 4. Item-level imgPath patches
  patch(file, [
    // Grenades
    ["name: 'Knock-Out Grenade',\n    folder: 'Grenades'", `name: 'Knock-Out Grenade',\n    folder: 'Grenades', imgPath: \`\${A_AMMO}/Knock-out Gas Grenade.png\`,`],
    ["name: 'Smoke Grenade',\n    folder: 'Grenades'", `name: 'Smoke Grenade',\n    folder: 'Grenades', imgPath: \`\${A_AMMO}/Smoke Grenade.png\`,`],
    ["name: 'Teargas Grenade',\n    folder: 'Grenades'", `name: 'Teargas Grenade',\n    folder: 'Grenades', imgPath: \`\${A_AMMO}/Teargas Grenade.png\`,`],
    ["name: 'Flashbang Grenade',\n    folder: 'Grenades'", `name: 'Flashbang Grenade',\n    folder: 'Grenades', imgPath: \`\${A_AMMO}/Flasgbang Grenade.png\`,`],
    ["name: 'Toxic Grenade',\n    folder: 'Grenades'", `name: 'Toxic Grenade',\n    folder: 'Grenades', imgPath: \`\${A_AMMO}/Toxic Gas Grenade.png\`,`],
    // Media gear
    ["name: 'Audio Recorder',\n    folder: 'Media Gear'", `name: 'Audio Recorder',\n    folder: 'Media Gear', imgPath: \`\${A_GEAR}/audio-recorder.png\`,`],
    ["name: 'Braindance Wreath',\n    folder: 'Media Gear'", `name: 'Braindance Wreath',\n    folder: 'Media Gear', imgPath: \`\${A_GEAR}/braindance-wreath.png\`,`],
    ["name: 'Drum Synthesizer',\n    folder: 'Media Gear'", `name: 'Drum Synthesizer',\n    folder: 'Media Gear', imgPath: \`\${A_GEAR}/drum-synthesizer.png\`,`],
    ["name: 'Electric Guitar',\n    folder: 'Media Gear'", `name: 'Electric Guitar',\n    folder: 'Media Gear', imgPath: \`\${A_GEAR}/electric-guitar.png\`,`],
    ["name: 'Pocket Amplifier',\n    folder: 'Media Gear'", `name: 'Pocket Amplifier',\n    folder: 'Media Gear', imgPath: \`\${A_GEAR}/pocket-amp.png\`,`],
    ["name: 'Radio / Music Player',\n    folder: 'Media Gear'", `name: 'Radio / Music Player',\n    folder: 'Media Gear', imgPath: \`\${A_GEAR}/music-player.png\`,`],
    ["name: 'Video Camera',\n    folder: 'Media Gear'", `name: 'Video Camera',\n    folder: 'Media Gear', imgPath: \`\${A_GEAR}/video-camera.png\`,`],
    // Survival & Exploration
    ["name: 'Anti-Smog Breathing Mask',\n    folder: 'Survival & Exploration'", `name: 'Anti-Smog Breathing Mask',\n    folder: 'Survival & Exploration', imgPath: \`\${A_GEAR}/amti-smog breathing mask.png\`,`],
    ["name: 'Auto-Level Ear Protectors',\n    folder: 'Survival & Exploration'", `name: 'Auto-Level Ear Protectors',\n    folder: 'Survival & Exploration', imgPath: \`\${A_GEAR}/auto-level-ear-protectors.png\`,`],
    ["name: 'Backpack',\n    folder: 'Survival & Exploration'", `name: 'Backpack',\n    folder: 'Survival & Exploration', imgPath: \`\${A_GEAR}/backpack.png\`,`],
    ["name: 'Binoculars',\n    folder: 'Survival & Exploration'", `name: 'Binoculars',\n    folder: 'Survival & Exploration', imgPath: \`\${A_GEAR}/binoculars.png\`,`],
    ["name: 'Duct Tape',\n    folder: 'Survival & Exploration'", `name: 'Duct Tape',\n    folder: 'Survival & Exploration', imgPath: \`\${A_GEAR}/duct-tape.png\`,`],
    ["name: 'Flashlight',\n    folder: 'Survival & Exploration'", `name: 'Flashlight',\n    folder: 'Survival & Exploration', imgPath: \`\${A_GEAR}/flashlight.png\`,`],
    ["name: 'Grapple Gun',\n    folder: 'Survival & Exploration'", `name: 'Grapple Gun',\n    folder: 'Survival & Exploration', imgPath: \`\${A_GEAR}/grappling-gun.png\`,`],
    ["name: 'Inflatable Bed & Sleeping Bag',\n    folder: 'Survival & Exploration'", `name: 'Inflatable Bed & Sleeping Bag',\n    folder: 'Survival & Exploration', imgPath: \`\${A_GEAR}/inflatable-bed-and-sleeping-bag.png\`,`],
    ["name: 'Personal Care Pack',\n    folder: 'Survival & Exploration'", `name: 'Personal Care Pack',\n    folder: 'Survival & Exploration', imgPath: \`\${A_GEAR}/personal-care-pack.png\`,`],
    ["name: 'Radar Detector',\n    folder: 'Survival & Exploration'", `name: 'Radar Detector',\n    folder: 'Survival & Exploration', imgPath: \`\${A_GEAR}/radar-detector.png\`,`],
    ["name: 'Road Flare',\n    folder: 'Survival & Exploration'", `name: 'Road Flare',\n    folder: 'Survival & Exploration', imgPath: \`\${A_GEAR}/road-flare.png\`,`],
    ["name: 'Rope',\n    folder: 'Survival & Exploration'", `name: 'Rope',\n    folder: 'Survival & Exploration', imgPath: \`\${A_GEAR}/rope.png\`,`],
    ["name: 'Tent & Camping Equipment',\n    folder: 'Survival & Exploration'", `name: 'Tent & Camping Equipment',\n    folder: 'Survival & Exploration', imgPath: \`\${A_GEAR}/tent-and-camping-equipment.png\`,`],
    // Scientific & Medical
    ["name: 'Chemical Analyzer',\n    folder: 'Scientific & Medical'", `name: 'Chemical Analyzer',\n    folder: 'Scientific & Medical', imgPath: \`\${A_GEAR}/chemical-analyzer.png\`,`],
    ["name: 'Cryopump',\n    folder: 'Scientific & Medical'", `name: 'Cryopump',\n    folder: 'Scientific & Medical', imgPath: \`\${A_GEAR}/cryobag.png\`,`],
    ["name: 'Cryotank',\n    folder: 'Scientific & Medical'", `name: 'Cryotank',\n    folder: 'Scientific & Medical', imgPath: \`\${A_GEAR}/cryotank.png\`,`],
    ["name: 'Medtech Bag',\n    folder: 'Scientific & Medical'", `name: 'Medtech Bag',\n    folder: 'Scientific & Medical', imgPath: \`\${A_GEAR}/med-pack.png\`,`],
    ["name: 'Techtool',\n    folder: 'Scientific & Medical'", `name: 'Techtool',\n    folder: 'Scientific & Medical', imgPath: \`\${A_GEAR}/techtool.png\`,`],
    // Cyberdecks
    ["name: 'Cyberdeck, Poor',\n    folder:", `name: 'Cyberdeck, Poor', imgPath: \`\${A_GEAR}/poor-cyberdeck.png\`,\n    folder:`],
    ["name: 'Cyberdeck, Standard',\n    folder:", `name: 'Cyberdeck, Standard', imgPath: \`\${A_GEAR}/standard-cyberdeck.png\`,\n    folder:`],
    ["name: 'Cyberdeck, Excellent',\n    folder:", `name: 'Cyberdeck, Excellent', imgPath: \`\${A_GEAR}/excellent-cyberdeck.png\`,\n    folder:`],
    // Chipware
    ["name: 'Chemical Sniffer Chip',\n    folder:", `name: 'Chemical Sniffer Chip', imgPath: \`\${A_CHIPWARE}/chemical-sniffer.png\`,\n    folder:`],
    ["name: 'Language Chip',\n    folder:", `name: 'Language Chip', imgPath: \`\${A_CHIPWARE}/language.png\`,\n    folder:`],
    ["name: 'Olfactory Boost Chip',\n    folder:", `name: 'Olfactory Boost Chip', imgPath: \`\${A_CHIPWARE}/olfactory-boost.png\`,\n    folder:`],
    ["name: 'Pain Editor Chip',\n    folder:", `name: 'Pain Editor Chip', imgPath: \`\${A_CHIPWARE}/pain-editor.png\`,\n    folder:`],
    ["name: 'Skill Chip',\n    folder:", `name: 'Skill Chip', imgPath: \`\${A_CHIPWARE}/skill-chip.png\`,\n    folder:`],
    ["name: 'Tactile Boost Chip',\n    folder:", `name: 'Tactile Boost Chip', imgPath: \`\${A_CHIPWARE}/tactile-boost.png\`,\n    folder:`],
    // Body Armor
    ["name: 'Light Armorjack',\n    folder: 'Body Armor'", `name: 'Light Armorjack',\n    folder: 'Body Armor', imgPath: \`\${A_ARMOR}/light-armorjack.png\`,`],
    ["name: 'Light Bodyweight Suit',\n    folder: 'Body Armor'", `name: 'Light Bodyweight Suit',\n    folder: 'Body Armor', imgPath: \`\${A_ARMOR}/light-bodyweight-suit.png\`,`],
    ["name: 'Bulletproof Shield',\n    folder: 'Body Armor'", `name: 'Bulletproof Shield',\n    folder: 'Body Armor', imgPath: \`\${A_ARMOR}/bulletproof-shield.png\`,`],
  ]);
}

// ── cyberware-catalogue.mjs ──────────────────────────────────────────────────
{
  const CW = `${AB}/cyberware`;
  patch(`${BASE}/cyberware-catalogue.mjs`, [
    ["name: 'Neuroport',\n", `name: 'Neuroport',\n    img: \`${CW}/neuroport.png\`,\n`],
    ["name: 'Braindance Recorder',\n", `name: 'Braindance Recorder',\n    img: \`${CW}/braindance-recorder.png\`,\n`],
    ["name: 'Ex-Disk',\n", `name: 'Ex-Disk',\n    img: \`${CW}/ex-disk.png\`,\n`],
    ["name: 'Neuroport Cyberdeck Port',\n", `name: 'Neuroport Cyberdeck Port',\n    img: \`${CW}/cyberdeck-port.png\`,\n`],
    ["name: 'Self-ICE',\n", `name: 'Self-ICE',\n    img: \`${CW}/self-ice.png\`,\n`],
    ["name: 'Standard Cybereye',\n", `name: 'Standard Cybereye',\n    img: \`${CW}/cybereye.png\`,\n`],
    ["name: 'Standard Cyberaudio Suite',\n", `name: 'Standard Cyberaudio Suite',\n    img: \`${CW}/cyberaudio-suite.png\`,\n`],
    ["name: 'Standard Cyberarm',\n", `name: 'Standard Cyberarm',\n    img: \`${CW}/cyberarm.png\`,\n`],
    ["name: 'Rippers',\n", `name: 'Rippers',\n    img: \`${CW}/Rippers.png\`,\n`],
    ["name: 'Virtuality',\n", `name: 'Virtuality',\n    img: \`${CW}/virtuality.png\`,\n`],
    ["name: 'Toxin Binders',\n", `name: 'Toxin Binders',\n    img: \`${CW}/toxin-binders.png\`,\n`],
    ["name: 'MultiOptic Mount',\n", `name: 'MultiOptic Mount',\n    img: \`${CW}/MultiOptic-Mount.png\`,\n`],
  ]);
}

// ── drug-catalogue.mjs ───────────────────────────────────────────────────────
{
  const DR = `${AB}/drugs`;
  patch(`${BASE}/drug-catalogue.mjs`, [
    // Add imgPath param to drug() function
    ["function drug({ name, cost, duration,", "function drug({ name, cost, duration, img = '',"],
    ["    name,\n    type: 'drug',\n    img: '',", "    name,\n    type: 'drug',\n    img,"],
    // Boost and Synthcoke
    ["name:      'Boost',", `name:      'Boost', img: \`${DR}/boost.png\`,`],
    ["name:      'Synthcoke',", `name:      'Synthcoke', img: \`${DR}/synth-coke.png\`,`],
  ]);
}

// ── program-catalogue.mjs ────────────────────────────────────────────────────
{
  const PR = `${AB}/programs`;
  patch(`${BASE}/program-catalogue.mjs`, [
    // Add img param to prog() function
    ["function prog({ name, cost, category, act", "function prog({ name, cost, category, img = '', act"],
    ["    name,\n    type: 'programExecutable',\n    img: '',", "    name,\n    type: 'programExecutable',\n    img,"],
    // Armor and Sword
    ["  { name: 'Armor',", `  { name: 'Armor', img: \`${PR}/Armor program.png\`,`],
    ["  { name: 'Sword',", `  { name: 'Sword', img: \`${PR}/Sword program.png\`,`],
  ]);
}

// ── ability-catalogue.mjs ────────────────────────────────────────────────────
{
  const AB2 = `${AB}/abilities`;
  patch(`${BASE}/ability-catalogue.mjs`, [
    ["  img: 'icons/skills/social/diplomacy-handshake.webp',", `  img: '${AB2}/language.png',`],
    ["  img: 'icons/magic/life/heart-glowing-green.webp',", `  img: '${AB2}/Sanity (1).png',`],
    ["  img: 'icons/magic/perception/eye-ringed-glow-yellow.webp',", `  img: '${AB2}/lip-reading.png',`],
    ["  img: 'icons/skills/movement/arrow-upward-yellow.webp',", `  img: '${AB2}/reaction-time.png',`],
  ]);
}

// ── ammo-catalogue.mjs ───────────────────────────────────────────────────────
{
  const AM = `${AB}/ammo`;
  patch(`${BASE}/ammo-catalogue.mjs`, [
    // Basic Fuel: wrong image
    ["    name: 'Basic Fuel',\n    ammoTypes: { flamethrower: true },\n    img: `${AM}/Basic Rifle.png`,",
     `    name: 'Basic Fuel',\n    ammoTypes: { flamethrower: true },\n    img: \`${AM}/fuel.png\`,`],
    // Incendiary Shotgun Shells and Rifle Ammo
    ["    name: 'Incendiary Shotgun Shells',\n    ammoTypes: { shotgunShell: true },\n    img: `${AM}/Basic Rifle.png`,",
     `    name: 'Incendiary Shotgun Shells',\n    ammoTypes: { shotgunShell: true },\n    img: \`${AM}/Incendiary.png\`,`],
    ["    name: 'Incendiary Rifle Ammo',\n    ammoTypes: { assault: true },\n    img: `${AM}/Basic Rifle.png`,",
     `    name: 'Incendiary Rifle Ammo',\n    ammoTypes: { assault: true },\n    img: \`${AM}/Incendiary.png\`,`],
  ]);
}

// ── weapon-catalogue.mjs ─────────────────────────────────────────────────────
{
  patch(`${BASE}/weapon-catalogue.mjs`, [
    // Bow was using Katana.png as placeholder
    ["imgPath: img(W_MELEE, 'Katana.png'),\n    weapons: [entry({\n      type: 'bowCrossbow'",
     "imgPath: img(W_ROOT, 'bow.png'),\n    weapons: [entry({\n      type: 'bowCrossbow'"],
  ]);
}

console.log('\nDone.');
