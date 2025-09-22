const cron = require("node-cron"); // ✅ add this
const Task = require("./models/Task");
const Notification = require("./models/Notification");
const { emitToUser, emitToBoard } = require("./socket");

cron.schedule("* * * * *", async () => {
  const now = new Date();
  const next24Hours = new Date(Date.now() + 5 * 60 * 1000);

  console.log("[CRON RUNNING]", now.toLocaleTimeString());

  try {
    const upcomingTasks = await Task.find({
      deadline: { $gte: now, $lte: next24Hours },
    }).populate("assignedTo");

    console.log("[CRON] Upcoming Tasks:", upcomingTasks.length);
    for (const task of upcomingTasks) {
      const board = await Board.findById(task.boardId).populate("members.user");

      for (const member of board.members) {
        const memberId = member.user._id.toString();
        const message = `Task "${
          task.title
        }" is due at ${task.deadline.toLocaleTimeString()}`;

        emitToUser(memberId, "deadlineReminder", {
          taskId: task._id,
          title: task.title,
          deadline: task.deadline,
          boardId: task.boardId,
          message,
        });

        await Notification.create({
          user: memberId,
          boardId: task.boardId,
          taskId: task._id,
          title: task.title,
          message,
        });
      }

      // Optional board emit
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
