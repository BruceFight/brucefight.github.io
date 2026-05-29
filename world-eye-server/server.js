const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

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

// ==================== 持久化存储 ====================

const DATA_FILE = path.join(__dirname, 'members.json');
const INACTIVE_DAYS = 90;

const members = new Map();
const onlineSockets = new Map();

function loadMembers() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const data = JSON.parse(raw);
      const cutoff = Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000;
      for (const [id, member] of Object.entries(data)) {
        if (member.lastActiveAt > cutoff) {
          members.set(id, member);
        }
      }
      console.log(`已加载 ${members.size} 个成员`);
    }
  } catch (err) {
    console.error('加载成员数据失败:', err.message);
  }
}

let saveTimer = null;
function saveMembers() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const obj = Object.fromEntries(members);
      fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('保存成员数据失败:', err.message);
    }
  }, 1000);
}

loadMembers();

// ==================== API ====================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    totalMembers: members.size,
    onlineMembers: onlineSockets.size,
    uptime: process.uptime()
  });
});

app.get('/api/members', (req, res) => {
  res.json(getMembersWithStatus());
});

// ==================== 工具函数 ====================

function generateId() {
  return crypto.randomUUID();
}

function getMembersWithStatus() {
  const result = [];
  for (const [memberId, member] of members) {
    if (member.stealth) continue;
    result.push({
      ...member,
      isOnline: onlineSockets.has(memberId)
    });
  }
  return result;
}

function broadcastMemberList() {
  io.emit('sync-members', getMembersWithStatus());
}

// ==================== Socket.IO ====================

io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] Socket 连接: ${socket.id}`);

  socket.emit('sync-members', getMembersWithStatus());

  socket.on('join-world', (data) => {
    const memberId = data.memberId || generateId();
    const existing = members.get(memberId);

    const member = {
      memberId,
      name: data.name,
      type: data.type,
      contact: data.contact,
      memberCount: data.memberCount || null,
      lat: data.lat,
      lng: data.lng,
      createdAt: existing ? existing.createdAt : Date.now(),
      lastActiveAt: Date.now()
    };

    members.set(memberId, member);
    onlineSockets.set(memberId, socket.id);
    socket.memberId = memberId;

    saveMembers();

    socket.emit('join-confirmed', {
      memberId,
      totalMembers: members.size,
      onlineMembers: onlineSockets.size
    });

    broadcastMemberList();

    console.log(`[${new Date().toISOString()}] ${member.name} ${existing ? '重新' : ''}加入世界 (${member.type}), 总成员: ${members.size}, 在线: ${onlineSockets.size}`);
  });

  socket.on('update-location', (data) => {
    const memberId = socket.memberId;
    if (!memberId) return;
    const member = members.get(memberId);
    if (member) {
      member.lat = data.lat;
      member.lng = data.lng;
      member.lastActiveAt = Date.now();
      members.set(memberId, member);
      saveMembers();
      socket.broadcast.emit('member-moved', {
        memberId,
        lat: data.lat,
        lng: data.lng
      });
    }
  });

  socket.on('toggle-stealth', (data) => {
    const memberId = socket.memberId;
    if (!memberId) return;
    const member = members.get(memberId);
    if (member) {
      member.stealth = !!data.stealth;
      members.set(memberId, member);
      saveMembers();
      broadcastMemberList();
      console.log(`[${new Date().toISOString()}] ${member.name} ${member.stealth ? '开启隐身' : '关闭隐身'}`);
    }
  });

  socket.on('request-sync', () => {
    socket.emit('sync-members', getMembersWithStatus());
  });

  socket.on('disconnect', () => {
    const memberId = socket.memberId;
    if (memberId) {
      const member = members.get(memberId);
      console.log(`[${new Date().toISOString()}] 用户离线: ${member?.name || memberId}`);
      if (member) {
        member.lastActiveAt = Date.now();
        saveMembers();
      }
      onlineSockets.delete(memberId);
      broadcastMemberList();
    }
  });
});

// ==================== 启动 ====================

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`观界天眼服务已启动: http://${HOST}:${PORT}`);
  console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`已注册成员: ${members.size}`);
});
