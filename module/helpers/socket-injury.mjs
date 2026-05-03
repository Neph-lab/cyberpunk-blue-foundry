/**
 * GM-side handler for applyForcedCriticalInjury socket messages.
 *
 * Lives in a separate module to avoid a circular import:
 *   martial-arts.mjs → socket.mjs → (lazy) socket-injury.mjs → critical-injury.mjs
 */

import { CRITICAL_INJURY_TABLE, CRITICAL_HEAD_INJURY_TABLE } from './critical-injury.mjs';

/**
 * Apply a forced critical injury on behalf of a player (called by the GM socket handler).
 *
 * @param {Actor}       targetActor
 * @param {string}      injuryKey     e.g. 'broken-arm'
 * @param {Actor|null}  attackerActor
 */
export async function applyForcedCriticalInjuryGM(targetActor, injuryKey, attackerActor) {
  const entry = Object.values(CRITICAL_INJURY_TABLE).find((e) => e.key === injuryKey)
    ?? Object.values(CRITICAL_HEAD_INJURY_TABLE).find((e) => e.key === injuryKey);
  if (!entry) {
    console.warn(`Cyberpunk Blue | applyForcedCriticalInjuryGM: unknown injury key "${injuryKey}"`);
    return;
  }

  const name = game.i18n.localize(entry.nameKey);
  const aeData = {
    name,
    icon: 'icons/svg/bones.svg',
    origin: targetActor.uuid,
    disabled: false,
    transfer: false,
    system: { changes: entry.changes ?? [] },
    flags: {
      'cyberpunk-blue': {
        criticalInjury: {
          key: entry.key,
          tableType: Object.values(CRITICAL_INJURY_TABLE).some((e) => e.key === injuryKey) ? 'body' : 'head',
          mortal: entry.mortal ?? false,
          descKey: entry.descKey ?? '',
          noQuickFix: entry.noQuickFix ?? false,
          quickFixDv: entry.quickFixDv ?? null,
          quickFixUsed: false,
          treatmentDv: entry.treatmentDv ?? null,
          surgeryRequired: entry.surgeryRequired ?? false,
          surgeryDv: entry.surgeryDv ?? null,
          evasionPrompt: entry.evasionPrompt ?? false,
          stabilized: false,
        },
      },
    },
  };

  const [createdAE] = await targetActor.createEmbeddedDocuments('ActiveEffect', [aeData]);

  const content = `
    <div class="cyberpunk-blue chat-card critical-injury-card">
      <div class="critical-injury-header">
        <i class="fas fa-skull-crossbones"></i>
        <span class="crit-target-name">${targetActor.name}</span>
      </div>
      <div class="critical-injury-name">${name} (Forced)</div>
      <div class="critical-injury-desc">${game.i18n.localize(entry.descKey)}</div>
      ${createdAE ? `<div class="critical-injury-actions"><button type="button" class="remove-critical-injury" data-actor-id="${targetActor.id}" data-effect-id="${createdAE.id}"><i class="fas fa-trash"></i> ${game.i18n.localize('CYBER_BLUE.CriticalInjury.Remove')}</button></div>` : ''}
    </div>`;

  await ChatMessage.create({
    speaker: attackerActor ? ChatMessage.getSpeaker({ actor: attackerActor }) : ChatMessage.getSpeaker(),
    content,
    flags: { 'cyberpunk-blue': { criticalInjuryCard: true } },
  });
}
