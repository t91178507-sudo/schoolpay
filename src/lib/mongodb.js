import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("❌ MONGODB_URI is missing in environment variables");
}

let clientPromise;

if (!global._mongoClientPromise) {
  const client = new MongoClient(uri);
  global._mongoClientPromise = client
    .connect()
    .then((client) => {
      console.log("✅ Connected to MongoDB");
      return client;
    })
    .catch((error) => {
      console.error("❌ MongoDB Connection failed:", error);
      throw error;
    });
}

clientPromise = global._mongoClientPromise;

export const connectDB = async () => {
  const client = await clientPromise;
  return client.db("schoolpay");
};