const express = require("express");
const {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
} = require("../controllers/taskController");
const { protect } = require("../middleware/authMiddleware");
const requireBoardRole = require("../middleware/roleMiddleware");

const router = express.Router({ mergeParams: true });

// Member or Admin can create/update tasks
router.post("/", protect, requireBoardRole(["admin", "member"]), createTask);
router.get("/", protect, requireBoardRole(["admin", "member"]), getTasks);
router.put(
  "/:taskId",
  protect,
  requireBoardRole(["admin", "member"]),
  updateTask
);

// Only Admin can delete task
router.delete(
  "/:taskId",
  protect,
  requireBoardRole(["admin", "member"]),
  deleteTask
);

module.exports = router;
