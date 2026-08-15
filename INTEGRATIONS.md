# ButlerOS Integration Reference

Last verified: August 2026. Developer programs change their terms, URLs, and access
models often — treat everything below as a starting point and re-check the linked
docs before you actually sign up or ship. Several programs below are gated,
invite-only, or in the middle of a migration (flagged inline); ButlerOS is coded
against mock data for all of them today, so none of this blocks running the app.

Every credential name below matches an environment variable already wired into
`src/config.ts` and read by the placeholder clients in `apiClients.ts`.

---

## Travel

### Expedia Partner Solutions (EPS Rapid API)
- **Signup:** https://www.expediapartnersolutions.com/ (apply as an affiliate/API partner; not self-serve — requires a sales conversation and contract)
- **Credentials:** API key + shared secret, plus an EPS Account ID once contracted
- **Env vars:** `EXPEDIA_KEY`
- **Auth method:** API key + HMAC-signed requests (EPS Rapid), OAuth2 for newer endpoints
- **Rate limits:** Not publicly published — negotiated per contract, typically in the thousands of requests/day
- **Example request:**
  ```
  GET https://api.ean.com/v3/properties/availability?checkin=2026-09-10&checkout=2026-09-12&destination.region_id=6053839
  ```
  **Example response (trimmed):**
  ```json
  { "property_id": "123456", "rooms": [{ "rate_plan_id": "abc", "price": { "total": "412.00", "currency": "USD" } }] }
  ```
- **ButlerOS usage:** `travel.searchTrips()` / flight+package pricing comparisons
- **Notes:** Partner-gated, no free self-serve tier. Budget for a business development cycle before engineering time.

### Booking.com Affiliate Partner Program / Demand API
- **Signup:** https://www.booking.com/affiliate-program/v2/index.html (affiliate program); the machine-to-machine "Demand API" requires a separate commercial partnership via https://developers.booking.com/
- **Credentials:** Affiliate ID (for the affiliate/widget program) or API key + Partner ID (for Demand API, contract-gated)
- **Env vars:** `BOOKING_KEY`
- **Auth method:** API key (affiliate reporting API) or OAuth2 client credentials (Demand API)
- **Rate limits:** Not publicly documented; enforced per-contract
- **Example response (affiliate XML feed, trimmed):**
  ```xml
  <hotel><hotel_id>12345</hotel_id><name>Boutique Hotel</name><price currency="USD">220.00</price></hotel>
  ```
- **ButlerOS usage:** `travel.searchStays()`
- **Notes:** Full inventory/booking access is enterprise-only. Smaller integrations typically start with the affiliate widget/XML feed rather than live booking.

### TripAdvisor Content API
- **Signup:** https://www.tripadvisor.com/developers — self-serve signup, choose a plan and a max daily API-call budget
- **Credentials:** API key
- **Env vars:** `TRIPADVISOR_KEY`
- **Auth method:** API key as a query parameter
- **Rate limits:** First 5,000 calls/month free; Search endpoints capped at 10,000 calls/day per key (24-hour rolling window, resets at UTC midnight); exceeding the daily budget returns HTTP 429
- **Example request:** `GET https://api.content.tripadvisor.com/api/v1/location/search?searchQuery=Austin&key=API_KEY`
  **Example response (trimmed):** `{ "data": [{ "location_id": "60956", "name": "Austin", "rating": "4.5" }] }`
- **ButlerOS usage:** `travel.searchExperiences()`, ratings enrichment for experience cards
- **Sources:** [Rate Limits](https://tripadvisor-content-api.readme.io/reference/rate-limits), [FAQ](https://tripadvisor-content-api.readme.io/reference/faq)

### Airbnb Partner API
- **Signup:** No public self-serve developer portal. Airbnb closed general third-party API access years ago; access is limited to vetted Property Management System (PMS) and enterprise travel partners who apply through Airbnb's partnerships team.
- **Credentials:** OAuth2 client ID/secret, issued only after a signed partner agreement
- **Env vars:** `AIRBNB_PARTNER_KEY` (placeholder — populate once/if a partnership is approved)
- **Auth method:** OAuth2
- **Rate limits:** Not public
- **ButlerOS usage:** Would extend `travel.searchStays()` with Airbnb inventory
- **Notes:** Treat this as effectively unavailable for a bootstrapped product. ButlerOS's stay mocks label Airbnb results but there is no near-term self-serve path to real data — budget for a BD relationship or drop this integration in favor of Booking.com.

### Google Places API
- **Signup:** https://console.cloud.google.com/ → enable "Places API (New)", create an API key
- **Credentials:** API key (restrict by referrer/IP and API in the console)
- **Env vars:** `GOOGLE_PLACES_KEY`
- **Auth method:** API key (header `X-Goog-Api-Key` for the new Places API)
- **Rate limits:** Pay-as-you-go billing; default quota is set per-project in Cloud Console (commonly starts around 6,000 requests/minute, adjustable)
- **Example request:**
  ```
  POST https://places.googleapis.com/v1/places:searchText
  { "textQuery": "food tour in Austin" }
  ```
- **ButlerOS usage:** `travel.searchExperiences()`, `products.getLocalRatings()` enrichment
- **Notes:** Requires a billing account even for the free monthly credit tier.

### Skyscanner Travel API (Flights)
- **Signup:** https://www.partners.skyscanner.net/product/travel-api — apply as a commercial partner; not open to indie developers
- **Credentials:** API key issued after partner approval
- **Env vars:** `SKYSCANNER_KEY`
- **Auth method:** API key (Bearer-style header once approved)
- **Rate limits:** Negotiated per partner tier; not published
- **ButlerOS usage:** Secondary flight price comparison in `travel.searchTrips()`
- **Notes:** Applications are reviewed case-by-case (target: ~2 weeks) and require an established audience/business — this is not a quick indie-hacker signup. Unofficial data is available via third-party RapidAPI wrappers if a hard API key is needed for a prototype, but that's out-of-contract with Skyscanner and not recommended for production.
- **Sources:** [Skyscanner Partners](https://www.partners.skyscanner.net/product/travel-api), [Getting started](https://skyscannerpartnersupport.zendesk.com/hc/en-us/sections/4524598474781-Travel-APIs-Getting-started)

### Amadeus for Developers (Amadeus Travel API)
- **Signup:** https://developers.amadeus.com/register — free self-service signup, instant test-environment keys
- **Credentials:** API key (client ID) + API secret
- **Env vars:** `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`
- **Auth method:** OAuth2 client-credentials grant (`POST /v1/security/oauth2/token`)
- **Rate limits:** Test environment is free with modest quotas per API (e.g., Flight Offers Search ~10 req/sec, 2,000 req/month on the free tier); production requires a paid "move to production" step with contracted quotas
- **Example request:**
  ```
  GET https://test.api.amadeus.com/v2/shopping/flight-offers?originLocationCode=AUS&destinationLocationCode=LIS&departureDate=2026-09-10&adults=1
  Authorization: Bearer {access_token}
  ```
- **ButlerOS usage:** Best fit for real flight/hotel search once ready to move off mocks — the only travel API here with a genuinely free, instant, self-serve sandbox.
- **Notes:** Recommended as the first travel API to wire up for real, given the others are partner-gated.

---

## Transportation

### Uber API (Rides)
- **Signup:** https://developer.uber.com/ — create an app in the dashboard
- **Credentials:** OAuth2 client ID + client secret
- **Env vars:** `UBER_CLIENT_ID`, `UBER_SECRET`
- **Auth method:** OAuth2 (authorization code for user-context ride requests; client credentials for server-side price/time estimates)
- **Rate limits:** Sandbox is unlimited for testing; production ride-booking scopes require a separate app review and are approved case-by-case
- **Example request:** `GET https://api.uber.com/v1.2/estimates/price?start_latitude=30.27&start_longitude=-97.74&end_latitude=30.32&end_longitude=-97.70`
- **ButlerOS usage:** `transport.requestRide()`, `transport.estimateRide()`
- **Notes:** Full "request a ride on behalf of a user" scopes are heavily restricted post-2018 API changes; most third-party apps only get estimate/price endpoints without a direct partnership.

### Lyft API
- **Signup:** https://developer.lyft.com/
- **Credentials:** OAuth2 client ID + client secret
- **Env vars:** `LYFT_CLIENT_ID`, `LYFT_SECRET`
- **Auth method:** OAuth2 (authorization code / client credentials depending on scope)
- **Rate limits:** Not publicly published; sandbox available for development
- **Example request:** `GET https://api.lyft.com/v1/cost?start_lat=30.27&start_lng=-97.74&end_lat=30.32&end_lng=-97.70`
- **ButlerOS usage:** `transport.estimateRide()` fallback/comparison to Uber
- **Notes:** Like Uber, ride-booking scopes for third parties are limited; estimate endpoints are the realistic near-term target.

### DoorDash Drive API
- **Signup:** https://developer.doordash.com/ — instant sandbox signup with just name/email/phone
- **Credentials:** Developer ID, Key ID, and a signing secret (JWT-based)
- **Env vars:** `DOORDASH_KEY`
- **Auth method:** Signed JWT bearer token generated from your Developer ID/Key ID/signing secret
- **Rate limits:** Not published for sandbox; production access requires a certification step with no fixed timeline
- **Example request:** `POST https://openapi.doordash.com/drive/v2/deliveries` with a signed `Authorization: Bearer {jwt}` header
- **ButlerOS usage:** `services.requestFoodDelivery()`
- **Notes:** Sandbox is genuinely open/instant; production (real deliveries) is gated behind DoorDash's certification review.
- **Sources:** [Get started](https://developer.doordash.com/en-US/docs/drive/tutorials/get_started/), [FAQ](https://developer.doordash.com/en-US/docs/drive/overview/faqs/)

### Instacart Developer Platform API
- **Signup:** https://docs.instacart.com/developer_platform_api/get_started/overview — apply for access, then build against a sandbox
- **Credentials:** API key issued after approval
- **Env vars:** `INSTACART_KEY`
- **Auth method:** API key / bearer token
- **Rate limits:** Not publicly published
- **Example request:** `POST https://connect.instacart.com/idp/v1/products/products_link` to create a shoppable product list
- **ButlerOS usage:** `services.requestGroceryDelivery()`
- **Notes:** Average time from access request to production key is roughly 30–40 days per Instacart's own guidance — plan accordingly.
- **Sources:** [Get started](https://docs.instacart.com/developer_platform_api/get_started/overview)

### TaskRabbit API (Home Services API)
- **Signup:** https://developer.taskrabbit.com/ — request access via the developer hub
- **Credentials:** API key/OAuth credentials issued on approval (typically ~2 business days review)
- **Env vars:** `TASKRABBIT_KEY`
- **Auth method:** OAuth2 (per developer hub docs)
- **Rate limits:** Not publicly published
- **ButlerOS usage:** `services.requestTaskHelp()`
- **Notes:** As of this writing TaskRabbit's Home Services API is still described as under active development / not fully public — expect to request access and wait on availability rather than get an instant key.

### Turo API
- **Signup:** No public developer program. Turo shut off general third-party API access in 2023 and now only integrates with select strategic partners (e.g., Smartcar for in-car connectivity, Uber for in-app rental listings).
- **Credentials:** N/A for indie developers
- **Env vars:** `TURO_PARTNER_KEY` (placeholder — only usable if Turo grants a direct partnership)
- **Auth method:** N/A
- **ButlerOS usage:** Would back a "book a rental car" capability in `transport`
- **Notes:** Treat as effectively closed. If a car-rental feature is a priority, consider routing through Uber (which now lists Turo cars) or a traditional rental API (e.g., Amadeus Car Rental) instead.

### Postmates API
- **Signup:** https://developer.uber.com/ (Postmates API is being merged into Uber Direct)
- **Credentials:** Same OAuth2 client ID/secret pattern as Uber Direct
- **Env vars:** `POSTMATES_KEY` (legacy placeholder — new integrations should target Uber Direct instead)
- **Auth method:** OAuth2 (Uber Direct)
- **Rate limits:** Not published
- **ButlerOS usage:** Would fold into `services.requestFoodDelivery()` as an Uber Direct alias
- **Notes:** Postmates is now a storefront brand under Uber; existing Postmates DaaS API merchants are being auto-migrated to Uber Direct without code changes on their end. **Recommendation: build against Uber Direct directly rather than the legacy Postmates API.**
- **Sources:** [Uber Direct FAQs for Postmates Merchants](https://help.uber.com/en/merchants-and-restaurants/article/uber-direct-faqs-for-postmates-merchants), [Postmates Acquisition FAQs](https://help.uber.com/en/merchants-and-restaurants/article/postmates-acquisition-faqs)

---

## Shopping

### Amazon Associates / Amazon Creators API
- **Signup:** https://affiliate-program.amazon.com/ (Associates account) → https://webservices.amazon.com/paapi5/documentation/register-for-pa-api.html for API access
- **Credentials:** Access key + secret key + Associate/partner tag
- **Env vars:** `AMAZON_ASSOC_KEY` (associate tag), `AMAZON_CREATORS_API_KEY` (new API credential)
- **Auth method:** AWS-style signed requests (PA-API) — being replaced by the Creators API
- **Rate limits:** Historically 1 req/sec per associate, scaling with sales volume
- **⚠️ Important — API migration in progress:** The classic Product Advertising API (PA-API) is being **sunset on May 15, 2026** and is no longer accepting new customers; Amazon is directing everyone to the new **Creators API**. Both require **at least 10 qualified Associates referral sales in the trailing 30 days** to get/keep API access — a new site cannot get product data access on day one.
- **Example request (PA-API, legacy):** `POST https://webservices.amazon.com/paapi5/searchitems` with a signed payload
- **ButlerOS usage:** `shopping.findProducts()`, `shopping.getAffiliateLink()`
- **Notes:** Because of the 10-sale eligibility bar, most new ButlerOS deployments should launch on Rakuten/Skimlinks-style link-rewriting for Amazon products (no sales minimum) and only add direct API product data once qualifying sales volume exists.
- **Sources:** [Amazon PA-API Sunsets April 30, 2026](https://muntaseerrahman.com/blog/amazon-pa-api-sunset-creators-api-migration/), [PA-API registration](https://webservices.amazon.com/paapi5/documentation/register-for-pa-api.html)

### Rakuten Advertising
- **Signup:** https://rakutenadvertising.com/ → "Become a Publisher" (free), then https://developers.rakutenadvertising.com/ for API access
- **Credentials:** Client ID + client secret (create an "application" in the Developer Portal), plus an API access token
- **Env vars:** `RAKUTEN_KEY`
- **Auth method:** OAuth2 (token generated from the Developer Portal)
- **Rate limits:** Not publicly published for the Reporting/Linking APIs
- **Example request:** `GET https://api.linksynergy.com/productsearch/1.0?keyword=headphones&token={token}`
- **ButlerOS usage:** `shopping.getAffiliateLink()` — general-purpose affiliate link generation/reporting across many retailers
- **Sources:** [Publisher Sign Up Process](https://pubhelp.rakutenadvertising.com/hc/en-us/articles/20898125890573-Publisher-Sign-Up-Process), [Developer Portal Overview](https://pubhelp.rakutenadvertising.com/hc/en-us/articles/5949692220813-Developer-Portal-Overview)

### Skimlinks
- **Signup:** https://skimlinks.com/ → publisher signup (free, self-serve)
- **Credentials:** Publisher ID
- **Env vars:** `SKIMLINKS_KEY`
- **Auth method:** Publisher ID embedded in generated links / JS snippet; reporting API uses an API key
- **Rate limits:** Not publicly published
- **Example:** Skimlinks mostly works by rewriting outbound merchant links client-side (`skimlinks.com/go?url=...&id=PUBLISHER_ID`) rather than a query-based product API
- **ButlerOS usage:** `shopping.getAffiliateLink()` fallback covering thousands of merchants Rakuten doesn't
- **Notes:** Good default for "any random retailer" links since it auto-detects the destination merchant instead of requiring per-retailer contracts.

### Walmart Affiliate Program / Walmart.io Affiliate API
- **Signup:** https://affiliates.walmart.com/ (Impact-powered, ~24hr approval); separate Marketplace/product APIs at https://developer.walmart.com/ require an approved seller/partner relationship
- **Credentials:** Impact Account SID + Auth Token (affiliate program), plus a Walmart.io Consumer ID/private key for the item-lookup API
- **Env vars:** `WALMART_KEY`, `IMPACT_ACCOUNT_SID`, `IMPACT_AUTH_TOKEN`
- **Auth method:** Impact platform OAuth/token for affiliate reporting; signed requests (Consumer ID + private key) for Walmart.io product APIs
- **Rate limits:** Not publicly published
- **Example request:** `GET https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search?query=water+bottle`
- **ButlerOS usage:** `shopping.findProducts()`, `shopping.getAffiliateLink()`
- **Notes:** Standard commission is 1–4% by category via Impact; a separate higher-commission "Walmart Creator" program exists for social creators but isn't a REST API.
- **Sources:** [Affiliate API](https://www.walmart.io/docs/affiliate/), [Walmart Affiliate Program 2026 Guide](https://www.argil.ai/blog/walmart-affiliate-program-cd8f1)

### Best Buy Developer API
- **Signup:** https://developer.bestbuy.com/ — free self-serve API key signup
- **Credentials:** API key
- **Env vars:** `BESTBUY_KEY`
- **Auth method:** API key as a query parameter
- **Rate limits:** Historically 5 calls/second, 50,000 calls/day on the free tier (verify current limits at signup — Best Buy has changed API access terms before and documentation is thin on current 2026 quotas)
- **Example request:** `GET https://api.bestbuy.com/v1/products(search=headphones)?apiKey=API_KEY&format=json`
- **ButlerOS usage:** `shopping.findProducts()`
- **Notes:** Public docs are sparse on current status/limits as of this writing — confirm the program is still accepting new keys before relying on it.

### Target Affiliate Program (Club Target)
- **Signup:** https://partners.target.com/ — Impact-powered application ("Apply Now")
- **Credentials:** Impact Account SID + Auth Token (shared with Walmart's Impact-based flow if using the same Impact account)
- **Env vars:** `TARGET_AFFILIATE_ID`, `IMPACT_ACCOUNT_SID`, `IMPACT_AUTH_TOKEN`
- **Auth method:** Impact platform token auth
- **Rate limits:** Not publicly published
- **ButlerOS usage:** `shopping.findProducts()`, `shopping.getAffiliateLink()`
- **Notes:** As of May 2026 Target replaced its commission-based Creator Program with **Club Target**, a gamified points program for creators with 500+ followers — that program is not a fit for a backend integration. The classic Impact-based affiliate program (commission up to ~8% in qualifying categories, 0% on groceries/electronics/toys/etc.) is still the right one for ButlerOS's product-link use case. There is no public Target product-search API — link generation only.
- **Sources:** [Target Affiliate Program 2026 Guide](https://diggitymarketing.com/best-affiliate-programs/target/), [Club Target update](https://tapfiliate.com/blog/target-affiliate-program/)

---

## Finance

### Plaid
- **Signup:** https://dashboard.plaid.com/signup — free self-serve, instant Sandbox keys
- **Credentials:** Client ID + secret (separate secrets per environment: sandbox/development/production)
- **Env vars:** `PLAID_KEY`, `PLAID_SECRET`
- **Auth method:** Client ID + secret in request body/headers; Link uses short-lived tokens for the end-user OAuth-like flow
- **Rate limits:** Varies by product and plan; Sandbox is effectively unlimited for testing
- **Example request:** `POST https://sandbox.plaid.com/accounts/balance/get` with `{ "client_id", "secret", "access_token" }`
- **ButlerOS usage:** `finance.getFinancialSnapshot()` — real account/balance aggregation
- **Notes:** The most "just sign up and go" option in the finance category.

### Yodlee (Envestnet | Yodlee)
- **Signup:** https://developer.yodlee.com/ — sandbox self-serve; production requires a sales-assisted partnership
- **Credentials:** Client ID + secret (COBRAND / login credentials in older API versions)
- **Env vars:** `YODLEE_KEY`
- **Auth method:** OAuth2 client credentials
- **Rate limits:** Not publicly published
- **ButlerOS usage:** `finance.getFinancialSnapshot()` fallback/alternate aggregator to Plaid
- **Notes:** Sandbox is usable for prototyping; real bank connections are enterprise-sales-gated.

### Stripe Billing
- **Signup:** https://dashboard.stripe.com/register — instant, free
- **Credentials:** Secret API key (test and live mode keys are separate)
- **Env vars:** `STRIPE_KEY`
- **Auth method:** Bearer API key
- **Rate limits:** ~100 read + 100 write requests/second in live mode (test mode has its own, generally lower, limit); documented in the Stripe dashboard for your account
- **Example request:** `GET https://api.stripe.com/v1/subscriptions` with `Authorization: Bearer sk_live_...`
- **ButlerOS usage:** Subscription/payment history enrichment for `finance.getFinancialSnapshot()`
- **Notes:** Easiest finance API here to actually go live with.

### Rocket Money Partner API
- **Signup:** No public self-serve developer program found. Rocket Money (formerly Truebill) exposes account data to its own app and to explicit partners (it uses Plaid under the hood for bank connections); there's no documented open API for third parties to pull a user's Rocket Money data directly.
- **Credentials:** N/A publicly
- **Env vars:** `ROCKETMONEY_PARTNER_KEY` (placeholder)
- **ButlerOS usage:** Would back `finance.suggestOptimizations()` bill-negotiation-style suggestions
- **Notes:** For the "find and cancel subscriptions" feature, plan to build that logic directly on top of Plaid transaction data (as `finance.suggestOptimizations()` already mocks) rather than waiting on a Rocket Money integration.

### Visa Offers Platform API
- **Signup:** No open self-serve signup for the Offers product specifically — developer.visa.com hosts the general Visa Developer Center, but the Offers Platform API is access-restricted; you contact Visa directly (via your Visa representative or the developer support address) to request access.
- **Credentials:** API key + shared secret (mutual TLS certs required for production on most Visa APIs)
- **Env vars:** `VISA_API_KEY`, `VISA_SHARED_SECRET`
- **Auth method:** Two-way SSL + API key/shared secret signing
- **Rate limits:** Not publicly published
- **ButlerOS usage:** Card-linked offers/cashback surfaced alongside `shopping.findProducts()` recommendations
- **Notes:** This is an enterprise/issuer-relationship product, not an indie-developer API. Realistically out of reach without a card-issuing or acquiring business relationship.
- **Sources:** [Visa Offers Platform Overview](https://developer.visa.com/capabilities/vop)

### Mastercard Offers API
- **Signup:** https://developer.mastercard.com/ — developer portal signup is self-serve for browsing docs and sandbox keys on many Mastercard APIs, but the Offers/loyalty products typically require a partner agreement to go live
- **Credentials:** Consumer key + private signing key (OAuth 1.0a-style request signing)
- **Env vars:** `MASTERCARD_CONSUMER_KEY`, `MASTERCARD_SIGNING_KEY_PATH`
- **Auth method:** OAuth 1.0a with RSA-signed requests
- **Rate limits:** Not publicly published
- **ButlerOS usage:** Same role as Visa Offers — card-linked offers
- **Notes:** Sandbox access is easier to get than Visa's, but production offers data still needs a partner relationship.

---

## Scheduling

### Google Calendar API
- **Signup:** https://console.cloud.google.com/ → enable "Google Calendar API", create OAuth2 credentials (and/or an API key for public calendars)
- **Credentials:** OAuth2 client ID/secret (for write access to a user's calendar) or API key (read-only public calendars)
- **Env vars:** `GCAL_KEY`
- **Auth method:** OAuth2 (user consent) for read/write; API key for public read-only data
- **Rate limits:** Default project quota is 1,000,000 queries/day and 500 queries/100 seconds/user (adjustable in Cloud Console)
- **Example request:** `POST https://www.googleapis.com/calendar/v3/calendars/primary/events` with an event JSON body
- **ButlerOS usage:** `calendar.addEvent()`, `calendar.listEvents()`

### Outlook Calendar API (Microsoft Graph)
- **Signup:** https://portal.azure.com/ → register an app in Azure AD, add Calendars.ReadWrite permission
- **Credentials:** Azure AD application (client) ID + client secret, tenant ID
- **Env vars:** `OUTLOOK_KEY`
- **Auth method:** OAuth2 (Microsoft identity platform)
- **Rate limits:** Microsoft Graph throttles per-app/per-mailbox (commonly cited around 10,000 requests per 10 minutes per app per mailbox; varies by workload)
- **Example request:** `POST https://graph.microsoft.com/v1.0/me/events` with an event JSON body
- **ButlerOS usage:** `calendar.addEvent()`, `calendar.listEvents()` alternate provider

### Apple CalDAV
- **Signup:** No developer portal/API key — CalDAV is an open protocol. Users authenticate with their Apple ID and an app-specific password (generated at appleid.apple.com), or ButlerOS acts as a generic CalDAV client against `caldav.icloud.com`.
- **Credentials:** End user's Apple ID + app-specific password (not a ButlerOS-wide API key)
- **Env vars:** `APPLE_CALDAV_CONFIG` (server URL / connection template, not a secret by itself)
- **Auth method:** HTTP Basic Auth over CalDAV (WebDAV extension), per-user
- **Rate limits:** Not published; be conservative (CalDAV servers will throttle abusive polling)
- **ButlerOS usage:** `calendar.addEvent()`, `calendar.listEvents()` alternate provider for iCloud users
- **Notes:** Because this is per-user credentials rather than a global app key, real implementation needs a secure per-user credential store, not just an env var.

### Eventbrite API
- **Signup:** https://www.eventbrite.com/platform/api — create an app, get a personal OAuth token for your own account
- **Credentials:** OAuth2 token (personal token for your own org's events; full OAuth flow for acting on behalf of other organizers)
- **Env vars:** `EVENTBRITE_KEY`
- **Auth method:** OAuth2 bearer token
- **Rate limits:** Not publicly published post-2020 changes
- **ButlerOS usage:** `calendar.findEvents()` — local public event discovery
- **Notes:** ⚠️ Eventbrite retired the public **Event Search** endpoint (`GET /v3/events/search/`) in February 2020. The API today is centered on managing your own org's events, not searching all public Eventbrite listings. To power a "what's happening near me" style feature, you'd need to apply to Eventbrite's distribution partner program — it's not available via a normal API key.
- **Sources:** [API Terms of Use](https://www.eventbrite.com/help/en-us/articles/833731/eventbrite-api-terms-of-use/)

### Ticketmaster (Discovery API)
- **Signup:** https://developer.ticketmaster.com/ — instant self-serve API key
- **Credentials:** API key (Consumer Key)
- **Env vars:** `TICKETMASTER_KEY`
- **Auth method:** API key as a query parameter (`apikey=`)
- **Rate limits:** Default quota is 5,000 API calls/day at up to 5 requests/second (some sources cite 2 req/sec / 5,000/day for the public tier); higher limits available on request
- **Example request:** `GET https://app.ticketmaster.com/discovery/v2/events.json?city=Austin&apikey=API_KEY`
- **ButlerOS usage:** `calendar.findEvents()` — ticketed event discovery
- **Sources:** [Discovery API](https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/), [FAQs](https://developer.ticketmaster.com/support/faq/)

---

## Recommendations

### Yelp Fusion API
- **Signup:** https://www.yelp.com/developers — instant self-serve API key
- **Credentials:** API key
- **Env vars:** `YELP_KEY`
- **Auth method:** Bearer token (`Authorization: Bearer API_KEY`)
- **Rate limits:** Free tier historically 5,000 calls/day (daily quota resets, verify current tier at signup — Yelp has changed Fusion tiers before)
- **Example request:** `GET https://api.yelp.com/v3/businesses/search?location=Austin&term=food`
- **ButlerOS usage:** `products.getLocalRatings()`

### Google Maps API (Directions/Distance Matrix)
- **Signup:** Same Google Cloud Console project as Places — enable "Directions API" / "Distance Matrix API"
- **Credentials:** API key
- **Env vars:** `GOOGLE_MAPS_KEY`
- **Auth method:** API key query parameter
- **Rate limits:** Pay-as-you-go, quota configurable in Cloud Console
- **Example request:** `GET https://maps.googleapis.com/maps/api/directions/json?origin=Austin&destination=Round+Rock&key=API_KEY`
- **ButlerOS usage:** `products.getDirections()`

### OpenWeather API
- **Signup:** https://openweathermap.org/api — free self-serve API key
- **Credentials:** API key
- **Env vars:** `WEATHER_KEY`
- **Auth method:** API key query parameter
- **Rate limits:** Free tier: 1,000 calls/day, 60 calls/minute
- **Example request:** `GET https://api.openweathermap.org/data/2.5/weather?q=Austin&appid=API_KEY`
- **ButlerOS usage:** `products.getWeather()`

### Tomorrow.io API
- **Signup:** https://www.tomorrow.io/weather-api/ — free self-serve API key
- **Credentials:** API key
- **Env vars:** `TOMORROWIO_KEY`
- **Auth method:** API key query parameter
- **Rate limits:** Free tier is rate-limited per minute/hour/day (check current plan limits at signup — Tomorrow.io has adjusted free-tier caps before)
- **Example request:** `GET https://api.tomorrow.io/v4/weather/realtime?location=Austin&apikey=API_KEY`
- **ButlerOS usage:** Secondary/fallback weather provider alongside OpenWeather

---

## Summary: what's realistically self-serve today

| Tier | APIs |
|---|---|
| **Instant, free, self-serve** | Amadeus for Developers, Plaid (sandbox), Stripe, DoorDash Drive (sandbox), Best Buy, Ticketmaster, Yelp Fusion, Google Places/Maps, OpenWeather, Tomorrow.io, TripAdvisor Content API, Google Calendar, Rakuten, Skimlinks |
| **Self-serve but approval-gated (days–weeks)** | Instacart, TaskRabbit, Uber/Lyft (ride-booking scopes), Skyscanner, Outlook (Azure AD app review for some permissions), Eventbrite (distribution partner program) |
| **Affiliate-network signup (Impact), no product API** | Walmart, Target |
| **Sales/BD relationship required** | Expedia, Booking.com Demand API, Airbnb, Turo, Yodlee (production), Rocket Money, Visa Offers, Mastercard Offers |
| **Migration in progress — don't build on the old one** | Amazon PA-API → use Creators API (10-sale eligibility bar either way); Postmates API → use Uber Direct |

This ordering is a reasonable build sequence: wire up the instant/free tier for real first (Amadeus, Plaid, Stripe, Ticketmaster, Yelp, Google, weather APIs), keep everything else mocked, and revisit the gated/BD-required integrations once ButlerOS has traction to justify the partnership conversations.
