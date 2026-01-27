"use node";

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export interface AIDecisionResponse {
  action: string;
  target: string | null;
  reasoning: string;
}

export async function callAnthropic(
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<AIDecisionResponse> {
  const response = await client.messages.create({
    model: model,
    max_tokens: 500,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  // Extract text content from the response
  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No text content in AI response");
  }

  const responseText = textContent.text.trim();

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
    // If parsing fails, return a default "do_nothing" action
    console.error("Failed to parse AI response:", responseText, parseError);
    return {
      action: "do_nothing",
      target: null,
      reasoning: "Failed to generate a valid decision. Maintaining status quo.",
    };
  }
}
