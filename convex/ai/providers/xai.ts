"use node";

// xAI (Grok) uses an OpenAI-compatible API
import OpenAI from "openai";

export interface AIDecisionResponse {
  action: string;
  target: string | null;
  reasoning: string;
}

// Initialize client only if API key is available
function getClient(): OpenAI | null {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  // xAI uses OpenAI-compatible API with different base URL
  return new OpenAI({
    apiKey,
    baseURL: "https://api.x.ai/v1",
  });
}

export async function callXAI(
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<AIDecisionResponse> {
  const client = getClient();

  if (!client) {
    console.warn("xAI API key not configured, falling back to default action");
    return {
      action: "rest",
      target: null,
      reasoning: "The tribe rests while awaiting guidance. (xAI API key not configured)",
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: model,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    // Extract text content from the response
    const textContent = response.choices[0]?.message?.content;
    if (!textContent) {
      throw new Error("No text content in xAI response");
    }

    const responseText = textContent.trim();

    // Parse the JSON response
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate the response structure
      if (typeof parsed.action !== "string") {
        throw new Error("Invalid action in response");
      }
      if (typeof parsed.reasoning !== "string") {
        throw new Error("Invalid reasoning in response");
      }

      return {
        action: parsed.action,
        target: parsed.target || null,
        reasoning: parsed.reasoning,
      };
    } catch (parseError) {
      // If parsing fails, return a default action
      console.error("Failed to parse xAI response:", responseText, parseError);
      return {
        action: "rest",
        target: null,
        reasoning: "Failed to generate a valid decision. The tribe rests.",
      };
    }
  } catch (error) {
    console.error("xAI API error:", error);
    return {
      action: "rest",
      target: null,
      reasoning: "An error occurred while consulting the oracle. The tribe rests.",
    };
  }
}

// Check if xAI is available
export function isXAIAvailable(): boolean {
  return !!process.env.XAI_API_KEY;
}
