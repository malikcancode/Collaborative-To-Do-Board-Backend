const express = require("express");
const {
  createBoard,
  getBoards,
  inviteUser,
  removeUser,
  deleteBoard,
  addList,
  deleteList,
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

router.post("/:id/lists", protect, requireBoardRole(["admin"]), addList);
router.delete(
  "/:id/lists/:listId",
  protect,
  requireBoardRole(["admin"]),
  deleteList
);

module.exports = router;
