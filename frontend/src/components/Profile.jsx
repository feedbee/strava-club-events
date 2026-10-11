import { Icon } from "./Icon.jsx";
import React, { useEffect, useRef, useState } from "react";

export function Profile({ user, demo, onDemoLogout }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const account = useRef(null);
  useEffect(() => {
    function dismiss(event) {
      if (account.current?.contains(event.target)) return;
      setHovered(false);
      setPinned(false);
      if (account.current?.contains(document.activeElement)) document.activeElement.blur();
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);
  const open = hovered || focused || pinned;
  const name =
    `${user.firstname || ""} ${user.lastname || ""}`.trim() || "Strava athlete";
  const avatar = demo
    ? "/prototypes/calendar/images/demo-profile.svg"
    : (/^https:\/\//.test(user.profile_pic || "") ||
       user.profile_pic === "/prototypes/calendar/images/demo-profile.svg")
      ? user.profile_pic
      : null;
  return (
    <div
      ref={account}
      className={`account ${open ? "is-open" : ""}`}
      onPointerEnter={(event) =>
        event.pointerType !== "touch" && setHovered(true)
      }
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
          setPinned(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setHovered(false);
          setPinned(false);
          event.target.blur();
        }
      }}
    >
      <button
        className="account-avatar"
        aria-label="Account menu"
        aria-expanded={open}
        aria-controls="account-details"
        onClick={(event) => {
          setPinned(!pinned);
          if (pinned) event.currentTarget.blur();
        }}
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        ) : (
          <span>{name.slice(0, 1)}</span>
        )}
      </button>
      <div id="account-details" className="account-details" inert={!open}>
        <a
          className="account-name"
          href={`https://www.strava.com/athletes/${encodeURIComponent(user.athleteId)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${name} — Strava profile (opens in a new tab)`}
        >
          {name}
          <svg
            className="external-icon"
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M14 4h6v6M20 4l-9 9M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
          </svg>
        </a>
        <form
          action="/logout"
          method="post"
          onSubmit={
            demo
              ? (event) => {
                  event.preventDefault();
                  onDemoLogout();
                }
              : undefined
          }
        >
          <input type="hidden" name="returnTo" value="/" />
          <input type="hidden" name="csrfToken" value={user.csrfToken || ""} />
          <button className="control" type="submit">
            <Icon name="logout" size={14} />
            Logout
          </button>
        </form>
      </div>
    </div>
  );
}
