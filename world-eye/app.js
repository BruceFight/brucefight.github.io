// ========== 后端服务地址配置 ==========
// 本地开发: 'http://localhost:3000'
// 生产环境: 填入部署后的后端地址，如 'https://world-eye-xxxx.onrender.com'
const BACKEND_URL = window.WORLD_EYE_BACKEND || 'https://world-eye.onrender.com';

const socket = BACKEND_URL ? io(BACKEND_URL) : io();

let map;
let myMarker;
let myLatLng = null;
let hasJoined = false;
let selectedType = 'individual';
let memberMarkers = {};

const embassyData = {
  default: {
    name: '中华人民共和国驻外大使馆',
    address: '请根据所在国家查询具体地址',
    phone: '+86-10-12308'
  },
  CN: {
    name: '中国外交部领事保护热线',
    address: '北京市朝阳区朝阳门南大街2号',
    phone: '+86-10-12308'
  },
  US: {
    name: '中国驻美国大使馆',
    address: '3505 International Place, NW Washington, D.C. 20008',
    phone: '+1-202-4952266'
  },
  GB: {
    name: '中国驻英国大使馆',
    address: '49-51 Portland Place, London W1B 1JL',
    phone: '+44-20-72994049'
  },
  JP: {
    name: '中国驻日本大使馆',
    address: '东京都港区元麻布3-4-33',
    phone: '+81-3-34033388'
  },
  KR: {
    name: '中国驻韩国大使馆',
    address: '首尔特别市中区明洞2街27号',
    phone: '+82-2-7381038'
  },
  AU: {
    name: '中国驻澳大利亚大使馆',
    address: '15 Coronation Drive, Yarralumla, ACT 2600',
    phone: '+61-2-62734780'
  },
  DE: {
    name: '中国驻德国大使馆',
    address: 'Märkisches Ufer 54, 10179 Berlin',
    phone: '+49-30-27588555'
  },
  FR: {
    name: '中国驻法国大使馆',
    address: '11 Avenue George V, 75008 Paris',
    phone: '+33-1-49521950'
  },
  CA: {
    name: '中国驻加拿大大使馆',
    address: '515 St. Patrick Street, Ottawa, ON K1N 5H3',
    phone: '+1-613-7893434'
  },
  SG: {
    name: '中国驻新加坡大使馆',
    address: '150 Tanglin Road, Singapore 247969',
    phone: '+65-64712117'
  },
  TH: {
    name: '中国驻泰国大使馆',
    address: '57 Ratchadaphisek Road, Bangkok 10310',
    phone: '+66-2-2450088'
  },
  MY: {
    name: '中国驻马来西亚大使馆',
    address: '229 Jalan Ampang, 50450 Kuala Lumpur',
    phone: '+60-3-21428495'
  }
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

function initMap() {
  map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView([30, 110], 3);

  L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
    maxZoom: 18,
    subdomains: ['1', '2', '3', '4']
  }).addTo(map);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        myLatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        map.setView([myLatLng.lat, myLatLng.lng], 13);
        addSelfMarker(myLatLng.lat, myLatLng.lng);
        updateEmergencyInfo(myLatLng.lat, myLatLng.lng);
      },
      (err) => {
        console.warn('无法获取位置:', err.message);
        myLatLng = { lat: 39.9042, lng: 116.4074 };
        map.setView([myLatLng.lat, myLatLng.lng], 10);
        addSelfMarker(myLatLng.lat, myLatLng.lng);
        updateEmergencyInfo(myLatLng.lat, myLatLng.lng);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
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

function addMemberMarker(member) {
  if (member.id === socket.id) return;

  const typeClass = member.type === 'team' ? 'team' : 'individual';
  const label = member.type === 'team'
    ? `${member.name} (${member.memberCount}人)`
    : member.name;

  const icon = L.divIcon({
    className: 'member-marker',
    html: `
      <div class="marker-label ${typeClass}">${label}</div>
      <div class="marker-dot ${typeClass}"></div>
    `,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  const marker = L.marker([member.lat, member.lng], { icon }).addTo(map);

  const popupContent = `
    <div style="min-width:150px">
      <strong>${member.name}</strong><br/>
      <span style="color:#666">${member.type === 'team' ? '团队' : '个人'}${member.memberCount ? ' · ' + member.memberCount + '人' : ''}</span><br/>
      <a href="tel:${member.contact}" style="color:#2563eb">📞 ${member.contact}</a>
    </div>
  `;
  marker.bindPopup(popupContent);

  memberMarkers[member.id] = marker;
}

function removeMemberMarker(id) {
  if (memberMarkers[id]) {
    map.removeLayer(memberMarkers[id]);
    delete memberMarkers[id];
  }
}

function updateOnlineCount() {
  const count = Object.keys(memberMarkers).length + (hasJoined ? 1 : 0);
  document.getElementById('count-text').textContent = `${count} 人在线`;
}

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
  document.getElementById('embassy-address').onclick = () => {
    openNavigation(embassy.address);
  };
  const embassyPhoneEl = document.getElementById('embassy-phone');
  embassyPhoneEl.href = `tel:${embassy.phone}`;
  embassyPhoneEl.textContent = embassy.phone;

  const police = policeData[code] || policeData.default;
  document.getElementById('police-name').textContent = police.name;
  document.getElementById('police-address').textContent = police.address;
  document.getElementById('police-address').onclick = () => {
    openNavigation(police.address);
  };
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

// UI 交互
document.getElementById('emergency-toggle').addEventListener('click', () => {
  const content = document.getElementById('emergency-content');
  content.classList.toggle('show');
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

  socket.emit('join-world', {
    name,
    type: selectedType,
    contact,
    memberCount: selectedType === 'team' ? parseInt(memberCount) : null,
    lat: myLatLng.lat,
    lng: myLatLng.lng
  });

  hasJoined = true;
  document.getElementById('join-modal').classList.add('hidden');

  const joinBtn = document.getElementById('join-world-btn');
  joinBtn.classList.add('joined');
  joinBtn.innerHTML = '<span class="btn-icon">✅</span><span>已加入世界</span>';

  if (myMarker) {
    map.removeLayer(myMarker);
  }
  const typeClass = selectedType === 'team' ? 'team' : 'individual';
  const label = selectedType === 'team' ? `${name} (${memberCount}人)` : name;
  const icon = L.divIcon({
    className: 'member-marker',
    html: `
      <div class="marker-label ${typeClass}">${label}</div>
      <div class="marker-dot self"></div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
  myMarker = L.marker([myLatLng.lat, myLatLng.lng], { icon }).addTo(map);

  updateOnlineCount();

  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      (pos) => {
        myLatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (myMarker) myMarker.setLatLng([myLatLng.lat, myLatLng.lng]);
        socket.emit('update-location', myLatLng);
      },
      null,
      { enableHighAccuracy: true }
    );
  }
});

// Socket 连接状态
socket.on('connect', () => {
  console.log('已连接到观界天眼服务');
  const status = document.getElementById('connection-status');
  if (status) status.classList.add('hidden');
});

socket.on('connect_error', (err) => {
  console.warn('连接失败:', err.message);
});

socket.on('disconnect', (reason) => {
  console.warn('连接断开:', reason);
});

// Socket 数据事件
socket.on('sync-members', (members) => {
  members.forEach(member => {
    addMemberMarker(member);
  });
  updateOnlineCount();
});

socket.on('member-joined', (member) => {
  addMemberMarker(member);
  updateOnlineCount();
});

socket.on('member-moved', (data) => {
  if (memberMarkers[data.id]) {
    memberMarkers[data.id].setLatLng([data.lat, data.lng]);
  }
});

socket.on('member-left', (id) => {
  removeMemberMarker(id);
  updateOnlineCount();
});

// 初始化
initMap();
