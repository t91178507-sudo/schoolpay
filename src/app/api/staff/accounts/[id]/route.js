import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { requireAccessContext } from "../../../../../lib/accessControl";
import { logUserActivity } from "../../../../../lib/activityLogs";
import { connectDB } from "../../../../../lib/mongodb";
import { ensureDefaultRoles, normalizePermissionMap } from "../../../../../lib/staffRoles";

async function getStaffRecord(db, ownerId, id) {
  return db.collection("users").findOne({
    _id: new ObjectId(id),
    ownerId,
    accountType: "staff",
  });
}

export async function PATCH(req, context) {
  try {
    const db = await connectDB();
    const access = await requireAccessContext(req, db, {
      permission: "users.edit",
    });
    const { id } = await context.params;
    const body = await req.json();

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid staff id." }, { status: 400 });
    }

    const staff = await getStaffRecord(db, access.ownerId, id);

    if (!staff) {
      return Response.json({ error: "Staff account not found." }, { status: 404 });
    }

    const action = String(body.action || "update");

    if (action === "resetPassword") {
      const nextPassword = String(body.password || "");

      if (nextPassword.length < 6) {
        return Response.json(
          { error: "Enter a password with at least 6 characters." },
          { status: 400 }
        );
      }

      await db.collection("users").updateOne(
        { _id: staff._id },
        {
          $set: {
            password: await bcrypt.hash(nextPassword, 10),
            updatedAt: new Date(),
          },
        }
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
        action: "Staff Password Reset",
        description: `${access.user.fullName || "Owner"} reset ${staff.fullName}'s password.`,
      });

      return Response.json({ success: true });
    }

    const roles = await ensureDefaultRoles(db, access.ownerId);
    const selectedRole = roles.find((role) => String(role._id) === String(body.roleId || staff.roleId || ""));

    if (!selectedRole) {
      return Response.json({ error: "Selected role was not found." }, { status: 404 });
    }

    const assignedAllBusinesses = body.assignedAllBusinesses === true;
    const assignedBusinessIds = assignedAllBusinesses
      ? access.businesses.map((business) => business._id)
      : Array.isArray(body.assignedBusinessIds)
        ? body.assignedBusinessIds.map((businessId) => String(businessId)).filter(Boolean)
        : Array.isArray(staff.assignedBusinessIds)
          ? staff.assignedBusinessIds.map((businessId) => String(businessId))
          : [];

    const updates = {
      fullName: String(body.fullName || staff.fullName || "").trim() || staff.fullName,
      phoneNumber: String(body.phoneNumber ?? staff.phoneNumber ?? "").trim(),
      email: String(body.email || staff.email || "").trim().toLowerCase(),
      username: String(body.username || staff.username || "").trim().toLowerCase(),
      roleId: String(selectedRole._id),
      role: selectedRole.name,
      roleKey: selectedRole.key,
      roleName: selectedRole.name,
      permissions: normalizePermissionMap(selectedRole.permissions || {}),
      assignedAllBusinesses,
      assignedBusinessIds,
      status:
        action === "suspend"
          ? "inactive"
          : body.status === "inactive"
            ? "inactive"
            : "active",
      updatedAt: new Date(),
    };

    await db.collection("users").updateOne(
      { _id: staff._id },
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
      action:
        action === "suspend" ? "Staff Suspended" : "Staff Updated",
      description:
        action === "suspend"
          ? `${access.user.fullName || "Owner"} suspended ${staff.fullName}.`
          : `${access.user.fullName || "Owner"} updated ${staff.fullName}.`,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to update staff account" },
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
      return Response.json({ error: "Invalid staff id." }, { status: 400 });
    }

    const staff = await getStaffRecord(db, access.ownerId, id);

    if (!staff) {
      return Response.json({ error: "Staff account not found." }, { status: 404 });
    }

    await db.collection("users").deleteOne({ _id: staff._id });

    await logUserActivity(db, {
      ownerId: access.ownerId,
      actorUserId: access.user._id,
      actorName: access.user.fullName || access.user.email,
      actorAccountType: access.user.accountType,
      businessId: access.primaryBusiness?._id || "",
      businessName: access.primaryBusiness?.name || "",
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
      device: req.headers.get("user-agent") || "",
      action: "Staff Deleted",
      description: `${access.user.fullName || "Owner"} deleted ${staff.fullName}.`,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to delete staff account" },
      { status: error.status || 500 }
    );
  }
}
