import OpenAI from "openai";
import "dotenv/config";

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1", // use openrouter for better pricing
  apiKey: process.env.OPENAI_API_KEY!,
});
