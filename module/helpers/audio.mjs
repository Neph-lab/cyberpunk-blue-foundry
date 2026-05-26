const SOUND_PATH = 'systems/cyberpunk-blue/assets/sound';

const UI_SOUNDS = {
  close:               `${SOUND_PATH}/close.mp3`,
  confirm:             `${SOUND_PATH}/confirm.mp3`,
  equip:               `${SOUND_PATH}/equip.mp3`,
  fail:                `${SOUND_PATH}/fail.mp3`,
  'gun-empty':         `${SOUND_PATH}/gun-empty.mp3`,
  hover:               `${SOUND_PATH}/hover.mp3`,
  'install-cyberware': `${SOUND_PATH}/install-cyberware.mp3`,
  reload:              `${SOUND_PATH}/reload.mp3`,
};

const SFX_SOUNDS = {
  autofire:              `${SOUND_PATH}/autofire.mp3`,
  'black-ICE-attack':    `${SOUND_PATH}/black-ICE-attack.mp3`,
  'crit-on-human':       `${SOUND_PATH}/crit-on-human.mp3`,
  explosion:             `${SOUND_PATH}/explosion.mp3`,
  gunshot:               `${SOUND_PATH}/gunshot.mp3`,
  'martial-arts-attack': `${SOUND_PATH}/martial-arts-attack.mp3`,
  'melee-weapon-attack': `${SOUND_PATH}/melee-weapon-attack.mp3`,
  'NET-action-zap':      `${SOUND_PATH}/NET-action-zap.mp3`,
};

function getVolume() {
  return game.settings.get('core', 'globalInterfaceVolume') ?? 1;
}

let _suppressNextFail = false;

/** Call before ui.notifications.warn/error to substitute a more specific sound for fail.mp3. */
export function suppressNextFailSound() {
  _suppressNextFail = true;
  setTimeout(() => { _suppressNextFail = false; }, 200);
}

/** Play a UI sound locally (respects the interface volume slider). */
export function playUiSound(name) {
  if (name === 'fail' && _suppressNextFail) {
    _suppressNextFail = false;
    return;
  }
  const src = UI_SOUNDS[name];
  if (!src) return;
  foundry.audio.AudioHelper.play({ src, volume: getVolume(), autoplay: true, loop: false }, false);
}

/** Broadcast a sound effect to all connected players (respects the interface volume slider). */
export function playSfx(name) {
  const src = SFX_SOUNDS[name];
  if (!src) return;
  foundry.audio.AudioHelper.play({ src, volume: getVolume(), autoplay: true, loop: false }, true);
}

// data-action values handled by specific sound triggers; skip default confirm/close for these.
const _SPECIFIC_SOUND_ACTIONS = new Set([
  'set-gear-state',
  'weapon-reload',
  'weapon-attack',
  'weapon-autofire',
  'weapon-doublelock',
  'mook-weapon-attack',
  'mook-ma-attack',
  'program-attack',
]);

const _CANCEL_ACTIONS = new Set(['cc-back', 'cc-skip']);

/** Wire up global UI sound listeners. Call once after the game is ready. */
export function initAudio() {
  // Patch notifications so every warning or error plays fail.mp3.
  const _originalNotify = ui.notifications.notify.bind(ui.notifications);
  ui.notifications.notify = function(message, type = 'info', options = {}) {
    if ((type === 'warning' || type === 'error') && !options.cyberpunkBlueNoSound) {
      playUiSound('fail');
    }
    return _originalNotify(message, type, options);
  };

  // Hover/focus: play once when the pointer enters (or keyboard focus lands on) a new button.
  let _lastHoverTarget = null;
  const _onButtonEnter = (event) => {
    const btn = event.target.closest('.cyberpunk-blue button:not([disabled])');
    if (btn !== _lastHoverTarget) {
      _lastHoverTarget = btn;
      if (btn) playUiSound('hover');
    }
  };
  document.addEventListener('mouseover', _onButtonEnter, { passive: true });
  document.addEventListener('focusin',   _onButtonEnter, { passive: true });

  // Click: play confirm or close for sheet buttons not handled by dedicated sound code.
  document.addEventListener('click', (event) => {
    const btn = event.target.closest('.cyberpunk-blue button:not([disabled])');
    if (!btn) return;

    const dataAction = btn.dataset.action ?? '';
    const attrAction = btn.getAttribute('action') ?? '';

    if (_SPECIFIC_SOUND_ACTIONS.has(dataAction)) return;

    if (_CANCEL_ACTIONS.has(dataAction) || attrAction === 'cancel') {
      playUiSound('close');
      return;
    }

    playUiSound('confirm');
  });
}
