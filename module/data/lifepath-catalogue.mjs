/**
 * Lifepath RollTable definitions for the cyberpunk-blue.lifepath-tables compendium.
 * Seeded on first load by ensureLifepathCatalogue() in cyberpunk-blue.mjs.
 *
 * Each entry maps directly to a RollTable document.
 * The _folder property controls which role-named folder the table lands in.
 */

export const LIFEPATH_CATALOGUE = [

  // ── Bandit ──────────────────────────────────────────────────────────────────

  {
    _id: 'BndtLp0100000000',
    name: 'What kind of gang are you in?',
    _folder: 'Bandit',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Poser gang for a specific style (1d6: 1: steampunk, 2: glamor/glitter, 3: gothic rock, 4: film noir, 5: classic movie, 6: a specific artist)', type: 'text' },
      { range: [2,  2],  text: 'Booster gang that praises cybernetic enhancements.', type: 'text' },
      { range: [3,  3],  text: 'A violent power gang where might is the goal.', type: 'text' },
      { range: [4,  4],  text: 'Exotic poser gang using body sculpting for a non-human appearance.', type: 'text' },
      { range: [5,  5],  text: 'Chemical booster gang. Emphasis on combat drugs and bio-enhancements.', type: 'text' },
      { range: [6,  6],  text: 'Idealists who see themselves as ultimate protectors of the innocent.', type: 'text' },
      { range: [7,  7],  text: 'Members joined only from disdain for other gangs; temporary alliance.', type: 'text' },
      { range: [8,  8],  text: 'The gang is centered around a family or bloodline.', type: 'text' },
      { range: [9,  9],  text: 'Doomsday cult or conspiracy theorist group.', type: 'text' },
      { range: [10, 10], text: 'Cult worshipping some obscure entity or alternative religion.', type: 'text' },
    ],
  },

  {
    _id: 'BndtLp0200000000',
    name: 'When things go wrong, the gang uses...',
    _folder: 'Bandit',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Murder.', type: 'text' },
      { range: [2, 2], text: 'Blackmail and coercion.', type: 'text' },
      { range: [3, 3], text: 'Fear.', type: 'text' },
      { range: [4, 4], text: 'Dependency (drugs or cyberware).', type: 'text' },
      { range: [5, 5], text: 'Kidnapping.', type: 'text' },
      { range: [6, 6], text: 'Framing.', type: 'text' },
    ],
  },

  {
    _id: 'BndtLp0300000000',
    name: 'How does the gang make money?',
    _folder: 'Bandit',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Illicit Drugs', type: 'text' },
      { range: [2,  2],  text: 'Hacking', type: 'text' },
      { range: [3,  3],  text: 'Racketeering', type: 'text' },
      { range: [4,  4],  text: 'Gambling', type: 'text' },
      { range: [5,  5],  text: 'Robberies', type: 'text' },
      { range: [6,  6],  text: 'Fighting/Racing', type: 'text' },
      { range: [7,  7],  text: 'Sex Work', type: 'text' },
      { range: [8,  8],  text: 'Scams', type: 'text' },
      { range: [9,  9],  text: 'Smuggling', type: 'text' },
      { range: [10, 10], text: 'Scavenging', type: 'text' },
    ],
  },

  {
    _id: 'BndtLp0400000000',
    name: "Where is the gang's main hangout?",
    _folder: 'Bandit',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Nightclub or Bar', type: 'text' },
      { range: [2, 2], text: 'Abandoned Factory', type: 'text' },
      { range: [3, 3], text: 'Thematic to the gang type', type: 'text' },
      { range: [4, 4], text: 'Secret hideout', type: 'text' },
      { range: [5, 5], text: 'Behind a legitimate business', type: 'text' },
      { range: [6, 6], text: 'Privately owned homestead', type: 'text' },
    ],
  },

  {
    _id: 'BndtLp0500000000',
    name: "The gang's current boss is...",
    _folder: 'Bandit',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Violent and ruthless, but fair.', type: 'text' },
      { range: [2,  2],  text: 'Leaves almost everything to underlings.', type: 'text' },
      { range: [3,  3],  text: 'Self-indulgent but fun.', type: 'text' },
      { range: [4,  4],  text: 'Paranoid and scheming but effective.', type: 'text' },
      { range: [5,  5],  text: 'Prone to nepotism but caring and friendly.', type: 'text' },
      { range: [6,  6],  text: 'Just one in a long line of bosses who never survive long.', type: 'text' },
      { range: [7,  7],  text: 'A former Edgerunner until they took a bullet to the knee.', type: 'text' },
      { range: [8,  8],  text: 'In the pocket of a megacorp but pulls in eddies.', type: 'text' },
      { range: [9,  9],  text: 'A complete creep, but keeps other nasties at bay.', type: 'text' },
      { range: [10, 10], text: 'Unclear — the boss got killed and there is a power vacuum.', type: 'text' },
    ],
  },

  // ── Corpo ───────────────────────────────────────────────────────────────────

  {
    _id: 'CrpoLp0100000000',
    name: 'What kind of Corp do you work for?',
    _folder: 'Corpo',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Financial (e.g. Asukaga & Finch)', type: 'text' },
      { range: [2,  2],  text: 'Media and Communications (e.g. Network 54)', type: 'text' },
      { range: [3,  3],  text: 'Cybertech and Medical Technologies (e.g. Kiroshi Opticals)', type: 'text' },
      { range: [4,  4],  text: 'Pharmaceuticals and Biotech (e.g. Biotechnica)', type: 'text' },
      { range: [5,  5],  text: 'Food, Clothing or General Consumables (e.g. Continental Brands)', type: 'text' },
      { range: [6,  6],  text: 'Energy Production (e.g. Petrochem)', type: 'text' },
      { range: [7,  7],  text: 'Personal Electronics and Robotics (e.g. Zetatech)', type: 'text' },
      { range: [8,  8],  text: 'Corporate Services (e.g. Arasaka)', type: 'text' },
      { range: [9,  9],  text: 'Consumer Services (e.g. Danger Girl)', type: 'text' },
      { range: [10, 10], text: 'Real Estate and Construction (e.g. NightCorp)', type: 'text' },
    ],
  },

  {
    _id: 'CrpoLp0200000000',
    name: 'What division do you work in?',
    _folder: 'Corpo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Procurement', type: 'text' },
      { range: [2, 2], text: 'Manufacturing', type: 'text' },
      { range: [3, 3], text: 'Research and Development', type: 'text' },
      { range: [4, 4], text: 'Human Resources', type: 'text' },
      { range: [5, 5], text: 'Public Affairs / Publicity / Advertising', type: 'text' },
      { range: [6, 6], text: 'Mergers and Acquisitions', type: 'text' },
    ],
  },

  {
    _id: 'CrpoLp0300000000',
    name: 'How ethical is your corp?',
    _folder: 'Corpo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Working for good, supporting ethical practices', type: 'text' },
      { range: [2, 2], text: 'Operates as a fair and honest business', type: 'text' },
      { range: [3, 3], text: 'Occasionally, but rarely, unethical', type: 'text' },
      { range: [4, 4], text: 'Willing to bend the rules to get what it needs', type: 'text' },
      { range: [5, 5], text: 'Ruthless and profit-centered', type: 'text' },
      { range: [6, 6], text: 'Always involved in illegal and unethical business', type: 'text' },
    ],
  },

  {
    _id: 'CrpoLp0400000000',
    name: 'How widespread is your corp?',
    _folder: 'Corpo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'One city', type: 'text' },
      { range: [2, 2], text: 'Several cities', type: 'text' },
      { range: [3, 3], text: 'Statewide', type: 'text' },
      { range: [4, 4], text: 'National', type: 'text' },
      { range: [5, 5], text: 'International, offices in several major cities', type: 'text' },
      { range: [6, 6], text: 'International, offices everywhere', type: 'text' },
    ],
  },

  {
    _id: 'CrpoLp0500000000',
    name: "Who's gunning for your team?",
    _folder: 'Corpo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Rival Corp in your industry', type: 'text' },
      { range: [2, 2], text: 'Law enforcement is watching you', type: 'text' },
      { range: [3, 3], text: 'Local Media wants to bring you down', type: 'text' },
      { range: [4, 4], text: 'Different divisions in your company are feuding', type: 'text' },
      { range: [5, 5], text: "Local government doesn't like your Corp", type: 'text' },
      { range: [6, 6], text: 'Another Corp is eyeing you for a hostile takeover', type: 'text' },
    ],
  },

  {
    _id: 'CrpoLp0600000000',
    name: 'How is your boss?',
    _folder: 'Corpo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Mentors you, but watch out for their enemies', type: 'text' },
      { range: [2, 2], text: "Gives you free reins and doesn't want to know what you're up to", type: 'text' },
      { range: [3, 3], text: 'A micro-manager trying to meddle in your work', type: 'text' },
      { range: [4, 4], text: 'Unpredictable outbursts offset by quiet paranoia', type: 'text' },
      { range: [5, 5], text: 'Cool and has your back against rivals', type: 'text' },
      { range: [6, 6], text: 'Feels threatened and is planning to zero you', type: 'text' },
    ],
  },

  // ── Fixer ───────────────────────────────────────────────────────────────────

  {
    _id: 'FxrLp01000000000',
    name: 'What kind of Fixer are you?',
    _folder: 'Fixer',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Broker deals between rival gangs', type: 'text' },
      { range: [2,  2],  text: 'Procures atypical resources for an exclusive clientele', type: 'text' },
      { range: [3,  3],  text: 'Brokers Solo or Tech services as their agent', type: 'text' },
      { range: [4,  4],  text: 'Supplies a regular resource like food or medicine', type: 'text' },
      { range: [5,  5],  text: 'Procures illegal resources like street drugs or milspec weapons', type: 'text' },
      { range: [6,  6],  text: 'Supplies resources for Techs and Medtechs', type: 'text' },
      { range: [7,  7],  text: 'Operates several successful Night Markets', type: 'text' },
      { range: [8,  8],  text: 'Brokers use of heavy machinery or vehicles', type: 'text' },
      { range: [9,  9],  text: 'Deals in scavenged parts from abandoned areas', type: 'text' },
      { range: [10, 10], text: 'An exclusive agent for a Media, Rocker, or Nomad pack', type: 'text' },
    ],
  },

  {
    _id: 'FxrLp02000000000',
    name: 'Got a business partner? If so, who?',
    _folder: 'Fixer',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Family Member', type: 'text' },
      { range: [2, 2], text: 'Old Friend', type: 'text' },
      { range: [3, 3], text: 'Possible Romantic Partner', type: 'text' },
      { range: [4, 4], text: 'Mentor', type: 'text' },
      { range: [5, 5], text: 'Secret with gang connections', type: 'text' },
      { range: [6, 6], text: 'Secret with corpo connections', type: 'text' },
    ],
  },

  {
    _id: 'FxrLp03000000000',
    name: 'Who are your side-clients?',
    _folder: 'Fixer',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Local Rockerboys or Medias who need gigs', type: 'text' },
      { range: [2, 2], text: 'Local Bandits who also protect your work or home', type: 'text' },
      { range: [3, 3], text: 'Corpos who use you for "black project" procurement work', type: 'text' },
      { range: [4, 4], text: 'Local Solos or other combat types looking for work', type: 'text' },
      { range: [5, 5], text: 'Local Nomads and Fixers who use you to set up deals', type: 'text' },
      { range: [6, 6], text: 'Local politicos or Corpos who need information', type: 'text' },
    ],
  },

  {
    _id: 'FxrLp04000000000',
    name: "What's your \"office\" like?",
    _folder: 'Fixer',
    formula: '1d6',
    results: [
      { range: [1, 1], text: "You don't have one; it's all mobile", type: 'text' },
      { range: [2, 2], text: 'A booth in a local bar', type: 'text' },
      { range: [3, 3], text: "It's all Data Pool messages and dead drops", type: 'text' },
      { range: [4, 4], text: 'Spare room in a warehouse, shop, or clinic', type: 'text' },
      { range: [5, 5], text: 'An otherwise abandoned building', type: 'text' },
      { range: [6, 6], text: 'The lobby of a cube hotel', type: 'text' },
    ],
  },

  {
    _id: 'FxrLp05000000000',
    name: 'Who is gunning for you?',
    _folder: 'Fixer',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Bandits who want you to work with them exclusively', type: 'text' },
      { range: [2, 2], text: 'Rival Fixers trying to steal your clients', type: 'text' },
      { range: [3, 3], text: 'Corpos or Operatives who want you to work for them exclusively', type: 'text' },
      { range: [4, 4], text: 'Enemy of a former client who wants to tie up loose ends — like you', type: 'text' },
      { range: [5, 5], text: 'Old client who thinks you screwed them over', type: 'text' },
      { range: [6, 6], text: 'Rival Fixers trying to beat you out for resources', type: 'text' },
    ],
  },

  // ── Guide ───────────────────────────────────────────────────────────────────

  {
    _id: 'GuidLp0100000000',
    name: 'What kind of Guide are you?',
    _folder: 'Guide',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Self-Help Guru', type: 'text' },
      { range: [2,  2],  text: 'Cult Leader', type: 'text' },
      { range: [3,  3],  text: 'Priest', type: 'text' },
      { range: [4,  4],  text: 'Neo-Witch', type: 'text' },
      { range: [5,  5],  text: 'Spirit Medium', type: 'text' },
      { range: [6,  6],  text: 'Street Prophet', type: 'text' },
      { range: [7,  7],  text: 'Life Coach', type: 'text' },
      { range: [8,  8],  text: 'Monk', type: 'text' },
      { range: [9,  9],  text: 'Card-Reader', type: 'text' },
      { range: [10, 10], text: 'Psychic', type: 'text' },
    ],
  },

  {
    _id: 'GuidLp0200000000',
    name: "What's your divining space like?",
    _folder: 'Guide',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Crystal balls, pseudo-mystical trinkets, and an overwhelming smell of incense', type: 'text' },
      { range: [2, 2], text: 'Ascetic in order to leave room for introspection and contemplation. No distractions.', type: 'text' },
      { range: [3, 3], text: 'A ritual circle on the floor, drawn in blood. Occult symbols on the walls and disturbing chants from speakers.', type: 'text' },
      { range: [4, 4], text: 'A simple office with candles to set the mood and help you get into the right head-space', type: 'text' },
      { range: [5, 5], text: 'A small temple with an altar and room for prayer or contemplation', type: 'text' },
      { range: [6, 6], text: 'A complete mess, cluttered with anything that could provide inspiration and paraphernalia for drugs that help you get into your head-space', type: 'text' },
    ],
  },

  {
    _id: 'GuidLp0300000000',
    name: 'Who are your usual clients?',
    _folder: 'Guide',
    formula: '1d6',
    results: [
      { range: [1, 1], text: "Superstitious corpos that'll try anything to get an edge over the competition", type: 'text' },
      { range: [2, 2], text: 'Superstitious Fixers who want you to bless their dealings', type: 'text' },
      { range: [3, 3], text: 'Faithful who seek advice and blessings', type: 'text' },
      { range: [4, 4], text: "People who think that you're a prophet", type: 'text' },
      { range: [5, 5], text: 'Bandits, Ninjas, and Solos who want good luck charms', type: 'text' },
      { range: [6, 6], text: 'Downloads of your advice from the Data Pool', type: 'text' },
    ],
  },

  {
    _id: 'GuidLp0400000000',
    name: "Who's gunning for you?",
    _folder: 'Guide',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'A former client who blames you for their misfortune', type: 'text' },
      { range: [2, 2], text: 'A corpo who wants to buy you as their permanent lucky charm', type: 'text' },
      { range: [3, 3], text: "Extremists who claim you're an evil witch", type: 'text' },
      { range: [4, 4], text: 'A charlatan who sees you as competition', type: 'text' },
      { range: [5, 5], text: 'Supposed purists who want to expose you as fake', type: 'text' },
      { range: [6, 6], text: 'A mysterious stranger', type: 'text' },
    ],
  },

  // ── Law ─────────────────────────────────────────────────────────────────────

  {
    _id: 'LawLp01000000000',
    name: 'What is your position in the force?',
    _folder: 'Law',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Guard', type: 'text' },
      { range: [2, 2], text: 'Standard beat or patrol', type: 'text' },
      { range: [3, 3], text: 'Criminal Investigation', type: 'text' },
      { range: [4, 4], text: 'Special Weapons and Tactics', type: 'text' },
      { range: [5, 5], text: 'Motor Patrol', type: 'text' },
      { range: [6, 6], text: 'Internal Affairs', type: 'text' },
    ],
  },

  {
    _id: 'LawLp02000000000',
    name: 'Where is your jurisdiction?',
    _folder: 'Law',
    formula: '3d6',
    results: [
      { range: [3,  3],  text: 'Pacifica', type: 'text' },
      { range: [4,  4],  text: 'Open Highways and the Badlands', type: 'text' },
      { range: [5,  5],  text: 'Corporate Plaza', type: 'text' },
      { range: [6,  6],  text: 'Charter Hill', type: 'text' },
      { range: [7,  7],  text: 'Rancho Coronado', type: 'text' },
      { range: [8,  8],  text: 'Arroyo', type: 'text' },
      { range: [9,  9],  text: 'Little China', type: 'text' },
      { range: [10, 10], text: 'Kabuki', type: 'text' },
      { range: [11, 11], text: 'Northside Industrial District', type: 'text' },
      { range: [12, 12], text: 'Vista del Rey', type: 'text' },
      { range: [13, 13], text: 'The Glen', type: 'text' },
      { range: [14, 14], text: 'Japantown', type: 'text' },
      { range: [15, 15], text: 'Wellsprings', type: 'text' },
      { range: [16, 16], text: 'Downtown', type: 'text' },
      { range: [17, 17], text: 'North Oak', type: 'text' },
      { range: [18, 18], text: 'Netwatch Liaison', type: 'text' },
    ],
  },

  {
    _id: 'LawLp03000000000',
    name: 'How corrupt is your unit?',
    _folder: 'Law',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Fair, honest policing with strong ethical practices', type: 'text' },
      { range: [2, 2], text: 'Fair and honest policing, but hard on law-breakers', type: 'text' },
      { range: [3, 3], text: 'Will occasionally, but rarely, slip into unethical actions', type: 'text' },
      { range: [4, 4], text: 'Willing to bend any rules to get to the bad guys', type: 'text' },
      { range: [5, 5], text: 'Ruthless to control the Street, even breaking the law to, ostensibly, uphold it', type: 'text' },
      { range: [6, 6], text: 'Corrupt, taking bribes and engaging in illegal and unethical business all the time', type: 'text' },
    ],
  },

  {
    _id: 'LawLp04000000000',
    name: "Who's gunning for your unit?",
    _folder: 'Law',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Friends of a criminal you helped put away', type: 'text' },
      { range: [2, 2], text: 'An escaped or released criminal who blames you', type: 'text' },
      { range: [3, 3], text: 'Police Accountability Group', type: 'text' },
      { range: [4, 4], text: 'Dirty Politicians', type: 'text' },
      { range: [5, 5], text: 'A powerful gang', type: 'text' },
      { range: [6, 6], text: "Dirty cops whose plans you're in the way of", type: 'text' },
    ],
  },

  {
    _id: 'LawLp05000000000',
    name: "Who are your unit's major targets?",
    _folder: 'Law',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Organized Crime', type: 'text' },
      { range: [2, 2], text: 'Trafficking and kidnapping', type: 'text' },
      { range: [3, 3], text: 'Illicit trade (1d6: 1: Drugs, 2: XBDs, 3: Weapons, 4: Counterfeit luxury items, 5: Organs or Cyberware, 6: Fenced stolen goods)', type: 'text' },
      { range: [4, 4], text: 'Burglars and robbers', type: 'text' },
      { range: [5, 5], text: 'Illegal gambling', type: 'text' },
      { range: [6, 6], text: 'Street Criminals', type: 'text' },
    ],
  },

  // ── Media ───────────────────────────────────────────────────────────────────

  {
    _id: 'MedaLp0100000000',
    name: 'What kind of Media are you?',
    _folder: 'Media',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Blogger', type: 'text' },
      { range: [2, 2], text: 'Writer (Books)', type: 'text' },
      { range: [3, 3], text: 'Videographer', type: 'text' },
      { range: [4, 4], text: 'Documentarian', type: 'text' },
      { range: [5, 5], text: 'Investigative Reporter', type: 'text' },
      { range: [6, 6], text: 'Street Scribe', type: 'text' },
    ],
  },

  {
    _id: 'MedaLp0200000000',
    name: 'How do you reach the public?',
    _folder: 'Media',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Monthly Magazine', type: 'text' },
      { range: [2, 2], text: 'Blog', type: 'text' },
      { range: [3, 3], text: 'Mainstream Vid Feed', type: 'text' },
      { range: [4, 4], text: 'News Channel', type: 'text' },
      { range: [5, 5], text: 'Radio Broadcasts', type: 'text' },
      { range: [6, 6], text: 'Screamsheets', type: 'text' },
    ],
  },

  {
    _id: 'MedaLp0300000000',
    name: 'What do you report on?',
    _folder: 'Media',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Political Intrigue', type: 'text' },
      { range: [2, 2], text: 'Ecological Impact', type: 'text' },
      { range: [3, 3], text: 'Celebrity News', type: 'text' },
      { range: [4, 4], text: 'Corporate Takedowns', type: 'text' },
      { range: [5, 5], text: 'Editorials', type: 'text' },
      { range: [6, 6], text: 'Propaganda', type: 'text' },
    ],
  },

  {
    _id: 'MedaLp0400000000',
    name: 'How ethical are you?',
    _folder: 'Media',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Fair, honest reporting. Strong ethical practices. You only report the verifiable truth.', type: 'text' },
      { range: [2, 2], text: 'Fair and honest reporting, but willing to go on hearsay and rumor if that\'s what it takes', type: 'text' },
      { range: [3, 3], text: 'Will occasionally but rarely slip into unethical things. You have some standards.', type: 'text' },
      { range: [4, 4], text: 'Willing to bend any rules to get the bad guys, but only the bad guys', type: 'text' },
      { range: [5, 5], text: 'Ruthless and determined to make it big, even if it means breaking the law', type: 'text' },
      { range: [6, 6], text: 'Totally corrupt, taking bribes and engaging in illegal and unethical reporting — your pen is for hire', type: 'text' },
    ],
  },

  {
    _id: 'MedaLp0500000000',
    name: "Who's gunning for you?",
    _folder: 'Media',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'A corpo or politico you exposed who wants revenge', type: 'text' },
      { range: [2, 2], text: 'Someone who was hurt by others after your reporting', type: 'text' },
      { range: [3, 3], text: 'An informant who blames you for being exposed', type: 'text' },
      { range: [4, 4], text: 'A Ninja or Solo hired to silence you', type: 'text' },
      { range: [5, 5], text: "A conspiracy theorist convinced you're covering up the actual truth", type: 'text' },
      { range: [6, 6], text: 'Someone sending you secret threats', type: 'text' },
    ],
  },

  // ── Medtech ─────────────────────────────────────────────────────────────────

  {
    _id: 'MedtLp0100000000',
    name: 'What kind of Medtech are you?',
    _folder: 'Medtech',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Surgeon', type: 'text' },
      { range: [2,  2],  text: 'General Practitioner', type: 'text' },
      { range: [3,  3],  text: 'Trauma Medic', type: 'text' },
      { range: [4,  4],  text: 'Psychiatrist', type: 'text' },
      { range: [5,  5],  text: 'Cyberpsycho Therapist', type: 'text' },
      { range: [6,  6],  text: 'Ripperdoc', type: 'text' },
      { range: [7,  7],  text: 'Cryosystems Operator', type: 'text' },
      { range: [8,  8],  text: 'Pharmacist', type: 'text' },
      { range: [9,  9],  text: 'Bodysculptor', type: 'text' },
      { range: [10, 10], text: 'Forensic Pathologist', type: 'text' },
    ],
  },

  {
    _id: 'MedtLp0200000000',
    name: 'If you have a partner, who?',
    _folder: 'Medtech',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Trauma Team group', type: 'text' },
      { range: [2, 2], text: 'Old friend', type: 'text' },
      { range: [3, 3], text: 'Possible romantic partner', type: 'text' },
      { range: [4, 4], text: 'Family member', type: 'text' },
      { range: [5, 5], text: 'Secret partner with mob/gang connections', type: 'text' },
      { range: [6, 6], text: 'Secret partner with corporate connections', type: 'text' },
    ],
  },

  {
    _id: 'MedtLp0300000000',
    name: "What's your workspace like?",
    _folder: 'Medtech',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Sterilized daily in the morning like clockwork', type: 'text' },
      { range: [2, 2], text: "It's not state-of-the-art anymore, but comfortable to you", type: 'text' },
      { range: [3, 3], text: 'Cryo equipment also keeps drinks cool', type: 'text' },
      { range: [4, 4], text: 'Everything possible is single use and stored compacted until needed', type: 'text' },
      { range: [5, 5], text: 'Not as clean as your patients would have hoped', type: 'text' },
      { range: [6, 6], text: 'Meticulously organized, sharpened, and sterilized', type: 'text' },
    ],
  },

  {
    _id: 'MedtLp0400000000',
    name: 'Who are your main clients?',
    _folder: 'Medtech',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Local fixers send you clients', type: 'text' },
      { range: [2, 2], text: 'Local Bandits who protect your work or home in exchange for medical help', type: 'text' },
      { range: [3, 3], text: 'Corporate Corpos and Operatives who use you for "black project" medical work', type: 'text' },
      { range: [4, 4], text: 'Solos and other combat types', type: 'text' },
      { range: [5, 5], text: 'Local Nomads and Fixers bring you wounded clients', type: 'text' },
      { range: [6, 6], text: 'Trauma Team paramedical work', type: 'text' },
    ],
  },

  {
    _id: 'MedtLp0500000000',
    name: 'Where do you get your supplies?',
    _folder: 'Medtech',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Scavenge stashes of supplies in abandoned city zones', type: 'text' },
      { range: [2, 2], text: 'Strip parts from bodies after firefights', type: 'text' },
      { range: [3, 3], text: 'Have a local Fixer bring you supplies in exchange for medical work', type: 'text' },
      { range: [4, 4], text: 'Corporate Corpos or Trauma Team keeps you supplied in exchange for your services', type: 'text' },
      { range: [5, 5], text: 'You have a backdoor into a few corporate or hospital warehouses', type: 'text' },
      { range: [6, 6], text: 'You hit the Night Markets and score deals whenever you can', type: 'text' },
    ],
  },

  // ── Netrunner ───────────────────────────────────────────────────────────────

  {
    _id: 'NetrLp0100000000',
    name: 'What kind of Netrunner are you?',
    _folder: 'Netrunner',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Freelancer who hacks for hire', type: 'text' },
      { range: [2, 2], text: 'Corporate runner, hacking for The Man', type: 'text' },
      { range: [3, 3], text: 'Hacktivist interested in cracking systems and exposing bad guys', type: 'text' },
      { range: [4, 4], text: 'You just like to crack systems for the fun of it', type: 'text' },
      { range: [5, 5], text: 'Part of a regular team of freelancers', type: 'text' },
      { range: [6, 6], text: 'Hack for a Media, politico, or Lawman who hires you as needed', type: 'text' },
    ],
  },

  {
    _id: 'NetrLp0200000000',
    name: 'If you work with a partner, who?',
    _folder: 'Netrunner',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Family member', type: 'text' },
      { range: [2, 2], text: 'Old friend', type: 'text' },
      { range: [3, 3], text: 'Possible romantic partner', type: 'text' },
      { range: [4, 4], text: 'Secret partner who might be a rogue AI. Might.', type: 'text' },
      { range: [5, 5], text: 'Secret partner with mob/gang connections', type: 'text' },
      { range: [6, 6], text: 'Secret partner with Corporate connections', type: 'text' },
    ],
  },

  {
    _id: 'NetrLp0300000000',
    name: "What's your workspace like?",
    _folder: 'Netrunner',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'There are screens everywhere', type: 'text' },
      { range: [2, 2], text: 'It looks better in Virtuality, you swear', type: 'text' },
      { range: [3, 3], text: "It's a filthy bed covered in wires", type: 'text' },
      { range: [4, 4], text: 'Corporate, modular, and utilitarian', type: 'text' },
      { range: [5, 5], text: 'Minimalist, clean, and organized', type: 'text' },
      { range: [6, 6], text: "It's taken over your entire living space", type: 'text' },
    ],
  },

  {
    _id: 'NetrLp0400000000',
    name: 'Who are some of your other clients?',
    _folder: 'Netrunner',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Local fixers who sends you clients', type: 'text' },
      { range: [2, 2], text: 'Local gangers who also protect your work area while you sweep for NET threats', type: 'text' },
      { range: [3, 3], text: 'Corporate Corpos who use you for "black project" work', type: 'text' },
      { range: [4, 4], text: 'Local Solos or other combat types who use you to keep their personal systems secure', type: 'text' },
      { range: [5, 5], text: 'Local Nomads and Fixers who use you to keep their personal systems secure', type: 'text' },
      { range: [6, 6], text: 'You work for yourself and whatever you can find on the NET', type: 'text' },
    ],
  },

  {
    _id: 'NetrLp0500000000',
    name: 'Where do you get your programs?',
    _folder: 'Netrunner',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Dig around in old abandoned city zones', type: 'text' },
      { range: [2, 2], text: 'Steal them from other Netrunners you brain-burn', type: 'text' },
      { range: [3, 3], text: 'Have a local Fixer supply programs in exchange for hack work', type: 'text' },
      { range: [4, 4], text: 'Corporate Corpos supply programs in exchange for work', type: 'text' },
      { range: [5, 5], text: 'You have backdoors into a few Corporate warehouses', type: 'text' },
      { range: [6, 6], text: 'You hit the Night Markets and score programs whenever you can', type: 'text' },
    ],
  },

  {
    _id: 'NetrLp0600000000',
    name: "Who's gunning for you?",
    _folder: 'Netrunner',
    formula: '1d6',
    results: [
      { range: [1, 1], text: "You think it might be a rogue AI or a NET ghost. Either way, it's bad news.", type: 'text' },
      { range: [2, 2], text: "Rival Netrunners who just don't like you", type: 'text' },
      { range: [3, 3], text: 'Corporates who want you to work for them exclusively', type: 'text' },
      { range: [4, 4], text: 'Law who considers you an illegal "black hat" and wants to arrest you', type: 'text' },
      { range: [5, 5], text: 'Old client who thinks you screwed them over', type: 'text' },
      { range: [6, 6], text: 'Fixer or another client who wants you exclusively', type: 'text' },
    ],
  },

  // ── Ninja ───────────────────────────────────────────────────────────────────

  {
    _id: 'NnjLp01000000000',
    name: 'What kind of Ninja are you?',
    _folder: 'Ninja',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Sniper', type: 'text' },
      { range: [2, 2], text: 'Poisoner', type: 'text' },
      { range: [3, 3], text: 'Assassinates from the shadows', type: 'text' },
      { range: [4, 4], text: 'Masked vigilante', type: 'text' },
      { range: [5, 5], text: 'Hidden in plain sight', type: 'text' },
      { range: [6, 6], text: 'Edgelord', type: 'text' },
    ],
  },

  {
    _id: 'NnjLp02000000000',
    name: 'Who do you usually work for?',
    _folder: 'Ninja',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Government "black ops"', type: 'text' },
      { range: [2, 2], text: "A corporation's special operations", type: 'text' },
      { range: [3, 3], text: 'A Fixer sets you up with clients', type: 'text' },
      { range: [4, 4], text: 'You find clients on anonymous Data Pools', type: 'text' },
      { range: [5, 5], text: 'Yourself, according to your own convictions', type: 'text' },
      { range: [6, 6], text: 'An Operative feeds you information', type: 'text' },
    ],
  },

  {
    _id: 'NnjLp03000000000',
    name: 'If you work with someone, who?',
    _folder: 'Ninja',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Family member', type: 'text' },
      { range: [2, 2], text: 'Old friend', type: 'text' },
      { range: [3, 3], text: 'Possible romantic partner', type: 'text' },
      { range: [4, 4], text: 'Secret partner with unexpected connections', type: 'text' },
      { range: [5, 5], text: 'Secret partner with mob/gang connections', type: 'text' },
      { range: [6, 6], text: 'Secret partner with corporate connections', type: 'text' },
    ],
  },

  {
    _id: 'NnjLp04000000000',
    name: "What's your moral compass like?",
    _folder: 'Ninja',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Always working for good, trying to take out what seems like the "bad guys"', type: 'text' },
      { range: [2, 2], text: 'Always try to spare the innocent', type: 'text' },
      { range: [3, 3], text: "You'll occasionally, but rarely, take on unethical contracts", type: 'text' },
      { range: [4, 4], text: "Ruthless and profit-centered. You'll work for anyone who's willing to pay.", type: 'text' },
      { range: [5, 5], text: 'Willing to bend any rules (and law) to get the job done', type: 'text' },
      { range: [6, 6], text: 'You often engage in, and enjoy, unethical work', type: 'text' },
    ],
  },

  {
    _id: 'NnjLp05000000000',
    name: "What's your M.O.?",
    _folder: 'Ninja',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'In and out without a trace', type: 'text' },
      { range: [2, 2], text: 'Spreading death and fear from the shadows', type: 'text' },
      { range: [3, 3], text: 'Blend in, do the job, blend in again', type: 'text' },
      { range: [4, 4], text: 'Fear is a more powerful weapon than anything else', type: 'text' },
      { range: [5, 5], text: 'Close and personal — you want to look into their eyes', type: 'text' },
      { range: [6, 6], text: 'Honor bound and methodical', type: 'text' },
    ],
  },

  {
    _id: 'NnjLp06000000000',
    name: "Who's gunning for you?",
    _folder: 'Ninja',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Target who got away and wants revenge', type: 'text' },
      { range: [2, 2], text: 'Corp who wants you exclusively', type: 'text' },
      { range: [3, 3], text: 'Fixer who wants you exclusively', type: 'text' },
      { range: [4, 4], text: 'Former client who thinks you screwed them', type: 'text' },
      { range: [5, 5], text: 'Another Ninja who sees you as competition', type: 'text' },
      { range: [6, 6], text: 'Law enforcers who want you for murder charges', type: 'text' },
    ],
  },

  // ── Rocker ──────────────────────────────────────────────────────────────────

  {
    _id: 'RokrLp0100000000',
    name: 'What kind of Rocker are you?',
    _folder: 'Rocker',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Musician', type: 'text' },
      { range: [2,  2],  text: 'Slam Poet', type: 'text' },
      { range: [3,  3],  text: 'Street Artist', type: 'text' },
      { range: [4,  4],  text: 'Performance Art', type: 'text' },
      { range: [5,  5],  text: 'Comedian', type: 'text' },
      { range: [6,  6],  text: 'Orator', type: 'text' },
      { range: [7,  7],  text: 'Politico', type: 'text' },
      { range: [8,  8],  text: 'Rap Artist', type: 'text' },
      { range: [9,  9],  text: 'DJ', type: 'text' },
      { range: [10, 10], text: 'Idoru', type: 'text' },
    ],
  },

  {
    _id: 'RokrLp0200000000',
    name: 'Have you split with your band?',
    _folder: 'Rocker',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'You were a jerk and the others voted you out', type: 'text' },
      { range: [2, 2], text: "You slept with another member's partner", type: 'text' },
      { range: [3, 3], text: 'The rest were killed in a tragic "accident"', type: 'text' },
      { range: [4, 4], text: 'The rest of the group were murdered or split up by external enemies', type: 'text' },
      { range: [5, 5], text: 'The group broke up over "creative differences"', type: 'text' },
      { range: [6, 6], text: 'You decided to go solo', type: 'text' },
    ],
  },

  {
    _id: 'RokrLp0300000000',
    name: 'Where do you usually perform?',
    _folder: 'Rocker',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Alternative Cafés', type: 'text' },
      { range: [2, 2], text: 'Private Clubs', type: 'text' },
      { range: [3, 3], text: 'Seedy Dive Bars', type: 'text' },
      { range: [4, 4], text: 'Guerrilla Performances', type: 'text' },
      { range: [5, 5], text: 'Nightclubs Around the City', type: 'text' },
      { range: [6, 6], text: 'On the Data Pool', type: 'text' },
    ],
  },

  {
    _id: 'RokrLp0400000000',
    name: "Who's gunning for you or your band?",
    _folder: 'Rocker',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Old group member who thinks you did them dirty', type: 'text' },
      { range: [2,  2],  text: 'Rival group or artist trying to steal market share', type: 'text' },
      { range: [3,  3],  text: "Corporate enemies who don't like your message", type: 'text' },
      { range: [4,  4],  text: 'Critic or "influencer" trying to bring you down', type: 'text' },
      { range: [5,  5],  text: 'Older star who feels threatened by your fame', type: 'text' },
      { range: [6,  6],  text: 'Romantic interest or media figure who wants revenge for personal reasons', type: 'text' },
      { range: [7,  7],  text: "Stalker who won't let anyone else have you if they can't", type: 'text' },
      { range: [8,  8],  text: "Someone who thinks you've taken advantage of a person close to them", type: 'text' },
      { range: [9,  9],  text: "A manager who'll literally kill to secure your contract", type: 'text' },
      { range: [10, 10], text: 'Someone has taken out a contract on you for unknown reasons', type: 'text' },
    ],
  },

  // ── Solo ────────────────────────────────────────────────────────────────────

  {
    _id: 'SoloLp0100000000',
    name: 'What kind of Solo are you?',
    _folder: 'Solo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Bodyguard', type: 'text' },
      { range: [2, 2], text: 'Street muscle for hire', type: 'text' },
      { range: [3, 3], text: 'Corporate enforcer who takes jobs on the side', type: 'text' },
      { range: [4, 4], text: 'Corporate or freelance Black Ops agent', type: 'text' },
      { range: [5, 5], text: 'Local vigilante for hire', type: 'text' },
      { range: [6, 6], text: 'Hitman for hire', type: 'text' },
    ],
  },

  {
    _id: 'SoloLp0200000000',
    name: "What's your moral compass like?",
    _folder: 'Solo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Always working for good, trying to take out who seem like the "bad guys"', type: 'text' },
      { range: [2, 2], text: 'You always spare the innocent', type: 'text' },
      { range: [3, 3], text: 'You occasionally, but rarely, slip into the unethical', type: 'text' },
      { range: [4, 4], text: "Ruthless and profit-centered. You'll work for anyone who's willing to pay.", type: 'text' },
      { range: [5, 5], text: "You're willing to bend any rules (and law) to get the job done", type: 'text' },
      { range: [6, 6], text: 'You engage in, and enjoy, unethical work all the time. It makes it more interesting.', type: 'text' },
    ],
  },

  {
    _id: 'SoloLp0300000000',
    name: "What's your operational territory?",
    _folder: 'Solo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Corporate Zone', type: 'text' },
      { range: [2, 2], text: 'Combat Zone', type: 'text' },
      { range: [3, 3], text: 'The whole city', type: 'text' },
      { range: [4, 4], text: 'The territory of a single corporation', type: 'text' },
      { range: [5, 5], text: 'The territory of a particular Fixer or contact', type: 'text' },
      { range: [6, 6], text: 'Wherever the money takes you', type: 'text' },
    ],
  },

  {
    _id: 'SoloLp0400000000',
    name: "Who's gunning for you?",
    _folder: 'Solo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'A corporation you may have angered', type: 'text' },
      { range: [2, 2], text: "A boostergang you've tackled", type: 'text' },
      { range: [3, 3], text: "Law enforcers who think you're guilty of something you may or may not have done", type: 'text' },
      { range: [4, 4], text: 'Rival Solo from another corp', type: 'text' },
      { range: [5, 5], text: 'A Fixer who sees you as a threat', type: 'text' },
      { range: [6, 6], text: 'A rival Solo or Ninja who sees you as a threat', type: 'text' },
    ],
  },

  // ── Techie ──────────────────────────────────────────────────────────────────

  {
    _id: 'TechLp0100000000',
    name: 'What kind of Tech are you?',
    _folder: 'Techie',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Cyberware Technician', type: 'text' },
      { range: [2,  2],  text: 'Vehicle Mechanic', type: 'text' },
      { range: [3,  3],  text: 'Jack of All Trades', type: 'text' },
      { range: [4,  4],  text: 'Small Electronics Technician', type: 'text' },
      { range: [5,  5],  text: 'Weaponsmith', type: 'text' },
      { range: [6,  6],  text: 'Crazy Inventor', type: 'text' },
      { range: [7,  7],  text: 'Robot and Drone Mechanic', type: 'text' },
      { range: [8,  8],  text: 'Heavy Machinery Mechanic', type: 'text' },
      { range: [9,  9],  text: 'Scavenger', type: 'text' },
      { range: [10, 10], text: 'Nautical Mechanic', type: 'text' },
    ],
  },

  {
    _id: 'TechLp0200000000',
    name: 'If any, what partner do you have?',
    _folder: 'Techie',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Family Member', type: 'text' },
      { range: [2, 2], text: 'Old Friend', type: 'text' },
      { range: [3, 3], text: 'Possible Romantic Partner', type: 'text' },
      { range: [4, 4], text: 'Mentor', type: 'text' },
      { range: [5, 5], text: 'Secret with gang connections', type: 'text' },
      { range: [6, 6], text: 'Secret with corpo connections', type: 'text' },
    ],
  },

  {
    _id: 'TechLp0300000000',
    name: "What's your workspace like?",
    _folder: 'Techie',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'A mess strewn with blueprint paper', type: 'text' },
      { range: [2, 2], text: "Everything's color-coded but still a nightmare", type: 'text' },
      { range: [3, 3], text: 'Totally digital and obsessively backed up every day', type: 'text' },
      { range: [4, 4], text: 'Everything is designed in your Neuroport', type: 'text' },
      { range: [5, 5], text: 'You keep everything, just in case', type: 'text' },
      { range: [6, 6], text: 'Only you understand your filing system', type: 'text' },
    ],
  },

  {
    _id: 'TechLp0400000000',
    name: 'Who are your main clients?',
    _folder: 'Techie',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Local Fixers who send you clients', type: 'text' },
      { range: [2, 2], text: 'Local gangers who also protect your work and/or home', type: 'text' },
      { range: [3, 3], text: 'Corporate Corpos who use you for "black projects" of some kind', type: 'text' },
      { range: [4, 4], text: 'Local Solos who use you for weapon upkeep', type: 'text' },
      { range: [5, 5], text: 'Local Nomads and Fixers who bring you "found" tech to repair', type: 'text' },
      { range: [6, 6], text: 'You work for yourself and sell what you make or repair', type: 'text' },
    ],
  },

  {
    _id: 'TechLp0500000000',
    name: 'Where do you get supplies?',
    _folder: 'Techie',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Scavenge the wreckage of abandoned zones', type: 'text' },
      { range: [2, 2], text: 'Strip gear from bodies after a firefight', type: 'text' },
      { range: [3, 3], text: 'From a local Fixer in exchange for repair work', type: 'text' },
      { range: [4, 4], text: 'From Corporate Corpos in exchange for your services', type: 'text' },
      { range: [5, 5], text: 'You have a backdoor into a few warehouses', type: 'text' },
      { range: [6, 6], text: 'You hit the Night Markets to score deals when you can', type: 'text' },
    ],
  },

  {
    _id: 'TechLp0600000000',
    name: "Who's gunning for you?",
    _folder: 'Techie',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Combat Zone gangers who want you exclusively', type: 'text' },
      { range: [2, 2], text: 'Rival Tech trying to steal your customers', type: 'text' },
      { range: [3, 3], text: 'Corporates who want you exclusively', type: 'text' },
      { range: [4, 4], text: 'Larger manufacturer trying to bring you down because your mods are a threat', type: 'text' },
      { range: [5, 5], text: 'Old client who thinks you screwed them over', type: 'text' },
      { range: [6, 6], text: 'Rival Tech trying to beat you out for resources', type: 'text' },
    ],
  },

];
