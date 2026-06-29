import { connectDB } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/adminAuth";
import { buildSettingsPayload } from "../../../../lib/paymentGatewaySettings";

function parseMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function getOutstandingAmount(invoice) {
  const balanceDue = parseMoney(invoice.balanceDue);
  if (balanceDue > 0) return balanceDue;

  const total = parseMoney(invoice.amount);
  const paid = parseMoney(invoice.paidAmount);
  return Math.max(total - paid, 0);
}

export async function GET(req) {
  try {
    requireAdmin(req);

    const db = await connectDB();

    const users = await db
      .collection("users")
      .find({}, { projection: { password: 0 } })
      .toArray();

    const [customers, invoices] = await Promise.all([
      db.collection("customers").find({}).toArray(),
      db.collection("invoices").find({}).toArray(),
    ]);

    const businesses = users.map((user) => {
      const userId = user._id.toString();
      const settings = buildSettingsPayload(user);
      const ownedCustomers = customers.filter((customer) => customer.ownerId === userId);
      const ownedInvoices = invoices.filter((invoice) => invoice.ownerId === userId);
      const paidInvoices = ownedInvoices.filter((invoice) => invoice.status === "Paid");
      const partialInvoices = ownedInvoices.filter(
        (invoice) => invoice.status === "Partially Paid"
      );
      const revenue = ownedInvoices.reduce(
        (sum, invoice) => sum + parseMoney(invoice.amount),
        0
      );
      const collected = ownedInvoices.reduce(
        (sum, invoice) => sum + parseMoney(invoice.paidAmount || (invoice.status === "Paid" ? invoice.amount : 0)),
        0
      );
      const outstanding = ownedInvoices.reduce(
        (sum, invoice) => sum + getOutstandingAmount(invoice),
        0
      );
      const whatsappWeb = settings.whatsappProviders.whatsappWeb;
      const monnify = settings.paymentGateways.monnify;

      return {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        businessName: user.businessName,
        businessType: user.businessType,
        createdAt: user.createdAt,
        defaultPaymentGateway: settings.defaultPaymentGateway,
        defaultWhatsAppProvider: settings.defaultWhatsAppProvider,
        monnifyConfigured: Boolean(
          monnify.enabled &&
            monnify.apiKeyConfigured &&
            monnify.secretKeyConfigured &&
            monnify.contractCodeConfigured
        ),
        monnifyEnvironment: monnify.environment,
        whatsappWebEnabled: Boolean(whatsappWeb.enabled),
        whatsappWebConfigured: Boolean(whatsappWeb.bridgeBaseUrl && whatsappWeb.sessionName),
        whatsappWebSenderPhoneNumber: whatsappWeb.senderPhoneNumber || "",
        whatsappWebSessionName: whatsappWeb.sessionName || "",
        customerCount: ownedCustomers.length,
        invoiceCount: ownedInvoices.length,
        paidInvoiceCount: paidInvoices.length,
        partialInvoiceCount: partialInvoices.length,
        revenue,
        collected,
        outstanding,
      };
    });

    return Response.json(businesses);
  } catch (error) {
    console.error("ADMIN BUSINESSES ERROR:", error);
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Server error" },
      { status }
    );
  }
}
