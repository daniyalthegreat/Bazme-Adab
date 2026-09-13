-- ============================================================
-- Bazme Adab — Supabase setup
-- Paste this into Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- Students table (linked to Supabase's built-in auth.users)
create table if not exists public.students (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  plan text not null default 'none', -- 'none' | 'standard' | '1on1'
  stripe_customer_id text,
  created_at timestamp with time zone default now()
);

-- Admin table (Ms. Nausheen only — just one row)
create table if not exists public.admin_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique
);

-- Announcements — posted only by admin, visible to all registered students.
-- content: the message text.
-- link_url / link_label: optional (e.g. a recorded lecture link or a
-- live class call link), shown as a button under the message.
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  link_url text,
  link_label text,
  created_at timestamp with time zone default now()
);

-- Personal to-do list — each student manages only their own tasks.
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  task text not null,
  is_done boolean not null default false,
  created_at timestamp with time zone default now()
);

-- Payment receipts — a student claims "I've paid" and uploads proof;
-- Ms. Nausheen reviews and approves/rejects from the admin panel.
-- Approving a receipt is the ONLY thing that sets a student's plan
-- (besides a possible future automated gateway). Students can see
-- their own receipt's status, but can never approve it themselves.
create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  plan text not null, -- 'standard' | '1on1' — which plan they're claiming
  receipt_url text not null, -- link to the uploaded screenshot
  note text, -- optional: student can add a reference number, sender name, etc.
  status text not null default 'pending', -- 'pending' | 'approved' | 'rejected'
  created_at timestamp with time zone default now(),
  reviewed_at timestamp with time zone
);

-- ============================================================
-- Storage bucket for receipt uploads
-- Run this section too — it creates a private storage bucket where
-- receipt screenshots live. "Private" means files aren't public URLs;
-- only the uploading student and the admin can access them.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "Students upload own receipts"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Students read own receipt files"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Admin reads all receipt files"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and exists (select 1 from public.admin_profile where id = auth.uid())
  );

-- ============================================================
-- Row Level Security — this is what makes the public anon key safe.
-- Without these rules, anyone with the anon key could read/edit
-- everyone's data. With them, the database itself enforces who
-- can see or change what, no matter what the frontend code does.
-- ============================================================

alter table public.students enable row level security;
alter table public.admin_profile enable row level security;
alter table public.announcements enable row level security;
alter table public.todos enable row level security;
alter table public.payment_receipts enable row level security;

-- Students can read only their own row
create policy "Students read own row"
  on public.students for select
  using (auth.uid() = id);

-- Students can insert their own row on signup, but CANNOT set their
-- own plan to anything but 'none' — this stops someone from just
-- editing their row to grant themselves paid access. Only an admin
-- action (approving a payment receipt) is allowed to change plan.
create policy "Students insert own row on signup"
  on public.students for insert
  with check (auth.uid() = id and plan = 'none');

-- Deliberately no UPDATE policy for students on this table — they
-- have no path to change their own plan, ever, from the frontend.

-- Admin CAN update a student's plan — this is how approving a
-- payment receipt actually grants access (see payment_receipts
-- policies below, which use this same admin check).
create policy "Admin can update student plans"
  on public.students for update
  using (exists (select 1 from public.admin_profile where id = auth.uid()))
  with check (exists (select 1 from public.admin_profile where id = auth.uid()));

-- Admin profile is only readable by the matching logged-in admin
create policy "Admin reads own profile"
  on public.admin_profile for select
  using (auth.uid() = id);

-- Announcements: only students with an active paid plan can read —
-- not just "signed in". This closes the gap where someone could call
-- the Supabase API directly (bypassing the dashboard's own gate) and
-- still read announcements without ever paying.
create policy "Paying students can read announcements"
  on public.announcements for select
  using (
    exists (select 1 from public.admin_profile where id = auth.uid())
    or exists (
      select 1 from public.students
      where id = auth.uid() and plan <> 'none'
    )
  );

create policy "Only admin can post announcements"
  on public.announcements for insert
  with check (exists (select 1 from public.admin_profile where id = auth.uid()));

create policy "Only admin can delete announcements"
  on public.announcements for delete
  using (exists (select 1 from public.admin_profile where id = auth.uid()));

-- Todos: a student can only see and manage their own tasks — never
-- another student's, and admin has no special access to this table
-- (it's genuinely personal).
create policy "Students manage own todos"
  on public.todos for all
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

-- Payment receipts: a student can submit their own claim and see
-- its status, but can never set status to 'approved' themselves —
-- the insert is locked to 'pending' only. Admin can read every
-- receipt and update status (approve/reject).
create policy "Students insert own pending receipt"
  on public.payment_receipts for insert
  with check (auth.uid() = student_id and status = 'pending');

create policy "Students read own receipts"
  on public.payment_receipts for select
  using (auth.uid() = student_id);

create policy "Admin reads all receipts"
  on public.payment_receipts for select
  using (exists (select 1 from public.admin_profile where id = auth.uid()));

create policy "Admin updates receipt status"
  on public.payment_receipts for update
  using (exists (select 1 from public.admin_profile where id = auth.uid()))
  with check (exists (select 1 from public.admin_profile where id = auth.uid()));
