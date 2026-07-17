import { connectDB } from "../../../../../../lib/mongodb";
import {
  findUserById,
  resolveActivePaymentGateway,
} from "../../../../../../lib/paymentGatewaySettings";
import {
  findAccessibleInvoiceGroup,
  serializePublicInvoice,
} from "../../../../../../lib/publicInvoiceAccess";

function buildCustomerPayload(record = {}, owner = null) {
  const activeGateway = resolveActivePaymentGateway(owner || {});
  const accountDetails = owner?.paymentGateways?.accountDetails || {};
  const receiptUpload = owner?.paymentGateways?.receiptUpload || {};

  return {
    name: record.customer || record.customerName || record.student || record.name,
    phone: record.phone || "",
    email: record.email || "",
    businessName: record.businessName || owner?.businessName || "",
    businessLogo: record.businessLogo || owner?.businessLogo || "",
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

    return Response.json({
      customer: buildCustomerPayload(baseRecord || {}, owner),
      invoices: (accessGroup.invoices || []).map(serializePublicInvoice),
    });
  } catch (error) {
    console.error("FETCH CUSTOMER INVOICES ERROR:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
