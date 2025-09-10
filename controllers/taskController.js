const Task = require("../models/Task");

// Create Task
// POST /api/boards/:id/tasks
const createTask = async (req, res) => {
  try {
    const { title, description, deadline, attachment, listId } = req.body;
    const boardId = req.board._id;

    if (!listId) {
      return res.status(400).json({ message: "listId is required" });
    }

    // Find current max position in the list
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
    });

    res.status(201).json(task);

    const io = req.app.get("io");

    if (io)
      io.to(req.params.id).emit("taskChanged", {
        type: "created",
        task,
        taskId: task._id,
      });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get all tasks for a board (grouped by list)
const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ boardId: req.board._id });

    // Group tasks by listId
    const grouped = {};
    tasks.forEach((task) => {
      const lid = task.listId?.toString();
      if (!grouped[lid]) grouped[lid] = [];
      grouped[lid].push(task);
    });

    res.json(grouped);
  } catch (error) {
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

    const oldPosition = task.position;

    // If moving to another list
    if (listId && listId !== task.listId.toString()) {
      // Remove from old list: decrement positions of tasks after this one
      await Task.updateMany(
        { listId: task.listId, position: { $gt: task.position } },
        { $inc: { position: -1 } }
      );

      // Insert into new list at the specified position
      // Shift positions of tasks at or after the new position
      const insertPosition = position !== undefined ? position : 0;
      await Task.updateMany(
        { listId, position: { $gte: insertPosition } },
        { $inc: { position: 1 } }
      );

      task.position = insertPosition;
      task.listId = listId;
    } else if (position !== undefined && position !== task.position) {
      // Reorder within the same list
      if (position > oldPosition) {
        // Move down: decrement positions between oldPosition+1 and position
        await Task.updateMany(
          {
            listId: task.listId,
            position: { $gt: oldPosition, $lte: position },
          },
          { $inc: { position: -1 } }
        );
      } else {
        // Move up: increment positions between position and oldPosition-1
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

    // Update other fields
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (deadline !== undefined) task.deadline = deadline;
    if (attachment !== undefined) task.attachment = attachment;

    await task.save();
    res.json(task);

    const io = req.app.get("io");

    if (io)
      io.to(req.params.id).emit("taskChanged", {
        type: "updated",
        task,
        taskId: task._id,
      });
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

    const io = req.app.get("io");

    if (io)
      io.to(req.params.id).emit("taskChanged", {
        type: "deleted",
        task: undefined,
        taskId: req.params.taskId,
      });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { createTask, getTasks, updateTask, deleteTask };
