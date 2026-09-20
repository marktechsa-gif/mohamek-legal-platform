import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth.routes";
import { customersRouter } from "./routes/customers.routes";
import { invoicesRouter } from "./routes/invoices.routes";
import { partsCatalogRouter } from "./routes/partsCatalog.routes";
import { subscriptionsRouter } from "./routes/subscriptions.routes";
import { usedPartsRouter } from "./routes/usedParts.routes";
import { workOrdersRouter } from "./routes/workOrders.routes";

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);
app.use("/subscriptions", subscriptionsRouter);
app.use("/customers", customersRouter);
app.use("/work-orders", workOrdersRouter);
app.use("/used-parts", usedPartsRouter);
app.use("/parts-catalog", partsCatalogRouter);
app.use("/invoices", invoicesRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Smart MRO backend listening on port ${env.PORT}`);
});
