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
    // Join user-specific room
    socket.on("registerUser", (userId) => {
      if (userId) socket.join(userId.toString());
    });

    // Join board room
    socket.on("joinBoard", (boardId) => {
      console.log(`Socket ${socket.id} joined board ${boardId}`);

      if (boardId) socket.join(boardId);
    });

    // Leave board room
    socket.on("leaveBoard", (boardId) => {
      if (boardId) socket.leave(boardId);
    });
  });

  return io;
}

// Helper to emit socket events from anywhere in the server
function emitToBoard(boardId, event, payload) {
  if (!io) return;
  io.to(boardId).emit(event, payload);
}

function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(userId.toString()).emit(event, payload);
}

module.exports = { setupSocket, emitToBoard, emitToUser };
