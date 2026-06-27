import { requireAuth } from "../../../lib/auth";
import { connectDB } from "../../../lib/mongodb";
import { findUserById } from "../../../lib/paymentGatewaySettings";
import { normalizeQuickPayInput } from "../../../lib/quickPay";

export async function GET(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();

    const profiles = await db
      .collection("quickPayProfiles")
      .find({ ownerId: userId })
      .sort({ createdAt: -1 })
      .toArray();

    return Response.json(profiles);
  } catch (error) {
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to load quick pay profiles" },
      { status }
    );
  }
}

export async function POST(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const body = await req.json();

    if (!body.description) {
      return Response.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    const user = await findUserById(db, userId);

    const payload = normalizeQuickPayInput(
      {
        ...body,
        ownerId: userId,
        businessName: user?.businessName || "",
        businessLogo: user?.businessLogo || "",
      },
      user || {}
    );

    const result = await db.collection("quickPayProfiles").insertOne({
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return Response.json({
      success: true,
      insertedId: result.insertedId,
      token: payload.token,
    });
  } catch (error) {
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to create quick pay profile" },
      { status }
    );
  }
}
