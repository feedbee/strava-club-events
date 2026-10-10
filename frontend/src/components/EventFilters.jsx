import { Icon } from "./Icon.jsx";
import React, { useId, useRef, useState } from "react";
function Picker({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const trigger = useRef(null);
  const id = useId();
  return (
    <div
      className="event-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          trigger.current.focus();
          event.stopPropagation();
        }
      }}
    >
      <span>{label}</span>
      <button
        ref={trigger}
        className="control"
        aria-controls={id}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {selected.length
          ? `${selected.length} selected`
          : `All ${label.toLowerCase()}`}{" "}
        ▾
      </button>
      {open && (
        <div
          id={id}
          className="picker-options"
          role="group"
          aria-label={`Filter ${label.toLowerCase()}`}
        >
          <input
            aria-label={`Search ${label.toLowerCase()}`}
            placeholder="Search…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {options
            .filter((option) =>
              option.name.toLowerCase().includes(search.toLowerCase()),
            )
            .map((option) => (
              <label key={option.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(String(option.id))}
                  disabled={
                    selected.length >= 10 &&
                    !selected.includes(String(option.id))
                  }
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...selected, String(option.id)]
                        : selected.filter((id) => id !== String(option.id)),
                    )
                  }
                />
                {option.name}
              </label>
            ))}
          <small>Select up to 10</small>
        </div>
      )}
    </div>
  );
}
export function EventFilters({ clubs, filters, onChange, count }) {
  const [open, setOpen] = useState(false);
  const opener = useRef(null);
  const sports = [
    ...new Set(clubs.map((club) => club.sport_type).filter(Boolean)),
  ].map((name) => ({ id: name, name }));
  return (
    <section
      className="event-filter-area"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          opener.current.focus();
        }
      }}
    >
      <div className="filter-summary">
        <button
          ref={opener}
          className="control primary"
          aria-expanded={open}
          aria-controls="react-filters"
          onClick={() => setOpen(!open)}
        >
          <Icon name="filter" size={14} />
          Filters
        </button>
        <span aria-live="polite">
          {count} events · {clubs.length} clubs
        </span>
      </div>
      {open && (
        <div id="react-filters" className="filter-panel">
          <Picker
            label="Sports"
            options={sports}
            selected={filters.sports}
            onChange={(sports) => onChange({ ...filters, sports })}
          />
          <Picker
            label="Clubs"
            options={clubs}
            selected={filters.clubs}
            onChange={(clubs) => onChange({ ...filters, clubs })}
          />
          <label className="joined-filter">
            <input
              type="checkbox"
              checked={filters.joinedOnly}
              onChange={(event) =>
                onChange({ ...filters, joinedOnly: event.target.checked })
              }
            />
            <span className="joined-switch" aria-hidden="true" />
            Show only joined events
          </label>
          {(filters.joinedOnly ||
            filters.clubs.length ||
            filters.sports.length) > 0 && (
            <button
              className="control"
              onClick={() =>
                onChange({ joinedOnly: false, clubs: [], sports: [] })
              }
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </section>
  );
}
