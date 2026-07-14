import bcrypt from "bcryptjs";
import {
  buildAdminAuthCookie,
  getAdminCredentials,
  signAdminToken,
} from "../../../../../lib/adminAuth";
import { enforceRateLimit } from "../../../../../lib/rateLimit";

export async function POST(req) {
  try {
    enforceRateLimit(req, "admin-auth-login", { limit: 5, windowMs: 15 * 60 * 1000 });
    const body = await req.json();
    const email = body.email?.toLowerCase().trim();

    if (!email || !body.password) {
      return Response.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const { email: adminEmail, passwordHash } = getAdminCredentials();

    if (email !== adminEmail) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(body.password, passwordHash);

    if (!isMatch) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = signAdminToken();

    return Response.json(
      {
        success: true,
      },
      {
        headers: {
          "Set-Cookie": buildAdminAuthCookie(token),
        },
      }
    );

  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error);
    return Response.json(
      { error: error.message || "Server error" },
      { status: error.status || 500 }
    );
  }
}
