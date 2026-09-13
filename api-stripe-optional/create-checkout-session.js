/*
  POST /api/create-checkout-session
  Body: { plan: 'standard' | '1on1', studentId: '<uuid>', email: '<string>' }

  Creates a Stripe Checkout session and returns its URL. The frontend
  redirects the browser there — actual card entry happens on Stripe's
  own hosted page, so card numbers never touch this site at all.

  Runs server-side only (Vercel serverless function). This is the one
  place your Stripe SECRET key is used — it reads from an environment
  variable, never from a file committed to your repo.
*/

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// Map plan names to their Stripe Price IDs (created in the Stripe
// Dashboard — see DEPLOY.md). Keeping this mapping server-side means
// a student can't tamper with the price by editing frontend code.
const PRICE_IDS = {
  standard: process.env.STRIPE_PRICE_STANDARD,
  '1on1': process.env.STRIPE_PRICE_1ON1,
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { plan, studentId, email } = req.body || {};

  if (!plan || !PRICE_IDS[plan]) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  if (!studentId || !email) {
    return res.status(400).json({ error: 'Missing student details' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', // monthly recurring, matches the $/month plans
      payment_method_types: ['card'],
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      customer_email: email,
      // studentId + plan travel with the session so the webhook knows
      // exactly which student row to update once payment succeeds.
      client_reference_id: studentId,
      metadata: { studentId, plan },
      success_url: `${process.env.SITE_URL}/pages/dashboard.html?checkout=success`,
      cancel_url: `${process.env.SITE_URL}/index.html?checkout=cancelled`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: 'Could not start checkout' });
  }
};
