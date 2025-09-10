const { Server } = require("socket.io");

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("joinBoard", (boardId) => {
      socket.join(boardId);
    });

    socket.on("taskChanged", ({ boardId, type, task, taskId }) => {
      if (type === "deleted") {
        io.to(boardId).emit("taskChanged", { type, task: undefined, taskId });
      } else {
        io.to(boardId).emit("taskChanged", {
          type,
          task,
          taskId: task?._id || undefined,
        });
      }
    });
  });

  return io;
}

module.exports = setupSocket;
