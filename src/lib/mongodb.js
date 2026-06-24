import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

let client;
let clientPromise;

if (!uri) {
  console.warn("⚠️ MONGODB_URI is not defined");
} else {
  console.log("🔌 Connecting to MongoDB...");
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise && uri) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect().then((client) => {
      console.log("✅ Connected to MongoDB");
      return client;
    });
  }
  clientPromise = global._mongoClientPromise;
} else {
  if (uri) {
    client = new MongoClient(uri);
    clientPromise = client.connect().then((client) => {
      console.log("✅ Connected to MongoDB");
      return client;
    });
  }
}

export default clientPromise;

export const connectDB = async () => {
  if (!clientPromise) {
    throw new Error("MongoDB not initialized");
  }

  const client = await clientPromise;
  return client.db("schoolpay");
};
``