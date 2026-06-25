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

    const user = await db.collection("users").findOne({ email: body.email });

    if (!user || user.password !== body.password) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Don't return password in response
    const { password, ...userWithoutPassword } = user;

    return Response.json({
      success: true,
      user: userWithoutPassword,
    });

  } catch (error) {
    console.error("Login Error:", error);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}