import * as clients from "./apiClients";

/**
 * integrationRegistry.ts
 * ───────────────────────
 * A single lookup table mapping service names -> the client objects
 * exported by apiClients.ts, grouped by the category the orchestrator
 * plans against (travel/transport/shopping/finance/scheduling/recommendations).
 *
 * This is what lets `ai/orchestrator.ts` call integrations *dynamically* —
 * given a plan that says "use expedia and amadeus for travel," it can loop
 * over `integrationRegistry.travel` instead of hardcoding a call per client.
 */

export const integrationRegistry = {
  travel: {
    expedia: clients.expediaClient,
    booking: clients.bookingClient,
    tripadvisor: clients.tripAdvisorClient,
    airbnb: clients.airbnbClient,
    googlePlaces: clients.googlePlacesClient,
    skyscanner: clients.skyscannerClient,
    amadeus: clients.amadeusClient,
    wikivoyage: clients.wikivoyageClient,
    openTripMap: clients.openTripMapClient,
  },
  transportation: {
    uber: clients.uberClient,
    lyft: clients.lyftClient,
    doordashDrive: clients.doordashDriveClient,
    instacart: clients.instacartClient,
    taskrabbit: clients.taskRabbitClient,
    turo: clients.turoClient,
    postmates: clients.postmatesClient,
  },
  shopping: {
    amazon: clients.amazonAssociatesClient,
    rakuten: clients.rakutenClient,
    skimlinks: clients.skimlinksClient,
    walmart: clients.walmartClient,
    bestbuy: clients.bestBuyClient,
    target: clients.targetClient,
  },
  finance: {
    plaid: clients.plaidClient,
    yodlee: clients.yodleeClient,
    stripe: clients.stripeBillingClient,
    rocketMoney: clients.rocketMoneyClient,
    visaOffers: clients.visaOffersClient,
    mastercardOffers: clients.mastercardOffersClient,
  },
  scheduling: {
    googleCalendar: clients.googleCalendarClient,
    outlookCalendar: clients.outlookCalendarClient,
    appleCaldav: clients.appleCaldavClient,
    eventbrite: clients.eventbriteClient,
    ticketmaster: clients.ticketmasterClient,
    seatGeek: clients.seatGeekClient,
  },
  recommendations: {
    yelp: clients.yelpClient,
    googleMaps: clients.googleMapsClient,
    openWeather: clients.openWeatherClient,
    tomorrowIo: clients.tomorrowIoClient,
    nationalWeatherService: clients.nwsClient,
    openMeteo: clients.openMeteoClient,
  },
} as const;

export type IntegrationCategory = keyof typeof integrationRegistry;

/**
 * Different travel providers expose different method names for the same
 * underlying capability (a flight search is `searchTrips` on Expedia but
 * `searchFlights` on Amadeus/Skyscanner). This map lets the orchestrator
 * ask for a *capability* ("flights", "stays", "experiences") and resolve
 * it to the right method per provider, instead of hardcoding per-provider
 * branches.
 */
export const travelCapabilityMethods: Record<string, { flights?: string; stays?: string; experiences?: string }> = {
  expedia: { flights: "searchTrips", stays: "searchStays" },
  booking: { stays: "searchStays" },
  tripadvisor: { experiences: "searchExperiences" },
  airbnb: { stays: "searchStays" },
  googlePlaces: { experiences: "searchPlaces" },
  skyscanner: { flights: "searchFlights" },
  amadeus: { flights: "searchFlights", stays: "searchHotels" },
  openTripMap: { experiences: "searchAttractions" },
};

/** Shopping providers that support catalog search (vs. link-generation-only providers like Skimlinks/Target). */
export const shoppingSearchProviders = ["amazon", "rakuten", "walmart", "bestbuy"] as const;

/** Default provider set per travel capability, used when a ButlerPlan doesn't specify `providers`. */
export const defaultTravelProviders = {
  flights: ["expedia", "amadeus"],
  stays: ["booking", "expedia"],
  experiences: ["tripadvisor", "googlePlaces", "openTripMap"],
};

/** Flat map of every service name -> client, regardless of category. Handy for a quick lookup or a status dashboard. */
export const flatRegistry: Record<string, { name: string; configured: boolean }> = Object.values(
  integrationRegistry
).reduce((acc, category) => Object.assign(acc, category), {} as Record<string, { name: string; configured: boolean }>);

/**
 * Look up a client by category + service key. Throws if either doesn't
 * exist, so callers get a clear error instead of `undefined.method()`.
 */
export function getClient<C extends IntegrationCategory>(
  category: C,
  service: keyof (typeof integrationRegistry)[C]
): (typeof integrationRegistry)[C][keyof (typeof integrationRegistry)[C]] {
  const categoryClients = integrationRegistry[category];
  const client = categoryClients[service];
  if (!client) {
    throw new Error(`integrationRegistry: no client registered for ${String(category)}.${String(service)}`);
  }
  return client;
}

/**
 * Dynamically call a method on a registered client. This is the core of
 * "the orchestrator can call integrations dynamically" — given plan data
 * like `{ category: 'shopping', service: 'walmart', method: 'searchProducts' }`
 * it doesn't need a hardcoded switch statement per integration.
 */
export async function callIntegration<C extends IntegrationCategory>(
  category: C,
  service: keyof (typeof integrationRegistry)[C],
  method: string,
  ...args: unknown[]
): Promise<unknown> {
  const client = getClient(category, service) as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
  const fn = client[method];
  if (typeof fn !== "function") {
    throw new Error(`integrationRegistry: ${String(category)}.${String(service)} has no method "${method}"`);
  }
  // Call bound to `client` so methods that read `this.configured` (the real-API
  // clients in apiClients.ts) work the same whether called directly or dynamically.
  return fn.call(client, ...args);
}

/** Returns a status summary (service name -> configured y/n) for a health/debug endpoint. */
export function integrationStatus(): { category: string; service: string; name: string; configured: boolean }[] {
  const rows: { category: string; service: string; name: string; configured: boolean }[] = [];
  for (const [category, services] of Object.entries(integrationRegistry)) {
    for (const [service, client] of Object.entries(services)) {
      rows.push({ category, service, name: client.name, configured: client.configured });
    }
  }
  return rows;
}

export default integrationRegistry;
