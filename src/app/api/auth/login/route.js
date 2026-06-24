import { connectDB } from "../../../../lib/mongodb";

import User from "../../../../models/User";

export async function POST(req) {
  try {
    await connectDB();

    const body = await req.json();

    const user = await User.findOne({ email: body.email });

    if (!user || user.password !== body.password) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Don't return password in response
    const { password, ...userWithoutPassword } = user.toObject ? user.toObject() : user;

    return Response.json({ 
      success: true, 
      user: userWithoutPassword 
    });

  } catch (error) {
    console.error("Login Error:", error);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}