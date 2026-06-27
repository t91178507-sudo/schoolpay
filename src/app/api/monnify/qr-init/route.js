import { initializeMonnifyTransaction, parseAmount } from "../../../../lib/monnify";
import { connectDB } from "../../../../lib/mongodb";
import {
  findUserById,
  resolveMonnifyConfig,
} from "../../../../lib/paymentGatewaySettings";
import { buildQuickPayCustomerEmail } from "../../../../lib/quickPay";

export async function POST(req) {
  try {
    const db = await connectDB();
    const body = await req.json();
    const profileToken = body.profileToken;
    const origin = body.origin;
    const customerPhone = String(body.customerPhone || "").trim();
    const amount = parseAmount(body.amount);
    const customerName = customerPhone || "Customer";
    const customerEmail = buildQuickPayCustomerEmail(customerPhone);

    if (!profileToken || !origin) {
      return Response.json(
        { error: "profileToken and origin are required" },
        { status: 400 }
      );
    }

    if (!customerPhone) {
      return Response.json({ error: "Phone number is required" }, { status: 400 });
    }

    if (!amount || amount <= 0) {
      return Response.json({ error: "Enter a valid amount" }, { status: 400 });
    }

    const profile = await db.collection("quickPayProfiles").findOne({
      token: profileToken,
      active: { $ne: false },
    });

    if (!profile) {
      return Response.json({ error: "Quick payment profile not found" }, { status: 404 });
    }

    const owner = profile.ownerId ? await findUserById(db, profile.ownerId) : null;
    const monnifyConfig = resolveMonnifyConfig(owner || {});

    if (!monnifyConfig.apiKey || !monnifyConfig.secretKey || !monnifyConfig.contractCode) {
      return Response.json(
        { error: "Monnify is not configured for this business" },
        { status: 500 }
      );
    }

    const paymentReference = `mqr_${profile.token}_${Date.now()}`;
    const redirectUrl = `${origin}/pay/qr/success/${profile.token}?paymentReference=${encodeURIComponent(paymentReference)}`;

    const transaction = await initializeMonnifyTransaction({
      apiKey: monnifyConfig.apiKey,
      secretKey: monnifyConfig.secretKey,
      amount,
      customerName,
      customerEmail,
      paymentReference,
      paymentDescription: profile.description || "QR payment",
      contractCode: monnifyConfig.contractCode,
      redirectUrl,
    });

    await db.collection("quickPayTransactions").insertOne({
      profileId: String(profile._id),
      profileToken: profile.token,
      ownerId: profile.ownerId || "",
      customerId: "",
      customerToken: "",
      customerName,
      customerPhone,
      customerEmail,
      businessName: profile.businessName || owner?.businessName || "",
      businessLogo: profile.businessLogo || owner?.businessLogo || "",
      description: profile.description || "QR payment",
      amount,
      paymentReference,
      transactionReference: transaction.transactionReference || "",
      status: "Pending",
      createdAt: new Date(),
    });

    return Response.json({
      success: true,
      paymentReference,
      checkoutUrl: transaction.checkoutUrl,
    });
  } catch (error) {
    console.error("MONNIFY QR INIT ERROR:", error);
    return Response.json(
      { error: error.message || "Unable to initialize quick payment" },
      { status: 500 }
    );
  }
}
