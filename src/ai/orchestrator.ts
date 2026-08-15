import * as experiences from "../integrations/experiences";
import * as calendarIntegration from "../integrations/calendar";
import * as finance from "../integrations/finance";
import { googleCalendarClient } from "../apiClients";
import {
  callIntegration,
  travelCapabilityMethods,
  defaultTravelProviders,
  shoppingSearchProviders,
} from "../integrationRegistry";
import { getUser } from "../store/userStore";
import {
  ButlerPlan,
  ButlerResults,
  CalendarEvent,
  FinancialSnapshot,
  ProductRecommendation,
  RideResult,
  TravelOption,
  User,
} from "../types";

/**
 * AI planning layer. Given a user, produces a ButlerPlan describing what
 * to look into this cycle (travel, transport, shopping, experience,
 * finance, scheduling). Currently a deterministic mock planner — swap the
 * body for a real LLM call (e.g. Claude) without changing the return shape.
 */
export async function callAiButlerPlanner(user: User, overrides: Partial<ButlerPlan> = {}): Promise<ButlerPlan> {
  // TODO: replace with a real AI planning call that reasons over user
  // preferences, calendar, and finances to produce a ButlerPlan.
  const location = user.preferences.favoriteLocations?.[0] ?? "Austin";
  const budget =
    user.preferences.budgetBand === "high" ? 500 : user.preferences.budgetBand === "low" ? 100 : 250;

  const plan: ButlerPlan = {
    travelPlan: {
      origin: "Home",
      destination: location,
      budget,
    },
    experiencePlan: {
      mood: user.preferences.mood ?? "relaxed",
      budget: Math.round(budget * 0.3),
      location,
    },
    shoppingPlan: {
      need: user.preferences.mood,
      budget: Math.round(budget * 0.2),
    },
    financePlan: {
      checkOptimizations: true,
    },
    // schedulingPlan is intentionally omitted by default — the mock planner
    // doesn't invent calendar events on its own. Callers (routes, jobs) can
    // pass one in via `overrides` when they actually want to read/write a
    // user's calendar this cycle.
    ...overrides,
  };

  return plan;
}

/**
 * Runs the travel portion of a plan across every configured flight
 * provider (default: Expedia + Amadeus, or whatever `plan.providers`
 * requests), using integrationRegistry to resolve each provider's
 * capability method dynamically rather than hardcoding a branch per API.
 */
async function runTravelPlan(
  plan: NonNullable<ButlerPlan["travelPlan"]>,
  integrationsUsed: string[]
): Promise<TravelOption[]> {
  const location = plan.destination ?? "Unknown";
  const requested = plan.providers && plan.providers.length ? plan.providers : defaultTravelProviders.flights;
  const providers = requested.filter((p) => travelCapabilityMethods[p]?.flights);

  const results: TravelOption[] = [];
  for (const provider of providers) {
    const method = travelCapabilityMethods[provider].flights!;
    try {
      const { live, items } = (await callIntegration("travel", provider as never, method, {
        origin: plan.origin,
        destination: plan.destination,
        dates: plan.dates,
        budget: plan.budget,
      })) as { live: boolean; items: { id: string; provider: string; title: string; price: number; currency: string; url?: string }[] };

      results.push(...items.map((r) => ({ ...r, type: "flight" as const, location, dates: plan.dates, live } as TravelOption)));
      if (live) integrationsUsed.push(`travel:${provider}`);
    } catch (err) {
      console.error(`[orchestrator] travel provider "${provider}" failed:`, err);
    }
  }
  return results;
}

/**
 * Runs the shopping portion of a plan across every configured catalog
 * provider (Amazon/Rakuten/Walmart/Best Buy support search; Skimlinks and
 * Target are link-generation-only and are skipped here — see
 * shopping.getAffiliateLink() / AFFILIATE_SETUP.md for how they fit in).
 */
async function runShoppingPlan(
  plan: NonNullable<ButlerPlan["shoppingPlan"]>,
  integrationsUsed: string[]
): Promise<ProductRecommendation[]> {
  const requested = plan.providers && plan.providers.length ? plan.providers : ["amazon", "walmart", "bestbuy"];
  const providers = requested.filter((p): p is (typeof shoppingSearchProviders)[number] =>
    (shoppingSearchProviders as readonly string[]).includes(p)
  );

  const results: ProductRecommendation[] = [];
  for (const provider of providers) {
    try {
      const { live, items } = (await callIntegration("shopping", provider, "searchProducts", {
        need: plan.need,
        category: plan.category,
        budget: plan.budget,
      })) as { live: boolean; items: Omit<ProductRecommendation, "affiliateLink" | "imageUrl" | "live">[] };

      if (!live) continue; // gated/unconfigured provider — nothing to add

      for (const item of items) {
        let affiliateLink: string | null = null;
        try {
          const linkResult = (await callIntegration("shopping", provider, "getAffiliateLink", item.id)) as { live: boolean; url: string | null };
          affiliateLink = linkResult.url;
        } catch {
          // Provider has no link-generation method of its own (e.g. Best Buy routes
          // through Rakuten in practice — see AFFILIATE_SETUP.md) — leave it null.
        }
        results.push({ ...item, affiliateLink, imageUrl: "https://example.com/img/placeholder.jpg", live: true });
      }
      integrationsUsed.push(`shopping:${provider}`);
    } catch (err) {
      console.error(`[orchestrator] shopping provider "${provider}" failed:`, err);
    }
  }
  return results;
}

/** Books a ride with whichever transportation client the plan (or default) selects. */
async function runTransportPlan(
  plan: NonNullable<ButlerPlan["transportPlan"]>,
  integrationsUsed: string[]
): Promise<RideResult | null> {
  if (!plan.pickup || !plan.dropoff) return null;
  const provider = plan.provider === "lyft" ? "lyft" : "uber";

  try {
    const { live, ride } = (await callIntegration("transportation", provider, "bookRide", {
      user: "current-user",
      pickup: plan.pickup,
      dropoff: plan.dropoff,
      time: plan.time,
    })) as { live: boolean; ride: RideResult | null };
    if (live) integrationsUsed.push(`transportation:${provider}`);
    return ride;
  } catch (err) {
    console.error(`[orchestrator] transportation provider "${provider}" failed:`, err);
    return null;
  }
}

/**
 * Pulls a financial snapshot. Demonstrates a dynamic registry call to the
 * selected aggregator (Plaid/Yodlee) and then delegates to
 * integrations/finance.ts for the full accounts+bills+subscriptions shape
 * that the rest of the app (routes, optimizations) already expects.
 */
async function runFinancePlan(
  userId: string,
  plan: NonNullable<ButlerPlan["financePlan"]>,
  integrationsUsed: string[]
): Promise<FinancialSnapshot | undefined> {
  if (!plan.checkOptimizations) return undefined;
  const provider = plan.provider === "yodlee" ? "yodlee" : "plaid";

  try {
    const { live } = (await callIntegration("finance", provider, "getAccounts", userId)) as { live: boolean };
    if (live) integrationsUsed.push(`finance:${provider}`);
  } catch (err) {
    console.error(`[orchestrator] finance provider "${provider}" failed:`, err);
  }

  return finance.getFinancialSnapshot(userId);
}

/**
 * Handles an optional new calendar event plus a listing of upcoming
 * events. `plan.provider` records which calendar backend was requested
 * (Google/Outlook/Apple CalDAV) for logging purposes — the actual
 * read/write goes through integrations/calendar.ts, which is the
 * persisted store shared with the /butler/calendar-event(s) routes.
 */
async function runSchedulingPlan(
  userId: string,
  plan: NonNullable<ButlerPlan["schedulingPlan"]>,
  integrationsUsed: string[]
): Promise<CalendarEvent[]> {
  const provider = plan.provider ?? "googleCalendar";

  if (plan.addEvent) {
    const added = await calendarIntegration.addEvent(userId, {
      title: plan.addEvent.title,
      start: plan.addEvent.start,
      end: plan.addEvent.end,
      location: plan.addEvent.location,
      type: plan.addEvent.type ?? "personal",
    });
    if (added.live) integrationsUsed.push(`scheduling:${provider}`);
  } else if (googleCalendarClient.configured) {
    integrationsUsed.push(`scheduling:${provider}`);
  }

  const range = plan.range ?? {
    from: new Date().toISOString(),
    to: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  return calendarIntegration.listEvents(userId, range);
}

/**
 * Runs a full butler cycle for a single user: plans, then executes every
 * relevant integration (in parallel across plan sections) via the dynamic
 * integrationRegistry, and assembles the combined results.
 */
export async function runButlerCycle(userId: string, planOverrides: Partial<ButlerPlan> = {}): Promise<ButlerResults> {
  const user = getUser(userId);
  if (!user) {
    throw new Error(`runButlerCycle: unknown userId ${userId}`);
  }

  const aiPlan = await callAiButlerPlanner(user, planOverrides);
  const integrationsUsed: string[] = [];

  const [travelResults, experienceResults, transportResults, shoppingResults, financeSnapshot, schedulingResults] =
    await Promise.all([
      aiPlan.travelPlan ? runTravelPlan(aiPlan.travelPlan, integrationsUsed) : Promise.resolve([]),
      aiPlan.experiencePlan
        ? experiences.curateExperiences({ user: user.id, ...aiPlan.experiencePlan }).then((r) => {
            integrationsUsed.push("experiences");
            return r;
          })
        : Promise.resolve([]),
      aiPlan.transportPlan ? runTransportPlan(aiPlan.transportPlan, integrationsUsed) : Promise.resolve(null),
      aiPlan.shoppingPlan ? runShoppingPlan(aiPlan.shoppingPlan, integrationsUsed) : Promise.resolve([]),
      aiPlan.financePlan ? runFinancePlan(user.id, aiPlan.financePlan, integrationsUsed) : Promise.resolve(undefined),
      aiPlan.schedulingPlan ? runSchedulingPlan(user.id, aiPlan.schedulingPlan, integrationsUsed) : Promise.resolve([]),
    ]);

  const results: ButlerResults = {
    userId: user.id,
    generatedAt: new Date().toISOString(),
    plan: aiPlan,
    travelResults,
    transportResults,
    shoppingResults,
    experienceResults,
    financeSnapshot,
    schedulingResults,
    integrationsUsed: Array.from(new Set(integrationsUsed)),
    summary: `Butler cycle for ${user.name}: ${travelResults.length} travel option(s), ${experienceResults.length} experience card(s), ${shoppingResults.length} product(s)${
      transportResults ? ", 1 ride requested" : ""
    }${financeSnapshot ? ", finance snapshot refreshed" : ""}${
      schedulingResults.length ? `, ${schedulingResults.length} calendar event(s)` : ""
    }.`,
  };

  return results;
}
