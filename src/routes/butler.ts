import { Router } from "express";
import { runButlerCycle } from "../ai/orchestrator";
import * as experiences from "../integrations/experiences";
import * as travel from "../integrations/travel";
import * as finance from "../integrations/finance";
import * as calendar from "../integrations/calendar";
import * as shopping from "../integrations/shopping";
import { openWeatherClient, tomorrowIoClient, nwsClient, openMeteoClient, yelpClient, ticketmasterClient, seatGeekClient, googlePlacesClient, nominatimClient, eventbriteClient } from "../apiClients";
import { integrationStatus } from "../integrationRegistry";
import { getUser } from "../store/userStore";

const router = Router();

// POST /butler/run
// Body: { userId }
router.post("/run", async (req, res) => {
  const { userId, location } = req.body ?? {};
  if (!userId) return res.status(400).json({ error: "userId is required" });

  try {
    // `location` (IP-detected or explicitly chosen on the client) always
    // takes priority over the user's saved favorite location — see
    // runButlerCycle/callAiButlerPlanner in ai/orchestrator.ts.
    const results = await runButlerCycle(userId, {}, location);
    res.json(results);
  } catch (err: any) {
    res.status(404).json({ error: err.message ?? "Failed to run butler cycle" });
  }
});

// POST /butler/plan-weekend
// Body: { userId, mood, budget, location }
router.post("/plan-weekend", async (req, res) => {
  const { userId, mood, budget, location } = req.body ?? {};
  if (!userId) return res.status(400).json({ error: "userId is required" });

  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const effectiveLocation = location ?? user.preferences.favoriteLocations?.[0] ?? "Austin";
  const effectiveMood = mood ?? user.preferences.mood ?? "relaxed";
  const effectiveBudget =
    budget ?? (user.preferences.budgetBand === "high" ? 500 : user.preferences.budgetBand === "low" ? 100 : 250);

  const [stays, weekendExperiences] = await Promise.all([
    travel.searchStays({ location: effectiveLocation, budget: effectiveBudget }),
    experiences.curateExperiences({
      user: userId,
      mood: effectiveMood,
      budget: effectiveBudget,
      location: effectiveLocation,
    }),
  ]);

  res.json({
    userId,
    generatedAt: new Date().toISOString(),
    location: effectiveLocation,
    mood: effectiveMood,
    budget: effectiveBudget,
    stays,
    experiences: weekendExperiences,
  });
});

// POST /butler/optimize-money
// Body: { userId }
router.post("/optimize-money", async (req, res) => {
  const { userId } = req.body ?? {};
  if (!userId) return res.status(400).json({ error: "userId is required" });

  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const snapshot = await finance.getFinancialSnapshot(userId);
  const optimizations = await finance.suggestOptimizations(snapshot);

  res.json({
    userId,
    generatedAt: new Date().toISOString(),
    snapshot,
    optimizations,
  });
});

// POST /butler/calendar-event
// Body: { userId, title, start, end, location?, type }
router.post("/calendar-event", async (req, res) => {
  const { userId, title, start, end, location, type } = req.body ?? {};
  if (!userId || !title || !start || !end || !type) {
    return res.status(400).json({ error: "userId, title, start, end, and type are required" });
  }

  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const event = await calendar.addEvent(userId, { title, start, end, location, type });
  res.status(201).json(event);
});

// GET /butler/calendar-events/:userId?from=&to=
router.get("/calendar-events/:userId", async (req, res) => {
  const { userId } = req.params;
  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const from = (req.query.from as string) ?? "0000-01-01";
  const to = (req.query.to as string) ?? "9999-12-31";

  const events = await calendar.listEvents(userId, { from, to });
  res.json(events);
});

// GET /butler/weather?location=Austin
// Tries OpenWeather (if WEATHER_KEY is set), then Tomorrow.io (if
// TOMORROWIO_KEY is set), then the National Weather Service as a final,
// no-key fallback (US locations only). `live: true` in the response
// reflects whether a real API call actually succeeded this request (not
// just whether a key is configured — a bad/expired key still falls
// through and reports live:false for that provider).
router.get("/weather", async (req, res) => {
  const location = (req.query.location as string) || "Austin";

  if (openWeatherClient.configured) {
    const result = await openWeatherClient.getWeather(location);
    if (result.live) return res.json({ ...result, source: "openweather" });
  }
  if (tomorrowIoClient.configured) {
    const result = await tomorrowIoClient.getWeather(location);
    if (result.live) return res.json({ ...result, source: "tomorrow.io" });
  }
  const nwsResult = await nwsClient.getWeather(location);
  if (nwsResult.live) return res.json({ ...nwsResult, source: "nws" });

  // Open-Meteo covers international locations NWS can't (no key needed).
  const openMeteoResult = await openMeteoClient.getWeather(location);
  if (openMeteoResult.live) return res.json({ ...openMeteoResult, source: "open-meteo" });

  res.json({ ...openMeteoResult, source: "not_connected" });
});

// GET /butler/destination-guide?location=Austin
// Real destination-guide excerpt from Wikivoyage — no key required.
router.get("/destination-guide", async (req, res) => {
  const location = (req.query.location as string) || "Austin";
  const result = await travel.getDestinationGuide(location);
  res.json({ location, ...result, source: result.live ? "wikivoyage" : "not_connected" });
});

// GET /butler/local?query=food&location=Austin
router.get("/local", async (req, res) => {
  const query = (req.query.query as string) || "recommended";
  const location = (req.query.location as string) || "Austin";
  const { live, results } = await yelpClient.getRatings(query, location);
  res.json({ query, location, results, live, source: live ? "yelp" : "not_connected" });
});

// GET /butler/places?query=restaurants&location=Austin&pageToken=...&lat=...&lon=...
// Real Google Places (New) text search — used to give each category page
// (Lifestyle/Travel/Dining/Wellness) its own genuinely different, live
// content for whatever location the user is currently exploring. Each item
// includes a real photo, rating, address, and description where Google has
// one. Pass the previous response's `nextPageToken` back as `pageToken` to
// page through further real results ("Load more") instead of being capped.
// Optional `lat`/`lon` (the visitor's own real, IP-geolocated coordinates)
// bias and re-rank results by actual distance — genuinely "close to me"
// rather than just "somewhere in this city."
router.get("/places", async (req, res) => {
  const query = (req.query.query as string) || "things to do";
  const location = (req.query.location as string) || "Austin";
  const pageToken = (req.query.pageToken as string) || undefined;
  const lat = req.query.lat ? Number(req.query.lat) : undefined;
  const lon = req.query.lon ? Number(req.query.lon) : undefined;
  const { live, items, nextPageToken } = await googlePlacesClient.searchPlaces({ query, location, pageToken, lat, lon });
  res.json({ query, location, items, live, nextPageToken: nextPageToken ?? null, source: live ? "google_places" : "not_connected" });
});

// GET /butler/photo?name=places/XXXX/photos/YYYY&w=700
// Streams a real Google Places photo through our own backend so the
// frontend never needs the raw Places API key in an <img> src. `name` is
// the photo resource name returned in each place item from /butler/places.
router.get("/photo", async (req, res) => {
  const name = req.query.name as string;
  if (!name) return res.status(400).end();
  const width = (req.query.w as string) || "700";
  const photo = await googlePlacesClient.fetchPhoto(name, width);
  if (!photo) return res.status(404).end();
  res.setHeader("Content-Type", photo.contentType);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(photo.buffer);
});

// GET /butler/events?location=Austin
// Merges two independent, genuinely public city-event sources —
// Ticketmaster and SeatGeek — each with its own real inventory, so
// coverage is broader than either alone (especially in markets one of
// the two covers thinly). Same title + same calendar day is treated as
// the same real-world event and only shown once, favoring whichever
// source listed it first (Ticketmaster). Neither source contributing
// still leaves an honest empty state, never fabricated listings.
router.get("/events", async (req, res) => {
  const location = (req.query.location as string) || "Austin";
  const [tm, sg] = await Promise.all([
    ticketmasterClient.findEvents({ location }),
    seatGeekClient.findEvents({ location }),
  ]);
  const dedupeKey = (e: { title: string; start: string | null }) =>
    `${e.title.toLowerCase().trim()}|${(e.start || "").slice(0, 10)}`;
  const seen = new Set<string>();
  const events = [...tm.events, ...sg.events].filter((e) => {
    const key = dedupeKey(e);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const live = tm.live || sg.live;
  const sources = [tm.live && "ticketmaster", sg.live && "seatgeek"].filter(Boolean);
  res.json({ location, events, live, source: sources.length ? sources.join("+") : "not_connected" });
});

// GET /butler/geocode?location=Austin
// Real coordinates via OpenStreetMap Nominatim (no key) — used to center
// the embedded map on a listing's detail page.
router.get("/geocode", async (req, res) => {
  const location = req.query.location as string;
  if (!location) return res.status(400).json({ error: "location is required" });
  const coords = await nominatimClient.geocode(location);
  res.json({ location, lat: coords ? coords.lat : null, lon: coords ? coords.lon : null, live: !!coords });
});

// GET /butler/products?need=&category=&budget=
// Real product matches ("Complete the Experience" panel) — Best Buy's own
// catalog search plus Rakuten Advertising when configured, each with the
// provider's real product photo, price, and a working affiliate link. Amazon
// and Walmart have no self-serve product-search API (see INTEGRATIONS.md),
// so they never contribute fabricated items here even if a key is set.
router.get("/products", async (req, res) => {
  const need = (req.query.need as string) || undefined;
  const category = (req.query.category as string) || undefined;
  const budget = req.query.budget ? Number(req.query.budget) : undefined;
  const items = await shopping.findProducts({ need, category, budget });
  const live = items.some((i) => i.live);
  res.json({ items, live, source: live ? "shopping" : "not_connected" });
});

// GET /butler/my-events
// Real events belonging to the connected Eventbrite account's own
// organization (a private-token, server-side integration — see
// eventbriteClient in apiClients.ts for why this can't be a general
// "events near me" search). Distinct from /butler/events (Ticketmaster),
// which is genuine public event discovery.
router.get("/my-events", async (_req, res) => {
  const { live, events } = await eventbriteClient.findEvents();
  res.json({ events, live, source: live ? "eventbrite" : "not_connected" });
});

// GET /butler/integrations
// Status dashboard: every registered client, whether it has credentials
// configured, for the "what's actually live right now" picture.
router.get("/integrations", (_req, res) => {
  const rows = integrationStatus();
  res.json({
    generatedAt: new Date().toISOString(),
    total: rows.length,
    configured: rows.filter((r) => r.configured).length,
    integrations: rows,
  });
});

export default router;
