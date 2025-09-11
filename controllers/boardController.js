const Board = require("../models/Board");
const User = require("../models/User");
const nodemailer = require("nodemailer");

// POST /api/boards
const createBoard = async (req, res) => {
  try {
    const board = await Board.create({
      name: req.body.name,
      members: [{ user: req.user._id, role: "admin" }],
    });
    res.status(201).json(board);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/boards
const getBoards = async (req, res) => {
  try {
    const boards = await Board.find({ "members.user": req.user._id }).populate(
      "members.user",
      "username email"
    );
    res.json(boards);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/boards/:id/invite  (protected by requireBoardRole(["admin"]))
const inviteUser = async (req, res) => {
  try {
    const { email } = req.body;
    const board = req.board; // from middleware

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    // Check if already a member
    const alreadyMember = board.members.some(
      (m) => m.user && m.user._id.toString() === user._id.toString()
    );
    if (alreadyMember)
      return res.status(400).json({ message: "User already a member" });

    board.members.push({ user: user._id, role: "member" });
    await board.save();

    // Send invitation email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.MAIL_USER,
      to: user.email, // or use 'email' from req.body if provided
      subject: `Invitation to join board: ${board.name}`,
      text: `Hello ${user.username},\n\nYou have been invited to join the board "${board.name}".\n\nLogin to view the board.\n`,
    };

    await transporter.sendMail(mailOptions);

    res.json(board);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/boards/:id/remove  (protected by requireBoardRole(["admin"]))
const removeUser = async (req, res) => {
  try {
    const { userId } = req.body;
    const board = req.board;

    // Prevent removing the last admin (optional check)
    const memberToRemove = board.members.find(
      (m) => m.user._id.toString() === userId
    );
    if (!memberToRemove)
      return res.status(404).json({ message: "User not a member" });

    // optional safety: ensure at least one admin remains
    if (memberToRemove.role === "admin") {
      const adminsCount = board.members.filter(
        (m) => m.role === "admin"
      ).length;
      if (adminsCount <= 1) {
        return res
          .status(400)
          .json({ message: "Cannot remove the last admin" });
      }
    }

    board.members = board.members.filter(
      (m) => m.user._id.toString() !== userId
    );
    await board.save();
    res.json(board);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/boards/:id  (protected by requireBoardRole(["admin"]))
const deleteBoard = async (req, res) => {
  try {
    const board = req.board;
    await board.deleteOne();
    res.json({ message: "Board deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// POST /api/boards/:id/lists
const addList = async (req, res) => {
  try {
    const board = req.board;
    const { name } = req.body;

    const allowedRoles = ["admin", "member"];
    if (!allowedRoles.includes(req.boardMembership.role)) {
      return res.status(403).json({ message: "Not allowed to create list" });
    }

    if (!board.lists) board.lists = [];
    board.lists.push({ name, createdBy: req.user._id });
    await board.save();

    await board.populate("members.user", "username email");
    const newList = board.lists[board.lists.length - 1];

    // Emit socket event for new list
    const io = req.app.get("io");
    io.to(board._id.toString()).emit("listChanged", {
      type: "created",
      list: newList,
    });
    res.status(201).json(board.lists[board.lists.length - 1]);
  } catch (error) {
    console.error(error); // Add this for better debugging!
    res.status(500).json({ message: "Server error" });
  }
};

// DELETE /api/boards/:id/lists/:listId
const deleteList = async (req, res) => {
  try {
    const board = req.board;
    const listId = req.params.listId;

    const list = board.lists.id(listId);
    if (!list) {
      return res.status(404).json({ message: "List not found" });
    }

    const isAdmin = req.boardMembership.role === "admin";
    const isCreator = list.createdBy.toString() === req.user._id.toString();

    if (!isAdmin && !isCreator) {
      return res
        .status(403)
        .json({ message: "Only the creator or an admin can delete this list" });
    }

    board.lists = board.lists.filter((l) => l._id.toString() !== listId);
    await board.save();

    // Emit socket event for deleted list
    const io = req.app.get("io");
    io.to(board._id.toString()).emit("listChanged", {
      type: "deleted",
      listId,
    });

    res.json({ message: "List deleted" });
  } catch (error) {
    console.error("Error in deleteList:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateListsOrder = async (req, res) => {
  try {
    const board = req.board;
    const { lists } = req.body; // Array of list objects (with _id and name)

    // Validate: lists should contain all current lists, just reordered
    if (!Array.isArray(lists) || lists.length !== board.lists.length) {
      return res.status(400).json({ message: "Invalid lists array" });
    }

    // Optionally: check all IDs match
    const currentIds = board.lists.map((l) => l._id.toString()).sort();
    const newIds = lists.map((l) => l._id.toString()).sort();
    if (JSON.stringify(currentIds) !== JSON.stringify(newIds)) {
      return res.status(400).json({ message: "List IDs mismatch" });
    }

    board.lists = lists;
    await board.save();
    res.json(board.lists);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createBoard,
  getBoards,
  inviteUser,
  removeUser,
  deleteBoard,
  addList,
  deleteList,
  updateListsOrder,
};
