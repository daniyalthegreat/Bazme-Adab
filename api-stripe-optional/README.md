# Not currently used

Stripe isn't available for Pakistan-based merchant accounts, so these
two functions aren't wired into the site right now. The site currently
uses manual bank/wallet transfer + admin approval instead (see
`pages/payment.html`, `pages/admin-dashboard.html`, and the
`payment_receipts` table in `supabase-setup.sql`).

Kept here in case you later register a business in a Stripe-supported
country, or Stripe adds Pakistan support — the code hasn't changed
from when it was active, so it'd just need to be moved back into an
`api/` folder and reconnected to the dashboard's plan-gate logic.

This folder is NOT deployed by Vercel as-is (only a real `api/` folder
is auto-detected), so leaving it here does nothing until you move it.
