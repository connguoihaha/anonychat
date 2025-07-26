# AnonyChat - Ứng dụng Chat Ẩn danh

Ứng dụng chat ẩn danh real-time được xây dựng với Node.js, Express và Socket.IO.

## ✨ Tính năng

- 💬 **Chat ẩn danh real-time**: Kết nối ngẫu nhiên với người lạ
- 🔄 **Ghép đôi tự động**: Hệ thống matching thông minh
- 🛡️ **Lọc từ ngữ không phù hợp**: Bảo vệ người dùng
- 📊 **Thống kê chi tiết**: Monitoring hệ thống
- 🚀 **Performance tối ưu**: Xử lý nhanh và ổn định
- 🔧 **Error handling**: Xử lý lỗi gracefully

## 🚀 Cài đặt

```bash
# Clone repository
git clone <repository-url>
cd anonychat

# Cài đặt dependencies
npm install

# Chạy server
npm start

# Hoặc chạy với nodemon (development)
npm run dev
```

## 📁 Cấu trúc dự án

```
anonychat/
├── server.js          # Server chính
├── utils.js           # Utilities và helper functions
├── profanity-list.js  # Danh sách từ ngữ không phù hợp
├── package.json       # Dependencies và scripts
├── public/            # Static files
│   ├── index.html     # Frontend
│   ├── style.css      # Styles
│   ├── script.js      # Client-side logic
│   └── send.mp3       # Sound effects
└── README.md          # Documentation
```

## 🔧 API Endpoints

### WebSocket Events

- `start-matching`: Bắt đầu tìm kiếm người chat
- `message`: Gửi tin nhắn
- `typing`: Thông báo đang gõ
- `stop-typing`: Thông báo dừng gõ
- `matched`: Nhận thông tin người được ghép đôi
- `partner-disconnected`: Thông báo người chat rời đi

### HTTP Endpoints

- `GET /`: Trang chủ
- `GET /stats`: Thống kê hệ thống
- `GET /health`: Health check

## 🛠️ Tối ưu hóa đã thực hiện

### 1. **Cấu trúc code**
- Tách logic thành các module riêng biệt
- Sử dụng classes và utilities
- Error handling toàn diện

### 2. **Performance**
- Cache regex patterns cho profanity filter
- Tối ưu hóa memory usage
- Graceful shutdown

### 3. **Monitoring & Logging**
- Structured logging với timestamps
- Detailed statistics endpoint
- Health check endpoint

### 4. **Security & Validation**
- Input validation cho user info
- Profanity filtering được tối ưu
- Error boundaries

### 5. **Maintainability**
- Clean code structure
- Modular design
- Comprehensive documentation

## 📊 Thống kê hệ thống

Truy cập `/stats` để xem:
- Số người dùng đang kết nối
- Kích thước hàng chờ
- Số phòng chat đang hoạt động
- Memory usage
- Uptime

## 🔍 Health Check

Truy cập `/health` để kiểm tra trạng thái server:
- Server status
- Uptime
- Version info

## 🚀 Deployment

```bash
# Production
npm start

# Development với auto-reload
npm run dev
```

## 📝 Environment Variables

- `PORT`: Port server (default: 3000)

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Tạo Pull Request

## 📄 License

MIT License - xem file LICENSE để biết thêm chi tiết.

## 🆘 Support

Nếu gặp vấn đề, vui lòng tạo issue trên GitHub repository.
