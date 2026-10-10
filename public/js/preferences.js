export const DEFAULT_FILTER_STATE = {
  joinedOnly: false,
  selectedClubs: [],
  selectedSportTypes: [],
  viewMode: 'calendar'
};

export function normalizePreferences(value, previous = DEFAULT_FILTER_STATE) {
  const state = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const ids = values => Array.isArray(values)
    ? [...new Set(values.filter(v => typeof v === 'string' && v.length > 0))].slice(0, 10) : [];
  return {
    joinedOnly: typeof state.joinedOnly === 'boolean' ? state.joinedOnly : previous.joinedOnly,
    viewMode: ['calendar', 'list'].includes(state.viewMode) ? state.viewMode : previous.viewMode,
    selectedClubs: ids(state.selectedClubs ?? previous.selectedClubs),
    selectedSportTypes: ids(state.selectedSportTypes ?? previous.selectedSportTypes),
  };
}
