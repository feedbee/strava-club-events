import express from "express";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { SCENARIOS, createMockDataset, filterMockDataset } from "./fixtures.js";

// Standalone development app: deliberately imports no production config, auth or database.
export function createMockApp({ now = new Date() } = {}) {
  const app = express();
  const sessions = new Map();
  app.disable("x-powered-by");
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use((req, res, next) => {
    let id = String(req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("calendarMock="))
      ?.slice(13);
    if (!sessions.has(id)) {
      id = randomUUID();
      // Bound local browser-session retention without production persistence.
      if (sessions.size >= 100) sessions.delete(sessions.keys().next().value);
      sessions.set(id, {
        scenario: "dense",
        authenticated: true,
        csrfToken: randomUUID(),
        ui: "prototype",
      });
      res.cookie("calendarMock", id, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
      });
    }
    req.mock = sessions.get(id);
    if (req.path.startsWith("/next")) req.mock.ui = "react";
    if (req.path.startsWith("/prototypes/calendar")) req.mock.ui = "prototype";
    res.set("Cache-Control", "no-store");
    next();
  });
  const target = (req) =>
    req.mock.ui === "react"
      ? "/next/"
      : "/prototypes/calendar/index.html?mock=1";
  app.get("/", (req, res) =>
    res.redirect("/prototypes/calendar/index.html?mock=1"),
  );
  app.get("/__mock", (req, res) =>
    res.json({
      scenario: req.mock.scenario,
      scenarios: SCENARIOS,
      authenticated: req.mock.authenticated,
    }),
  );
  app.post("/__mock", (req, res) => {
    if (!Object.hasOwn(SCENARIOS, req.body.scenario))
      return res.status(400).json({ error: "Unknown mock scenario" });
    req.mock.scenario = req.body.scenario;
    res.json({ scenario: req.mock.scenario });
  });
  app.get("/me", (req, res) => {
    if (!req.mock.authenticated)
      return res.status(401).json({ error: "Authentication required" });
    res.json({
      firstname: "Alex",
      lastname: "Rider",
      athleteId: 0,
      profile_pic: "",
      csrfToken: req.mock.csrfToken,
    });
  });
  app.get("/login", (req, res) => {
    req.mock.authenticated = true;
    res.redirect(target(req));
  });
  app.post("/logout", (req, res) => {
    if (req.body.csrfToken !== req.mock.csrfToken)
      return res.status(403).json({ error: "Invalid CSRF token" });
    req.mock.authenticated = false;
    req.mock.csrfToken = randomUUID();
    res.redirect(303, target(req));
  });
  app.get("/events", async (req, res) => {
    if (!req.mock.authenticated)
      return res.status(401).json({ error: "Authentication required" });
    for (const name of ["clubs", "sportTypes"])
      if (req.query[name] !== undefined && typeof req.query[name] !== "string")
        return res.status(400).json({ error: `Invalid ${name} parameter` });
    if (
      req.query.clubs &&
      (req.query.clubs.split(",").length > 10 ||
        req.query.clubs.split(",").some((id) => !/^\d+$/.test(id)))
    )
      return res.status(400).json({ error: "Invalid clubs parameter" });
    const scenario = req.mock.scenario;
    if (scenario === "error")
      return res.status(503).json({ error: "Mock events service unavailable" });
    if (scenario === "limited")
      return res
        .set("Retry-After", "60")
        .status(429)
        .json({ error: "Strava rate limit reached", retry_after: 60 });
    if (scenario === "slow")
      await new Promise((resolve) => setTimeout(resolve, 2000));
    res.json(filterMockDataset(createMockDataset(scenario, now), req.query));
  });
  app.use(
    express.static(fileURLToPath(new URL("../../../public/", import.meta.url))),
  );
  return app;
}
