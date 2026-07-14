import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { requireAuth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/mongodb";
import { enforceRateLimit } from "../../../../lib/rateLimit";

export async function PATCH(req) {
  try {
    enforceRateLimit(req, "auth-password-change", { limit: 6, windowMs: 15 * 60 * 1000 });
    const userId = requireAuth(req);
    const body = await req.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (!currentPassword || !newPassword) {
      return Response.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return Response.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const db = await connectDB();
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const savedPassword = String(user.password || "");
    const passwordMatches = savedPassword.startsWith("$2")
      ? await bcrypt.compare(currentPassword, savedPassword)
      : currentPassword === savedPassword;

    if (!passwordMatches) {
      return Response.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.collection("users").updateOne(
      { _id: user._id },
      {
        $set: {
          password: hashedPassword,
          passwordUpdatedAt: new Date(),
        },
      }
    );

    return Response.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);
    return Response.json(
      { error: error.status === 401 ? "Unauthorized" : "Unable to change password" },
      { status: error.status || 500 }
    );
  }
}
