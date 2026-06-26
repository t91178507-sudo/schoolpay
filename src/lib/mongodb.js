import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "invoicehub";

if (!uri) {
  throw new Error("MONGODB_URI is missing in environment variables");
}

let clientPromise;

if (!global._mongoClientPromise) {
  const client = new MongoClient(uri);
  global._mongoClientPromise = client.connect().catch((error) => {
    console.error("MongoDB connection failed:", error);
    throw error;
  });
}

clientPromise = global._mongoClientPromise;

export const connectDB = async () => {
  const client = await clientPromise;
  return client.db(dbName);
};
