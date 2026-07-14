import { requireAccessContext, sanitizeBusiness } from "../../../lib/accessControl";
import { logUserActivity } from "../../../lib/activityLogs";
import { connectDB } from "../../../lib/mongodb";

export async function GET(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db, {
      permission: "settings.view",
    });

    return Response.json(context.businesses.map(sanitizeBusiness));
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load businesses" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db, {
      permission: "settings.edit",
    });

    if (context.user.accountType === "staff") {
      return Response.json(
        { error: "Only the owner can create businesses." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return Response.json(
        { error: "Business name is required." },
        { status: 400 }
      );
    }

    const business = {
      ownerId: context.ownerId,
      name,
      type:
        String(body.type || body.businessType || context.owner.businessType || "business").trim() ||
        "business",
      logo: String(body.logo || "").trim(),
      email: String(body.email || "").trim(),
      phone: String(body.phone || "").trim(),
      address: String(body.address || "").trim(),
      website: String(body.website || "").trim(),
      active: body.active !== false,
      isPrimary: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insert = await db.collection("businesses").insertOne(business);
    const savedBusiness = sanitizeBusiness({
      ...business,
      _id: insert.insertedId,
    });

    await logUserActivity(db, {
      ownerId: context.ownerId,
      actorUserId: context.user._id,
      actorName: context.user.fullName || context.user.email,
      actorAccountType: context.user.accountType,
      businessId: savedBusiness._id,
      businessName: savedBusiness.name,
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
      device: req.headers.get("user-agent") || "",
      action: "Business Created",
      description: `${context.user.fullName || "Owner"} created ${savedBusiness.name}.`,
    });

    return Response.json({
      success: true,
      business: savedBusiness,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to create business" },
      { status: error.status || 500 }
    );
  }
}
