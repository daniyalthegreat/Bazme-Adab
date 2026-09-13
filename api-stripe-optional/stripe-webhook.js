/*
  POST /api/stripe-webhook
  Called directly by Stripe's servers (not by your frontend) whenever
  a payment event happens. This is the ONLY place that ever sets a
  student's `plan` column — never trust a browser redirect alone, since
  anyone could visit a "success" URL without actually paying.

  Uses the Supabase SERVICE ROLE key, which bypasses Row Level Security.
  That's intentional and safe here specifically because:
    1. This code only runs on Vercel's servers, never in a browser
    2. Every request is verified as genuinely from Stripe first
       (see the signature check below) before anything runs
  This service role key must NEVER be used anywhere else in this
  project, and never appear in any frontend file.
*/

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Vercel needs the raw request body (unparsed) to verify Stripe's
// signature correctly — this config disables Vercel's default
// JSON body parsing for this one function.
module.exports.config = {
  api: { bodyParser: false },
};

function buffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const rawBody = await buffer(req);
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    // This line is what actually confirms the request came from
    // Stripe and wasn't faked by someone POSTing to this URL directly.
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Payment completed at checkout → grant the plan.
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const studentId = session.client_reference_id;
    const plan = session.metadata && session.metadata.plan;

    if (studentId && plan) {
      const { error } = await supabaseAdmin
        .from('students')
        .update({ plan, stripe_customer_id: session.customer })
        .eq('id', studentId);

      if (error) console.error('Failed to grant plan:', error.message);
    }
  }

  // Subscription cancelled or payment failed on renewal → revoke access.
  if (event.type === 'customer.subscription.deleted' || event.type === 'invoice.payment_failed') {
    const subscription = event.data.object;
    const customerId = subscription.customer;

    const { error } = await supabaseAdmin
      .from('students')
      .update({ plan: 'none' })
      .eq('stripe_customer_id', customerId);

    if (error) console.error('Failed to revoke plan:', error.message);
  }

  res.status(200).json({ received: true });
};
