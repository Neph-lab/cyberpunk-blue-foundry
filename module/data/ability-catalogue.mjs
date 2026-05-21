/**
 * Ability item definitions for the cyberpunk-blue.abilities compendium.
 * Seeded on first load by ensureAbilityCatalogue() in cyberpunk-blue.mjs.
 */
export const ABILITY_CATALOGUE = [
  {
    _id: 'AbilLanguage0000',
    name: 'Language',
    type: 'ability',
    img: 'systems/cyberpunk-blue/assets/items/abilities/language.png',
    system: {
      rank: 0,
      maxRank: 2,
      description: '<p>The first rank in a language represents a partial understanding and expression. The second rank represents a full understanding and fluency.</p><p>When added, rename this ability to <strong>Language: [name]</strong> (e.g. "Language: English").</p>',
      note: '',
    },
  },
  {
    _id: 'AbilSanity000000',
    name: 'Sanity',
    type: 'ability',
    img: 'systems/cyberpunk-blue/assets/items/abilities/Sanity.png',
    system: {
      rank: 0,
      maxRank: 10,
      description: '<p>When gaining a rank in this Ability, both current and max PSYCHE increase by 3.</p>',
      note: '',
    },
  },
  {
    _id: 'AbilLipReading00',
    name: 'Lip-Reading',
    type: 'ability',
    img: 'systems/cyberpunk-blue/assets/items/abilities/lip-reading.png',
    system: {
      rank: 0,
      maxRank: 10,
      description: '<p>This ability has 10 levels and acts as if it was a component wired to the Perception skill. Successfully observing someone\'s lips as they speak allows you to know what they\'re saying.</p>',
      note: '',
    },
  },
  {
    _id: 'AbilReactSpeed00',
    name: 'Reaction Speed',
    type: 'ability',
    img: 'systems/cyberpunk-blue/assets/items/abilities/reaction-time.png',
    system: {
      rank: 0,
      maxRank: 3,
      description: '<p>This ability can be increased to a total of three ranks. Each rank adds +1 to Initiative rolls. This bonus applies only to Initiative — not to other uses of RFLX.</p>',
      note: '',
    },
  },
];
