/*
  Supabase connection config.

  SAFE TO EXPOSE: the values below are meant to be public. Supabase's
  "anon"/"publishable" key only grants what your Row Level Security
  policies (see supabase-setup.sql) allow — it cannot bypass them.
  This is the standard, documented way Supabase apps work in the browser.

  DO NOT put your Supabase "service_role" (secret) key anywhere in this
  project. That key bypasses all security rules and must only ever be
  used in a private backend, never in frontend JS, never committed to
  GitHub.
*/

const SUPABASE_URL = 'https://cbkfqfllahidwkwzzxov.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5Flf_aLSZQX0PyCPKm05kQ_sFd69WTm';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
