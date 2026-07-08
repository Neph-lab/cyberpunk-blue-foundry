/**
 * Guide Role — native Foundry Cards mechanics.
 *
 * The Guide ability runs entirely on Foundry's built-in Cards documents. Each
 * player-owned Guide character gets three flagged stacks — a Deck (copy of the
 * compendium deck), a Hand, and a "Fates" Pile — plus a "Guide Reading" hotbar
 * macro. Every stack/macro carries flags['cyberpunk-blue'].guide = { actorId, kind }
 * so lookups are idempotent.
 *
 * Because the player is only Observer on the Deck and Pile (Owner on the Hand),
 * all card movement runs on the GM: dealing, meditating, and playing are
 * delegated via helpers/socket.mjs (emitToGM). Only the sole meditation counter
 * (guide.meditationsUsed) is still stored as an actor flag.
 *
 * Provides:
 *  - ensureTarotDeck()        Seeds the cyberpunk-blue.tarot-deck compendium on first GM load.
 *  - ensureGuideCards(actor)  Idempotently provisions Deck/Hand/Pile/macro/hotbar (GM).
 *  - dealGuideReading / meditateGuideReading / playGuideCard  Card operations (GM).
 *  - registerTarotHooks()     Patches Cards.prototype.playDialog for Guide hands.
 */

import { emitToGM, guideGmAvailable } from './socket.mjs';

const TAROT_IMG_BASE = 'systems/cyberpunk-blue/assets/Tarot/';
const CARD_BACK_IMG  = `${TAROT_IMG_BASE}card_back.png`;
const TAROT_PACK_ID  = 'cyberpunk-blue.tarot-deck';
const GUIDE_FLAG     = 'cyberpunk-blue';
const GUIDE_FOLDER   = 'Guide Decks';

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

// ── Per-character Cards provisioning (Deck / Hand / Pile / Macro) ──────────────

/** Find a Guide-flagged Cards stack ('deck' | 'hand' | 'pile') for an actor. */
export function findGuideStack(actor, kind) {
  if (!actor) return null;
  return game.cards.find((c) => {
    const f = c.getFlag(GUIDE_FLAG, 'guide');
    return f?.actorId === actor.id && f?.kind === kind;
  }) ?? null;
}

/** The first non-GM user who owns the actor, or null (NPC / GM-only characters). */
export function getGuidePlayerUser(actor) {
  if (!(actor instanceof Actor)) return null;
  return game.users.find((u) => !u.isGM && actor.testUserPermission(u, 'OWNER')) ?? null;
}

/** Guide-role rank on the actor (0 if none). */
function _guideRoleRank(actor) {
  const role = actor.items.find((i) => i.type === 'role' && i.name === 'Guide');
  return Math.max(Number(role?.system?.rank) || 0, 0);
}

/** Cyberware lock info: high-numbered arcana lock when PSYCHE max drops below 60. */
function _guideLockInfo(actor) {
  const psycheMax = actor.system?.resources?.psyche?.max ?? 60;
  const lockedCount = Math.max(0, Math.floor((60 - psycheMax) / 10));
  return { lockedCount, availableCards: 22 - lockedCount };
}

function _meditationsMax(rank) {
  return 1 + (rank >= 5 ? 1 : 0) + (rank >= 10 ? 1 : 0);
}

function _shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function _ownership(userId, level) {
  return { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, [userId]: level };
}

async function _ensureGuideFolder() {
  let folder = game.folders.find((f) => f.type === 'Cards' && !f.folder && f.name === GUIDE_FOLDER);
  if (!folder) {
    folder = await Folder.create({ name: GUIDE_FOLDER, type: 'Cards', color: '#5ef2c0' });
  }
  return folder;
}

/** Compendium document id of the seeded Guide Tarot Deck. */
async function _compendiumDeckId() {
  const pack = game.packs.get(TAROT_PACK_ID);
  if (!pack) return null;
  await pack.getIndex();
  const entry = pack.index.find((e) => e.type === 'deck') ?? pack.index.contents[0];
  return entry?._id ?? null;
}

function _guideReadingMacroCommand(actorId) {
  return [
    `const hand = game.cards.find((c) => {`,
    `  const f = c.getFlag('cyberpunk-blue', 'guide');`,
    `  return f?.actorId === '${actorId}' && f?.kind === 'hand';`,
    `});`,
    `if (hand) hand.sheet.render(true);`,
    `else ui.notifications.warn('No Guide hand found — ask your GM to set up your Guide deck.');`,
  ].join('\n');
}

async function _assignMacroToHotbar(user, macro) {
  const hotbar = user.hotbar ?? {};
  if (Object.values(hotbar).includes(macro.id)) return; // already placed
  let slot = null;
  for (let i = 1; i <= 50; i++) {
    if (!hotbar[i]) { slot = i; break; }
  }
  if (slot === null) return; // hotbar full
  await user.assignHotbarMacro(macro, slot);
}

/**
 * Provision (idempotently) the native Cards documents, macro, and hotbar entry
 * for a player-owned Guide character. GM-only; delegate from players via
 * ensureGuideCardsWithPermission (helpers/socket.mjs).
 */
export async function ensureGuideCards(actor) {
  if (!game.user.isGM || !(actor instanceof Actor)) return;

  const player = getGuidePlayerUser(actor);
  if (!player) {
    // NPC / GM-only Guide — the GM manages the deck manually.
    ui.notifications.info(game.i18n.format('CYBER_BLUE.Role.Guide.NoPlayerOwner', { name: actor.name }));
    return;
  }

  const OWNER    = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  const OBSERVER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
  const folder   = await _ensureGuideFolder();

  // ── Deck (copy of the compendium deck; player is Observer) ──
  let deck = findGuideStack(actor, 'deck');
  if (!deck) {
    const pack = game.packs.get(TAROT_PACK_ID);
    const deckId = await _compendiumDeckId();
    if (!pack || !deckId) {
      ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Role.Guide.NoCompendiumDeck'));
      return;
    }
    deck = await game.cards.importFromCompendium(pack, deckId, { name: `${actor.name}'s Guide Deck` });
    await deck.update({
      folder: folder.id,
      ownership: _ownership(player.id, OBSERVER),
      flags: { [GUIDE_FLAG]: { guide: { actorId: actor.id, kind: 'deck' } } },
    });
  }

  // ── Hand (named for the character; player is Owner) ──
  let hand = findGuideStack(actor, 'hand');
  if (!hand) {
    hand = await Cards.create({
      name: actor.name,
      type: 'hand',
      img: CARD_BACK_IMG,
      folder: folder.id,
      ownership: _ownership(player.id, OWNER),
      flags: { [GUIDE_FLAG]: { guide: { actorId: actor.id, kind: 'hand' } } },
    });
  }

  // ── Pile "<Char>'s Fates" (player is Observer) ──
  let pile = findGuideStack(actor, 'pile');
  if (!pile) {
    pile = await Cards.create({
      name: `${actor.name}'s Fates`,
      type: 'pile',
      img: CARD_BACK_IMG,
      folder: folder.id,
      ownership: _ownership(player.id, OBSERVER),
      flags: { [GUIDE_FLAG]: { guide: { actorId: actor.id, kind: 'pile' } } },
    });
  }

  // ── "Guide Reading" macro that opens the character's Hand ──
  let macro = game.macros.find((m) => m.getFlag(GUIDE_FLAG, 'guide')?.actorId === actor.id);
  if (!macro) {
    macro = await Macro.create({
      name: 'Guide Reading',
      type: 'script',
      img: CARD_BACK_IMG,
      command: _guideReadingMacroCommand(actor.id),
      ownership: _ownership(player.id, OWNER),
      flags: { [GUIDE_FLAG]: { guide: { actorId: actor.id } } },
    });
  }

  // ── Place macro in the player's first free hotbar slot ──
  if (macro) await _assignMacroToHotbar(player, macro);

  ui.notifications.info(game.i18n.format('CYBER_BLUE.Role.Guide.Provisioned', { name: actor.name }));
}

// ── Reading operations (deal / meditate / play) — GM-side ─────────────────────

/** Gather every card dealt from this deck (into the hand/pile) back into it. */
async function _recallDeck(deck) {
  // Cards#recall (renamed from reset in v10) returns all of the deck's cards
  // from wherever they were dealt and clears their drawn state.
  await deck.recall({ chatNotification: false });
}

/**
 * Random ids of not-yet-drawn, unlocked cards in the deck.
 * `availableCount` = 22 − lockedCount; cards with tarotNumber ≥ availableCount
 * are locked out (highest arcana). Only draws from `deck.availableCards` so a
 * card already dealt into the hand is never dealt twice.
 */
function _pickUnlockedIds(deck, availableCount, count) {
  const pool = deck.availableCards.filter(
    (c) => (c.getFlag(GUIDE_FLAG, 'tarotNumber') ?? 99) < availableCount,
  );
  return _shuffleArr([...pool]).slice(0, count).map((c) => c.id);
}

/** Shared logic for Deal a Reading (meditate=false) and Meditate (meditate=true). */
async function _performReading(actor, { meditate }) {
  const deck = findGuideStack(actor, 'deck');
  const hand = findGuideStack(actor, 'hand');
  if (!deck || !hand) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Role.Guide.NoDeck'));
    return;
  }

  const rank = _guideRoleRank(actor);
  const { lockedCount, availableCards } = _guideLockInfo(actor);
  const drawCount = Math.min(rank, availableCards);
  const meditationsMax = _meditationsMax(rank);
  let meditationsUsed = actor.getFlag(GUIDE_FLAG, 'guide.meditationsUsed') ?? 0;

  if (meditate && meditationsUsed >= meditationsMax) {
    ui.notifications.warn(game.i18n.localize('CYBER_BLUE.Role.Guide.NoMeditations'));
    return;
  }

  await _recallDeck(deck);
  await deck.shuffle({ chatNotification: false });
  const ids = _pickUnlockedIds(deck, availableCards, drawCount);
  if (ids.length) await deck.pass(hand, ids, { chatNotification: false });

  meditationsUsed = meditate ? meditationsUsed + 1 : 0;
  await actor.setFlag(GUIDE_FLAG, 'guide.meditationsUsed', meditationsUsed);

  _postReadingChat(actor, hand, { meditate, lockedCount, drawCount, availableCards, meditationsUsed, meditationsMax });
}

export function dealGuideReading(actor) {
  if (!game.user.isGM) return;
  return _performReading(actor, { meditate: false });
}

export function meditateGuideReading(actor) {
  if (!game.user.isGM) return;
  return _performReading(actor, { meditate: true });
}

/**
 * Play a card from the character's Hand: route it through the Fates pile
 * (firing the effect / chat card), deal a replacement, and return the played
 * card to the deck. GM-side.
 */
export async function playGuideCard(actor, cardId) {
  if (!game.user.isGM || !(actor instanceof Actor)) return;
  const deck = findGuideStack(actor, 'deck');
  const hand = findGuideStack(actor, 'hand');
  const pile = findGuideStack(actor, 'pile');
  if (!deck || !hand || !pile) return;

  const card = hand.cards.get(cardId);
  if (!card) return;

  const tarotNum   = card.getFlag(GUIDE_FLAG, 'tarotNumber') ?? -1;
  const automation = card.getFlag(GUIDE_FLAG, 'automation');
  const cardDef    = TAROT_CARDS.find((c) => c.n === tarotNum) ?? null;

  // 1. Hand → Fates. pass() creates a fresh Card in the destination.
  const [played] = await hand.pass(pile, [cardId], { chatNotification: false });

  // 2. Trigger the effect / post the chat card.
  if (automation) {
    await _applyTarotEffect(automation, actor, cardDef);
  } else if (cardDef) {
    _postChatCard(null, cardDef, actor);
  }

  // 3. Deal a replacement from the deck to the hand.
  const { availableCards } = _guideLockInfo(actor);
  const [replId] = _pickUnlockedIds(deck, availableCards, 1);
  if (replId) await deck.pass(hand, [replId], { chatNotification: false });

  // 4. Return the played card from Fates to its home deck (Card#recall clears
  //    the deck original's drawn state and deletes the pile copy).
  if (played) await played.recall({ chatNotification: false });
}

/** Chat summary of a freshly dealt reading. */
function _postReadingChat(actor, hand, info) {
  const names = hand.cards
    .map((c) => ({ n: c.getFlag(GUIDE_FLAG, 'tarotNumber') ?? 0, name: c.name }))
    .sort((a, b) => a.n - b.n)
    .map((c) => `${c.n}. ${c.name}`)
    .join(', ');
  const heading = info.meditate
    ? game.i18n.localize('CYBER_BLUE.Role.Guide.MeditateHeading')
    : game.i18n.localize('CYBER_BLUE.Role.Guide.DealHeading');
  const medLine = info.meditate
    ? `<p><em>${game.i18n.localize('CYBER_BLUE.Role.Guide.Meditate')}: ${info.meditationsUsed}/${info.meditationsMax}</em></p>`
    : '';
  const lockLine = info.lockedCount > 0
    ? `<p><em>${info.lockedCount} ${game.i18n.localize('CYBER_BLUE.Role.Guide.Locked')} (${info.availableCards} ${game.i18n.localize('CYBER_BLUE.Role.Guide.Available')}).</em></p>`
    : '';
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="cyberpunk-blue chat-card">
      <h3><i class="fas fa-cards-blank"></i> ${heading}</h3>
      ${lockLine}
      <p><strong>${game.i18n.localize('CYBER_BLUE.Role.Guide.Reading')}:</strong> ${names || '—'}</p>
      ${medLine}
    </div>`,
  });
}

// ── Play-dialog patch ─────────────────────────────────────────────────────────

/**
 * Patches Cards.prototype.playDialog so that playing a card from a Guide Hand
 * shows the tarot card's meaning/trigger/effect and, on confirm, routes the
 * play through the GM (players are only Observers of the deck/pile and cannot
 * move cards themselves). Non-Guide stacks fall through to Foundry's default.
 */
export function registerTarotHooks() {
  const _orig = Cards.prototype.playDialog;

  Cards.prototype.playDialog = async function(card, destinations) {
    const isGuideHand = this.getFlag?.(GUIDE_FLAG, 'guide')?.kind === 'hand';
    const tarotNum = card?.getFlag?.(GUIDE_FLAG, 'tarotNumber');
    if (!isGuideHand || tarotNum === undefined || tarotNum === null) {
      return _orig.call(this, card, destinations);
    }
    return _tarotPlayDialog.call(this, card);
  };
}

// ── Custom play dialog ────────────────────────────────────────────────────────

async function _tarotPlayDialog(card) {
  const actorId = this.getFlag(GUIDE_FLAG, 'guide')?.actorId;
  const face = card.faces?.[card.face ?? 0] ?? {};
  const faceImg  = face.img  || card.back?.img || CARD_BACK_IMG;
  const faceText = face.text || '';
  const cardNum  = card.getFlag(GUIDE_FLAG, 'tarotNumber') ?? '?';

  const confirmed = await foundry.applications.api.DialogV2.prompt({
    window: { title: `${game.i18n.localize('CYBER_BLUE.Role.Guide.Play')}: ${cardNum}. ${card.name}` },
    content: `<div class="cyberpunk-blue tarot-play-dialog">
      <div class="tarot-play-card-image">
        <img class="tarot-play-img" src="${faceImg}" />
      </div>
      <div class="tarot-play-description">${faceText}</div>
    </div>`,
    ok: {
      label: game.i18n.localize('CYBER_BLUE.Role.Guide.PlayCard'),
      callback: () => true,
    },
    rejectClose: false,
  });

  if (!confirmed) return;

  if (game.user.isGM) {
    const actor = game.actors.get(actorId);
    if (actor) await playGuideCard(actor, card.id);
  } else if (guideGmAvailable()) {
    emitToGM('guidePlay', { actorId, cardId: card.id });
  }
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
