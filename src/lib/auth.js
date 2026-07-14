import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";

const JWT_SECRET = process.env.JWT_SECRET;
export const AUTH_COOKIE_NAME = "invoicehub_auth";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing in environment variables");
}

function readCookieValue(cookieHeader, name) {
  if (!cookieHeader) return "";

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || "";
}

export const verifyToken = (req) => {
  try {
    const headers = req.headers;

    let authHeader = null;

    if (headers.get) {
      authHeader = headers.get("authorization");
    }

    if (!authHeader && headers.authorization) {
      authHeader = headers.authorization;
    }

    const cookieHeader = headers.get ? headers.get("cookie") : headers.cookie;
    const bearerToken =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : "";
    const cookieToken = readCookieValue(cookieHeader, AUTH_COOKIE_NAME);
    const token = bearerToken || cookieToken;

    if (!token) {
      throw new Error("Unauthorized");
    }

    return jwt.verify(token, JWT_SECRET);
  } catch {
    const authError = new Error("Unauthorized");
    authError.status = 401;
    throw authError;
  }
};

export const signToken = (userId) => {
  return jwt.sign({ userId: userId.toString() }, JWT_SECRET, {
    expiresIn: "12h",
  });
};

export function buildAuthCookie(token, maxAgeSeconds = 60 * 60 * 12) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clearAuthCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export const requireAuth = (req) => {
  const decoded = verifyToken(req);

  if (!decoded?.userId) {
    const error = new Error("Unauthorized");
    error.status = 401;
    throw error;
  }

  return decoded.userId;
};

export const touchLastActive = (db, userId) => {
  try {
    db.collection("users")
      .updateOne(
        { _id: typeof userId === "string" ? new ObjectId(userId) : userId },
        { $set: { lastActive: new Date() } }
      )
      .catch(() => {
        // Best-effort activity tracking should never break real requests.
      });
  } catch {
    // Ignore tracking failures.
  }
};
