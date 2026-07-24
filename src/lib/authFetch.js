const BUSINESS_SESSION_KEYS = [
  "isLoggedIn",
  "userName",
  "userEmail",
  "userPhone",
  "username",
  "businessName",
  "businessType",
  "businessLogo",
  "role",
  "roleKey",
  "accountType",
  "ownerId",
  "assignedBusinesses",
  "assignedAllBusinesses",
  "permissions",
];

function clearStaleBusinessSession() {
  if (typeof window === "undefined") {
    return;
  }

  BUSINESS_SESSION_KEYS.forEach((key) => localStorage.removeItem(key));
  window.dispatchEvent(new Event("session-change"));
}

export async function authFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
    },
    credentials: "same-origin",
  });

  if (response.status === 401 && typeof window !== "undefined") {
    clearStaleBusinessSession();

    if (window.location.pathname.startsWith("/dashboard")) {
      window.location.replace("/auth/login");
    }
  }

  return response;
}
