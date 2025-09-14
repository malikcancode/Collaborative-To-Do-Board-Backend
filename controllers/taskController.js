const Task = require("../models/Task");
const Notification = require("../models/Notification");
const Board = require("../models/Board");

const createTask = async (req, res) => {
  try {
    const { title, description, deadline, attachment, listId } = req.body;
    const boardId = req.board._id;

    if (!listId) return res.status(400).json({ message: "listId is required" });

    // Find last task for position
    const lastTask = await Task.findOne({ listId }).sort("-position");
    const position = lastTask ? lastTask.position + 1 : 0;

    // Create the task
    const task = await Task.create({
      boardId,
      listId,
      title,
      description,
      deadline,
      attachment,
      position,
      createdBy: req.user._id,
    });

    // ✅ Send response immediately
    res.status(201).json(task);

    // ✅ Get board with members populated
    const board = await Board.findById(boardId).populate("members.user");

    const io = req.app.get("io");

    if (board && io) {
      // Loop through members (skip creator)
      for (const member of board.members) {
        const memberId = member.user._id.toString();
        if (memberId === req.user._id.toString()) continue;

        // Create a notification for this member
        const notification = await Notification.create({
          user: memberId,
          title: `📌 Task: ${task.title}`,
          boardId,
          message: `A new task <b>"${task.title}"</b> was added to the board <b>"${req.board.name}"</b>.`,
          description: task.description || "No description provided",
          deadline: task.deadline,
          taskId: task._id,
        });

        // Send real-time event to this member
        io.to(memberId).emit("deadlineReminder", notification);
      }

      // Broadcast task change to the whole board room
      io.to(boardId.toString()).emit("taskChanged", {
        type: "created",
        task,
        taskId: task._id,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update Task
const updateTask = async (req, res) => {
  try {
    const { title, description, deadline, attachment, listId, position } =
      req.body;

    const task = await Task.findOne({
      _id: req.params.taskId,
      boardId: req.board._id,
    });
    if (!task) return res.status(404).json({ message: "Task not found" });

    // Handle position changes
    const oldPosition = task.position;

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

    await task.save();
    res.json(task);

    const io = req.app.get("io");

    // ✅ Notify board members about update
    const board = await Board.findById(req.board._id).populate("members.user");

    if (board && io) {
      for (const member of board.members) {
        const memberId = member.user._id.toString();
        if (memberId === req.user._id.toString()) continue;

        const notification = await Notification.create({
          user: memberId,
          title: `✏️ Task Updated: ${task.title}`,
          boardId: board._id,
          message: `The task <b>"${task.title}"</b> was updated on the board <b>"${req.board.name}"</b>.`,
          description: task.description || "No description provided",
          deadline: task.deadline,
          taskId: task._id,
        });

        io.to(memberId).emit("deadlineReminder", notification);
      }

      io.to(board._id.toString()).emit("taskChanged", {
        type: "updated",
        task,
        taskId: task._id,
      });
    }
  } catch (error) {
    console.error("[SERVER ERROR in updateTask]:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete Task
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
    res.json({ message: "Task deleted successfully" });

    const io = req.app.get("io");
    if (io)
      io.to(req.board._id.toString()).emit("taskChanged", {
        type: "deleted",
        task,
        taskId: task._id,
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get Tasks
const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ boardId: req.board._id });
    const grouped = {};
    tasks.forEach((task) => {
      const lid = task.listId?.toString();
      if (!grouped[lid]) grouped[lid] = [];
      grouped[lid].push(task);
    });
    res.json(grouped);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { createTask, updateTask, deleteTask, getTasks };
