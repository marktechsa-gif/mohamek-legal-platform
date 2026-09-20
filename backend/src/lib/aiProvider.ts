import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { env } from "../config/env";
import { ApiError } from "../middleware/errorHandler";

export interface CompleteParams {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface AiProvider {
  name: string;
  model: string;
  complete(params: CompleteParams): Promise<string>;
}

class AnthropicProvider implements AiProvider {
  name = "anthropic";
  model = env.ANTHROPIC_MODEL;
  private client: Anthropic;

  constructor() {
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    this.client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }

  async complete({ system, prompt, maxTokens = 2048 }: CompleteParams): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("AI provider returned no text content");
    }
    return textBlock.text;
  }
}

class OpenAiProvider implements AiProvider {
  name = "openai";
  model = env.OPENAI_MODEL;
  private client: OpenAI;

  constructor() {
    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    this.client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }

  async complete({ system, prompt, maxTokens = 2048 }: CompleteParams): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("AI provider returned no text content");
    }
    return content;
  }
}

let cachedProvider: AiProvider | undefined;

export function getAiProvider(): AiProvider {
  if (!cachedProvider) {
    try {
      cachedProvider = env.AI_PROVIDER === "openai" ? new OpenAiProvider() : new AnthropicProvider();
    } catch (err) {
      throw new ApiError(
        503,
        "AI_PROVIDER_NOT_CONFIGURED",
        `ميزات الذكاء الاصطناعي معطّلة: ${err instanceof Error ? err.message : "unknown error"}. أضِف مفتاح ${env.AI_PROVIDER === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY"} في .env`
      );
    }
  }
  return cachedProvider;
}
