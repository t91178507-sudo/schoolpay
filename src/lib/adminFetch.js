// ✅ Parallel to authFetch, but for admin sessions specifically.
// Reads 'adminToken' (not 'authToken') so business-owner and admin
// sessions never get mixed up on the client side either.

export async function adminFetch(url, options = {}) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  return fetch(url, {
    ...options,
    headers,
  });
}