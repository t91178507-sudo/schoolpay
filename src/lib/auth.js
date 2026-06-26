import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is missing in environment variables");
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

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized");
    }

    const token = authHeader.split(" ")[1];
    return jwt.verify(token, JWT_SECRET);
  } catch {
    const authError = new Error("Unauthorized");
    authError.status = 401;
    throw authError;
  }
};

export const signToken = (userId) => {
  return jwt.sign({ userId: userId.toString() }, JWT_SECRET, {
    expiresIn: "30d",
  });
};

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
