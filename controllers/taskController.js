const Task = require("../models/Task");

// Create Task
// POST /api/boards/:id/tasks
const createTask = async (req, res) => {
  try {
    const { title, description, deadline, attachment, status } = req.body;
    const boardId = req.board._id;

    const task = await Task.create({
      boardId,
      title,
      description,
      deadline,
      attachment,
      status: status || "To Do",
      createdBy: req.user._id,
    });

    res.status(201).json(task);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
// Get all tasks for a board (grouped by list)
const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ boardId: req.board._id });

    // group tasks by status
    const grouped = {
      todo: tasks.filter((t) => t.status === "To Do"),
      progress: tasks.filter((t) => t.status === "In Progress"),
      done: tasks.filter((t) => t.status === "Done"),
    };

    res.json(grouped);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Update Task
const updateTask = async (req, res) => {
  try {
    const { title, description, deadline, attachment, status } = req.body;

    const task = await Task.findOne({
      _id: req.params.taskId,
      boardId: req.board._id,
    });

    if (!task) return res.status(404).json({ message: "Task not found" });

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (deadline !== undefined) task.deadline = deadline;
    if (attachment !== undefined) task.attachment = attachment;
    if (status !== undefined) task.status = status; // <-- Allow status update

    await task.save();
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

// Delete Task
// DELETE /api/boards/:id/tasks/:taskId
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.taskId,
      boardId: req.board._id,
    });

    if (!task) return res.status(404).json({ message: "Task not found" });

    await task.deleteOne();
    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { createTask, getTasks, updateTask, deleteTask };
