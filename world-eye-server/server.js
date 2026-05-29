const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 5000
});

const frontendPath = path.join(__dirname, '..', 'world-eye');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    members: members.size,
    connections: io.engine.clientsCount,
    uptime: process.uptime()
  });
});

const members = new Map();

io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] 用户连接: ${socket.id} (当前连接数: ${io.engine.clientsCount})`);

  socket.emit('sync-members', Array.from(members.values()));

  socket.on('join-world', (data) => {
    const member = {
      id: socket.id,
      name: data.name,
      type: data.type,
      contact: data.contact,
      memberCount: data.memberCount || null,
      lat: data.lat,
      lng: data.lng,
      joinedAt: Date.now()
    };
    members.set(socket.id, member);
    socket.broadcast.emit('member-joined', member);
    socket.emit('join-confirmed', { id: socket.id, totalMembers: members.size });
    console.log(`[${new Date().toISOString()}] ${member.name} 加入世界 (${member.type}), 当前成员: ${members.size}`);
  });

  socket.on('request-sync', () => {
    socket.emit('sync-members', Array.from(members.values()));
  });

  socket.on('update-location', (data) => {
    const member = members.get(socket.id);
    if (member) {
      member.lat = data.lat;
      member.lng = data.lng;
      members.set(socket.id, member);
      socket.broadcast.emit('member-moved', { id: socket.id, lat: data.lat, lng: data.lng });
    }
  });

  socket.on('disconnect', () => {
    const member = members.get(socket.id);
    console.log(`[${new Date().toISOString()}] 用户断开: ${member?.name || socket.id}`);
    members.delete(socket.id);
    io.emit('member-left', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`观界天眼服务已启动: http://${HOST}:${PORT}`);
  console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
});
