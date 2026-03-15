#!/usr/bin/env node
/**
 * Fetch and save Strava API responses as reference JSON examples in docs/.
 *
 * ── FETCH MODE (default) ─────────────────────────────────────────────────────
 * Fetch a single resource by type and ID.
 *
 *   node scripts/fetch-model.js --type <club|event|route> --id <id>
 *
 *   Output: docs/<type>-<id>-example.json
 *
 * ── CRAWL MODE ───────────────────────────────────────────────────────────────
 * Traverse the club → events → event → route chain and save every
 * resource_state variant encountered along the way.
 *
 *   node scripts/fetch-model.js --mode crawl --club <id> [--event <id>] [--route <id>]
 *
 *   --club  <id>   Required. Club to start from.
 *   --event <id>   Target event inside that club's events list.
 *                  Saves state-2 (from list) and state-3 (direct fetch).
 *                  Also extracts embedded sub-resources (club state-1, route state-1).
 *   --route <id>   Target route to fetch directly (state-3).
 *                  Routes embedded inside events are always saved when encountered.
 *
 *   Output: docs/<type>-<id>-state-<n>-example.json
 *
 *   How each state is obtained:
 *
 *   club  state 1 – embedded inside an event from the events list
 *   club  state 2 – from GET /athlete/clubs  OR  embedded in a directly-fetched event
 *   club  state 3 – from GET /clubs/{id}
 *
 *   event state 2 – from GET /clubs/{id}/group_events
 *   event state 3 – from GET /group_events/{id}
 *
 *   route state 1 – embedded inside an event (list or direct)
 *   route state 3 – from GET /routes/{id}
 *
 * ── AUTH (both modes) ────────────────────────────────────────────────────────
 *   STRAVA_ACCESS_TOKEN=<token>  or  --token <token>
 */

import fetch from 'node-fetch';
import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseJsonWithStringIds } from '../src/utils/parsing.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, '..', 'docs');
const API_BASE = 'https://www.strava.com/api/v3';

// ── CLI parsing ───────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : null;
};

const mode = getArg('mode') || 'fetch';
const token = getArg('token') || process.env.STRAVA_ACCESS_TOKEN;

if (!token) {
  console.error('Error: access token required. Set STRAVA_ACCESS_TOKEN or use --token <token>');
  process.exit(1);
}

// ── Shared helpers ────────────────────────────────────────────────────────────

async function fetchApi(path) {
  const url = `${API_BASE}${path}`;
  console.log(`  GET ${url}`);
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${body}`);
  return parseJsonWithStringIds(body);
}

async function saveFile(filename, data) {
  const outputPath = join(DOCS_DIR, filename);
  await writeFile(outputPath, JSON.stringify(data, null, 4), 'utf-8');
  console.log(`  ✓  docs/${filename}`);
  return filename;
}

// ── FETCH MODE ────────────────────────────────────────────────────────────────

async function runFetch() {
  const type = getArg('type');
  const id = getArg('id');

  if (!type || !id) {
    console.error('Usage: node scripts/fetch-model.js --type <club|event|route> --id <id>');
    process.exit(1);
  }

  const endpoints = { club: `/clubs/${id}`, event: `/group_events/${id}`, route: `/routes/${id}` };
  if (!endpoints[type]) {
    console.error(`Error: unknown type "${type}". Valid types: club, event, route`);
    process.exit(1);
  }

  const data = await fetchApi(endpoints[type]);
  await saveFile(`${type}-${id}-example.json`, data);
}

// ── CRAWL MODE ────────────────────────────────────────────────────────────────

async function runCrawl() {
  const clubId  = getArg('club');
  const eventId = getArg('event');
  const routeId = getArg('route');

  if (!clubId) {
    console.error('Usage: node scripts/fetch-model.js --mode crawl --club <id> [--event <id>] [--route <id>]');
    process.exit(1);
  }

  // Dedup tracker: skip if we already saved the same (type, id, state) tuple.
  const saved = [];
  const seen = new Set();

  async function maybeSave(type, id, data) {
    const state = data?.resource_state;
    if (state == null) {
      console.warn(`  ⚠  ${type} ${id} has no resource_state, skipping`);
      return;
    }
    const key = `${type}:${id}:${state}`;
    if (seen.has(key)) {
      console.log(`  –  ${type} ${id} state ${state} already saved, skipping`);
      return;
    }
    seen.add(key);
    const filename = await saveFile(`${type}-${id}-state-${state}-example.json`, data);
    saved.push(filename);
  }

  // Helper: extract and save sub-resources embedded in an event object.
  async function extractEmbedded(event) {
    // Club embedded in event (state 1 when from list, state 2 when direct fetch)
    if (event.club?.id != null) {
      await maybeSave('club', event.club.id, event.club);
    }
    // Route embedded in event (state 1 in both list and direct-fetch events)
    if (event.route?.id != null) {
      if (!routeId || String(event.route.id) === String(routeId)) {
        await maybeSave('route', event.route.id, event.route);
      }
    }
  }

  // ── Step 1: club from athlete clubs list → state 2 ────────────────────────
  console.log(`\n[step 1/5]  GET /athlete/clubs  (looking for club ${clubId})`);
  const clubsList = await fetchApi(`/athlete/clubs?page=1&per_page=200`);
  const clubFromList = clubsList.find(c => String(c.id) === String(clubId));
  if (clubFromList) {
    await maybeSave('club', clubId, clubFromList);
  } else {
    console.warn(`  ⚠  club ${clubId} not found in athlete clubs list (not a member?)`);
  }

  // ── Step 2: club fetched directly → state 3 ───────────────────────────────
  console.log(`\n[step 2/5]  GET /clubs/${clubId}`);
  const clubDirect = await fetchApi(`/clubs/${clubId}`);
  await maybeSave('club', clubId, clubDirect);

  // ── Step 3: event from club events list → event state 2,
  //           club embedded in it → state 1,
  //           route embedded in it → state 1 ──────────────────────────────────
  console.log(`\n[step 3/5]  GET /clubs/${clubId}/group_events  (looking for event ${eventId ?? 'any'})`);
  const eventsList = await fetchApi(`/clubs/${clubId}/group_events?upcoming=true&page=1&per_page=100`);
  console.log(`  Found ${eventsList.length} event(s)`);

  for (const event of eventsList) {
    if (eventId && String(event.id) !== String(eventId)) continue;
    await maybeSave('event', event.id, event);
    await extractEmbedded(event);
    if (eventId) break; // found the one we care about, no need to scan further
  }

  // ── Step 4: target event fetched directly → event state 3,
  //           club embedded in it → state 2 (new),
  //           route embedded in it → state 1 (likely same, deduped) ───────────
  if (eventId) {
    console.log(`\n[step 4/5]  GET /group_events/${eventId}`);
    const eventDirect = await fetchApi(`/group_events/${eventId}`);
    await maybeSave('event', eventId, eventDirect);
    await extractEmbedded(eventDirect);
  } else {
    console.log(`\n[step 4/5]  Skipped — no --event id provided`);
  }

  // ── Step 5: route fetched directly → state 3 ─────────────────────────────
  if (routeId) {
    console.log(`\n[step 5/5]  GET /routes/${routeId}`);
    const routeDirect = await fetchApi(`/routes/${routeId}`);
    await maybeSave('route', routeId, routeDirect);
  } else {
    console.log(`\n[step 5/5]  Skipped — no --route id provided`);
  }

  console.log(`\nDone — ${saved.length} file(s) saved:`);
  saved.forEach(f => console.log(`  docs/${f}`));
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (mode === 'crawl') {
  await runCrawl();
} else {
  await runFetch();
}
