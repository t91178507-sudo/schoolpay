import { connectDB } from "../../../../lib/mongodb";
import bcrypt from "bcryptjs";
import { signToken } from "../../../../lib/auth";

export async function POST(req) {
  try {
    const db = await connectDB();

    const body = await req.json();
    const email = body.email?.toLowerCase();

    if (!email || !body.password) {
      return Response.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await db.collection("users").findOne({ email });

    if (!user) {
      return Response.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // Support both old plaintext accounts and new hashed ones
    const isMatch = user.password.startsWith("$2")
      ? await bcrypt.compare(body.password, user.password)
      : user.password === body.password;

    if (!isMatch) {
      return Response.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    // ✅ signToken expects just the userId (a string/ObjectId),
    // not a full object — it wraps it internally as { userId }.
    const token = signToken(user._id);

    const { password, ...userData } = user;

    return Response.json({
      success: true,
      token,
      user: userData,
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}