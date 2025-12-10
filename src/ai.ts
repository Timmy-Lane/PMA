import OpenAI from "openai";
import "dotenv/config";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1", // use openrouter for better pricing
  apiKey: process.env.OPENAI_API_KEY!,
});

const instructions = "";

class AI {
  constructor() {}

  async generatePrompt(prompt: string): Promise<string> {
    const response = await client.responses.create({
      model: "gpt-4o",
      instructions,
      input: prompt,
    });
    return response.output_text;
  }
}
