import { connectDB } from "../../../../lib/mongodb";
import bcrypt from "bcryptjs";
import { signToken } from "../../../../lib/auth";

export async function POST(req) {
  try {
    const db = await connectDB();
    const body = await req.json();

    const email = body.email?.toLowerCase();

    if (!email || !body.password || !body.fullName) {
      return Response.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    const existingUser = await db.collection("users").findOne({ email });

    if (existingUser) {
      return Response.json(
        { error: "User already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(body.password, 10);

    const result = await db.collection("users").insertOne({
      fullName: body.fullName,
      email,
      password: hashedPassword,
      businessName: body.businessName,
      businessType: body.businessType,
      role: body.role || "Admin",
      createdAt: new Date(),
    });

    // ✅ signToken expects just the userId, not a full object —
    // it wraps it internally as { userId }.
    const token = signToken(result.insertedId);

    return Response.json({
      success: true,
      message: "User created successfully",
      token,
      user: {
        _id: result.insertedId,
        fullName: body.fullName,
        email,
        businessName: body.businessName,
        businessType: body.businessType,
        role: body.role || "Admin",
      },
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}