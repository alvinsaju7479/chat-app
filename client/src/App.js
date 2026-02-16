import React, { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import "./App.css";

const BACKEND_URL = "https://chat-app-aqrr.onrender.com";
const socket = io(BACKEND_URL);

function App() {
  const [username, setUsername] = useState(localStorage.getItem("username") || "");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [room, setRoom] = useState("");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUser, setTypingUser] = useState("");
  const [darkMode, setDarkMode] = useState(false);

  const chatRef = useRef(null);

  // =========================
  // AUTH FUNCTIONS
  // =========================

  const register = async () => {
    if (!username || !password) return alert("Enter details");

    const res = await fetch(`${BACKEND_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (data.error) alert(data.error);
    else alert("Registered successfully!");
  };

  const login = async () => {
    if (!username || !password) return alert("Enter details");

    const res = await fetch(`${BACKEND_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);
      setToken(data.token);
      setUsername(data.username);
    } else {
      alert(data.error || "Login failed");
    }
  };

  const logout = () => {
    localStorage.clear();
    setToken(null);
    setChat([]);
    setRoom("");
  };

  // =========================
  // CHAT FUNCTIONS
  // =========================

  const joinRoom = async () => {
    if (!room) return alert("Enter room name");

    const currentUser = localStorage.getItem("username");

    socket.emit("join_room", { username: currentUser, room });

    const res = await fetch(`${BACKEND_URL}/messages/${room}`);
    const data = await res.json();
    setChat(data);
  };

  const sendMessage = () => {
    if (!message.trim()) return;

    const currentUser = localStorage.getItem("username");

    socket.emit("send_message", {
      room,
      author: currentUser,
      message,
    });

    socket.emit("stop_typing", { room });

    setMessage("");
  };

  // =========================
  // SOCKET LISTENERS
  // =========================

  useEffect(() => {
    socket.on("receive_message", (data) => {
      setChat((prev) => [...prev, data]);
    });

    socket.on("update_users", (users) => {
      setOnlineUsers(users);
    });

    socket.on("show_typing", (user) => {
      setTypingUser(user);
    });

    socket.on("hide_typing", () => {
      setTypingUser("");
    });

    return () => {
      socket.off("receive_message");
      socket.off("update_users");
      socket.off("show_typing");
      socket.off("hide_typing");
    };
  }, []);

  // =========================
  // AUTO SCROLL
  // =========================

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chat]);

  // =========================
  // LOGIN SCREEN
  // =========================

  if (!token) {
    return (
      <div className="auth-container">
        <h2>Login / Register</h2>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={register}>Register</button>
        <button onClick={login}>Login</button>
      </div>
    );
  }

  // =========================
  // CHAT SCREEN
  // =========================

  return (
    <div className={`App ${darkMode ? "dark" : ""}`}>
      <div className="chat-window">
        <div className="chat-header">
          <span>Room: {room || "Not Joined"}</span>
          <span>🟢 {onlineUsers.length}</span>

          <div>
            <button onClick={() => setDarkMode(!darkMode)}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            <button onClick={logout}>Logout</button>
          </div>
        </div>

        <div className="room-join">
          <input
            placeholder="Enter Room Name"
            onChange={(e) => setRoom(e.target.value)}
          />
          <button onClick={joinRoom}>Join</button>
        </div>

        <div className="chat-body" ref={chatRef}>
          {chat.map((msg, index) => (
            <div
              key={index}
              className={`message ${
                msg.author === localStorage.getItem("username")
                  ? "mine"
                  : ""
              }`}
            >
              <b>{msg.author}</b>
              <div>{msg.message}</div>
              <small>{msg.time}</small>
            </div>
          ))}

          {typingUser && (
            <div className="typing">{typingUser} is typing...</div>
          )}
        </div>

        <div className="chat-footer">
          <input
            value={message}
            placeholder="Type a message..."
            onChange={(e) => {
              setMessage(e.target.value);
              socket.emit("typing", {
                room,
                username: localStorage.getItem("username"),
              });
            }}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default App;
