import { amazonAssociatesClient, rakutenClient, walmartClient, bestBuyClient, skimlinksClient, targetClient } from "../apiClients";
import { ProductRecommendation } from "../types";

/**
 * Shopping integration module.
 * Searches Best Buy and Rakuten for real product data when configured.
 * Amazon and Walmart product search have no self-serve API (see
 * INTEGRATIONS.md) so they never contribute results — no fabricated catalog.
 */

export interface FindProductsParams {
  need?: string;
  category?: string;
  budget?: number;
}

export async function findProducts(params: FindProductsParams): Promise<ProductRecommendation[]> {
  const [bestbuy, rakuten] = await Promise.all([
    bestBuyClient.searchProducts(params),
    rakutenClient.searchProducts(params),
  ]);

  const budget = params.budget ?? Infinity;
  const rawItems = [...bestbuy.items, ...rakuten.items].filter((p) => p.price <= budget);

  return Promise.all(
    rawItems.map(async (p) => {
      const link = await getAffiliateLink(p.id, p.retailer);
      return {
        ...p,
        affiliateLink: link.url,
        imageUrl: "https://example.com/img/placeholder.jpg",
        live: p.retailer === "bestbuy" ? bestbuy.live : rakuten.live,
      };
    })
  );
}

/**
 * Routes to the affiliate network appropriate for the given retailer.
 * Falls back to Skimlinks (which covers most merchants generically) if the
 * retailer-specific network isn't configured.
 */
export async function getAffiliateLink(productId: string, retailer: "amazon" | "walmart" | "bestbuy" | "target" = "bestbuy") {
  if (retailer === "amazon") return amazonAssociatesClient.getAffiliateLink(productId);
  if (retailer === "walmart") return walmartClient.getAffiliateLink(productId);
  if (retailer === "target") return targetClient.getAffiliateLink(productId);
  // Best Buy has no link-generation API of its own — real commission tracking
  // for it runs through Rakuten Advertising in practice (see AFFILIATE_SETUP.md).
  const rakutenLink = await rakutenClient.getAffiliateLink(productId);
  if (rakutenLink.live) return rakutenLink;
  return skimlinksClient.getAffiliateLink(`https://www.bestbuy.com/site/${productId}.p`);
}
