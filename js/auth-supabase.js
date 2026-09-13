/*
  Supabase-backed auth + gating logic.
  Same function names as the localStorage prototype, so the existing
  HTML pages work unchanged. Requires config.js (loaded before this
  file) and the Supabase JS library <script> tag — see index.html
  for the exact include order.
*/

// ---- students ----
async function registerStudent(name, email, password) {
  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) return { ok: false, error: error.message };

  // Create the matching profile row (name + email) once signed up.
  const { error: profileError } = await supabaseClient
    .from('students')
    .insert({ id: data.user.id, name, email });
  if (profileError) return { ok: false, error: profileError.message };

  return { ok: true };
}

async function loginStudent(email, password) {
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function getCurrentStudent() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return null;
  const { data } = await supabaseClient
    .from('students')
    .select('*')
    .eq('id', user.id)
    .single();
  return data || null;
}

async function logoutStudent() {
  await supabaseClient.auth.signOut();
}

async function requestStudentPasswordReset(email) {
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/pages/reset-password-confirm.html'
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---- Google sign-in (shared by students and admin) ----
// Supabase redirects to Google, then back to `redirectPage` on this
// site once signed in. The actual routing decision (student vs admin,
// and creating a first-time student profile row) happens in
// completeGoogleSignIn(), called once on that redirect page's load —
// see pages/dashboard.html and pages/admin-login.html.
async function signInWithGoogle(redirectPage) {
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/pages/${redirectPage}`,
    },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true }; // browser leaves the page here; nothing after this runs
}

// Call this once when a page loads after a Google redirect. It
// figures out who just signed in and makes sure a `students` row
// exists for them (Google sign-in has no separate "register" step,
// unlike email/password, so we create the profile here on first use).
async function completeGoogleSignIn() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return { ok: false, isAdmin: false };

  const { data: adminRow } = await supabaseClient
    .from('admin_profile')
    .select('id')
    .eq('id', user.id)
    .single();
  if (adminRow) return { ok: true, isAdmin: true };

  // Not an admin — treat as a student. Create their profile row on
  // first Google sign-in if it doesn't exist yet.
  const { data: existingStudent } = await supabaseClient
    .from('students')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!existingStudent) {
    const googleName =
      (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ||
      user.email;
    const { error: insertError } = await supabaseClient
      .from('students')
      .insert({ id: user.id, name: googleName, email: user.email });
    if (insertError) return { ok: false, isAdmin: false, error: insertError.message };
  }

  return { ok: true, isAdmin: false };
}

// ---- admin ----
// Admin uses the same Supabase auth, just checked against the
// admin_profile table instead of students.
async function loginAdmin(email, password) {
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: 'Incorrect email or password.' };

  const { data: { user } } = await supabaseClient.auth.getUser();
  const { data: adminRow } = await supabaseClient
    .from('admin_profile')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!adminRow) {
    await supabaseClient.auth.signOut();
    return { ok: false, error: 'This account is not an admin account.' };
  }
  return { ok: true };
}

async function requestAdminPasswordReset(email) {
  return requestStudentPasswordReset(email); // same underlying mechanism
}

async function isAdminLoggedIn() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return false;
  const { data } = await supabaseClient
    .from('admin_profile')
    .select('id')
    .eq('id', user.id)
    .single();
  return !!data;
}

async function logoutAdmin() {
  await supabaseClient.auth.signOut();
}

// ---- announcements (admin posts, students read) ----
async function fetchAnnouncements() {
  const { data, error } = await supabaseClient
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data;
}

async function postAnnouncement(content, linkUrl, linkLabel) {
  const { error } = await supabaseClient
    .from('announcements')
    .insert({ content, link_url: linkUrl, link_label: linkLabel });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function deleteAnnouncement(id) {
  const { error } = await supabaseClient
    .from('announcements')
    .delete()
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---- personal to-do list (each student manages only their own) ----
async function fetchTodos(studentId) {
  const { data, error } = await supabaseClient
    .from('todos')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data;
}

async function addTodo(studentId, task) {
  const { error } = await supabaseClient
    .from('todos')
    .insert({ student_id: studentId, task, is_done: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function toggleTodo(id, isDone) {
  const { error } = await supabaseClient
    .from('todos')
    .update({ is_done: isDone })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function deleteTodo(id) {
  const { error } = await supabaseClient
    .from('todos')
    .delete()
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ---- payment receipts (manual bank/wallet transfer + admin approval) ----
// Students upload a screenshot as proof of payment; admin reviews and
// approves/rejects. Approving is what actually sets the student's plan.

async function submitPaymentReceipt(studentId, plan, file, note) {
  // Store each student's files under their own folder — this is what
  // the storage policies in supabase-setup.sql check against, so a
  // student can only ever read their own uploaded receipts.
  const filePath = `${studentId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabaseClient
    .storage
    .from('receipts')
    .upload(filePath, file);
  if (uploadError) return { ok: false, error: uploadError.message };

  const { error: insertError } = await supabaseClient
    .from('payment_receipts')
    .insert({
      student_id: studentId,
      plan,
      receipt_url: filePath,
      note: note || null,
      status: 'pending',
    });
  if (insertError) return { ok: false, error: insertError.message };

  return { ok: true };
}

async function fetchMyReceipts(studentId) {
  const { data, error } = await supabaseClient
    .from('payment_receipts')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data;
}

// ---- admin: reviewing payment receipts ----
async function fetchPendingReceipts() {
  const { data, error } = await supabaseClient
    .from('payment_receipts')
    .select('*, students(name, email)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) return [];
  return data;
}

async function getReceiptFileUrl(receiptPath) {
  // Receipts are private, so this creates a temporary signed link
  // (expires in an hour) rather than a permanent public URL.
  const { data, error } = await supabaseClient
    .storage
    .from('receipts')
    .createSignedUrl(receiptPath, 3600);
  if (error) return null;
  return data.signedUrl;
}

async function approveReceipt(receiptId, studentId, plan) {
  const { error: receiptError } = await supabaseClient
    .from('payment_receipts')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', receiptId);
  if (receiptError) return { ok: false, error: receiptError.message };

  const { error: planError } = await supabaseClient
    .from('students')
    .update({ plan })
    .eq('id', studentId);
  if (planError) return { ok: false, error: planError.message };

  return { ok: true };
}

async function rejectReceipt(receiptId) {
  const { error } = await supabaseClient
    .from('payment_receipts')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', receiptId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}