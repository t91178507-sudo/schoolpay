import { ObjectId } from "mongodb";

function normalizeId(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value.toString === "function") {
    return value.toString();
  }

  return "";
}

export function getRequestIp(req) {
  return (
    req?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
    req?.headers?.get?.("x-real-ip") ||
    ""
  );
}

export function getRequestDevice(req) {
  return req?.headers?.get?.("user-agent") || "";
}

export async function logUserActivity(db, entry = {}) {
  const ownerId = normalizeId(entry.ownerId);

  if (!ownerId) {
    return null;
  }

  const record = {
    ownerId,
    actorUserId: normalizeId(entry.actorUserId),
    actorName: String(entry.actorName || "").trim(),
    actorAccountType: String(entry.actorAccountType || "").trim(),
    action: String(entry.action || "").trim() || "Activity",
    description: String(entry.description || "").trim(),
    businessId: normalizeId(entry.businessId),
    businessName: String(entry.businessName || "").trim(),
    ipAddress: String(entry.ipAddress || "").trim(),
    device: String(entry.device || "").trim(),
    metadata: entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {},
    createdAt: entry.createdAt instanceof Date ? entry.createdAt : new Date(),
  };

  const result = await db.collection("activityLogs").insertOne(record);
  return {
    ...record,
    _id: result.insertedId,
  };
}

export async function fetchOwnerActivityLogs(db, ownerId, options = {}) {
  const normalizedOwnerId = normalizeId(ownerId);
  const limit = Math.min(Math.max(Number(options.limit || 50), 1), 200);
  const query = { ownerId: normalizedOwnerId };

  if (options.actorUserId) {
    query.actorUserId = normalizeId(options.actorUserId);
  }

  if (options.businessId) {
    query.businessId = normalizeId(options.businessId);
  }

  return db.collection("activityLogs").find(query).sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function appendLoginHistory(db, userId, entry = {}) {
  if (!userId || !ObjectId.isValid(String(userId))) {
    return;
  }

  const loginEntry = {
    at: entry.at instanceof Date ? entry.at : new Date(),
    ipAddress: String(entry.ipAddress || "").trim(),
    device: String(entry.device || "").trim(),
    success: entry.success !== false,
  };

  await db.collection("users").updateOne(
    { _id: new ObjectId(String(userId)) },
    {
      $set: {
        lastLoginAt: loginEntry.at,
        lastLoginIp: loginEntry.ipAddress,
        lastLoginDevice: loginEntry.device,
      },
      $push: {
        loginHistory: {
          $each: [loginEntry],
          $position: 0,
          $slice: 20,
        },
      },
    }
  );
}
