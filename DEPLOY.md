# Going live — step by step

## 1. Create your Supabase project (free)
1. Go to supabase.com → sign up → "New project"
2. Pick a name (e.g. "bazme-adab") and a strong database password — save that password somewhere safe, you won't need it day-to-day but Supabase does
3. Wait ~2 minutes for it to spin up

## 2. Run the database setup
1. In your Supabase project, open the **SQL Editor** (left sidebar)
2. Open `supabase-setup.sql` from this project, copy all of it, paste into the editor, click **Run**
3. This creates all your tables, a private storage bucket for payment receipts, and locks everything down with security rules

## 3. Create the admin account (Ms. Nausheen's login)
Supabase's sign-up flow is meant for students on your registration page. For the ONE admin account, create it manually so it's not open to the public:
1. In Supabase, go to **Authentication → Users → Add user**
2. Enter her email and a password
3. Copy the new user's ID (UUID)
4. Back in **SQL Editor**, run:
   ```sql
   insert into public.admin_profile (id, email) values ('paste-the-uuid-here', 'her-email@example.com');
   ```

## 4. Get your keys
1. Go to **Settings → API**
2. Copy the **Project URL** and the **anon public** key
3. Open `js/config.js` in this project and paste them in:
   ```js
   const SUPABASE_URL = 'https://xxxxx.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJhbGc...';
   ```
   These two values are safe to have in your frontend code — this is how every Supabase app works. Do NOT ever put the separate "service_role" key anywhere in this project — this project doesn't currently need it at all.

## 5. Turn on password reset emails
1. In Supabase: **Authentication → Email Templates** — customize if you like (optional)
2. **Authentication → URL Configuration** — set your Site URL to your real domain once you have one (step 7)
3. Free tier sends a limited number of emails/month via Supabase's built-in sender — fine for a small tutoring site. If you outgrow it, connect a custom SMTP provider (Resend, Gmail) from the same settings page.

## 6. Add real payment details
Open `pages/payment.html` and replace the placeholder bank details with Ms. Nausheen's real ones:
```html
<span class="payment-value">Meezan Bank (placeholder)</span>
...
<span class="payment-value">PK00 XXXX 0000 0000 0000 0000 (placeholder)</span>
```
If she wants to accept JazzCash or Easypaisa too, add extra `payment-row` blocks the same way.

## 7. Push this project to GitHub
```bash
cd bazme-adab
git init
git add .
git commit -m "Initial site"
```
Then create a new repo on github.com and follow its "push existing repo" instructions.
The `.gitignore` already included means nothing sensitive gets committed by accident.

## 8. Deploy for free — Vercel or Netlify
This project is a plain static site right now (no serverless functions needed for the manual payment flow), so either works with zero configuration:

**Vercel:**
1. Go to vercel.com → sign in with GitHub → **Add New Project**
2. Select your repo, click **Deploy**
3. You'll get a free `.vercel.app` URL immediately; add a custom domain later under Project → Settings → Domains

**Netlify** works the same way — "Add new site → Import from Git".

## 9. Test the whole flow before telling real students
1. Register a test student account
2. Choose a plan → you'll land on the payment page with (placeholder or real) bank details
3. Upload any test image as a "receipt" and submit
4. Log in as admin → **Pending payments** should show that submission
5. Click **Approve** → log back in as the test student → the dashboard should now show announcements and the to-do list

## 10. How payment actually works day to day
1. A student registers, picks a plan, and sees your bank/wallet details
2. They send the payment themselves (outside this site, via their banking app)
3. They upload a screenshot of the confirmation as their "receipt"
4. Ms. Nausheen opens the admin dashboard, sees it under **Pending payments**, opens the screenshot to check it, and clicks **Approve** or **Reject**
5. Approving instantly unlocks that student's dashboard — no waiting, no separate step

---

### What's genuinely secure here vs. what to know
- ✅ Passwords are hashed by Supabase, never stored in plaintext
- ✅ Row Level Security means the exposed anon key can't read other students' data or post announcements as if they were the admin
- ✅ Password resets go through real email links, not a demo button
- ✅ Each student's to-do list is private — the database enforces this, not just the frontend
- ✅ A student can never set their own `plan` — the database has no path for that, only an admin action can
- ✅ Receipt screenshots are stored in a private bucket — a student can only see their own uploads, and only admin can see everyone's
- ⚠️ This flow relies on Ms. Nausheen actually checking the payment before approving — the system enforces *who* can approve, not whether the screenshot is genuine. Worth glancing at the amount and sender name each time.
- ⚠️ Nothing currently reminds her to check pending payments regularly — for now, that's a habit rather than an automated notification. If this becomes a hassle, a simple next step would be an email notification (via Supabase's edge functions) whenever a new receipt is submitted.
- ⚠️ Video hosting isn't wired up yet — share recorded lecture and live class links via the announcement's link field. Host videos on YouTube (unlisted) or Vimeo rather than self-hosting large files.
- ⚠️ A real payment gateway (Stripe-alternative for Pakistan, like Safepay or PayFast) can replace this manual flow later without changing how the rest of the site works — see `api-stripe-optional/README.md` for what that would involve.
