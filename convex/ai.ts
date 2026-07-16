import { v } from "convex/values";
import { query } from "./_generated/server";

function aiEnabled() {
  return process.env.AI_ENABLED === "true";
}

export const isEnabled = query({
  args: {},
  returns: v.object({ enabled: v.boolean() }),
  handler: async () => {
    return { enabled: aiEnabled() };
  },
});

const filterResult = v.object({
  city: v.optional(v.string()),
  maxRentCents: v.optional(v.number()),
  minBeds: v.optional(v.number()),
  explanation: v.string(),
  disabled: v.boolean(),
});

export const parseSearchLocal = query({
  args: { prompt: v.string() },
  returns: filterResult,
  handler: async (_ctx, args) => {
    if (!aiEnabled()) {
      return {
        city: undefined,
        maxRentCents: undefined,
        minBeds: undefined,
        explanation: "AI search is turned off. Use the filters on this page.",
        disabled: true,
      };
    }
    return heuristicParse(args.prompt);
  },
});

export function heuristicParse(prompt: string) {
  const lower = prompt.toLowerCase();
  const bedsMatch = lower.match(/(\d+)\s*(bed|br|bedroom)/);
  const rentMatch = lower.match(/under\s*\$?\s*([\d,]+)/);
  const cityMatch = lower.match(
    /\bin\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\b/,
  );

  const minBeds = bedsMatch ? Number(bedsMatch[1]) : undefined;
  const maxRentCents = rentMatch
    ? Number(rentMatch[1].replace(/,/g, "")) * 100
    : undefined;
  const city = cityMatch?.[1]
    ? cityMatch[1].charAt(0).toUpperCase() + cityMatch[1].slice(1)
    : undefined;

  return {
    city,
    maxRentCents,
    minBeds,
    explanation: "Parsed filters from your request (local heuristic).",
    disabled: false,
  };
}
