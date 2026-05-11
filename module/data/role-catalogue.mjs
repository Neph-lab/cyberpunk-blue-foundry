/**
 * Role catalogue — all Cyberpunk Blue Roles as compendium-ready items.
 *
 * Each entry maps directly to a role Item document. Starting gear references
 * (grantedItemGroups) are initially empty and should be wired up by the GM or
 * a future sync function once the gear compendium UUIDs are known.
 *
 * Ability overview text and section HTML is intentionally concise; the full
 * rules text appears on-screen from the Role item sheet.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function id(slug) { return slug; }

function role({
  name, category, img, description = '', lifepathLinks = '', lifepathQuestions = '',
  abilityOverview = '', abilitySections = [], grantedItemGroups = [],
  leaderFeatures = [], proteanFoci = [], specialties = [], notes = '',
}) {
  return {
    name,
    type: 'role',
    img: img ?? 'icons/svg/mystery-man.svg',
    _folder: 'Roles',
    system: {
      category,
      description,
      lifepathLinks,
      lifepathQuestions,
      abilityOverview,
      abilitySections,
      grantedItemGroups,
      leaderFeatures,
      proteanFoci,
      specialties,
      notes,
      rank: 0,
    },
  };
}

// ── Bandit ────────────────────────────────────────────────────────────────────

export const BANDIT = role({
  name: 'Bandit',
  category: 'networker',
  img: 'systems/cyberpunk-blue/assets/Roles/bandit.png',
  description: `<p>Dealing with street gangs is a fact of life. Bandits work their way through the dangerous underbelly of society. They might start as lowly thugs, but the ambitious and ruthless might become the next crime boss of the city.</p>
<p>A combination of their ability to handle the roughest part of society and the contacts within their gang defines bandits. Attitude is vital — in a gang, it is all you really have.</p>
<blockquote><em>Ya strong 'nuff to chrome up? Split some nerves?</em><br>∆ Maelstrom recruiter</blockquote>`,
  lifepathLinks: `<h3>What kind of gang are you in?</h3>
<table><thead><tr><th>1d10</th><th>Type of Gang</th></tr></thead><tbody>
<tr><td>1</td><td>Poser gang for a specific style (1d6: 1: steampunk, 2: glamor/glitter, 3: gothic rock, 4: film noir, 5: classic movie, 6: a specific artist)</td></tr>
<tr><td>2</td><td>Booster gang that praises cybernetic enhancements.</td></tr>
<tr><td>3</td><td>A violent power gang where might is the goal.</td></tr>
<tr><td>4</td><td>Exotic poser gang using body sculpting for a non-human appearance.</td></tr>
<tr><td>5</td><td>Chemical booster gang. Emphasis on combat drugs and bio-enhancements.</td></tr>
<tr><td>6</td><td>Idealists who see themselves as ultimate protectors of the innocent.</td></tr>
<tr><td>7</td><td>Members joined only from disdain for other gangs; temporary alliance.</td></tr>
<tr><td>8</td><td>The gang is centered around a family or bloodline.</td></tr>
<tr><td>9</td><td>Doomsday cult or conspiracy theorist group.</td></tr>
<tr><td>10</td><td>Cult worshipping some obscure entity or alternative religion.</td></tr>
</tbody></table>
<h3>When things go wrong, the gang uses...</h3>
<table><thead><tr><th>1d6</th><th>Methods</th></tr></thead><tbody>
<tr><td>1</td><td>Murder.</td></tr><tr><td>2</td><td>Blackmail and coercion.</td></tr>
<tr><td>3</td><td>Fear.</td></tr><tr><td>4</td><td>Dependency (drugs or cyberware).</td></tr>
<tr><td>5</td><td>Kidnapping.</td></tr><tr><td>6</td><td>Framing.</td></tr>
</tbody></table>
<h3>How does the gang make money?</h3>
<table><thead><tr><th>1d10</th><th>Source</th></tr></thead><tbody>
<tr><td>1</td><td>Illicit Drugs</td></tr><tr><td>2</td><td>Hacking</td></tr>
<tr><td>3</td><td>Racketeering</td></tr><tr><td>4</td><td>Gambling</td></tr>
<tr><td>5</td><td>Robberies</td></tr><tr><td>6</td><td>Fighting/Racing</td></tr>
<tr><td>7</td><td>Sex Work</td></tr><tr><td>8</td><td>Scams</td></tr>
<tr><td>9</td><td>Smuggling</td></tr><tr><td>10</td><td>Scavenging</td></tr>
</tbody></table>
<h3>Where is the gang's main hangout?</h3>
<table><thead><tr><th>1d6</th><th>Hangout</th></tr></thead><tbody>
<tr><td>1</td><td>Nightclub or Bar</td></tr><tr><td>2</td><td>Abandoned Factory</td></tr>
<tr><td>3</td><td>Thematic to the gang type</td></tr><tr><td>4</td><td>Secret hideout</td></tr>
<tr><td>5</td><td>Behind a legitimate business</td></tr><tr><td>6</td><td>Privately owned homestead</td></tr>
</tbody></table>
<h3>The gang's current boss is...</h3>
<table><thead><tr><th>1d10</th><th>Boss</th></tr></thead><tbody>
<tr><td>1</td><td>Violent and ruthless, but fair.</td></tr><tr><td>2</td><td>Leaves almost everything to underlings.</td></tr>
<tr><td>3</td><td>Self-indulgent but fun.</td></tr><tr><td>4</td><td>Paranoid and scheming but effective.</td></tr>
<tr><td>5</td><td>Prone to nepotism but caring and friendly.</td></tr>
<tr><td>6</td><td>Just one in a long line of bosses who never survive long.</td></tr>
<tr><td>7</td><td>A former Edgerunner until they took a bullet to the knee.</td></tr>
<tr><td>8</td><td>In the pocket of a megacorp but pulls in eddies.</td></tr>
<tr><td>9</td><td>A complete creep, but keeps other nasties at bay.</td></tr>
<tr><td>10</td><td>Unclear — the boss got killed and there is a power vacuum.</td></tr>
</tbody></table>`,
  lifepathQuestions: `<ul>
<li><em>What trouble with my gang did I get you out of?</em></li>
<li><em>Who did I attack for you?</em></li>
<li><em>Why would you trust my gang over others?</em></li>
</ul>`,
  abilityOverview: `<p>Add your Bandit rank to facedowns within your gang, and half (rounded down) with members of other gangs.</p>
<p><strong>Tough</strong> is a limited-use active ability (once + once per 3 full ranks). When activated: ignore wound-state penalties for 1 minute, heal 1 HP, take 2 less damage from Critical Injuries, and take 2 instead of 5 from Foreign Object.</p>`,
  abilitySections: [
    { id: id('bandit-1'), name: 'Initiate', unlockRank: 1, content: '<p><strong>Tough</strong> — Activate to ignore wound penalties for 1 minute, heal 1 HP, and reduce Critical Injury damage by 2 (Foreign Object: 2 instead of 5). Uses: 1 + 1 per 3 full ranks; refresh on natural healing rest.</p><p><strong>Initiate</strong> — You have not proven yourself enough to boss others around, but attempting it is good practice.</p>' },
    { id: id('bandit-3'), name: 'Thug', unlockRank: 3, content: '<p><strong>Thug</strong> — After a successful facedown, fresh recruits follow your orders as long as they think you can check up on them. They still will not risk their lives or the lives of loved ones.</p>' },
    { id: id('bandit-5'), name: 'Ganger', unlockRank: 5, content: '<p><strong>Ganger</strong> — Low-level thugs follow your orders if they have no reason not to, but will not risk their lives without a successful facedown.</p>' },
    { id: id('bandit-7'), name: 'Lieutenant', unlockRank: 7, content: '<p><strong>Lieutenant</strong> — Newer members follow your orders unquestioningly. After a successful facedown, seasoned thugs or a specialist will do a job for you.</p>' },
    { id: id('bandit-9'), name: 'The Boss', unlockRank: 9, content: '<p><strong>The Boss</strong> — You are part of the leadership or the top honcho. Only those in positions of power would question your orders. This power requires maintaining the gang — neglect it at your peril.</p>' },
  ],
  notes: '<p><strong>Starting Gear:</strong> Assault Rifle or Shotgun; Heavy Pistol; Heavy Melee Weapon (€$100); Basic Assault Rifle Ammo ×100 or Basic Shotgun Shell Ammo ×100; Basic Heavy Pistol Ammo ×30; Light Armorjack.<br><strong>Outfit:</strong> Airhypo, Disposable Phone, Duct Tape, Glow Paint, Glow Stick ×2, Black Lace ×2 or Blue Glass ×5 or Synthcoke ×5.<br><strong>Cyberware:</strong> Neuroport, Standard Cyberarm, Wolvers, Hidden Holster.</p>',
});

// ── Corpo ─────────────────────────────────────────────────────────────────────

export const CORPO = role({
  name: 'Corpo',
  category: 'leader',
  img: 'systems/cyberpunk-blue/assets/Roles/corpo.png',
  description: `<p>The corporations rule the world. As a Corpo, you work within that system and turn it to your advantage. Your life has many layers of manipulation and intrigue; anyone could stab you in the back at any time.</p>
<p>Your key ability is <em>Teamwork</em> — leading subordinates who are more loyal to you than to the corporation itself. Treat them right and they will be. Mistreat them and they might rat you out or worse.</p>
<blockquote><em>We can provide great opportunities for those willing to do whatever it takes to get to the top!</em><br>∆ Alicia Jones, Recruiter for Zetatech</blockquote>`,
  lifepathLinks: `<h3>What kind of Corp do you work for?</h3>
<table><thead><tr><th>1d10</th><th>Type</th></tr></thead><tbody>
<tr><td>1</td><td>Financial (e.g. Asukaga &amp; Finch)</td></tr>
<tr><td>2</td><td>Media and Communications (e.g. Network 54)</td></tr>
<tr><td>3</td><td>Cybertech and Medical Technologies (e.g. Kiroshi Opticals)</td></tr>
<tr><td>4</td><td>Pharmaceuticals and Biotech (e.g. Biotechnica)</td></tr>
<tr><td>5</td><td>Food, Clothing or General Consumables (e.g. Continental Brands)</td></tr>
<tr><td>6</td><td>Energy Production (e.g. Petrochem)</td></tr>
<tr><td>7</td><td>Personal Electronics and Robotics (e.g. Zetatech)</td></tr>
<tr><td>8</td><td>Corporate Services (e.g. Arasaka)</td></tr>
<tr><td>9</td><td>Consumer Services (e.g. Danger Girl)</td></tr>
<tr><td>10</td><td>Real Estate and Construction (e.g. NightCorp)</td></tr>
</tbody></table>
<h3>What division do you work in?</h3>
<table><thead><tr><th>1d6</th><th>Division</th></tr></thead><tbody>
<tr><td>1</td><td>Procurement</td></tr><tr><td>2</td><td>Manufacturing</td></tr>
<tr><td>3</td><td>Research and Development</td></tr><tr><td>4</td><td>Human Resources</td></tr>
<tr><td>5</td><td>Public Affairs / Publicity / Advertising</td></tr>
<tr><td>6</td><td>Mergers and Acquisitions</td></tr>
</tbody></table>
<h3>How ethical is your corp?</h3>
<table><thead><tr><th>1d6</th><th>Ethics</th></tr></thead><tbody>
<tr><td>1</td><td>Working for good, supporting ethical practices</td></tr>
<tr><td>2</td><td>Operates as a fair and honest business</td></tr>
<tr><td>3</td><td>Occasionally, but rarely, unethical</td></tr>
<tr><td>4</td><td>Willing to bend the rules to get what it needs</td></tr>
<tr><td>5</td><td>Ruthless and profit-centered</td></tr>
<tr><td>6</td><td>Always involved in illegal and unethical business</td></tr>
</tbody></table>
<h3>How widespread is your corp?</h3>
<table><thead><tr><th>1d6</th><th>Location</th></tr></thead><tbody>
<tr><td>1</td><td>One city</td></tr><tr><td>2</td><td>Several cities</td></tr>
<tr><td>3</td><td>Statewide</td></tr><tr><td>4</td><td>National</td></tr>
<tr><td>5</td><td>International, offices in several major cities</td></tr>
<tr><td>6</td><td>International, offices everywhere</td></tr>
</tbody></table>
<h3>Who is your boss like?</h3>
<table><thead><tr><th>1d6</th><th>Boss</th></tr></thead><tbody>
<tr><td>1</td><td>Mentors you, but watch out for their enemies</td></tr>
<tr><td>2</td><td>Gives you free reins and does not want to know what you are up to</td></tr>
<tr><td>3</td><td>A micro-manager trying to meddle in your work</td></tr>
<tr><td>4</td><td>Unpredictable outbursts offset by quiet paranoia</td></tr>
<tr><td>5</td><td>Cool and has your back against rivals</td></tr>
<tr><td>6</td><td>Feels threatened and is planning to zero you</td></tr>
</tbody></table>`,
  lifepathQuestions: `<ul>
<li><em>What job did I first hire you for?</em></li>
<li><em>What did I get my corporation to cover up for you?</em></li>
<li><em>Why did I bribe you?</em></li>
</ul>`,
  abilityOverview: `<p>Your ability relies on <strong>teamwork</strong> with subordinates. Loyalty (tracked by the GM) determines how willingly they follow orders. Loyalty changes based on your treatment of them.</p>
<table><thead><tr><th>Action</th><th>Loyalty</th></tr></thead><tbody>
<tr><td>Compliment their work (until overused)</td><td>+1</td></tr>
<tr><td>Give a bonus or perk worth ≥€$200</td><td>+4</td></tr>
<tr><td>Support them against Management</td><td>+4</td></tr>
<tr><td>Give them 20% of your earnings from a job</td><td>+6</td></tr>
<tr><td>Give paid time off (an entire job)</td><td>+6</td></tr>
<tr><td>Risk physical harm for them</td><td>+8</td></tr>
<tr><td>Gain no Loyalty with them for an entire session</td><td>−1</td></tr>
<tr><td>Berate or chew them out for their work</td><td>−2</td></tr>
<tr><td>Ignore their contribution to a job</td><td>−4</td></tr>
<tr><td>Forget their birthday</td><td>−4</td></tr>
<tr><td>Not following through on a bonus or perk</td><td>−6</td></tr>
<tr><td>Throw them under the bus to Management</td><td>−6</td></tr>
<tr><td>Abandon them when they are under fire</td><td>−8</td></tr>
</tbody></table>
<p>Replacing a lost team member (killed, disloyal, or dismissed) costs €$200.</p>`,
  abilitySections: [
    { id: id('corpo-1'), name: 'Signing Benefits', unlockRank: 1, content: '<p><strong>Signing Benefits</strong> — You are granted business-wear jacket, top, bottom, and footwear to signify your position.</p>' },
    { id: id('corpo-2'), name: 'Housing Benefits', unlockRank: 2, content: '<p><strong>Housing Benefits</strong> — You are given rent-free housing in a corporate conapt.</p>' },
    { id: id('corpo-3'), name: 'Teamwork', unlockRank: 3, content: '<p><strong>Teamwork</strong> — You are granted a subordinate as a team member. Choose from the NPC Actors attached to this Leader Role. A copy is given to you with Owner permission.</p>' },
    { id: id('corpo-5'), name: 'Human Resources', unlockRank: 5, content: '<p><strong>Human Resources</strong> — Your team is expanded with an additional subordinate of your choice.</p>' },
    { id: id('corpo-6'), name: 'Corporate Health Insurance', unlockRank: 6, content: '<p><strong>Corporate Health Insurance</strong> — Your corporation pays for a Gold subscription to Trauma Team. You may pay the difference for Platinum.</p>' },
    { id: id('corpo-7'), name: 'Better Housing', unlockRank: 7, content: '<p><strong>Better Housing</strong> — Your provided housing is now a Beaverville style house.</p>' },
    { id: id('corpo-8'), name: 'Better Health Insurance', unlockRank: 8, content: '<p><strong>Better Health Insurance</strong> — Your company\'s coverage is increased to Trauma Team Platinum.</p>' },
    { id: id('corpo-9'), name: 'Leadership', unlockRank: 9, content: '<p><strong>Leadership</strong> — You gain a third subordinate at your disposal as part of your team.</p>' },
    { id: id('corpo-10'), name: 'Executive Accommodations', unlockRank: 10, content: '<p><strong>Executive Accommodations</strong> — You are provided a mansion-style villa or luxury penthouse.</p>' },
  ],
  leaderFeatures: [
    {
      id: id('corpo-feat-teamwork'),
      unlockRank: 3,
      name: 'Teamwork',
      description: 'Choose one subordinate NPC from the options below to join your team. They start with Loyalty 4.',
      selectionCount: 1,
      permission: 'owner',
      options: [],
      selectedUuids: [],
    },
    {
      id: id('corpo-feat-hr'),
      unlockRank: 5,
      name: 'Human Resources',
      description: 'Choose a second subordinate NPC to join your team. They start with Loyalty 4.',
      selectionCount: 1,
      permission: 'owner',
      options: [],
      selectedUuids: [],
    },
    {
      id: id('corpo-feat-leadership'),
      unlockRank: 9,
      name: 'Leadership',
      description: 'Choose a third subordinate NPC to join your team. They start with Loyalty 4.',
      selectionCount: 1,
      permission: 'owner',
      options: [],
      selectedUuids: [],
    },
  ],
  notes: '<p><strong>Starting Gear:</strong> Tsunami Arms Nue; Basic Very Heavy Pistol Ammo ×50; Light Armorjack; Radio Communicator ×4; Scrambler/De-scrambler; Chipware: Olfactory Boost or Language; Subdermal Display.<br><strong>Cyberware:</strong> Neuroport, Tech Hair or Light Tattoo, Toxin Binders or Nasal Filters.<br><strong>Bonus:</strong> €$1,000 on top of usual starting credit.</p>',
});

// ── Fixer ─────────────────────────────────────────────────────────────────────

export const FIXER = role({
  name: 'Fixer',
  category: 'networker',
  img: 'systems/cyberpunk-blue/assets/Roles/fixer.png',
  description: `<p>You realized fast that you were never going to get a Corporate job or be tough enough to be a Solo. But you always knew you had a knack for figuring out what other people wanted and how to get it for them. For a price, of course.</p>
<p>One part Robin Hood, two parts Al Capone. In the past they would have called you a crime lord. In this fragmented, nasty, and deadly time, they call you a Fixer.</p>
<blockquote><em>I don't need to know what they'll do with them. I'm just the middleman.</em><br>∆ Grease, Fixer</blockquote>`,
  lifepathLinks: `<h3>What kind of Fixer are you?</h3>
<table><thead><tr><th>1d10</th><th>Type</th></tr></thead><tbody>
<tr><td>1</td><td>Broker deals between rival gangs</td></tr>
<tr><td>2</td><td>Procures atypical resources for an exclusive clientele</td></tr>
<tr><td>3</td><td>Brokers Solo or Tech services as their agent</td></tr>
<tr><td>4</td><td>Supplies a regular resource like food or medicine</td></tr>
<tr><td>5</td><td>Procures illegal resources like street drugs or milspec weapons</td></tr>
<tr><td>6</td><td>Supplies resources for Techs and Medtechs</td></tr>
<tr><td>7</td><td>Operates several successful Night Markets</td></tr>
<tr><td>8</td><td>Brokers use of heavy machinery or vehicles</td></tr>
<tr><td>9</td><td>Deals in scavenged parts from abandoned areas</td></tr>
<tr><td>10</td><td>An exclusive agent for a Media, Rocker, or Nomad pack</td></tr>
</tbody></table>
<h3>Got a business partner? If so, who?</h3>
<table><thead><tr><th>1d6</th><th>Partner</th></tr></thead><tbody>
<tr><td>1</td><td>Family Member</td></tr><tr><td>2</td><td>Old Friend</td></tr>
<tr><td>3</td><td>Possible Romantic Partner</td></tr><tr><td>4</td><td>Mentor</td></tr>
<tr><td>5</td><td>Secret with gang connections</td></tr>
<tr><td>6</td><td>Secret with corpo connections</td></tr>
</tbody></table>`,
  lifepathQuestions: `<ul>
<li><em>What deal did I broker that saved the life of you or someone you love?</em></li>
<li><em>What problem of yours did I find a way to get rid of?</em></li>
<li><em>What do you hope I will eventually find for you?</em></li>
</ul>`,
  abilityOverview: `<p>Four components define a Fixer's street operation:</p>
<ul>
<li><strong>Contacts:</strong> The kinds of people you can easily get in touch with.</li>
<li><strong>Reach:</strong> You can source items in this price category or lower with little effort.</li>
<li><strong>Haggle:</strong> Add your Role rank to Trading checks to negotiate price. Use COOL instead of INT if preferred. Only one Fixer per side.</li>
<li><strong>Grease:</strong> Increasing understanding of the cultures around you. Gain Language ability ranks.</li>
</ul>`,
  abilitySections: [
    { id: id('fixer-1'), name: 'First Contact', unlockRank: 1, content: '<p><strong>First Contact</strong> — <em>Contacts:</em> Local honcho, gang lord, neighborhood leadership. <em>Reach:</em> Cheap (€$10) and Everyday (€$20), even if normally unavailable. <em>Haggle:</em> On success, push price up to 10% from market value. <em>Grease:</em> You know the ins-and-outs of your immediate neighborhood, including all local gangs.</p>' },
    { id: id('fixer-3'), name: 'Well Connected', unlockRank: 3, content: '<p><strong>Well Connected</strong> — <em>Contacts:</em> City gang honcho, minor politician, or someone well-known in the neighborhood. <em>Reach:</em> Expensive (€$50). <em>Haggle:</em> When you buy 5+ items, get one additional for free. <em>Grease:</em> Insights into a specific local culture. Gain one rank in a Language ability.</p>' },
    { id: id('fixer-5'), name: 'District Fixer', unlockRank: 5, content: '<p><strong>District Fixer</strong> — <em>Contacts:</em> Major City Player, city politico, neighborhood celebrity. <em>Reach:</em> Once per month help set up a Night Market; can source up to Super Luxury (€$10,000) items. <em>Haggle:</em> On success, negotiate job pay up to 20% per person. <em>Grease:</em> Well versed in 3 cultures total. Gain another Language rank.</p>' },
    { id: id('fixer-7'), name: 'Center of the Web', unlockRank: 7, content: '<p><strong>Center of the Web</strong> — <em>Contacts:</em> Local corp president, mayor, local celebrity. <em>Reach:</em> Expensive (€$500). <em>Haggle:</em> On success, when buying Luxury (€$5,000) or Super Luxury (€$10,000), pay half now and the rest after a month. <em>Grease:</em> Blend in perfectly in 6+ cultures. Gain another Language rank.</p>' },
    { id: id('fixer-9'), name: 'Monarch of the Fixers', unlockRank: 9, content: '<p><strong>Monarch of the Fixers</strong> — <em>Contacts:</em> Divisional corp head, state politico, well-known celebrity. <em>Reach:</em> Luxury (€$5,000). Night Markets can include a Midnight Market. <em>Haggle:</em> Adjust any item price by up to 20%. Gain another Language rank.</p>' },
    { id: id('fixer-10'), name: 'World Broker', unlockRank: 10, content: '<p><strong>World Broker</strong> — <em>Contacts:</em> Major world leaders, major corporation heads, world celebrities. <em>Reach:</em> Almost any item. <em>Haggle:</em> Negotiate up to double pay per person for dangerous jobs. Repeat Language rank selection twice.</p>' },
  ],
  notes: '<p><strong>Starting Gear:</strong> Constitutional Arms Unity or Liberty; Tsunami Arms Kappa or Militech Ticon; Baseball Bat; Basic Heavy Pistol Ammo ×50 ×2 (or VHP); Light Armorjack; Bug Detector, Disposable Phone ×2, Duct Tape, Advanced Laptop.<br><strong>Cyberware:</strong> Neuroport, Standard Cyberaudio Suite, Voice Stress Analyzer or Amplified Hearing, Sub-Dermal Pocket.</p>',
});

// ── Guide ─────────────────────────────────────────────────────────────────────

export const GUIDE = role({
  name: 'Guide',
  category: 'sundry',
  img: 'systems/cyberpunk-blue/assets/Roles/guide.png',
  description: `<p>In a world completely ruled by the material, you are the voice of the soul. Your predictions are hazy at best, but they might provide a much needed edge when it really matters.</p>
<p><em>Note: Not all games are suitable for a Guide. They risk removing some of the dystopia that is Cyberpunk. If this Role is present, it should either show how spirituality is just another commodity, or provide contrast against sufficient darkness.</em></p>
<blockquote><em>We should not fear change itself, but only who we might change into. Knowing one's path is most important.</em><br>∆ Misty Olszewski, Misty's Esoterica</blockquote>`,
  lifepathLinks: `<h3>What kind of Guide are you?</h3>
<table><thead><tr><th>1d10</th><th>Type</th></tr></thead><tbody>
<tr><td>1</td><td>Self-Help Guru</td></tr><tr><td>2</td><td>Cult Leader</td></tr>
<tr><td>3</td><td>Priest</td></tr><tr><td>4</td><td>Neo-Witch</td></tr>
<tr><td>5</td><td>Spirit Medium</td></tr><tr><td>6</td><td>Street Prophet</td></tr>
<tr><td>7</td><td>Life Coach</td></tr><tr><td>8</td><td>Monk</td></tr>
<tr><td>9</td><td>Card-Reader</td></tr><tr><td>10</td><td>Psychic</td></tr>
</tbody></table>`,
  lifepathQuestions: `<ul>
<li><em>What path or omen have I warned you about?</em></li>
<li><em>What prediction for you came true?</em></li>
<li><em>Why did you seek my spiritual guidance?</em></li>
</ul>`,
  abilityOverview: `<p>The Guide uses a Tarot deck (major arcana) as their primary ability. At the start of each session, draw cards equal to your Guide rank into your <strong>Reading</strong> (hand). These are your available cards. Once per session you may spend 1 in-game hour to Meditate — reshuffle all and deal a new Reading. Gain additional meditations at rank 5 (total 2) and rank 10 (total 3).</p>
<p>Each card has a <strong>Trigger</strong> and an <strong>Effect</strong>. When a trigger occurs and the card is in your Reading, you may play it. After playing, draw a new card to your Reading; the played card is shuffled back into the deck.</p>
<p>Cyberware interferes with your ability. When dealing a new Reading, first remove one card from the deck for each full 10 your max PSYCHE is below 60. These cards are locked until PSYCHE recovers.</p>`,
  abilitySections: [
    { id: id('guide-tarot'), name: 'Tarot Cards', unlockRank: 1, content: `<table><thead><tr><th>Card</th><th>Name</th><th>Meaning</th><th>Trigger</th><th>Effect</th></tr></thead><tbody>
<tr><td>0</td><td>The Fool</td><td><em>Beginning a journey; uncertain outcomes.</em></td><td>A team member failed a check adding less than 8 to their 1d10.</td><td>They may re-roll but must use the new result.</td></tr>
<tr><td>1</td><td>The Magician</td><td><em>Wisdom and willpower connecting spiritual and profane.</em></td><td>A team member succeeded on an INT + Human Perception check.</td><td>Add +3 to the first check that benefits from the insights.</td></tr>
<tr><td>2</td><td>The High Priestess</td><td><em>Intuition guiding hidden knowledge.</em></td><td>A team member makes a check to uncover something hidden.</td><td>Add +2 to the result.</td></tr>
<tr><td>3</td><td>The Empress</td><td><em>Nurturing and creativity.</em></td><td>You make a check aimed at making someone else look cool.</td><td>Add +2 to the result.</td></tr>
<tr><td>4</td><td>The Emperor</td><td><em>Stability, structure, and authority.</em></td><td>A team member loses a Facedown or fails a COOL + Endurance check.</td><td>They may re-roll but must use the new result.</td></tr>
<tr><td>5</td><td>The Hierophant</td><td><em>Dogma, tradition, and a teacher's guidance.</em></td><td>A team member makes a check with help from instructions or a mentor.</td><td>Add +1 to the roll.</td></tr>
<tr><td>6</td><td>The Lovers</td><td><em>Kinship, bonding, and the duality of choices.</em></td><td>You face two mutually exclusive choices.</td><td>The GM tells you which choice is likely better from a perspective you specify.</td></tr>
<tr><td>7</td><td>The Chariot</td><td><em>Triumph through ambition.</em></td><td>Someone in your team failed an Endurance or Drive check.</td><td>They may re-roll but must use the new result.</td></tr>
<tr><td>8</td><td>Strength</td><td><em>Bravery and inner strength conquers fear.</em></td><td>Something is frightening a team member.</td><td>For the next hour, they may ignore their fears.</td></tr>
<tr><td>9</td><td>The Hermit</td><td><em>Wisdom through contemplation in isolation.</em></td><td>A team member makes an INT check while alone.</td><td>They roll the 1d10 twice and use the higher result.</td></tr>
<tr><td>10</td><td>Wheel of Fortune</td><td><em>Luck comes and goes; the only constant is change.</em></td><td>A team member caused problems by failing a check.</td><td>Do not roll the 1d10 for their next check — assume it is 8.</td></tr>
<tr><td>11</td><td>Justice</td><td><em>The law must see different sides.</em></td><td>Someone in your vicinity performs an obviously illegal action.</td><td>The next check by the one who broke the law has a −5 penalty.</td></tr>
<tr><td>12</td><td>The Hanged Man</td><td><em>Surrender and sacrifice is the path forward.</em></td><td>A team member is injured and/or Fatigued.</td><td>They heal 5 HP and lose Fatigued if present. The Guide becomes Fatigued.</td></tr>
<tr><td>13</td><td>Death</td><td><em>The end of one thing is the beginning of another.</em></td><td>A team member becomes Mortally Wounded or suffers a Critical Injury.</td><td>They may take an immediate action, even outside their turn (including to stabilize).</td></tr>
<tr><td>14</td><td>Temperance</td><td><em>A balanced middle-ground and tranquil perspectives.</em></td><td>A team member is about to make a check.</td><td>Do not roll the 1d10 — assume the result is 6.</td></tr>
<tr><td>15</td><td>The Devil</td><td><em>Addiction to the material at the cost of a soul.</em></td><td>A team member indulges in sex, drugs, or another materialistic vice.</td><td>Any check they make within the next hour gains a +1 bonus.</td></tr>
<tr><td>16</td><td>The Tower</td><td><em>Chaos and destruction.</em></td><td>A team member deals damage.</td><td>The damage is increased by 1d6 (does not contribute to Critical threshold).</td></tr>
<tr><td>17</td><td>The Star</td><td><em>Hope, creativity, and motivation.</em></td><td>A team member makes a Composition or Performance check.</td><td>Add +3 to the result.</td></tr>
<tr><td>18</td><td>The Moon</td><td><em>Illusions, deception, and surface appearance.</em></td><td>A team member makes a check to conceal a different action.</td><td>Add +2 to the result.</td></tr>
<tr><td>19</td><td>The Sun</td><td><em>Success and joy; optimism and vitality.</em></td><td>A team member is about to make a check.</td><td>They use COOL as their Primary STAT instead of what was called for.</td></tr>
<tr><td>20</td><td>Judgement</td><td><em>Resurrection and liberation; healing and renewal.</em></td><td>A team member has made a check but not yet found out if they succeeded.</td><td>They may re-roll the 1d10 but must use the new result.</td></tr>
<tr><td>21</td><td>The World</td><td><em>Achievement and completion; togetherness with the whole.</em></td><td>Everyone in your team is gathered to plan ahead.</td><td>Define a specific expected check. You gain +3 to that one check if/when it happens.</td></tr>
</tbody></table>` },
  ],
  notes: '<p><strong>Starting Gear:</strong> Constitutional Arms Unity; Stun Baton or Knife or Bow; Baseball Bat or Axe or Combat Knife; Smoke Grenade; Basic Heavy Pistol Ammo ×50; Light Armorjack.<br><strong>Outfit:</strong> Duct Tape, Flashlight, Glowstick, Radio Scanner/Music Player, Video Camera, Chipware: Language or Skill Chip, Chipware: Olfactory Boost or Tactile Boost.<br><strong>Cyberware:</strong> Neuroport, Light Tattoo, Shift Tacts or Tech Hair, Skin-Weave, Subdermal Pocket.</p>',
});

// ── Law ───────────────────────────────────────────────────────────────────────

export const LAW = role({
  name: 'Law',
  category: 'leader',
  img: 'systems/cyberpunk-blue/assets/Roles/law.png',
  description: `<p>There used to be a big City Force, but most of the Old Guard in NCPD have been thrown out on their own to keep what peace they can. Even if you would rather just walk a beat, if you are a professional Law of any stripe, you are stuck carrying at least four high-caliber weapons, mostly full-auto, and wearing a Kevlar® vest.</p>
<p>Your key ability is calling for <strong>Backup</strong>. Abuse it at your own peril — your boss will not be pleased.</p>
<blockquote><em>Someone has to prevent civilians from taking a bullet in the latest gang war.</em><br>∆ Officer Suri "Cavalry" Navarro, NCPD</blockquote>`,
  lifepathLinks: `<h3>What is your position in the force?</h3>
<table><thead><tr><th>1d6</th><th>Position</th></tr></thead><tbody>
<tr><td>1</td><td>Guard</td></tr><tr><td>2</td><td>Standard beat or patrol</td></tr>
<tr><td>3</td><td>Criminal Investigation</td></tr><tr><td>4</td><td>Special Weapons and Tactics</td></tr>
<tr><td>5</td><td>Motor Patrol</td></tr><tr><td>6</td><td>Internal Affairs</td></tr>
</tbody></table>
<h3>Where is your jurisdiction?</h3>
<table><thead><tr><th>3d6</th><th>Jurisdiction</th></tr></thead><tbody>
<tr><td>3</td><td>Pacifica</td></tr><tr><td>4</td><td>Open Highways and the Badlands</td></tr>
<tr><td>5</td><td>Corporate Plaza</td></tr><tr><td>6</td><td>Charter Hill</td></tr>
<tr><td>7</td><td>Rancho Coronado</td></tr><tr><td>8</td><td>Arroyo</td></tr>
<tr><td>9</td><td>Little China</td></tr><tr><td>10</td><td>Kabuki</td></tr>
<tr><td>11</td><td>Northside Industrial District</td></tr><tr><td>12</td><td>Vista del Rey</td></tr>
<tr><td>13</td><td>The Glen</td></tr><tr><td>14</td><td>Japantown</td></tr>
<tr><td>15</td><td>Wellsprings</td></tr><tr><td>16</td><td>Downtown</td></tr>
<tr><td>17</td><td>North Oak</td></tr><tr><td>18</td><td>Netwatch Liaison</td></tr>
</tbody></table>`,
  lifepathQuestions: `<ul>
<li><em>What crime did I let you get away with and why?</em></li>
<li><em>What enemy of yours did I take out?</em></li>
<li><em>What crime did we fail to solve together?</em></li>
</ul>`,
  abilityOverview: `<p>Being part of the Law means you can call for backup. Use your action to roll 1d10 + Role rank against the backup's DV. On a success, backup arrives in 1d6 rounds. On a roll of 6 on the d6, backup might take longer but is the next tier type. At rank 10, two units respond instead of one.</p>`,
  abilitySections: [
    { id: id('law-1'), name: 'Corporate Security', unlockRank: 1, content: '<p><strong>Corporate Security</strong> — DV 7. Four rent-a-cops arriving on foot. CombatN 8, SP 7, MOVE 5. Gear: Militech M-10AF Lexington, Flashlight, Radio. Cyberware: Neuroport.</p>' },
    { id: id('law-3'), name: 'Beat Cops', unlockRank: 3, content: '<p><strong>Beat Cops</strong> — DV 9. Four local cops in two compact cars. CombatN 10, SP 7, MOVE 5. Gear: Militech M-10AF Lexington, Flashlight, Handcuffs, Radio, Road Flare. Cyberware: Neuroport.</p>' },
    { id: id('law-5'), name: 'Precinct Officers', unlockRank: 5, content: '<p><strong>Precinct Officers</strong> — DV 11. Two officers in a high-performance car. CombatN 12, SP 13. Gear: Militech M-76E Omaha, Arasaka Nowaki, Flashlight, Handcuffs ×2, Radio, Road Flare ×2. Cyberware: Neuroport.</p>' },
    { id: id('law-8'), name: 'SWAT', unlockRank: 8, content: '<p><strong>SWAT</strong> — DV 14. One expert officer on a motorcycle. CombatN 14, SP 15, MOVE 5, BODY 7. Gear: Arasaka JKE-X2 Kenshin, Militech M362s Ajax (with mods), Stun Baton, Anti-Smog Mask, Handcuffs ×2, Radio, Road Flare ×2, Rope, Chipware: Pain Editor. Cyberware: Neuroport, Self-ICE, Kerenzikov, Cybereyes ×2 Wide-Spectrum, Cyberarm, Subdermal Grip.</p>' },
    { id: id('law-9'), name: 'MaxTac', unlockRank: 9, content: '<p><strong>MaxTac</strong> — DV 16. Two heavy-hitters from the cyberpsycho squad in an AV-4. CombatN 15, SP 18, MOVE 4, BODY 8. Gear: Techtronica RT-46 Burya, Arasaka HJSH-18 Masamune, Arasaka Dojigiri Yatsuna, Pain Editor. Cyberware: Neuroport, Self-ICE, Sandevistan, MultiOptic Mount, Cybereyes ×4 (full), Cyberarms ×2, Mantis Blades ×2, Subdermal Grip, Nasal Filters.</p>' },
    { id: id('law-10'), name: 'International Special Agents', unlockRank: 10, content: '<p><strong>International Special Agents</strong> — DV 18. National law enforcement / Interpol / Netwatch pairs in an AV-4. They stay after the fact and aid in the investigation. Handled entirely by the GM.</p>' },
  ],
  leaderFeatures: [
    { id: id('law-feat-corpsec'), unlockRank: 1, name: 'Corporate Security', description: 'Roll 1d10 + Role rank vs DV 7 to call in four Corporate Security officers on foot.', selectionCount: 1, permission: 'observer', options: [], selectedUuids: [] },
    { id: id('law-feat-beatcops'), unlockRank: 3, name: 'Beat Cops', description: 'Roll 1d10 + Role rank vs DV 9 to call in four beat cops in two compact cars.', selectionCount: 1, permission: 'observer', options: [], selectedUuids: [] },
    { id: id('law-feat-precinct'), unlockRank: 5, name: 'Precinct Officers', description: 'Roll 1d10 + Role rank vs DV 11 to call in two precinct officers in a high-performance car.', selectionCount: 1, permission: 'observer', options: [], selectedUuids: [] },
    { id: id('law-feat-swat'), unlockRank: 8, name: 'SWAT', description: 'Roll 1d10 + Role rank vs DV 14 to call in one SWAT officer on a motorcycle.', selectionCount: 1, permission: 'observer', options: [], selectedUuids: [] },
    { id: id('law-feat-maxtac'), unlockRank: 9, name: 'MaxTac', description: 'Roll 1d10 + Role rank vs DV 16 to call in two MaxTac operators in an AV-4.', selectionCount: 1, permission: 'observer', options: [], selectedUuids: [] },
  ],
  notes: '<p><strong>Starting Gear:</strong> Arasaka Nowaki or Constitutional Arms M2038 Tactician; Militech M-10AF Lexington; Basic Rifle/Shotgun/Slug Ammo ×50; Basic Heavy Pistol Ammo ×50; Bulletproof Shield or Smoke Grenade ×2; Light Armorjack; Flashlight, Handcuffs ×2, Radio Communicator, Road Flare ×10.<br><strong>Cyberware:</strong> Neuroport, Hidden Holster, Subdermal Pocket.</p>',
});

// ── Media ─────────────────────────────────────────────────────────────────────

export const MEDIA = role({
  name: 'Media',
  category: 'networker',
  img: 'systems/cyberpunk-blue/assets/Roles/media.png',
  description: `<p>They are bending the truth out there, and you are going to stop them. The Corporations rule the world. You have got a vidlink and a press pass, and you are not afraid to use them.</p>
<p>Your credibility allows you to pick up on rumors, talk to informants, and spread your message.</p>
<blockquote><em>I did not become a journalist to smile for the camera with some Corpo on synthcoke — I bring the actual News!</em><br>∆ "24/7", Reporter for Never Blink News</blockquote>`,
  lifepathLinks: `<h3>What kind of Media are you?</h3>
<table><thead><tr><th>1d6</th><th>Type</th></tr></thead><tbody>
<tr><td>1</td><td>Blogger</td></tr><tr><td>2</td><td>Writer (Books)</td></tr>
<tr><td>3</td><td>Videographer</td></tr><tr><td>4</td><td>Documentarian</td></tr>
<tr><td>5</td><td>Investigative Reporter</td></tr><tr><td>6</td><td>Street Scribe</td></tr>
</tbody></table>
<h3>What do you report on?</h3>
<table><thead><tr><th>1d6</th><th>Story</th></tr></thead><tbody>
<tr><td>1</td><td>Political Intrigue</td></tr><tr><td>2</td><td>Ecological Impact</td></tr>
<tr><td>3</td><td>Celebrity News</td></tr><tr><td>4</td><td>Corporate Takedowns</td></tr>
<tr><td>5</td><td>Editorials</td></tr><tr><td>6</td><td>Propaganda</td></tr>
</tbody></table>`,
  lifepathQuestions: `<ul>
<li><em>How did I make you out as the hero of a story?</em></li>
<li><em>What enemy of yours did I expose?</em></li>
<li><em>What dirt about you have I covered up?</em></li>
</ul>`,
  abilityOverview: `<p>Medias rely on their credibility to pick up rumors. The GM makes a daily passive roll using your Business, Government, or Streetwise skill (+ Media rank, INT or COOL for Streetwise). You can also actively search for rumors by choosing a skill and rolling.</p>
<table><thead><tr><th>Description</th><th>Passive DV</th><th>Active DV</th></tr></thead><tbody>
<tr><td><strong>Vague rumor</strong> — bare minimum to go on.</td><td>15</td><td>12</td></tr>
<tr><td><strong>Typical rumor</strong> — enough to know where to go next.</td><td>18</td><td>15</td></tr>
<tr><td><strong>Substantial rumor</strong> — concrete info: names, places, times.</td><td>21</td><td>18</td></tr>
<tr><td><strong>Detailed rumor</strong> — immediately relevant; if verified, ready for publication.</td><td>25</td><td>22</td></tr>
</tbody></table>
<p>When you publish a story, roughly 10% of your audience believes your premise (+5% per rank +5% per verifiable fact, max 20% bonus).</p>`,
  abilitySections: [
    { id: id('media-1'), name: 'Aspiring Reporter', unlockRank: 1, content: '<p><strong>Aspiring Reporter</strong> — <em>Access:</em> Local honcho, gang lord, neighborhood leadership. <em>Audience:</em> Your immediate neighborhood. <em>Impact:</em> Minor actors in the space might shift their ways.</p>' },
    { id: id('media-3'), name: 'Journalist', unlockRank: 3, content: '<p><strong>Journalist</strong> — <em>Access:</em> City gang honcho, minor politician, well-known person in the neighborhood. <em>Audience:</em> Well-known contributor to the local screamsheet or Data Pool. <em>Impact:</em> Small-timers get arrested or thrown out of power.</p>' },
    { id: id('media-5'), name: 'Intrepid Investigator', unlockRank: 5, content: '<p><strong>Intrepid Investigator</strong> — <em>Access:</em> Major city player, city politico, local celebrity. <em>Audience:</em> City-wide; regular columnist or contributor. <em>Impact:</em> Changes things across the city; higher-level targets may be jailed.</p>' },
    { id: id('media-7'), name: 'Seasoned Journalist', unlockRank: 7, content: '<p><strong>Seasoned Journalist</strong> — <em>Access:</em> Local corp president, mayor, city celebrity. <em>Audience:</em> State-wide; you are a minor celebrity. <em>Impact:</em> Change spreads across multiple cities; mid-level corps or governments may fall.</p>' },
    { id: id('media-9'), name: 'Senior Correspondent', unlockRank: 9, content: '<p><strong>Senior Correspondent</strong> — <em>Access:</em> Divisional corp head, state politico, well-known celebrity. <em>Audience:</em> Continent-wide within your area of expertise. <em>Impact:</em> Can topple large corporations or local governments.</p>' },
    { id: id('media-10'), name: 'World Journalist', unlockRank: 10, content: '<p><strong>World Journalist</strong> — <em>Access:</em> Major world leaders, corporation heads, world celebrities. <em>Audience:</em> World-wide; both celebrity and go-to leak recipient. <em>Impact:</em> Large-scale changes affecting millions.</p>' },
  ],
  notes: '<p><strong>Starting Gear:</strong> Constitutional Arms Unity; Basic Heavy Pistol Ammo ×50; Light Armorjack; Audio Recorder, Binoculars, Disposable Cell Phone ×2 or Grapple Gun, Flashlight, Laptop, Radio Scanner/Music Player, Scrambler/Descrambler, Video Camera.<br><strong>Cyberware:</strong> Neuroport, Standard Cyberaudio Suite, Amplified Hearing or Voice Stress Analyzer, Scrambler/Descrambler or Bug Detector.</p>',
});

// ── Medtech ───────────────────────────────────────────────────────────────────

export const MEDTECH = role({
  name: 'Medtech',
  category: 'specialist',
  img: 'systems/cyberpunk-blue/assets/Roles/medtech.png',
  description: `<p>You are an artist, and the human body is your canvas. Patching up the wounded, mending up the sick, and keeping the locals alive — for love, commitment, or a fat payday.</p>
<blockquote><em>I don't have initials after my name, but I can fix that arm. Or you lose it. Your choice.</em><br>∆ Virgil "Redtail" Martinez</blockquote>`,
  lifepathLinks: `<h3>What kind of Medtech are you?</h3>
<table><thead><tr><th>1d10</th><th>Type</th></tr></thead><tbody>
<tr><td>1</td><td>Surgeon</td></tr><tr><td>2</td><td>General Practitioner</td></tr>
<tr><td>3</td><td>Trauma Medic</td></tr><tr><td>4</td><td>Psychiatrist</td></tr>
<tr><td>5</td><td>Cyberpsycho Therapist</td></tr><tr><td>6</td><td>Ripperdoc</td></tr>
<tr><td>7</td><td>Cryosystems Operator</td></tr><tr><td>8</td><td>Pharmacist</td></tr>
<tr><td>9</td><td>Bodysculptor</td></tr><tr><td>10</td><td>Forensic Pathologist</td></tr>
</tbody></table>`,
  lifepathQuestions: `<ul>
<li><em>When did I save your life?</em></li>
<li><em>Who, close to you, did I fail to save?</em></li>
<li><em>How did your cyberware dramatically malfunction and I had to replace it?</em></li>
</ul>`,
  abilityOverview: `<p>As a Medtech, you gain access to specialties that allow you to perform tasks others cannot. Each time you gain a rank in the Medtech Role ability, you also gain one rank each in two different specialties: Battle Medic, Surgery, Pharmaceuticals, or Cryosystem Operation.</p>`,
  abilitySections: [],
  specialties: [
    {
      id: id('medtech-sp-battle'),
      name: 'Battle Medic',
      description: 'Field medicine under fire.',
      rank: 0,
      unlockSections: [
        { id: id('medtech-sp-battle-1'), name: 'Emergency Treatment', unlockRank: 1, content: '<p><strong>Emergency Treatment</strong> — Add specialty ranks to all non-Role Medicine checks (stabilize, quick-fix critical injuries, etc.).</p><p><strong>Patching Up</strong> — Given 10 minutes, heal someone for up to twice your Battle Medic rank in HP. A person can only benefit once per day (in addition to other healing). Once per natural-healing reset.</p>' },
      ],
      optionGroups: [],
    },
    {
      id: id('medtech-sp-surgery'),
      name: 'Surgery',
      description: 'Invasive procedures and cyberware installation.',
      rank: 0,
      unlockSections: [
        { id: id('medtech-sp-surgery-1'), name: 'Surgeon', unlockRank: 1, content: '<p><strong>Surgeon</strong> — Treatment of serious critical injuries, installation of cyberware, body-sculpting, and other invasive procedures require TECH + Medicine (Surgery) checks. Without a Medtech with this specialty, none of these are possible. Roll: 1d10 + TECH + min(Medicine rank, Surgery rank).</p>' },
      ],
      optionGroups: [],
    },
    {
      id: id('medtech-sp-pharma'),
      name: 'Pharmaceuticals',
      description: 'Drug analysis and synthesis.',
      rank: 0,
      unlockSections: [
        { id: id('medtech-sp-pharma-1'), name: 'Compound Analysis', unlockRank: 1, content: '<p><strong>Compound Analysis</strong> — TECH + Medicine (Pharmaceuticals) to analyze pharmaceutical compounds and drugs.</p><p><strong>Synthesize</strong> — Each rank lets you learn one drug from the list. Materials cost €$100 (Premium) for doses equal to your rank. Preparation takes 1 hour at DV 15 TECH + Medicine (Pharmaceuticals). Applying a dose takes an Action; unwilling targets require a BODY + Melee attack.</p><p><strong>Available drugs:</strong> Antibiotic (+3 HP/day for 7 days), Anti-Psychosis (restore 1d6 PSYCHE), Myelin Strengthener (+1 RFLX for 2d6 hours), Rapidetox (purge all drugs/poisons), Roids (+1 BODY for 2d6 hours), Runnerspeed (+1 NET Action for 1 hour), Speedheal (heal BODY HP), Stim (ignore Seriously Wounded 1 hour), Surge (no sleep needed for 24 hours), Torpor (unconscious for 2d6 hours).</p>' },
      ],
      optionGroups: [
        {
          id: id('medtech-sp-pharma-drugs'),
          unlockRank: 1,
          choices: 10,
          options: [
            { id: id('medtech-drug-antibiotic'), name: 'Antibiotic', description: 'Natural healing gives an extra 3 HP every day for a week. One antibiotic at a time.' },
            { id: id('medtech-drug-antipsychosis'), name: 'Anti-Psychosis', description: 'Restores 1d6 PSYCHE. One dose per week.' },
            { id: id('medtech-drug-myelin'), name: 'Myelin Strengthener', description: '+1 RFLX for 2d6 hours. One dose per day.' },
            { id: id('medtech-drug-rapidetox'), name: 'Rapidetox', description: 'Immediately purges any drug, poison, or intoxicant.' },
            { id: id('medtech-drug-roids'), name: 'Roids', description: '+1 BODY for 2d6 hours. One dose per day.' },
            { id: id('medtech-drug-runnerspeed'), name: 'Runnerspeed', description: '+1 NET Action per round for 1 hour (if the target can perform NET actions).' },
            { id: id('medtech-drug-speedheal'), name: 'Speedheal', description: 'Heal HP equal to BODY (target not Mortally Wounded). One dose per day.' },
            { id: id('medtech-drug-stim'), name: 'Stim', description: 'Ignore Seriously Wounded penalties for 1 hour; reduce critical-consequence damage by up to 1 HP/round. One dose per day.' },
            { id: id('medtech-drug-surge'), name: 'Surge', description: 'No need for sleep for 24 hours. One dose per week.' },
            { id: id('medtech-drug-torpor'), name: 'Torpor', description: 'Fall unconscious for 2d6 hours (DV 15 Medicine to detect vital signs). An antidote is also produced.' },
          ],
          selectedOptionIds: [],
        },
      ],
    },
    {
      id: id('medtech-sp-cryo'),
      name: 'Cryosystem Operation',
      description: 'Operation of cryogenic medical equipment.',
      rank: 0,
      unlockSections: [
        { id: id('medtech-sp-cryo-1'), name: 'Cryosystem Use', unlockRank: 1, content: '<p><strong>Cryosystem Use</strong> — Medicine (Cryosystem Operation) check as an Action to put a body in stasis. DV 13 for a pump, 15 for a tank. Either allows surgery without risk. A pump lasts a week; a tank lasts as long as it has power. A tank also allows complete body modification surgery.</p><p><strong>Crypump</strong> — As a licensed cryotech, you gain access to a cryobag.</p>' },
        { id: id('medtech-sp-cryo-2'), name: 'Cryotank', unlockRank: 2, content: '<p><strong>Cryotank</strong> — Access to a cryotank, owned by government or a corp but available for use. You are responsible for refuelling and any damage.</p>' },
        { id: id('medtech-sp-cryo-3'), name: 'Free Placement', unlockRank: 3, content: '<p><strong>Free Placement</strong> — The cryotank can be placed in a location of your choice.</p>' },
        { id: id('medtech-sp-cryo-4'), name: 'Cryopump Upgrade', unlockRank: 4, content: '<p><strong>Cryopump Upgrade</strong> — Access to a second cryopump and a refill for each.</p>' },
        { id: id('medtech-sp-cryo-5'), name: 'Cryotank Expansion', unlockRank: 5, content: '<p><strong>Cryotank Expansion</strong> — Access to two more cryotanks.</p>' },
        { id: id('medtech-sp-cryo-6'), name: 'Field Cryopump Pack', unlockRank: 6, content: '<p><strong>Field Cryopump Pack</strong> — A third cryopump with a refill for all three.</p>' },
        { id: id('medtech-sp-cryo-7'), name: 'Cryogenic Lab', unlockRank: 7, content: '<p><strong>Cryogenic Lab</strong> — A full 6 cryotanks in your space.</p>' },
        { id: id('medtech-sp-cryo-10'), name: 'Cryotech Expert', unlockRank: 10, content: '<p><strong>Cryotech Expert</strong> — Four cryopumps with refills, and effectively unlimited cryotanks with sponsorship.</p>' },
      ],
      optionGroups: [],
    },
  ],
  notes: '<p><strong>Starting Gear:</strong> Rostovic DB-4 Palica or Militech M251s Ajax; Basic Shotgun Shells ×100 or Basic Rifle Ammo ×100; Incendiary ammo ×10; Smoke Grenade ×2; Light Armorjack; Bulletproof Shield; Airhypo, Handcuffs, Flashlight, Glow Paint, Medtech Bag.<br><strong>Cyberware:</strong> Neuroport, Cybereye, Teleoptics, Microoptics, Nasal Filters or Toxin Binders.</p>',
});

// ── Netrunner ─────────────────────────────────────────────────────────────────

export const NETRUNNER = role({
  name: 'Netrunner',
  category: 'sundry',
  img: 'systems/cyberpunk-blue/assets/Roles/netrunner.png',
  description: `<p>You are a brain-burning computer hacker and master of the Post-NET cyberverse. As an electronic wraith, you slip into mainframes: stealing, trading, and selling their deepest secrets.</p>
<p>Of course, the deadliest parts of cyberspace are still out there in the remnants of the old NET. Others might think it is all safe behind the Blackwall, but you know that it is only a matter of time.</p>
<blockquote><em>Do spiders spin webs? It is time to catch flies.</em><br>∆ Spider Murphy</blockquote>`,
  lifepathLinks: `<h3>What kind of Netrunner are you?</h3>
<table><thead><tr><th>1d6</th><th>Type</th></tr></thead><tbody>
<tr><td>1</td><td>Freelancer who hacks for hire</td></tr>
<tr><td>2</td><td>Corporate runner, hacking for The Man</td></tr>
<tr><td>3</td><td>Hacktivist interested in cracking systems and exposing bad guys</td></tr>
<tr><td>4</td><td>You just like to crack systems for the fun of it</td></tr>
<tr><td>5</td><td>Part of a regular team of freelancers</td></tr>
<tr><td>6</td><td>Hack for a Media, politico, or Lawman who hires you as needed</td></tr>
</tbody></table>`,
  lifepathQuestions: `<ul>
<li><em>Why did I break into a corp subnet for you?</em></li>
<li><em>What is in the file I keep secure for you in my deck?</em></li>
<li><em>What info have you asked me to look for?</em></li>
</ul>`,
  abilityOverview: `<p>A Netrunner uses a cyberdeck to access network architecture directly with their brain. As their regular Action, they can instead perform a number of NET Actions.</p>
<table><thead><tr><th>Role Rank</th><th>1–3</th><th>4–6</th><th>7–9</th><th>10</th></tr></thead>
<tbody><tr><td>NET Actions</td><td>2</td><td>3</td><td>4</td><td>5</td></tr></tbody></table>
<p>Formula: <strong>NET Actions = 1 + ⌈Rank / 3⌉</strong></p>`,
  abilitySections: [],
  notes: '<p><strong>Starting Gear:</strong> Militech Ticon; Basic Heavy Pistol Ammo ×50; Light Bodyweight Suit; Standard Cyberdeck; Glow Paint; Programs: Armor, Sword, See Ya or Eraser, Sword or Vrizzbolt, Sword or Worm.<br><strong>Cyberware:</strong> Neuroport, Cybereyes ×2, Virtuality, Shift Tacts.</p>',
});

// ── Ninja ─────────────────────────────────────────────────────────────────────

export const NINJA = role({
  name: 'Ninja',
  category: 'protean',
  img: 'systems/cyberpunk-blue/assets/Roles/ninja.png',
  description: `<p>Sometimes, an individual needs to be zeroed quietly. You excel at this dirty business — whether through long-range snipers, silent executions with a concealed blade, or methods that can be covered up as accidents.</p>
<p>A good Ninja is highly sought after. A bad one — someone who gets exposed — will find they have no friends anywhere. There is no room for failure when discretion is your main weapon.</p>
<blockquote><em>In a world of neon, holograms and screens, people never seem wary enough of the shadows the lights cast.</em><br>∆ "Rogue Rouge"</blockquote>`,
  lifepathLinks: `<h3>What kind of Ninja are you?</h3>
<table><thead><tr><th>1d6</th><th>Type</th></tr></thead><tbody>
<tr><td>1</td><td>Sniper</td></tr><tr><td>2</td><td>Poisoner</td></tr>
<tr><td>3</td><td>Assassinates from the shadows</td></tr><tr><td>4</td><td>Masked vigilante</td></tr>
<tr><td>5</td><td>Hidden in plain sight</td></tr><tr><td>6</td><td>Edgelord</td></tr>
</tbody></table>`,
  lifepathQuestions: `<ul>
<li><em>Who have I killed for you?</em></li>
<li><em>How did you catch on to what I do?</em></li>
<li><em>What secret have you asked me to keep?</em></li>
</ul>`,
  abilityOverview: `<p>Preparation is everything. You have a number of points equal to your Role rank to allocate between different Ninja tactics. You may change your allocation when you roll initiative or as an Action.</p>`,
  abilitySections: [],
  proteanFoci: [
    { id: id('ninja-tac-poison'), unlockRank: 1, name: 'Poison', description: 'Apply a toxin to a Melee Weapon. When you attack and penetrate SP at all, the target makes a BODY + Endurance check at DV = 11 + points allocated. On failure, take 1d6 additional direct HP damage.', minPoints: 0, maxPoints: 10, step: 1, points: 0 },
    { id: id('ninja-tac-silent'), unlockRank: 1, name: 'Silent Death', description: 'Each point allocated gives +1 to Stealth checks.', minPoints: 0, maxPoints: 10, step: 1, points: 0 },
    { id: id('ninja-tac-threat'), unlockRank: 1, name: 'Threat Detection', description: 'Each point allocated gives +1 to Perception checks. Does not stack with the same tactic from the Solo Role.', minPoints: 0, maxPoints: 10, step: 1, points: 0 },
    { id: id('ninja-tac-martial'), unlockRank: 2, name: 'Martial Skill', description: '+1 to Melee Weapon and Martial Arts attacks for every 2 points allocated (max +3 for 6 points).', minPoints: 0, maxPoints: 6, step: 1, points: 0 },
    { id: id('ninja-tac-cover'), unlockRank: 2, name: 'Seek Cover', description: 'Allocating 2 points gives +5 to Initiative, but your first turn can only focus on hiding or retreating.', minPoints: 0, maxPoints: 2, step: 2, points: 0 },
    { id: id('ninja-tac-weakspot'), unlockRank: 2, name: 'Weak-Spot', description: 'Bypass armor with SP ≤ (points/2) × 3. At 2 points, bypass ≤ 3 SP; at 4 points, ≤ 6 SP; up to 15 SP for 10 points. Attack does not ablate armor.', minPoints: 0, maxPoints: 10, step: 2, points: 0 },
    { id: id('ninja-tac-precision'), unlockRank: 3, name: 'Precision Kill', description: 'When your target is unaware of your attack: +1d6 damage for 3 points, +2d6 for 6 points, +3d6 for 9 points.', minPoints: 0, maxPoints: 9, step: 3, points: 0 },
  ],
  notes: '<p><strong>Starting Gear:</strong> Katana; Stun Baton or Katana; Kendachi Ra-5 Powered Knife; Constitutional Arms Liberty or Tsunami Arms Yanari; Militech M-179 Achilles or Arasaka Nowaki; Throwing Axe or Bow; Basic Medium Pistol Ammo ×50; Basic Sniper/Assault Rifle Ammo ×50; Light Armorjack; Binoculars, Caltrops, Lock-Picking Set, Radio Communicator, Toxin.<br><strong>Cyberware:</strong> Neuroport, Hidden Holster, Sub-Dermal Pocket, Toxin Binders.</p>',
});

// ── Operative ─────────────────────────────────────────────────────────────────

export const OPERATIVE = role({
  name: 'Operative',
  category: 'specialist',
  img: 'systems/cyberpunk-blue/assets/Roles/operative.png',
  description: `<p>Knowledge is power, and never before has that been as obvious. Every corporation wants to know what the competition is doing. Enter the Operative — an expert at covertly gathering and analyzing intelligence in meatspace.</p>
<blockquote><em>Do you realize how expensive the cover-up will be?</em><br>∆ Abernathy, Arasaka Counter-intelligence</blockquote>`,
  lifepathLinks: `<p><em>Operative lifepath tables are set by the GM based on their employer, specialization, and current operational context.</em></p>`,
  lifepathQuestions: `<ul>
<li><em>What secret have I uncovered about you?</em></li>
<li><em>What intel have you asked me to look for?</em></li>
<li><em>What kind of secret am I keeping from you?</em></li>
</ul>`,
  abilityOverview: `<p>When you gain a rank in the Operative Role ability, you gain 1 rank each in two different specialties: Analysis, Infiltration, Preparation, or Undercover.</p>`,
  abilitySections: [],
  specialties: [
    {
      id: id('op-sp-analysis'),
      name: 'Analysis',
      description: 'Intelligence gathering and pattern recognition.',
      rank: 0,
      unlockSections: [
        { id: id('op-sp-analysis-1'), name: 'Coded Message', unlockRank: 1, content: '<p><strong>Coded Message</strong> — Encode info in seemingly innocuous text or images. Decoding requires INT + Deduction (+ Analysis rank if any) vs DV = 10 + your INT + your Analysis rank. You may designate individuals who automatically understand it.</p><p><strong>Intelligence Analysis</strong> — Add Analysis ranks to INT checks when sorting through information or deducing patterns.</p>' },
        { id: id('op-sp-analysis-4'), name: 'Pattern Recognition', unlockRank: 4, content: '<p><strong>Pattern Recognition</strong> — Add half your Analysis ranks (rounded down) to Deduction and Human Perception checks.</p>' },
      ],
      optionGroups: [],
    },
    {
      id: id('op-sp-infiltration'),
      name: 'Infiltration',
      description: 'Moving freely through secured locations.',
      rank: 0,
      unlockSections: [
        { id: id('op-sp-infiltration-1'), name: 'Move Freely', unlockRank: 1, content: '<p><strong>Move Freely</strong> — Add half your Infiltration ranks (rounded up) to Acting (deception only), Conceal, Pick Lock, Stealth checks, and Forgery component rolls.</p><p><strong>Quick Disguise</strong> — Access one disguise strategy per 2 ranks (rounded up). Manufacturing strategies take 1 hour and have a suggested cost. Seeing through your disguise requires Deduction or Perception vs 10 + INT + Infiltration rank.</p>' },
        { id: id('op-sp-infiltration-5'), name: 'Infiltrate Network', unlockRank: 5, content: '<p><strong>Infiltrate Network</strong> — Perform basic Netrunning even if not a Netrunner (with required equipment). Gain +1 NET Action (stacks with Netrunner). Unlocks the Netrunning tab.</p>' },
      ],
      optionGroups: [
        {
          id: id('op-sp-infiltration-strategies'),
          unlockRank: 1,
          choices: 5,
          options: [
            { id: id('op-strat-backup'), name: 'Backup Equipment', description: 'A satellite payload containing equivalent of your starting gear will crash near you when signaled. Once used, must be re-selected to apply again.' },
            { id: id('op-strat-badge'), name: 'Badge', description: 'Quickly reproduce a group symbol as a replica (€$50 materials). Those normally using the badge have +2 to see through it.' },
            { id: id('op-strat-disguise'), name: 'Convincing Disguise', description: 'Alter your or someone else\'s appearance quickly (30 min/person, €$20 + clothes). Style check to make it look good.' },
            { id: id('op-strat-fakeid'), name: 'Fake ID', description: 'Produce believable ID cards/chips of a type you have analyzed (2 hours, €$100). Only a database check reveals them as fake.' },
            { id: id('op-strat-quickchange'), name: 'Quick Change', description: 'Wear both outfits at once and switch from one to the other as an Action.' },
            { id: id('op-strat-safehouse'), name: 'Safehouse', description: 'A secondary location unknown to others with all necessary amenities.' },
            { id: id('op-strat-wardrobe'), name: 'Wardrobe', description: 'Access to any non-specialty clothing worth ≤€$100 (Premium) in your size.' },
          ],
          selectedOptionIds: [],
        },
      ],
    },
    {
      id: id('op-sp-prep'),
      name: 'Preparation',
      description: 'Always having what you need, when you need it.',
      rank: 0,
      unlockSections: [
        { id: id('op-sp-prep-1'), name: 'Prepared', unlockRank: 1, content: '<p><strong>Prepared</strong> — Once per session, declare you have actually prepared for a situation and retroactively say you brought something useful (≤€$50 if bought).</p>' },
        { id: id('op-sp-prep-2'), name: 'Hidden', unlockRank: 2, content: '<p><strong>Hidden</strong> — Declare one item you have as miniaturized, disguised, or otherwise concealed (max one hand).</p>' },
        { id: id('op-sp-prep-3'), name: 'There Is More to It', unlockRank: 3, content: '<p><strong>There Is More to It</strong> — Designate an additional item as concealable (may be two-handed if disguised as something of similar size).</p>' },
        { id: id('op-sp-prep-4'), name: 'Well Prepared', unlockRank: 4, content: '<p><strong>Well Prepared</strong> — Use Prepared twice per session.</p>' },
        { id: id('op-sp-prep-5'), name: 'Already Did That', unlockRank: 5, content: '<p><strong>Already Did That</strong> — Use Prepared to play out a retroactive scene (e.g. looking up a floorplan or bribing a guard).</p>' },
        { id: id('op-sp-prep-6'), name: 'Well Spent', unlockRank: 6, content: '<p><strong>Well Spent</strong> — Each use of Prepared can get you something worth up to €$100 (Premium).</p>' },
        { id: id('op-sp-prep-7'), name: "Quartermaster's Pet", unlockRank: 7, content: '<p><strong>Quartermaster\'s Pet</strong> — Establishing something ≤€$10 (Everyday) with Prepared does not take a use.</p>' },
        { id: id('op-sp-prep-8'), name: 'Spy Gadgets', unlockRank: 8, content: '<p><strong>Spy Gadgets</strong> — Treat items equal to half your Preparation rank (round down) as safely disguised. One-hand items can be miniaturized; two items may be concealed as one.</p>' },
        { id: id('op-sp-prep-10'), name: 'Always Prepared', unlockRank: 10, content: '<p><strong>Always Prepared</strong> — Provided you can show any possibility of preparation, use Prepared with no limitation on uses. Remaining uses apply to truly unforeseeable situations.</p>' },
      ],
      optionGroups: [],
    },
    {
      id: id('op-sp-undercover'),
      name: 'Undercover',
      description: 'Maintaining false identities.',
      rank: 0,
      unlockSections: [
        { id: id('op-sp-undercover-1'), name: 'Cover', unlockRank: 1, content: '<p><strong>Cover</strong> — Each rank gives the choice between establishing a new cover, upgrading a cover, or preparing a temporary cover strategy. Normal covers start as fake identification (including relevant public databases). Choose from Cover Upgrades for existing covers.</p>' },
      ],
      optionGroups: [
        {
          id: id('op-sp-undercover-options'),
          unlockRank: 1,
          choices: 10,
          options: [
            { id: id('op-cover-new'), name: 'New Cover', description: 'Establish a new false identity with basic fake ID and database presence.' },
            { id: id('op-cover-connected'), name: 'Connected Background', description: 'Someone will answer the phone for your cover\'s family members, etc.' },
            { id: id('op-cover-convincing'), name: 'Convincing Training', description: '+2 on Acting tests to perform your cover convincingly. Can be taken up to 5 times per cover.' },
            { id: id('op-cover-crossculture'), name: 'Cross-Culture', description: 'Trained in the intricacies of a culture your cover is supposedly from. Bonus: two levels of a language ability.' },
            { id: id('op-cover-faceplate'), name: 'Faceplate', description: 'Cover gets its own appearance via cybernetics and body-sculpting (10 min to switch). Others take 30 min to change it. PSYCHE loss: 7 (2d6).' },
            { id: id('op-cover-seeded'), name: 'Seeded Secure Data', description: 'Cover information planted in closed government or corporate records.' },
            { id: id('op-cover-tabula'), name: 'Tabula Rasa', description: 'Your original identity is completely wiped from all records. Only once.' },
          ],
          selectedOptionIds: [],
        },
      ],
    },
  ],
  notes: '<p><strong>Starting Gear:</strong> Constitutional Arms Unity; Militech M2 Combat Knife; AmuTek XC-10 Cetus or Strix; Basic Heavy Pistol Ammo ×50; Light Armorjack; Audio Recorder, Bug Detector, Disposable Cell Phone ×2, Radio Communicator, Scrambler/Descrambler.<br><strong>Cyberware:</strong> Neuroport, Standard Cybereye, MicroOptics, Standard Cyberaudio Suite, Amplified Hearing, Shift Tacts.</p>',
});

// ── Rocker ────────────────────────────────────────────────────────────────────

export const ROCKER = role({
  name: 'Rocker',
  category: 'networker',
  img: 'systems/cyberpunk-blue/assets/Roles/rockerboy.png',
  description: `<p>If you live to rock, this is where you belong. As a Rocker, you are one of the street poets, the social conscience, and the rebels. Rocker legends like Johnny Silverhand have led armies against Corporations. Your message can give the timid courage, the weak strength, and the blind vision.</p>
<blockquote><em>They are not chanting my name in giant concert halls yet, but I have got fans, and I do not have to compromise my message for anyone.</em><br>∆ Forty, Rockerboy</blockquote>`,
  lifepathLinks: `<h3>What kind of Rocker are you?</h3>
<table><thead><tr><th>1d10</th><th>Type</th></tr></thead><tbody>
<tr><td>1</td><td>Musician</td></tr><tr><td>2</td><td>Slam Poet</td></tr>
<tr><td>3</td><td>Street Artist</td></tr><tr><td>4</td><td>Performance Art</td></tr>
<tr><td>5</td><td>Comedian</td></tr><tr><td>6</td><td>Orator</td></tr>
<tr><td>7</td><td>Politico</td></tr><tr><td>8</td><td>Rap Artist</td></tr>
<tr><td>9</td><td>DJ</td></tr><tr><td>10</td><td>Idoru</td></tr>
</tbody></table>`,
  lifepathQuestions: `<ul>
<li><em>What hit of mine is your favorite and why?</em></li>
<li><em>What have I created that is about you?</em></li>
<li><em>When did you first discover my work?</em></li>
</ul>`,
  abilityOverview: `<p>Define how you express yourself (music, street art, etc.). Add your Rocker ranks to checks where you use this form to make an impact.</p>
<p>To make a specific person a fan: DV 8 + their INT or COOL (if they actively disagree). For audiences: every step above 10 converts 5% of non-fans to new fans.</p>
<p>To get fans to do things: roll 1d10 + COOL + Rocker ranks. Individual: DV 15. Small group (≤20): DV 18. Large group (≤100): DV 22. +1 per rank above needed.</p>`,
  abilitySections: [
    { id: id('rocker-1'), name: 'Enthusiast', unlockRank: 1, content: '<p><strong>Enthusiast</strong> — <em>Venues:</em> Small local clubs. <em>Single Fan:</em> Small favor (buy a drink, give a lift). <em>Small Group:</em> Ask for autographs; stop you in streets to befriend. <em>Large Group:</em> Not yet.</p>' },
    { id: id('rocker-3'), name: 'Promising Artist', unlockRank: 3, content: '<p><strong>Promising Artist</strong> — <em>Venues:</em> Well-known clubs. <em>Single Fan:</em> Major favor (go to bed, put in a good word). <em>Small Group:</em> Fans regularly hang out, provide party favors. <em>Large Group:</em> Strong local following; fans buy recordings and merch.</p>' },
    { id: id('rocker-5'), name: 'Rising Star', unlockRank: 5, content: '<p><strong>Rising Star</strong> — <em>Venues:</em> Large, important clubs. <em>Single Fan:</em> Commit a minor crime (shoplift, fight). <em>Small Group:</em> Personal "posse"; constantly hang out, provide what you need. <em>Large Group:</em> Fans all over the city and nearby cities; strongly loyal.</p>' },
    { id: id('rocker-7'), name: 'True Star-Power', unlockRank: 7, content: '<p><strong>True Star-Power</strong> — <em>Venues:</em> Small concert halls, local video feed. <em>Single Fan:</em> Risk their life without question. <em>Small Group:</em> Commit minor crimes. <em>Large Group:</em> Rabidly loyal; fight rival fan groups, support info networks, band together to help.</p>' },
    { id: id('rocker-9'), name: 'Scream and the World Will Listen', unlockRank: 9, content: '<p><strong>Scream and the World Will Listen</strong> — <em>Venues:</em> Large concert halls, national video feed. <em>Single Fan:</em> Commit major crimes. <em>Small Group:</em> Commit major crimes. <em>Large Group:</em> Brainwashed, cult-like; will riot, destroy property, even kill for you.</p>' },
    { id: id('rocker-10'), name: 'Worldwide Icon', unlockRank: 10, content: '<p><strong>Worldwide Icon</strong> — <em>Venues:</em> Huge stadiums or international video. <em>Single Fan:</em> Sacrifice themselves without question. <em>Small Group:</em> Risk their lives; act as personal protection. <em>Large Group:</em> Worldwide cult-like following; private army based on your charisma.</p>' },
  ],
  notes: '<p><strong>Starting Gear:</strong> Tsunami Arms Nue; Baseball Bat or Flashbang Grenade; Teargas Grenade ×2; Basic Very Heavy Pistol Ammo ×50; Light Armorjack; Laptop, Electric Guitar, Pocket Amplifier, Glow Paint ×5, Radio Scanner/Music Player.<br><strong>Cyberware:</strong> Neuroport, Cyberaudio Suite, Level Dampener, Chemskin, Tech Hair.</p>',
});

// ── Solo ──────────────────────────────────────────────────────────────────────

export const SOLO = role({
  name: 'Solo',
  category: 'protean',
  img: 'systems/cyberpunk-blue/assets/Roles/solo.png',
  description: `<p>You were reborn with a gun in your hand. Whether as a freelance guard and killer-for-hire, or as a Corporate cybersoldier who enforces business deals and "black operations," you are an elite fighting machine.</p>
<p>You can have others do your dirty work for you. As long as your underlings remain loyal, at least.</p>
<blockquote><em>When Militech offered me three squares a day and a cot, you better believe I signed up.</em><br>∆ Abril "Mover" Montella, Private Contractor</blockquote>`,
  lifepathLinks: `<h3>What kind of Solo are you?</h3>
<table><thead><tr><th>1d6</th><th>Type</th></tr></thead><tbody>
<tr><td>1</td><td>Bodyguard</td></tr><tr><td>2</td><td>Street muscle for hire</td></tr>
<tr><td>3</td><td>Corporate enforcer who takes jobs on the side</td></tr>
<tr><td>4</td><td>Corporate or freelance Black Ops agent</td></tr>
<tr><td>5</td><td>Local vigilante for hire</td></tr>
<tr><td>6</td><td>Hitman for hire</td></tr>
</tbody></table>`,
  lifepathQuestions: `<ul>
<li><em>How did I save your life?</em></li>
<li><em>What have you given me that I always have with me?</em></li>
<li><em>Who did you know that died by my side in combat?</em></li>
</ul>`,
  abilityOverview: `<p>You are always ready for combat. Allocate a number of points equal to your Role rank between the tactics below. Change your allocation when you roll Initiative or as an Action (outside combat only).</p>`,
  abilitySections: [],
  proteanFoci: [
    { id: id('solo-tac-init'), unlockRank: 1, name: 'Initiative Reaction', description: 'Each point allocated gives +1 to Initiative.', minPoints: 0, maxPoints: 10, step: 1, points: 0 },
    { id: id('solo-tac-pummel'), unlockRank: 1, name: 'Pummel', description: '1 point: +1 damage with Martial Arts (Brawling) when holding a weapon. 2 points: use any one-handed item as a Light Melee weapon, or two-handed as a Medium Melee weapon.', minPoints: 0, maxPoints: 2, step: 1, points: 0 },
    { id: id('solo-tac-spot'), unlockRank: 1, name: 'Spot Weakness', description: 'Each point allocated gives +1 damage (before armor) to your first successful attack each round.', minPoints: 0, maxPoints: 10, step: 1, points: 0 },
    { id: id('solo-tac-threat'), unlockRank: 1, name: 'Threat Detection', description: 'Each point allocated gives +1 to Perception checks. Cannot stack with the same tactic from the Ninja Role.', minPoints: 0, maxPoints: 10, step: 1, points: 0 },
    { id: id('solo-tac-deflect'), unlockRank: 2, name: 'Damage Deflection', description: 'For every 2 points allocated, reduce the first damage you take each round by 1 (max −5 at 10 points).', minPoints: 0, maxPoints: 10, step: 2, points: 0 },
    { id: id('solo-tac-precision'), unlockRank: 3, name: 'Precision Attack', description: '+1 to all attacks for every 3 points allocated (max +3 for 9 points).', minPoints: 0, maxPoints: 9, step: 3, points: 0 },
    { id: id('solo-tac-fumble'), unlockRank: 4, name: 'Fumble Recovery', description: '4 points: if you roll 1 on the die for an attack roll, reroll it (must accept the new result).', minPoints: 0, maxPoints: 4, step: 4, points: 0 },
  ],
  notes: '<p><strong>Starting Gear:</strong> Tsunami Arms Nue; Constitutional Arms M2038 Tactician; Nokota D5 Copperhead; Militech M2 Combat Knife; Kang Tao Type-2067 or Militech Mk.2x Grandstand; Basic Very Heavy Pistol Ammo ×50; Basic Assault Rifle Ammo ×50; Basic Shotgun Slugs or Shells ×20; Light Armorjack; Binoculars, Backpack, Duct Tape, Flashlight, Rope.<br><strong>Cyberware:</strong> Neuroport, Sandevistan or Kerenzikov, Cyberarm, Wolvers.</p>',
});

// ── Techie ────────────────────────────────────────────────────────────────────

export const TECHIE = role({
  name: 'Techie',
  category: 'specialist',
  img: 'systems/cyberpunk-blue/assets/Roles/tech.png',
  description: `<p>You cannot leave anything alone. If it is near you for more than five minutes, you have disassembled it and made it into something new. You make your living building, fixing, and modifying — a crucial occupation in a technological world recovering from war.</p>
<blockquote><em>This City depends on technology to keep everything from going full-on post-apocalypse. And that means everyone depends on me.</em><br>∆ João "Torch" Barbosa Alvés, Owner of Torch's Total Repairs</blockquote>`,
  lifepathLinks: `<h3>What kind of Tech are you?</h3>
<table><thead><tr><th>1d10</th><th>Type</th></tr></thead><tbody>
<tr><td>1</td><td>Cyberware Technician</td></tr><tr><td>2</td><td>Vehicle Mechanic</td></tr>
<tr><td>3</td><td>Jack of All Trades</td></tr><tr><td>4</td><td>Small Electronics Technician</td></tr>
<tr><td>5</td><td>Weaponsmith</td></tr><tr><td>6</td><td>Crazy Inventor</td></tr>
<tr><td>7</td><td>Robot and Drone Mechanic</td></tr><tr><td>8</td><td>Heavy Machinery Mechanic</td></tr>
<tr><td>9</td><td>Scavenger</td></tr><tr><td>10</td><td>Nautical Mechanic</td></tr>
</tbody></table>`,
  lifepathQuestions: `<ul>
<li><em>What have I built specifically for you?</em></li>
<li><em>How did you help me get a rare part?</em></li>
<li><em>What are you hoping to get me to build for you?</em></li>
</ul>`,
  abilityOverview: `<p>The Techie's truly amazing talents come through their specialties. Each time you gain a rank in this Role ability, you gain one rank each in two of its specialties: Field Expertise, Upgrade Expertise, Fabrication Expertise, or Invention Expertise.</p>`,
  abilitySections: [],
  specialties: [
    {
      id: id('tech-sp-field'),
      name: 'Field Expertise',
      description: 'Handling tech problems on the fly.',
      rank: 0,
      unlockSections: [
        { id: id('tech-sp-field-1'), name: 'Techie McGuy', unlockRank: 1, content: '<p><strong>Techie McGuy</strong> — Add Field Expertise ranks to any Electronics and Mechanics checks (except those for a Role ability).</p><p><strong>Patched</strong> — Make a temporary repair in as little as an Action at ¼ material cost (same DV). Lasts 10 minutes per Field Expertise rank, then breaks. Cannot be done on the same item twice before proper repair.</p>' },
      ],
      optionGroups: [],
    },
    {
      id: id('tech-sp-upgrade'),
      name: 'Upgrade Expertise',
      description: 'Improving existing items.',
      rank: 0,
      unlockSections: [
        { id: id('tech-sp-upgrade-1'), name: 'Modification', unlockRank: 1, content: '<p><strong>Modification</strong> — Improve an existing item by modifying it. Roll the appropriate TECH skill + Upgrade Expertise ranks. Resources cost: same price category as the item. On failed roll, waste half the time but no components lost.</p><p><strong>Upgrades</strong> — Each rank in Upgrade Expertise learns one upgrade from the list below. Any given item can only receive one of these.</p>' },
      ],
      optionGroups: [
        {
          id: id('tech-sp-upgrade-options'),
          unlockRank: 1,
          choices: 10,
          options: [
            { id: id('tech-upg-psyche'), name: 'Lower PSYCHE Loss', description: 'Lower PSYCHE loss from non-borgware by 1d6 (or 4, chosen at start). Only if typical loss is 7+.' },
            { id: id('tech-upg-slots'), name: 'Extra Slot', description: 'For an item with slots, increase the number of slots by 1.' },
            { id: id('tech-upg-simplify'), name: 'Simplified Repair', description: 'Halve the time required for any future repair of this item.' },
            { id: id('tech-upg-conceal'), name: 'Concealable', description: 'Grant a one-handed weapon the concealable trait if it did not already have it.' },
            { id: id('tech-upg-quality'), name: 'Excellent Quality', description: 'Improve an Average Quality weapon to Excellent Quality.' },
            { id: id('tech-upg-ammo'), name: 'Non-Basic Ammo', description: 'Allow an Exotic weapon to fire one variety of non-basic Ammo of its Ammo type.' },
            { id: id('tech-upg-sp'), name: 'Increased SP', description: 'Increase an item\'s SP by 1 (only if it had SP to begin with).' },
            { id: id('tech-upg-vehicle'), name: 'Vehicle Upgrade', description: 'Upgrade a vehicle with something requiring only Nomad Role Ability of 1.' },
            { id: id('tech-upg-invention'), name: 'Install Invention', description: 'Install an upgrade created by the Invention Expertise.' },
            { id: id('tech-upg-combine'), name: 'Combine Items', description: 'Allow two items to function as one.' },
            { id: id('tech-upg-rugged'), name: 'Rugged', description: 'Double the item\'s HP and make it immune to EMP and microwave radiation.' },
          ],
          selectedOptionIds: [],
        },
      ],
    },
    {
      id: id('tech-sp-fabrication'),
      name: 'Fabrication Expertise',
      description: 'Constructing items from scratch.',
      rank: 0,
      unlockSections: [
        { id: id('tech-sp-fab-1'), name: 'Maker', unlockRank: 1, content: '<p><strong>Maker</strong> — Expertly construct any item you are reasonably familiar with. Roll the appropriate TECH skill + Fabrication Expertise ranks. DV and time are the same as for a repair. Component cost is one price category lower than the finished item. On failed roll, spend half the time but lose no components.</p><p><strong>Expert Use</strong> — If you succeed by more than 5, use only half the materials needed.</p>' },
        { id: id('tech-sp-fab-5'), name: 'Tools for the Job', unlockRank: 5, content: '<p><strong>Tools for the Job</strong> — When fabricating something requiring special equipment, you gain +2 to the check when you have those tools.</p>' },
      ],
      optionGroups: [],
    },
    {
      id: id('tech-sp-invention'),
      name: 'Invention Expertise',
      description: 'Creating entirely new items or modifications.',
      rank: 0,
      unlockSections: [
        { id: id('tech-sp-invention-1'), name: 'Invention', unlockRank: 1, content: '<p><strong>Invention</strong> — Requires careful collaboration with the GM. Create entirely new items or modifications. Make a simple schematic. The GM determines the price category of the item; use the appropriate TECH skill + Invention Expertise. Once invented, blueprints can be used with Fabrication (items) or Upgrade Expertise (modifications).</p><p><em>Note: The GM may adjust item rules after seeing them in play. The goal is shared spotlight and balance.</em></p>' },
      ],
      optionGroups: [],
    },
  ],
  notes: '<p><strong>Starting Gear:</strong> Techtronika VST-37 Pozhar or Nokota D5 Copperhead; Basic Shotgun ammo ×50 or Basic Assault Rifle Ammo ×50; Flashbang Grenade; Light Armorjack; Anti-Smog Breathing Mask, Disposable Cell Phone, Duct Tape ×5, Flashlight, Road Flare ×6, Tech Bag, Tech Tool.<br><strong>Cyberware:</strong> Neuroport, Standard Cybereye, MicroOptics, Dermal Display, Standard Cyberarm, Tool Hand.</p>',
});

// ── Catalogue export ──────────────────────────────────────────────────────────

export const ROLE_CATALOGUE = [
  BANDIT,
  CORPO,
  FIXER,
  GUIDE,
  LAW,
  MEDIA,
  MEDTECH,
  NETRUNNER,
  NINJA,
  OPERATIVE,
  ROCKER,
  SOLO,
  TECHIE,
];
