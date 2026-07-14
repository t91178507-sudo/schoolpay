import { buildScopedQuery, requireAccessContext } from "../../../../lib/accessControl";
import { connectDB } from "../../../../lib/mongodb";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function GET(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db);
    const today = startOfToday();
    const invoiceQuery = buildScopedQuery(context, { baseQuery: {} });
    const openInvoiceQuery = buildScopedQuery(context, {
      baseQuery: {
        status: { $ne: "Paid" },
      },
    });
    const receiptQuery = buildScopedQuery(context, {
      ownerField: "ownerId",
      businessField: "businessId",
      baseQuery: {
        status: "pending",
      },
    });

    const [invoices, pendingReceipts, customers] = await Promise.all([
      db.collection("invoices").find(invoiceQuery).sort({ createdAt: -1 }).limit(200).toArray(),
      db.collection("receiptUploads").find(receiptQuery).sort({ createdAt: -1 }).limit(20).toArray(),
      db.collection("customers").countDocuments(buildScopedQuery(context)),
    ]);

    const todayCollections = invoices
      .filter((invoice) => {
        const paidAt = invoice.paidAt ? new Date(invoice.paidAt) : null;
        return paidAt && !Number.isNaN(paidAt.getTime()) && paidAt >= today;
      })
      .reduce((sum, invoice) => sum + Number(invoice.paidAmount || invoice.amountPaid || 0), 0);

    const outstandingOpenInvoices = await db.collection("invoices").find(openInvoiceQuery).toArray();
    const outstandingInvoices = outstandingOpenInvoices.length;
    const outstandingBalance = outstandingOpenInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.balanceDue || invoice.amount || 0),
      0
    );
    const todayTransactions = invoices.filter((invoice) => {
      const createdAt = invoice.createdAt ? new Date(invoice.createdAt) : null;
      return createdAt && !Number.isNaN(createdAt.getTime()) && createdAt >= today;
    }).length;

    return Response.json({
      businessName:
        context.primaryBusiness?.name || context.owner.businessName || "Business",
      todayCollections,
      pendingReceiptValidation: pendingReceipts.length,
      todayTransactions,
      outstandingInvoices,
      outstandingBalance,
      recentActivities: pendingReceipts.slice(0, 5).map((receipt) => ({
        _id: String(receipt._id),
        title: `${receipt.customerName || "Customer"} uploaded a receipt`,
        createdAt: receipt.createdAt || null,
      })),
      customers,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load mobile summary" },
      { status: error.status || 500 }
    );
  }
}
