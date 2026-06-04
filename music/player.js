// ========== 本地歌曲库 ==========
const localSongs = [
  {
    title: 'XLOWLY (SLOWED)',
    artist: '热歌播放器 & 幻音坊',
    url: '/assets/audio/%E7%83%AD%E6%AD%8C%E6%92%AD%E6%94%BE%E5%99%A8%26%E5%B9%BB%E9%9F%B3%E5%9D%8A-XLOWLY%20(SLOWED).mp3',
    source: '本地'
  },
  {
    title: 'AI爱',
    artist: '王力宏',
    url: '/assets/audio/%E7%8E%8B%E5%8A%9B%E5%AE%8F%E3%80%8AAI%E7%88%B1%E3%80%8B.mp3',
    source: '本地'
  },
  {
    title: '逆天千回',
    artist: '未知',
    url: '/assets/audio/%E9%80%86%E5%A4%A9%E5%8D%83%E5%9B%9E.mp3',
    source: '本地'
  }
];

// ========== 状态 ==========
const audio = document.getElementById('audio-player');
let playlist = [...localSongs];
let currentIndex = -1;
let isPlaying = false;
let playMode = 'loop'; // loop, single, shuffle

// ========== 渲染本地列表 ==========
function renderLocalList() {
  const container = document.getElementById('local-list');
  if (localSongs.length === 0) {
    container.innerHTML = '<div class="empty-list">暂无本地歌曲</div>';
    return;
  }
  container.innerHTML = localSongs.map((song, i) => songItemHTML(song, i, 'local')).join('');
}

function songItemHTML(song, index, listType) {
  const coverHTML = song.cover
    ? `<img src="${song.cover}" alt="">`
    : `<i class="fas fa-music"></i>`;
  const durationHTML = song.duration
    ? `<span class="song-item-duration">${formatTime(song.duration)}</span>`
    : '';
  const sourceHTML = song.source
    ? `<span class="song-item-source">${song.source}</span>`
    : '';
  return `
    <div class="song-item" data-list="${listType}" data-index="${index}" onclick="playSong('${listType}', ${index})">
      <div class="song-item-cover">${coverHTML}</div>
      <div class="song-item-info">
        <div class="song-item-title">${escapeHTML(song.title)}</div>
        <div class="song-item-artist">${escapeHTML(song.artist || '未知')}</div>
      </div>
      ${durationHTML}
      ${sourceHTML}
    </div>
  `;
}

// ========== 播放控制 ==========
function playSong(listType, index) {
  const list = listType === 'local' ? localSongs : searchResults;
  if (index < 0 || index >= list.length) return;

  playlist = [...list];
  currentIndex = index;
  const song = playlist[currentIndex];

  audio.src = song.url;
  audio.play().catch(() => {});
  isPlaying = true;
  updatePlayButton();
  updateNowPlaying(song);
  updateActiveItem();
}

function togglePlay() {
  if (!audio.src) {
    if (playlist.length > 0) playSong(currentListType(), 0);
    return;
  }
  if (isPlaying) {
    audio.pause();
  } else {
    audio.play().catch(() => {});
  }
}

function playNext() {
  if (playlist.length === 0) return;
  if (playMode === 'shuffle') {
    currentIndex = Math.floor(Math.random() * playlist.length);
  } else {
    currentIndex = (currentIndex + 1) % playlist.length;
  }
  const song = playlist[currentIndex];
  audio.src = song.url;
  audio.play().catch(() => {});
  isPlaying = true;
  updatePlayButton();
  updateNowPlaying(song);
  updateActiveItem();
}

function playPrev() {
  if (playlist.length === 0) return;
  currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
  const song = playlist[currentIndex];
  audio.src = song.url;
  audio.play().catch(() => {});
  isPlaying = true;
  updatePlayButton();
  updateNowPlaying(song);
  updateActiveItem();
}

function currentListType() {
  const localTab = document.querySelector('[data-tab="local"]');
  return localTab.classList.contains('active') ? 'local' : 'search';
}

// ========== UI 更新 ==========
function updatePlayButton() {
  const icon = document.querySelector('#play-btn i');
  icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
}

function updateNowPlaying(song) {
  document.getElementById('current-title').textContent = song.title;
  document.getElementById('current-artist').textContent = song.artist || '未知';
  const thumb = document.getElementById('song-thumb');
  if (song.cover) {
    thumb.innerHTML = `<img src="${song.cover}" alt="">`;
  } else {
    thumb.innerHTML = '<i class="fas fa-music"></i>';
  }
}

function updateActiveItem() {
  document.querySelectorAll('.song-item').forEach(el => el.classList.remove('playing'));
  const items = document.querySelectorAll('.song-item');
  items.forEach(el => {
    const list = el.dataset.list;
    const idx = parseInt(el.dataset.index);
    const songList = list === 'local' ? localSongs : searchResults;
    if (idx < songList.length && playlist[currentIndex] &&
        songList[idx].url === playlist[currentIndex].url) {
      el.classList.add('playing');
    }
  });
}

function updateProgress() {
  if (audio.duration) {
    const pct = (audio.currentTime / audio.duration) * 100;
    document.getElementById('progress-bar').style.width = pct + '%';
    document.getElementById('current-time').textContent = formatTime(audio.currentTime);
    document.getElementById('total-time').textContent = formatTime(audio.duration);
  }
}

// ========== 音频事件 ==========
audio.addEventListener('timeupdate', updateProgress);

audio.addEventListener('play', () => {
  isPlaying = true;
  updatePlayButton();
});

audio.addEventListener('pause', () => {
  isPlaying = false;
  updatePlayButton();
});

audio.addEventListener('ended', () => {
  if (playMode === 'single') {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } else {
    playNext();
  }
});

audio.addEventListener('error', () => {
  document.getElementById('current-title').textContent = '播放出错';
  isPlaying = false;
  updatePlayButton();
});

// ========== 进度条拖动 ==========
document.getElementById('progress-container').addEventListener('click', (e) => {
  if (!audio.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  audio.currentTime = pct * audio.duration;
});

// ========== 按钮事件 ==========
document.getElementById('play-btn').addEventListener('click', togglePlay);
document.getElementById('next-btn').addEventListener('click', playNext);
document.getElementById('prev-btn').addEventListener('click', playPrev);

document.getElementById('mode-btn').addEventListener('click', () => {
  const btn = document.getElementById('mode-btn');
  const icon = btn.querySelector('i');
  if (playMode === 'loop') {
    playMode = 'single';
    icon.className = 'fas fa-1';
    btn.classList.add('active');
    btn.title = '单曲循环';
  } else if (playMode === 'single') {
    playMode = 'shuffle';
    icon.className = 'fas fa-shuffle';
    btn.classList.add('active');
    btn.title = '随机播放';
  } else {
    playMode = 'loop';
    icon.className = 'fas fa-repeat';
    btn.classList.remove('active');
    btn.title = '列表循环';
  }
});

// ========== 标签页切换 ==========
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// ========== 在线搜索 ==========
let searchResults = [];
let searchAbort = null;

document.getElementById('search-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});
document.getElementById('search-btn').addEventListener('click', doSearch);

async function doSearch() {
  const query = document.getElementById('search-input').value.trim();
  if (!query) return;

  // 切换到搜索标签
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="search"]').classList.add('active');
  document.getElementById('tab-search').classList.add('active');

  const listEl = document.getElementById('search-list');
  const hintEl = document.getElementById('search-hint');
  hintEl.classList.add('hidden');
  listEl.innerHTML = '<div class="search-loading"><i class="fas fa-spinner"></i>搜索中...</div>';

  if (searchAbort) searchAbort.abort();
  searchAbort = new AbortController();

  try {
    // 使用多个搜索源
    const results = await searchFromMultipleSources(query, searchAbort.signal);
    searchResults = results;

    if (results.length === 0) {
      listEl.innerHTML = '<div class="empty-list">未找到相关歌曲</div>';
      return;
    }

    listEl.innerHTML = results.map((song, i) => songItemHTML(song, i, 'search')).join('');
  } catch (err) {
    if (err.name === 'AbortError') return;
    listEl.innerHTML = '<div class="empty-list">搜索失败，请稍后重试</div>';
  }
}

async function searchFromMultipleSources(query, signal) {
  const results = [];

  // iTunes Search API (免费、无需 key、支持 CORS)
  try {
    const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=20&country=CN`;
    const res = await fetch(itunesUrl, { signal });
    const data = await res.json();

    if (data.results) {
      data.results.forEach(item => {
        results.push({
          title: item.trackName || item.collectionName,
          artist: item.artistName,
          cover: item.artworkUrl100?.replace('100x100', '200x200'),
          url: item.previewUrl,
          duration: item.trackTimeMillis ? item.trackTimeMillis / 1000 : null,
          source: 'iTunes'
        });
      });
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.warn('iTunes search failed:', err);
  }

  // Deezer API（通过 CORS 代理）
  try {
    const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=10&output=jsonp`;
    const res = await fetchJSONP(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=10`, signal);
    if (res && res.data) {
      res.data.forEach(item => {
        if (item.preview) {
          results.push({
            title: item.title,
            artist: item.artist?.name,
            cover: item.album?.cover_medium,
            url: item.preview,
            duration: item.duration,
            source: 'Deezer'
          });
        }
      });
    }
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.warn('Deezer search failed:', err);
  }

  return results;
}

function fetchJSONP(url, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }

    const callbackName = 'jsonp_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');

    const cleanup = () => {
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    window[callbackName] = (data) => {
      cleanup();
      resolve(data);
    };

    script.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + callbackName + '&output=jsonp';
    script.onerror = () => { cleanup(); resolve(null); };

    if (signal) {
      signal.addEventListener('abort', () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); });
    }

    document.head.appendChild(script);

    setTimeout(() => { cleanup(); resolve(null); }, 8000);
  });
}

// ========== 工具函数 ==========
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ========== 键盘快捷键 ==========
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  if (e.code === 'ArrowRight') playNext();
  if (e.code === 'ArrowLeft') playPrev();
});

// ========== 媒体会话 (锁屏控制) ==========
if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => audio.play());
  navigator.mediaSession.setActionHandler('pause', () => audio.pause());
  navigator.mediaSession.setActionHandler('previoustrack', playPrev);
  navigator.mediaSession.setActionHandler('nexttrack', playNext);

  audio.addEventListener('play', () => {
    const song = playlist[currentIndex];
    if (song) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.title,
        artist: song.artist || '未知',
        artwork: song.cover ? [{ src: song.cover, sizes: '200x200', type: 'image/jpeg' }] : []
      });
    }
  });
}

// ========== 初始化 ==========
renderLocalList();
