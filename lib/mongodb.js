const mongoose = require("mongoose");

let cached = global._mongoConn;

async function connectDB() {
  if (cached) return cached;

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is not set.");
  }

  const conn = await mongoose.connect(process.env.MONGODB_URI);
  cached = global._mongoConn = conn;
  console.log("MongoDB connected:", conn.connection.host);
  return conn;
}

module.exports = connectDB;