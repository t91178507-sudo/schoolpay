import bcrypt from "bcryptjs";
import { connectDB } from "../../../../lib/mongodb";
import {
  getPasswordPolicyMessage,
  isStrongPassword,
} from "../../../../lib/passwordPolicy";
import { enforceRateLimit } from "../../../../lib/rateLimit";

export async function POST(req) {
  try {
    enforceRateLimit(req, "auth-register", { limit: 5, windowMs: 15 * 60 * 1000 });
    const db = await connectDB();
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const country = String(body.country || "Nigeria").trim() || "Nigeria";
    const username = String(body.username || email.split("@")[0] || "")
      .trim()
      .toLowerCase();

    if (!email || !password || !body.fullName) {
      return Response.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (!isStrongPassword(password)) {
      return Response.json(
        { error: getPasswordPolicyMessage(password) || "Enter a stronger password." },
        { status: 400 }
      );
    }

    const existingUser = await db.collection("users").findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return Response.json(
        { error: "User already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await db.collection("users").insertOne({
      fullName: body.fullName,
      email,
      username,
      country,
      password: hashedPassword,
      requiresBusinessSetup: true,
      role: "Owner",
      roleKey: "owner",
      accountType: "owner",
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return Response.json({
      success: true,
      message: "User created successfully",
      userId: String(result.insertedId),
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return Response.json(
      { error: error.message || "Server error" },
      { status: error.status || 500 }
    );
  }
}
