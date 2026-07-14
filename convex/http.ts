import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing signature", { status: 400 });
    }
    const body = await request.text();
    const result = await ctx.runAction(
      internal.paymentsActions.verifyAndApplyWebhook,
      { body, signature },
    );
    if (!result.ok) {
      const status = result.error === "Invalid signature" ? 400 : 500;
      return new Response(result.error ?? "Webhook error", { status });
    }
    return new Response(
      JSON.stringify({ ok: true, deduped: result.deduped ?? false }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }),
});

export default http;
