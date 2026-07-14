import { ObjectId } from "mongodb";
import { verifyToken } from "./auth";
import {
  ensureDefaultRoles,
  normalizePermissionMap,
  resolveRoleForUser,
} from "./staffRoles";

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

function buildAccessError(message, status = 403) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function buildFullPermissionMap() {
  return normalizePermissionMap(
    Object.fromEntries(
      Object.keys(normalizePermissionMap({})).map((permission) => [permission, true])
    )
  );
}

export function isOwnerAccount(user = {}) {
  return String(user.accountType || "owner") !== "staff";
}

export function getOwnerAccountId(user = {}) {
  return isOwnerAccount(user) ? normalizeId(user._id) : normalizeId(user.ownerId);
}

export function sanitizeBusiness(business = {}) {
  return {
    ...business,
    _id: normalizeId(business._id),
    ownerId: normalizeId(business.ownerId),
  };
}

function buildDefaultBusinessFromOwner(owner = {}) {
  return {
    name: String(owner.businessName || "Main Business").trim() || "Main Business",
    type: String(owner.businessType || "business").trim() || "business",
    logo: String(owner.businessLogo || "").trim(),
    email: String(owner.businessEmail || owner.email || "").trim(),
    phone: String(owner.businessPhone || "").trim(),
    address: String(owner.businessAddress || "").trim(),
    website: String(owner.website || "").trim(),
    active: true,
    isPrimary: true,
  };
}

export async function ensureOwnerPrimaryBusiness(db, owner = {}) {
  const ownerId = getOwnerAccountId(owner);

  if (!ownerId) {
    return null;
  }

  const collection = db.collection("businesses");
  const existingPrimary = await collection.findOne({
    ownerId,
    isPrimary: true,
  });

  if (existingPrimary) {
    return sanitizeBusiness(existingPrimary);
  }

  const fallbackExisting = await collection.findOne({ ownerId });

  if (fallbackExisting) {
    await collection.updateOne(
      { _id: fallbackExisting._id },
      { $set: { isPrimary: true, active: fallbackExisting.active !== false } }
    );
    return sanitizeBusiness({ ...fallbackExisting, isPrimary: true });
  }

  const seeded = {
    ownerId,
    ...buildDefaultBusinessFromOwner(owner),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const insert = await collection.insertOne(seeded);

  const primaryBusinessId = normalizeId(insert.insertedId);
  await db.collection("users").updateOne(
    { _id: typeof owner._id === "string" ? new ObjectId(owner._id) : owner._id },
    {
      $set: {
        primaryBusinessId,
      },
    }
  );

  return sanitizeBusiness({
    ...seeded,
    _id: insert.insertedId,
  });
}

export async function listOwnerBusinesses(db, owner = {}) {
  const ownerId = typeof owner === "string" ? owner : getOwnerAccountId(owner);

  if (!ownerId) {
    return [];
  }

  if (typeof owner === "object" && owner) {
    await ensureOwnerPrimaryBusiness(db, owner);
  }

  const businesses = await db
    .collection("businesses")
    .find({ ownerId, active: { $ne: false } })
    .sort({ isPrimary: -1, createdAt: 1 })
    .toArray();

  return businesses.map(sanitizeBusiness);
}

export function userHasPermission(user = {}, permission) {
  if (!permission) {
    return true;
  }

  if (isOwnerAccount(user)) {
    return true;
  }

  const permissions = normalizePermissionMap(user.permissions || {});
  return permissions[permission] === true;
}

export async function requireAccessContext(req, db, options = {}) {
  const decoded = verifyToken(req);
  const userId = String(decoded?.userId || "");

  if (!ObjectId.isValid(userId)) {
    throw buildAccessError("Unauthorized", 401);
  }

  const user = await db.collection("users").findOne({
    _id: new ObjectId(userId),
  });

  if (!user) {
    throw buildAccessError("Unauthorized", 401);
  }

  if (user.status === "inactive" || user.status === "suspended") {
    throw buildAccessError("This account is inactive.", 403);
  }

  const ownerId = getOwnerAccountId(user);
  const owner =
    ownerId && ownerId !== normalizeId(user._id)
      ? await db.collection("users").findOne({ _id: new ObjectId(ownerId) })
      : user;

  if (!owner) {
    throw buildAccessError("Business owner was not found.", 404);
  }

  const primaryBusiness = await ensureOwnerPrimaryBusiness(db, owner);
  const businesses = await listOwnerBusinesses(db, owner);
  await ensureDefaultRoles(db, ownerId);
  const resolvedRole = await resolveRoleForUser(db, user);

  const assignedBusinessIds =
    isOwnerAccount(user) || user.assignedAllBusinesses === true
      ? businesses.map((business) => business._id)
      : Array.isArray(user.assignedBusinessIds)
        ? user.assignedBusinessIds.map((businessId) => normalizeId(businessId)).filter(Boolean)
        : [];

  const context = {
    user: {
      ...user,
      _id: normalizeId(user._id),
      ownerId,
      roleKey: String(resolvedRole?.key || user.roleKey || user.role || "").toLowerCase(),
      roleName: resolvedRole?.name || user.roleName || user.role || "Staff",
      permissions: isOwnerAccount(user)
        ? buildFullPermissionMap()
        : normalizePermissionMap(
            resolvedRole?.permissions || user.permissions || {}
          ),
    },
    owner: {
      ...owner,
      _id: normalizeId(owner._id),
    },
    ownerId,
    businesses,
    primaryBusiness,
    assignedBusinessIds,
    assignedAllBusinesses: isOwnerAccount(user) || user.assignedAllBusinesses === true,
  };

  if (options.permission && !userHasPermission(context.user, options.permission)) {
    throw buildAccessError("You do not have permission to perform this action.", 403);
  }

  return context;
}

export function buildScopedQuery(context, options = {}) {
  const ownerField = options.ownerField || "ownerId";
  const businessField = options.businessField || "businessId";
  const baseQuery = { ...(options.baseQuery || {}) };
  const ownerId = String(context.ownerId || "");
  const query = {
    ...baseQuery,
    [ownerField]: ownerId,
  };

  if (!isOwnerAccount(context.user)) {
    if (!context.assignedAllBusinesses) {
      query[businessField] = { $in: context.assignedBusinessIds };
    }
  }

  return query;
}

export function getPreferredBusinessId(context, requestedBusinessId = "") {
  const desired = normalizeId(requestedBusinessId);

  if (!desired) {
    if (!isOwnerAccount(context.user)) {
      return context.assignedBusinessIds[0] || "";
    }

    return context.primaryBusiness?._id || "";
  }

  if (isOwnerAccount(context.user)) {
    return desired;
  }

  if (context.assignedAllBusinesses || context.assignedBusinessIds.includes(desired)) {
    return desired;
  }

  throw buildAccessError("You cannot access that business.", 403);
}

export function serializeSessionUser(context) {
  const primaryBusiness =
    context.businesses.find((business) => business._id === context.primaryBusiness?._id) ||
    context.primaryBusiness ||
    null;

  return {
    _id: context.user._id,
    fullName: context.user.fullName || "",
    email: context.user.email || "",
    phoneNumber: context.user.phoneNumber || "",
    username: context.user.username || "",
    businessName:
      context.user.activeBusinessName ||
      primaryBusiness?.name ||
      context.owner.businessName ||
      "",
    businessType:
      primaryBusiness?.type || context.owner.businessType || context.user.businessType || "",
    businessLogo:
      primaryBusiness?.logo || context.owner.businessLogo || context.user.businessLogo || "",
    role: context.user.roleName || context.user.role || "",
    roleKey: context.user.roleKey || "",
    accountType: isOwnerAccount(context.user) ? "owner" : "staff",
    ownerId: context.ownerId,
    assignedBusinesses: context.businesses
      .filter(
        (business) =>
          isOwnerAccount(context.user) ||
          context.assignedAllBusinesses ||
          context.assignedBusinessIds.includes(business._id)
      )
      .map((business) => ({
        _id: business._id,
        name: business.name || "",
        type: business.type || "",
      })),
    permissions: context.user.permissions || {},
    assignedAllBusinesses: context.assignedAllBusinesses === true,
  };
}
