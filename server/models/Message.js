const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  room: String,
  author: String,
  message: String,
  time: String,
});

module.exports = mongoose.model("Message", MessageSchema);
