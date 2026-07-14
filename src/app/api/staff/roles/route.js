import { requireAccessContext } from "../../../../lib/accessControl";
import { logUserActivity } from "../../../../lib/activityLogs";
import { connectDB } from "../../../../lib/mongodb";
import {
  ensureDefaultRoles,
  normalizePermissionMap,
  serializeRole,
} from "../../../../lib/staffRoles";

function slugifyRoleKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function GET(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db, {
      permission: "settings.view",
    });
    const roles = await ensureDefaultRoles(db, context.ownerId);

    return Response.json(roles.map(serializeRole));
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load roles" },
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
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const key = slugifyRoleKey(body.key || name);

    if (!name || !key) {
      return Response.json(
        { error: "Role name is required." },
        { status: 400 }
      );
    }

    const existing = await db.collection("staffRoles").findOne({
      ownerId: context.ownerId,
      key,
    });

    if (existing) {
      return Response.json(
        { error: "A role with this name already exists." },
        { status: 409 }
      );
    }

    const role = {
      ownerId: context.ownerId,
      key,
      name,
      description,
      system: false,
      permissions: normalizePermissionMap(body.permissions || {}),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insert = await db.collection("staffRoles").insertOne(role);

    await logUserActivity(db, {
      ownerId: context.ownerId,
      actorUserId: context.user._id,
      actorName: context.user.fullName || context.user.email,
      actorAccountType: context.user.accountType,
      businessId: context.primaryBusiness?._id || "",
      businessName: context.primaryBusiness?.name || "",
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
      device: req.headers.get("user-agent") || "",
      action: "Role Created",
      description: `${context.user.fullName || "Owner"} created the ${name} role.`,
    });

    return Response.json({
      success: true,
      role: serializeRole({
        ...role,
        _id: insert.insertedId,
      }),
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to create role" },
      { status: error.status || 500 }
    );
  }
}
