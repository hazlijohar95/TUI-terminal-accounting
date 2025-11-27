"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";
import OpenAI from "openai";
const SYSTEM_PROMPT_QUESTION = `You are an proactive financial advisor for OpenAccounting.dev. You don't just answer questions - you provide actionable insights and recommendations.

## Your Personality
- Be direct and opinionated - give clear advice, not wishy-washy suggestions
- Be proactive - point out things the user should know even if they didn't ask
- Be specific - use actual numbers from their data, not generic advice
- Be concise - get to the point quickly

## Response Guidelines
1. Lead with the key insight
2. Use actual numbers from the context
3. Compare to context (vs last month, vs average)
4. End with an action or follow-up suggestion

Keep responses short (2-4 sentences). Always end with a specific follow-up question or action.`;
const SYSTEM_PROMPT_PROPOSE = `You are an expert accounting assistant for OpenAccounting.dev.
You help users create ledger postings based on their instructions.

When proposing postings:
1. Use double-entry accounting (debits and credits must balance)
2. Follow ledger-cli format
3. Each transaction must balance to zero

Provide clear, properly formatted ledger entries.`;
// Ask a question about financial data
export const ask = action({
    args: {
        question: v.string(),
        context: v.string(),
    },
    handler: async (ctx, args) => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY not configured in Convex");
        }
        const client = new OpenAI({ apiKey });
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: SYSTEM_PROMPT_QUESTION },
                {
                    role: "user",
                    content: `## Financial Context\n${args.context}\n\n## Question\n${args.question}\n\nProvide a helpful, specific response:`,
                },
            ],
            temperature: 0.7,
            max_tokens: 1000,
        });
        return response.choices[0]?.message?.content || "No response generated";
    },
});
// Propose ledger postings
export const propose = action({
    args: {
        instruction: v.string(),
        context: v.string(),
    },
    handler: async (ctx, args) => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY not configured in Convex");
        }
        const client = new OpenAI({ apiKey });
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: SYSTEM_PROMPT_PROPOSE },
                {
                    role: "user",
                    content: `## Current Ledger Context\n${args.context}\n\n## Instruction\n${args.instruction}\n\nPropose the ledger postings:`,
                },
            ],
            temperature: 0.3,
            max_tokens: 1000,
        });
        return response.choices[0]?.message?.content || "No postings generated";
    },
});
// Planning step for agentic flow
export const plan = action({
    args: {
        input: v.string(),
        context: v.string(),
    },
    handler: async (ctx, args) => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY not configured in Convex");
        }
        const client = new OpenAI({ apiKey });
        const response = await client.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Create a brief step-by-step plan to answer this accounting question. Return JSON array with id, description, and tool fields. Tools: search_entries, calculate_totals, analyze_patterns, format_response. Only return valid JSON.`,
                },
                {
                    role: "user",
                    content: `Context:\n${args.context}\n\nRequest: ${args.input}`,
                },
            ],
            temperature: 0.3,
            max_tokens: 300,
        });
        return response.choices[0]?.message?.content || "[]";
    },
});
