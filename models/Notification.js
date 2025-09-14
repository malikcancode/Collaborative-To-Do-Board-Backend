const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: "Board" },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
    title: { type: String },
    message: { type: String },
    description: { type: String }, // ✅ new field

    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
