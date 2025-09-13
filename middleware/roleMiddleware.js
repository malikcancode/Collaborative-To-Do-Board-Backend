const Board = require("../models/Board");

/**
 * requireBoardRole(['admin'])            // only admins
 * requireBoardRole(['admin','member'])  // admins or members
 */
const requireBoardRole = (allowedRoles = []) => {
  return async (req, res, next) => {
    try {
      const boardId = req.params.id;
      if (!boardId)
        return res.status(400).json({ message: "Board id missing in params" });

      const board = await Board.findById(boardId).populate(
        "members.user",
        "username email"
      );
      if (!board) return res.status(404).json({ message: "Board not found" });

      // ✅ Support both populated and non-populated members
      const membership = board.members.find((m) => {
        const memberId =
          typeof m.user === "object" && m.user._id
            ? m.user._id.toString()
            : m.user.toString();

        return memberId === req.user._id.toString();
      });

      if (!membership)
        return res.status(403).json({ message: "Not a member of this board" });

      if (!allowedRoles.includes(membership.role)) {
        return res
          .status(403)
          .json({ message: "Forbidden: insufficient board role" });
      }

      // attach to request for controllers
      req.board = board;
      req.boardMembership = membership;
      next();
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server error" });
    }
  };
};

module.exports = requireBoardRole;
