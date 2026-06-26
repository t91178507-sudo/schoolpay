import { connectDB } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/adminAuth";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(req) {
  try {
    requireAdmin(req);

    const db = await connectDB();

    const users = await db
      .collection("users")
      .find({}, { projection: { password: 0 } })
      .toArray();

    const now = Date.now();

    const usersWithStatus = users.map((user) => {
      const lastActive = user.lastActive ? new Date(user.lastActive) : null;
      const isOnline =
        lastActive && now - lastActive.getTime() < ONLINE_THRESHOLD_MS;

      return {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        businessName: user.businessName,
        businessType: user.businessType,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin || null,
        lastActive: user.lastActive || null,
        isOnline,
      };
    });

    return Response.json(usersWithStatus);

  } catch (error) {
    console.error("ADMIN USERS ERROR:", error);
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Server error" },
      { status }
    );
  }
}