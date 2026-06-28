import { ObjectId } from "mongodb";
import { requireAuth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/mongodb";
import { findUserById } from "../../../../lib/paymentGatewaySettings";
import { markInvoicePaid } from "../../../../lib/paymentLifecycle";
import { deliverPaymentConfirmation } from "../../../../lib/whatsappNotifications";

export async function PUT(request, { params }) {
  try {
    const userId = requireAuth(request);
    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid Invoice ID" }, { status: 400 });
    }

    const db = await connectDB();
    const invoice = await db.collection("invoices").findOne({
      _id: new ObjectId(id),
      ownerId: userId,
    });

    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    const paidInvoice = await markInvoicePaid(db, invoice, {
      paymentProvider: invoice.paymentProvider || "Manual",
      verificationMethod: "dashboard-manual",
      paidAt: new Date(),
      paidAmount: Number(invoice.amount || 0),
    });

    const owner = await findUserById(db, userId);

    if (paidInvoice.phone) {
      try {
        await deliverPaymentConfirmation({
          db,
          invoice: paidInvoice,
          owner,
          amount: Number(paidInvoice.amount || 0),
        });
      } catch (notificationError) {
        console.error("MANUAL PAYMENT CONFIRMATION SEND ERROR:", notificationError);
      }
    }

    return Response.json({ success: true, message: "Invoice marked as paid" });
  } catch (error) {
    console.error("UPDATE Invoice ERROR:", error);
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Failed to update invoice" },
      { status }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const userId = requireAuth(request);
    const { id } = await params;

    if (!id || !ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid Invoice ID" }, { status: 400 });
    }

    const db = await connectDB();
    const result = await db.collection("invoices").deleteOne({
      _id: new ObjectId(id),
      ownerId: userId,
    });

    if (result.deletedCount === 0) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    return Response.json({
      success: true,
      message: "Invoice deleted successfully",
    });
  } catch (error) {
    console.error("DELETE Invoice ERROR:", error);
    return Response.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    );
  }
}
