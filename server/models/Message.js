const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  room: String,
  author: String,
  message: String,
  time: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Message", MessageSchema);
