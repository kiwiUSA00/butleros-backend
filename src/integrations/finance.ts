import { plaidClient, stripeBillingClient } from "../apiClients";
import { FinancialOptimization, FinancialSnapshot } from "../types";

/**
 * Finance integration module.
 * Pulls real accounts from Plaid's sandbox and real subscriptions from
 * Stripe when configured. No bill-tracking API is wired (none of the
 * instant-tier services covers bills), so `bills` is always empty rather
 * than fabricated. Yodlee has no self-serve production path (see
 * INTEGRATIONS.md) so it never contributes.
 */

export async function getFinancialSnapshot(userId: string): Promise<FinancialSnapshot> {
  const [accountsResult, subsResult] = await Promise.all([
    plaidClient.getAccounts(userId),
    stripeBillingClient.getSubscriptions(userId),
  ]);

  return {
    userId,
    accounts: accountsResult.items,
    bills: [],
    subscriptions: subsResult.items,
    generatedAt: new Date().toISOString(),
    live: accountsResult.live || subsResult.live,
  };
}

export async function suggestOptimizations(snapshot: FinancialSnapshot): Promise<FinancialOptimization[]> {
  const optimizations: FinancialOptimization[] = [];

  const duplicateStreaming = snapshot.subscriptions.filter((s) => /stream/i.test(s.name));
  if (duplicateStreaming.length > 1) {
    optimizations.push({
      type: "cancel_subscription",
      description: `You have ${duplicateStreaming.length} streaming-related subscriptions — consider consolidating.`,
      estimatedMonthlySavings: duplicateStreaming.slice(1).reduce((sum, s) => sum + s.amount, 0),
    });
  }

  const savings = snapshot.accounts.find((a) => a.type === "savings");
  const checking = snapshot.accounts.find((a) => a.type === "checking");
  if (savings && checking && checking.balance > 3000) {
    optimizations.push({
      type: "move_savings",
      description: "Checking balance is well above typical monthly spend — consider moving excess to savings.",
      estimatedMonthlySavings: 0,
    });
  }

  const creditAccount = snapshot.accounts.find((a) => a.type === "credit" && a.balance < 0);
  if (creditAccount) {
    optimizations.push({
      type: "consolidate_debt",
      description: `Outstanding credit balance of $${Math.abs(creditAccount.balance).toFixed(2)} — consider a lower-APR consolidation.`,
      estimatedMonthlySavings: 0,
    });
  }

  return optimizations;
}
