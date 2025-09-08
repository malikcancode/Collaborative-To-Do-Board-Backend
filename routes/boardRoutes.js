const express = require("express");
const {
  createBoard,
  getBoards,
  inviteUser,
  removeUser,
  deleteBoard,
} = require("../controllers/boardController");
const { protect } = require("../middleware/authMiddleware");
const requireBoardRole = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/", protect, createBoard);
router.get("/", protect, getBoards);

// Admin-only actions on a board:
router.post("/:id/invite", protect, requireBoardRole(["admin"]), inviteUser);
router.delete("/:id/remove", protect, requireBoardRole(["admin"]), removeUser);
router.delete("/:id", protect, requireBoardRole(["admin"]), deleteBoard);

// Example: member or admin can add tasks (placeholder):
// router.post("/:id/tasks", protect, requireBoardRole(["admin","member"]), addTask);

module.exports = router;
