// Attaches the saved auth token to protected requests.
// Use this for authenticated customer, invoice, payment, and settings routes.

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
