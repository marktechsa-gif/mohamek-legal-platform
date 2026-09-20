import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  AI_PROVIDER: z.enum(["anthropic", "openai"]).default("anthropic"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  ZATCA_DEFAULT_SELLER_NAME: z.string().default(""),
  UPLOADS_DIR: z.string().default("./uploads"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;
