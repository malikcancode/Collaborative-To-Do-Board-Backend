const express = require("express");
const {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  completeTask,
} = require("../controllers/taskController");
const { protect } = require("../middleware/authMiddleware");
const requireBoardRole = require("../middleware/roleMiddleware");

const router = express.Router({ mergeParams: true });

// ✅ Member or Admin can create tasks
router.post("/", protect, requireBoardRole(["admin", "member"]), createTask);

// ✅ Member or Admin can view tasks
router.get("/", protect, requireBoardRole(["admin", "member"]), getTasks);

// ✅ Member or Admin can update tasks
router.put(
  "/:taskId",
  protect,
  requireBoardRole(["admin", "member"]),
  updateTask
);

// ✅ Only Admin or Creator can delete task (middleware handles this in controller)
router.delete(
  "/:taskId",
  protect,
  requireBoardRole(["admin", "member"]),
  deleteTask
);

// ✅ Member assigned to task or Admin can mark as complete
router.post(
  "/:taskId/complete",
  protect,
  requireBoardRole(["admin", "member"]),
  completeTask
);

module.exports = router;
