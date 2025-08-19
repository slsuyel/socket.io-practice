/* eslint-disable react-hooks/exhaustive-deps */
import  { useState, useEffect, useMemo } from "react";
import { io } from "socket.io-client";

const App = () => {
  const [username, setUsername] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  const socket = useMemo(() => io("http://localhost:3000"), []);

  useEffect(() => {
    if (!loggedIn) return;

    socket.emit("register", username);

    socket.on("online-users", (data) => {
      setUsers(data.filter(u => u.username !== username));
    });

    socket.on("private-message", (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on("typing", ({ from }) => {
      setTypingUsers(prev => [...new Set([...prev, from])]);
    });

    socket.on("stop-typing", ({ from }) => {
      setTypingUsers(prev => prev.filter(u => u !== from));
    });

    return () => socket.disconnect();
  }, [loggedIn]);

  useEffect(() => {
    if (!recipient) return;
    fetch(`http://localhost:3000/messages/${username}/${recipient}`)
      .then(res => res.json())
      .then(data => setMessages(data.map(m => ({
        fromUserId: m.fromUserId === username ? "Me" : m.fromUserId,
        message: m.message,
        createdAt: m.createdAt
      }))));
  }, [recipient]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!recipient) return alert("Select a user to chat with!");
    socket.emit("private-message", { message, to: recipient });
    // setMessages(prev => [...prev, { fromUserId: "Me", message }]);
    setMessage("");
    socket.emit("stop-typing", { to: recipient });
  };
console.log(messages)
  const handleTyping = () => {
    if (recipient) socket.emit("typing", { to: recipient });
  };

  const handleStopTyping = () => {
    if (recipient) socket.emit("stop-typing", { to: recipient });
  };

  if (!loggedIn) {
    return (
      <div style={{ padding: 20 }}>
        <input
          placeholder="Enter Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <button onClick={() => setLoggedIn(true)}>Join Chat</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h3>Logged in as: {username}</h3>

      <h4>Users:</h4>
      {users.map(u => (
        <button key={u.username} onClick={() => setRecipient(u.username)}>
          {u.username} {u.online ? "(Online)" : "(Offline)"}
        </button>
      ))}

      <h4>Chatting with: {recipient || "Select a user"}</h4>
      {typingUsers.includes(recipient) && <p>{recipient} is typing...</p>}

      <form onSubmit={handleSend}>
        <input
          value={message}
          onChange={(e) => { setMessage(e.target.value); handleTyping(); }}
          onBlur={handleStopTyping}
          placeholder="Type a message"
        />
        <button type="submit">Send</button>
      </form>

      <div>
        {messages.map((m, i) => (
          <p key={i}><b>{m.fromUserId}:</b> {m.message}</p>
        ))}
      </div>
    </div>
  );
};

export default App;
