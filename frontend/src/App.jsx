import React, { useCallback, useEffect, useState } from "react";
import { readCurrentUser } from "./data/auth.js";
import { EventsPage } from "./components/EventsPage.jsx";
import { MockControls } from "./components/MockControls.jsx";
import { Profile } from "./components/Profile.jsx";

const demo = new URLSearchParams(location.search).get("demo") === "1";
const demoUser = { firstname: "Alex", lastname: "Rider", athleteId: 0 };
export function App() {
  const [session, setSession] = useState({ status: "loading", user: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (demo) {
      setSession({
        status: "ready",
        user:
          new URLSearchParams(location.search).get("screen") === "login"
            ? null
            : demoUser,
      });
      return;
    }
    const controller = new AbortController();
    setSession({ status: "loading", user: null });
    readCurrentUser(fetch, controller.signal).then(
      (user) => {
        if (!controller.signal.aborted) setSession({ status: "ready", user });
      },
      (error) => {
        if (!controller.signal.aborted)
          setSession({ status: "error", user: null, error: error.message });
      },
    );
    return () => controller.abort();
  }, [attempt]);
  const handleAuthRequired = useCallback(
    () => setSession({ status: "ready", user: null }),
    [],
  );
  function demoNavigate(user) {
    const url = new URL(location.href);
    if (user) url.searchParams.delete("screen");
    else url.searchParams.set("screen", "login");
    history.replaceState(null, "", url);
    setSession({ status: "ready", user });
  }
  return (
    <div className="app-shell">
      <header className="service-header">
        <h1>
          <img src="/favicon.png" alt="" />
          Strava Club Events
        </h1>
        {session.user && (
          <Profile
            user={session.user}
            demo={demo}
            onDemoLogout={() => demoNavigate(null)}
          />
        )}
      </header>
      {new URLSearchParams(location.search).get("mock") === "1" && <MockControls />}
      <main className={`main-content ${session.user ? "signed-in" : ""}`}>
        {session.status === "loading" && (
          <p role="status">Loading your Strava session…</p>
        )}
        {session.status === "error" && (
          <div role="alert">
            <p>{session.error}</p>
            <button className="control" onClick={() => setAttempt(attempt + 1)}>
              Try again
            </button>
          </div>
        )}
        {session.status === "ready" && !session.user && (
          <a
            className="connect"
            href={demo ? "/next/?demo=1" : "/login"}
            onClick={
              demo
                ? (event) => {
                    event.preventDefault();
                    demoNavigate(demoUser);
                  }
                : undefined
            }
          >
            <img
              src="/images/btn_strava_connect_with_orange.png"
              srcSet="/images/btn_strava_connect_with_orange.png 1x, /images/btn_strava_connect_with_orange_x2.png 2x"
              alt="Connect with Strava"
            />
          </a>
        )}
        {session.user && (
          <EventsPage
            key={`${demo}:${session.user.athleteId}`}
            user={session.user}
            demo={demo}
            onAuthRequired={handleAuthRequired}
          />
        )}
      </main>
      <footer className="service-footer">
        <p>
          © Valery Leontyev, 2025. <a href="/about.html">About This Service</a>
        </p>
        <a
          href="https://www.strava.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="/images/api_logo_pwrdBy_strava_horiz_white.png"
            alt="Powered by Strava"
          />
        </a>
      </footer>
    </div>
  );
}
