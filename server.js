const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// 🔹 Phục vụ file tĩnh từ thư mục "public"
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🔸 WebSocket logic
let queue = [];
let rooms = new Map(); // socket.id -> partner.id
let roomData = new Map(); // roomId -> { user1, user2, createdAt }

io.on("connection", (socket) => {
  console.log("Người dùng kết nối:", socket.id);

  // Matching logic
  if (queue.length > 0) {
    const partner = queue.pop();
    const roomId = `room_${socket.id}_${partner.id}`;
    
    // Set up room mapping
    rooms.set(socket.id, partner.id);
    rooms.set(partner.id, socket.id);
    
    // Store room data
    roomData.set(roomId, {
      user1: socket.id,
      user2: partner.id,
      createdAt: new Date()
    });

    // Join room
    socket.join(roomId);
    partner.join(roomId);

    // Notify both users
    io.to(roomId).emit("matched");
    
    console.log(`Matched: ${socket.id} <-> ${partner.id} in room ${roomId}`);
  } else {
    queue.push(socket);
    console.log(`User ${socket.id} added to queue. Queue size: ${queue.length}`);
  }

  // Handle messages
  socket.on("message", (msg) => {
    const partnerId = rooms.get(socket.id);
    if (partnerId) {
      // Send message to partner
      io.to(partnerId).emit("message", msg);
      console.log(`Message from ${socket.id} to ${partnerId}: ${msg}`);
    }
  });

  // Handle typing indicator
  socket.on("typing", () => {
    const partnerId = rooms.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("typing");
    }
  });

  socket.on("stop-typing", () => {
    const partnerId = rooms.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("stop-typing");
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("Người dùng ngắt kết nối:", socket.id);
    
    const partnerId = rooms.get(socket.id);
    if (partnerId) {
      // Notify partner
      io.to(partnerId).emit("partner-disconnected");
      
      // Clean up partner's room mapping
      rooms.delete(partnerId);
      
      // Find and remove room data
      for (let [roomId, data] of roomData.entries()) {
        if (data.user1 === socket.id || data.user2 === socket.id) {
          roomData.delete(roomId);
          break;
        }
      }
      
      console.log(`Partner ${partnerId} notified of disconnect`);
    }

    // Clean up current user
    rooms.delete(socket.id);
    
    // Remove from queue if still waiting
    const queueIndex = queue.findIndex(s => s.id === socket.id);
    if (queueIndex !== -1) {
      queue.splice(queueIndex, 1);
      console.log(`Removed ${socket.id} from queue. Queue size: ${queue.length}`);
    }
  });

  // Handle manual disconnect
  socket.on("manual-disconnect", () => {
    console.log("Manual disconnect requested by:", socket.id);
    
    const partnerId = rooms.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit("partner-disconnected");
      rooms.delete(partnerId);
    }
    
    rooms.delete(socket.id);
    socket.disconnect();
  });
});

// Statistics endpoint
app.get("/stats", (req, res) => {
  res.json({
    connectedUsers: io.engine.clientsCount,
    queueSize: queue.length,
    activeRooms: rooms.size / 2, // Divide by 2 because each room has 2 entries
    totalRooms: roomData.size
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// Cleanup old rooms periodically (optional)
setInterval(() => {
  const now = new Date();
  for (let [roomId, data] of roomData.entries()) {
    // Remove rooms older than 24 hours
    if (now - data.createdAt > 24 * 60 * 60 * 1000) {
      roomData.delete(roomId);
    }
  }
}, 60 * 60 * 1000); // Check every hour

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 AnonyChat Server đang chạy tại http://localhost:${PORT}`);
  console.log(`📊 Stats: http://localhost:${PORT}/stats`);
  console.log(`💚 Health: http://localhost:${PORT}/health`);
});