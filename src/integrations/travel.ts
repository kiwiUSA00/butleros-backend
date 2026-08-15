import {
  amadeusClient,
  expediaClient,
  bookingClient,
  airbnbClient,
  tripAdvisorClient,
  googlePlacesClient,
  openTripMapClient,
  wikivoyageClient,
} from "../apiClients";
import { TravelOption } from "../types";

/**
 * Travel integration module.
 * Routes to the real Amadeus / TripAdvisor / Google Places clients when
 * configured. Expedia, Booking.com, and Airbnb have no self-serve API (see
 * INTEGRATIONS.md) so they always contribute an empty, honestly-labeled
 * result rather than fabricated listings.
 */

export interface SearchTripsParams {
  origin?: string;
  destination?: string;
  dates?: { start: string; end: string };
  budget?: number;
}

export interface SearchStaysParams {
  location?: string;
  dates?: { start: string; end: string };
  budget?: number;
}

export interface SearchExperiencesParams {
  location?: string;
  date?: string;
  budget?: number;
}

export async function searchTrips(params: SearchTripsParams): Promise<TravelOption[]> {
  const location = params.destination ?? "Unknown";

  const [amadeus, expedia] = await Promise.all([
    amadeusClient.searchFlights({ origin: params.origin, destination: params.destination, dates: params.dates, budget: params.budget }),
    expediaClient.searchTrips({ origin: params.origin, destination: params.destination, budget: params.budget }),
  ]);

  return [
    ...amadeus.items.map((r: any) => ({ ...r, type: "flight" as const, location, dates: params.dates, live: amadeus.live })),
    ...expedia.items.map((r: any) => ({ ...r, type: "flight" as const, location, dates: params.dates, live: expedia.live })),
  ] as TravelOption[];
}

export async function searchStays(params: SearchStaysParams): Promise<TravelOption[]> {
  const location = params.location ?? "Unknown";

  const [booking, airbnb] = await Promise.all([
    bookingClient.searchStays({ location: params.location, budget: params.budget }),
    airbnbClient.searchStays({ location: params.location, budget: params.budget }),
  ]);

  return [
    ...booking.items.map((r: any) => ({ ...r, type: "stay" as const, location, dates: params.dates, live: booking.live })),
    ...airbnb.items.map((r: any) => ({ ...r, type: "stay" as const, location, dates: params.dates, live: airbnb.live })),
  ] as TravelOption[];
}

export async function searchExperiences(params: SearchExperiencesParams): Promise<TravelOption[]> {
  const location = params.location ?? "Unknown";

  const [places, tripadvisor, openTripMap] = await Promise.all([
    googlePlacesClient.searchPlaces({ location: params.location, budget: params.budget }),
    tripAdvisorClient.searchExperiences({ location: params.location, budget: params.budget }),
    openTripMapClient.searchAttractions({ location: params.location, budget: params.budget }),
  ]);

  return [
    ...places.items.map((r: any) => ({ ...r, type: "experience" as const, location, live: places.live })),
    ...tripadvisor.items.map((r: any) => ({ ...r, type: "experience" as const, location, live: tripadvisor.live })),
    ...openTripMap.items.map((r: any) => ({ ...r, type: "experience" as const, location, live: openTripMap.live })),
  ] as TravelOption[];
}

export interface DestinationGuide {
  live: boolean;
  title: string | null;
  extract: string | null;
  url: string | null;
}

/**
 * Real destination-guide text pulled from Wikivoyage — no key required.
 * Not part of the flights/stays/experiences capability model above since
 * it's a different shape (one article, not a list of bookable items).
 */
export async function getDestinationGuide(location: string): Promise<DestinationGuide> {
  return wikivoyageClient.getDestinationGuide(location);
}
