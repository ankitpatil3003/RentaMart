"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

function emailEnabled() {
  return process.env.EMAIL_ENABLED === "true";
}

type EmailPayload = {
  notificationId: Id<"notifications">;
  title: string;
  body: string;
  orgId?: Id<"orgs">;
  toEmail: string;
  emailSentAt?: number;
} | null;

type SendForNotificationResult = {
  sent: boolean;
  skipped: boolean;
  reason?: string;
};

export const sendForNotification = internalAction({
  args: { notificationId: v.id("notifications") },
  returns: v.object({
    sent: v.boolean(),
    skipped: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<SendForNotificationResult> => {
    if (!emailEnabled()) {
      return { sent: false, skipped: true, reason: "EMAIL_ENABLED is not true" };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { sent: false, skipped: true, reason: "RESEND_API_KEY is not set" };
    }

    const payload: EmailPayload = await ctx.runQuery(
      internal.notifications.getForEmail,
      {
        notificationId: args.notificationId,
      },
    );
    if (!payload) {
      return { sent: false, skipped: true, reason: "Notification not found" };
    }
    if (payload.emailSentAt !== undefined) {
      return { sent: false, skipped: true, reason: "Already emailed" };
    }
    if (!payload.toEmail || payload.toEmail.endsWith("@users.clerk.local")) {
      return { sent: false, skipped: true, reason: "No real email on user" };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const from =
      process.env.EMAIL_FROM ?? "RentaMart <onboarding@resend.dev>";
    const link = payload.orgId
      ? `${appUrl}/landlord/notifications?orgId=${payload.orgId}`
      : `${appUrl}/notifications`;

    const response: Response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [payload.toEmail],
        subject: payload.title,
        text: `${payload.body}\n\nOpen RentaMart: ${link}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resend email failed:", response.status, errorText);
      return {
        sent: false,
        skipped: false,
        reason: `Resend HTTP ${response.status}`,
      };
    }

    await ctx.runMutation(internal.notifications.markEmailSent, {
      notificationId: args.notificationId,
    });

    return { sent: true, skipped: false };
  },
});
