import { ObjectId } from "mongodb";
import { requireAccessContext } from "../../../../../lib/accessControl";
import { logUserActivity } from "../../../../../lib/activityLogs";
import { connectDB } from "../../../../../lib/mongodb";
import { normalizePermissionMap, serializeRole } from "../../../../../lib/staffRoles";

export async function PATCH(req, context) {
  try {
    const db = await connectDB();
    const access = await requireAccessContext(req, db, {
      permission: "users.edit",
    });
    const { id } = await context.params;
    const body = await req.json();

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid role id." }, { status: 400 });
    }

    const role = await db.collection("staffRoles").findOne({
      _id: new ObjectId(id),
      ownerId: access.ownerId,
    });

    if (!role) {
      return Response.json({ error: "Role not found." }, { status: 404 });
    }

    if (role.system === true) {
      return Response.json(
        { error: "System roles cannot be modified." },
        { status: 403 }
      );
    }

    const updates = {
      name: String(body.name || role.name || "").trim() || role.name,
      description: String(body.description || "").trim(),
      permissions: normalizePermissionMap(body.permissions || role.permissions || {}),
      updatedAt: new Date(),
    };

    await db.collection("staffRoles").updateOne(
      { _id: role._id },
      { $set: updates }
    );

    await logUserActivity(db, {
      ownerId: access.ownerId,
      actorUserId: access.user._id,
      actorName: access.user.fullName || access.user.email,
      actorAccountType: access.user.accountType,
      businessId: access.primaryBusiness?._id || "",
      businessName: access.primaryBusiness?.name || "",
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
      device: req.headers.get("user-agent") || "",
      action: "Role Updated",
      description: `${access.user.fullName || "Owner"} updated the ${updates.name} role.`,
    });

    return Response.json({
      success: true,
      role: serializeRole({
        ...role,
        ...updates,
      }),
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to update role" },
      { status: error.status || 500 }
    );
  }
}

export async function DELETE(req, context) {
  try {
    const db = await connectDB();
    const access = await requireAccessContext(req, db, {
      permission: "users.delete",
    });
    const { id } = await context.params;

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid role id." }, { status: 400 });
    }

    const role = await db.collection("staffRoles").findOne({
      _id: new ObjectId(id),
      ownerId: access.ownerId,
    });

    if (!role) {
      return Response.json({ error: "Role not found." }, { status: 404 });
    }

    if (role.system === true) {
      return Response.json(
        { error: "System roles cannot be deleted." },
        { status: 403 }
      );
    }

    const assignedStaff = await db.collection("users").findOne({
      ownerId: access.ownerId,
      roleId: String(role._id),
      accountType: "staff",
    });

    if (assignedStaff) {
      return Response.json(
        { error: "This role is assigned to one or more staff members." },
        { status: 409 }
      );
    }

    await db.collection("staffRoles").deleteOne({ _id: role._id });

    await logUserActivity(db, {
      ownerId: access.ownerId,
      actorUserId: access.user._id,
      actorName: access.user.fullName || access.user.email,
      actorAccountType: access.user.accountType,
      businessId: access.primaryBusiness?._id || "",
      businessName: access.primaryBusiness?.name || "",
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
      device: req.headers.get("user-agent") || "",
      action: "Role Deleted",
      description: `${access.user.fullName || "Owner"} deleted the ${role.name} role.`,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to delete role" },
      { status: error.status || 500 }
    );
  }
}
