import cron from "node-cron";
import { runButlerCycle } from "../ai/orchestrator";
import { listActiveUsers } from "../store/userStore";

/**
 * Hourly job: runs a butler cycle for every active user and logs which
 * integrations fired for each run.
 */
export function startScheduler() {
  // Runs at minute 0 of every hour.
  cron.schedule("0 * * * *", async () => {
    await runHourlyCycle();
  });

  console.log("[scheduler] hourly butler cycle scheduled (0 * * * *)");
}

export async function runHourlyCycle() {
  const activeUsers = listActiveUsers();
  console.log(`[scheduler] running butler cycle for ${activeUsers.length} active user(s)`);

  for (const user of activeUsers) {
    try {
      const results = await runButlerCycle(user.id);
      console.log(
        `[scheduler] user=${user.id} (${user.name}) integrations=[${results.integrationsUsed.join(", ")}]`
      );
    } catch (err) {
      console.error(`[scheduler] failed for user=${user.id}:`, err);
    }
  }
}
