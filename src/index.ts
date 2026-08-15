import express from "express";
import cors from "cors";
import config from "./config";
import userRoutes from "./routes/user";
import butlerRoutes from "./routes/butler";
import { startScheduler } from "./jobs/scheduler";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "butleros", time: new Date().toISOString() });
});

app.use("/user", userRoutes);
app.use("/butler", butlerRoutes);

app.listen(config.port, () => {
  console.log(`[butleros] listening on port ${config.port}`);
  startScheduler();
});

export default app;
