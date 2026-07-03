import { ObjectId } from "mongodb";
import { requireAuth } from "../../../lib/auth";
import { connectDB } from "../../../lib/mongodb";
import { findUserById } from "../../../lib/paymentGatewaySettings";
import { normalizeRecurringInvoiceInput } from "../../../lib/recurringInvoices";

export async function GET(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const schedules = await db
      .collection("recurringInvoices")
      .find({ ownerId: userId })
      .sort({ active: -1, nextRunAt: 1, createdAt: -1 })
      .toArray();

    return Response.json(schedules);
  } catch (error) {
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to load recurring invoices" },
      { status }
    );
  }
}

export async function POST(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const body = await req.json();
    const owner = await findUserById(db, userId);
    const payload = normalizeRecurringInvoiceInput(body, owner || {});

    if (!payload.customerName && !payload.customer) {
      return Response.json({ error: "Customer name is required" }, { status: 400 });
    }

    if (!payload.phone) {
      return Response.json({ error: "Customer phone number is required" }, { status: 400 });
    }

    if (!payload.description) {
      return Response.json({ error: "Description is required" }, { status: 400 });
    }

    if (!payload.amount || payload.amount <= 0) {
      return Response.json({ error: "Enter a valid recurring amount" }, { status: 400 });
    }

    const result = await db.collection("recurringInvoices").insertOne({
      ...payload,
      ownerId: userId,
      generatedCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return Response.json({
      success: true,
      insertedId: result.insertedId,
    });
  } catch (error) {
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to create recurring invoice" },
      { status }
    );
  }
}

export async function PATCH(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const body = await req.json();
    const id = body.id;

    if (!id) {
      return Response.json({ error: "Schedule id is required" }, { status: 400 });
    }

    await db.collection("recurringInvoices").updateOne(
      { _id: new ObjectId(id), ownerId: userId },
      {
        $set: {
          active: body.active === true,
          updatedAt: new Date(),
        },
      }
    );

    return Response.json({ success: true });
  } catch (error) {
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to update recurring invoice" },
      { status }
    );
  }
}
