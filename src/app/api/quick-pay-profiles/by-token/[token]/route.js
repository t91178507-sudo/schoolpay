import { connectDB } from "../../../../../lib/mongodb";

export async function GET(req, context) {
  try {
    const { token } = await context.params;
    const db = await connectDB();

    const profile = await db.collection("quickPayProfiles").findOne({
      token,
      active: { $ne: false },
    });

    if (!profile) {
      return Response.json({ error: "Quick payment profile not found" }, { status: 404 });
    }

    return Response.json(profile);
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load quick payment profile" },
      { status: 500 }
    );
  }
}
