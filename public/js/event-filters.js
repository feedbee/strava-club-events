import { createMultiSelectFilter } from './multi-select.js';

// Strava sport type values → display labels (from Strava club edit UI)
const SPORT_TYPE_LABELS = {
  cycling:           'Cycling',
  running:           'Running',
  triathlon:         'Triathlon',
  alpine_skiing:     'Alpine Skiing',
  backcountry_skiing:'Backcountry Skiing',
  canoeing:          'Canoeing',
  crossfit:          'Crossfit',
  ebiking:           'E-Biking',
  elliptical:        'Elliptical',
  soccer:            'Football (Soccer)',
  golf:              'Golf',
  handcycling:       'Handcycling',
  hiking:            'Hiking',
  ice_skating:       'Ice Skating',
  inline_skating:    'Inline Skating',
  kayaking:          'Kayaking',
  kitesurfing:       'Kitesurfing',
  nordic_skiing:     'Nordic Skiing',
  rock_climbing:     'Rock Climbing',
  roller_skiing:     'Roller Skiing',
  rowing:            'Rowing',
  footsports:        'Run/Walk/Hike',
  sailing:           'Sailing',
  skateboarding:     'Skateboarding',
  ski_snowboard:     'Ski/Snowboard',
  snowboarding:      'Snowboarding',
  snowshoeing:       'Snowshoeing',
  stair_stepper:     'Stair Stepper',
  stand_up_paddling: 'Stand-up Paddling',
  surfing:           'Surfing',
  swimming:          'Swimming',
  velomobile:        'Velomobile',
  virtual_ride:      'Virtual Riding',
  virtual_run:       'Virtual Running',
  walking:           'Walking',
  weight_training:   'Weight Training',
  wheelchair:        'Wheelchair',
  windsurfing:       'Windsurfing',
  winter_sports:     'Winter Sports',
  workout:           'Workout',
  yoga:              'Yoga',
  other:             'Multisport',
};

export function createEventFilters({ getClubs, getClubsById, filterState,
  saveFilterState, updateClearFiltersButton, updateFilterCount, scheduleEventsReload }) {
  const CLUB_FILTER_LIMIT = 10;
  // Shared onAfterToggle for both filters
  const _onAfterFilterToggle = () => {
    saveFilterState();
    updateClearFiltersButton();
    updateFilterCount();
    scheduleEventsReload();
  };

  // --- Club filter instance ---
  const clubFilter = createMultiSelectFilter({
    triggerId:     'clubFilterTrigger',
    dropdownId:    'clubFilterDropdown',
    listId:        'clubFilterList',
    searchId:      'clubFilterSearch',
    footerId:      'clubFilterFooter',
    clearBtnId:    'clubFilterClear',
    avatarsId:     'clubFilterAvatars',
    placeholderId: 'clubFilterPlaceholder',
    limit:         CLUB_FILTER_LIMIT,
    placeholder:   'All clubs',
    noun:          'club',
    showAvatars:   true,
    hideWhenEmpty: false,
    getItems:    () => getClubs().map(c => ({ id: String(c.id), label: c.name, logo: c.logo || null })),
    getSelected: () => filterState.selectedClubs,
    setSelected: (ids) => { filterState.selectedClubs = ids; },
    isItemCompatible: (item) => {
      if (filterState.selectedSportTypes.length === 0) return true;
      const club = getClubsById().get(item.id);
      return !!club && filterState.selectedSportTypes.includes((club.sport_type || '').toLowerCase());
    },
    onAfterToggle: _onAfterFilterToggle,
    // Intentionally leaves the filter panel open so the user can immediately
    // make a new selection (old inline code closed the panel on clear).
    onClear: () => {
      saveFilterState();
      updateClearFiltersButton();
      updateFilterCount();
      scheduleEventsReload();
    },
  });

  // --- Sport type filter instance ---
  const sportTypeFilter = createMultiSelectFilter({
    triggerId:     'sportTypeFilterTrigger',
    dropdownId:    'sportTypeFilterDropdown',
    listId:        'sportTypeFilterList',
    searchId:      'sportTypeFilterSearch',
    footerId:      'sportTypeFilterFooter',
    clearBtnId:    'sportTypeFilterClear',
    avatarsId:     'sportTypeFilterAvatars',
    placeholderId: 'sportTypeFilterPlaceholder',
    limit:         CLUB_FILTER_LIMIT,
    placeholder:   'All sports',
    noun:          'sport',
    showAvatars:   false,
    hideWhenEmpty: true,
    // Return only sport types present in the user's actual clubs.
    // hideWhenEmpty:true keeps the group hidden until clubs load (seen.size === 0).
    getItems: () => {
      const seen = new Map();
      for (const c of getClubs()) {
        if (c.sport_type && !seen.has(c.sport_type))
          seen.set(c.sport_type, c.localized_sport_type || SPORT_TYPE_LABELS[c.sport_type] || c.sport_type);
      }
      return [...seen.entries()].map(([id, label]) => ({ id, label }));
    },
    getSelected: () => filterState.selectedSportTypes,
    setSelected: (ids) => { filterState.selectedSportTypes = ids; },
    onAfterToggle: () => { _onAfterFilterToggle(); refreshClubsDropdownIfOpen(); },
    // Intentionally leaves the filter panel open so the user can immediately
    // make a new selection (old inline code closed the panel on clear).
    onClear: () => {
      saveFilterState();
      updateClearFiltersButton();
      updateFilterCount();
      refreshClubsDropdownIfOpen();
      scheduleEventsReload();
    },
  });

  // Refresh the clubs dropdown in-place when sport type selection changes (so grey-out updates immediately)
  function refreshClubsDropdownIfOpen() {
    const dd = document.getElementById('clubFilterDropdown');
    if (dd && dd.style.display !== 'none') clubFilter.renderDropdown();
  }

  return { clubFilter, sportTypeFilter };
}
