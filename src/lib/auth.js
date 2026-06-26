import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("❌ JWT_SECRET is missing in environment variables");
}

// ✅ Verify a token from the Authorization header.
// Returns the decoded payload ({ userId, iat, exp }) if valid.
// Throws "Unauthorized" if missing/invalid/expired.
export const verifyToken = (req) => {
  try {
    const headers = req.headers;

    let authHeader = null;

    // Standard (App Router)
    if (headers.get) {
      authHeader = headers.get("authorization");
    }

    // Fallback (Node-style)
    if (!authHeader && headers.authorization) {
      authHeader = headers.authorization;
    }

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized");
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, JWT_SECRET);

    return decoded;

  } catch (error) {
    const authError = new Error("Unauthorized");
    authError.status = 401;
    throw authError;
  }
};

// ✅ Create a signed token for a logged-in/registered user.
// Always pass the userId directly (not a full object) — only the
// ID goes in the payload, never sensitive data like passwords.
export const signToken = (userId) => {
  return jwt.sign({ userId: userId.toString() }, JWT_SECRET, {
    expiresIn: "30d",
  });
};

// ✅ Convenience helper for protected routes: verifies the token
// and returns just the userId string, or throws a 401-style error
// the route's catch block can handle.
export const requireAuth = (req) => {
  const decoded = verifyToken(req);

  if (!decoded?.userId) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }

  return decoded.userId;
};

// ✅ Fire-and-forget: updates the user's lastActive timestamp.
// Call this from any authenticated route after requireAuth() —
// it does NOT block the response (no await needed by the caller),
// so it adds no latency to normal requests. Used to infer
// "online/offline" status on the admin Users page.
export const touchLastActive = (db, userId) => {
  try {
    db.collection("users").updateOne(
      { _id: typeof userId === "string" ? new (require("mongodb").ObjectId)(userId) : userId },
      { $set: { lastActive: new Date() } }
    ).catch(() => {
      // Silently ignore — this is best-effort tracking, never
      // worth failing a real request over.
    });
  } catch (err) {
    // Same — never let tracking break the actual request.
  }
};