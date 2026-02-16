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

const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));



const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
  },
});

let onlineUsers = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join_room", (data) => {
    socket.join(data.room);

    onlineUsers[socket.id] = {
      username: data.username,
      room: data.room,
    };

    const users = Object.values(onlineUsers)
      .filter(u => u.room === data.room)
      .map(u => u.username);

    io.to(data.room).emit("update_users", users);
  });

  socket.on("typing", (data) => {
    socket.to(data.room).emit("show_typing", data.username);
  });

  socket.on("stop_typing", (data) => {
    socket.to(data.room).emit("hide_typing");
  });

  socket.on("send_message", async (data) => {
    const messageData = {
      ...data,
      time: new Date().toLocaleTimeString(),
    };

    await Message.create(messageData);
    io.to(data.room).emit("receive_message", messageData);
  });

  socket.on("disconnect", () => {
    const user = onlineUsers[socket.id];
    if (user) {
      const room = user.room;
      delete onlineUsers[socket.id];

      const users = Object.values(onlineUsers)
        .filter(u => u.room === room)
        .map(u => u.username);

      io.to(room).emit("update_users", users);
    }
  });
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await User.create({ username, password: hashedPassword });
    res.json({ message: "User created" });
  } catch {
    res.status(400).json({ error: "User exists" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username });
  if (!user) return res.status(400).json({ error: "User not found" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ error: "Wrong password" });

  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1d" });

  res.json({ token, username });
});

app.get("/messages/:room", async (req, res) => {
  const messages = await Message.find({ room: req.params.room });
  res.json(messages);
});

server.listen(process.env.PORT || 5000, () => {
  console.log("Server running");
});

