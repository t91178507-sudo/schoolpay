import { connectDB } from "../../../../lib/mongodb";

export async function GET() {
  try {
    const db = await connectDB();

    // Try to get business name from settings collection
    const settings = await db.collection("settings").findOne({});

    const businessName = settings?.businessName || "SchoolPay";

    return Response.json({ businessName });

  } catch (error) {
    console.error("Business Name Error:", error);
    // Fallback
    return Response.json({ businessName: "SchoolPay" });
  }
}