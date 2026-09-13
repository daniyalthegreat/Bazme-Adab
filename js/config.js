/*
  Supabase connection config.

  SAFE TO EXPOSE: the values below are meant to be public. Supabase's
  "anon" key only grants what your Row Level Security policies (see
  supabase-setup.sql) allow — it cannot bypass them. This is the
  standard, documented way Supabase apps work in the browser.

  DO NOT put your Supabase "service_role" key anywhere in this project.
  That key bypasses all security rules and must only ever be used in a
  private backend (e.g. a Vercel serverless function), never in
  frontend JS, never committed to GitHub.

  Fill these in from: Supabase Dashboard → Settings → API
*/

const SUPABASE_URL = 'YOUR_PROJECT_URL_HERE';       // e.g. https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY_HERE';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
