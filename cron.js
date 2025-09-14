const cron = require("node-cron");
const Task = require("./models/Task");
const Notification = require("./models/Notification");
const { emitToUser, emitToBoard } = require("./socket");

// Run every minute
cron.schedule("* * * * *", async () => {
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  try {
    // Find tasks with deadline within the next hour
    const upcomingTasks = await Task.find({
      deadline: { $gte: now, $lte: oneHourLater },
    }).populate("assignedTo");

    for (const task of upcomingTasks) {
      // Create message
      const message = `Task "${
        task.title
      }" is due at ${task.deadline.toLocaleTimeString()}`;

      // 1️⃣ Emit to assigned user if exists
      if (task.assignedTo) {
        emitToUser(task.assignedTo._id, "deadlineReminder", {
          taskId: task._id,
          title: task.title,
          deadline: task.deadline,
          boardId: task.boardId,
          message,
        });

        // Save notification in DB
        await Notification.create({
          user: task.assignedTo._id,
          boardId: task.boardId,
          taskId: task._id,
          title: task.title,
          message,
        });
      }

      // 2️⃣ Optionally emit to board room for all members
      emitToBoard(task.boardId, "deadlineReminder", {
        taskId: task._id,
        title: task.title,
        deadline: task.deadline,
        message,
      });
    }
  } catch (err) {
    console.error("[CRON ERROR]:", err);
  }
});
