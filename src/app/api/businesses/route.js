import { ObjectId } from "mongodb";
import { requireAccessContext, sanitizeBusiness } from "../../../lib/accessControl";
import { getRequestDevice, getRequestIp, logUserActivity } from "../../../lib/activityLogs";
import {
  BUSINESS_STATUSES,
  serializeBusinessVerification,
} from "../../../lib/businessVerification";
import { connectDB } from "../../../lib/mongodb";

export async function GET(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db, { permission: "settings.view" });
    return Response.json(
      context.businesses.map((business) => serializeBusinessVerification(sanitizeBusiness(business)))
    );
  } catch (error) {
    return Response.json({ error: error.message || "Unable to load businesses" }, { status: error.status || 500 });
  }
}

export async function POST(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db);

    if (context.user.accountType === "staff") {
      return Response.json({ error: "Only the owner can create businesses." }, { status: 403 });
    }

    if (context.businesses.length > 0) {
      return Response.json({ error: "Your business profile has already been created." }, { status: 409 });
    }

    const body = await req.json();
    const values = {
      name: String(body.name || "").trim(),
      type: String(body.type || body.businessType || "").trim(),
      industry: String(body.industry || "").trim(),
      email: String(body.email || "").trim().toLowerCase(),
      phone: String(body.phone || "").trim(),
      address: String(body.address || "").trim(),
      website: String(body.website || "").trim(),
      logo: String(body.logo || "").trim(),
    };

    if (!values.name || !values.type || !values.industry || !values.email || !values.phone || !values.address) {
      return Response.json(
        { error: "Business name, type, industry, email, phone number, and address are required." },
        { status: 400 }
      );
    }

    const now = new Date();
    const business = {
      ownerId: context.ownerId,
      ...values,
      active: true,
      isPrimary: true,
      verificationStatus: BUSINESS_STATUSES.PENDING,
      verificationTimeline: [{
        action: "Business Registered",
        note: "Business profile created.",
        actorName: context.user.fullName || context.user.email,
        createdAt: now,
      }],
      createdAt: now,
      updatedAt: now,
    };

    const insert = await db.collection("businesses").insertOne(business);
    const businessId = String(insert.insertedId);
    await db.collection("users").updateOne(
      { _id: new ObjectId(context.ownerId) },
      { $set: {
        requiresBusinessSetup: false,
        primaryBusinessId: businessId,
        businessName: values.name,
        businessType: values.type,
        businessEmail: values.email,
        businessPhone: values.phone,
        businessAddress: values.address,
        businessLogo: values.logo,
        updatedAt: now,
      } }
    );

    await logUserActivity(db, {
      ownerId: context.ownerId,
      actorUserId: context.user._id,
      actorName: context.user.fullName || context.user.email,
      actorAccountType: context.user.accountType,
      businessId,
      businessName: values.name,
      ipAddress: getRequestIp(req),
      device: getRequestDevice(req),
      action: "Business Registered",
      description: `${values.name} was created and is pending verification.`,
    });

    return Response.json({
      success: true,
      business: serializeBusinessVerification({ ...business, _id: insert.insertedId }),
    });
  } catch (error) {
    return Response.json({ error: error.message || "Unable to create business" }, { status: error.status || 500 });
  }
}
