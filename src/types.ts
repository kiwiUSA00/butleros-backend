/** Shared domain types for ButlerOS. */

export interface UserPreferences {
  mood?: string;
  budgetBand?: "low" | "medium" | "high";
  favoriteLocations?: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  active: boolean;
  preferences: UserPreferences;
  createdAt: string;
}

export interface DateRange {
  from: string;
  to: string;
}

// ---- Travel ----

export interface TravelOption {
  id: string;
  provider: "expedia" | "booking" | "airbnb" | "tripadvisor" | "google_places" | "amadeus" | "skyscanner";
  type: "flight" | "stay" | "experience";
  title: string;
  price: number;
  currency: string;
  location: string;
  dates?: { start: string; end: string };
  /** Real booking/detail URL when the provider returns one (e.g. TripAdvisor web_url). */
  url?: string;
  /** True when this came back from a real API call this request, not a mock/fallback. */
  live: boolean;
}

// ---- Transport ----

export interface RideEstimate {
  provider: "uber" | "lyft";
  etaMinutes: number;
  priceEstimate: number;
  currency: string;
}

export interface RideResult {
  provider: "uber" | "lyft";
  status: "requested" | "confirmed" | "failed";
  eta: number;
  rideId: string;
  live: boolean;
}

// ---- Shopping ----

export interface ProductRecommendation {
  id: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  retailer: "amazon" | "walmart" | "bestbuy";
  affiliateLink: string | null;
  imageUrl: string;
  /** True when the product data came from a real API call this request. */
  live: boolean;
}

// ---- Experiences ----

export interface ExperienceCard {
  id: string;
  title: string;
  description: string;
  priceBand: "low" | "medium" | "high";
  location: string;
  bookingOptions: { provider: string; url: string }[];
  live: boolean;
}

// ---- Calendar ----

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  type: "personal" | "work" | "travel" | "reminder";
}

// ---- Finance ----

export interface Account {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit";
  balance: number;
  currency: string;
}

export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  cadence: "monthly" | "annual";
}

export interface FinancialSnapshot {
  userId: string;
  accounts: Account[];
  bills: Bill[];
  subscriptions: Subscription[];
  generatedAt: string;
  /** True when accounts/subscriptions came from real Plaid/Stripe calls, not empty/no data. */
  live: boolean;
}

export interface FinancialOptimization {
  type: "cancel_subscription" | "move_savings" | "renegotiate_bill" | "consolidate_debt";
  description: string;
  estimatedMonthlySavings: number;
}

// ---- AI / Orchestrator ----

export interface ButlerPlan {
  travelPlan?: {
    origin?: string;
    destination?: string;
    dates?: { start: string; end: string };
    budget?: number;
    /** Which travel provider clients (from integrationRegistry.travel) to call. Defaults if omitted. */
    providers?: string[];
  };
  transportPlan?: {
    pickup?: string;
    dropoff?: string;
    time?: string;
    /** Which transportation client to book with. Defaults to "uber". */
    provider?: string;
  };
  shoppingPlan?: {
    need?: string;
    category?: string;
    budget?: number;
    /** Which shopping provider clients to search. Defaults if omitted. */
    providers?: string[];
  };
  experiencePlan?: {
    mood?: string;
    budget?: number;
    location?: string;
  };
  financePlan?: {
    checkOptimizations?: boolean;
    /** Which finance provider client to pull the snapshot from. Defaults to "plaid". */
    provider?: string;
  };
  schedulingPlan?: {
    /** Optional new event to add this cycle. */
    addEvent?: { title: string; start: string; end: string; location?: string; type?: CalendarEvent["type"] };
    /** Range to list existing events for. Defaults to "today through +7 days" if omitted. */
    range?: DateRange;
    /** Which calendar provider client to use. Defaults to "googleCalendar". */
    provider?: string;
  };
}

export interface ButlerResults {
  userId: string;
  generatedAt: string;
  plan: ButlerPlan;
  travelResults: TravelOption[];
  transportResults: RideResult | null;
  shoppingResults: ProductRecommendation[];
  experienceResults: ExperienceCard[];
  financeSnapshot?: FinancialSnapshot;
  schedulingResults: CalendarEvent[];
  integrationsUsed: string[];
  summary: string;
}
