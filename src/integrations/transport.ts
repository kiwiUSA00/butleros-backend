import { uberClient, lyftClient } from "../apiClients";
import { RideEstimate, RideResult } from "../types";

/**
 * Transport integration module.
 * Uber/Lyft ride-booking scopes require an approved third-party
 * partnership even with valid API credentials (see INTEGRATIONS.md) — so
 * requestRide always reports unavailable rather than a fabricated
 * "requested" status. Kept here so a real partnership can be dropped in
 * behind this same interface later.
 */

export interface RequestRideParams {
  user: string;
  pickup: string;
  dropoff: string;
  time?: string;
}

export interface EstimateRideParams {
  pickup: string;
  dropoff: string;
}

export async function requestRide(params: RequestRideParams): Promise<RideResult | null> {
  const result = await uberClient.bookRide(params);
  return result.live ? (result as any).ride : null;
}

export async function estimateRide(params: EstimateRideParams): Promise<RideEstimate[]> {
  const [uber, lyft] = await Promise.all([uberClient.estimateRide(params), lyftClient.estimateRide(params)]);
  return [uber, lyft].filter((r) => r.live) as unknown as RideEstimate[];
}

/**
 * Executes a transport task derived from an AI butler plan.
 * Used by the orchestrator when a transportPlan is present.
 */
export async function executeTasks(
  userId: string,
  transportPlan?: { pickup?: string; dropoff?: string; time?: string }
): Promise<RideResult | null> {
  if (!transportPlan || !transportPlan.pickup || !transportPlan.dropoff) {
    return null;
  }

  return requestRide({
    user: userId,
    pickup: transportPlan.pickup,
    dropoff: transportPlan.dropoff,
    time: transportPlan.time,
  });
}
