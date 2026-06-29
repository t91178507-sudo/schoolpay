import jwt from "jsonwebtoken";

// ✅ Deliberately separate from JWT_SECRET (used for business owner
// tokens). This means a business owner's token can NEVER be used
// to access admin routes, and vice versa — they're signed with
// different secrets entirely, not just a different payload shape.
const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET;

if (!ADMIN_JWT_SECRET) {
  throw new Error("❌ ADMIN_JWT_SECRET is missing in environment variables");
}

// ✅ Hardcoded single admin account. Not stored in the users
// collection — this is intentionally separate from the regular
// business-owner accounts.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@invoicehub.com";
const ADMIN_PASSWORD_HASH =
  process.env.ADMIN_PASSWORD_HASH ||
  "$2b$10$1BR.DWJJuIWodYxBM6cLre9pqY4ZK7IEE/hGTTuQwWS3Xjtif.H6.";

export function getAdminCredentials() {
  return { email: ADMIN_EMAIL, passwordHash: ADMIN_PASSWORD_HASH };
}

export function signAdminToken() {
  return jwt.sign({ role: "admin" }, ADMIN_JWT_SECRET, {
    expiresIn: "12h",
  });
}

export function verifyAdminToken(req) {
  try {
    const headers = req.headers;

    let authHeader = null;
    if (headers.get) {
      authHeader = headers.get("authorization");
    }
    if (!authHeader && headers.authorization) {
      authHeader = headers.authorization;
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET);

    if (decoded?.role !== "admin") {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

// ✅ Convenience helper for admin-only routes: throws a 401-style
// error if the request isn't carrying a valid admin token.
export function requireAdmin(req) {
  const decoded = verifyAdminToken(req);

  if (!decoded) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }

  return decoded;
}
