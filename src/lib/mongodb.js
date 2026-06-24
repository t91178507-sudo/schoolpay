import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("❌ Please add MONGODB_URI to .env.local");
}

let client;
let clientPromise;

// ✅ LOG BEFORE CONNECTING
console.log("🔌 Connecting to MongoDB...");

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect()
      .then((client) => {
        console.log("✅ Connected to MongoDB");
        return client;
      })
      .catch((err) => {
        console.error("❌ MongoDB connection failed:", err);
        throw err;
      });
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect()
    .then((client) => {
      console.log("✅ Connected to MongoDB");
      return client;
    })
    .catch((err) => {
      console.error("❌ MongoDB connection failed:", err);
      throw err;
    });
}

export default clientPromise;

export const connectDB = async () => {
  try {
    const client = await clientPromise;
    return client.db("schoolpay");
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    throw new Error("Failed to connect to database");
  }
};