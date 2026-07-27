import { connectDB } from "../../../../../../lib/mongodb";
import { isBusinessVerified } from "../../../../../../lib/businessVerification";
import {
  findUserById,
  resolveActivePaymentGateway,
} from "../../../../../../lib/paymentGatewaySettings";
import {
  findAccessibleInvoiceGroup,
  serializePublicInvoice,
} from "../../../../../../lib/publicInvoiceAccess";

function buildCustomerPayload(record = {}, owner = null, business = null) {
  const activeGateway = resolveActivePaymentGateway(owner || {});
  const accountDetails = owner?.paymentGateways?.accountDetails || {};
  const receiptUpload = owner?.paymentGateways?.receiptUpload || {};

  return {
    name: record.customer || record.customerName || record.student || record.name,
    phone: record.phone || "",
    email: record.email || "",
    businessName: record.businessName || owner?.businessName || "",
    businessLogo: record.businessLogo || business?.logo || owner?.businessLogo || "",
    businessVerified: isBusinessVerified(business || {}),
    businessVerificationStatus: business?.verificationStatus || "",
    defaultPaymentGateway: activeGateway,
    accountDetails:
      activeGateway === "accountDetails" && accountDetails.enabled
        ? {
            enabled: true,
            bankName: accountDetails.bankName || "",
            accountName: accountDetails.accountName || "",
            accountNumber: accountDetails.accountNumber || "",
            paymentInstructions: accountDetails.paymentInstructions || "",
          }
        : { enabled: false },
    receiptUpload:
      activeGateway === "receiptUpload" && receiptUpload.enabled
        ? {
            enabled: true,
            bankName: receiptUpload.bankName || "",
            accountName: receiptUpload.accountName || "",
            accountNumber: receiptUpload.accountNumber || "",
            paymentInstructions: receiptUpload.paymentInstructions || "",
          }
        : { enabled: false },
  };
}

export async function GET(req, context) {
  try {
    const { token } = await context.params;
    const db = await connectDB();
    const accessGroup = await findAccessibleInvoiceGroup(db, token);

    if (!accessGroup) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }
    const baseRecord = accessGroup.baseInvoice || accessGroup.customer;
    const owner = baseRecord?.ownerId ? await findUserById(db, baseRecord.ownerId) : null;
    const business = baseRecord?.ownerId
      ? await db.collection("businesses").findOne({
          ownerId: String(baseRecord.ownerId),
          active: { $ne: false },
          $or: [{ isPrimary: true }, { _id: baseRecord.businessId }],
        })
      : null;

    return Response.json({
      customer: buildCustomerPayload(baseRecord || {}, owner, business),
      invoices: (accessGroup.invoices || []).map(serializePublicInvoice),
    });
  } catch (error) {
    console.error("FETCH CUSTOMER INVOICES ERROR:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
