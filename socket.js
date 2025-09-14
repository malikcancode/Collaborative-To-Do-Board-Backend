const { Server } = require("socket.io");

let io;

function setupSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    socket.on("registerUser", (userId) => {
      if (userId) socket.join(userId.toString());
    });

    socket.on("joinBoard", (boardId) => {
      if (boardId) socket.join(boardId);
    });

    socket.on("leaveBoard", (boardId) => {
      socket.leave(boardId);
    });
  });

  return io;
}

function emitToBoard(boardId, event, payload) {
  if (!io) return;
  io.to(boardId.toString()).emit(event, payload);
}

function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(userId.toString()).emit(event, payload);
}

module.exports = { setupSocket, emitToBoard, emitToUser };
