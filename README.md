# ButlerOS backend

Integration-ready backend for the ButlerOS digital butler. Runs entirely on
mock data with zero API keys — every integration module falls back to
deterministic mocks when its keys aren't set, so real APIs can be wired in
later without changing the module surface.

## Setup

```bash
npm install
npm run dev
```

Server starts on `http://localhost:3000` (see `PORT` in `.env`).
Copy `.env.example` to `.env` if/when you have real keys — the app runs
fine without it.

## Endpoints

- `GET  /health`
- `GET  /user`, `GET /user/:id`, `POST /user`, `PUT /user/:id`, `DELETE /user/:id`
- `POST /butler/run` — body `{ userId }` — runs a full AI-planned butler cycle
- `POST /butler/plan-weekend` — body `{ userId, mood?, budget?, location? }`
- `POST /butler/optimize-money` — body `{ userId }`

A demo user (`user-demo`) is seeded on boot for quick testing:

```bash
curl -X POST http://localhost:3000/butler/run -H "Content-Type: application/json" -d '{"userId":"user-demo"}'
curl -X POST http://localhost:3000/butler/plan-weekend -H "Content-Type: application/json" -d '{"userId":"user-demo"}'
curl -X POST http://localhost:3000/butler/optimize-money -H "Content-Type: application/json" -d '{"userId":"user-demo"}'
```

## Structure

```
src/
  index.ts              Express app bootstrap
  config.ts              env vars for every external API
  types.ts                shared TypeScript interfaces
  ai/orchestrator.ts     AI planner + runButlerCycle
  integrations/
    travel.ts             Expedia / Booking / Airbnb / TripAdvisor / Google Places
    transport.ts           Uber / Lyft
    shopping.ts             Amazon / Walmart / Best Buy + Rakuten / Skimlinks affiliate links
    experiences.ts           curated cards combining travel + shopping
    calendar.ts               Google Calendar / Outlook / Apple CalDAV / Eventbrite / Ticketmaster
    finance.ts                  Plaid / Yodlee / Stripe
    services.ts                  DoorDash / Instacart / TaskRabbit
    products.ts                   Weather / Yelp / Google Maps enrichment
  routes/
    user.ts    mock user CRUD + preferences
    butler.ts   plan-weekend / run / optimize-money endpoints
  jobs/scheduler.ts     hourly cron over active users
  store/userStore.ts    in-memory mock user store (seeded with user-demo)
```

Every external call site has a `// TODO` marking exactly where the real
API call goes and which env var(s) it needs.

## Running in a browser

This is a JSON API, not a web page — hitting a `POST` route from a browser
address bar won't work. To try it in a browser you'd need a small client
(fetch/axios) or a REST client extension; `curl`/Postman/Insomnia are the
simplest way to exercise it directly.
