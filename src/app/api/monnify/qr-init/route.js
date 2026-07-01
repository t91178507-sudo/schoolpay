import { initializeMonnifyTransaction, parseAmount } from "../../../../lib/monnify";
import { connectDB } from "../../../../lib/mongodb";
import { createPayazaDynamicVirtualAccount } from "../../../../lib/payaza";
import {
  findUserById,
  resolveActivePaymentGateway,
  resolveMonnifyConfig,
  resolvePayazaConfig,
} from "../../../../lib/paymentGatewaySettings";
import { buildQuickPayCustomerEmail } from "../../../../lib/quickPay";

function buildPayazaAccountName(profile = {}, owner = {}) {
  const businessName = profile.businessName || owner.businessName || "InvoiceHub";
  const description = profile.description || "QR payment";
  return `${businessName} ${description}`.slice(0, 90);
}

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
    const activeGateway = resolveActivePaymentGateway(owner || {});

    if (activeGateway === "payaza") {
      const payazaConfig = resolvePayazaConfig(owner || {});

      if (!payazaConfig.enabled || !payazaConfig.publicKey) {
        return Response.json(
          { error: "PayAza is not configured for this business" },
          { status: 500 }
        );
      }

      const paymentReference = `paya_qr_${profile.token}_${Date.now()}`;
      const virtualAccount = await createPayazaDynamicVirtualAccount({
        publicKey: payazaConfig.publicKey,
        accountName: buildPayazaAccountName(profile, owner || {}),
        accountReference: paymentReference,
        customerName,
        customerEmail,
        customerPhone,
        amount,
        description: profile.description || "QR payment",
        expiresInMinutes: 30,
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
        transactionReference: virtualAccount.transaction_reference || paymentReference,
        status: "Pending",
        gateway: "PayAza",
        paymentProvider: "PayAza",
        virtualAccount: {
          ...virtualAccount,
          generatedAt: new Date(),
        },
        createdAt: new Date(),
      });

      return Response.json({
        success: true,
        gateway: "payaza",
        paymentReference,
        virtualAccount: {
          accountName: virtualAccount.account_name || "",
          accountNumber: virtualAccount.account_number || "",
          accountType: virtualAccount.account_type || "Dynamic",
          bankName: virtualAccount.bank_name || "",
          accountReference:
            virtualAccount.account_reference ||
            virtualAccount.transaction_reference ||
            paymentReference,
          transactionReference: virtualAccount.transaction_reference || paymentReference,
          amountPayable: parseAmount(
            virtualAccount.transaction_amount_payable || amount
          ),
          expiresInMinutes: Number(virtualAccount.expires_in_minutes || 30),
        },
      });
    }

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
      gateway: "monnify",
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
