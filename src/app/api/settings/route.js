import { ObjectId } from "mongodb";
import { requireAuth } from "../../../lib/auth";
import { connectDB } from "../../../lib/mongodb";
import { requireVerifiedOwnerBusiness } from "../../../lib/businessVerification";
import {
  buildSettingsPayload,
  getPlatformSettings,
  sanitizeSettingsInput,
} from "../../../lib/paymentGatewaySettings";

function hasProfileFieldChanged(existingUser = {}, payload = {}) {
  return ["businessName", "businessLogo", "businessEmail", "businessPhone"].some(
    (field) => String(existingUser[field] || "") !== String(payload[field] || "")
  );
}

async function syncBusinessProfileSnapshots(db, userId, payload = {}) {
  const now = new Date();
  const profileSnapshot = {
    businessName: payload.businessName || "",
    businessLogo: payload.businessLogo || "",
    businessEmail: payload.businessEmail || "",
    businessPhone: payload.businessPhone || "",
    updatedAt: now,
  };

  await Promise.all([
    db.collection("businesses").updateMany(
      { ownerId: String(userId) },
      {
        $set: {
          name: payload.businessName || "",
          logo: payload.businessLogo || "",
          email: payload.businessEmail || "",
          phone: payload.businessPhone || "",
          updatedAt: now,
        },
      }
    ),
    db.collection("invoices").updateMany(
      { ownerId: String(userId) },
      { $set: profileSnapshot }
    ),
    db.collection("recurringInvoices").updateMany(
      { ownerId: String(userId) },
      { $set: profileSnapshot }
    ),
    db.collection("quickPayProfiles").updateMany(
      { ownerId: String(userId) },
      { $set: profileSnapshot }
    ),
    db.collection("quickPayTransactions").updateMany(
      { ownerId: String(userId) },
      { $set: profileSnapshot }
    ),
    db.collection("whatsappMessageQueue").updateMany(
      { ownerId: String(userId), status: "pending" },
      {
        $set: {
          businessName: payload.businessName || "",
          updatedAt: now,
        },
      }
    ),
  ]);
}

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

    const platformSettings = await getPlatformSettings(db);

    return Response.json(buildSettingsPayload(user, platformSettings || {}));
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

    const restrictedKeys = [
      "defaultPaymentGateway",
      "paymentGateways",
      "defaultWhatsAppProvider",
      "whatsappProviders",
    ];
    const includesRestrictedSettings = restrictedKeys.some((key) =>
      Object.prototype.hasOwnProperty.call(body, key)
    );

    if (includesRestrictedSettings) {
      await requireVerifiedOwnerBusiness(db, userId);
    }

    const settingsInput = includesRestrictedSettings
      ? body
      : {
          ...body,
          defaultPaymentGateway: existingUser.defaultPaymentGateway,
          paymentGateways: existingUser.paymentGateways,
          defaultWhatsAppProvider: existingUser.defaultWhatsAppProvider,
          whatsappProviders: existingUser.whatsappProviders,
        };
    const payload = sanitizeSettingsInput(settingsInput, existingUser);

    if (!payload.businessName) {
      return Response.json(
        { error: "Business name is required" },
        { status: 400 }
      );
    }

    const shouldSyncProfileSnapshots = hasProfileFieldChanged(existingUser, payload);

    await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      {
        $set: {
          ...payload,
          updatedAt: new Date(),
        },
      }
    );

    if (shouldSyncProfileSnapshots) {
      await syncBusinessProfileSnapshots(db, userId, payload);
    }

    const updatedUser = await db.collection("users").findOne({
      _id: new ObjectId(userId),
    });

    return Response.json({
      success: true,
      settings: buildSettingsPayload(updatedUser, await getPlatformSettings(db) || {}),
    });
  } catch (error) {
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to save settings" },
      { status }
    );
  }
}
