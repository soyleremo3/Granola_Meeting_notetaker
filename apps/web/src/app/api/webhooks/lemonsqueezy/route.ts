import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyLemonSqueezySignature } from "@/lib/lemonsqueezy/verify-signature";

export const runtime = "nodejs"; // needs Node's crypto module + the service-role key

const PRO_GRANTING_EVENTS = new Set([
  "order_created",
  "subscription_created",
  "subscription_updated",
  "subscription_resumed",
  "subscription_unpaused",
]);

const PRO_REVOKING_EVENTS = new Set(["subscription_cancelled", "subscription_expired"]);

export async function POST(request: Request) {
  const rawBody = await request.text(); // signature is computed over the raw bytes, must read as text first
  const signature = request.headers.get("x-signature");
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!secret || !verifyLemonSqueezySignature(rawBody, signature, secret)) {
    return new Response("Invalid signature", { status: 400 });
  }

  const payload = JSON.parse(rawBody);
  const eventName: string = payload?.meta?.event_name;
  const userId: string | undefined = payload?.meta?.custom_data?.user_id;

  if (!userId) {
    return new Response("Missing custom_data.user_id", { status: 400 });
  }

  const attrs = payload?.data?.attributes ?? {};
  const admin = createSupabaseAdminClient();

  if (PRO_GRANTING_EVENTS.has(eventName)) {
    await admin
      .from("profiles")
      .update({
        plan: "pro",
        subscription_status: attrs.status ?? "active",
        lemonsqueezy_customer_id: attrs.customer_id ? String(attrs.customer_id) : undefined,
        lemonsqueezy_subscription_id: eventName.startsWith("subscription") ? String(payload.data.id) : undefined,
      })
      .eq("id", userId);
  } else if (eventName === "subscription_paused") {
    await admin
      .from("profiles")
      .update({ subscription_status: "paused" })
      .eq("id", userId);
  } else if (PRO_REVOKING_EVENTS.has(eventName)) {
    await admin
      .from("profiles")
      .update({
        plan: "free",
        subscription_status: attrs.status ?? eventName.replace("subscription_", ""),
      })
      .eq("id", userId);
  }
  // Other event types (e.g. subscription_payment_failed) are intentionally
  // ignored for this MVP.

  return new Response("OK", { status: 200 });
}
