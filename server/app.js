
// import express from "express";
// import { createServer } from "http";
// import { Server } from "socket.io";
// import cors from "cors";
// import mongoose from "mongoose";

// // --- MongoDB URI ---
// const MONGODB_URI = "mongodb+srv://chat-application-usamarry:chat-application-usamarry@cluster0.rafof.mongodb.net/chatapp?retryWrites=true&w=majority&appName=Cluster0";

// // --- Connect to MongoDB ---
// mongoose.connect(MONGODB_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });

// // --- Connection event listeners ---
// const db = mongoose.connection;
// db.on("connected", () => console.log("✅ MongoDB connected successfully"));
// db.on("error", (err) => console.error("❌ MongoDB connection error:", err));
// db.on("disconnected", () => console.log("⚠️ MongoDB disconnected"));

// // --- Message Schema ---
// const messageSchema = new mongoose.Schema({
//   fromUserId: String,
//   toUserId: String,
//   message: String,
//   createdAt: { type: Date, default: Date.now },
// });
// const Message = mongoose.model("Message", messageSchema);

// const userSchema = new mongoose.Schema({
//   username: { type: String, required: true, unique: true },
//   online: { type: Boolean, default: false },
// });

// const User = mongoose.model("User", userSchema);


// // --- Express Setup ---
// const app = express();
// app.use(cors({ origin: "http://localhost:5173", credentials: true }));
// app.use(express.json()); // parse JSON

// // --- HTTP Server & Socket.io ---
// const server = createServer(app);
// const io = new Server(server, {
//   cors: { origin: "http://localhost:5173", credentials: true },
// });

// // --- Track online users ---
// const onlineUsers = new Map();

// io.on("connection", (socket) => {
//   console.log("New connection:", socket.id);

//   // Register user
//   socket.on("register", (userId) => {
//     socket.userId = userId;
//     onlineUsers.set(userId, socket.id);
//     io.emit("online-users", Array.from(onlineUsers.keys()));
//     console.log("Online users:", Array.from(onlineUsers.keys()));
//   });

//   // Private message
//   socket.on("private-message", async ({ message, fromUserId, toUserId }) => {
//     try {
//       // Save message in MongoDB
//       const msgDoc = await Message.create({ fromUserId, toUserId, message });

//       // Send to recipient
//       const targetSocket = onlineUsers.get(toUserId);
//       if (targetSocket) {
//         io.to(targetSocket).emit("private-message", {
//           fromUserId,
//           message,
//           createdAt: msgDoc.createdAt,
//         });
//       }

//       // Send back to sender
//       socket.emit("private-message", {
//         fromUserId: "Me",
//         message,
//         createdAt: msgDoc.createdAt,
//       });
//     } catch (err) {
//       console.error("Error saving message:", err);
//     }
//   });

//   // Disconnect
//   socket.on("disconnect", () => {
//     if (socket.userId) {
//       onlineUsers.delete(socket.userId);
//       io.emit("online-users", Array.from(onlineUsers.keys()));
//       console.log("User disconnected:", socket.userId);
//     }
//   });
// });

// // --- API: Fetch chat history between two users ---
// app.get("/messages/:user1/:user2", async (req, res) => {
//   const { user1, user2 } = req.params;
//   try {
//     const messages = await Message.find({
//       $or: [
//         { fromUserId: user1, toUserId: user2 },
//         { fromUserId: user2, toUserId: user1 },
//       ],
//     }).sort({ createdAt: 1 });

//     res.json(messages);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "Server error" });
//   }
// });

// // --- Start server ---
// server.listen(3000, () => console.log("Server running on port 3000"));
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";

// --- MongoDB URI ---
const MONGODB_URI = "mongodb+srv://chat-application-usamarry:chat-application-usamarry@cluster0.rafof.mongodb.net/chatapp?retryWrites=true&w=majority&appName=Cluster0";

// --- Connect to MongoDB ---
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// --- Connection event listeners ---
const db = mongoose.connection;
db.on("connected", () => console.log("✅ MongoDB connected successfully"));
db.on("error", (err) => console.error("❌ MongoDB connection error:", err));
db.on("disconnected", () => console.log("⚠️ MongoDB disconnected"));

// --- Schemas ---
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  online: { type: Boolean, default: false },
});

const messageSchema = new mongoose.Schema({
  fromUserId: String,
  toUserId: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);

// --- Express Setup ---
const app = express();
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// --- HTTP Server & Socket.io ---
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173", credentials: true },
});

// --- Track online users ---
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  // Register user
  socket.on("register", async (username) => {
    socket.username = username;

    await User.findOneAndUpdate(
      { username },
      { online: true },
      { upsert: true, new: true }
    );

    onlineUsers.set(username, socket.id);

    const allUsers = await User.find({}, "username online");
    io.emit("online-users", allUsers);
  });

  // Typing indicator
  socket.on("typing", ({ to }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) io.to(targetSocket).emit("typing", { from: socket.username });
  });

  socket.on("stop-typing", ({ to }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) io.to(targetSocket).emit("stop-typing", { from: socket.username });
  });

  // Private message
  socket.on("private-message", async ({ message, to }) => {
    const msgDoc = await Message.create({
      fromUserId: socket.username,
      toUserId: to,
      message,
    });

    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit("private-message", {
        fromUserId: socket.username,
        message,
        createdAt: msgDoc.createdAt,
      });
    }

    socket.emit("private-message", {
      fromUserId: "Me",
      message,
      createdAt: msgDoc.createdAt,
    });
  });

  // Disconnect
  socket.on("disconnect", async () => {
    if (socket.username) {
      onlineUsers.delete(socket.username);
      await User.findOneAndUpdate({ username: socket.username }, { online: false });

      const allUsers = await User.find({}, "username online");
      io.emit("online-users", allUsers);

      console.log("User disconnected:", socket.username);
    }
  });
});

// --- API: fetch all users ---
app.get("/users", async (req, res) => {
  const users = await User.find({}, "username online");
  res.json(users);
});

// --- API: fetch messages between two users ---
app.get("/messages/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;
  try {
    const messages = await Message.find({
      $or: [
        { fromUserId: user1, toUserId: user2 },
        { fromUserId: user2, toUserId: user1 },
      ],
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Start server ---
server.listen(3000, () => console.log("Server running on port 3000"));
