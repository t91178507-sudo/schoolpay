import bcrypt from "bcryptjs";
import { requireAccessContext } from "../../../../lib/accessControl";
import { logUserActivity } from "../../../../lib/activityLogs";
import { connectDB } from "../../../../lib/mongodb";
import { ensureDefaultRoles, normalizePermissionMap, serializeRole } from "../../../../lib/staffRoles";

function normalizeStaffUser(user = {}, rolesById = new Map()) {
  const role = rolesById.get(String(user.roleId || "")) || null;

  return {
    _id: String(user._id || ""),
    fullName: user.fullName || "",
    phoneNumber: user.phoneNumber || "",
    email: user.email || "",
    username: user.username || "",
    roleId: String(user.roleId || ""),
    roleName: role?.name || user.roleName || user.role || "",
    roleKey: role?.key || user.roleKey || "",
    assignedBusinessIds: Array.isArray(user.assignedBusinessIds)
      ? user.assignedBusinessIds.map((businessId) => String(businessId))
      : [],
    assignedAllBusinesses: user.assignedAllBusinesses === true,
    status: user.status || "active",
    lastLoginAt: user.lastLoginAt || null,
    loginHistory: Array.isArray(user.loginHistory) ? user.loginHistory : [],
    createdAt: user.createdAt || null,
    permissions: normalizePermissionMap(
      role?.permissions || user.permissions || {}
    ),
  };
}

export async function GET(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db, {
      permission: "settings.view",
    });
    const roles = await ensureDefaultRoles(db, context.ownerId);
    const rolesById = new Map(roles.map((role) => [String(role._id), role]));
    const staff = await db
      .collection("users")
      .find({
        ownerId: context.ownerId,
        accountType: "staff",
      })
      .sort({ createdAt: -1 })
      .toArray();

    return Response.json({
      accounts: staff.map((user) => normalizeStaffUser(user, rolesById)),
      roles: roles.map(serializeRole),
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load staff accounts" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db, {
      permission: "users.create",
    });
    const body = await req.json();
    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const roleId = String(body.roleId || "");
    const status = body.status === "inactive" ? "inactive" : "active";
    const assignedAllBusinesses = body.assignedAllBusinesses === true;
    const assignedBusinessIds = assignedAllBusinesses
      ? context.businesses.map((business) => business._id)
      : Array.isArray(body.assignedBusinessIds)
        ? body.assignedBusinessIds.map((businessId) => String(businessId)).filter(Boolean)
        : [];

    if (!fullName || !email || !username || !password || !roleId) {
      return Response.json(
        { error: "Full name, email, username, password, and role are required." },
        { status: 400 }
      );
    }

    if (assignedBusinessIds.length === 0 && !assignedAllBusinesses) {
      return Response.json(
        { error: "Assign at least one business to this staff account." },
        { status: 400 }
      );
    }

    const existing = await db.collection("users").findOne({
      $or: [{ email }, { username }],
    });

    if (existing) {
      return Response.json(
        { error: "Email or username is already in use." },
        { status: 409 }
      );
    }

    const roles = await ensureDefaultRoles(db, context.ownerId);
    const selectedRole = roles.find((role) => String(role._id) === roleId);

    if (!selectedRole) {
      return Response.json({ error: "Selected role was not found." }, { status: 404 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date();
    const staffUser = {
      fullName,
      phoneNumber: String(body.phoneNumber || "").trim(),
      email,
      username,
      password: hashedPassword,
      role: selectedRole.name,
      roleKey: selectedRole.key,
      roleName: selectedRole.name,
      roleId: String(selectedRole._id),
      permissions: normalizePermissionMap(selectedRole.permissions || {}),
      accountType: "staff",
      ownerId: context.ownerId,
      assignedBusinessIds,
      assignedAllBusinesses,
      businessName: context.owner.businessName || "",
      businessType: context.owner.businessType || "",
      businessLogo: context.owner.businessLogo || "",
      status,
      createdAt: now,
      updatedAt: now,
    };

    const insert = await db.collection("users").insertOne(staffUser);

    await logUserActivity(db, {
      ownerId: context.ownerId,
      actorUserId: context.user._id,
      actorName: context.user.fullName || context.user.email,
      actorAccountType: context.user.accountType,
      businessId: context.primaryBusiness?._id || "",
      businessName: context.primaryBusiness?.name || "",
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
      device: req.headers.get("user-agent") || "",
      action: "Staff Created",
      description: `${context.user.fullName || "Owner"} created staff account ${fullName}.`,
      metadata: {
        staffUserId: String(insert.insertedId),
      },
    });

    return Response.json({
      success: true,
      account: normalizeStaffUser(
        { ...staffUser, _id: insert.insertedId },
        new Map([[String(selectedRole._id), selectedRole]])
      ),
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to create staff account" },
      { status: error.status || 500 }
    );
  }
}
