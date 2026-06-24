import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
console.log("🔌 Connecting to MongoDB...");

if (!uri) {
  throw new Error("❌ Please add MONGODB_URI to .env.local");
}

let client;
let clientPromise;

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export default clientPromise;

export const connectDB = async () => {
  try {
    const client = await clientPromise;
    return client.db("schoolpay");   // Change if your DB name is different
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    throw new Error("Failed to connect to database");
  }
};