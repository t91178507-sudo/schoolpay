// ✅ Wraps fetch() to automatically attach the saved auth token
// (set at login/register) as a Bearer Authorization header.
// Use this instead of plain fetch() for any call to a protected
// API route (customers, invoices, students, etc).
//
// Public routes (like /api/auth/login, /api/auth/register, and
// the /pay/[token] payment endpoints) should keep using plain
// fetch() since they don't require a logged-in user.

export async function authFetch(url, options = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  return fetch(url, {
    ...options,
    headers,
  });
}