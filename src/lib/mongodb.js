import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

console.log("🔥 ENV VALUE:", process.env.MONGODB_URI);

// ✅ ALWAYS CHECK ENV AT RUNTIME, NOT BUILD
if (!uri) {
  console.error("❌ MONGODB_URI is missing");
}

let client;
let clientPromise;

if (!global._mongoClientPromise) {
  try {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect().then((client) => {
      console.log("✅ Connected to MongoDB");
      return client;
    });
  } catch (error) {
    console.error("❌ MongoDB Connection failed:", error);
  }
}

clientPromise = global._mongoClientPromise;

export const connectDB = async () => {
  if (!clientPromise) {
    throw new Error("MongoDB not initialized");
  }

  const client = await clientPromise;
  return client.db("schoolpay");
};