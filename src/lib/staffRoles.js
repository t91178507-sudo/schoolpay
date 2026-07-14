import { ObjectId } from "mongodb";
import {
  ALL_PERMISSIONS,
  labelPermission,
  PERMISSION_GROUPS,
} from "./staffPermissions";

const OWNER_PERMISSIONS = Object.freeze(
  ALL_PERMISSIONS.reduce((accumulator, permission) => {
    accumulator[permission] = true;
    return accumulator;
  }, {})
);

const MANAGER_PERMISSIONS = Object.freeze({
  "customers.view": true,
  "customers.create": true,
  "customers.edit": true,
  "invoices.view": true,
  "invoices.create": true,
  "invoices.edit": true,
  "payments.view": true,
  "payments.record": true,
  "payments.validateReceipts": true,
  "payments.viewPending": true,
  "payments.approve": true,
  "payments.reject": true,
  "communication.sendWhatsApp": true,
  "communication.sendReminders": true,
  "communication.sendReceipts": true,
  "qr.generate": true,
  "qr.share": true,
  "reports.view": true,
});

const CASHIER_PERMISSIONS = Object.freeze({
  "customers.view": true,
  "invoices.view": true,
  "invoices.create": true,
  "payments.view": true,
  "payments.record": true,
  "payments.viewPending": true,
  "communication.sendWhatsApp": true,
  "communication.sendReceipts": true,
  "qr.generate": true,
  "qr.share": true,
});

const ACCOUNTANT_PERMISSIONS = Object.freeze({
  "customers.view": true,
  "invoices.view": true,
  "payments.view": true,
  "payments.record": true,
  "payments.validateReceipts": true,
  "payments.viewPending": true,
  "payments.approve": true,
  "payments.reject": true,
  "reports.view": true,
  "reports.export": true,
});

export const DEFAULT_ROLE_DEFINITIONS = Object.freeze([
  {
    key: "owner",
    name: "Owner",
    description: "Full business control across every branch and permission.",
    system: true,
    permissions: OWNER_PERMISSIONS,
  },
  {
    key: "manager",
    name: "Manager",
    description: "Oversees customers, invoices, payments, receipts, and branch activity.",
    system: true,
    permissions: MANAGER_PERMISSIONS,
  },
  {
    key: "cashier",
    name: "Cashier",
    description: "Handles front-desk collections, invoices, QR sharing, and receipts.",
    system: true,
    permissions: CASHIER_PERMISSIONS,
  },
  {
    key: "accountant",
    name: "Accountant",
    description: "Monitors payments, receipts, and reporting for the business.",
    system: true,
    permissions: ACCOUNTANT_PERMISSIONS,
  },
]);

export function normalizePermissionMap(value = {}) {
  return ALL_PERMISSIONS.reduce((accumulator, permission) => {
    accumulator[permission] = value[permission] === true;
    return accumulator;
  }, {});
}

export function serializeRole(role = {}) {
  return {
    ...role,
    _id: role?._id ? String(role._id) : "",
    permissions: normalizePermissionMap(role.permissions || {}),
  };
}

export async function ensureDefaultRoles(db, ownerId) {
  const normalizedOwnerId =
    typeof ownerId === "string" ? ownerId : String(ownerId || "");

  if (!normalizedOwnerId) {
    return [];
  }

  const collection = db.collection("staffRoles");
  const existing = await collection
    .find({ ownerId: normalizedOwnerId })
    .toArray();
  const existingKeys = new Set(existing.map((role) => role.key));
  const now = new Date();

  const missing = DEFAULT_ROLE_DEFINITIONS.filter(
    (role) => !existingKeys.has(role.key)
  ).map((role) => ({
    ownerId: normalizedOwnerId,
    key: role.key,
    name: role.name,
    description: role.description,
    system: role.system === true,
    permissions: normalizePermissionMap(role.permissions),
    createdAt: now,
    updatedAt: now,
  }));

  if (missing.length) {
    await collection.insertMany(missing);
  }

  return collection.find({ ownerId: normalizedOwnerId }).sort({ name: 1 }).toArray();
}

export async function resolveRoleForUser(db, user = {}) {
  const ownerId =
    user.accountType === "staff"
      ? String(user.ownerId || "")
      : String(user._id || "");

  if (!ownerId) {
    return null;
  }

  await ensureDefaultRoles(db, ownerId);

  const roleId = String(user.roleId || "");

  if (roleId && ObjectId.isValid(roleId)) {
    const explicitRole = await db.collection("staffRoles").findOne({
      _id: new ObjectId(roleId),
      ownerId,
    });

    if (explicitRole) {
      return explicitRole;
    }
  }

  const roleKey = String(user.roleKey || user.role || "").trim().toLowerCase();

  if (roleKey) {
    return db.collection("staffRoles").findOne({
      ownerId,
      key: roleKey,
    });
  }

  return null;
}

export { ALL_PERMISSIONS, PERMISSION_GROUPS, labelPermission };
