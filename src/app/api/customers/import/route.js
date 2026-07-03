import { requireAuth, touchLastActive } from "../../../../lib/auth";
import { generateInvoiceToken } from "../../../../lib/invoiceUtils";
import { connectDB } from "../../../../lib/mongodb";

function clean(value) {
  return String(value || "").trim();
}

function normalizeStudent(row = {}, category = "", businessName = "") {
  const token = generateInvoiceToken("inv");
  const name = clean(row.name || row.studentName || row.customerName).toUpperCase();
  const phone = clean(row.phone || row.phoneNumber || row.customerPhone || row.parentPhone);

  return {
    name,
    phone,
    email: clean(row.email || row.emailAddress),
    location: clean(row.location || row.address),
    category: clean(row.category) || category,
    businessName,
    token,
    paymentLink: `/pay/${token}`,
    createdAt: new Date(),
  };
}

export async function POST(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    touchLastActive(db, userId);

    const body = await req.json();
    const category = clean(body.category);
    const businessName = clean(body.businessName);
    const rows = Array.isArray(body.students || body.customers)
      ? body.students || body.customers
      : [];

    if (!category) {
      return Response.json({ error: "Category is required" }, { status: 400 });
    }

    if (rows.length === 0) {
      return Response.json({ error: "No students found in file" }, { status: 400 });
    }

    const students = rows
      .map((row) => normalizeStudent(row, category, businessName))
      .filter((student) => student.name && student.phone)
      .map((student) => ({
        ...student,
        ownerId: userId,
      }));

    if (students.length === 0) {
      return Response.json(
        { error: "No valid rows found. Student name and phone number are required." },
        { status: 400 }
      );
    }

    const result = await db.collection("customers").insertMany(students);

    return Response.json({
      success: true,
      insertedCount: result.insertedCount,
      skippedCount: rows.length - students.length,
    });
  } catch (error) {
    console.error("IMPORT CUSTOMERS ERROR:", error);

    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to import students" },
      { status }
    );
  }
}
