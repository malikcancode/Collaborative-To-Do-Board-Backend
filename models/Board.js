const mongoose = require("mongoose");

const ListSchema = new mongoose.Schema({
  name: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

const boardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: { type: String, enum: ["admin", "member"], default: "member" },
      },
    ],
    lists: [ListSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Board", boardSchema);
