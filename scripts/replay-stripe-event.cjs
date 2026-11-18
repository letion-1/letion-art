
const { loadEnvConfig } = require("@next/env");
const Stripe = require("stripe");

loadEnvConfig(process.cwd(), true);

const secretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const eventId = process.argv[2];

async function main() {
  if (!secretKey?.startsWith("sk_test_")) {
    throw new Error("A Stripe test-mode secret key is required.");
  }

  if (!webhookSecret?.startsWith("whsec_")) {
    throw new Error("STRIPE_WEBHOOK_SECRET is missing.");
  }

  if (!eventId?.startsWith("evt_")) {
    throw new Error("Provide a valid Stripe event ID.");
  }

  const stripe = new Stripe(secretKey);

  // Retrieve the original event from Stripe.
  const event = await stripe.events.retrieve(eventId);

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    throw new Error("This script only replays successful checkout events.");
  }

  const payload = JSON.stringify(event);

  // Generate a valid signature for our local webhook.
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret: webhookSecret,
  });

  console.log("Replaying:", event.id);
  console.log("Event type:", event.type);

  const response = await fetch(
    "http://127.0.0.1:3000/api/stripe/webhook",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      body: payload,
      signal: AbortSignal.timeout(30000),
    }
  );

  console.log("HTTP status:", response.status);
  console.log("Response:", await response.text());

  if (!response.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error("Replay failed:", error.message);
  process.exitCode = 1;
});
