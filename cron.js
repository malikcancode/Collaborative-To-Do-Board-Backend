const cron = require("node-cron"); // ✅ add this
const Task = require("./models/Task");
const Notification = require("./models/Notification");
const { emitToUser, emitToBoard } = require("./socket");

cron.schedule("* * * * *", async () => {
  const now = new Date();
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  console.log("[CRON RUNNING]", now.toLocaleTimeString());

  try {
    const upcomingTasks = await Task.find({
      deadline: { $gte: now, $lte: next24Hours },
    }).populate("assignedTo");

    console.log("[CRON] Upcoming Tasks:", upcomingTasks.length);

    for (const task of upcomingTasks) {
      const message = `Task "${
        task.title
      }" is due at ${task.deadline.toLocaleTimeString()}`;

      if (task.assignedTo) {
        console.log(
          `[CRON] Emitting to user: ${task.assignedTo._id}`,
          task.title
        );
        emitToUser(task.assignedTo._id, "deadlineReminder", {
          taskId: task._id,
          title: task.title,
          deadline: task.deadline,
          boardId: task.boardId,
          message,
        });

        await Notification.create({
          user: task.assignedTo._id,
          boardId: task.boardId,
          taskId: task._id,
          title: task.title,
          message,
        });
      }

      console.log(`[CRON] Emitting to board: ${task.boardId}`, task.title);
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
