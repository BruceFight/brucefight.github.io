// ========== 配置 ==========
const BACKEND_URL = window.WORLD_EYE_BACKEND || 'https://world-eye.onrender.com';
const CACHE_KEY = 'world-eye-profile';

const socket = io(BACKEND_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  timeout: 10000
});

// ========== WGS-84 → GCJ-02 坐标转换（修正高德地图偏移） ==========
const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function outOfChina(lat, lng) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320.0 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

function wgs84ToGcj02(wgsLat, wgsLng) {
  if (outOfChina(wgsLat, wgsLng)) return { lat: wgsLat, lng: wgsLng };
  let dLat = transformLat(wgsLng - 105.0, wgsLat - 35.0);
  let dLng = transformLng(wgsLng - 105.0, wgsLat - 35.0);
  const radLat = wgsLat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
  return { lat: wgsLat + dLat, lng: wgsLng + dLng };
}

// ========== 状态 ==========
let map;
let myMarker;
let myLatLng = null;
let hasJoined = false;
let selectedType = 'individual';
let memberMarkers = {};
let myMemberId = null;
let myJoinData = null;
let showOnlyOnline = false;
let lastMembersList = [];
let isStealth = false;
let watchId = null;

// ========== 本地缓存 ==========
function saveProfile(profile) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
  } catch (e) { /* ignore */ }
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// ========== 紧急联系数据 ==========
const embassyData = {
  default: { name: '中华人民共和国驻外大使馆', address: '请根据所在国家查询具体地址', phone: '+86-10-12308' },
  CN: { name: '中国外交部领事保护热线', address: '北京市朝阳区朝阳门南大街2号', phone: '+86-10-12308' },
  US: { name: '中国驻美国大使馆', address: '3505 International Place, NW Washington, D.C. 20008', phone: '+1-202-4952266' },
  GB: { name: '中国驻英国大使馆', address: '49-51 Portland Place, London W1B 1JL', phone: '+44-20-72994049' },
  JP: { name: '中国驻日本大使馆', address: '东京都港区元麻布3-4-33', phone: '+81-3-34033388' },
  KR: { name: '中国驻韩国大使馆', address: '首尔特别市中区明洞2街27号', phone: '+82-2-7381038' },
  AU: { name: '中国驻澳大利亚大使馆', address: '15 Coronation Drive, Yarralumla, ACT 2600', phone: '+61-2-62734780' },
  DE: { name: '中国驻德国大使馆', address: 'Märkisches Ufer 54, 10179 Berlin', phone: '+49-30-27588555' },
  FR: { name: '中国驻法国大使馆', address: '11 Avenue George V, 75008 Paris', phone: '+33-1-49521950' },
  CA: { name: '中国驻加拿大大使馆', address: '515 St. Patrick Street, Ottawa, ON K1N 5H3', phone: '+1-613-7893434' },
  SG: { name: '中国驻新加坡大使馆', address: '150 Tanglin Road, Singapore 247969', phone: '+65-64712117' },
  TH: { name: '中国驻泰国大使馆', address: '57 Ratchadaphisek Road, Bangkok 10310', phone: '+66-2-2450088' },
  MY: { name: '中国驻马来西亚大使馆', address: '229 Jalan Ampang, 50450 Kuala Lumpur', phone: '+60-3-21428495' }
};

const policeData = {
  default: { name: '当地警察局', address: '请拨打当地紧急号码', phone: '112' },
  CN: { name: '中国公安局', address: '请拨打110报警', phone: '110' },
  US: { name: '美国警察局', address: '拨打911紧急求助', phone: '911' },
  GB: { name: '英国警察局', address: '拨打999紧急求助', phone: '999' },
  JP: { name: '日本警察局', address: '拨打110报警', phone: '110' },
  KR: { name: '韩国警察局', address: '拨打112报警', phone: '112' },
  AU: { name: '澳大利亚警察局', address: '拨打000紧急求助', phone: '000' },
  DE: { name: '德国警察局', address: '拨打110报警', phone: '110' },
  FR: { name: '法国警察局', address: '拨打17报警', phone: '17' },
  CA: { name: '加拿大警察局', address: '拨打911紧急求助', phone: '911' },
  SG: { name: '新加坡警察局', address: '拨打999报警', phone: '999' },
  TH: { name: '泰国警察局', address: '拨打191报警', phone: '191' },
  MY: { name: '马来西亚警察局', address: '拨打999报警', phone: '999' }
};

// ========== 地图 ==========
let isInChina = true;
let gaodeTileLayer, osmTileLayer;

function initMap() {
  map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView([30, 110], 3);

  gaodeTileLayer = L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
    maxZoom: 18,
    subdomains: ['1', '2', '3', '4']
  });

  osmTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    subdomains: ['a', 'b', 'c'],
    attribution: '&copy; OpenStreetMap'
  });

  gaodeTileLayer.addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        myLatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        switchTileLayer(myLatLng.lat, myLatLng.lng);
        const display = toDisplayCoord(myLatLng.lat, myLatLng.lng);
        map.setView([display.lat, display.lng], 13);
        addSelfMarker(display.lat, display.lng);
        updateEmergencyInfo(myLatLng.lat, myLatLng.lng);
      },
      () => {
        myLatLng = { lat: 39.9042, lng: 116.4074 };
        switchTileLayer(myLatLng.lat, myLatLng.lng);
        const display = toDisplayCoord(myLatLng.lat, myLatLng.lng);
        map.setView([display.lat, display.lng], 10);
        addSelfMarker(display.lat, display.lng);
        updateEmergencyInfo(myLatLng.lat, myLatLng.lng);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }
}

function switchTileLayer(lat, lng) {
  const inChina = !outOfChina(lat, lng);
  if (inChina === isInChina && map.hasLayer(gaodeTileLayer || osmTileLayer)) return;
  isInChina = inChina;
  if (isInChina) {
    if (map.hasLayer(osmTileLayer)) map.removeLayer(osmTileLayer);
    if (!map.hasLayer(gaodeTileLayer)) gaodeTileLayer.addTo(map);
  } else {
    if (map.hasLayer(gaodeTileLayer)) map.removeLayer(gaodeTileLayer);
    if (!map.hasLayer(osmTileLayer)) osmTileLayer.addTo(map);
  }
}

function toDisplayCoord(lat, lng) {
  return isInChina ? wgs84ToGcj02(lat, lng) : { lat, lng };
}

function addSelfMarker(lat, lng) {
  const icon = L.divIcon({
    className: 'member-marker',
    html: `
      <div class="marker-label">📍 我的位置</div>
      <div class="marker-dot self"></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  if (myMarker) {
    myMarker.setLatLng([lat, lng]);
  } else {
    myMarker = L.marker([lat, lng], { icon }).addTo(map);
  }
}

function renderMemberMarker(member) {
  if (member.memberId === myMemberId) return;
  if (showOnlyOnline && !member.isOnline) {
    removeMemberMarker(member.memberId);
    return;
  }

  const display = toDisplayCoord(member.lat, member.lng);
  const isOnline = member.isOnline;
  const typeClass = member.type === 'team' ? 'team' : 'individual';
  const statusClass = isOnline ? '' : ' offline';
  const label = member.type === 'team'
    ? `${member.name} (${member.memberCount}人)`
    : member.name;
  const statusIcon = isOnline ? '' : ' 💤';

  const icon = L.divIcon({
    className: 'member-marker',
    html: `
      <div class="marker-label ${typeClass}${statusClass}">${label}${statusIcon}</div>
      <div class="marker-dot ${typeClass}${statusClass}"></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  if (memberMarkers[member.memberId]) {
    memberMarkers[member.memberId].setLatLng([display.lat, display.lng]);
    memberMarkers[member.memberId].setIcon(icon);
  } else {
    const marker = L.marker([display.lat, display.lng], { icon }).addTo(map);
    const statusText = isOnline ? '🟢 在线' : '⚪ 离线';
    const navUrl = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? `maps://maps.apple.com/?daddr=${member.lat},${member.lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${member.lat},${member.lng}`;
    const popupContent = `
      <div style="min-width:160px">
        <strong>${member.name}</strong> <small>${statusText}</small><br/>
        <span style="color:#666">${member.type === 'team' ? '团队' : '个人'}${member.memberCount ? ' · ' + member.memberCount + '人' : ''}</span><br/>
        <a href="tel:${member.contact}" style="color:#2563eb;text-decoration:none">📞 ${member.contact}</a><br/>
        <a href="${navUrl}" target="_blank" rel="noopener"
           style="display:inline-block;margin-top:6px;padding:5px 12px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border-radius:16px;text-decoration:none;font-size:13px;font-weight:500">
          🧭 导航前往
        </a>
      </div>
    `;
    marker.bindPopup(popupContent);
    memberMarkers[member.memberId] = marker;
  }
}

function removeMemberMarker(memberId) {
  if (memberMarkers[memberId]) {
    map.removeLayer(memberMarkers[memberId]);
    delete memberMarkers[memberId];
  }
}

function updateOnlineCount(members) {
  if (members) {
    lastMembersList = members;
    const onlineCount = members.filter(m => m.isOnline).length;
    const totalCount = members.length;
    const label = showOnlyOnline ? `${onlineCount} 在线` : `${onlineCount} 在线 / ${totalCount} 成员`;
    document.getElementById('count-text').textContent = label;
  }
}

function applyViewFilter() {
  if (!lastMembersList.length) return;
  lastMembersList.forEach(member => {
    if (member.memberId === myMemberId) return;
    if (showOnlyOnline && !member.isOnline) {
      removeMemberMarker(member.memberId);
    } else {
      renderMemberMarker(member);
    }
  });
  updateOnlineCount(lastMembersList);
}

// ========== 紧急信息 ==========
async function getCountryCode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=zh`
    );
    const data = await res.json();
    return data.address?.country_code?.toUpperCase() || 'default';
  } catch {
    return 'default';
  }
}

async function updateEmergencyInfo(lat, lng) {
  const code = await getCountryCode(lat, lng);

  const embassy = embassyData[code] || embassyData.default;
  document.getElementById('embassy-name').textContent = embassy.name;
  document.getElementById('embassy-address').textContent = embassy.address;
  document.getElementById('embassy-address').onclick = () => openNavigation(embassy.address);
  const embassyPhoneEl = document.getElementById('embassy-phone');
  embassyPhoneEl.href = `tel:${embassy.phone}`;
  embassyPhoneEl.textContent = embassy.phone;

  const police = policeData[code] || policeData.default;
  document.getElementById('police-name').textContent = police.name;
  document.getElementById('police-address').textContent = police.address;
  document.getElementById('police-address').onclick = () => openNavigation(police.address);
  const policePhoneEl = document.getElementById('police-phone');
  policePhoneEl.href = `tel:${police.phone}`;
  policePhoneEl.textContent = police.phone;
}

function openNavigation(address) {
  const encoded = encodeURIComponent(address);
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isIOS) {
    window.open(`maps://maps.apple.com/?daddr=${encoded}`, '_blank');
  } else {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
  }
}

// ========== UI 交互 ==========
document.getElementById('toggle-view-btn').addEventListener('click', () => {
  showOnlyOnline = !showOnlyOnline;
  const btn = document.getElementById('toggle-view-btn');
  btn.classList.toggle('show-all', !showOnlyOnline);
  btn.title = showOnlyOnline ? '当前：仅显示在线' : '当前：显示全部';
  applyViewFilter();
});

document.getElementById('stealth-btn').addEventListener('click', () => {
  isStealth = !isStealth;
  const btn = document.getElementById('stealth-btn');
  const icon = document.getElementById('stealth-icon');

  if (isStealth) {
    btn.classList.add('stealthed');
    icon.textContent = '🙈';
    btn.title = '隐身中 - 点击恢复显示';
    if (myMarker) {
      map.removeLayer(myMarker);
      myMarker = null;
    }
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    socket.emit('toggle-stealth', { stealth: true });
  } else {
    btn.classList.remove('stealthed');
    icon.textContent = '👁️';
    btn.title = '点击隐身';
    if (myLatLng) {
      const display = toDisplayCoord(myLatLng.lat, myLatLng.lng);
      const cached = loadProfile();
      const typeClass = (cached?.type === 'team') ? 'team' : 'individual';
      const label = (cached?.type === 'team') ? `${cached.name} (${cached.memberCount}人)` : (cached?.name || '我');
      const markerIcon = L.divIcon({
        className: 'member-marker',
        html: `<div class="marker-label ${typeClass}">${label}</div><div class="marker-dot self"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      myMarker = L.marker([display.lat, display.lng], { icon: markerIcon }).addTo(map);
    }
    socket.emit('toggle-stealth', { stealth: false });
    startLocationWatch();
  }
});

document.getElementById('emergency-toggle').addEventListener('click', () => {
  document.getElementById('emergency-content').classList.toggle('show');
});

document.getElementById('join-world-btn').addEventListener('click', () => {
  if (hasJoined) return;
  document.getElementById('join-modal').classList.remove('hidden');
});

document.getElementById('cancel-btn').addEventListener('click', () => {
  document.getElementById('join-modal').classList.add('hidden');
});

document.querySelector('.modal-overlay').addEventListener('click', () => {
  document.getElementById('join-modal').classList.add('hidden');
});

document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedType = btn.dataset.type;
    const teamGroup = document.getElementById('team-count-group');
    if (selectedType === 'team') {
      teamGroup.classList.remove('hidden');
      document.getElementById('input-count').required = true;
    } else {
      teamGroup.classList.add('hidden');
      document.getElementById('input-count').required = false;
    }
  });
});

function doJoin(profile) {
  myJoinData = {
    memberId: profile.memberId || null,
    name: profile.name,
    type: profile.type,
    contact: profile.contact,
    memberCount: profile.memberCount,
    lat: myLatLng ? myLatLng.lat : 39.9042,
    lng: myLatLng ? myLatLng.lng : 116.4074
  };

  socket.emit('join-world', myJoinData);

  hasJoined = true;
  document.getElementById('join-modal').classList.add('hidden');

  const joinBtn = document.getElementById('join-world-btn');
  joinBtn.classList.add('joined');
  joinBtn.innerHTML = '<span class="btn-icon">✅</span><span>已加入世界</span>';

  if (myMarker) map.removeLayer(myMarker);
  const typeClass = profile.type === 'team' ? 'team' : 'individual';
  const label = profile.type === 'team' ? `${profile.name} (${profile.memberCount}人)` : profile.name;
  const icon = L.divIcon({
    className: 'member-marker',
    html: `
      <div class="marker-label ${typeClass}">${label}</div>
      <div class="marker-dot self"></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
  const selfDisplay = toDisplayCoord(
    myLatLng ? myLatLng.lat : 39.9042,
    myLatLng ? myLatLng.lng : 116.4074
  );
  myMarker = L.marker([selfDisplay.lat, selfDisplay.lng], { icon }).addTo(map);

  startLocationWatch();

  document.getElementById('stealth-btn').classList.remove('hidden');
}

document.getElementById('join-form').addEventListener('submit', (e) => {
  e.preventDefault();

  const name = document.getElementById('input-name').value.trim();
  const contact = document.getElementById('input-contact').value.trim();
  const memberCount = document.getElementById('input-count').value;

  if (!name || !contact) return;
  if (selectedType === 'team' && (!memberCount || memberCount < 2)) {
    alert('团队人数至少为2人');
    return;
  }
  if (!myLatLng) {
    alert('正在获取位置信息，请稍后再试');
    return;
  }

  const profile = {
    memberId: myMemberId,
    name,
    type: selectedType,
    contact,
    memberCount: selectedType === 'team' ? parseInt(memberCount) : null
  };

  saveProfile(profile);
  doJoin(profile);
});

// ========== Socket 事件 ==========
socket.on('connect', () => {
  console.log('[观界天眼] 已连接, socketId:', socket.id);
  const cached = loadProfile();
  console.log('[观界天眼] 缓存档案:', cached);
  if (cached && cached.memberId && cached.name) {
    console.log('[观界天眼] 自动重连加入:', cached.name);
    myMemberId = cached.memberId;
    doJoin(cached);
  }
});

socket.on('connect_error', (err) => {
  console.warn('[观界天眼] 连接失败:', err.message);
});

socket.on('disconnect', (reason) => {
  console.warn('[观界天眼] 连接断开:', reason);
});

socket.on('join-confirmed', (data) => {
  console.log('[观界天眼] 加入确认, memberId:', data.memberId);
  myMemberId = data.memberId;
  const profile = loadProfile() || {};
  profile.memberId = data.memberId;
  if (!profile.name && myJoinData) {
    Object.assign(profile, myJoinData);
  }
  saveProfile(profile);
  console.log('[观界天眼] 已保存档案:', profile);
});

socket.on('sync-members', (members) => {
  const currentIds = new Set(members.map(m => m.memberId));

  Object.keys(memberMarkers).forEach(id => {
    if (!currentIds.has(id)) removeMemberMarker(id);
  });

  members.forEach(member => renderMemberMarker(member));
  updateOnlineCount(members);
});

socket.on('member-moved', (data) => {
  if (memberMarkers[data.memberId]) {
    const display = toDisplayCoord(data.lat, data.lng);
    memberMarkers[data.memberId].setLatLng([display.lat, display.lng]);
  }
});

// ========== 位置追踪 ==========
function startLocationWatch() {
  if (watchId !== null) return;
  if (!navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      myLatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      switchTileLayer(myLatLng.lat, myLatLng.lng);
      if (!isStealth) {
        const display = toDisplayCoord(myLatLng.lat, myLatLng.lng);
        if (myMarker) myMarker.setLatLng([display.lat, display.lng]);
        socket.emit('update-location', myLatLng);
      }
    },
    null,
    { enableHighAccuracy: true, maximumAge: 0 }
  );
}

// ========== 初始化 ==========
initMap();
