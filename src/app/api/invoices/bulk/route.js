import { connectDB } from "../../../../lib/mongodb";
import Invoice from "../../../../models/Invoice";

export async function POST(req) {
  await connectDB();

  try {
    const body = await req.json();
    const customers = body.customers || body.students || [];

    if (customers.length === 0) {
      return Response.json({ error: "No customers provided" }, { status: 400 });
    }

    const invoices = customers.map((customer) => ({
      customer: customer.name,
      customerName: customer.name,
      category: customer.category || customer.class || "",
      amount: customer.amount || customer.fees || 0,
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
