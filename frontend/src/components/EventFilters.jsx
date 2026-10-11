import { ClubLogo } from "./ClubLogo.jsx";
import { Icon } from "./Icon.jsx";
import React, { useEffect, useId, useRef, useState } from "react";
function Picker({ label, options, selected, onChange, kind }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const trigger = useRef(null);
  const id = useId();
  const root = useRef(null);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  const chosen = options.filter((option) => selected.includes(String(option.id)));
  return (
    <div
      className="event-picker"
      ref={root}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
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
        {selected.length ? (
          kind === "clubs" ? (
            <span className="selected-clubs" aria-label={`${selected.length} selected clubs`}>
              {chosen.slice(0, 4).map((club) => (
                <ClubLogo key={club.id} event={{ club_info: club, demo_logo: club.demo_logo || club.logo }} />
              ))}
              {(selected.length > 4 || !chosen.length) && <span>+{selected.length - Math.min(chosen.length, 4)}</span>}
            </span>
          ) : (
            <span className="selected-sports">
              {chosen.map((sport) => <span className="sport-tag" key={sport.id}>{sport.name}</span>)}
            </span>
          )
        ) : `All ${label.toLowerCase()}`} ▾
      </button>
      {selected.length > 0 && (
        <button className="picker-clear" aria-label={`Clear ${kind} filter`} onClick={() => {
          onChange([]);
          trigger.current.focus();
        }}>
          <Icon name="close" size={14} />
        </button>
      )}
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
export function EventFilters({ clubs, filters, onChange, count, meta }) {
  const [open, setOpen] = useState(false);
  const opener = useRef(null);
  const sports = [
    ...new Set(clubs.map((club) => club.sport_type).filter(Boolean)),
  ].map((id) => ({
    id,
    name: clubs.find((club) => club.sport_type === id && club.localized_sport_type)?.localized_sport_type ||
      id.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
  }));
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
          {count} events · {filters.clubs.length ? `${filters.clubs.length} selected clubs` : meta?.clubs_limited ? `${meta.clubs_processed} of ${meta.clubs_total} clubs` : `${clubs.length} clubs`}
        </span>
      </div>
      {open && (
        <div id="react-filters" className="filter-panel">
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
          <Picker
            label="Sports"
            kind="sports"
            options={sports}
            selected={filters.sports}
            onChange={(sports) => onChange({ ...filters, sports })}
          />
          <Picker
            label="Clubs"
            kind="clubs"
            options={clubs}
            selected={filters.clubs}
            onChange={(clubs) => onChange({ ...filters, clubs })}
          />
          {(filters.joinedOnly ||
            filters.clubs.length ||
            filters.sports.length) > 0 && (
            <button
              className="control"
              onClick={() =>
                onChange({ joinedOnly: false, clubs: [], sports: [] })
              }
            >
              <Icon name="close" size={14} />
              Clear filters
            </button>
          )}
        </div>
      )}
    </section>
  );
}
