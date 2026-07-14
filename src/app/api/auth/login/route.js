import bcrypt from "bcryptjs";
import { appendLoginHistory, getRequestDevice, getRequestIp, logUserActivity } from "../../../../lib/activityLogs";
import { requireAccessContext, serializeSessionUser } from "../../../../lib/accessControl";
import { buildAuthCookie, signToken } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/mongodb";
import { enforceRateLimit } from "../../../../lib/rateLimit";

export async function POST(req) {
  try {
    enforceRateLimit(req, "auth-login", { limit: 8, windowMs: 10 * 60 * 1000 });
    const db = await connectDB();
    const body = await req.json();
    const identifier = String(
      body.identifier || body.email || body.username || ""
    )
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const ipAddress = getRequestIp(req);
    const device = getRequestDevice(req);

    if (!identifier || !password) {
      return Response.json(
        { error: "Email or username and password are required" },
        { status: 400 }
      );
    }

    const user = await db.collection("users").findOne({
      $or: [
        { email: identifier },
        { username: identifier },
      ],
    });

    if (!user) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (user.status === "inactive" || user.status === "suspended") {
      return Response.json(
        { error: "This account is inactive. Please contact the business owner." },
        { status: 403 }
      );
    }

    const usesHashedPassword = String(user.password || "").startsWith("$2");
    const isMatch = usesHashedPassword
      ? await bcrypt.compare(password, user.password)
      : user.password === password;

    if (!isMatch) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!usesHashedPassword) {
      await db.collection("users").updateOne(
        { _id: user._id },
        {
          $set: {
            password: await bcrypt.hash(password, 10),
            passwordUpdatedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );
    }

    const token = signToken(user._id);
    const authReq = new Request(req.url, {
      method: "GET",
      headers: new Headers({
        authorization: `Bearer ${token}`,
      }),
    });
    const accessContext = await requireAccessContext(authReq, db);
    const sessionUser = serializeSessionUser(accessContext);

    await appendLoginHistory(db, user._id, {
      ipAddress,
      device,
      success: true,
    });

    await db.collection("users").updateOne(
      { _id: user._id },
      {
        $set: {
          lastActive: new Date(),
        },
      }
    );

    await logUserActivity(db, {
      ownerId: accessContext.ownerId,
      actorUserId: accessContext.user._id,
      actorName:
        accessContext.user.fullName ||
        accessContext.user.email ||
        accessContext.user.username,
      actorAccountType: accessContext.user.accountType || "owner",
      businessId: accessContext.primaryBusiness?._id || "",
      businessName:
        accessContext.primaryBusiness?.name ||
        accessContext.owner.businessName ||
        "",
      ipAddress,
      device,
      action: "Login",
      description:
        accessContext.user.accountType === "staff"
          ? `${accessContext.user.fullName || "Staff"} signed in to the mobile dashboard.`
          : `${accessContext.user.fullName || "Owner"} signed in to the owner dashboard.`,
    });

    return Response.json(
      {
        success: true,
        user: sessionUser,
      },
      {
        headers: {
          "Set-Cookie": buildAuthCookie(token),
        },
      }
    );
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return Response.json(
      { error: error.message || "Server error" },
      { status: error.status || 500 }
    );
  }
}
