import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { AiProviderName } from "../../shared/types";
import {
  getProviderChoice,
  getAnthropicKeyForInternalUse,
  getOpenAIKeyForInternalUse,
} from "./secure-storage-service";

export interface AiProvider {
  name: AiProviderName;
  generateText(prompt: string, maxTokens: number): Promise<string>;
}

class AnthropicProvider implements AiProvider {
  name = "anthropic" as const;

  async generateText(prompt: string, maxTokens: number): Promise<string> {
    const apiKey = await getAnthropicKeyForInternalUse();
    if (!apiKey) {
      throw new Error("No Anthropic API key configured. Set one in Settings.");
    }

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    const block = response.content[0];
    return block.type === "text" ? block.text : "";
  }
}

class OpenAIProvider implements AiProvider {
  name = "openai" as const;

  async generateText(prompt: string, maxTokens: number): Promise<string> {
    const apiKey = await getOpenAIKeyForInternalUse();
    if (!apiKey) {
      throw new Error("No OpenAI API key configured. Set one in Settings.");
    }

    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    return response.choices[0]?.message?.content ?? "";
  }
}

const providers: Record<AiProviderName, AiProvider> = {
  anthropic: new AnthropicProvider(),
  openai: new OpenAIProvider(),
};

/**
 * Get the currently active AI provider based on user's choice in Settings.
 * Falls back to Anthropic if no choice has been set yet.
 */
export async function getActiveProvider(): Promise<AiProvider> {
  const choice = await getProviderChoice();
  return providers[choice] ?? providers.anthropic;
}
