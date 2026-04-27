/**
 * Drug catalogue — all drugs from the Cyberpunk Blue source.
 *
 * Each entry is Foundry Item create-data ready for `Item.createDocuments`.
 * The `_folder` property is stripped before the item is written to the pack.
 */

const COST = {
  CH:  '€$10 (Cheap)',
  EV:  '€$20 (Everyday)',
  CO:  '€$50 (Costly)',
  PR:  '€$100 (Premium)',
  EX:  '€$500 (Expensive)',
  VEX: '€$1,000 (Very Expensive)',
  LUX: '€$5,000 (Luxury)',
  SLX: '€$10,000 (Super Luxury)',
};

const h = (text) => `<p>${text}</p>`;

function drug({ name, cost, duration, primary, secDv, secondary, addiction = '', description = '' }) {
  return {
    _folder: 'Drugs',
    name,
    type: 'drug',
    img: '',
    system: {
      manufacturer: '',
      cost: COST[cost] ?? cost,
      duration,
      primaryEffect: h(primary),
      secondaryDv: secDv,
      secondaryEffect: h(secondary),
      addictionPenalty: addiction ? h(addiction) : '',
      description: description ? h(description) : '',
      notes: '',
    },
  };
}

export const DRUG_CATALOGUE = [
  drug({
    name: 'Antibiotics',
    cost: 'CO',
    description: 'Sold in packs of 10 doses.',
    duration: '24 hours',
    primary: '−1 to BODY checks. If the secondary effect is avoided, gain +2 to natural healing for the day.',
    secDv: 10,
    secondary: 'Full day of nausea; no natural healing for the day.',
    addiction: '',
  }),
  drug({
    name: 'Black Lace',
    cost: 'CO',
    duration: '24 hours',
    primary: 'Lose 2d6 PSYCHE temporarily (regained if secondary is avoided). Ignore Seriously Wounded, Broken Arm/Leg/Ribs/Jaw, and Torn Muscle/Foreign Object Critical Injury effects; each turn you benefit from this immunity costs 1d6 HP.',
    secDv: 17,
    secondary: 'PSYCHE loss becomes permanent. If not already addicted, you are now addicted.',
    addiction: 'RFLX −2 while addicted but not actively using.',
  }),
  drug({
    name: 'Blue Glass',
    cost: 'EV',
    duration: '4 hours',
    primary: 'Restore 1 temporary PSYCHE (this benefit can only be gained once per week). Frequent minor hallucinations and synesthesia occur throughout; you cannot take normal actions during these episodes.',
    secDv: 15,
    secondary: 'The restored PSYCHE is lost. If not already addicted, you are now addicted.',
    addiction: 'Debilitating hallucinations roughly once per hour while addicted but not actively using; these episodes prevent regular actions. The drug only suppresses these episodes.',
  }),
  drug({
    name: 'Boost',
    cost: 'CO',
    duration: '20 hours',
    primary: 'INT +2 (maximum of 8 total).',
    secDv: 17,
    secondary: 'If not already addicted, you are now addicted.',
    addiction: 'INT −2 while addicted but not actively using.',
  }),
  drug({
    name: 'Immunoblockers',
    cost: 'PR',
    duration: 'Wears off at a stressful moment (likelihood increases over time); maximum 1 month.',
    primary: 'Immediately restore 2d6 PSYCHE. Characters in full cyberpsychosis may require multiple doses before any benefit is possible.',
    secDv: 21,
    secondary: 'The PSYCHE gained is lost. −2 to all checks for the next 1 minute (20 rounds). If the user does not take 2 doses (which can be a combined Action) within that 1-minute window, they lose 4d6 PSYCHE.',
    addiction: '',
  }),
  drug({
    name: 'PDGF Injection',
    cost: 'CO',
    duration: '4 hours',
    primary: 'Instantly regain 1d6 HP. Additional doses within 24 hours leave the user merely hungry, thirsty, and lightly anaemic.',
    secDv: 15,
    secondary: 'Tissues grow into each other abnormally. The user takes 1d6÷2 damage each time they move more than half their MOVE, Evade, use Athletics, or perform similar advanced movement. Fix: DV13 TECH+Medicine (Surgery) at a ripperdoc, or CO for the treatment.',
    addiction: '',
  }),
  drug({
    name: 'RPM',
    cost: 'EV',
    duration: '20 hours',
    primary: 'Reduce your current Fatigue level by one step (if merely Fatigued, you suffer no ill effects). If taken within the previous 24 hours, also lose 1d6÷2 PSYCHE (round down).',
    secDv: 13,
    secondary: 'If not already addicted, you are now addicted.',
    addiction: 'Always at least Fatigued while addicted but not actively using.',
  }),
  drug({
    name: 'Smash',
    cost: 'CH',
    duration: '4 hours',
    primary: 'Euphoria and confidence; +2 to Acting, Contortionist, Human Perception, Influence, and Performance.',
    secDv: 15,
    secondary: 'If not already addicted, you are now addicted.',
    addiction: '−2 to Acting, Contortionist, Human Perception, Influence, and Performance while addicted but not using. Intense occasional cravings.',
  }),
  drug({
    name: 'Speed',
    cost: 'EV',
    duration: '8 hours',
    primary: 'No sense of hunger (the physical need persists). Fatigue penalties reduced by 1.',
    secDv: 15,
    secondary: 'If not already addicted, you are now addicted.',
    addiction: '−2 on tasks requiring extended focus while addicted but not using.',
  }),
  drug({
    name: 'Synthcoke',
    cost: 'EV',
    duration: '4 hours',
    primary: 'RFLX +1. Constant sense of paranoia and being watched.',
    secDv: 15,
    secondary: 'If not already addicted, you are now addicted.',
    addiction: 'RFLX −2 while addicted but not using. Intense, near-uncontrollable cravings.',
  }),
];
