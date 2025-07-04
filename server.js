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

let friendRequests = new Map(); // socketId -> { targetId, timestamp }
let privateRooms = new Map();   // roomCode -> { user1, user2 }

io.on("connection", (socket) => {
  console.log("Người dùng kết nối:", socket.id);

  // Matching logic
  socket.on("start-matching", (info) => {
    socket.name = info.name || "Ẩn danh";
    socket.gender = info.gender || "Không rõ";

    if (queue.length > 0) {
      const partner = queue.pop();
      const roomId = `room_${socket.id}_${partner.id}`;

      // Gán tên và giới tính cho partner nếu chưa có
      partner.name = partner.name || "Ẩn danh";
      partner.gender = partner.gender || "Không rõ";

      // Thiết lập ghép đôi
      rooms.set(socket.id, partner.id);
      rooms.set(partner.id, socket.id);

      roomData.set(roomId, {
        user1: socket.id,
        user2: partner.id,
        createdAt: new Date()
      });

      socket.join(roomId);
      partner.join(roomId);

      // Gửi thông tin partner về cả hai phía
      socket.emit("matched", {
        partnerName: partner.name,
        partnerGender: partner.gender
      });

      partner.emit("matched", {
        partnerName: socket.name,
        partnerGender: socket.gender
      });

      console.log(`Matched: ${socket.id} <-> ${partner.id}`);
    } else {
      queue.push(socket);
      console.log(`User ${socket.id} added to queue. Queue size: ${queue.length}`);
    }
  });


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
      // CHỜ 10 giây trước khi báo ngắt kết nối
      setTimeout(() => {
        const stillMissing = !io.sockets.sockets.get(socket.id);
        const partnerStillThere = io.sockets.sockets.get(partnerId);

        if (stillMissing && partnerStillThere) {
          io.to(partnerId).emit("partner-disconnected");
          rooms.delete(partnerId);
          console.log(`👤 Partner ${partnerId} được báo là đã mất kết nối sau timeout.`);
        }
      }, 100000000); // ⏱ 10 giây chờ reconnect
    }


    rooms.delete(socket.id);

    // Kiểm tra xem socket này có nằm trong phòng private nào không
    for (const [roomCode, room] of privateRooms.entries()) {
      if (room.sockets) {
        for (const [userId, sockId] of room.sockets.entries()) {
          if (sockId === socket.id) {
            console.log(`🕒 ${socket.id} (${userId}) đã rời khỏi phòng ${roomCode}, chờ reconnect...`);

            // Không xoá ngay — nhưng có thể đặt timeout tự xoá nếu không reconnect sau 5 phút
            setTimeout(() => {
              const currentSocketId = room.sockets.get(userId);
              // Nếu userId vẫn chưa reconnect
              if (currentSocketId === socket.id) {
                room.sockets.delete(userId);
                console.log(`🧹 Đã dọn userId ${userId} khỏi phòng ${roomCode} sau timeout.`);
              }

              // Nếu cả 2 người đều rời -> xóa luôn
              if (room.sockets.size === 0) {
                privateRooms.delete(roomCode);
                console.log(`🗑️ Phòng riêng ${roomCode} bị xoá vì không còn ai.`);
              }

            }, 5 * 60 * 1000); // 5 phút
            break;
          }
        }
      }
    }

    // CŨ: dọn hàng đợi nếu đang chờ ghép
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

  // Người A gửi yêu cầu kết bạn
  socket.on("friend-request", () => {
    const partnerId = rooms.get(socket.id);
    if (!partnerId) return;

    io.to(partnerId).emit("friend-invitation");
    friendRequests.set(socket.id, { targetId: partnerId, time: Date.now() });

    setTimeout(() => {
      friendRequests.delete(socket.id);
    }, 30000);
  });

  // Người B đồng ý
  socket.on("friend-accept", () => {
    const partnerId = rooms.get(socket.id);
    if (!partnerId) return;

    const request = friendRequests.get(partnerId);
    const isValid = request && request.targetId === socket.id && Date.now() - request.time <= 30000;

    if (isValid) {
      const roomCode = generateRoomCode();
      privateRooms.set(roomCode, { user1: socket.id, user2: partnerId });

      // Gửi URL phòng riêng
      io.to(socket.id).emit("friend-confirmed", { 
        url: `/private_room/${roomCode}`,
        partnerName: io.sockets.sockets.get(partnerId)?.name || "Ẩn danh",
        partnerGender: io.sockets.sockets.get(partnerId)?.gender || "Không rõ"
      });

      io.to(partnerId).emit("friend-confirmed", { 
        url: `/private_room/${roomCode}`,
        partnerName: io.sockets.sockets.get(socket.id)?.name || "Ẩn danh",
        partnerGender: io.sockets.sockets.get(socket.id)?.gender || "Không rõ"
      });


      console.log(`💙 Friend room created: ${roomCode}`);
    }
  });

  socket.on("join-private-room", ({ roomCode, userId }) => {
    const room = privateRooms.get(roomCode);
    if (!room) {
      socket.emit("error", "Phòng không tồn tại hoặc đã hết hiệu lực.");
      return;
    }

    // Gán userId cho socket
    socket.userId = userId;

    // Nếu room chưa có sockets → khởi tạo
    if (!room.sockets) room.sockets = new Map();

    // Nếu đã có 2 người → từ chối
    if (room.sockets.size >= 2 && !room.sockets.has(userId)) {
      socket.emit("error", "Phòng đã đủ 2 người.");
      return;
    }

    room.sockets.set(userId, socket.id);
    socket.join(roomCode);

    // Nếu đủ 2 người → ghép lại
    if (room.sockets.size === 2) {
      const [idA, idB] = [...room.sockets.values()];
      rooms.set(idA, idB);
      rooms.set(idB, idA);

      io.to(idA).emit("matched", {
        partnerName: "Người lạ",
        partnerGender: "Không rõ"
      });

      io.to(idB).emit("matched", {
        partnerName: "Người lạ",
        partnerGender: "Không rõ"
      });

      console.log(`🔗 Phòng riêng ${roomCode} đã nối lại thành công.`);
    }
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

// Route phòng kết bạn riêng
app.get("/private_room/:roomCode", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "private_room.html"));
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

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}
