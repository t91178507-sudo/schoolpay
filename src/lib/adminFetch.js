export async function adminFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
    },
    credentials: "same-origin",
  });
}
