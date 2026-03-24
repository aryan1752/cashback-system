const mongoose = require("mongoose");

const CardSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  amount: {
    type: Number,
    required: true,
    enum: [5, 10, 25, 50, 100],
  },
  used: {
    type: Boolean,
    default: false,
  },
  claimedAt: {
    type: String,
    default: null,
  },
  claimedBy: {
    name: { type: String, default: null },
    phone: { type: String, default: null },
    upi: { type: String, default: null },
    shop: { type: String, default: null },
  },
  createdAt: {
    type: String,
    default: () =>
      new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
  },
});

module.exports =
  mongoose.models.Card || mongoose.model("Card", CardSchema);