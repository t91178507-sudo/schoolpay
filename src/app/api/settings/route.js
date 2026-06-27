import { ObjectId } from "mongodb";
import { requireAuth } from "../../../lib/auth";
import { connectDB } from "../../../lib/mongodb";
import {
  buildSettingsPayload,
  sanitizeSettingsInput,
} from "../../../lib/paymentGatewaySettings";

export async function GET(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();

    const user = await db.collection("users").findOne({
      _id: new ObjectId(userId),
    });

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(buildSettingsPayload(user));
  } catch (error) {
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to load settings" },
      { status }
    );
  }
}

export async function PUT(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const body = await req.json();
    const existingUser = await db.collection("users").findOne({
      _id: new ObjectId(userId),
    });

    if (!existingUser) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const payload = sanitizeSettingsInput(body, existingUser);

    if (!payload.businessName) {
      return Response.json(
        { error: "Business name is required" },
        { status: 400 }
      );
    }

    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          ...payload,
          updatedAt: new Date(),
        },
      }
    );

    const updatedUser = await db.collection("users").findOne({
      _id: new ObjectId(userId),
    });

    return Response.json({
      success: true,
      settings: buildSettingsPayload(updatedUser),
    });
  } catch (error) {
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to save settings" },
      { status }
    );
  }
}
