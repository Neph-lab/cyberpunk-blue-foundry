export const GEAR_STATES = [
  { value: 'equipped', label: 'Equipped' },
  { value: 'carried', label: 'Carried' },
  { value: 'owned', label: 'Owned' },
];

export function normalizeGearState(system = {}) {
  if (GEAR_STATES.some((entry) => entry.value === system.state)) {
    return system.state;
  }

  if (system.equipped) {
    return 'equipped';
  }

  if (system.carried) {
    return 'carried';
  }

  return 'owned';
}

export function getGearStateUpdateData(state) {
  const normalized = GEAR_STATES.some((entry) => entry.value === state) ? state : 'owned';
  return {
    'system.state': normalized,
    'system.carried': normalized !== 'owned',
    'system.equipped': normalized === 'equipped',
  };
}
