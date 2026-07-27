import { ObjectId } from "mongodb";
import { requireAuth } from "../../../../../../lib/auth";
import { requireVerifiedOwnerBusiness } from "../../../../../../lib/businessVerification";
import { connectDB } from "../../../../../../lib/mongodb";
import {
  encryptSettingsSecret,
  findUserById,
  resolveTwilioWhatsAppConfig,
} from "../../../../../../lib/paymentGatewaySettings";
import {
  createTwilioSubaccount,
  isTwilioWhatsAppConfigured,
  verifyTwilioAccount,
} from "../../../../../../lib/twilioWhatsApp";

function getStatusCallbackUrl(req) {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    new URL(req.url).origin;
  return `${String(origin).replace(/\/+$/, "")}/api/notifications/whatsapp/twilio/status`;
}

export async function GET(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const user = await findUserById(db, userId);
    if (!user) {
      return Response.json({ error: "User not found." }, { status: 404 });
    }

    const config = resolveTwilioWhatsAppConfig(user);
    return Response.json({
      mode: config.mode,
      configured: isTwilioWhatsAppConfigured(config),
      accountConfigured: Boolean(config.accountSid && config.authToken),
      senderConfigured: Boolean(config.whatsappNumber),
      whatsappNumber: config.whatsappNumber,
      statusCallbackUrl: config.statusCallbackUrl || getStatusCallbackUrl(req),
      managedSubaccountsAvailable: Boolean(
        process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
      ),
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load Twilio status." },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    await requireVerifiedOwnerBusiness(db, userId);
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "verify");
    const user = await findUserById(db, userId);

    if (!user) {
      return Response.json({ error: "User not found." }, { status: 404 });
    }

    if (action === "create_subaccount") {
      const masterSid = process.env.TWILIO_ACCOUNT_SID || "";
      const masterToken = process.env.TWILIO_AUTH_TOKEN || "";
      if (!masterSid || !masterToken) {
        return Response.json(
          {
            error:
              "Managed Twilio subaccounts are not configured by the InvoiceHub Admin.",
          },
          { status: 503 }
        );
      }

      const existingConfig = resolveTwilioWhatsAppConfig(user);
      if (existingConfig.mode === "managed" && existingConfig.accountSid) {
        return Response.json(
          { error: "A managed Twilio subaccount already exists for this business." },
          { status: 409 }
        );
      }

      const subaccount = await createTwilioSubaccount({
        accountSid: masterSid,
        authToken: masterToken,
        friendlyName: `InvoiceHub - ${user.businessName || user.fullName || userId}`,
      });
      const statusCallbackUrl = getStatusCallbackUrl(req);

      await db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        {
          $set: {
            defaultWhatsAppProvider: "twilio",
            "whatsappProviders.twilio.enabled": true,
            "whatsappProviders.twilio.mode": "managed",
            "whatsappProviders.twilio.subaccountSid": subaccount.sid || "",
            "whatsappProviders.twilio.subaccountAuthToken": encryptSettingsSecret(
              subaccount.auth_token || ""
            ),
            "whatsappProviders.twilio.statusCallbackUrl": statusCallbackUrl,
            "whatsappProviders.twilio.createdAt": new Date(),
            updatedAt: new Date(),
          },
        }
      );

      await db.collection("activityLogs").insertOne({
        ownerId: userId,
        actorUserId: userId,
        actorName: user.fullName || user.email || "Owner",
        actorAccountType: "owner",
        action: "Twilio Subaccount Created",
        description:
          "A managed Twilio subaccount was created. WhatsApp sender onboarding is still required.",
        businessId: String(user.primaryBusinessId || ""),
        businessName: user.businessName || "",
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
        device: req.headers.get("user-agent") || "",
        metadata: { subaccountSid: subaccount.sid || "" },
        createdAt: new Date(),
      });

      return Response.json({
        success: true,
        mode: "managed",
        accountSid: subaccount.sid || "",
        accountStatus: subaccount.status || "active",
        statusCallbackUrl,
        senderOnboardingRequired: true,
        message:
          "Managed subaccount created. Register a WhatsApp sender in Twilio, then enter its number below.",
      });
    }

    const config = resolveTwilioWhatsAppConfig(user);
    const account = await verifyTwilioAccount(config);
    return Response.json({
      success: true,
      account,
      configured: isTwilioWhatsAppConfigured(config),
      senderOnboardingRequired: !config.whatsappNumber,
      message: config.whatsappNumber
        ? "Twilio account verified. Send a test message to confirm the WhatsApp sender."
        : "Twilio account verified. Add an approved WhatsApp sender number.",
    });
  } catch (error) {
    return Response.json(
      {
        error: error.message || "Unable to configure Twilio.",
        code: error.code || "",
        details: error.details || "",
      },
      { status: error.status || 500 }
    );
  }
}
