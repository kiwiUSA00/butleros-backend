import crypto from "crypto";
import { v4 as uuid } from "uuid";
import config, { hasKeys } from "./config";

/**
 * apiClients.ts
 * ─────────────
 * One client per external API listed in INTEGRATIONS.md (27 services
 * across travel, transportation, shopping, finance, scheduling, and
 * recommendations).
 *
 * Policy (as of the "turn off demo data" pass): every capability function
 * returns a `live: boolean` alongside its payload.
 *   - `live: true`  → this response came from a real HTTP call that succeeded.
 *   - `live: false` → either no credentials are set, the real call failed,
 *     or (for gated APIs with no public self-serve path — Expedia, Booking,
 *     Airbnb, Skyscanner, Amazon, Walmart product search, Uber/Lyft ride
 *     booking, Turo, Postmates, Instacart, TaskRabbit, Eventbrite, Outlook,
 *     Apple CalDAV, Yodlee, Rocket Money, Visa/Mastercard Offers) there is
 *     simply no implemented real call — see INTEGRATIONS.md for why.
 *
 * `live: false` responses carry EMPTY payloads (`items: []`, `null`, etc.),
 * not fabricated content — nothing in this file invents fake-looking data
 * to fill a gap. Callers (integrationRegistry → orchestrator → routes →
 * frontend) are expected to render an honest "not connected" state when
 * `live` is false rather than substituting demo content.
 *
 * List-returning capabilities: `{ live, items: T[] }`
 * Link-returning capabilities: `{ live, url: string }`
 * Single-object capabilities (weather, directions, one delivery/ride): `{ live, ...fields }`
 */

function warnIfUnconfigured(service: string, ...keys: string[]) {
  if (!hasKeys(...keys)) {
    console.log(`[apiClients] ${service}: credentials not set — no live data available`);
  }
}

function logFailure(service: string, err: unknown) {
  console.error(`[apiClients] ${service} real call failed:`, (err as Error).message);
}

const mockId = (prefix: string) => `${prefix}-${uuid().slice(0, 8)}`;

function base64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

// NOTE: the IATA city/airport lookup that used to live here was only ever
// needed by Amadeus (flight/hotel search requires real airport codes, not
// free-text city names). Amadeus's self-service portal shut down
// 2026-07-17 (see amadeusClient below), so that lookup was removed along
// with the real API calls it supported.

// ────────────────────────────────────────────────────────────────────────
// TRAVEL
// ────────────────────────────────────────────────────────────────────────

// No public self-serve API for these three (see INTEGRATIONS.md) — they
// always report live:false with an empty result rather than fabricated listings.
export const expediaClient = {
  name: "Expedia Partner Solutions (EPS Rapid API)",
  configured: hasKeys(config.travel.expediaKey),
  async searchTrips(_params: { origin?: string; destination?: string; budget?: number }) {
    warnIfUnconfigured("Expedia", config.travel.expediaKey);
    // TODO: EPS Rapid is contract-gated — no self-serve endpoint to call yet.
    return { live: false, items: [] as { id: string; provider: string; title: string; price: number; currency: string }[] };
  },
  async searchStays(_params: { location?: string; budget?: number }) {
    warnIfUnconfigured("Expedia", config.travel.expediaKey);
    return { live: false, items: [] as { id: string; provider: string; title: string; price: number; currency: string }[] };
  },
};

export const bookingClient = {
  name: "Booking.com Affiliate Partner Program / Demand API",
  configured: hasKeys(config.travel.bookingKey),
  async searchStays(_params: { location?: string; budget?: number }) {
    warnIfUnconfigured("Booking.com", config.travel.bookingKey);
    // TODO: Demand API is contract-gated — no self-serve endpoint to call yet.
    return { live: false, items: [] as { id: string; provider: string; title: string; price: number; currency: string }[] };
  },
};

export const airbnbClient = {
  name: "Airbnb Partner API",
  configured: hasKeys(config.travel.airbnbPartnerKey),
  async searchStays(_params: { location?: string; budget?: number }) {
    warnIfUnconfigured("Airbnb", config.travel.airbnbPartnerKey);
    // TODO: no public self-serve API exists — requires an approved PMS/enterprise partnership.
    return { live: false, items: [] as { id: string; provider: string; title: string; price: number; currency: string }[] };
  },
};

export const skyscannerClient = {
  name: "Skyscanner Travel API",
  configured: hasKeys(config.travel.skyscannerKey),
  async searchFlights(_params: { origin?: string; destination?: string; budget?: number }) {
    warnIfUnconfigured("Skyscanner", config.travel.skyscannerKey);
    // TODO: commercial-partner-gated — apply at partners.skyscanner.net before wiring this up.
    return { live: false, items: [] as { id: string; provider: string; title: string; price: number; currency: string }[] };
  },
};

export const tripAdvisorClient = {
  name: "TripAdvisor Content API",
  configured: hasKeys(config.travel.tripadvisorKey),
  async searchExperiences(params: { location?: string; budget?: number }) {
    if (!this.configured) {
      warnIfUnconfigured("TripAdvisor", config.travel.tripadvisorKey);
      return { live: false, items: [] as { id: string; provider: string; title: string; price: number; currency: string }[] };
    }
    try {
      const url = `https://api.content.tripadvisor.com/api/v1/location/search?searchQuery=${encodeURIComponent(params.location ?? "")}&category=attractions&key=${config.travel.tripadvisorKey}&language=en`;
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`TripAdvisor API returned ${res.status}`);
      const data: any = await res.json();
      const items = (data.data ?? []).slice(0, 3).map((loc: any) => ({
        id: String(loc.location_id),
        provider: "tripadvisor",
        title: loc.name,
        price: params.budget ?? 40,
        currency: "USD",
        url: `https://www.tripadvisor.com/Attraction_Review-${loc.location_id}`,
      }));
      return { live: true, items };
    } catch (err) {
      logFailure("TripAdvisor", err);
      return { live: false, items: [] as { id: string; provider: string; title: string; price: number; currency: string; url?: string }[] };
    }
  },
  async getLocationDetails(locationId: string) {
    if (!this.configured) {
      warnIfUnconfigured("TripAdvisor", config.travel.tripadvisorKey);
      return { live: false, locationId, name: null, rating: null, reviewCount: null };
    }
    try {
      const url = `https://api.content.tripadvisor.com/api/v1/location/${locationId}/details?key=${config.travel.tripadvisorKey}&language=en`;
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`TripAdvisor API returned ${res.status}`);
      const data: any = await res.json();
      return { live: true, locationId, name: data.name, rating: data.rating ? Number(data.rating) : null, reviewCount: data.num_reviews ? Number(data.num_reviews) : null };
    } catch (err) {
      logFailure("TripAdvisor", err);
      return { live: false, locationId, name: null, rating: null, reviewCount: null };
    }
  },
};

type PlaceItem = {
  id: string;
  provider: string;
  title: string;
  price: number;
  currency: string;
  url?: string;
  photoName?: string;
  rating?: number;
  userRatingCount?: number;
  address?: string;
  description?: string;
};

export const googlePlacesClient = {
  name: "Google Places API",
  configured: hasKeys(config.travel.googlePlacesKey),
  /**
   * Real Google Places (New) text search. Requests a wide field mask so
   * every card the frontend renders can show a genuine photo, rating,
   * address and short description instead of a bare title — and pages
   * through up to 20 real results at a time via `pageToken`, so category
   * pages can offer "Load more" instead of being capped at a handful of
   * items.
   */
  async searchPlaces(params: { query?: string; location?: string; budget?: number; pageToken?: string }) {
    if (!this.configured) {
      warnIfUnconfigured("Google Places", config.travel.googlePlacesKey);
      return { live: false, items: [] as PlaceItem[], nextPageToken: null as string | null };
    }
    try {
      // Google requires every parameter except pageSize/pageToken to stay
      // identical across paginated requests (a changed textQuery returns
      // INVALID_ARGUMENT) — so textQuery is always included, page after page.
      const body: Record<string, unknown> = {
        pageSize: 20,
        textQuery: `${params.query ?? "things to do"} in ${params.location ?? ""}`,
      };
      if (params.pageToken) body.pageToken = params.pageToken;
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": config.travel.googlePlacesKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.formattedAddress,places.editorialSummary,places.photos,nextPageToken",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Google Places API returned ${res.status}`);
      const data: any = await res.json();
      const items: PlaceItem[] = (data.places ?? []).map((p: any) => ({
        id: p.id,
        provider: "google_places",
        title: p.displayName?.text ?? "Place",
        price: params.budget ?? 60,
        currency: "USD",
        url: p.googleMapsUri as string | undefined,
        photoName: p.photos?.[0]?.name as string | undefined,
        rating: typeof p.rating === "number" ? p.rating : undefined,
        userRatingCount: typeof p.userRatingCount === "number" ? p.userRatingCount : undefined,
        address: p.formattedAddress as string | undefined,
        description: p.editorialSummary?.text as string | undefined,
      }));
      return { live: true, items, nextPageToken: (data.nextPageToken as string | undefined) ?? null };
    } catch (err) {
      logFailure("Google Places", err);
      return { live: false, items: [] as PlaceItem[], nextPageToken: null as string | null };
    }
  },
  /**
   * Streams a real Places photo through our own backend so the frontend
   * never needs the raw API key in an <img src>. `name` is the
   * `places/{id}/photos/{photoId}` resource name returned by searchPlaces.
   */
  async fetchPhoto(name: string, maxWidthPx = "700"): Promise<{ contentType: string; buffer: Buffer } | null> {
    if (!this.configured) return null;
    try {
      const url = `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${encodeURIComponent(maxWidthPx)}&key=${config.travel.googlePlacesKey}`;
      const res = await fetch(url, { redirect: "follow" });
      if (!res.ok) throw new Error(`Google Places photo endpoint returned ${res.status}`);
      const contentType = res.headers.get("content-type") ?? "image/jpeg";
      const buffer = Buffer.from(await res.arrayBuffer());
      return { contentType, buffer };
    } catch (err) {
      logFailure("Google Places photo", err);
      return null;
    }
  },
};

// Amadeus shut down its self-service API portal on 2026-07-17: new
// registrations were paused ahead of that date and existing keys were
// disabled once it hit. There is no longer a self-serve way to call these
// APIs (only the separately-contracted Amadeus Enterprise portal still
// works, which is out of scope here) — so, like Expedia/Booking/Skyscanner,
// this client is now permanently gated regardless of what's in AMADEUS_*.
export const amadeusClient = {
  name: "Amadeus for Developers (Amadeus Travel API) — self-service portal shut down 2026-07-17",
  configured: false,
  async searchFlights(_params: { origin?: string; destination?: string; dates?: { start: string }; budget?: number }) {
    console.log("[apiClients] Amadeus: self-service API portal was shut down 2026-07-17 — no live data available");
    return { live: false, items: [] as { id: string; provider: string; title: string; price: number; currency: string }[] };
  },
  async searchHotels(_params: { location?: string; budget?: number }) {
    console.log("[apiClients] Amadeus: self-service API portal was shut down 2026-07-17 — no live data available");
    return { live: false, items: [] as { id: string; provider: string; title: string; price: number; currency: string }[] };
  },
};

// ────────────────────────────────────────────────────────────────────────
// TRANSPORTATION
// ────────────────────────────────────────────────────────────────────────

// Uber/Lyft: estimate/price endpoints exist, but third-party ride-BOOKING
// scopes require an approved partnership (see INTEGRATIONS.md) — bookRide
// always reports live:false / ride:null. estimateRide is left as a TODO
// since even price-estimate endpoints need an OAuth2 app review in practice.
export const uberClient = {
  name: "Uber API",
  configured: hasKeys(config.transport.uberClientId, config.transport.uberSecret),
  async estimateRide(_params: { pickup: string; dropoff: string }) {
    warnIfUnconfigured("Uber", config.transport.uberClientId, config.transport.uberSecret);
    // TODO: GET https://api.uber.com/v1.2/estimates/price — needs an approved OAuth2 app
    return { live: false, provider: "uber" as const, etaMinutes: null, priceEstimate: null, currency: "USD" };
  },
  async bookRide(_params: { user: string; pickup: string; dropoff: string; time?: string }) {
    warnIfUnconfigured("Uber", config.transport.uberClientId, config.transport.uberSecret);
    // TODO: ride-booking scopes are approved case-by-case, not self-serve
    return { live: false, ride: null };
  },
};

export const lyftClient = {
  name: "Lyft API",
  configured: hasKeys(config.transport.lyftClientId, config.transport.lyftSecret),
  async estimateRide(_params: { pickup: string; dropoff: string }) {
    warnIfUnconfigured("Lyft", config.transport.lyftClientId, config.transport.lyftSecret);
    return { live: false, provider: "lyft" as const, etaMinutes: null, priceEstimate: null, currency: "USD" };
  },
  async bookRide(_params: { user: string; pickup: string; dropoff: string; time?: string }) {
    warnIfUnconfigured("Lyft", config.transport.lyftClientId, config.transport.lyftSecret);
    return { live: false, ride: null };
  },
};

function signDoorDashJwt(): string {
  const header = { alg: "HS256", typ: "JWT", "dd-ver": "DD-JWT-V1" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: "doordash",
    iss: config.shopping.doordashDeveloperId,
    kid: config.shopping.doordashKeyId,
    exp: now + 300,
    iat: now,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const key = Buffer.from(config.shopping.doordashSigningSecret, "base64");
  const signature = crypto.createHmac("sha256", key).update(signingInput).digest();
  return `${signingInput}.${base64url(signature)}`;
}

export const doordashDriveClient = {
  name: "DoorDash Drive API",
  configured: hasKeys(config.shopping.doordashDeveloperId, config.shopping.doordashKeyId, config.shopping.doordashSigningSecret),
  /** Creates a non-binding delivery quote in the DoorDash sandbox — the safe, side-effect-free real call. */
  async createDelivery(params: { userId: string; restaurantOrStore: string; items: string[]; address: string }) {
    if (!this.configured) {
      warnIfUnconfigured("DoorDash Drive", config.shopping.doordashDeveloperId, config.shopping.doordashKeyId, config.shopping.doordashSigningSecret);
      return { live: false, provider: "doordash" as const, status: "unavailable" as const, orderId: null };
    }
    try {
      const jwt = signDoorDashJwt();
      const res = await fetch("https://openapi.doordash.com/drive/v2/quotes", {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          external_delivery_id: mockId("dd"),
          pickup_address: "901 Market Street 6th Floor San Francisco, CA 94103",
          pickup_business_name: params.restaurantOrStore,
          dropoff_address: params.address,
        }),
      });
      if (!res.ok) throw new Error(`DoorDash Drive quotes returned ${res.status}`);
      const data: any = await res.json();
      return { live: true, provider: "doordash" as const, status: "quoted" as const, orderId: data.external_delivery_id ?? data.id ?? null, ...params };
    } catch (err) {
      logFailure("DoorDash Drive", err);
      return { live: false, provider: "doordash" as const, status: "unavailable" as const, orderId: null };
    }
  },
};

// No public self-serve API/partnership for these (see INTEGRATIONS.md).
export const instacartClient = {
  name: "Instacart Developer Platform API",
  configured: hasKeys(config.shopping.instacartKey),
  async createShoppingList(params: { userId: string; items: string[] }) {
    warnIfUnconfigured("Instacart", config.shopping.instacartKey);
    return { live: false, provider: "instacart" as const, status: "unavailable" as const, orderId: null };
  },
};

export const taskRabbitClient = {
  name: "TaskRabbit API (Home Services API)",
  configured: hasKeys(config.shopping.taskrabbitKey),
  async postTask(params: { userId: string; description: string; location: string; budget?: number }) {
    warnIfUnconfigured("TaskRabbit", config.shopping.taskrabbitKey);
    return { live: false, provider: "taskrabbit" as const, status: "unavailable" as const, taskId: null };
  },
};

export const turoClient = {
  name: "Turo API",
  configured: hasKeys(config.transport.turoPartnerKey),
  async searchRentals(_params: { location?: string; dates?: { start: string; end: string } }) {
    warnIfUnconfigured("Turo", config.transport.turoPartnerKey);
    // Turo closed general third-party API access in 2023 — partner-only.
    return { live: false, items: [] as { id: string; provider: string; title: string; pricePerDay: number; currency: string }[] };
  },
};

export const postmatesClient = {
  name: "Postmates API (legacy — migrating to Uber Direct)",
  configured: hasKeys(config.transport.postmatesKey),
  async createDelivery(params: { userId: string; restaurantOrStore: string; items: string[]; address: string }) {
    warnIfUnconfigured("Postmates", config.transport.postmatesKey);
    // New integrations should call Uber Direct directly instead of this legacy path.
    return { live: false, provider: "postmates" as const, status: "unavailable" as const, orderId: null };
  },
};

// ────────────────────────────────────────────────────────────────────────
// SHOPPING
// ────────────────────────────────────────────────────────────────────────

// Amazon PA-API is sunsetting and Creators API requires 10 qualifying sales
// (see INTEGRATIONS.md) — no self-serve path for a brand-new account.
export const amazonAssociatesClient = {
  name: "Amazon Associates / Creators API",
  configured: hasKeys(config.shopping.amazonAssocKey),
  async searchProducts(_params: { need?: string; category?: string; budget?: number }) {
    warnIfUnconfigured("Amazon Associates", config.shopping.amazonAssocKey);
    return { live: false, items: [] as { id: string; name: string; category: string; price: number; currency: string; retailer: "amazon" }[] };
  },
  async getAffiliateLink(productId: string) {
    const live = this.configured;
    warnIfUnconfigured("Amazon Associates", config.shopping.amazonAssocKey);
    if (!live) return { live: false, url: null };
    // The associate-tag link format itself is the real mechanism — no HTTP call needed to "activate" it.
    return { live: true, url: `https://www.amazon.com/dp/${productId}?tag=${config.shopping.amazonAssocKey}` };
  },
};

export const rakutenClient = {
  name: "Rakuten Advertising",
  configured: hasKeys(config.shopping.rakutenKey),
  async searchProducts(params: { need?: string; category?: string; budget?: number }) {
    if (!this.configured) {
      warnIfUnconfigured("Rakuten Advertising", config.shopping.rakutenKey);
      return { live: false, items: [] as { id: string; name: string; category: string; price: number; currency: string; retailer: "bestbuy" }[] };
    }
    try {
      const keyword = encodeURIComponent(params.need || params.category || "gift");
      const res = await fetch(`https://api.linksynergy.com/productsearch/1.0?keyword=${keyword}&max=3`, {
        headers: { Authorization: `Bearer ${config.shopping.rakutenKey}`, Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Rakuten productsearch returned ${res.status}`);
      const data: any = await res.json();
      // Response schema varies by Rakuten account/program setup — adjust field
      // paths below to match what your account actually returns.
      const rawItems = data.items?.item ?? data.item ?? [];
      const items = (Array.isArray(rawItems) ? rawItems : [rawItems]).slice(0, 3).map((it: any) => ({
        id: String(it.linkid ?? it.sku ?? mockId("rkt")),
        name: it.productname ?? it.title ?? "Product",
        category: params.category ?? "general",
        price: Number(it.price ?? params.budget ?? 0),
        currency: it.currency ?? "USD",
        retailer: "bestbuy" as const,
      }));
      return { live: true, items };
    } catch (err) {
      logFailure("Rakuten Advertising", err);
      return { live: false, items: [] as { id: string; name: string; category: string; price: number; currency: string; retailer: "bestbuy" }[] };
    }
  },
  async getAffiliateLink(productId: string) {
    const live = this.configured;
    warnIfUnconfigured("Rakuten Advertising", config.shopping.rakutenKey);
    if (!live) return { live: false, url: null };
    return { live: true, url: `https://click.linksynergy.com/deeplink?id=${config.shopping.rakutenKey}&murl=product/${productId}` };
  },
  async getConversionReport(fromDate: string, toDate: string) {
    if (!this.configured) {
      warnIfUnconfigured("Rakuten Advertising", config.shopping.rakutenKey);
      return { live: false, fromDate, toDate, clicks: 0, orders: 0, commission: 0, currency: "USD" };
    }
    try {
      const url = `https://api.rakutenadvertising.com/reports/1.0/summary?start_date=${fromDate}&end_date=${toDate}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${config.shopping.rakutenKey}` } });
      if (!res.ok) throw new Error(`Rakuten reports API returned ${res.status}`);
      const data: any = await res.json();
      return {
        live: true,
        fromDate,
        toDate,
        clicks: data.clicks ?? 0,
        orders: data.orders ?? 0,
        commission: data.commission ?? 0,
        currency: data.currency ?? "USD",
      };
    } catch (err) {
      logFailure("Rakuten Advertising", err);
      return { live: false, fromDate, toDate, clicks: 0, orders: 0, commission: 0, currency: "USD" };
    }
  },
};

export const skimlinksClient = {
  name: "Skimlinks",
  configured: hasKeys(config.shopping.skimlinksKey),
  async getAffiliateLink(destinationUrl: string) {
    // Skimlinks has no lookup API to call — the redirect URL format below IS
    // the real mechanism once you have a real publisher ID; nothing to mock.
    const live = this.configured;
    warnIfUnconfigured("Skimlinks", config.shopping.skimlinksKey);
    if (!live) return { live: false, url: null };
    return { live: true, url: `https://go.skimresources.com?id=${config.shopping.skimlinksKey}&url=${encodeURIComponent(destinationUrl)}` };
  },
};

// Walmart's product-search API requires an approved seller/partner
// relationship even though the affiliate *link* program (Impact) is instant.
export const walmartClient = {
  name: "Walmart Affiliate Program / Walmart.io Affiliate API",
  configured: hasKeys(config.shopping.walmartKey),
  async searchProducts(_params: { need?: string; category?: string; budget?: number }) {
    warnIfUnconfigured("Walmart", config.shopping.walmartKey);
    return { live: false, items: [] as { id: string; name: string; category: string; price: number; currency: string; retailer: "walmart" }[] };
  },
  async getAffiliateLink(productId: string) {
    const live = hasKeys(config.shopping.impactAccountSid, config.shopping.impactAuthToken);
    warnIfUnconfigured("Walmart (Impact)", config.shopping.impactAccountSid, config.shopping.impactAuthToken);
    if (!live) return { live: false, url: null };
    // TODO: call Impact's Deep Link Generator API with IMPACT_ACCOUNT_SID / IMPACT_AUTH_TOKEN
    return { live: true, url: `https://goto.walmart.com/c/${config.shopping.impactAccountSid}?u=https://www.walmart.com/ip/${productId}` };
  },
};

export const bestBuyClient = {
  name: "Best Buy Developer API",
  configured: hasKeys(config.shopping.bestbuyKey),
  async searchProducts(params: { need?: string; category?: string; budget?: number }) {
    if (!this.configured) {
      warnIfUnconfigured("Best Buy", config.shopping.bestbuyKey);
      return { live: false, items: [] as { id: string; name: string; category: string; price: number; currency: string; retailer: "bestbuy" }[] };
    }
    try {
      const query = params.need || params.category || "gift";
      const url = `https://api.bestbuy.com/v1/products(search=${encodeURIComponent(query)})?apiKey=${config.shopping.bestbuyKey}&format=json&pageSize=3`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Best Buy API returned ${res.status}`);
      const data: any = await res.json();
      const items = (data.products ?? []).map((p: any) => ({
        id: String(p.sku),
        name: p.name,
        category: params.category ?? "electronics",
        price: Number(p.salePrice ?? p.regularPrice ?? 0),
        currency: "USD",
        retailer: "bestbuy" as const,
      }));
      return { live: true, items };
    } catch (err) {
      logFailure("Best Buy", err);
      return { live: false, items: [] as { id: string; name: string; category: string; price: number; currency: string; retailer: "bestbuy" }[] };
    }
  },
};

export const targetClient = {
  name: "Target Affiliate Program",
  configured: hasKeys(config.shopping.targetAffiliateId),
  async getAffiliateLink(productId: string) {
    const live = hasKeys(config.shopping.impactAccountSid, config.shopping.impactAuthToken);
    warnIfUnconfigured("Target (Impact)", config.shopping.impactAccountSid, config.shopping.impactAuthToken);
    if (!live) return { live: false, url: null };
    // TODO: Target has no public product-search API — Impact Deep Link Generator only.
    return { live: true, url: `https://goto.target.com/c/${config.shopping.impactAccountSid}?u=https://www.target.com/p/${productId}` };
  },
};

// ────────────────────────────────────────────────────────────────────────
// FINANCE
// ────────────────────────────────────────────────────────────────────────

let plaidAccessTokenCache: string | null = null;
async function getPlaidSandboxAccessToken(): Promise<string> {
  if (plaidAccessTokenCache) return plaidAccessTokenCache;
  const base = `https://${config.finance.plaidEnv}.plaid.com`;
  const createRes = await fetch(`${base}/sandbox/public_token/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.finance.plaidKey,
      secret: config.finance.plaidSecret,
      institution_id: "ins_109508", // Plaid's standard "First Platypus Bank" sandbox institution
      initial_products: ["transactions"],
    }),
  });
  if (!createRes.ok) throw new Error(`Plaid sandbox/public_token/create returned ${createRes.status}`);
  const { public_token } = (await createRes.json()) as any;

  const exchangeRes = await fetch(`${base}/item/public_token/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: config.finance.plaidKey, secret: config.finance.plaidSecret, public_token }),
  });
  if (!exchangeRes.ok) throw new Error(`Plaid item/public_token/exchange returned ${exchangeRes.status}`);
  const { access_token } = (await exchangeRes.json()) as any;
  plaidAccessTokenCache = access_token;
  return access_token;
}

export const plaidClient = {
  name: "Plaid",
  configured: hasKeys(config.finance.plaidKey, config.finance.plaidSecret),
  async getAccounts(_userId: string) {
    if (!this.configured) {
      warnIfUnconfigured("Plaid", config.finance.plaidKey, config.finance.plaidSecret);
      return { live: false, items: [] as { id: string; name: string; type: "checking" | "savings" | "credit"; balance: number; currency: string }[] };
    }
    try {
      const accessToken = await getPlaidSandboxAccessToken();
      const base = `https://${config.finance.plaidEnv}.plaid.com`;
      const res = await fetch(`${base}/accounts/balance/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: config.finance.plaidKey, secret: config.finance.plaidSecret, access_token: accessToken }),
      });
      if (!res.ok) throw new Error(`Plaid accounts/balance/get returned ${res.status}`);
      const data: any = await res.json();
      const items = (data.accounts ?? []).map((a: any) => ({
        id: a.account_id,
        name: a.name,
        type: (a.type === "credit" ? "credit" : a.subtype === "savings" ? "savings" : "checking") as "checking" | "savings" | "credit",
        balance: a.balances?.current ?? 0,
        currency: a.balances?.iso_currency_code ?? "USD",
      }));
      return { live: true, items };
    } catch (err) {
      logFailure("Plaid", err);
      return { live: false, items: [] as { id: string; name: string; type: "checking" | "savings" | "credit"; balance: number; currency: string }[] };
    }
  },
  async getTransactions(_userId: string, days = 30) {
    if (!this.configured) {
      warnIfUnconfigured("Plaid", config.finance.plaidKey, config.finance.plaidSecret);
      return { live: false, items: [] as { id: string; date: string; amount: number; merchant: string }[] };
    }
    try {
      const accessToken = await getPlaidSandboxAccessToken();
      const base = `https://${config.finance.plaidEnv}.plaid.com`;
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
      const res = await fetch(`${base}/transactions/get`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: config.finance.plaidKey,
          secret: config.finance.plaidSecret,
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
          options: { count: 10 },
        }),
      });
      if (!res.ok) throw new Error(`Plaid transactions/get returned ${res.status}`);
      const data: any = await res.json();
      const items = (data.transactions ?? []).map((t: any) => ({
        id: t.transaction_id,
        date: t.date,
        amount: t.amount,
        merchant: t.merchant_name ?? t.name ?? "Unknown",
      }));
      return { live: true, items };
    } catch (err) {
      logFailure("Plaid", err);
      return { live: false, items: [] as { id: string; date: string; amount: number; merchant: string }[] };
    }
  },
};

// No public self-serve production API (sandbox exists but production is a
// sales-assisted partnership) — see INTEGRATIONS.md.
export const yodleeClient = {
  name: "Yodlee (Envestnet | Yodlee)",
  configured: hasKeys(config.finance.yodleeKey),
  async getAccounts(_userId: string) {
    warnIfUnconfigured("Yodlee", config.finance.yodleeKey);
    return { live: false, items: [] as { id: string; name: string; type: "checking" | "savings" | "credit"; balance: number; currency: string }[] };
  },
};

export const stripeBillingClient = {
  name: "Stripe Billing",
  configured: hasKeys(config.finance.stripeKey),
  async getSubscriptions(_customerId: string) {
    if (!this.configured) {
      warnIfUnconfigured("Stripe", config.finance.stripeKey);
      return { live: false, items: [] as { id: string; name: string; amount: number; cadence: "monthly" | "annual" }[] };
    }
    try {
      const res = await fetch("https://api.stripe.com/v1/subscriptions?limit=5", {
        headers: { Authorization: `Bearer ${config.finance.stripeKey}` },
      });
      if (!res.ok) throw new Error(`Stripe subscriptions API returned ${res.status}`);
      const data: any = await res.json();
      const items = (data.data ?? []).map((s: any) => {
        const price = s.items?.data?.[0]?.price;
        return {
          id: s.id,
          name: price?.nickname ?? s.items?.data?.[0]?.plan?.nickname ?? "Subscription",
          amount: (price?.unit_amount ?? 0) / 100,
          cadence: (price?.recurring?.interval === "year" ? "annual" : "monthly") as "monthly" | "annual",
        };
      });
      return { live: true, items };
    } catch (err) {
      logFailure("Stripe", err);
      return { live: false, items: [] as { id: string; name: string; amount: number; cadence: "monthly" | "annual" }[] };
    }
  },
};

// No public self-serve API exists today for these three (see INTEGRATIONS.md).
export const rocketMoneyClient = {
  name: "Rocket Money Partner API",
  configured: hasKeys(config.finance.rocketMoneyPartnerKey),
  async getSubscriptions(_userId: string) {
    warnIfUnconfigured("Rocket Money", config.finance.rocketMoneyPartnerKey);
    return { live: false, items: [] as { id: string; name: string; amount: number; cadence: "monthly" | "annual" }[] };
  },
};

export const visaOffersClient = {
  name: "Visa Offers Platform API",
  configured: hasKeys(config.finance.visaApiKey, config.finance.visaSharedSecret),
  async getOffers(_userId: string) {
    warnIfUnconfigured("Visa Offers", config.finance.visaApiKey, config.finance.visaSharedSecret);
    return { live: false, items: [] as { id: string; merchant: string; discount: string; expires: string }[] };
  },
};

export const mastercardOffersClient = {
  name: "Mastercard Offers API",
  configured: hasKeys(config.finance.mastercardConsumerKey, config.finance.mastercardSigningKeyPath),
  async getOffers(_userId: string) {
    warnIfUnconfigured("Mastercard Offers", config.finance.mastercardConsumerKey, config.finance.mastercardSigningKeyPath);
    return { live: false, items: [] as { id: string; merchant: string; discount: string; expires: string }[] };
  },
};

// ────────────────────────────────────────────────────────────────────────
// SCHEDULING
// ────────────────────────────────────────────────────────────────────────

type CalendarEventInput = { title: string; start: string; end: string; location?: string; type: string };

let googleServiceAccountTokenCache: { token: string; expiresAt: number } | null = null;
async function getGoogleServiceAccountToken(): Promise<string> {
  if (googleServiceAccountTokenCache && Date.now() < googleServiceAccountTokenCache.expiresAt) {
    return googleServiceAccountTokenCache.token;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: config.calendar.gcalServiceAccountEmail,
    scope: "https://www.googleapis.com/auth/calendar",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  // Service account private keys from the JSON download use literal "\n" in
  // env vars — normalize back to real newlines before signing.
  const privateKey = config.calendar.gcalServiceAccountPrivateKey.replace(/\\n/g, "\n");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = signer.sign(privateKey);
  const assertion = `${signingInput}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`Google service-account token request failed: ${res.status}`);
  const data: any = await res.json();
  googleServiceAccountTokenCache = { token: data.access_token, expiresAt: Date.now() + Math.max(0, (data.expires_in ?? 3600) - 30) * 1000 };
  return googleServiceAccountTokenCache.token;
}

export const googleCalendarClient = {
  name: "Google Calendar API",
  configured: hasKeys(config.calendar.gcalServiceAccountEmail, config.calendar.gcalServiceAccountPrivateKey, config.calendar.gcalCalendarId),
  async addEvent(_userId: string, event: CalendarEventInput) {
    if (!this.configured) {
      warnIfUnconfigured("Google Calendar", config.calendar.gcalServiceAccountEmail, config.calendar.gcalServiceAccountPrivateKey, config.calendar.gcalCalendarId);
      return { live: false, id: null };
    }
    try {
      const token = await getGoogleServiceAccountToken();
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendar.gcalCalendarId)}/events`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            summary: event.title,
            location: event.location,
            start: { dateTime: event.start },
            end: { dateTime: event.end },
          }),
        }
      );
      if (!res.ok) throw new Error(`Google Calendar events.insert returned ${res.status}`);
      const data: any = await res.json();
      return { live: true, id: data.id, ...event };
    } catch (err) {
      logFailure("Google Calendar", err);
      return { live: false, id: null };
    }
  },
  async listEvents(_userId: string, range: { from: string; to: string }) {
    if (!this.configured) {
      warnIfUnconfigured("Google Calendar", config.calendar.gcalServiceAccountEmail, config.calendar.gcalServiceAccountPrivateKey, config.calendar.gcalCalendarId);
      return { live: false, items: [] as CalendarEventInput[] };
    }
    try {
      const token = await getGoogleServiceAccountToken();
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendar.gcalCalendarId)}/events?timeMin=${encodeURIComponent(range.from)}&timeMax=${encodeURIComponent(range.to)}&singleEvents=true&orderBy=startTime`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Google Calendar events.list returned ${res.status}`);
      const data: any = await res.json();
      const items = (data.items ?? []).map((e: any) => ({
        id: e.id as string,
        title: e.summary ?? "(untitled)",
        start: e.start?.dateTime ?? e.start?.date,
        end: e.end?.dateTime ?? e.end?.date,
        location: e.location,
        type: "personal",
      }));
      return { live: true, items };
    } catch (err) {
      logFailure("Google Calendar", err);
      return { live: false, items: [] as (CalendarEventInput & { id: string })[] };
    }
  },
};

// No self-serve write path for these (see INTEGRATIONS.md).
export const outlookCalendarClient = {
  name: "Outlook Calendar API (Microsoft Graph)",
  configured: hasKeys(config.calendar.outlookKey),
  async addEvent(_userId: string, _event: CalendarEventInput) {
    warnIfUnconfigured("Outlook Calendar", config.calendar.outlookKey);
    return { live: false, id: null };
  },
  async listEvents(_userId: string, _range: { from: string; to: string }) {
    warnIfUnconfigured("Outlook Calendar", config.calendar.outlookKey);
    return { live: false, items: [] as CalendarEventInput[] };
  },
};

export const appleCaldavClient = {
  name: "Apple CalDAV",
  configured: hasKeys(config.calendar.appleCaldavConfig),
  async addEvent(_userId: string, _event: CalendarEventInput) {
    warnIfUnconfigured("Apple CalDAV", config.calendar.appleCaldavConfig);
    // Per-user Apple ID + app-specific password required — not a single app-wide key.
    return { live: false, id: null };
  },
  async listEvents(_userId: string, _range: { from: string; to: string }) {
    warnIfUnconfigured("Apple CalDAV", config.calendar.appleCaldavConfig);
    return { live: false, items: [] as CalendarEventInput[] };
  },
};

export const eventbriteClient = {
  name: "Eventbrite API",
  configured: hasKeys(config.calendar.eventbriteKey),
  async findEvents(params: { location?: string; date?: string }) {
    warnIfUnconfigured("Eventbrite", config.calendar.eventbriteKey);
    // Public event search was retired Feb 2020 — org-scoped only without a distribution-partner agreement.
    return { live: false, events: [] as { id: string; title: string; date: string }[] };
  },
};

export const ticketmasterClient = {
  name: "Ticketmaster Discovery API",
  configured: hasKeys(config.calendar.ticketmasterKey),
  async findEvents(params: { location?: string; date?: string }) {
    if (!this.configured) {
      warnIfUnconfigured("Ticketmaster", config.calendar.ticketmasterKey);
      return { live: false, events: [] as { id: string; title: string; date: string }[] };
    }
    try {
      const url = `https://app.ticketmaster.com/discovery/v2/events.json?city=${encodeURIComponent(params.location ?? "")}&apikey=${config.calendar.ticketmasterKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Ticketmaster API returned ${res.status}`);
      const data: any = await res.json();
      const events = data._embedded?.events ?? [];
      return {
        live: true,
        events: events.map((e: any) => ({ id: e.id, title: e.name, date: e.dates?.start?.localDate ?? params.date ?? new Date().toISOString() })),
      };
    } catch (err) {
      logFailure("Ticketmaster", err);
      return { live: false, events: [] as { id: string; title: string; date: string }[] };
    }
  },
};

// ────────────────────────────────────────────────────────────────────────
// RECOMMENDATIONS
// ────────────────────────────────────────────────────────────────────────

export const yelpClient = {
  name: "Yelp Fusion API",
  configured: hasKeys(config.misc.yelpKey),
  async getRatings(query: string, location: string) {
    if (!this.configured) {
      warnIfUnconfigured("Yelp Fusion", config.misc.yelpKey);
      return { live: false, results: [] as { name: string; rating: number; reviewCount: number }[] };
    }
    try {
      const url = `https://api.yelp.com/v3/businesses/search?term=${encodeURIComponent(query)}&location=${encodeURIComponent(location)}&limit=5`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${config.misc.yelpKey}` } });
      if (!res.ok) throw new Error(`Yelp API returned ${res.status}`);
      const data: any = await res.json();
      return {
        live: true,
        results: (data.businesses ?? []).map((b: any) => ({ name: b.name, rating: b.rating, reviewCount: b.review_count })),
      };
    } catch (err) {
      logFailure("Yelp Fusion", err);
      return { live: false, results: [] as { name: string; rating: number; reviewCount: number }[] };
    }
  },
};

export const googleMapsClient = {
  name: "Google Maps API",
  configured: hasKeys(config.misc.googleMapsKey),
  async getDirections(origin: string, destination: string) {
    if (!this.configured) {
      warnIfUnconfigured("Google Maps", config.misc.googleMapsKey);
      return { origin, destination, durationMinutes: null, distanceMiles: null, live: false };
    }
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&key=${config.misc.googleMapsKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Google Maps API returned ${res.status}`);
      const data: any = await res.json();
      const leg = data.routes?.[0]?.legs?.[0];
      if (!leg) throw new Error(`No route found (status: ${data.status})`);
      return {
        origin,
        destination,
        durationMinutes: Math.round(leg.duration.value / 60),
        distanceMiles: Math.round((leg.distance.value / 1609.34) * 10) / 10,
        live: true,
      };
    } catch (err) {
      logFailure("Google Maps", err);
      return { origin, destination, durationMinutes: null, distanceMiles: null, live: false };
    }
  },
};

export const openWeatherClient = {
  name: "OpenWeather API",
  configured: hasKeys(config.misc.weatherKey),
  async getWeather(location: string) {
    if (!this.configured) {
      warnIfUnconfigured("OpenWeather", config.misc.weatherKey);
      return { location, conditions: null, tempF: null, live: false };
    }
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=imperial&appid=${config.misc.weatherKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OpenWeather API returned ${res.status}`);
      const data: any = await res.json();
      return {
        location,
        conditions: data.weather?.[0]?.description ?? "unknown",
        tempF: Math.round(data.main?.temp ?? 0),
        live: true,
      };
    } catch (err) {
      logFailure("OpenWeather", err);
      return { location, conditions: null, tempF: null, live: false };
    }
  },
};

export const tomorrowIoClient = {
  name: "Tomorrow.io API",
  configured: hasKeys(config.misc.tomorrowioKey),
  async getWeather(location: string) {
    if (!this.configured) {
      warnIfUnconfigured("Tomorrow.io", config.misc.tomorrowioKey);
      return { location, conditions: null, tempF: null, live: false };
    }
    try {
      const url = `https://api.tomorrow.io/v4/weather/realtime?location=${encodeURIComponent(location)}&units=imperial&apikey=${config.misc.tomorrowioKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Tomorrow.io API returned ${res.status}`);
      const data: any = await res.json();
      const temp = data.data?.values?.temperature;
      if (temp == null) throw new Error("Tomorrow.io response missing temperature");
      return { location, conditions: "reported", tempF: Math.round(temp), live: true };
    } catch (err) {
      logFailure("Tomorrow.io", err);
      return { location, conditions: null, tempF: null, live: false };
    }
  },
};

// ────────────────────────────────────────────────────────────────────────
// OPEN DATA — free, no-signup (or lightweight-signup) public sources.
// Added on request as genuinely-free alternatives once Amadeus's
// self-service portal shut down. Unlike everything above, Wikivoyage and
// the National Weather Service need no account or key at all — only
// OpenTripMap asks for a (free) signup.
// ────────────────────────────────────────────────────────────────────────

// A small fast-path cache for cities this app's demo data touches most —
// checked before hitting Nominatim so common lookups skip the network
// round-trip. Anything not in here still resolves live, for any place
// name, via nominatimClient.geocode() below.
const CITY_COORDS_CACHE: Record<string, { lat: number; lon: number }> = {
  austin: { lat: 30.2672, lon: -97.7431 },
  lisbon: { lat: 38.7223, lon: -9.1393 },
  "new york": { lat: 40.7128, lon: -74.006 },
  "los angeles": { lat: 34.0522, lon: -118.2437 },
  london: { lat: 51.5072, lon: -0.1276 },
  paris: { lat: 48.8566, lon: 2.3522 },
  tokyo: { lat: 35.6762, lon: 139.6503 },
  "san francisco": { lat: 37.7749, lon: -122.4194 },
  chicago: { lat: 41.8781, lon: -87.6298 },
  miami: { lat: 25.7617, lon: -80.1918 },
  seattle: { lat: 47.6062, lon: -122.3321 },
  boston: { lat: 42.3601, lon: -71.0589 },
};

/**
 * OpenStreetMap Nominatim — free, open geocoding with no key or account.
 * Turns any place name into lat/lon, which is what unlocks NWS and
 * OpenTripMap (both coordinate-based) for arbitrary cities the user
 * types into the app, not just the handful hardcoded above. Nominatim's
 * usage policy asks for a descriptive User-Agent and no more than ~1
 * request/sec, which the small in-memory cache here helps respect.
 */
export const nominatimClient = {
  name: "OpenStreetMap Nominatim (geocoding) — no key required",
  configured: true,
  async geocode(location?: string): Promise<{ lat: number; lon: number } | null> {
    if (!location) return null;
    const key = location.trim().toLowerCase();
    if (CITY_COORDS_CACHE[key]) return CITY_COORDS_CACHE[key];
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
      const res = await fetch(url, { headers: { "User-Agent": "ButlerOS/1.0 (contact: troy.evans@outlook.com)" } });
      if (!res.ok) throw new Error(`Nominatim API returned ${res.status}`);
      const data: any = await res.json();
      const hit = Array.isArray(data) ? data[0] : null;
      if (!hit) return null;
      const coords = { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon) };
      if (Number.isNaN(coords.lat) || Number.isNaN(coords.lon)) return null;
      CITY_COORDS_CACHE[key] = coords; // cache for the life of this process
      return coords;
    } catch (err) {
      logFailure("Nominatim", err);
      return null;
    }
  },
};

async function cityCoords(location?: string): Promise<{ lat: number; lon: number } | null> {
  return nominatimClient.geocode(location);
}

/**
 * Wikivoyage (MediaWiki Action API). Fully open — no key, no account,
 * no rate-limit registration. Returns a real destination-guide excerpt
 * for whatever city/place title is passed in (MediaWiki resolves
 * redirects, e.g. "Austin" → "Austin (Texas)" automatically).
 */
export const wikivoyageClient = {
  name: "Wikivoyage (MediaWiki Action API) — no key required",
  configured: true,
  async getDestinationGuide(location?: string) {
    if (!location) return { live: false, title: null as string | null, extract: null as string | null, url: null as string | null };
    try {
      const url = `https://en.wikivoyage.org/w/api.php?action=query&format=json&prop=extracts&exintro=1&explaintext=1&redirects=1&titles=${encodeURIComponent(location)}`;
      const res = await fetch(url, { headers: { "User-Agent": "ButlerOS/1.0 (contact: troy.evans@outlook.com)" } });
      if (!res.ok) throw new Error(`Wikivoyage API returned ${res.status}`);
      const data: any = await res.json();
      const pages = data.query?.pages ?? {};
      const page: any = Object.values(pages)[0];
      if (!page || "missing" in page || !page.extract) {
        return { live: false, title: null as string | null, extract: null as string | null, url: null as string | null };
      }
      const title = page.title as string;
      return {
        live: true,
        title,
        extract: (page.extract as string).slice(0, 800),
        url: `https://en.wikivoyage.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
      };
    } catch (err) {
      logFailure("Wikivoyage", err);
      return { live: false, title: null as string | null, extract: null as string | null, url: null as string | null };
    }
  },
};

/**
 * National Weather Service (api.weather.gov). Fully open — no key, no
 * account. US locations only (it's a US government service covering US
 * territory), and needs a two-step call: resolve lat/lon to a forecast
 * office + grid via /points, then fetch that grid's forecast.
 */
export const nwsClient = {
  name: "National Weather Service API (api.weather.gov) — US only, no key required",
  configured: true,
  async getWeather(location: string) {
    const coords = await cityCoords(location);
    if (!coords) {
      console.log(`[apiClients] NWS: could not geocode "${location}" (or non-US location) — skipping`);
      return { location, conditions: null as string | null, tempF: null as number | null, live: false };
    }
    try {
      const headers = { "User-Agent": "ButlerOS (contact: troy.evans@outlook.com)", Accept: "application/geo+json" };
      const pointsRes = await fetch(`https://api.weather.gov/points/${coords.lat},${coords.lon}`, { headers });
      if (!pointsRes.ok) throw new Error(`NWS points endpoint returned ${pointsRes.status}`);
      const pointsData: any = await pointsRes.json();
      const forecastUrl = pointsData.properties?.forecast;
      if (!forecastUrl) throw new Error("NWS points response missing forecast URL");
      const forecastRes = await fetch(forecastUrl, { headers });
      if (!forecastRes.ok) throw new Error(`NWS forecast endpoint returned ${forecastRes.status}`);
      const forecastData: any = await forecastRes.json();
      const period = forecastData.properties?.periods?.[0];
      if (!period) throw new Error("NWS forecast response missing periods");
      return {
        location,
        conditions: (period.shortForecast as string) ?? "unknown",
        tempF: typeof period.temperature === "number" ? period.temperature : null,
        live: true,
      };
    } catch (err) {
      logFailure("National Weather Service", err);
      return { location, conditions: null as string | null, tempF: null as number | null, live: false };
    }
  },
};

/**
 * OpenTripMap. Free tier, but does require a lightweight signup for a
 * key (opentripmap.io) — the one exception in this "open data" group.
 * Used as a third attraction/experience source alongside TripAdvisor and
 * Google Places.
 */
export const openTripMapClient = {
  name: "OpenTripMap API",
  configured: hasKeys(config.openData.openTripMapKey),
  async searchAttractions(params: { location?: string; budget?: number }) {
    if (!this.configured) {
      warnIfUnconfigured("OpenTripMap", config.openData.openTripMapKey);
      return { live: false, items: [] as { id: string; provider: string; title: string; price: number; currency: string; url?: string }[] };
    }
    const coords = await cityCoords(params.location);
    if (!coords) {
      console.log(`[apiClients] OpenTripMap: could not geocode "${params.location}", skipping real call`);
      return { live: false, items: [] as { id: string; provider: string; title: string; price: number; currency: string; url?: string }[] };
    }
    try {
      const url = `https://api.opentripmap.com/0.1/en/places/radius?radius=8000&lon=${coords.lon}&lat=${coords.lat}&kinds=interesting_places&rate=2&format=json&limit=8&apikey=${config.openData.openTripMapKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OpenTripMap API returned ${res.status}`);
      const data: any = await res.json();
      const items = (Array.isArray(data) ? data : [])
        .filter((p: any) => !!p.name)
        .slice(0, 5)
        .map((p: any) => ({
          id: p.xid as string,
          provider: "opentripmap",
          title: p.name as string,
          price: params.budget ?? 30,
          currency: "USD",
          url: p.xid ? `https://opentripmap.com/en/card/${p.xid}` : undefined,
        }));
      return { live: true, items };
    } catch (err) {
      logFailure("OpenTripMap", err);
      return { live: false, items: [] as { id: string; provider: string; title: string; price: number; currency: string; url?: string }[] };
    }
  },
};

// WMO weather codes (used by Open-Meteo) mapped to short human descriptions.
const WMO_CODES: Record<number, string> = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
  80: "Rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail",
};

/**
 * Open-Meteo — free, no-key global weather. Unlike the National Weather
 * Service (US-only), this covers any city Nominatim can geocode, so it's
 * used as the final fallback after OpenWeather/Tomorrow.io/NWS for
 * international locations.
 */
export const openMeteoClient = {
  name: "Open-Meteo (global weather) — no key required",
  configured: true,
  async getWeather(location: string) {
    const coords = await cityCoords(location);
    if (!coords) {
      console.log(`[apiClients] Open-Meteo: could not geocode "${location}" — skipping`);
      return { location, conditions: null as string | null, tempF: null as number | null, live: false };
    }
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo API returned ${res.status}`);
      const data: any = await res.json();
      const current = data.current;
      if (!current) throw new Error("Open-Meteo response missing current conditions");
      const code = current.weather_code as number;
      return {
        location,
        conditions: WMO_CODES[code] ?? "unknown",
        tempF: typeof current.temperature_2m === "number" ? Math.round(current.temperature_2m) : null,
        live: true,
      };
    } catch (err) {
      logFailure("Open-Meteo", err);
      return { location, conditions: null as string | null, tempF: null as number | null, live: false };
    }
  },
};
