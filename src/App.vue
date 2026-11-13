<template>
  <div class="app-shell">
    <aside class="sidebar" :class="{ 'mobile-open': mobileMenuOpen }">
      <a class="brand" href="#"><span class="brand-mark">♫</span><span>JQ<span class="brand-light"> MUSIC</span></span></a>
      <div class="nav-label">音乐库</div>
      <button class="nav-item" :class="{ active: view === 'home' }" @click="view = 'home'"><span class="nav-icon">⌂</span>发现</button>
      <button class="nav-item" :class="{ active: view === 'online' }" @click="view = 'online'"><span class="nav-icon">♫</span>在线音乐</button>
      <button class="nav-item" :class="{ active: view === 'apple' }" @click="view = 'apple'"><span class="nav-icon">●</span>Apple Music</button>
      <button class="nav-item" :class="{ active: view === 'albums' }" @click="view = 'albums'"><span class="nav-icon">▦</span>专辑</button>
      <button class="nav-item" :class="{ active: view === 'favorites' }" @click="view = 'favorites'"><span class="nav-icon">♡</span>我的收藏</button>
      <div class="playlist-heading"><span>我的歌单</span><button class="icon-button" title="新建歌单" @click="createPlaylist">＋</button></div>
      <button v-for="list in playlists" :key="list.id" class="nav-item playlist-link" :class="{ active: view === 'playlist:' + list.id }" @click="openPlaylist(list)"><span class="nav-icon">♫</span>{{ list.name }}</button>
      <div v-if="!playlists.length" class="empty-playlists">还没有歌单</div>
      <div class="sidebar-footer"><span class="status-dot" :class="{ offline: !connected }"></span>{{ connected ? 'Navidrome 已连接' : '等待音乐库连接' }}</div>
    </aside>

    <main ref="mainArea" class="main-area" @scroll.passive="onMainScroll">
      <header class="topbar">
        <button class="icon-button mobile-menu-button" title="打开菜单" aria-label="打开菜单" @click="mobileMenuOpen = true">☰</button>
        <div class="history-actions"><button class="icon-button" title="返回" @click="view = 'home'">‹</button><button class="icon-button" title="前进" disabled>›</button></div>
        <label class="search-box"><span class="search-icon" :class="{ searching: searchLoading }"><i v-if="searchLoading" class="search-spinner"></i><template v-else>⌕</template></span><input v-model="query" :placeholder="view === 'online' ? '搜索 Jamendo 免费音乐' : view === 'apple' ? '搜索 Apple Music 华语歌曲' : '搜索歌曲、歌手或专辑'" @input="onSearch"><kbd>⌘ K</kbd></label>
        <div class="listening-time" :class="{ playing: isPlaying }" title="累计听歌时长"><span class="listening-equalizer" aria-hidden="true"><i></i><i></i><i></i></span><span class="listening-time-value">{{ formatListeningTime(listeningSeconds) }}</span></div>
        <button class="profile-button" :class="{ spinning: isPlaying }" title="个人音乐库">Z.</button>
      </header>

      <section class="content" :key="view">
        <div class="welcome-row"><div><div class="eyebrow">你的私人音乐库</div><h1>{{ pageTitle }}</h1><p class="music-blessing">愿每一首歌，都带来片刻好心情。</p></div><div class="date-label">{{ greeting }}</div></div>
        <div v-if="error" class="notice"><span>音乐库暂不可用</span><span>{{ error }}</span><button @click="loadHome">重试</button></div>
        <template v-if="query.trim()">
          <div class="section-heading"><h2>搜索结果</h2><span>{{ songs.length }} 首歌曲</span></div>
          <div v-if="searchLoading" class="search-progress" role="status"><i class="search-spinner"></i><span>{{ view === 'online' ? '正在搜索 Jamendo 音乐…' : view === 'apple' ? '正在搜索 Apple 官方曲库…' : '正在搜索本地与在线音乐…' }}</span></div>
          <song-table :songs="songs" :current-id="current && current.id" :favorites="favorites" :playlists="playlists" @play="playSong" @favorite="toggleFavorite" @queue="queueSong" @add="addToPlaylist" />
          <div v-if="!songs.length && !searchLoading" class="blank-state">没有找到匹配的歌曲</div>
        </template>
        <template v-else-if="view === 'home'">
          <div class="feature-band">
            <div class="feature-copy"><div class="eyebrow">我的音乐，我做主</div><h2>只听音乐<br><span>不被打扰。</span></h2><p>你的私人音乐库，简单、安静、随时播放。</p><button class="primary-button" @click="playAll(songs)"><span>▶</span> 随机播放</button></div>
            <div class="feature-art"><div class="record spinning"><div class="record-label">JQ.<br><small>MUSIC</small></div></div><div class="listening-cat" aria-label="戴耳机听歌的小猫"><span class="cat-ear cat-ear-left"></span><span class="cat-ear cat-ear-right"></span><span class="cat-face">ฅ^•ﻌ•^ฅ</span><span class="cat-headphones"></span></div><div class="art-note note-one">♪</div><div class="art-note note-two">♫</div></div>
          </div>
          <div class="section-heading"><h2>为你挑选</h2><button class="text-button" @click="loadHome">换一批 <span>↻</span></button></div>
          <song-table :songs="songs" :current-id="current && current.id" :favorites="favorites" :playlists="playlists" @play="playSong" @favorite="toggleFavorite" @queue="queueSong" @add="addToPlaylist" />
          <div class="section-heading albums-heading"><h2>最近添加的专辑</h2><button class="text-button" @click="view = 'albums'">全部专辑 <span>→</span></button></div>
          <div class="album-grid"><button v-for="album in albums.slice(0, 6)" :key="album.id" class="album-item" @click="openAlbum(album)"><img :src="album.cover || placeholder" :alt="album.name"><strong>{{ album.name }}</strong><span>{{ album.artist }}</span></button></div>
        </template>
        <template v-else-if="view === 'online'">
          <div v-if="query.trim()" class="section-heading"><h2>Jamendo 搜索结果</h2><span>{{ songs.length }} 首歌曲</span></div>
          <template v-else>
            <div class="online-intro"><div><div class="eyebrow">合法授权音乐</div><h2>Jamendo 免费音乐</h2><p>试听由 Jamendo 官方提供的曲目。来源和授权链接会随歌曲保存在你的歌单中。</p></div><span class="source-mark">JAMENDO</span></div>
            <form class="playlist-import" @submit.prevent="importJamendoPlaylist"><label><span>导入公开歌单</span><input v-model="jamendoPlaylistInput" placeholder="粘贴 Jamendo 歌单链接或编号，例如 p11696"></label><button class="primary-button" :disabled="jamendoLoading || !jamendoPlaylistInput.trim()">{{ jamendoLoading ? '读取中…' : '读取歌单' }}</button></form>
            <div v-if="!jamendoConfigured" class="notice jamendo-notice"><span>需要配置 Jamendo client_id</span><span>在本机 config.json 的 jamendo.clientId 填入开发者应用 ID，然后重启服务。该配置不会提交到 Git。</span></div>
            <div v-if="onlinePlaylist" class="imported-playlist"><div class="imported-playlist-head"><div><div class="eyebrow">JAMENDO 公共歌单</div><h3>{{ onlinePlaylist.name }}</h3><span v-if="onlinePlaylist.owner">创建者：{{ onlinePlaylist.owner }}</span></div><button class="secondary-button" :disabled="!onlinePlaylist.songs.length || !playlists.length" @click="addJamendoPlaylist">全部导入到我的歌单</button></div><p class="import-limit">当前载入 {{ onlinePlaylist.songs.length }} 首。Jamendo API 对聚合曲目数量有限制，超出部分不会显示。</p><div class="section-heading"><h2>歌单曲目</h2><span>{{ onlinePlaylist.songs.length }} 首歌曲</span></div></div>
          </template>
          <song-table :songs="songs" :current-id="current && current.id" :favorites="favorites" :playlists="playlists" @play="playSong" @favorite="toggleFavorite" @queue="queueSong" @add="addToPlaylist" />
          <div v-if="jamendoLoadingMore" class="search-progress jamendo-load-more" role="status"><i class="search-spinner"></i><span>{{ songs.length ? '正在加载更多免费音乐…' : query.trim() ? '正在搜索 Jamendo 曲目…' : '正在加载热门免费音乐…' }}</span></div>
          <div v-else-if="songs.length && jamendoHasMore && !onlinePlaylist" class="scroll-hint">继续向下滚动，加载更多音乐</div>
          <div v-else-if="songs.length && !jamendoHasMore && !onlinePlaylist" class="scroll-hint">已经加载完了</div>
          <div v-if="!songs.length && !searchLoading && query.trim()" class="blank-state">没有找到匹配的免费曲目</div>
          <div v-if="!songs.length && !searchLoading && !query.trim() && !onlinePlaylist" class="online-empty">输入上方搜索框搜索曲目，或粘贴 Jamendo 公开歌单链接。</div>
          <div v-if="!songs.length && !searchLoading && onlinePlaylist" class="blank-state">该歌单没有可试听的曲目</div>
        </template>
        <template v-else-if="view === 'apple'">
          <div class="apple-intro"><div><div class="eyebrow">Apple 官方华语曲库</div><h2>iTunes 试听</h2><p>无需开发者账户即可搜索中国区歌曲并播放约 30 秒官方试听。完整播放仍需要后续配置 MusicKit 和有效 Apple Music 订阅。</p></div><button v-if="appleConfigured" class="apple-login-button" :disabled="appleLoading" @click="toggleAppleAuthorization">{{ appleAuthorized ? '已登录 Apple Music' : appleLoading ? '连接中…' : '登录完整曲库' }}</button></div>
          <div v-if="!appleConfigured" class="notice"><span>当前为公开试听模式</span><span>优先搜索中国大陆；大陆无结果时自动使用香港或台湾地区的官方 30 秒试听。以后配置 MusicKit 后可升级为订阅完整播放。</span></div>
          <div v-if="!query.trim()" class="online-empty">在顶部搜索周杰伦、林俊杰、陈奕迅等歌手或歌曲名称。</div>
          <template v-if="query.trim()"><div class="section-heading"><h2>iTunes 中国区搜索结果</h2><span>{{ songs.length }} 首歌曲</span></div><div v-if="searchLoading" class="search-progress" role="status"><i class="search-spinner"></i><span>正在搜索 Apple 官方曲库…</span></div><song-table :songs="songs" :current-id="current && current.id" :favorites="favorites" :playlists="playlists" @play="playSong" @favorite="toggleFavorite" @queue="queueSong" @add="addToPlaylist" /><div v-if="!songs.length && !searchLoading" class="blank-state">没有找到带官方试听的匹配歌曲</div></template>
        </template>
        <template v-else-if="view === 'albums'">
          <div class="section-heading"><h2>全部专辑</h2><span>{{ albums.length }} 张专辑</span></div>
          <div class="album-grid album-grid-large"><button v-for="album in albums" :key="album.id" class="album-item" @click="openAlbum(album)"><img :src="album.cover || placeholder" :alt="album.name"><strong>{{ album.name }}</strong><span>{{ album.artist }}</span></button></div>
        </template>
        <template v-else>
          <div v-if="activePlaylist" class="playlist-toolbar"><div><div class="eyebrow">我的音乐收藏</div><h2>{{ activePlaylist.name }}</h2><span>{{ activePlaylist.songCount || playlistSongs.length }} 首歌曲</span></div><button class="icon-button danger-button" title="删除歌单" @click="deletePlaylist(activePlaylist)">⌫</button></div>
          <div v-else class="section-heading"><h2>{{ view === 'favorites' ? '我的收藏' : selectedAlbum ? selectedAlbum.name : '最近播放' }}</h2><span>{{ songs.length }} 首歌曲</span></div>
          <song-table :songs="songs" :current-id="current && current.id" :favorites="favorites" :playlists="playlists" :show-remove="view.startsWith('playlist:')" @play="playSong" @favorite="toggleFavorite" @queue="queueSong" @add="addToPlaylist" @remove="removeFromPlaylist" />
          <div v-if="!songs.length && !loading" class="blank-state">这里还没有歌曲</div>
        </template>
      </section>
    </main>

    <footer class="player-bar">
      <div class="now-playing"><button class="track-open" :disabled="!current" title="打开歌词播放界面" @click="openLyrics"><img :src="current && current.cover || placeholder" alt=""><span class="track-meta"><strong>{{ current ? current.title : '选择一首歌曲开始播放' }}</strong><span>{{ current ? current.artist : '你的音乐，由你掌控' }}</span></span></button><button class="icon-button player-favorite" :class="{ liked: current && favorites.includes(current.id) }" :title="current && favorites.includes(current.id) ? '取消收藏' : '收藏歌曲'" :disabled="!current" @click="current && toggleFavorite(current)">{{ current && favorites.includes(current.id) ? '♥' : '♡' }}</button></div>
      <div class="playback"><div class="transport">
        <button class="icon-button" :title="shuffle ? '关闭随机播放' : '随机播放'" :class="{ selected: shuffle }" aria-label="随机播放" @click="shuffle = !shuffle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg></button>
        <button class="icon-button" title="上一首" aria-label="上一首" @click="previous"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="icon-fill" d="M7 5h2v14H7zM18 6v12l-8-6z"/></svg></button>
        <button class="play-button" :title="isPlaying ? '暂停' : '播放'" :aria-label="isPlaying ? '暂停' : '播放'" @click="togglePlay"><svg v-if="isPlaying" viewBox="0 0 24 24" aria-hidden="true"><path class="icon-fill" d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg><svg v-else viewBox="0 0 24 24" aria-hidden="true"><path class="icon-fill" d="m8 5 11 7-11 7z"/></svg></button>
        <button class="icon-button" title="下一首" aria-label="下一首" @click="next"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="icon-fill" d="M15 5h2v14h-2zM6 6v12l8-6z"/></svg></button>
        <button class="icon-button" :title="repeat === 'one' ? '单曲循环' : '列表循环'" :class="{ selected: repeat === 'one' }" aria-label="切换循环模式" @click="repeat = repeat === 'all' ? 'one' : 'all'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/><text v-if="repeat === 'one'" x="12" y="15">1</text></svg></button>
      </div><div class="progress-row"><span>{{ formatTime(position) }}</span><input v-model.number="position" type="range" min="0" :max="duration || 1" @pointerdown="seeking = true" @touchstart="seeking = true" @input="previewSeek" @pointerup="finishSeek" @touchend="finishSeek" @change="finishSeek"><span>{{ formatTime(duration) }}</span></div></div>
      <div class="player-extras"><button class="icon-button queue-button" title="播放队列" @click="queueOpen = !queueOpen">☷<span v-if="queue.length" class="queue-count">{{ queue.length }}</span></button><span class="volume-icon">◖</span><input v-model.number="volume" aria-label="音量" type="range" min="0" max="1" step="0.01" @input="setVolume"></div>
      <div v-if="queueOpen" class="queue-popover"><div class="queue-head"><strong>播放队列</strong><button class="icon-button" @click="queueOpen = false">×</button></div><div v-for="(track, i) in queue" :key="track.id + i" class="queue-row" @click="playAt(i)"><span>{{ i + 1 }}</span><div><strong>{{ track.title }}</strong><small>{{ track.artist }}</small></div><button class="icon-button" title="从队列移除" @click.stop="queue.splice(i, 1)">×</button></div><div v-if="!queue.length" class="queue-empty">队列为空</div></div>
    </footer>
    <button v-if="mobileMenuOpen" class="mobile-menu-backdrop" aria-label="关闭菜单" @click="mobileMenuOpen = false"></button>
    <audio ref="audio" @timeupdate="syncTime" @loadedmetadata="syncDuration" @ended="onEnded" @play="isPlaying = true" @pause="isPlaying = false" @error="audioError"></audio>
    <div v-if="lyricsOpen" class="lyrics-overlay"><header class="lyrics-header"><button class="icon-button" title="关闭歌词" @click="lyricsOpen = false">×</button><span>正在播放</span><span></span></header><div class="lyrics-content"><img class="lyrics-cover" :src="current && current.cover || placeholder" alt=""><strong class="lyrics-track-title">{{ current && current.title }}</strong><span class="lyrics-track-artist">{{ current && current.artist }}</span><div v-if="lyricsLoading" class="lyrics-empty">正在读取歌词…</div><div v-else-if="!lyricLines.length" class="lyrics-empty">{{ current && current.type === 'ONLINE' ? '该在线曲目暂未提供歌词' : '暂无歌词' }}</div><div v-else ref="lyricsList" class="lyrics-list"><button v-for="(line, index) in lyricLines" :key="index" :ref="'lyric-' + index" class="lyric-line" :class="{ active: index === activeLyricIndex }" @click="seekToLyric(line.time)">{{ line.text || '♪' }}</button></div><span v-if="lyricsSource" class="lyrics-source">歌词来源：{{ lyricsSource }}</span></div></div>
    <div v-if="showPlaylistDialog" class="modal-backdrop" @click.self="showPlaylistDialog = false"><form class="modal" @submit.prevent="savePlaylist"><div class="modal-title"><h2>新建歌单</h2><button type="button" class="icon-button" @click="showPlaylistDialog = false">×</button></div><label>歌单名称<input v-model="playlistName" autofocus maxlength="120" placeholder="给歌单起个名字"></label><div class="modal-actions"><button type="button" class="secondary-button" @click="showPlaylistDialog = false">取消</button><button class="primary-button" :disabled="!playlistName.trim()">创建歌单</button></div></form></div>
  </div>
</template>

<script>
import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 12000 })
const placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23252822"/%3E%3Ctext x="50%25" y="57%25" text-anchor="middle" font-size="32" fill="%2395ad70"%3E♫%3C/text%3E%3C/svg%3E'

const SongTable = {
  props: ['songs', 'currentId', 'favorites', 'showRemove', 'playlists'],
  template: `<div class="song-table"><div class="song-head"><span>#</span><span>标题</span><span>专辑</span><span>时长</span><span></span></div><div v-for="(song, index) in songs" :key="song.id" class="song-row" :class="{ playing: currentId === song.id }" @dblclick="$emit('play', song)"><span class="song-index"><span class="index-number">{{ String(index + 1).padStart(2, '0') }}</span><button class="row-play" title="播放" @click="$emit('play', song)">▶</button></span><div class="song-title"><img :src="song.cover || placeholder" alt=""><div><strong>{{ song.title }}</strong><span>{{ song.artist }}</span><small v-if="song.type === 'ONLINE'" class="song-license">{{ song.source }} · {{ song.licenseType || '授权信息' }}<a v-if="song.licenseUrl" :href="song.licenseUrl" target="_blank" rel="noopener noreferrer" @click.stop>查看许可</a></small></div></div><span class="song-album">{{ song.album }}</span><span class="song-duration">{{ formatTime(song.duration) }}</span><div class="row-actions"><button class="icon-button" :class="{ liked: favorites.includes(song.id) }" :title="favorites.includes(song.id) ? '取消收藏' : '收藏歌曲'" @click="$emit('favorite', song)">{{ favorites.includes(song.id) ? '♥' : '♡' }}</button><button v-if="playlists.length" class="icon-button" title="添加到歌单" @click="$emit('add', song)">＋</button><button v-if="showRemove" class="icon-button" title="从歌单移除" @click="$emit('remove', song)">−</button><button class="icon-button" title="加入播放队列" @click="$emit('queue', song)">⋯</button></div></div></div>`,
  data: () => ({ placeholder }),
  methods: { formatTime(value) { const seconds = Number(value || 0); return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` } }
}

export default {
  components: { SongTable },
  data() { return { view: 'home', query: '', songs: [], albums: [], playlists: [], favorites: [], playlistSongs: [], current: null, queue: [], queueOpen: false, queueIndex: -1, isPlaying: false, listeningSeconds: 0, listeningTimer: null, shuffle: false, repeat: 'all', volume: 0.72, position: 0, duration: 0, seeking: false, loading: false, searchLoading: false, searchRequestId: 0, connected: false, error: '', showPlaylistDialog: false, playlistName: '', activePlaylist: null, selectedAlbum: null, searchTimer: null, jamendoPlaylistInput: '', jamendoLoading: false, jamendoConfigured: false, jamendoOffset: 0, jamendoHasMore: true, jamendoLoadingMore: false, jamendoLoadId: 0, onlinePlaylist: null, appleConfigured: false, appleMissing: [], appleAuthorized: false, appleLoading: false, applePlayer: null, lyricsOpen: false, lyricsLoading: false, lyricLines: [], lyricsSource: '', lyricSongId: '', activeLyricIndex: -1, mobileMenuOpen: false, placeholder } },
  computed: {
    pageTitle() { if (this.view === 'favorites') return '喜欢的音乐'; if (this.view === 'albums') return '专辑'; if (this.view === 'online') return '在线音乐'; if (this.view === 'apple') return 'Apple Music'; if (this.view.startsWith('playlist:')) return this.activePlaylist?.name || '我的歌单'; if (this.view === 'album') return this.selectedAlbum?.name || '专辑'; return '你好，音乐爱好者' },
    greeting() { const h = new Date().getHours(); return h < 11 ? 'Good morning.' : h < 18 ? 'Good afternoon.' : 'Good evening.' }
  },
  created() { try { this.listeningSeconds = Math.max(0, Number(window.localStorage.getItem('jqmusic-listening-seconds')) || 0) } catch (error) { this.listeningSeconds = 0 } this.loadHome(); this.loadPlaylists(); this.loadFavorites(); this.loadView = this.loadHome; window.addEventListener('keydown', this.keyboard) },
  beforeDestroy() { window.removeEventListener('keydown', this.keyboard); clearTimeout(this.searchTimer); this.stopListeningTimer() },
  watch: { view() { clearTimeout(this.searchTimer); this.searchRequestId++; this.jamendoLoadId++; this.jamendoLoadingMore = false; this.searchLoading = false; this.mobileMenuOpen = false; this.query = ''; this.loadViewData() }, isPlaying(playing) { if (playing) this.startListeningTimer(); else this.stopListeningTimer() } },
  methods: {
    async request(path, options) { const { data } = await api({ url: path, ...options }); return data },
    formatListeningTime(value) { const seconds = Math.max(0, Math.floor(Number(value) || 0)); const hours = Math.floor(seconds / 3600); const minutes = Math.floor((seconds % 3600) / 60); return hours ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m` },
    startListeningTimer() { if (this.listeningTimer) return; this.listeningTimer = window.setInterval(() => { this.listeningSeconds++; try { window.localStorage.setItem('jqmusic-listening-seconds', String(this.listeningSeconds)) } catch (error) { /* keep counting for this session when storage is unavailable */ } }, 1000) },
    stopListeningTimer() { if (this.listeningTimer) { window.clearInterval(this.listeningTimer); this.listeningTimer = null } try { window.localStorage.setItem('jqmusic-listening-seconds', String(this.listeningSeconds)) } catch (error) { /* storage can be disabled by browser privacy settings */ } },
    async loadHome() { this.loading = true; this.error = ''; try { const [recommendations, albumResult, favoriteResult] = await Promise.all([this.request('/recommendations'), this.request('/albums'), this.request('/favorites')]); this.songs = recommendations.songs; this.albums = albumResult.albums; this.favorites = favoriteResult.ids; this.connected = true } catch (error) { this.error = error.response?.data?.error || '请检查后台服务、数据库和音乐库配置'; this.connected = false } finally { this.loading = false } },
    async loadPlaylists() { try { this.playlists = (await this.request('/playlists')).playlists } catch (e) { this.error ||= '无法读取歌单，请检查数据库连接' } },
    async loadFavorites() { try { this.favorites = (await this.request('/favorites')).ids } catch (e) { /* connection is reported in the library state */ } },
    async loadViewData() { if (this.view === 'home' || this.view === 'albums') { if (!this.songs.length) this.loadHome(); return } if (this.view === 'online') { this.songs = []; this.onlinePlaylist = null; this.jamendoOffset = 0; this.jamendoHasMore = true; try { this.jamendoConfigured = (await this.request('/jamendo/status')).configured; if (this.jamendoConfigured) await this.loadJamendoPage(true) } catch (error) { this.error = error.response?.data?.error || '无法读取 Jamendo 免费音乐' } return } if (this.view === 'apple') { this.songs = []; try { const status = await this.request('/apple-music/status'); this.appleConfigured = status.configured; this.appleMissing = status.missing || []; if (status.configured) await this.initAppleMusic() } catch (error) { this.error = '无法读取 Apple Music 配置状态' } return } try { if (this.view === 'favorites') { this.songs = (await this.request('/favorites/songs')).songs; return } if (this.view === 'album' && this.selectedAlbum) { this.songs = (await this.request(`/albums/${encodeURIComponent(this.selectedAlbum.id)}/songs`)).songs; return } if (this.view.startsWith('playlist:')) { const id = this.view.split(':')[1]; this.songs = (await this.request(`/playlists/${id}/tracks`)).songs; return } } catch (error) { this.error = error.response?.data?.error || '读取内容失败' } },
    async loadJamendoPage(reset = false) {
      if (this.view !== 'online' || this.onlinePlaylist || (!reset && (this.jamendoLoadingMore || !this.jamendoHasMore))) return
      const loadId = reset ? ++this.jamendoLoadId : this.jamendoLoadId
      if (reset) { this.jamendoOffset = 0; this.jamendoHasMore = true; this.songs = [] }
      this.jamendoLoadingMore = true
      this.searchLoading = true
      try {
        const q = this.query.trim()
        const path = q ? '/jamendo/search' : '/jamendo/tracks'
        const result = await this.request(path, { params: { q: q || undefined, offset: this.jamendoOffset, limit: 30 } })
        if (loadId !== this.jamendoLoadId || this.view !== 'online') return
        const byId = new Map([...this.songs, ...(result.songs || [])].map(song => [song.id, song]))
        this.songs = [...byId.values()]
        this.jamendoOffset = Number(result.nextOffset) || this.jamendoOffset + (result.songs || []).length
        this.jamendoHasMore = Boolean(result.hasMore)
        this.error = ''
      } catch (error) {
        if (loadId === this.jamendoLoadId) this.error = error.response?.data?.error || 'Jamendo 音乐加载失败，请稍后重试'
      } finally {
        if (loadId === this.jamendoLoadId) { this.jamendoLoadingMore = false; this.searchLoading = false }
      }
    },
    onMainScroll(event) {
      if (this.view !== 'online' || this.onlinePlaylist) return
      const target = event.currentTarget
      if (target.scrollHeight - target.scrollTop - target.clientHeight < 280) this.loadJamendoPage(false)
    },
    onSearch() {
      clearTimeout(this.searchTimer)
      const requestId = ++this.searchRequestId
      const q = this.query.trim()
      if (!q) { this.searchLoading = false; this.loadViewData(); return }
      this.searchLoading = true
      this.searchTimer = setTimeout(async () => {
        const params = { q }
        try {
          if (this.view === 'online') {
            if (requestId !== this.searchRequestId) return
            await this.loadJamendoPage(true)
          } else if (this.view === 'apple') {
            const result = await this.request(this.appleAuthorized ? '/apple-music/search' : '/itunes/search', { params })
            if (requestId !== this.searchRequestId) return
            this.songs = result.songs
          }
          else {
            const [local, free, itunes] = await Promise.allSettled([this.request('/search', { params }), this.request('/jamendo/search', { params }), this.request('/itunes/search', { params })])
            if (requestId !== this.searchRequestId) return
            const localSongs = local.status === 'fulfilled' ? local.value.songs : []
            const freeSongs = free.status === 'fulfilled' ? free.value.songs : []
            const itunesSongs = itunes.status === 'fulfilled' ? itunes.value.songs : []
            const byId = new Map([...localSongs, ...freeSongs, ...itunesSongs].map(song => [song.id, song]))
            this.songs = [...byId.values()]
            if ([local, free, itunes].every(result => result.status === 'rejected')) throw local.reason
            if (!this.songs.length && itunes.status === 'rejected') this.error = itunes.reason.response?.data?.error || '没有找到匹配歌曲'
          }
          if (requestId !== this.searchRequestId) return
          this.onlinePlaylist = null
          this.error = ''
        } catch (error) {
          if (requestId === this.searchRequestId) this.error = error.response?.data?.error || '搜索失败'
        } finally {
          if (requestId === this.searchRequestId) this.searchLoading = false
        }
      }, 300)
    },
    async toggleFavorite(song) { const liked = this.favorites.includes(song.id); try { await api({ url: `/favorites/${encodeURIComponent(song.id)}`, method: liked ? 'delete' : 'put', data: liked ? undefined : { song } }); this.favorites = liked ? this.favorites.filter(id => id !== song.id) : [...this.favorites, song.id] } catch (error) { this.error = '收藏更新失败，请检查数据库连接' } },
    playSong(song) { this.queue = [...this.songs]; this.queueIndex = this.queue.findIndex(item => item.id === song.id); if (this.queueIndex < 0) { this.queue.unshift(song); this.queueIndex = 0 } this.startCurrent(song) },
    startCurrent(song) { this.current = song; this.position = 0; this.duration = song.duration || 0; this.lyricSongId = ''; if (this.lyricsOpen) this.loadLyrics(song); if (song.appleMusic) { this.playAppleSong(song); return } if (this.applePlayer) this.applePlayer.pause(); this.$nextTick(() => { const audio = this.$refs.audio; audio.src = song.stream; audio.volume = this.volume; audio.play().then(() => api.post(`/history/${encodeURIComponent(song.id)}`, { song })).catch(() => { this.isPlaying = false; this.error = '无法播放此歌曲，请检查音乐库和账号权限' }) }) },
    playAll(list) { if (!list.length) return; this.queue = [...list]; this.queueIndex = this.shuffle ? Math.floor(Math.random() * this.queue.length) : 0; this.startCurrent(this.queue[this.queueIndex]) },
    queueSong(song) { if (!this.queue.some(item => item.id === song.id)) this.queue.push(song) },
    playAt(index) { this.queueIndex = index; this.startCurrent(this.queue[index]); this.queueOpen = false },
    next() { if (!this.queue.length) return; this.queueIndex = this.shuffle ? Math.floor(Math.random() * this.queue.length) : (this.queueIndex + 1) % this.queue.length; this.startCurrent(this.queue[this.queueIndex]) },
    previous() { if (this.position > 3) { this.$refs.audio.currentTime = 0; return } if (!this.queue.length) return; this.queueIndex = (this.queueIndex - 1 + this.queue.length) % this.queue.length; this.startCurrent(this.queue[this.queueIndex]) },
    onEnded() { if (this.repeat === 'one') { this.$refs.audio.currentTime = 0; this.$refs.audio.play() } else this.next() },
    togglePlay() { if (!this.current) return; if (this.current.appleMusic && this.applePlayer) { if (this.isPlaying) this.applePlayer.pause(); else this.applePlayer.play().catch(() => { this.error = 'Apple Music 播放失败，请确认已登录且订阅有效' }); return } if (this.isPlaying) this.$refs.audio.pause(); else this.$refs.audio.play().catch(() => { this.error = '播放失败，请检查音乐库连接' }) },
    previewSeek() { this.seeking = true },
    finishSeek() { if (this.$refs.audio) this.$refs.audio.currentTime = this.position; this.seeking = false; this.updateActiveLyric() },
    syncTime() { if (!this.seeking) this.position = this.$refs.audio.currentTime || 0; this.updateActiveLyric() }, syncDuration() { this.duration = this.$refs.audio.duration || this.current?.duration || 0 }, setVolume() { this.$refs.audio.volume = this.volume },
    async openLyrics() { if (!this.current) return; this.lyricsOpen = true; await this.loadLyrics(this.current) },
    async loadLyrics(song) { this.lyricsLoading = true; this.lyricLines = []; this.lyricsSource = ''; this.lyricSongId = song.id; try { const result = await this.request(`/lyrics/${encodeURIComponent(song.id)}`); if (this.current?.id !== song.id) return; this.lyricLines = this.parseLyrics(result.lyrics || ''); this.lyricsSource = result.source || ''; this.updateActiveLyric() } catch (error) { this.lyricLines = []; this.lyricsSource = '' } finally { this.lyricsLoading = false } },
    parseLyrics(text) { const lines = String(text || '').split(/\r?\n/).flatMap(line => { const times = [...line.matchAll(/\[(\d{1,2}):(\d{2}(?:\.\d{1,2})?)\]/g)]; const content = line.replace(/\[[^\]]*\]/g, '').trim(); if (!times.length) return content ? [{ time: null, text: content }] : []; return times.map(match => ({ time: Number(match[1]) * 60 + Number(match[2]), text: content })) }).sort((a, b) => (a.time ?? 0) - (b.time ?? 0)); return lines },
    updateActiveLyric() { if (!this.lyricLines.length) return; let index = -1; for (let i = 0; i < this.lyricLines.length; i++) { if (this.lyricLines[i].time == null || this.lyricLines[i].time <= this.position) index = i; else break } this.activeLyricIndex = index; if (index >= 0 && this.lyricsOpen) this.$nextTick(() => { const line = this.$refs[`lyric-${index}`]?.[0]; line?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }) },
    seekToLyric(time) { if (time == null) return; this.$refs.audio.currentTime = time; this.position = time },
    loadScript(src) { return new Promise((resolve, reject) => { const existing = document.querySelector(`script[src="${src}"]`); if (existing) { if (window.MusicKit) resolve(); else existing.addEventListener('load', resolve, { once: true }); return } const script = document.createElement('script'); script.src = src; script.async = true; script.onload = resolve; script.onerror = reject; document.head.appendChild(script) }) },
    async initAppleMusic() { if (this.applePlayer) return; this.appleLoading = true; try { const tokenResult = await this.request('/apple-music/token'); await this.loadScript('https://js-cdn.music.apple.com/musickit/v3/musickit.js'); if (!window.MusicKit) throw new Error('MusicKit SDK 加载失败'); window.MusicKit.configure({ developerToken: tokenResult.developerToken, storefrontId: tokenResult.storefront, app: { name: 'JQ Music', build: '1.0.0' } }); this.applePlayer = window.MusicKit.getInstance(); this.appleAuthorized = this.applePlayer.isAuthorized; this.applePlayer.addEventListener(window.MusicKit.Events.playbackStateDidChange, event => { const state = event.state; this.isPlaying = state === window.MusicKit.PlaybackStates.playing }); this.applePlayer.addEventListener(window.MusicKit.Events.playbackTimeDidChange, event => { if (this.current?.appleMusic && !this.seeking) { this.position = event.currentPlaybackTime || 0; this.duration = event.currentPlaybackDuration || this.duration } }) } catch (error) { this.error = error.response?.data?.error || error.message || 'Apple Music 初始化失败' } finally { this.appleLoading = false } },
    async toggleAppleAuthorization() { await this.initAppleMusic(); if (!this.applePlayer) return; this.appleLoading = true; try { if (this.applePlayer.isAuthorized) await this.applePlayer.unauthorize(); else await this.applePlayer.authorize(); this.appleAuthorized = this.applePlayer.isAuthorized } catch (error) { this.error = 'Apple Music 登录失败，请检查浏览器弹窗和账户订阅状态' } finally { this.appleLoading = false } },
    async playAppleSong(song) { await this.initAppleMusic(); if (!this.applePlayer?.isAuthorized) { this.error = '请先登录 Apple Music 后再播放'; return } try { this.$refs.audio.pause(); await this.applePlayer.setQueue({ song: song.sourcePlatformId }); await this.applePlayer.play(); this.isPlaying = true; api.post(`/history/${encodeURIComponent(song.id)}`, { song }) } catch (error) { this.isPlaying = false; this.error = 'Apple Music 播放失败，请确认该曲目在你的地区可用且订阅有效' } },
    audioError() { if (this.current) this.error = '音频流不可用，请确认音乐库已启动并完成歌曲扫描' },
    formatTime(value) { const seconds = Number(value || 0); return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` },
    createPlaylist() { this.playlistName = ''; this.showPlaylistDialog = true },
    async savePlaylist() { try { await this.request('/playlists', { method: 'post', data: { name: this.playlistName } }); this.showPlaylistDialog = false; await this.loadPlaylists() } catch (error) { this.error = error.response?.data?.error || '创建歌单失败' } },
    openPlaylist(list) { this.activePlaylist = list; this.view = `playlist:${list.id}` },
    async deletePlaylist(list) { if (!window.confirm(`删除歌单“${list.name}”？歌曲文件不会被删除。`)) return; try { await api.delete(`/playlists/${list.id}`); this.activePlaylist = null; this.view = 'home'; await this.loadPlaylists() } catch (error) { this.error = '删除歌单失败' } },
    async removeFromPlaylist(song) { const id = this.view.split(':')[1]; await api.delete(`/playlists/${id}/songs/${encodeURIComponent(song.id)}`); this.loadViewData(); this.loadPlaylists() },
    async addToPlaylist(song) { if (!this.playlists.length) return; const choices = this.playlists.map((list, index) => `${index + 1}. ${list.name}`).join('\n'); const choice = Number(window.prompt(`添加到哪个歌单？\n${choices}`)); const list = this.playlists[choice - 1]; if (!list) return; try { await api.put(`/playlists/${list.id}/songs/${encodeURIComponent(song.id)}`, { song }); await this.loadPlaylists() } catch (error) { this.error = '添加歌曲失败' } },
    parseJamendoPlaylistId(value) { const input = String(value || '').trim(); if (/^\d{1,12}$/.test(input)) return input; const slug = input.match(/^p(\d{1,12})$/i); if (slug) return slug[1]; try { const url = new URL(input); if (!['jamendo.com', 'www.jamendo.com', 'jamen.do'].includes(url.hostname.toLowerCase())) return ''; const pathId = url.pathname.match(/\/playlists?\/(?:p)?(\d{1,12})(?:\/|$)/i); const shortId = `${url.pathname} ${url.search}`.match(/(?:\/|^|\b)p(\d{1,12})\b/i); const queryId = url.searchParams.get('id'); return pathId?.[1] || shortId?.[1] || (/^\d{1,12}$/.test(queryId || '') ? queryId : '') } catch (error) { return '' } },
    async importJamendoPlaylist() { const id = this.parseJamendoPlaylistId(this.jamendoPlaylistInput); if (!id) { this.error = '请粘贴 Jamendo 歌单链接或编号'; return } this.jamendoLoading = true; this.error = ''; this.songs = []; this.onlinePlaylist = null; try { const result = await this.request(`/jamendo/playlists/${id}`); this.onlinePlaylist = result.playlist; this.songs = result.playlist.songs } catch (error) { this.error = error.response?.data?.error || '读取 Jamendo 歌单失败，请检查链接或稍后重试' } finally { this.jamendoLoading = false } },
    async addJamendoPlaylist() { if (!this.onlinePlaylist || !this.playlists.length) return; const choices = this.playlists.map((list, index) => `${index + 1}. ${list.name}`).join('\n'); const choice = Number(window.prompt(`将 ${this.onlinePlaylist.songs.length} 首歌曲导入到哪个歌单？\n${choices}`)); const list = this.playlists[choice - 1]; if (!list) return; try { const result = await api.post(`/playlists/${list.id}/tracks`, { songs: this.onlinePlaylist.songs.slice(0, 100) }); await this.loadPlaylists(); this.error = `已导入 ${result.data.imported} 首歌曲到「${list.name}」` } catch (error) { this.error = error.response?.data?.error || '导入歌单失败' } },
    async openAlbum(album) { this.selectedAlbum = album; this.view = 'album'; try { this.songs = (await this.request(`/albums/${encodeURIComponent(album.id)}/songs`)).songs } catch (error) { this.error = '无法读取专辑歌曲' } },
    keyboard(event) { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector('.search-box input').focus() } else if (event.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); this.togglePlay() } }
  }
}
</script>
