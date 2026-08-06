import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const defaultDbName =
  process.env.NODE_ENV === "production" ? "invoicehub" : "invoicehub_dev";
const dbName = process.env.MONGODB_DB || defaultDbName;

if (!uri) {
  throw new Error("MONGODB_URI is missing in environment variables");
}

let clientPromise;

if (!global._mongoClientPromise) {
  const client = new MongoClient(uri, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
  });
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
