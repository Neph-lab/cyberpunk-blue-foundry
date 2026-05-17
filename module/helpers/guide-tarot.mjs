/**
 * Guide Role — Foundry Cards deck seeding and play-dialog integration.
 *
 * Provides:
 *  - ensureTarotDeck()      Seeds the cyberpunk-blue.tarot-deck compendium on first GM load.
 *  - registerTarotHooks()   Patches Cards.prototype.playDialog so that playing a card from
 *                           a Guide-flagged hand shows the card description and triggers effects.
 *
 * The actor-sheet flag-based deal/meditate system (guide.reading, guide.deck, guide.meditationsUsed)
 * continues to handle the actor-level reading state. This module adds the visual card-object layer
 * that the GM can use via Foundry's native Cards interface (hands, piles, card sheets).
 */

const TAROT_IMG_BASE = 'systems/cyberpunk-blue/assets/Tarot/';
const CARD_BACK_IMG  = `${TAROT_IMG_BASE}card_back.png`;
const TAROT_PACK_ID  = 'cyberpunk-blue.tarot-deck';
const GUIDE_FLAG     = 'cyberpunk-blue';

// ── Card definitions ──────────────────────────────────────────────────────────

const TAROT_CARDS = [
  {
    n: 0, name: 'The Fool', img: '00_TheFool.webp',
    meaning: 'Beginning a journey, no expectations. Uncertain outcomes.',
    trigger: 'A member of your team failed a check where they added less than 8 to their 1d10.',
    effect: 'They get to re-roll, but must use the new result.',
    automation: null,
  },
  {
    n: 1, name: 'The Magician', img: '01_TheMagician.webp',
    meaning: 'Connect the spiritual and profane. Wisdom and willpower.',
    trigger: 'A member of your team succeeded on an INT + Human Perception check.',
    effect: 'Add +3 to the result of the first check to benefit from the insights.',
    automation: null,
  },
  {
    n: 2, name: 'The High Priestess', img: '02_TheHighPriestess.webp',
    meaning: 'Intuition that guides the hidden knowledge within. Secret understanding.',
    trigger: 'A member of your team makes a check to uncover something hidden.',
    effect: 'Add +2 to the result.',
    automation: null,
  },
  {
    n: 3, name: 'The Empress', img: '03_TheEmpress.webp',
    meaning: 'Nurturing, creativity, bringing something new into the world.',
    trigger: 'You make a check aimed at making someone else look cool.',
    effect: 'Add +2 to the result.',
    automation: null,
  },
  {
    n: 4, name: 'The Emperor', img: '04_TheEmperor.webp',
    meaning: 'Stability and structure. Authority to the point of authoritarianism.',
    trigger: 'A member of your team loses a Facedown or fails a COOL + Endurance check.',
    effect: 'They get to re-roll, but must use the new result.',
    automation: null,
  },
  {
    n: 5, name: 'The Hierophant', img: '05_TheHierophant.webp',
    meaning: 'Dogma, tradition, and conformity. A teacher and advisor urging commitment.',
    trigger: 'A member of your team makes a check with the help of instructions or a mentor.',
    effect: 'Add +1 to the roll.',
    automation: null,
  },
  {
    n: 6, name: 'The Lovers', img: '06_TheLovers.webp',
    meaning: 'Kinship and bonding, but also the duality between choices. Dualities and contradictions.',
    trigger: "You're facing two mutually exclusive choices.",
    effect: 'The GM will tell you which choice is likely better from a perspective you specify.',
    automation: null,
  },
  {
    n: 7, name: 'The Chariot', img: '07_TheChariot.webp',
    meaning: 'Triumph through ambition and always pushing ahead.',
    trigger: 'Someone in your team failed either an Endurance or a Drive check.',
    effect: 'They get to re-roll, but must use the new result.',
    automation: null,
  },
  {
    n: 8, name: 'Strength', img: '08_Strength.webp',
    meaning: 'Bravery and inner strength will conquer fear. Self-control and perseverance.',
    trigger: 'Someone or something is frightening a member of your team.',
    effect: 'For the next hour, they may ignore their fears.',
    automation: null,
  },
  {
    n: 9, name: 'The Hermit', img: '09_TheHermit.webp',
    meaning: 'Introspection in solitude. Wisdom through contemplation in isolation.',
    trigger: 'A member of your team is making an INT check while alone.',
    effect: 'They roll the 1d10 for the check twice and use the higher result.',
    automation: null,
  },
  {
    n: 10, name: 'Wheel of Fortune', img: '10_WheelOfFortune.webp',
    meaning: 'Luck and fortune comes and goes and the only constant is change.',
    trigger: 'A member of the team caused problems by failing a check.',
    effect: "Don't roll the 1d10 for the character's next check — assume that it's 8.",
    automation: 'wheelOfFortune',
  },
  {
    n: 11, name: 'Justice', img: '11_Justice.webp',
    meaning: 'The law must see different sides to reach a balanced and just outcome.',
    trigger: 'Someone in your vicinity performs an obviously illegal action.',
    effect: 'The next check (including attacks) by the one who broke the law has a -5 penalty.',
    automation: null,
  },
  {
    n: 12, name: 'The Hanged Man', img: '12_TheHangedMan.webp',
    meaning: 'Let it go. Surrender and sacrifice is the path forward. Action through inaction.',
    trigger: 'A member of your team is injured and/or Fatigued.',
    effect: 'They heal 5 HP and if they are Fatigued, they lose that condition. The Guide is now Fatigued.',
    automation: 'hangedMan',
  },
  {
    n: 13, name: 'Death', img: '13_Death.webp',
    meaning: 'A sudden and dramatic change. The end of one thing is the beginning of something new.',
    trigger: 'A member of your team becomes Mortally Wounded or suffers a Critical Injury.',
    effect: 'They may take an immediate action, even outside their own turn. This can be to stabilize themselves.',
    automation: null,
  },
  {
    n: 14, name: 'Temperance', img: '14_Temperance.webp',
    meaning: 'A balanced middle-ground. Harmonious relationships. Tranquil perspectives.',
    trigger: 'A member of your team, or someone you see, is about to make a check.',
    effect: "Don't roll the 1d10 for the check — assume the result is 6.",
    automation: null,
  },
  {
    n: 15, name: 'The Devil', img: '15_TheDevil.webp',
    meaning: 'Addiction to the material and profane. Fame, fortune, and fornication at the cost of a soul.',
    trigger: 'A member of your team is indulging in sex, drugs, or another materialistic vice.',
    effect: 'Any check they make within the next hour gains a +1 bonus.',
    automation: 'devil',
  },
  {
    n: 16, name: 'The Tower', img: '16_TheTower.webp',
    meaning: 'Chaos and destruction. Order is buried below the ruins. Violence and pain.',
    trigger: 'A member of your team deals damage.',
    effect: 'The damage is increased by 1d6.',
    automation: null,
  },
  {
    n: 17, name: 'The Star', img: '17_TheStar.webp',
    meaning: 'Hope and creativity. It is motivation to look for something more. Something better.',
    trigger: 'A member of your team is making a Composition or Performance check.',
    effect: 'Add +3 to the result.',
    automation: null,
  },
  {
    n: 18, name: 'The Moon', img: '18_TheMoon.webp',
    meaning: 'Illusions and deception. Surface appearance that hides something else. Dreams.',
    trigger: 'A member of your team is making a check to conceal a different action.',
    effect: 'Add +2 to the result.',
    automation: null,
  },
  {
    n: 19, name: 'The Sun', img: '19_TheSun.webp',
    meaning: 'Success and joy heralds truth and happiness. Optimism and vitality.',
    trigger: 'A member of your team is about to make a check.',
    effect: 'They use COOL as their Primary STAT instead of what was called for.',
    automation: null,
  },
  {
    n: 20, name: 'Judgement', img: '20_Judgement.webp',
    meaning: 'Resurrection and liberation. A renewal that will enable healing better self-worth.',
    trigger: 'A member of your team has made a check but not yet found out if they succeeded.',
    effect: 'They may choose to re-roll the 1d10 for the check but must then use the new result.',
    automation: null,
  },
  {
    n: 21, name: 'The World', img: '21_TheWorld.webp',
    meaning: 'Achievement and completion of a journey. A sense of togetherness with the whole.',
    trigger: 'Everyone in your team is gathered to plan ahead.',
    effect: "Define a specific expected check (e.g. Pick Lock to the side door, or Influence to seduce the guard). You'll gain +3 to that one check if and when it happens.",
    automation: null,
  },
];

/** Build the HTML description stored in each card's face.text. */
function _cardFaceText(card) {
  return `<p><em>${card.meaning}</em></p>\n`
    + `<p><strong>Trigger:</strong> ${card.trigger}</p>\n`
    + `<p><strong>Effect:</strong> ${card.effect}</p>`;
}

// ── Compendium seeding ────────────────────────────────────────────────────────

/**
 * Seeds one Cards document (a deck with 22 embedded cards) into the
 * cyberpunk-blue.tarot-deck compendium on first GM load.
 */
export async function ensureTarotDeck() {
  if (!game.user.isGM) return;
  const pack = game.packs.get(TAROT_PACK_ID);
  if (!pack) {
    console.warn('Cyberpunk Blue | Tarot deck compendium not found — skipping.');
    return;
  }
  await pack.getIndex();
  if (pack.index.size > 0) return; // already seeded

  console.log('Cyberpunk Blue | Seeding Guide Tarot Deck compendium…');

  const cardData = TAROT_CARDS.map((c, idx) => ({
    name: c.name,
    type: 'base',
    sort: (idx + 1) * 100000,
    suit: 'major arcana',
    value: c.n,
    faces: [{
      name: c.name,
      img:  `${TAROT_IMG_BASE}${c.img}`,
      text: _cardFaceText(c),
    }],
    back: { name: 'Tarot Card Back', img: CARD_BACK_IMG, text: '' },
    face: 0,
    flags: { [GUIDE_FLAG]: { tarotNumber: c.n, automation: c.automation } },
  }));

  const deckData = [{
    name: 'Guide Tarot Deck',
    type: 'deck',
    img:  CARD_BACK_IMG,
    flags: { [GUIDE_FLAG]: { isTarotDeck: true } },
    cards: cardData,
  }];

  await pack.configure({ locked: false });
  try {
    await Cards.createDocuments(deckData, { pack: TAROT_PACK_ID });
    console.log('Cyberpunk Blue | Guide Tarot Deck seeded.');
  } catch (err) {
    console.error('Cyberpunk Blue | Failed to seed Tarot deck:', err);
  } finally {
    await pack.configure({ locked: true });
  }
}

// ── Play-dialog patch ─────────────────────────────────────────────────────────

/**
 * Patches Cards.prototype.playDialog so that playing any card whose flags carry
 * a tarotNumber shows a custom dialog with the card description instead of
 * Foundry's default name+image-only dialog. No hand setup or flags required —
 * any hand that happens to contain tarot cards gets the enhanced dialog.
 */
export function registerTarotHooks() {
  const _orig = Cards.prototype.playDialog;

  Cards.prototype.playDialog = async function(card, destinations) {
    const tarotNum = card?.getFlag?.(GUIDE_FLAG, 'tarotNumber');
    if (tarotNum === undefined || tarotNum === null) {
      return _orig.call(this, card, destinations);
    }
    return _tarotPlayDialog.call(this, card, destinations);
  };
}

// ── Custom play dialog ────────────────────────────────────────────────────────

async function _tarotPlayDialog(card, destinations) {
  // Collect candidate destination piles
  const piles = (destinations?.length ? destinations : game.cards.filter(c => c.type === 'pile'))
    .filter(p => p.id !== this.id);

  if (!piles.length) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Role.Guide.NoPile'));
    return;
  }

  // Card face content
  const face = card.faces?.[card.face ?? 0] ?? {};
  const faceImg  = face.img  || card.back?.img || CARD_BACK_IMG;
  const faceText = face.text || '';
  const cardNum  = card.getFlag(GUIDE_FLAG, 'tarotNumber') ?? '?';

  // Destination selector (hidden if only one pile)
  const destOptions = piles.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  const destHtml = piles.length > 1
    ? `<label style="display:flex;gap:.5rem;align-items:center;margin-top:.75rem;">
         <span style="white-space:nowrap;">${game.i18n.localize('CYBER_BLUE.Role.Guide.PlayTo')}:</span>
         <select name="dest" style="flex:1;">${destOptions}</select>
       </label>`
    : `<input type="hidden" name="dest" value="${piles[0].id}" />`;

  const chosenDestId = await foundry.applications.api.DialogV2.prompt({
    window: { title: `${game.i18n.localize('CYBER_BLUE.Role.Guide.Play')}: ${cardNum}. ${card.name}` },
    content: `<div class="cyberpunk-blue tarot-play-dialog">
      <div class="tarot-play-card-image">
        <img class="tarot-play-img" src="${faceImg}" />
      </div>
      <div class="tarot-play-description">${faceText}</div>
      <div class="tarot-play-destination">${destHtml}</div>
    </div>`,
    ok: {
      label: game.i18n.localize('CYBER_BLUE.Role.Guide.PlayCard'),
      callback: (_e, btn) => btn.form.elements.dest.value,
    },
    rejectClose: false,
  });

  if (!chosenDestId) return;
  const dest = game.cards.get(chosenDestId);
  if (!dest) return;

  // Pass the card
  await this.pass(dest, [card.id]);

  // Identify the Guide actor: prefer the current user's character if it has a Guide role,
  // otherwise any character actor they own with a Guide role.
  const guideActor = _findGuideActor();

  const tarotNum = card.getFlag(GUIDE_FLAG, 'tarotNumber') ?? -1;
  const cardDef  = TAROT_CARDS.find(c => c.n === tarotNum);
  const automation = card.getFlag(GUIDE_FLAG, 'automation');

  if (automation) {
    await _applyTarotEffect(automation, guideActor, cardDef);
  } else if (cardDef) {
    _postChatCard(card, cardDef, guideActor);
  }
}

/** Find the Guide actor for the current user (owns a character with a Guide role). */
function _findGuideActor() {
  const character = game.user.character;
  if (character && character.items.some(i => i.type === 'role' && i.name === 'Guide')) {
    return character;
  }
  return game.actors.find(a =>
    a.type === 'character'
    && a.isOwner
    && a.items.some(i => i.type === 'role' && i.name === 'Guide')
  ) ?? null;
}

// ── Effect dispatcher ─────────────────────────────────────────────────────────

async function _applyTarotEffect(automation, guideActor, cardDef) {
  switch (automation) {
    case 'wheelOfFortune': return _effectWheelOfFortune(guideActor, cardDef);
    case 'hangedMan':      return _effectHangedMan(guideActor, cardDef);
    case 'devil':          return _effectDevil(guideActor, cardDef);
    default:               return cardDef ? _postChatCard(null, cardDef, guideActor) : null;
  }
}

// ── Actor picker helper ───────────────────────────────────────────────────────

async function _pickPlayerActor(title, prompt) {
  const actors = game.actors.filter(a =>
    a.type === 'character' && game.users.some(u => !u.isGM && a.testUserPermission(u, 'OWNER'))
  );
  if (!actors.length) return null;
  if (actors.length === 1) return actors[0];
  const opts = actors.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
  const id = await foundry.applications.api.DialogV2.prompt({
    window: { title },
    content: `<p>${prompt}</p><select name="actor" style="width:100%;">${opts}</select>`,
    ok: { label: 'Apply', callback: (_e, btn) => btn.form.elements.actor.value },
    rejectClose: false,
  });
  return id ? game.actors.get(id) : null;
}

// ── Automated effects ─────────────────────────────────────────────────────────

async function _effectWheelOfFortune(guideActor, cardDef) {
  const target = await _pickPlayerActor(
    'Wheel of Fortune',
    "Choose which character's next check assumes a d10 result of 8:",
  );
  if (!target) return _postChatCard(null, cardDef, guideActor);

  await target.createEmbeddedDocuments('ActiveEffect', [{
    name: 'Wheel of Fortune: Next Check = 8',
    img:  'icons/magic/time/clock-analog-brown.webp',
    changes: [],
    flags: { [GUIDE_FLAG]: { tarotEffect: true, tarotWheelOfFortune: true } },
  }]);
  _postChatCard(null, cardDef, guideActor, `<strong>${target.name}</strong> will use 8 instead of rolling on their next check. (Remove the AE when it triggers.)`);
}

async function _effectHangedMan(guideActor, cardDef) {
  const target = await _pickPlayerActor(
    'The Hanged Man',
    'Choose which character heals 5 HP and loses Fatigue (the Guide becomes Fatigued):',
  );
  if (!target) return _postChatCard(null, cardDef, guideActor);

  // Heal target
  const hp    = target.system?.resources?.hp?.value ?? 0;
  const hpMax = target.system?.resources?.hp?.max   ?? 0;
  await target.update({ 'system.resources.hp.value': Math.min(hp + 5, hpMax) });

  // Remove Fatigue AE from target (any AE named Fatigued or with exhaustion status)
  const fatiguedEffect = target.effects.find(e =>
    e.name?.toLowerCase().includes('fatigue') ||
    [...(e.statuses ?? [])].some(s => s.includes('exhaust') || s.includes('fatigue'))
  );
  if (fatiguedEffect) await fatiguedEffect.delete();

  // Apply Fatigue to Guide
  if (guideActor) {
    const hasExhaustion = CONFIG.statusEffects?.find(s => s.id === 'exhaustion');
    if (hasExhaustion) {
      await guideActor.toggleStatusEffect('exhaustion', { active: true });
    } else {
      await guideActor.createEmbeddedDocuments('ActiveEffect', [{
        name: 'Fatigued',
        img:  'icons/svg/degen.svg',
        flags: { [GUIDE_FLAG]: { tarotEffect: true, tarotFatigue: true } },
      }]);
    }
  }

  _postChatCard(null, cardDef, guideActor,
    `<strong>${target.name}</strong> healed 5 HP and lost Fatigue. ` +
    `<strong>${guideActor?.name ?? 'The Guide'}</strong> is now Fatigued.`
  );
}

async function _effectDevil(guideActor, cardDef) {
  const target = await _pickPlayerActor(
    'The Devil',
    'Choose which character gains +1 to all checks for the next hour:',
  );
  if (!target) return _postChatCard(null, cardDef, guideActor);

  await target.createEmbeddedDocuments('ActiveEffect', [{
    name: 'The Devil: +1 to All Checks',
    img:  'icons/creatures/unholy/demon-horned-winged-teal.webp',
    changes: [],
    duration: { seconds: 3600, startTime: game.time.worldTime },
    flags: { [GUIDE_FLAG]: { tarotEffect: true, tarotDevil: true } },
  }]);

  _postChatCard(null, cardDef, guideActor,
    `<strong>${target.name}</strong> gains +1 to all checks for the next hour.`
  );
}

// ── Chat card helper ──────────────────────────────────────────────────────────

function _postChatCard(card, cardDef, guideActor, extraHtml = '') {
  const num  = cardDef?.n ?? '';
  const name = cardDef?.name ?? card?.name ?? 'Unknown';
  const desc = cardDef ? _cardFaceText(cardDef) : '';
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: guideActor ?? null }),
    content: `<div class="cyberpunk-blue chat-card">
      <h3><i class="fas fa-cards-blank"></i> ${num}. ${name}</h3>
      ${desc}
      ${extraHtml ? `<p style="margin-top:.5rem;">${extraHtml}</p>` : ''}
    </div>`,
  });
}
