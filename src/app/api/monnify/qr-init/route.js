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

function isPayazaConfigReady(config = {}) {
  return Boolean(config.enabled && config.publicKey && config.secretKey);
}

function buildPayazaAccountName(profile = {}, owner = {}) {
  const businessName = profile.businessName || owner.businessName || "InvoiceHub";
  const description = profile.description || "QR payment";
  return `${businessName} ${description}`.slice(0, 90);
}

async function createPayazaQuickPayment({
  db,
  profile,
  owner,
  customerName,
  customerEmail,
  customerPhone,
  amount,
}) {
  const payazaConfig = resolvePayazaConfig(owner || {});

  if (!isPayazaConfigReady(payazaConfig)) {
    const error = new Error("PayAza is not configured for this business");
    error.status = 422;
    throw error;
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
    environment: payazaConfig.environment,
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

    const profileGateway = String(profile.gateway || "").trim().toLowerCase();
    const preferredGateway =
      profileGateway && profileGateway !== "monnify" ? profileGateway : activeGateway;

    if (preferredGateway === "payaza") {
      const payazaConfig = resolvePayazaConfig(owner || {});

      if (isPayazaConfigReady(payazaConfig)) {
        return createPayazaQuickPayment({
          db,
          profile,
          owner,
          customerName,
          customerEmail,
          customerPhone,
          amount,
        });
      }
    }

    if (preferredGateway !== "monnify" && preferredGateway !== "payaza") {
      return Response.json(
        { error: "QR payment currently supports Monnify and PayAza only." },
        { status: 422 }
      );
    }

    const monnifyConfig = resolveMonnifyConfig(owner || {});

    if (!monnifyConfig.apiKey || !monnifyConfig.secretKey || !monnifyConfig.contractCode) {
      const payazaConfig = resolvePayazaConfig(owner || {});

      if (isPayazaConfigReady(payazaConfig)) {
        return createPayazaQuickPayment({
          db,
          profile,
          owner,
          customerName,
          customerEmail,
          customerPhone,
          amount,
        });
      }

      return Response.json(
        { error: "Monnify is not configured for this business" },
        { status: 422 }
      );
    }

    const paymentReference = `mqr_${profile.token}_${Date.now()}`;
    const redirectUrl = `${origin}/pay/qr/success/${profile.token}?paymentReference=${encodeURIComponent(paymentReference)}`;

    let transaction;

    try {
      transaction = await initializeMonnifyTransaction({
        apiKey: monnifyConfig.apiKey,
        secretKey: monnifyConfig.secretKey,
        amount,
        customerName,
        customerEmail,
        paymentReference,
        paymentDescription: profile.description || "QR payment",
        contractCode: monnifyConfig.contractCode,
        redirectUrl,
        environment: monnifyConfig.environment,
      });
    } catch (monnifyError) {
      if (monnifyError.code === "MONNIFY_AUTH_FAILED") {
        const payazaConfig = resolvePayazaConfig(owner || {});

        if (isPayazaConfigReady(payazaConfig)) {
          console.warn("MONNIFY QR INIT FALLBACK TO PAYAZA:", {
            profileToken: profile.token,
            environment: monnifyConfig.environment,
            providerMessage: monnifyError.details?.providerMessage,
          });
          return createPayazaQuickPayment({
            db,
            profile,
            owner,
            customerName,
            customerEmail,
            customerPhone,
            amount,
          });
        }
      }

      throw monnifyError;
    }

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
    const errorMessage =
      typeof error?.message === "string" && error.message.trim()
        ? error.message
        : "Unable to initialize quick payment";
    const responseStatus =
      Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
        ? error.status
        : 500;

    console.error("MONNIFY QR INIT ERROR:", {
      message: errorMessage,
      code: error?.code,
      details: error?.details,
    });
    return Response.json(
      {
        error: errorMessage,
        code: error?.code || "MONNIFY_QR_INIT_ERROR",
        details: error?.details || undefined,
      },
      { status: responseStatus }
    );
  }
}

