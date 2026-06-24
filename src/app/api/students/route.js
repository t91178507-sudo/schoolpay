import { connectDB } from "../../../lib/mongodb";
``

export async function GET() {
  try {
    const db = await connectDB();
    const students = await db.collection("students").find({}).toArray();
    return Response.json(students);
  } catch (error) {
    console.error(error);
    return Response.json([], { status: 200 });
  }
}

export async function POST(request) {
  try {
    const db = await connectDB();
    const data = await request.json();

    const newStudent = await db.collection("students").insertOne({
      ...data,
      createdAt: new Date()
    });

    return Response.json({ 
      ...data, 
      _id: newStudent.insertedId 
    }, { status: 201 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed to create student" }, { status: 500 });
  }
}