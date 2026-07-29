import { createHash } from "crypto";
import { ObjectId } from "mongodb";
import { requireAccessContext } from "../../../../lib/accessControl";
import {
  getRequestDevice,
  getRequestIp,
  logUserActivity,
} from "../../../../lib/activityLogs";
import {
  BUSINESS_STATUSES,
  encryptVerificationDocument,
  serializeBusinessVerification,
  validateVerificationFile,
} from "../../../../lib/businessVerification";
import { connectDB } from "../../../../lib/mongodb";

const DOCUMENT_FIELDS = [["electricityBill", "Electricity Bill"]];

export async function GET(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db);
    const business = context.primaryBusiness;

    if (!business) {
      return Response.json({ business: null, requiresBusinessSetup: true });
    }

    const documents = await db
      .collection("businessVerificationDocuments")
      .find(
        { ownerId: context.ownerId, businessId: business._id },
        { projection: { encryptedData: 0, iv: 0, tag: 0 } }
      )
      .sort({ uploadedAt: -1 })
      .toArray();

    return Response.json({
      business: serializeBusinessVerification(business, documents),
      requirements: { electricityBillRequired: true },
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load verification" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db);
    const business = context.primaryBusiness;

    if (!business) {
      return Response.json(
        { error: "Create your business before submitting verification." },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const submitForReview = String(formData.get("intent") || "submit") === "submit";

    const now = new Date();
    const uploadedTypes = [];

    for (const [field, label] of DOCUMENT_FIELDS) {
      const file = formData.get(field);
      if (!file || typeof file.arrayBuffer !== "function" || !file.size) {
        continue;
      }

      validateVerificationFile(file, label);
      const buffer = Buffer.from(await file.arrayBuffer());
      const hash = createHash("sha256").update(buffer).digest("hex");
      const encrypted = encryptVerificationDocument(buffer);

      await db.collection("businessVerificationDocuments").updateOne(
        {
          ownerId: context.ownerId,
          businessId: business._id,
          documentType: field,
        },
        {
          $set: {
            ownerId: context.ownerId,
            businessId: business._id,
            documentType: field,
            fileName: String(file.name || label),
            contentType: file.type,
            size: file.size,
            hash,
            ...encrypted,
            uploadedAt: now,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );
      uploadedTypes.push(field);
    }

    const storedDocuments = await db
      .collection("businessVerificationDocuments")
      .find({ ownerId: context.ownerId, businessId: business._id })
      .toArray();
    const storedTypes = new Set(storedDocuments.map((document) => document.documentType));

    if (submitForReview && !storedTypes.has("electricityBill")) {
      return Response.json(
        { error: "Upload an electricity bill before submitting." },
        { status: 400 }
      );
    }

    const nextStatus = submitForReview
      ? BUSINESS_STATUSES.UNDER_REVIEW
      : BUSINESS_STATUSES.PENDING;
    const timelineEntry = {
      action: submitForReview ? "Verification Submitted" : "Documents Updated",
      note: submitForReview
        ? "Verification was submitted for admin review."
        : "Verification details were saved.",
      actorName: context.user.fullName || context.user.email,
      createdAt: now,
    };

    await db.collection("businesses").updateOne(
      { _id: new ObjectId(business._id), ownerId: context.ownerId },
      {
        $set: {
          verificationStatus: nextStatus,
          rejectionReason: "",
          updatedAt: now,
          ...(submitForReview ? { verificationSubmittedAt: now } : {}),
        },
        $push: { verificationTimeline: timelineEntry },
      }
    );

    if (uploadedTypes.length > 0) {
      await logUserActivity(db, {
        ownerId: context.ownerId,
        actorUserId: context.user._id,
        actorName: context.user.fullName || context.user.email,
        actorAccountType: context.user.accountType,
        businessId: business._id,
        businessName: business.name,
        ipAddress: getRequestIp(req),
        device: getRequestDevice(req),
        action: "Documents Updated",
        description: `${uploadedTypes.length} verification document${uploadedTypes.length === 1 ? "" : "s"} uploaded.`,
        metadata: { uploadedTypes },
      });
    }

    await logUserActivity(db, {
      ownerId: context.ownerId,
      actorUserId: context.user._id,
      actorName: context.user.fullName || context.user.email,
      actorAccountType: context.user.accountType,
      businessId: business._id,
      businessName: business.name,
      ipAddress: getRequestIp(req),
      device: getRequestDevice(req),
      action: timelineEntry.action,
      description: timelineEntry.note,
      metadata: { uploadedTypes },
    });
    if (submitForReview) {
      await db.collection("notificationOutbox").insertOne({
        ownerId: context.ownerId,
        businessId: business._id,
        channel: "email",
        recipient: business.email || context.owner.email || "",
        subject: `Verification submitted for ${business.name}`,
        message: "Your business verification has been submitted and is now under review.",
        status: business.email || context.owner.email ? "queued" : "skipped",
        createdAt: now,
      });
    }

    return Response.json({
      success: true,
      message: submitForReview
        ? "Verification submitted. The InvoiceHub Admin will review your documents."
        : "Verification details saved.",
      verificationStatus: nextStatus,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to submit verification" },
      { status: error.status || 500 }
    );
  }
}


