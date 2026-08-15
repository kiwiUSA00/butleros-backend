import { runButlerCycle } from "./src/ai/orchestrator";

(async () => {
  const results = await runButlerCycle("user-demo", {
    travelPlan: undefined,
    experiencePlan: undefined,
    shoppingPlan: undefined,
    financePlan: undefined,
    transportPlan: { pickup: "Home", dropoff: "Airport", provider: "lyft" },
    schedulingPlan: {
      addEvent: { title: "Test Flight Reminder", start: new Date().toISOString(), end: new Date(Date.now()+3600000).toISOString(), type: "travel" },
      provider: "outlookCalendar",
    },
  });
  console.log(JSON.stringify(results, null, 2));
})();
