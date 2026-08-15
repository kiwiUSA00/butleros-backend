import { openWeatherClient, tomorrowIoClient, yelpClient, googleMapsClient } from "../apiClients";

/**
 * Product enrichment module — supplementary lookups (weather, local
 * ratings, maps) used to enrich other integrations' results. All three
 * are real, instant-tier APIs — this module just picks a primary/fallback
 * provider and forwards the `live` flag through.
 */

export async function getWeather(location: string) {
  const primary = openWeatherClient.configured ? openWeatherClient : tomorrowIoClient;
  return primary.getWeather(location);
}

export async function getLocalRatings(query: string, location: string) {
  return yelpClient.getRatings(query, location);
}

export async function getDirections(origin: string, destination: string) {
  return googleMapsClient.getDirections(origin, destination);
}
