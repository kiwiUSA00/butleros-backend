import dotenv from "dotenv";

dotenv.config();

/**
 * Central config for ButlerOS.
 * All external API keys are optional at boot time — every integration
 * module falls back to mock data when its keys are missing, so the app
 * always runs out of the box with `npm run dev`.
 */

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(env("PORT", "3000")),

  travel: {
    expediaKey: env("EXPEDIA_KEY"),
    bookingKey: env("BOOKING_KEY"),
    tripadvisorKey: env("TRIPADVISOR_KEY"),
    googlePlacesKey: env("GOOGLE_PLACES_KEY"),
    airbnbPartnerKey: env("AIRBNB_PARTNER_KEY"),
    skyscannerKey: env("SKYSCANNER_KEY"),
    amadeusClientId: env("AMADEUS_CLIENT_ID"),
    amadeusClientSecret: env("AMADEUS_CLIENT_SECRET"),
  },

  transport: {
    uberClientId: env("UBER_CLIENT_ID"),
    uberSecret: env("UBER_SECRET"),
    lyftClientId: env("LYFT_CLIENT_ID"),
    lyftSecret: env("LYFT_SECRET"),
    turoPartnerKey: env("TURO_PARTNER_KEY"),
    postmatesKey: env("POSTMATES_KEY"),
  },

  shopping: {
    doordashKey: env("DOORDASH_KEY"),
    doordashDeveloperId: env("DOORDASH_DEVELOPER_ID"),
    doordashKeyId: env("DOORDASH_KEY_ID"),
    doordashSigningSecret: env("DOORDASH_SIGNING_SECRET"),
    instacartKey: env("INSTACART_KEY"),
    taskrabbitKey: env("TASKRABBIT_KEY"),
    amazonAssocKey: env("AMAZON_ASSOC_KEY"),
    amazonCreatorsApiKey: env("AMAZON_CREATORS_API_KEY"),
    rakutenKey: env("RAKUTEN_KEY"),
    skimlinksKey: env("SKIMLINKS_KEY"),
    walmartKey: env("WALMART_KEY"),
    bestbuyKey: env("BESTBUY_KEY"),
    targetAffiliateId: env("TARGET_AFFILIATE_ID"),
    impactAccountSid: env("IMPACT_ACCOUNT_SID"),
    impactAuthToken: env("IMPACT_AUTH_TOKEN"),
  },

  finance: {
    plaidKey: env("PLAID_KEY"),
    plaidSecret: env("PLAID_SECRET"),
    plaidEnv: env("PLAID_ENV", "sandbox"),
    stripeKey: env("STRIPE_KEY"),
    yodleeKey: env("YODLEE_KEY"),
    rocketMoneyPartnerKey: env("ROCKETMONEY_PARTNER_KEY"),
    visaApiKey: env("VISA_API_KEY"),
    visaSharedSecret: env("VISA_SHARED_SECRET"),
    mastercardConsumerKey: env("MASTERCARD_CONSUMER_KEY"),
    mastercardSigningKeyPath: env("MASTERCARD_SIGNING_KEY_PATH"),
  },

  calendar: {
    gcalKey: env("GCAL_KEY"),
    gcalServiceAccountEmail: env("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    gcalServiceAccountPrivateKey: env("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"),
    gcalCalendarId: env("GOOGLE_CALENDAR_ID"),
    outlookKey: env("OUTLOOK_KEY"),
    appleCaldavConfig: env("APPLE_CALDAV_CONFIG"),
    eventbriteKey: env("EVENTBRITE_KEY"),
    ticketmasterKey: env("TICKETMASTER_KEY"),
    // SeatGeek's Platform API (seatgeek.com/build) — free, instant,
    // self-serve client_id, no partner approval wait. Used alongside
    // Ticketmaster in /butler/events for broader real event coverage;
    // duplicate listings between the two are de-duped by title+date.
    seatGeekClientId: env("SEATGEEK_CLIENT_ID"),
  },

  misc: {
    weatherKey: env("WEATHER_KEY"),
    yelpKey: env("YELP_KEY"),
    googleMapsKey: env("GOOGLE_MAPS_KEY"),
    tomorrowioKey: env("TOMORROWIO_KEY"),
  },

  // Free / no-signup-required sources — see apiClients.ts for details.
  openData: {
    // OpenTripMap is the one exception in this group: it's free but does
    // require a lightweight signup for a key. Wikivoyage and the National
    // Weather Service need no key/account at all.
    openTripMapKey: env("OPENTRIPMAP_KEY"),
  },
};

/** True when an integration's key(s) are all present — used by modules to log/branch. */
export function hasKeys(...keys: string[]): boolean {
  return keys.every((k) => !!k);
}

export default config;
