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
      { range: [1,  1],  text: 'Poser gang for a specific style (1d6: 1: steampunk, 2: glamor/glitter, 3: gothic rock, 4: film noir, 5: classic movie, 6: a specific artist)', type: 0 },
      { range: [2,  2],  text: 'Booster gang that praises cybernetic enhancements.', type: 0 },
      { range: [3,  3],  text: 'A violent power gang where might is the goal.', type: 0 },
      { range: [4,  4],  text: 'Exotic poser gang using body sculpting for a non-human appearance.', type: 0 },
      { range: [5,  5],  text: 'Chemical booster gang. Emphasis on combat drugs and bio-enhancements.', type: 0 },
      { range: [6,  6],  text: 'Idealists who see themselves as ultimate protectors of the innocent.', type: 0 },
      { range: [7,  7],  text: 'Members joined only from disdain for other gangs; temporary alliance.', type: 0 },
      { range: [8,  8],  text: 'The gang is centered around a family or bloodline.', type: 0 },
      { range: [9,  9],  text: 'Doomsday cult or conspiracy theorist group.', type: 0 },
      { range: [10, 10], text: 'Cult worshipping some obscure entity or alternative religion.', type: 0 },
    ],
  },

  {
    _id: 'BndtLp0200000000',
    name: 'When things go wrong, the gang uses...',
    _folder: 'Bandit',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Murder.', type: 0 },
      { range: [2, 2], text: 'Blackmail and coercion.', type: 0 },
      { range: [3, 3], text: 'Fear.', type: 0 },
      { range: [4, 4], text: 'Dependency (drugs or cyberware).', type: 0 },
      { range: [5, 5], text: 'Kidnapping.', type: 0 },
      { range: [6, 6], text: 'Framing.', type: 0 },
    ],
  },

  {
    _id: 'BndtLp0300000000',
    name: 'How does the gang make money?',
    _folder: 'Bandit',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Illicit Drugs', type: 0 },
      { range: [2,  2],  text: 'Hacking', type: 0 },
      { range: [3,  3],  text: 'Racketeering', type: 0 },
      { range: [4,  4],  text: 'Gambling', type: 0 },
      { range: [5,  5],  text: 'Robberies', type: 0 },
      { range: [6,  6],  text: 'Fighting/Racing', type: 0 },
      { range: [7,  7],  text: 'Sex Work', type: 0 },
      { range: [8,  8],  text: 'Scams', type: 0 },
      { range: [9,  9],  text: 'Smuggling', type: 0 },
      { range: [10, 10], text: 'Scavenging', type: 0 },
    ],
  },

  {
    _id: 'BndtLp0400000000',
    name: "Where is the gang's main hangout?",
    _folder: 'Bandit',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Nightclub or Bar', type: 0 },
      { range: [2, 2], text: 'Abandoned Factory', type: 0 },
      { range: [3, 3], text: 'Thematic to the gang type', type: 0 },
      { range: [4, 4], text: 'Secret hideout', type: 0 },
      { range: [5, 5], text: 'Behind a legitimate business', type: 0 },
      { range: [6, 6], text: 'Privately owned homestead', type: 0 },
    ],
  },

  {
    _id: 'BndtLp0500000000',
    name: "The gang's current boss is...",
    _folder: 'Bandit',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Violent and ruthless, but fair.', type: 0 },
      { range: [2,  2],  text: 'Leaves almost everything to underlings.', type: 0 },
      { range: [3,  3],  text: 'Self-indulgent but fun.', type: 0 },
      { range: [4,  4],  text: 'Paranoid and scheming but effective.', type: 0 },
      { range: [5,  5],  text: 'Prone to nepotism but caring and friendly.', type: 0 },
      { range: [6,  6],  text: 'Just one in a long line of bosses who never survive long.', type: 0 },
      { range: [7,  7],  text: 'A former Edgerunner until they took a bullet to the knee.', type: 0 },
      { range: [8,  8],  text: 'In the pocket of a megacorp but pulls in eddies.', type: 0 },
      { range: [9,  9],  text: 'A complete creep, but keeps other nasties at bay.', type: 0 },
      { range: [10, 10], text: 'Unclear — the boss got killed and there is a power vacuum.', type: 0 },
    ],
  },

  // ── Corpo ───────────────────────────────────────────────────────────────────

  {
    _id: 'CrpoLp0100000000',
    name: 'What kind of Corp do you work for?',
    _folder: 'Corpo',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Financial (e.g. Asukaga & Finch)', type: 0 },
      { range: [2,  2],  text: 'Media and Communications (e.g. Network 54)', type: 0 },
      { range: [3,  3],  text: 'Cybertech and Medical Technologies (e.g. Kiroshi Opticals)', type: 0 },
      { range: [4,  4],  text: 'Pharmaceuticals and Biotech (e.g. Biotechnica)', type: 0 },
      { range: [5,  5],  text: 'Food, Clothing or General Consumables (e.g. Continental Brands)', type: 0 },
      { range: [6,  6],  text: 'Energy Production (e.g. Petrochem)', type: 0 },
      { range: [7,  7],  text: 'Personal Electronics and Robotics (e.g. Zetatech)', type: 0 },
      { range: [8,  8],  text: 'Corporate Services (e.g. Arasaka)', type: 0 },
      { range: [9,  9],  text: 'Consumer Services (e.g. Danger Girl)', type: 0 },
      { range: [10, 10], text: 'Real Estate and Construction (e.g. NightCorp)', type: 0 },
    ],
  },

  {
    _id: 'CrpoLp0200000000',
    name: 'What division do you work in?',
    _folder: 'Corpo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Procurement', type: 0 },
      { range: [2, 2], text: 'Manufacturing', type: 0 },
      { range: [3, 3], text: 'Research and Development', type: 0 },
      { range: [4, 4], text: 'Human Resources', type: 0 },
      { range: [5, 5], text: 'Public Affairs / Publicity / Advertising', type: 0 },
      { range: [6, 6], text: 'Mergers and Acquisitions', type: 0 },
    ],
  },

  {
    _id: 'CrpoLp0300000000',
    name: 'How ethical is your corp?',
    _folder: 'Corpo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Working for good, supporting ethical practices', type: 0 },
      { range: [2, 2], text: 'Operates as a fair and honest business', type: 0 },
      { range: [3, 3], text: 'Occasionally, but rarely, unethical', type: 0 },
      { range: [4, 4], text: 'Willing to bend the rules to get what it needs', type: 0 },
      { range: [5, 5], text: 'Ruthless and profit-centered', type: 0 },
      { range: [6, 6], text: 'Always involved in illegal and unethical business', type: 0 },
    ],
  },

  {
    _id: 'CrpoLp0400000000',
    name: 'How widespread is your corp?',
    _folder: 'Corpo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'One city', type: 0 },
      { range: [2, 2], text: 'Several cities', type: 0 },
      { range: [3, 3], text: 'Statewide', type: 0 },
      { range: [4, 4], text: 'National', type: 0 },
      { range: [5, 5], text: 'International, offices in several major cities', type: 0 },
      { range: [6, 6], text: 'International, offices everywhere', type: 0 },
    ],
  },

  {
    _id: 'CrpoLp0500000000',
    name: "Who's gunning for your team?",
    _folder: 'Corpo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Rival Corp in your industry', type: 0 },
      { range: [2, 2], text: 'Law enforcement is watching you', type: 0 },
      { range: [3, 3], text: 'Local Media wants to bring you down', type: 0 },
      { range: [4, 4], text: 'Different divisions in your company are feuding', type: 0 },
      { range: [5, 5], text: "Local government doesn't like your Corp", type: 0 },
      { range: [6, 6], text: 'Another Corp is eyeing you for a hostile takeover', type: 0 },
    ],
  },

  {
    _id: 'CrpoLp0600000000',
    name: 'How is your boss?',
    _folder: 'Corpo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Mentors you, but watch out for their enemies', type: 0 },
      { range: [2, 2], text: "Gives you free reins and doesn't want to know what you're up to", type: 0 },
      { range: [3, 3], text: 'A micro-manager trying to meddle in your work', type: 0 },
      { range: [4, 4], text: 'Unpredictable outbursts offset by quiet paranoia', type: 0 },
      { range: [5, 5], text: 'Cool and has your back against rivals', type: 0 },
      { range: [6, 6], text: 'Feels threatened and is planning to zero you', type: 0 },
    ],
  },

  // ── Fixer ───────────────────────────────────────────────────────────────────

  {
    _id: 'FxrLp01000000000',
    name: 'What kind of Fixer are you?',
    _folder: 'Fixer',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Broker deals between rival gangs', type: 0 },
      { range: [2,  2],  text: 'Procures atypical resources for an exclusive clientele', type: 0 },
      { range: [3,  3],  text: 'Brokers Solo or Tech services as their agent', type: 0 },
      { range: [4,  4],  text: 'Supplies a regular resource like food or medicine', type: 0 },
      { range: [5,  5],  text: 'Procures illegal resources like street drugs or milspec weapons', type: 0 },
      { range: [6,  6],  text: 'Supplies resources for Techs and Medtechs', type: 0 },
      { range: [7,  7],  text: 'Operates several successful Night Markets', type: 0 },
      { range: [8,  8],  text: 'Brokers use of heavy machinery or vehicles', type: 0 },
      { range: [9,  9],  text: 'Deals in scavenged parts from abandoned areas', type: 0 },
      { range: [10, 10], text: 'An exclusive agent for a Media, Rocker, or Nomad pack', type: 0 },
    ],
  },

  {
    _id: 'FxrLp02000000000',
    name: 'Got a business partner? If so, who?',
    _folder: 'Fixer',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Family Member', type: 0 },
      { range: [2, 2], text: 'Old Friend', type: 0 },
      { range: [3, 3], text: 'Possible Romantic Partner', type: 0 },
      { range: [4, 4], text: 'Mentor', type: 0 },
      { range: [5, 5], text: 'Secret with gang connections', type: 0 },
      { range: [6, 6], text: 'Secret with corpo connections', type: 0 },
    ],
  },

  {
    _id: 'FxrLp03000000000',
    name: 'Who are your side-clients?',
    _folder: 'Fixer',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Local Rockerboys or Medias who need gigs', type: 0 },
      { range: [2, 2], text: 'Local Bandits who also protect your work or home', type: 0 },
      { range: [3, 3], text: 'Corpos who use you for "black project" procurement work', type: 0 },
      { range: [4, 4], text: 'Local Solos or other combat types looking for work', type: 0 },
      { range: [5, 5], text: 'Local Nomads and Fixers who use you to set up deals', type: 0 },
      { range: [6, 6], text: 'Local politicos or Corpos who need information', type: 0 },
    ],
  },

  {
    _id: 'FxrLp04000000000',
    name: "What's your \"office\" like?",
    _folder: 'Fixer',
    formula: '1d6',
    results: [
      { range: [1, 1], text: "You don't have one; it's all mobile", type: 0 },
      { range: [2, 2], text: 'A booth in a local bar', type: 0 },
      { range: [3, 3], text: "It's all Data Pool messages and dead drops", type: 0 },
      { range: [4, 4], text: 'Spare room in a warehouse, shop, or clinic', type: 0 },
      { range: [5, 5], text: 'An otherwise abandoned building', type: 0 },
      { range: [6, 6], text: 'The lobby of a cube hotel', type: 0 },
    ],
  },

  {
    _id: 'FxrLp05000000000',
    name: 'Who is gunning for you?',
    _folder: 'Fixer',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Bandits who want you to work with them exclusively', type: 0 },
      { range: [2, 2], text: 'Rival Fixers trying to steal your clients', type: 0 },
      { range: [3, 3], text: 'Corpos or Operatives who want you to work for them exclusively', type: 0 },
      { range: [4, 4], text: 'Enemy of a former client who wants to tie up loose ends — like you', type: 0 },
      { range: [5, 5], text: 'Old client who thinks you screwed them over', type: 0 },
      { range: [6, 6], text: 'Rival Fixers trying to beat you out for resources', type: 0 },
    ],
  },

  // ── Guide ───────────────────────────────────────────────────────────────────

  {
    _id: 'GuidLp0100000000',
    name: 'What kind of Guide are you?',
    _folder: 'Guide',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Self-Help Guru', type: 0 },
      { range: [2,  2],  text: 'Cult Leader', type: 0 },
      { range: [3,  3],  text: 'Priest', type: 0 },
      { range: [4,  4],  text: 'Neo-Witch', type: 0 },
      { range: [5,  5],  text: 'Spirit Medium', type: 0 },
      { range: [6,  6],  text: 'Street Prophet', type: 0 },
      { range: [7,  7],  text: 'Life Coach', type: 0 },
      { range: [8,  8],  text: 'Monk', type: 0 },
      { range: [9,  9],  text: 'Card-Reader', type: 0 },
      { range: [10, 10], text: 'Psychic', type: 0 },
    ],
  },

  {
    _id: 'GuidLp0200000000',
    name: "What's your divining space like?",
    _folder: 'Guide',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Crystal balls, pseudo-mystical trinkets, and an overwhelming smell of incense', type: 0 },
      { range: [2, 2], text: 'Ascetic in order to leave room for introspection and contemplation. No distractions.', type: 0 },
      { range: [3, 3], text: 'A ritual circle on the floor, drawn in blood. Occult symbols on the walls and disturbing chants from speakers.', type: 0 },
      { range: [4, 4], text: 'A simple office with candles to set the mood and help you get into the right head-space', type: 0 },
      { range: [5, 5], text: 'A small temple with an altar and room for prayer or contemplation', type: 0 },
      { range: [6, 6], text: 'A complete mess, cluttered with anything that could provide inspiration and paraphernalia for drugs that help you get into your head-space', type: 0 },
    ],
  },

  {
    _id: 'GuidLp0300000000',
    name: 'Who are your usual clients?',
    _folder: 'Guide',
    formula: '1d6',
    results: [
      { range: [1, 1], text: "Superstitious corpos that'll try anything to get an edge over the competition", type: 0 },
      { range: [2, 2], text: 'Superstitious Fixers who want you to bless their dealings', type: 0 },
      { range: [3, 3], text: 'Faithful who seek advice and blessings', type: 0 },
      { range: [4, 4], text: "People who think that you're a prophet", type: 0 },
      { range: [5, 5], text: 'Bandits, Ninjas, and Solos who want good luck charms', type: 0 },
      { range: [6, 6], text: 'Downloads of your advice from the Data Pool', type: 0 },
    ],
  },

  {
    _id: 'GuidLp0400000000',
    name: "Who's gunning for you?",
    _folder: 'Guide',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'A former client who blames you for their misfortune', type: 0 },
      { range: [2, 2], text: 'A corpo who wants to buy you as their permanent lucky charm', type: 0 },
      { range: [3, 3], text: "Extremists who claim you're an evil witch", type: 0 },
      { range: [4, 4], text: 'A charlatan who sees you as competition', type: 0 },
      { range: [5, 5], text: 'Supposed purists who want to expose you as fake', type: 0 },
      { range: [6, 6], text: 'A mysterious stranger', type: 0 },
    ],
  },

  // ── Law ─────────────────────────────────────────────────────────────────────

  {
    _id: 'LawLp01000000000',
    name: 'What is your position in the force?',
    _folder: 'Law',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Guard', type: 0 },
      { range: [2, 2], text: 'Standard beat or patrol', type: 0 },
      { range: [3, 3], text: 'Criminal Investigation', type: 0 },
      { range: [4, 4], text: 'Special Weapons and Tactics', type: 0 },
      { range: [5, 5], text: 'Motor Patrol', type: 0 },
      { range: [6, 6], text: 'Internal Affairs', type: 0 },
    ],
  },

  {
    _id: 'LawLp02000000000',
    name: 'Where is your jurisdiction?',
    _folder: 'Law',
    formula: '3d6',
    results: [
      { range: [3,  3],  text: 'Pacifica', type: 0 },
      { range: [4,  4],  text: 'Open Highways and the Badlands', type: 0 },
      { range: [5,  5],  text: 'Corporate Plaza', type: 0 },
      { range: [6,  6],  text: 'Charter Hill', type: 0 },
      { range: [7,  7],  text: 'Rancho Coronado', type: 0 },
      { range: [8,  8],  text: 'Arroyo', type: 0 },
      { range: [9,  9],  text: 'Little China', type: 0 },
      { range: [10, 10], text: 'Kabuki', type: 0 },
      { range: [11, 11], text: 'Northside Industrial District', type: 0 },
      { range: [12, 12], text: 'Vista del Rey', type: 0 },
      { range: [13, 13], text: 'The Glen', type: 0 },
      { range: [14, 14], text: 'Japantown', type: 0 },
      { range: [15, 15], text: 'Wellsprings', type: 0 },
      { range: [16, 16], text: 'Downtown', type: 0 },
      { range: [17, 17], text: 'North Oak', type: 0 },
      { range: [18, 18], text: 'Netwatch Liaison', type: 0 },
    ],
  },

  {
    _id: 'LawLp03000000000',
    name: 'How corrupt is your unit?',
    _folder: 'Law',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Fair, honest policing with strong ethical practices', type: 0 },
      { range: [2, 2], text: 'Fair and honest policing, but hard on law-breakers', type: 0 },
      { range: [3, 3], text: 'Will occasionally, but rarely, slip into unethical actions', type: 0 },
      { range: [4, 4], text: 'Willing to bend any rules to get to the bad guys', type: 0 },
      { range: [5, 5], text: 'Ruthless to control the Street, even breaking the law to, ostensibly, uphold it', type: 0 },
      { range: [6, 6], text: 'Corrupt, taking bribes and engaging in illegal and unethical business all the time', type: 0 },
    ],
  },

  {
    _id: 'LawLp04000000000',
    name: "Who's gunning for your unit?",
    _folder: 'Law',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Friends of a criminal you helped put away', type: 0 },
      { range: [2, 2], text: 'An escaped or released criminal who blames you', type: 0 },
      { range: [3, 3], text: 'Police Accountability Group', type: 0 },
      { range: [4, 4], text: 'Dirty Politicians', type: 0 },
      { range: [5, 5], text: 'A powerful gang', type: 0 },
      { range: [6, 6], text: "Dirty cops whose plans you're in the way of", type: 0 },
    ],
  },

  {
    _id: 'LawLp05000000000',
    name: "Who are your unit's major targets?",
    _folder: 'Law',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Organized Crime', type: 0 },
      { range: [2, 2], text: 'Trafficking and kidnapping', type: 0 },
      { range: [3, 3], text: 'Illicit trade (1d6: 1: Drugs, 2: XBDs, 3: Weapons, 4: Counterfeit luxury items, 5: Organs or Cyberware, 6: Fenced stolen goods)', type: 0 },
      { range: [4, 4], text: 'Burglars and robbers', type: 0 },
      { range: [5, 5], text: 'Illegal gambling', type: 0 },
      { range: [6, 6], text: 'Street Criminals', type: 0 },
    ],
  },

  // ── Media ───────────────────────────────────────────────────────────────────

  {
    _id: 'MedaLp0100000000',
    name: 'What kind of Media are you?',
    _folder: 'Media',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Blogger', type: 0 },
      { range: [2, 2], text: 'Writer (Books)', type: 0 },
      { range: [3, 3], text: 'Videographer', type: 0 },
      { range: [4, 4], text: 'Documentarian', type: 0 },
      { range: [5, 5], text: 'Investigative Reporter', type: 0 },
      { range: [6, 6], text: 'Street Scribe', type: 0 },
    ],
  },

  {
    _id: 'MedaLp0200000000',
    name: 'How do you reach the public?',
    _folder: 'Media',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Monthly Magazine', type: 0 },
      { range: [2, 2], text: 'Blog', type: 0 },
      { range: [3, 3], text: 'Mainstream Vid Feed', type: 0 },
      { range: [4, 4], text: 'News Channel', type: 0 },
      { range: [5, 5], text: 'Radio Broadcasts', type: 0 },
      { range: [6, 6], text: 'Screamsheets', type: 0 },
    ],
  },

  {
    _id: 'MedaLp0300000000',
    name: 'What do you report on?',
    _folder: 'Media',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Political Intrigue', type: 0 },
      { range: [2, 2], text: 'Ecological Impact', type: 0 },
      { range: [3, 3], text: 'Celebrity News', type: 0 },
      { range: [4, 4], text: 'Corporate Takedowns', type: 0 },
      { range: [5, 5], text: 'Editorials', type: 0 },
      { range: [6, 6], text: 'Propaganda', type: 0 },
    ],
  },

  {
    _id: 'MedaLp0400000000',
    name: 'How ethical are you?',
    _folder: 'Media',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Fair, honest reporting. Strong ethical practices. You only report the verifiable truth.', type: 0 },
      { range: [2, 2], text: 'Fair and honest reporting, but willing to go on hearsay and rumor if that\'s what it takes', type: 0 },
      { range: [3, 3], text: 'Will occasionally but rarely slip into unethical things. You have some standards.', type: 0 },
      { range: [4, 4], text: 'Willing to bend any rules to get the bad guys, but only the bad guys', type: 0 },
      { range: [5, 5], text: 'Ruthless and determined to make it big, even if it means breaking the law', type: 0 },
      { range: [6, 6], text: 'Totally corrupt, taking bribes and engaging in illegal and unethical reporting — your pen is for hire', type: 0 },
    ],
  },

  {
    _id: 'MedaLp0500000000',
    name: "Who's gunning for you?",
    _folder: 'Media',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'A corpo or politico you exposed who wants revenge', type: 0 },
      { range: [2, 2], text: 'Someone who was hurt by others after your reporting', type: 0 },
      { range: [3, 3], text: 'An informant who blames you for being exposed', type: 0 },
      { range: [4, 4], text: 'A Ninja or Solo hired to silence you', type: 0 },
      { range: [5, 5], text: "A conspiracy theorist convinced you're covering up the actual truth", type: 0 },
      { range: [6, 6], text: 'Someone sending you secret threats', type: 0 },
    ],
  },

  // ── Medtech ─────────────────────────────────────────────────────────────────

  {
    _id: 'MedtLp0100000000',
    name: 'What kind of Medtech are you?',
    _folder: 'Medtech',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Surgeon', type: 0 },
      { range: [2,  2],  text: 'General Practitioner', type: 0 },
      { range: [3,  3],  text: 'Trauma Medic', type: 0 },
      { range: [4,  4],  text: 'Psychiatrist', type: 0 },
      { range: [5,  5],  text: 'Cyberpsycho Therapist', type: 0 },
      { range: [6,  6],  text: 'Ripperdoc', type: 0 },
      { range: [7,  7],  text: 'Cryosystems Operator', type: 0 },
      { range: [8,  8],  text: 'Pharmacist', type: 0 },
      { range: [9,  9],  text: 'Bodysculptor', type: 0 },
      { range: [10, 10], text: 'Forensic Pathologist', type: 0 },
    ],
  },

  {
    _id: 'MedtLp0200000000',
    name: 'If you have a partner, who?',
    _folder: 'Medtech',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Trauma Team group', type: 0 },
      { range: [2, 2], text: 'Old friend', type: 0 },
      { range: [3, 3], text: 'Possible romantic partner', type: 0 },
      { range: [4, 4], text: 'Family member', type: 0 },
      { range: [5, 5], text: 'Secret partner with mob/gang connections', type: 0 },
      { range: [6, 6], text: 'Secret partner with corporate connections', type: 0 },
    ],
  },

  {
    _id: 'MedtLp0300000000',
    name: "What's your workspace like?",
    _folder: 'Medtech',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Sterilized daily in the morning like clockwork', type: 0 },
      { range: [2, 2], text: "It's not state-of-the-art anymore, but comfortable to you", type: 0 },
      { range: [3, 3], text: 'Cryo equipment also keeps drinks cool', type: 0 },
      { range: [4, 4], text: 'Everything possible is single use and stored compacted until needed', type: 0 },
      { range: [5, 5], text: 'Not as clean as your patients would have hoped', type: 0 },
      { range: [6, 6], text: 'Meticulously organized, sharpened, and sterilized', type: 0 },
    ],
  },

  {
    _id: 'MedtLp0400000000',
    name: 'Who are your main clients?',
    _folder: 'Medtech',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Local fixers send you clients', type: 0 },
      { range: [2, 2], text: 'Local Bandits who protect your work or home in exchange for medical help', type: 0 },
      { range: [3, 3], text: 'Corporate Corpos and Operatives who use you for "black project" medical work', type: 0 },
      { range: [4, 4], text: 'Solos and other combat types', type: 0 },
      { range: [5, 5], text: 'Local Nomads and Fixers bring you wounded clients', type: 0 },
      { range: [6, 6], text: 'Trauma Team paramedical work', type: 0 },
    ],
  },

  {
    _id: 'MedtLp0500000000',
    name: 'Where do you get your supplies?',
    _folder: 'Medtech',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Scavenge stashes of supplies in abandoned city zones', type: 0 },
      { range: [2, 2], text: 'Strip parts from bodies after firefights', type: 0 },
      { range: [3, 3], text: 'Have a local Fixer bring you supplies in exchange for medical work', type: 0 },
      { range: [4, 4], text: 'Corporate Corpos or Trauma Team keeps you supplied in exchange for your services', type: 0 },
      { range: [5, 5], text: 'You have a backdoor into a few corporate or hospital warehouses', type: 0 },
      { range: [6, 6], text: 'You hit the Night Markets and score deals whenever you can', type: 0 },
    ],
  },

  // ── Netrunner ───────────────────────────────────────────────────────────────

  {
    _id: 'NetrLp0100000000',
    name: 'What kind of Netrunner are you?',
    _folder: 'Netrunner',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Freelancer who hacks for hire', type: 0 },
      { range: [2, 2], text: 'Corporate runner, hacking for The Man', type: 0 },
      { range: [3, 3], text: 'Hacktivist interested in cracking systems and exposing bad guys', type: 0 },
      { range: [4, 4], text: 'You just like to crack systems for the fun of it', type: 0 },
      { range: [5, 5], text: 'Part of a regular team of freelancers', type: 0 },
      { range: [6, 6], text: 'Hack for a Media, politico, or Lawman who hires you as needed', type: 0 },
    ],
  },

  {
    _id: 'NetrLp0200000000',
    name: 'If you work with a partner, who?',
    _folder: 'Netrunner',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Family member', type: 0 },
      { range: [2, 2], text: 'Old friend', type: 0 },
      { range: [3, 3], text: 'Possible romantic partner', type: 0 },
      { range: [4, 4], text: 'Secret partner who might be a rogue AI. Might.', type: 0 },
      { range: [5, 5], text: 'Secret partner with mob/gang connections', type: 0 },
      { range: [6, 6], text: 'Secret partner with Corporate connections', type: 0 },
    ],
  },

  {
    _id: 'NetrLp0300000000',
    name: "What's your workspace like?",
    _folder: 'Netrunner',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'There are screens everywhere', type: 0 },
      { range: [2, 2], text: 'It looks better in Virtuality, you swear', type: 0 },
      { range: [3, 3], text: "It's a filthy bed covered in wires", type: 0 },
      { range: [4, 4], text: 'Corporate, modular, and utilitarian', type: 0 },
      { range: [5, 5], text: 'Minimalist, clean, and organized', type: 0 },
      { range: [6, 6], text: "It's taken over your entire living space", type: 0 },
    ],
  },

  {
    _id: 'NetrLp0400000000',
    name: 'Who are some of your other clients?',
    _folder: 'Netrunner',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Local fixers who sends you clients', type: 0 },
      { range: [2, 2], text: 'Local gangers who also protect your work area while you sweep for NET threats', type: 0 },
      { range: [3, 3], text: 'Corporate Corpos who use you for "black project" work', type: 0 },
      { range: [4, 4], text: 'Local Solos or other combat types who use you to keep their personal systems secure', type: 0 },
      { range: [5, 5], text: 'Local Nomads and Fixers who use you to keep their personal systems secure', type: 0 },
      { range: [6, 6], text: 'You work for yourself and whatever you can find on the NET', type: 0 },
    ],
  },

  {
    _id: 'NetrLp0500000000',
    name: 'Where do you get your programs?',
    _folder: 'Netrunner',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Dig around in old abandoned city zones', type: 0 },
      { range: [2, 2], text: 'Steal them from other Netrunners you brain-burn', type: 0 },
      { range: [3, 3], text: 'Have a local Fixer supply programs in exchange for hack work', type: 0 },
      { range: [4, 4], text: 'Corporate Corpos supply programs in exchange for work', type: 0 },
      { range: [5, 5], text: 'You have backdoors into a few Corporate warehouses', type: 0 },
      { range: [6, 6], text: 'You hit the Night Markets and score programs whenever you can', type: 0 },
    ],
  },

  {
    _id: 'NetrLp0600000000',
    name: "Who's gunning for you?",
    _folder: 'Netrunner',
    formula: '1d6',
    results: [
      { range: [1, 1], text: "You think it might be a rogue AI or a NET ghost. Either way, it's bad news.", type: 0 },
      { range: [2, 2], text: "Rival Netrunners who just don't like you", type: 0 },
      { range: [3, 3], text: 'Corporates who want you to work for them exclusively', type: 0 },
      { range: [4, 4], text: 'Law who considers you an illegal "black hat" and wants to arrest you', type: 0 },
      { range: [5, 5], text: 'Old client who thinks you screwed them over', type: 0 },
      { range: [6, 6], text: 'Fixer or another client who wants you exclusively', type: 0 },
    ],
  },

  // ── Ninja ───────────────────────────────────────────────────────────────────

  {
    _id: 'NnjLp01000000000',
    name: 'What kind of Ninja are you?',
    _folder: 'Ninja',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Sniper', type: 0 },
      { range: [2, 2], text: 'Poisoner', type: 0 },
      { range: [3, 3], text: 'Assassinates from the shadows', type: 0 },
      { range: [4, 4], text: 'Masked vigilante', type: 0 },
      { range: [5, 5], text: 'Hidden in plain sight', type: 0 },
      { range: [6, 6], text: 'Edgelord', type: 0 },
    ],
  },

  {
    _id: 'NnjLp02000000000',
    name: 'Who do you usually work for?',
    _folder: 'Ninja',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Government "black ops"', type: 0 },
      { range: [2, 2], text: "A corporation's special operations", type: 0 },
      { range: [3, 3], text: 'A Fixer sets you up with clients', type: 0 },
      { range: [4, 4], text: 'You find clients on anonymous Data Pools', type: 0 },
      { range: [5, 5], text: 'Yourself, according to your own convictions', type: 0 },
      { range: [6, 6], text: 'An Operative feeds you information', type: 0 },
    ],
  },

  {
    _id: 'NnjLp03000000000',
    name: 'If you work with someone, who?',
    _folder: 'Ninja',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Family member', type: 0 },
      { range: [2, 2], text: 'Old friend', type: 0 },
      { range: [3, 3], text: 'Possible romantic partner', type: 0 },
      { range: [4, 4], text: 'Secret partner with unexpected connections', type: 0 },
      { range: [5, 5], text: 'Secret partner with mob/gang connections', type: 0 },
      { range: [6, 6], text: 'Secret partner with corporate connections', type: 0 },
    ],
  },

  {
    _id: 'NnjLp04000000000',
    name: "What's your moral compass like?",
    _folder: 'Ninja',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Always working for good, trying to take out what seems like the "bad guys"', type: 0 },
      { range: [2, 2], text: 'Always try to spare the innocent', type: 0 },
      { range: [3, 3], text: "You'll occasionally, but rarely, take on unethical contracts", type: 0 },
      { range: [4, 4], text: "Ruthless and profit-centered. You'll work for anyone who's willing to pay.", type: 0 },
      { range: [5, 5], text: 'Willing to bend any rules (and law) to get the job done', type: 0 },
      { range: [6, 6], text: 'You often engage in, and enjoy, unethical work', type: 0 },
    ],
  },

  {
    _id: 'NnjLp05000000000',
    name: "What's your M.O.?",
    _folder: 'Ninja',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'In and out without a trace', type: 0 },
      { range: [2, 2], text: 'Spreading death and fear from the shadows', type: 0 },
      { range: [3, 3], text: 'Blend in, do the job, blend in again', type: 0 },
      { range: [4, 4], text: 'Fear is a more powerful weapon than anything else', type: 0 },
      { range: [5, 5], text: 'Close and personal — you want to look into their eyes', type: 0 },
      { range: [6, 6], text: 'Honor bound and methodical', type: 0 },
    ],
  },

  {
    _id: 'NnjLp06000000000',
    name: "Who's gunning for you?",
    _folder: 'Ninja',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Target who got away and wants revenge', type: 0 },
      { range: [2, 2], text: 'Corp who wants you exclusively', type: 0 },
      { range: [3, 3], text: 'Fixer who wants you exclusively', type: 0 },
      { range: [4, 4], text: 'Former client who thinks you screwed them', type: 0 },
      { range: [5, 5], text: 'Another Ninja who sees you as competition', type: 0 },
      { range: [6, 6], text: 'Law enforcers who want you for murder charges', type: 0 },
    ],
  },

  // ── Rocker ──────────────────────────────────────────────────────────────────

  {
    _id: 'RokrLp0100000000',
    name: 'What kind of Rocker are you?',
    _folder: 'Rocker',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Musician', type: 0 },
      { range: [2,  2],  text: 'Slam Poet', type: 0 },
      { range: [3,  3],  text: 'Street Artist', type: 0 },
      { range: [4,  4],  text: 'Performance Art', type: 0 },
      { range: [5,  5],  text: 'Comedian', type: 0 },
      { range: [6,  6],  text: 'Orator', type: 0 },
      { range: [7,  7],  text: 'Politico', type: 0 },
      { range: [8,  8],  text: 'Rap Artist', type: 0 },
      { range: [9,  9],  text: 'DJ', type: 0 },
      { range: [10, 10], text: 'Idoru', type: 0 },
    ],
  },

  {
    _id: 'RokrLp0200000000',
    name: 'Have you split with your band?',
    _folder: 'Rocker',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'You were a jerk and the others voted you out', type: 0 },
      { range: [2, 2], text: "You slept with another member's partner", type: 0 },
      { range: [3, 3], text: 'The rest were killed in a tragic "accident"', type: 0 },
      { range: [4, 4], text: 'The rest of the group were murdered or split up by external enemies', type: 0 },
      { range: [5, 5], text: 'The group broke up over "creative differences"', type: 0 },
      { range: [6, 6], text: 'You decided to go solo', type: 0 },
    ],
  },

  {
    _id: 'RokrLp0300000000',
    name: 'Where do you usually perform?',
    _folder: 'Rocker',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Alternative Cafés', type: 0 },
      { range: [2, 2], text: 'Private Clubs', type: 0 },
      { range: [3, 3], text: 'Seedy Dive Bars', type: 0 },
      { range: [4, 4], text: 'Guerrilla Performances', type: 0 },
      { range: [5, 5], text: 'Nightclubs Around the City', type: 0 },
      { range: [6, 6], text: 'On the Data Pool', type: 0 },
    ],
  },

  {
    _id: 'RokrLp0400000000',
    name: "Who's gunning for you or your band?",
    _folder: 'Rocker',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Old group member who thinks you did them dirty', type: 0 },
      { range: [2,  2],  text: 'Rival group or artist trying to steal market share', type: 0 },
      { range: [3,  3],  text: "Corporate enemies who don't like your message", type: 0 },
      { range: [4,  4],  text: 'Critic or "influencer" trying to bring you down', type: 0 },
      { range: [5,  5],  text: 'Older star who feels threatened by your fame', type: 0 },
      { range: [6,  6],  text: 'Romantic interest or media figure who wants revenge for personal reasons', type: 0 },
      { range: [7,  7],  text: "Stalker who won't let anyone else have you if they can't", type: 0 },
      { range: [8,  8],  text: "Someone who thinks you've taken advantage of a person close to them", type: 0 },
      { range: [9,  9],  text: "A manager who'll literally kill to secure your contract", type: 0 },
      { range: [10, 10], text: 'Someone has taken out a contract on you for unknown reasons', type: 0 },
    ],
  },

  // ── Solo ────────────────────────────────────────────────────────────────────

  {
    _id: 'SoloLp0100000000',
    name: 'What kind of Solo are you?',
    _folder: 'Solo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Bodyguard', type: 0 },
      { range: [2, 2], text: 'Street muscle for hire', type: 0 },
      { range: [3, 3], text: 'Corporate enforcer who takes jobs on the side', type: 0 },
      { range: [4, 4], text: 'Corporate or freelance Black Ops agent', type: 0 },
      { range: [5, 5], text: 'Local vigilante for hire', type: 0 },
      { range: [6, 6], text: 'Hitman for hire', type: 0 },
    ],
  },

  {
    _id: 'SoloLp0200000000',
    name: "What's your moral compass like?",
    _folder: 'Solo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Always working for good, trying to take out who seem like the "bad guys"', type: 0 },
      { range: [2, 2], text: 'You always spare the innocent', type: 0 },
      { range: [3, 3], text: 'You occasionally, but rarely, slip into the unethical', type: 0 },
      { range: [4, 4], text: "Ruthless and profit-centered. You'll work for anyone who's willing to pay.", type: 0 },
      { range: [5, 5], text: "You're willing to bend any rules (and law) to get the job done", type: 0 },
      { range: [6, 6], text: 'You engage in, and enjoy, unethical work all the time. It makes it more interesting.', type: 0 },
    ],
  },

  {
    _id: 'SoloLp0300000000',
    name: "What's your operational territory?",
    _folder: 'Solo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Corporate Zone', type: 0 },
      { range: [2, 2], text: 'Combat Zone', type: 0 },
      { range: [3, 3], text: 'The whole city', type: 0 },
      { range: [4, 4], text: 'The territory of a single corporation', type: 0 },
      { range: [5, 5], text: 'The territory of a particular Fixer or contact', type: 0 },
      { range: [6, 6], text: 'Wherever the money takes you', type: 0 },
    ],
  },

  {
    _id: 'SoloLp0400000000',
    name: "Who's gunning for you?",
    _folder: 'Solo',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'A corporation you may have angered', type: 0 },
      { range: [2, 2], text: "A boostergang you've tackled", type: 0 },
      { range: [3, 3], text: "Law enforcers who think you're guilty of something you may or may not have done", type: 0 },
      { range: [4, 4], text: 'Rival Solo from another corp', type: 0 },
      { range: [5, 5], text: 'A Fixer who sees you as a threat', type: 0 },
      { range: [6, 6], text: 'A rival Solo or Ninja who sees you as a threat', type: 0 },
    ],
  },

  // ── Techie ──────────────────────────────────────────────────────────────────

  {
    _id: 'TechLp0100000000',
    name: 'What kind of Tech are you?',
    _folder: 'Techie',
    formula: '1d10',
    results: [
      { range: [1,  1],  text: 'Cyberware Technician', type: 0 },
      { range: [2,  2],  text: 'Vehicle Mechanic', type: 0 },
      { range: [3,  3],  text: 'Jack of All Trades', type: 0 },
      { range: [4,  4],  text: 'Small Electronics Technician', type: 0 },
      { range: [5,  5],  text: 'Weaponsmith', type: 0 },
      { range: [6,  6],  text: 'Crazy Inventor', type: 0 },
      { range: [7,  7],  text: 'Robot and Drone Mechanic', type: 0 },
      { range: [8,  8],  text: 'Heavy Machinery Mechanic', type: 0 },
      { range: [9,  9],  text: 'Scavenger', type: 0 },
      { range: [10, 10], text: 'Nautical Mechanic', type: 0 },
    ],
  },

  {
    _id: 'TechLp0200000000',
    name: 'If any, what partner do you have?',
    _folder: 'Techie',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Family Member', type: 0 },
      { range: [2, 2], text: 'Old Friend', type: 0 },
      { range: [3, 3], text: 'Possible Romantic Partner', type: 0 },
      { range: [4, 4], text: 'Mentor', type: 0 },
      { range: [5, 5], text: 'Secret with gang connections', type: 0 },
      { range: [6, 6], text: 'Secret with corpo connections', type: 0 },
    ],
  },

  {
    _id: 'TechLp0300000000',
    name: "What's your workspace like?",
    _folder: 'Techie',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'A mess strewn with blueprint paper', type: 0 },
      { range: [2, 2], text: "Everything's color-coded but still a nightmare", type: 0 },
      { range: [3, 3], text: 'Totally digital and obsessively backed up every day', type: 0 },
      { range: [4, 4], text: 'Everything is designed in your Neuroport', type: 0 },
      { range: [5, 5], text: 'You keep everything, just in case', type: 0 },
      { range: [6, 6], text: 'Only you understand your filing system', type: 0 },
    ],
  },

  {
    _id: 'TechLp0400000000',
    name: 'Who are your main clients?',
    _folder: 'Techie',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Local Fixers who send you clients', type: 0 },
      { range: [2, 2], text: 'Local gangers who also protect your work and/or home', type: 0 },
      { range: [3, 3], text: 'Corporate Corpos who use you for "black projects" of some kind', type: 0 },
      { range: [4, 4], text: 'Local Solos who use you for weapon upkeep', type: 0 },
      { range: [5, 5], text: 'Local Nomads and Fixers who bring you "found" tech to repair', type: 0 },
      { range: [6, 6], text: 'You work for yourself and sell what you make or repair', type: 0 },
    ],
  },

  {
    _id: 'TechLp0500000000',
    name: 'Where do you get supplies?',
    _folder: 'Techie',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Scavenge the wreckage of abandoned zones', type: 0 },
      { range: [2, 2], text: 'Strip gear from bodies after a firefight', type: 0 },
      { range: [3, 3], text: 'From a local Fixer in exchange for repair work', type: 0 },
      { range: [4, 4], text: 'From Corporate Corpos in exchange for your services', type: 0 },
      { range: [5, 5], text: 'You have a backdoor into a few warehouses', type: 0 },
      { range: [6, 6], text: 'You hit the Night Markets to score deals when you can', type: 0 },
    ],
  },

  {
    _id: 'TechLp0600000000',
    name: "Who's gunning for you?",
    _folder: 'Techie',
    formula: '1d6',
    results: [
      { range: [1, 1], text: 'Combat Zone gangers who want you exclusively', type: 0 },
      { range: [2, 2], text: 'Rival Tech trying to steal your customers', type: 0 },
      { range: [3, 3], text: 'Corporates who want you exclusively', type: 0 },
      { range: [4, 4], text: 'Larger manufacturer trying to bring you down because your mods are a threat', type: 0 },
      { range: [5, 5], text: 'Old client who thinks you screwed them over', type: 0 },
      { range: [6, 6], text: 'Rival Tech trying to beat you out for resources', type: 0 },
    ],
  },

];
