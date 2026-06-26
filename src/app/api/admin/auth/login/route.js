import bcrypt from "bcryptjs";
import { getAdminCredentials, signAdminToken } from "../../../../../lib/adminAuth";

export async function POST(req) {
  try {
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

    return Response.json({
      success: true,
      token,
    });

  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}