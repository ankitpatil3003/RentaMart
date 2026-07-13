"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";

export const askListing = action({
  args: {
    listingId: v.id("listings"),
    question: v.string(),
  },
  returns: v.object({
    answer: v.string(),
    citations: v.array(v.string()),
    disabled: v.boolean(),
  }),
  handler: async (ctx, args): Promise<{
    answer: string;
    citations: string[];
    disabled: boolean;
  }> => {
    if (process.env.AI_ENABLED !== "true") {
      return {
        answer: "AI Q and A is turned off for this environment.",
        citations: [],
        disabled: true,
      };
    }
    const listing: {
      title: string;
      description: string;
      beds: number;
      baths: number;
      city: string;
      state: string;
      zip: string;
      rentCents: number;
      applicationFeeCents: number;
    } | null = await ctx.runQuery(api.listings.getById, {
      listingId: args.listingId,
    });
    if (!listing) {
      return {
        answer: "Listing not found.",
        citations: [],
        disabled: false,
      };
    }
    const snapshot = [
      listing.title,
      listing.description,
      `${listing.beds} beds, ${listing.baths} baths`,
      `${listing.city}, ${listing.state} ${listing.zip}`,
      `Rent $${(listing.rentCents / 100).toFixed(0)} / month`,
      `Application fee $${(listing.applicationFeeCents / 100).toFixed(0)}`,
    ].join("\n");

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      return {
        answer: `Based on the listing: ${listing.title} in ${listing.city}, ${listing.state}. ${listing.description}`,
        citations: ["title", "description", "city", "state"],
        disabled: false,
      };
    }

    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content:
                "Answer only from the listing snapshot. Never discuss payments, approvals, roles, or publish actions. If unknown, say you do not know.",
            },
            {
              role: "user",
              content: `Listing snapshot:\n${snapshot}\n\nQuestion: ${args.question}`,
            },
          ],
          temperature: 0.2,
        }),
      },
    );
    if (!response.ok) {
      throw new Error("Groq request failed");
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer =
      data.choices?.[0]?.message?.content?.trim() ||
      "No answer returned.";
    return {
      answer,
      citations: ["listing snapshot"],
      disabled: false,
    };
  },
});
