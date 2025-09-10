const mongoose = require("mongoose");

const listSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    boardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Board",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("List", listSchema);
