const Task = require("../models/Task");
const Notification = require("../models/Notification");
const Board = require("../models/Board");
const User = require("../models/User");
const nodemailer = require("nodemailer");
const sendMail = require("../utils/sendMail");

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
});

// --- Create Task ---
const createTask = async (req, res) => {
  try {
    const { title, description, deadline, attachment, listId, assignedTo } =
      req.body;
    const boardId = req.board._id;

    if (!listId) return res.status(400).json({ message: "listId is required" });

    const lastTask = await Task.findOne({ listId }).sort("-position");
    const position = lastTask ? lastTask.position + 1 : 0;

    const task = await Task.create({
      boardId,
      listId,
      title,
      description,
      deadline,
      attachment,
      position,
      createdBy: req.user._id,
      assignedTo: assignedTo || null,
    });

    let populatedTask = await Task.findById(task._id)
      .populate("assignedTo", "username email")
      .populate("createdBy", "username email");

    res.status(201).json(populatedTask);
    const board = await Board.findById(boardId).populate("members.user");
    const io = req.app.get("io");

    // Notify all board members except creator
    for (const member of board.members) {
      const memberId = member.user._id.toString();
      if (memberId === req.user._id.toString()) continue;

      const notification = await Notification.create({
        user: memberId,
        title: `📌 Task Created: ${task.title}`,
        boardId,
        message: `A new task "${task.title}" was added to board "${req.board.name}".`,
        description: task.description || "No description provided",
        deadline: task.deadline,
        taskId: task._id,
      });

      io.to(memberId).emit("taskCreated", notification);
    }

    // Notify assigned user if any
    if (assignedTo) {
      const assignedUser = await User.findById(assignedTo);
      if (assignedUser) {
        const notification = await Notification.create({
          user: assignedUser._id,
          title: `📌 Task Assigned: ${task.title}`,
          boardId: req.board._id,
          message: `You have been assigned to task "${task.title}" in board "${req.board.name}".`,
          taskId: task._id,
        });

        io.to(assignedUser._id.toString()).emit("taskAssigned", notification);

        // Send email
        await sendMail({
          to: assignedUser.email, // the assigned user's email
          subject: `New Task Assigned: ${task.title}`,
          text: `Hello ${assignedUser.username},\n\nYou have been assigned to task "${task.title}" in board "${req.board.name}".`,
          html: `<p>Hello ${assignedUser.username},</p><p>You have been assigned to task "<b>${task.title}</b>" in board "<b>${req.board.name}</b>".</p>`,
        });
      }
    }

    // Broadcast task change to board room
    io.to(boardId.toString()).emit("taskChanged", {
      type: "created",
      task,
      taskId: task._id,
    });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Update Task ---
const updateTask = async (req, res) => {
  try {
    const {
      title,
      description,
      deadline,
      attachment,
      listId,
      position,
      assignedTo,
    } = req.body;

    const task = await Task.findOne({
      _id: req.params.taskId,
      boardId: req.board._id,
    });
    if (!task) return res.status(404).json({ message: "Task not found" });

    const oldPosition = task.position;
    const oldAssigned = task.assignedTo?.toString();

    // Handle list or position change
    if (listId && listId !== task.listId.toString()) {
      await Task.updateMany(
        { listId: task.listId, position: { $gt: oldPosition } },
        { $inc: { position: -1 } }
      );
      const insertPosition = position !== undefined ? position : 0;
      await Task.updateMany(
        { listId, position: { $gte: insertPosition } },
        { $inc: { position: 1 } }
      );
      task.position = insertPosition;
      task.listId = listId;
    } else if (position !== undefined && position !== oldPosition) {
      if (position > oldPosition) {
        await Task.updateMany(
          {
            listId: task.listId,
            position: { $gt: oldPosition, $lte: position },
          },
          { $inc: { position: -1 } }
        );
      } else {
        await Task.updateMany(
          {
            listId: task.listId,
            position: { $gte: position, $lt: oldPosition },
          },
          { $inc: { position: 1 } }
        );
      }
      task.position = position;
    }

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (deadline !== undefined) task.deadline = deadline;
    if (attachment !== undefined) task.attachment = attachment;
    if (assignedTo !== undefined) task.assignedTo = assignedTo;

    let populatedTask = await Task.findById(task._id)
      .populate("assignedTo", "username email")
      .populate("createdBy", "username email");

    res.json(populatedTask);

    const io = req.app.get("io");
    const board = await Board.findById(req.board._id).populate("members.user");

    // Notify all members except updater
    for (const member of board.members) {
      const memberId = member.user._id.toString();
      if (memberId === req.user._id.toString()) continue;

      const notification = await Notification.create({
        user: memberId,
        title: `✏️ Task Updated: ${task.title}`,
        boardId: board._id,
        message: `The task "${task.title}" was updated on board "${req.board.name}".`,
        taskId: task._id,
      });

      io.to(memberId).emit("taskUpdated", notification);
    }

    // Notify newly assigned user
    if (assignedTo && assignedTo !== oldAssigned) {
      const assignedUser = await User.findById(assignedTo);
      if (assignedUser) {
        const notification = await Notification.create({
          user: assignedUser._id,
          title: `📌 Task Assigned: ${task.title}`,
          boardId: board._id,
          message: `You have been assigned to task "${task.title}" in board "${req.board.name}".`,
          taskId: task._id,
        });

        io.to(assignedUser._id.toString()).emit("taskAssigned", notification);

        await sendMail({
          to: assignedUser.email,
          subject: `New Task Assigned: ${task.title}`,
          text: `Hello ${assignedUser.username},\n\nYou have been assigned to task "${task.title}" in board "${req.board.name}".`,
          html: `<p>Hello ${assignedUser.username},</p><p>You have been assigned to task "<b>${task.title}</b>" in board "<b>${req.board.name}</b>".</p>`,
        });
      }
    }

    io.to(board._id.toString()).emit("taskChanged", {
      type: "updated",
      task,
      taskId: task._id,
    });
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Complete Task ---
// --- Complete Task ---
const completeTask = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.taskId,
      boardId: req.board._id,
    });
    if (!task) return res.status(404).json({ message: "Task not found" });
    if (task.completed)
      return res.status(400).json({ message: "Task already completed" });

    task.completed = true;
    task.completedBy = req.user._id;
    task.completedAt = new Date();
    await task.save();

    const board = await Board.findById(task.boardId).populate("members.user");
    const io = req.app.get("io");

    // Notify all board members about completion
    io.to(board._id.toString()).emit("taskCompleted", task);

    // Optionally notify admins separately via email & notification
    const admins = board.members.filter((m) => m.role === "admin");
    for (const admin of admins) {
      const notification = await Notification.create({
        user: admin.user._id,
        title: `✅ Task Completed: ${task.title}`,
        boardId: board._id,
        message: `${req.user.username} completed the task "${task.title}"`,
        taskId: task._id,
      });
      io.to(admin.user._id.toString()).emit("taskCompleted", notification);

      const adminUser = await User.findById(admin.user._id);
      if (adminUser) {
        await sendMail({
          to: adminUser.email,
          subject: `Task Completed: ${task.title}`,
          text: `${req.user.username} has completed the task "${task.title}".`,
          html: `<p>${req.user.username} has completed the task "<b>${task.title}</b>".</p>`,
        });
      }
    }

    res.json(task);
  } catch (error) {
    console.error("Error completing task:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Delete Task ---
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.taskId,
      boardId: req.board._id,
    });
    if (!task) return res.status(404).json({ message: "Task not found" });

    const isAdmin = req.boardMembership.role === "admin";
    const isCreator = task.createdBy.toString() === req.user._id.toString();
    if (!isAdmin && !isCreator)
      return res.status(403).json({ message: "Unauthorized" });

    await task.deleteOne();

    const io = req.app.get("io");
    io.to(req.board._id.toString()).emit("taskChanged", {
      type: "deleted",
      task,
      taskId: task._id,
    });

    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// --- Get Tasks Grouped by List ---
// --- Get Tasks Grouped by List with assigned user populated ---
const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ boardId: req.board._id })
      .populate("assignedTo", "username email") // populate assigned user
      .populate("createdBy", "username email"); // optionally populate creator

    const grouped = {};
    tasks.forEach((task) => {
      const lid = task.listId?.toString();
      if (!grouped[lid]) grouped[lid] = [];
      grouped[lid].push(task);
    });

    res.json(grouped);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { createTask, updateTask, deleteTask, getTasks, completeTask };
