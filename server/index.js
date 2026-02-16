require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("./models/User");
const Message = require("./models/Message");

const app = express();

/* =============================
   CORS CONFIG (IMPORTANT)
============================= */

const FRONTEND_URL =
  "https://chat-d2imt171z-alvinsaju7479s-projects.vercel.app";

app.use(
  cors({
    origin: [FRONTEND_URL, "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  })
);

app.use(express.json());

/* =============================
   MONGODB CONNECTION
============================= */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("Mongo Error:", err));

/* =============================
   SERVER + SOCKET.IO
============================= */

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [FRONTEND_URL, "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

let onlineUsers = {};

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.on("join_room", ({ username, room }) => {
    socket.join(room);

    onlineUsers[socket.id] = { username, room };

    const usersInRoom = Object.values(onlineUsers)
      .filter((user) => user.room === room)
      .map((user) => user.username);

    io.to(room).emit("update_users", usersInRoom);
  });

  socket.on("typing", ({ room, username }) => {
    socket.to(room).emit("show_typing", username);
  });

  socket.on("stop_typing", ({ room }) => {
    socket.to(room).emit("hide_typing");
  });

  socket.on("send_message", async ({ room, author, message }) => {
    try {
      const messageData = {
        room,
        author,
        message,
        time: new Date().toLocaleTimeString(),
      };

      await Message.create(messageData);

      io.to(room).emit("receive_message", messageData);
    } catch (err) {
      console.log("Message Error:", err);
    }
  });

  socket.on("disconnect", () => {
    const user = onlineUsers[socket.id];

    if (user) {
      const room = user.room;
      delete onlineUsers[socket.id];

      const usersInRoom = Object.values(onlineUsers)
        .filter((u) => u.room === room)
        .map((u) => u.username);

      io.to(room).emit("update_users", usersInRoom);
    }

    console.log("🔴 User disconnected:", socket.id);
  });
});

/* =============================
   AUTH ROUTES
============================= */

app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({ username, password: hashedPassword });

    res.json({ message: "User created" });
  } catch (err) {
    res.status(400).json({ error: "User already exists" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user)
      return res.status(400).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ error: "Wrong password" });

    const token = jwt.sign(
      { username },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token, username });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* =============================
   FETCH ROOM MESSAGES
============================= */

app.get("/messages/:room", async (req, res) => {
  try {
    const messages = await Message.find({
      room: req.params.room,
    });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/* =============================
   START SERVER
============================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
