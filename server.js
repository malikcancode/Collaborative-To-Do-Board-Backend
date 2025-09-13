const express = require("express");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const connectDB = require("./config/db");
dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/boards", require("./routes/boardRoutes"));
app.use("/api/boards/:id/tasks", require("./routes/taskRoutes"));

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);

// --- Socket.IO Integration ---
const { setupSocket } = require("./socket");
const io = setupSocket(server);
app.set("io", io);
