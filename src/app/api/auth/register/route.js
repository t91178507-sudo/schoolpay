import { connectDB } from "../../../../lib/mongodb";

export async function POST(req) {
  try {
    await connectDB();                    // ← Fixed: was dbConnect

    const body = await req.json();

    const user = await User.create({
      email: body.email,
      password: body.password,
      schoolName: body.schoolName,
    });

    return Response.json({ success: true, user });

  } catch (error) {
    console.log(error);
    return Response.json({ error: true });
  }
}