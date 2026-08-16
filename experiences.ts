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

export async function curateExperiences(params: CurateExperiencesParams): Promise<ExperienceCard[]> {
  const [travelExperiences, relatedProducts] = await Promise.all([
    travel.searchExperiences({ location: params.location, budget: params.budget }),
    shopping.findProducts({ need: params.mood, budget: params.budget }),
  ]);

  const cards: ExperienceCard[] = travelExperiences
    .filter((exp) => exp.live)
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
