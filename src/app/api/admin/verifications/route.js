import { ObjectId } from "mongodb";
import { requireAdmin } from "../../../../lib/adminAuth";
import {
  getRequestDevice,
  getRequestIp,
  logUserActivity,
} from "../../../../lib/activityLogs";
import {
  BUSINESS_STATUSES,
  serializeBusinessVerification,
} from "../../../../lib/businessVerification";
import { connectDB } from "../../../../lib/mongodb";
import { resolveTwilioWhatsAppConfig, resolveWhatsAppWebConfigForUser } from "../../../../lib/paymentGatewaySettings";
import {
  isWhatsAppWebConfigured,
  sendWhatsAppWebMessage,
} from "../../../../lib/whatsappWebBridge";
import { getTwilioTemplate, isTwilioWhatsAppConfigured, sendTrackedTwilioWhatsAppMessage } from "../../../../lib/twilioWhatsApp";

const ACTION_STATUS = {
  approve: BUSINESS_STATUSES.VERIFIED,
  reject: BUSINESS_STATUSES.REJECTED,
  request_information: BUSINESS_STATUSES.PENDING,
  suspend: BUSINESS_STATUSES.SUSPENDED,
};

function buildOwnerMessage(action, businessName, reason, requestedDocument, deadline) {
  if (action === "approve") {
    return `${businessName} has been verified by InvoiceHub. All platform features are now available.`;
  }
  if (action === "reject") {
    return `${businessName} verification was rejected. Reason: ${reason}. You can update your documents and resubmit.`;
  }
  if (action === "suspend") {
    return `${businessName} has been suspended. Reason: ${reason}. Please contact InvoiceHub support.`;
  }
  return `${businessName} needs more information for verification. Requested: ${requestedDocument}. Reason: ${reason}.${deadline ? ` Upload by ${deadline}.` : ""}`;
}

async function notifyOwner({ db, owner, business, action, reason, requestedDocument, deadline }) {
  const message = buildOwnerMessage(
    action,
    business.name || "Your business",
    reason,
    requestedDocument,
    deadline
  );
  const now = new Date();

  await db.collection("notificationOutbox").insertMany([
    {
      ownerId: String(owner._id),
      businessId: String(business._id),
      channel: "email",
      recipient: owner.email || business.email || "",
      subject: `InvoiceHub business verification: ${business.name}`,
      message,
      status: owner.email || business.email ? "queued" : "skipped",
      createdAt: now,
    },
    {
      ownerId: String(owner._id),
      businessId: String(business._id),
      channel: "whatsapp",
      recipient: owner.phoneNumber || business.phone || "",
      message,
      status: "queued",
      createdAt: now,
    },
  ]);

  const phone = owner.phoneNumber || business.phone || "";
  if (!phone) return;

  try {
    const twilioConfig = resolveTwilioWhatsAppConfig(owner);
    if (twilioConfig.enabled && isTwilioWhatsAppConfigured(twilioConfig)) {
      await sendTrackedTwilioWhatsAppMessage({
        db, user: owner, config: twilioConfig, messageType: "verification",
        message: {
          phone, text: message, contentSid: getTwilioTemplate(twilioConfig, "general"),
          contentVariables: { 1: message },
        },
      });
      await db.collection("notificationOutbox").updateOne(
        { ownerId: String(owner._id), businessId: String(business._id), channel: "whatsapp", createdAt: now },
        { $set: { status: "sent", provider: "twilio", sentAt: new Date() } }
      );
      return;
    }
    const config = await resolveWhatsAppWebConfigForUser(db, owner);
    if (isWhatsAppWebConfigured(config)) {
      await sendWhatsAppWebMessage(config, { phone, text: message });
      await db.collection("notificationOutbox").updateOne(
        {
          ownerId: String(owner._id),
          businessId: String(business._id),
          channel: "whatsapp",
          createdAt: now,
        },
        { $set: { status: "sent", sentAt: new Date() } }
      );
    }
  } catch (error) {
    await db.collection("notificationOutbox").updateOne(
      {
        ownerId: String(owner._id),
        businessId: String(business._id),
        channel: "whatsapp",
        createdAt: now,
      },
      { $set: { status: "failed", error: String(error.message || error) } }
    );
  }
}

export async function GET(req) {
  try {
    requireAdmin(req);
    const db = await connectDB();
    const businesses = await db.collection("businesses").find({}).sort({ createdAt: -1 }).toArray();
    const ownerIds = [...new Set(businesses.map((business) => business.ownerId).filter(Boolean))];
    const owners = await db
      .collection("users")
      .find({ _id: { $in: ownerIds.filter(ObjectId.isValid).map((id) => new ObjectId(id)) } })
      .project({ password: 0 })
      .toArray();
    const ownerMap = new Map(owners.map((owner) => [String(owner._id), owner]));
    const documents = await db
      .collection("businessVerificationDocuments")
      .find({}, { projection: { encryptedData: 0, iv: 0, tag: 0, hash: 0 } })
      .toArray();

    return Response.json(
      businesses.map((business) => {
        const owner = ownerMap.get(String(business.ownerId)) || {};
        const businessDocuments = documents.filter(
          (document) => String(document.businessId) === String(business._id)
        );
        return {
          ...serializeBusinessVerification(business, businessDocuments),
          owner: {
            _id: String(owner._id || ""),
            fullName: owner.fullName || "",
            email: owner.email || business.email || "",
            phoneNumber: owner.phoneNumber || business.phone || "",
          },
        };
      })
    );
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load business verifications" },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    requireAdmin(req);
    const db = await connectDB();
    const body = await req.json();
    const businessId = String(body.businessId || "");
    const action = String(body.action || "").toLowerCase();
    const reason = String(body.reason || "").trim();
    const requestedDocument = String(body.requestedDocument || "").trim();
    const deadline = String(body.deadline || "").trim();

    if (!ObjectId.isValid(businessId) || !ACTION_STATUS[action]) {
      return Response.json({ error: "A valid business and action are required." }, { status: 400 });
    }
    if (["reject", "suspend", "request_information"].includes(action) && !reason) {
      return Response.json({ error: "Enter a reason for this decision." }, { status: 400 });
    }
    if (action === "request_information" && !requestedDocument) {
      return Response.json({ error: "Specify the document or information required." }, { status: 400 });
    }

    const business = await db.collection("businesses").findOne({ _id: new ObjectId(businessId) });
    if (!business) {
      return Response.json({ error: "Business not found." }, { status: 404 });
    }
    const owner = ObjectId.isValid(String(business.ownerId))
      ? await db.collection("users").findOne({ _id: new ObjectId(String(business.ownerId)) })
      : null;
    if (!owner) {
      return Response.json({ error: "Business owner not found." }, { status: 404 });
    }

    const now = new Date();
    const status = ACTION_STATUS[action];
    const actionLabel = {
      approve: "Business Approved",
      reject: "Business Rejected",
      request_information: "More Information Requested",
      suspend: "Business Suspended",
    }[action];
    const timelineEntry = {
      action: actionLabel,
      note: reason || "Business verification approved.",
      actorName: "InvoiceHub Admin",
      requestedDocument,
      deadline,
      createdAt: now,
    };

    await db.collection("businesses").updateOne(
      { _id: business._id },
      {
        $set: {
          verificationStatus: status,
          rejectionReason: action === "reject" ? reason : "",
          informationRequest:
            action === "request_information"
              ? { requestedDocument, reason, deadline, requestedAt: now }
              : null,
          adminComments: String(body.adminComments || reason || "").trim(),
          updatedAt: now,
          ...(action === "approve" ? { verifiedAt: now, verifiedBy: "InvoiceHub Admin" } : {}),
          ...(action === "suspend" ? { suspendedAt: now } : {}),
        },
        $push: { verificationTimeline: timelineEntry },
      }
    );

    await logUserActivity(db, {
      ownerId: business.ownerId,
      actorUserId: "admin",
      actorName: "InvoiceHub Admin",
      actorAccountType: "admin",
      businessId,
      businessName: business.name,
      ipAddress: getRequestIp(req),
      device: getRequestDevice(req),
      action: actionLabel,
      description: timelineEntry.note,
      metadata: { requestedDocument, deadline },
    });

    await notifyOwner({
      db,
      owner,
      business,
      action,
      reason,
      requestedDocument,
      deadline,
    });

    return Response.json({ success: true, verificationStatus: status });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to update verification" },
      { status: error.status || 500 }
    );
  }
}
