import { connectDB } from "../../../../lib/mongodb";
import Invoice from "../../../../models/Invoice";

export async function POST(req) {
  await connectDB();                    // ← Fixed

  try {
    const body = await req.json();
    const { students } = body;

    if (!students || students.length === 0) {
      return Response.json({ error: "No students" }, { status: 400 });
    }

    const invoices = students.map((student) => ({
      student: student.name,
      amount: student.fees || 0,
      status: "Unpaid",
      date: new Date(),
    }));

    const result = await Invoice.insertMany(invoices);

    return Response.json(result);

  } catch (error) {
    console.error("BULK INVOICE ERROR:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}