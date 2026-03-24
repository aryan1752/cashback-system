require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./lib/mongodb");
const Card = require("./models/Card");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "frontend")));

// ─── DB ──────────────────────────────────────────────────────
connectDB().catch((err) => {
  console.error("Failed to connect to MongoDB:", err.message);
  process.exit(1);
});

const VALID_AMOUNTS = ["5", "10", "25", "50", "100"];

// ─── GET /api/check?token=XXX&amount=YY ──────────────────────
// Returns { status: "ok" | "used" | "invalid" }
app.get("/api/check", async (req, res) => {
  const { token, amount } = req.query;

  if (!token || !amount || !VALID_AMOUNTS.includes(amount)) {
    return res.json({ status: "invalid" });
  }

  try {
    const card = await Card.findOne({
      token: token.toUpperCase(),
      amount: Number(amount),
    });

    if (!card) return res.json({ status: "invalid" });
    if (card.used) return res.json({ status: "used" });

    return res.json({ status: "ok" });
  } catch (err) {
    console.error("Check error:", err);
    return res.status(500).json({ status: "invalid", message: "Server error" });
  }
});

// ─── POST /api/claim ─────────────────────────────────────────
// Body: { token, amount, name, phone, upi, shop, timestamp }
// Returns { status: "claimed" | "used" | "invalid" }
app.post("/api/claim", async (req, res) => {
  const { token, amount, name, phone, upi, shop, timestamp } = req.body;

  if (!token || !amount || !VALID_AMOUNTS.includes(String(amount))) {
    return res.json({ status: "invalid" });
  }

  try {
    // Atomic find-and-update: only update if not already used
    const card = await Card.findOneAndUpdate(
      { token: token.toUpperCase(), amount: Number(amount), used: false },
      {
        $set: {
          used: true,
          claimedAt:
            timestamp ||
            new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
          claimedBy: {
            name: name || "",
            phone: phone || "",
            upi: upi || "",
            shop: shop || "",
          },
        },
      },
      { new: true }
    );

    if (!card) {
      // Check if it exists but is already used
      const exists = await Card.findOne({ token: token.toUpperCase() });
      if (exists && exists.used) return res.json({ status: "used" });
      return res.json({ status: "invalid" });
    }

    return res.json({ status: "claimed" });
  } catch (err) {
    console.error("Claim error:", err);
    return res.status(500).json({ status: "invalid", message: "Server error" });
  }
});

// ─── POST /api/seed  (dev helper — seed cards in bulk) ───────
// Body: { cards: [{ token, amount }, ...] }
// Protected by SEED_SECRET env variable
app.post("/api/seed", async (req, res) => {
  const secret = req.headers["x-seed-secret"];
  if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { cards } = req.body;
  if (!Array.isArray(cards) || cards.length === 0) {
    return res.status(400).json({ error: "No cards provided" });
  }

  try {
    const ops = cards.map((c) => ({
      updateOne: {
        filter: { token: String(c.token).toUpperCase() },
        update: {
          $setOnInsert: {
            token: String(c.token).toUpperCase(),
            amount: Number(c.amount),
            used: false,
            claimedAt: null,
            claimedBy: {},
          },
        },
        upsert: true,
      },
    }));

    const result = await Card.bulkWrite(ops);
    return res.json({
      inserted: result.upsertedCount,
      skipped: result.matchedCount,
    });
  } catch (err) {
    console.error("Seed error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── CORS Middleware ─────────────────────────────────────────
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, x-seed-secret");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

app.use(express.json());

// ─── Catch-all → index.html ──────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});