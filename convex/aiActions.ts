"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";

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

export const screeningAssist = action({
  args: {
    applicationId: v.id("applications"),
    reportId: v.id("screeningReports"),
  },
  returns: v.object({
    summary: v.string(),
    missingDocs: v.array(v.string()),
    suggestedQuestions: v.array(v.string()),
    disabled: v.boolean(),
  }),
  handler: async (ctx, args): Promise<{
    summary: string;
    missingDocs: string[];
    suggestedQuestions: string[];
    disabled: boolean;
  }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    if (process.env.AI_ENABLED !== "true") {
      return {
        summary: "AI screening assist is turned off for this environment.",
        missingDocs: [],
        suggestedQuestions: [],
        disabled: true,
      };
    }

    const application: {
      fullName: string;
      email: string;
      phone: string;
      status: string;
    } | null = await ctx.runQuery(
      internal.applications.getScreeningAssistContext,
      {
        clerkUserId: identity.subject,
        applicationId: args.applicationId,
        reportId: args.reportId,
      },
    );

    const groqKey = process.env.GROQ_API_KEY;
    const fallbackMissing = ["Government ID", "Recent pay stub"];
    const fallbackQuestions = [
      "Can you explain any gaps in rental history?",
      "Is your current income stable for the lease term?",
    ];

    if (!application) {
      throw new Error("Unauthorized or screening context not found");
    }

    if (!groqKey) {
      return {
        summary: `Applicant ${application.fullName} submitted for review. Check income, references, and screening vendor output before approve or deny.`,
        missingDocs: fallbackMissing,
        suggestedQuestions: fallbackQuestions,
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
                "You help landlords review rental applications. Return concise JSON with keys summary (string), missingDocs (string array), suggestedQuestions (string array). Never tell the user to auto-approve or change application status.",
            },
            {
              role: "user",
              content: `Applicant: ${application.fullName}, email ${application.email}, phone ${application.phone}. Status: ${application.status}. Report id: ${args.reportId}.`,
            },
          ],
          temperature: 0.2,
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!response.ok) {
      return {
        summary:
          "AI assist could not run. Use the screening report and application details manually.",
        missingDocs: fallbackMissing,
        suggestedQuestions: fallbackQuestions,
        disabled: false,
      };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      return {
        summary: "No AI summary returned.",
        missingDocs: fallbackMissing,
        suggestedQuestions: fallbackQuestions,
        disabled: false,
      };
    }

    try {
      const parsed = JSON.parse(raw) as {
        summary?: string;
        missingDocs?: string[];
        suggestedQuestions?: string[];
      };
      return {
        summary:
          parsed.summary ??
          "Review screening output and applicant details before deciding.",
        missingDocs: parsed.missingDocs ?? fallbackMissing,
        suggestedQuestions:
          parsed.suggestedQuestions ?? fallbackQuestions,
        disabled: false,
      };
    } catch {
      return {
        summary: raw.trim(),
        missingDocs: fallbackMissing,
        suggestedQuestions: fallbackQuestions,
        disabled: false,
      };
    }
  },
});
