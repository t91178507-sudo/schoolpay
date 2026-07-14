export async function authFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
    },
    credentials: "same-origin",
  });
}
