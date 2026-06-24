import { NextResponse } from "next/server";


let feesCollection = null;

async function getFeesCollection() {
  if (!feesCollection) {
    const client = await clientPromise;
    feesCollection = db.collection("fees");
  }
  return feesCollection;
}

// GET all fees
export async function GET() {
  try {
    const collection = await getFeesCollection();
    const feesArray = await collection.find({}).toArray();

    const feesMap = {};
    feesArray.forEach((item) => {
      feesMap[item.class] = item.amount;
    });

    return NextResponse.json(feesMap);
  } catch (error) {
    console.error("Fees GET Error:", error);
    return NextResponse.json({ error: "Failed to fetch fees" }, { status: 500 });
  }
}

// POST - Add/Update fee
export async function POST(request) {
  try {
    const { class: className, amount } = await request.json();

    if (!className || amount === undefined) {
      return NextResponse.json({ error: "Class and amount are required" }, { status: 400 });
    }

    const collection = await getFeesCollection();

    await collection.updateOne(
      { class: className },
      { $set: { class: className, amount: Number(amount) } },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fees POST Error:", error);
    return NextResponse.json({ error: "Failed to save fee" }, { status: 500 });
  }
}

// DELETE fee
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const className = searchParams.get("class");

    if (!className) {
      return NextResponse.json({ error: "Class name required" }, { status: 400 });
    }

    const collection = await getFeesCollection();
    await collection.deleteOne({ class: className });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fees DELETE Error:", error);
    return NextResponse.json({ error: "Failed to delete fee" }, { status: 500 });
  }
}