import { v4 as uuid } from "uuid";
import * as travel from "./travel";
import * as shopping from "./shopping";
import { ExperienceCard } from "../types";

/**
 * Experiences integration module.
 * Curates cards from real travel-experience and product data only — if
 * neither TripAdvisor/Google Places nor Best Buy/Rakuten are configured,
 * this returns an empty list rather than fabricated cards.
 */

export interface CurateExperiencesParams {
  user: string;
  mood?: string;
  budget?: number;
  location?: string;
}

function priceBandFor(price: number): "low" | "medium" | "high" {
  if (price <= 30) return "low";
  if (price <= 100) return "medium";
  return "high";
}

// Real bug found live: "Plan My Weekend" always returned the identical
// handful of places for a given city, click after click — mood was never
// actually fed into the search, so every call issued the exact same
// "things to do" query and got Google's same deterministic top results
// back. This maps the mood to a genuinely different real-world search
// category so different moods produce different real places, not just
// different copy.
const MOOD_QUERY_MAP: { keys: string[]; query: string }[] = [
  { keys: ["relax", "chill", "calm", "rest", "peaceful", "spa", "cozy"], query: "spa and relaxing cafes" },
  { keys: ["adventur", "outdoor", "hike", "active", "thrill", "sport"], query: "outdoor adventure and hiking" },
  { keys: ["romantic", "date night", "date", "love"], query: "romantic restaurants and scenic viewpoints" },
  { keys: ["fun", "playful", "party", "lively", "energetic"], query: "fun activities and entertainment" },
  { keys: ["cultur", "art", "museum", "history"], query: "museums and art galleries" },
  { keys: ["food", "foodie", "culinary", "eat", "hungry"], query: "top-rated restaurants" },
];
function queryForMood(mood?: string): string {
  if (!mood) return "things to do";
  const lower = mood.toLowerCase();
  const match = MOOD_QUERY_MAP.find((m) => m.keys.some((k) => lower.includes(k)));
  return match ? match.query : "things to do";
}

export async function curateExperiences(params: CurateExperiencesParams): Promise<ExperienceCard[]> {
  const [travelExperiences, relatedProducts] = await Promise.all([
    travel.searchExperiences({ location: params.location, budget: params.budget, query: queryForMood(params.mood) }),
    shopping.findProducts({ need: params.mood, budget: params.budget }),
  ]);

  // Real results, reshuffled within the top-rated slice — even with the
  // same mood/location, repeated "Plan My Weekend" clicks used to surface
  // the identical top few out of Google's up-to-20 real results every
  // time (a stable relevance order). Sorting by rating first keeps quality
  // high; shuffling within that top slice keeps every card genuine while
  // no longer showing the exact same plan on every click.
  const liveExperiences = travelExperiences.filter((exp) => exp.live);
  liveExperiences.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
  const pool = liveExperiences.slice(0, 10);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const cards: ExperienceCard[] = pool
    .map((exp) => {
      const e = exp as any;
      return {
        id: uuid(),
        title: exp.title,
        // Prefer a real editorial description (Google Places) over the generic line.
        description: e.description || `A ${params.mood ?? "curated"} experience in ${exp.location}, matched to your budget.`,
        priceBand: priceBandFor(exp.price),
        location: exp.location,
        bookingOptions: [{ provider: exp.provider, url: exp.url ?? "" }],
        live: true,
        photoName: e.photoName as string | undefined,
        rating: e.rating as number | undefined,
        userRatingCount: e.userRatingCount as number | undefined,
        address: e.address as string | undefined,
        category: e.category as string | undefined,
      };
    });

  // Fold in a "gear up" card using a related product, if a live one was found.
  const product = relatedProducts.find((p) => p.live && p.affiliateLink);
  if (product) {
    cards.push({
      id: uuid(),
      title: `Gear up: ${product.name}`,
      description: `Handy for your ${params.mood ?? "planned"} outing in ${params.location ?? "your area"}.`,
      priceBand: priceBandFor(product.price),
      location: params.location ?? "Unknown",
      bookingOptions: [{ provider: product.retailer, url: product.affiliateLink as string }],
      live: true,
      imageUrl: product.imageUrl,
    });
  }

  return cards;
}
