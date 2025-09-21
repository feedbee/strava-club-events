document.addEventListener('DOMContentLoaded', function() {
  const toggleFiltersBtn = document.getElementById('toggle-filters');
  const eventFilters = document.getElementById('event-filters');
  const filterJoined = document.getElementById('filter-joined');
  const clearFiltersBtn = document.getElementById('clear-filters');
  const activeFilterCount = document.getElementById('active-filter-count');
  
  let activeFilters = 0;
  
  // Toggle filter visibility
  function toggleFilters() {
    const isVisible = eventFilters.style.display === 'block';
    eventFilters.style.display = isVisible ? 'none' : 'block';
    
    // Update ARIA attributes for accessibility
    const toggleButton = document.getElementById('toggle-filters');
    toggleButton.setAttribute('aria-expanded', !isVisible);
  }
  
  // Update active filter count
  function updateFilterCount() {
    activeFilters = filterJoined.checked ? 1 : 0;
    activeFilterCount.textContent = activeFilters > 0 ? activeFilters : '';
    activeFilterCount.style.display = activeFilters > 0 ? 'inline-block' : 'none';
    
    // Show/hide clear filters button
    clearFiltersBtn.style.display = activeFilters > 0 ? 'inline-block' : 'none';
  }
  
  // Clear all filters
  function clearFilters() {
    filterJoined.checked = false;
    updateFilterCount();
    // Trigger any filter change events if needed
    filterJoined.dispatchEvent(new Event('change'));
  }
  
  // Event listeners
  function setupEventListeners() {
    // Toggle filters when clicking the filter link or count
    toggleFiltersBtn.addEventListener('click', function(e) {
      e.preventDefault();
      toggleFilters();
    });
  }
  
  filterJoined.addEventListener('change', updateFilterCount);
  clearFiltersBtn.addEventListener('click', clearFilters);
  
  // Initialize
  setupEventListeners();
  updateFilterCount();
});
