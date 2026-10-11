import { escapeHtml, clubMarkupHtml } from './html.js';

// Registry — each instance's open() closes all others first
const _allMultiSelectFilters = [];
// Set when an outside click dismisses an open dropdown;
// checked by the panel-level outside-click handler so it doesn't also close the whole panel.
let _dropdownClosedOnThisClick = false;

/**
 * Creates a reusable multi-select dropdown filter.
 * Both the club filter and the sport type filter are instances of this.
 *
 * Config:
 *   triggerId / dropdownId / listId / searchId / footerId / clearBtnId / avatarsId / placeholderId
 *   limit          {number}   max selections
 *   placeholder    {string}   trigger text when nothing is selected
 *   noun           {string}   "club" / "sport" — used in footer & empty-state text
 *   showAvatars    {boolean}  true → logo circles (clubs); false → text chips (sport types)
 *   hideWhenEmpty  {boolean}  hide the whole filter group when getItems() returns []
 *   getItems()     () => [{id, label, logo?}]
 *   getSelected()  () => string[]
 *   setSelected(ids)
 *   onAfterToggle()  called after checkbox toggles (save state, update counters, schedule reload)
 *   onClear()        called when the inline ✕ button is clicked (save, close panel, reload)
 */
export function createMultiSelectFilter(cfg) {
  const {
    triggerId, dropdownId, listId, searchId, footerId, clearBtnId, avatarsId, placeholderId,
    limit = 10, placeholder, noun = 'item',
    showAvatars = true, hideWhenEmpty = false,
    getItems, getSelected, setSelected, onAfterToggle, onClear,
    isItemCompatible = () => true,
  } = cfg;

  // Cached element references — looked up once at init time instead of on every call
  const $trigger     = document.getElementById(triggerId);
  const $dropdown    = document.getElementById(dropdownId);
  const $list        = document.getElementById(listId);
  const $search      = document.getElementById(searchId);
  const $footer      = document.getElementById(footerId);
  const $clearBtn    = document.getElementById(clearBtnId);
  const $avatars     = document.getElementById(avatarsId);
  const $placeholder = document.getElementById(placeholderId);

  // -- Open / close --

  function open() {
    _allMultiSelectFilters.forEach(f => { if (f !== instance) f.close(); });
    if (!$dropdown) return;
    $dropdown.style.display = 'block';
    $trigger?.setAttribute('aria-expanded', 'true');
    if ($search) $search.value = '';
    renderDropdown();
    $search?.focus();
  }

  function close({ restoreFocus = false, trackClick = false } = {}) {
    const containsFocus = $dropdown?.contains(document.activeElement);
    if (trackClick && $dropdown && $dropdown.style.display !== 'none') {
      _dropdownClosedOnThisClick = true; // tell panel handler: don't also close the panel
    }
    if ($dropdown) $dropdown.style.display = 'none';
    $trigger?.setAttribute('aria-expanded', 'false');
    if (restoreFocus || containsFocus) $trigger?.focus();
  }

  function toggleOpen() {
    if ($dropdown?.style.display === 'block') close(); else open();
  }

  // -- Render dropdown list --

  function renderDropdown() {
    if (!$list) return;

    const focusedValue = $list.contains(document.activeElement) ? document.activeElement.value : null;
    const query = ($search?.value || '').toLowerCase().trim();
    const items = getItems();
    const selected = getSelected();
    const atLimit = selected.length >= limit;

    const compatible   = items.filter(i =>  isItemCompatible(i)).sort((a, b) => a.label.localeCompare(b.label));
    const incompatible = items.filter(i => !isItemCompatible(i)).sort((a, b) => a.label.localeCompare(b.label));
    const sorted = [...compatible, ...incompatible];
    const filtered = query ? sorted.filter(item => item.label.toLowerCase().includes(query)) : sorted;

    if (filtered.length === 0) {
      $list.innerHTML = `<div class="club-filter-empty">No ${noun}s found</div>`;
    } else {
      $list.innerHTML = filtered.map(item => {
        const isSelected     = selected.includes(item.id);
        const isIncompatible = !isItemCompatible(item);
        const isDisabled     = (atLimit && !isSelected) || isIncompatible;
        const visual = showAvatars
          ? clubMarkupHtml({ name: item.label, logo: item.logo }, 'club-list-logo', 'club-list-initial')
          : '';
        const tooltip = isIncompatible ? ' title="Not available for the selected sport type"' : '';
        return `<label class="club-filter-list-item${isDisabled ? ' disabled' : ''}${isIncompatible ? ' incompatible' : ''}${isSelected ? ' selected' : ''}"${tooltip}>
          <input type="checkbox" class="club-filter-checkbox" value="${escapeHtml(item.id)}"${isSelected ? ' checked' : ''}${isDisabled ? ' disabled' : ''}>
          ${visual}<span class="club-list-name">${escapeHtml(item.label)}</span>
        </label>`;
      }).join('');
    }

    if (focusedValue !== null) {
      const inputs = [...$list.querySelectorAll('input:not(:disabled)')];
      (inputs.find(input => input.value === focusedValue) || inputs[0] || $search)?.focus();
    }

    if ($footer) {
      $footer.textContent = selected.length > 0
        ? `${selected.length} of ${limit} selected`
        : `Select up to ${limit}`;
    }
  }

  // -- Render trigger --

  function renderTrigger() {
    if (!$avatars || !$placeholder) return;

    const selected = getSelected();

    if (selected.length === 0) {
      $avatars.innerHTML = '';
      $placeholder.textContent = placeholder;
      $placeholder.style.display = '';
      if ($clearBtn) $clearBtn.style.display = 'none';
      return;
    }

    if ($clearBtn) $clearBtn.style.display = '';
    $placeholder.style.display = 'none';

    const maxShow = 5;
    const items = getItems();
    const selectedItems = selected.map(id => items.find(item => item.id === id)).filter(Boolean);

    if (selectedItems.length === 0) {
      // Items not loaded yet (initial page load with a saved filter state)
      $avatars.innerHTML = '';
      $placeholder.textContent = `${selected.length} ${selected.length === 1 ? noun : noun + 's'} selected`;
      $placeholder.style.display = '';
      return;
    }

    const shown = selectedItems.slice(0, maxShow);
    const overflow = selectedItems.length - maxShow;

    if (showAvatars) {
      $avatars.innerHTML = shown.map(item =>
        clubMarkupHtml({ name: item.label, logo: item.logo }, 'club-avatar-img', 'club-avatar-initial')
      ).join('') + (overflow > 0 ? `<span class="club-avatar-overflow">+${overflow}</span>` : '');
    } else {
      $avatars.innerHTML = shown.map(item =>
        `<span class="club-filter-chip">${escapeHtml(item.label)}</span>`
      ).join('') + (overflow > 0 ? `<span class="club-filter-chip club-filter-chip-more">+${overflow}</span>` : '');
    }
  }

  // -- Group visibility (sport type filter hides itself when no items available) --

  function updateGroupVisibility() {
    if (!hideWhenEmpty) return;
    if (!$trigger) return;
    const groupEl = $trigger.closest('.filter-group-sport-type');
    if (!groupEl) return;
    groupEl.style.display = getItems().length > 0 ? '' : 'none';
  }

  // -- Toggle a single item --

  function toggleItem(id) {
    const selected = getSelected();
    const idx = selected.indexOf(id);
    let newSelected;
    if (idx >= 0) {
      newSelected = selected.filter(s => s !== id);
    } else if (selected.length < limit) {
      newSelected = [...selected, id];
    } else {
      return; // at limit — ignore
    }
    setSelected(newSelected);
    onAfterToggle();
    renderTrigger();
    renderDropdown();
  }

  // -- Clear all selections --
  // silent: true skips callbacks (used by the global "clear all filters" button)

  function clearAll({ silent = false } = {}) {
    setSelected([]);
    close();
    renderTrigger();
    updateGroupVisibility();
    if (!silent) {
      if (onClear) onClear(); else onAfterToggle();
    }
  }

  // -- Wire up DOM event listeners --

  function setupListeners() {
    if ($trigger) {
      $trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleOpen();
      });

    }

    if ($clearBtn) {
      $clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearAll(); // fires onClear (or onAfterToggle as fallback)
        $trigger?.focus();
      });
    }

    if ($list) {
      $list.addEventListener('change', (e) => {
        if (e.target.classList.contains('club-filter-checkbox')) {
          toggleItem(e.target.value);
        }
      });
    }

    if ($search) {
      $search.addEventListener('input', () => renderDropdown());
    }

    // Close when clicking outside this filter's trigger + dropdown
    // (includes clicks on the filter label, other groups, or anywhere outside the panel)
    document.addEventListener('click', (e) => {
      if (!$trigger?.contains(e.target) && !$dropdown?.contains(e.target)) close({ trackClick: true });
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $dropdown?.style.display === 'block') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close({ restoreFocus: true });
      }
    });
  }

  const instance = { open, close, renderTrigger, renderDropdown, updateGroupVisibility, toggleItem, clearAll, setupListeners };
  _allMultiSelectFilters.push(instance);
  return instance;
}


export function consumeDropdownDismissal() {
  const dismissed = _dropdownClosedOnThisClick;
  _dropdownClosedOnThisClick = false;
  return dismissed;
}
