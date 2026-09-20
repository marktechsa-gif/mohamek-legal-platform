import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth.routes";
import { casesRouter } from "./routes/cases.routes";
import { legalKbRouter } from "./routes/legalKb.routes";
import { subscriptionsRouter } from "./routes/subscriptions.routes";

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);
app.use("/subscriptions", subscriptionsRouter);
app.use("/cases", casesRouter);
app.use("/legal-kb", legalKbRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`تأصيل تك backend listening on port ${env.PORT}`);
});
