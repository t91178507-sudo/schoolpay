import { connectDB } from "../../../../lib/mongodb";

export async function POST(req) {
  try {
    const db = await connectDB();

    const body = await req.json();

    if (!body.email || !body.password) {
      return Response.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.collection("users").findOne({ email: body.email });

    if (existingUser) {
      return Response.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const result = await db.collection("users").insertOne({
      email: body.email,
      password: body.password,
      schoolName: body.schoolName,
      createdAt: new Date(),
    });

    return Response.json({
      success: true,
      user: {
        _id: result.insertedId,
        email: body.email,
        schoolName: body.schoolName,
      },
    });

  } catch (error) {
    console.error("REGISTER ERROR:", error);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}