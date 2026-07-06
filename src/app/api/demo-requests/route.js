import { connectDB } from "../../../lib/mongodb";

export async function POST(req) {
  try {
    const db = await connectDB();
    const body = await req.json();

    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const businessName = String(body.businessName || "").trim();
    const businessType = String(body.businessType || "").trim();
    const teamSize = String(body.teamSize || "").trim();
    const message = String(body.message || "").trim();

    if (!fullName || !email || !phone || !businessName || !businessType || !teamSize) {
      return Response.json(
        { error: "Please complete the required fields." },
        { status: 400 }
      );
    }

    await db.collection("demo_requests").insertOne({
      fullName,
      email,
      phone,
      businessName,
      businessType,
      teamSize,
      message,
      status: "new",
      createdAt: new Date(),
    });

    return Response.json({
      success: true,
      message: "Demo request submitted successfully.",
    });
  } catch (error) {
    console.error("DEMO REQUEST ERROR:", error);

    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}
