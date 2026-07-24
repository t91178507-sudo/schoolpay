import { connectDB } from "../../../../lib/mongodb";
import {
  createPayazaDynamicVirtualAccount,
  parseAmount,
} from "../../../../lib/payaza";
import {
  findUserById,
  resolvePayazaConfig,
} from "../../../../lib/paymentGatewaySettings";
import { findAccessibleInvoice } from "../../../../lib/publicInvoiceAccess";

function isPayazaConfigReady(config = {}) {
  return Boolean(config.enabled && config.publicKey && config.secretKey);
}

function buildAccountName(invoice = {}, owner = {}) {
  const businessName = owner.businessName || invoice.businessName || "InvoiceHub";
  const invoiceNumber = invoice.invoiceNumber || "Invoice";
  return `${businessName} ${invoiceNumber}`.slice(0, 90);
}

export async function POST(req) {
  try {
    const db = await connectDB();
    const body = await req.json();
    const token = body.token;
    const invoiceId = body.invoiceId;
    const requestedAmount = parseAmount(body.amount);

    if (!token || !invoiceId) {
      return Response.json(
        { error: "Token and invoiceId are required" },
        { status: 400 }
      );
    }

    const invoice = await findAccessibleInvoice(db, { token, invoiceId });

    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "Paid") {
      return Response.json(
        { error: "This invoice has already been paid" },
        { status: 409 }
      );
    }

    const invoiceAmount = parseAmount(invoice.balanceDue || invoice.amount);

    if (requestedAmount <= 0) {
      return Response.json(
        { error: "Enter a valid payment amount" },
        { status: 400 }
      );
    }

    if (requestedAmount > invoiceAmount) {
      return Response.json(
        {
          error: `Amount cannot be more than the outstanding invoice balance. Requested: ${requestedAmount}. Outstanding: ${invoiceAmount}.`,
        },
        { status: 400 }
      );
    }

    const owner = invoice.ownerId ? await findUserById(db, invoice.ownerId) : null;
    const payazaConfig = resolvePayazaConfig(owner || {});

    if (!isPayazaConfigReady(payazaConfig)) {
      return Response.json(
        {
          error: "PayAza is not configured correctly for this business. Re-enter the PayAza public key in Settings > Payment Gateway, then click Verify connection.",
          code: "PAYAZA_NOT_CONFIGURED",
        },
        { status: 422 }
      );
    }

    const paymentReference = `paya_${invoice.token}_${Date.now()}`;
    const customerName =
      invoice.customer || invoice.customerName || invoice.student || "Customer";
    const virtualAccount = await createPayazaDynamicVirtualAccount({
      publicKey: payazaConfig.publicKey,
      accountName: buildAccountName(invoice, owner || {}),
      accountReference: paymentReference,
      customerName,
      customerEmail: invoice.email || owner?.businessEmail || owner?.email || "",
      customerPhone: invoice.phone || "",
      amount: requestedAmount,
      description:
        invoice.description || invoice.category || invoice.class || "Invoice payment",
      expiresInMinutes: 30,
      environment: payazaConfig.environment,
    });

    await db.collection("invoices").updateOne(
      { _id: invoice._id },
      {
        $set: {
          pendingPaymentReference: paymentReference,
          pendingPaymentAmount: requestedAmount,
          pendingPaymentProvider: "PayAza",
          pendingPaymentCreatedAt: new Date(),
          payazaVirtualAccount: {
            ...virtualAccount,
            generatedAt: new Date(),
          },
        },
      }
    );

    return Response.json({
      success: true,
      invoiceId: String(invoice._id),
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
          virtualAccount.transaction_amount_payable || requestedAmount
        ),
        expiresInMinutes: Number(virtualAccount.expires_in_minutes || 30),
      },
    });
  } catch (error) {
    const errorMessage =
      typeof error?.message === "string" && error.message.trim()
        ? error.message
        : "Unable to create PayAza virtual account";
    const responseStatus =
      Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599
        ? error.status
        : 500;

    console.error("PAYAZA VIRTUAL ACCOUNT ERROR:", {
      message: errorMessage,
      code: error?.code,
      details: error?.details,
    });
    return Response.json(
      {
        error: errorMessage,
        code: error?.code || "PAYAZA_VIRTUAL_ACCOUNT_ERROR",
        details: error?.details || undefined,
      },
      { status: responseStatus }
    );
  }
}

