const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./models/User");

const JWT_SECRET = "supersecretkey";

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/chatapp")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

const Message = require("./models/Message");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});
let onlineUsers = {};

io.on("connection", (socket) => {
  console.log("User Connected:", socket.id);

  socket.on("join_room", (data) => {
    socket.join(data.room);

    onlineUsers[socket.id] = {
      username: data.username,
      room: data.room
    };

    const usersInRoom = Object.values(onlineUsers)
      .filter(user => user.room === data.room)
      .map(user => user.username);

    io.to(data.room).emit("update_users", usersInRoom);
  });

  socket.on("typing", (data) => {
    socket.to(data.room).emit("show_typing", data.username);
  });

  socket.on("stop_typing", (data) => {
    socket.to(data.room).emit("hide_typing");
  });

  socket.on("send_message", async (data) => {
    const messageWithTime = {
      ...data,
      time: new Date().toLocaleTimeString()
    };

    await Message.create(messageWithTime);

    io.to(data.room).emit("receive_message", messageWithTime);
  });

  socket.on("disconnect", () => {
    const user = onlineUsers[socket.id];

    if (user) {
      const room = user.room;
      delete onlineUsers[socket.id];

      const usersInRoom = Object.values(onlineUsers)
        .filter(user => user.room === room)
        .map(user => user.username);

      io.to(room).emit("update_users", usersInRoom);
    }

    console.log("User Disconnected:", socket.id);
  });
});


app.get("/messages/:room", async (req, res) => {
  const messages = await Message.find({ room: req.params.room });
  res.json(messages);
});
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const user = await User.create({
      username,
      password: hashedPassword,
    });

    res.json({ message: "User created" });
  } catch (err) {
    res.status(400).json({ error: "User already exists" });
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

server.listen(5000, () => {
  console.log("Server running on port 5000");
});
