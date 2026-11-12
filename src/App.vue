<template>
  <div class="app-shell">
    <aside class="sidebar">
      <a class="brand" href="#"><span class="brand-mark">♫</span><span>JQ<span class="brand-light"> MUSIC</span></span></a>
      <div class="nav-label">音乐库</div>
      <button class="nav-item" :class="{ active: view === 'home' }" @click="view = 'home'"><span class="nav-icon">⌂</span>发现</button>
      <button class="nav-item" :class="{ active: view === 'albums' }" @click="view = 'albums'"><span class="nav-icon">▦</span>专辑</button>
      <button class="nav-item" :class="{ active: view === 'favorites' }" @click="view = 'favorites'"><span class="nav-icon">♡</span>我的收藏</button>
      <div class="playlist-heading"><span>我的歌单</span><button class="icon-button" title="新建歌单" @click="createPlaylist">＋</button></div>
      <button v-for="list in playlists" :key="list.id" class="nav-item playlist-link" :class="{ active: view === 'playlist:' + list.id }" @click="openPlaylist(list)"><span class="nav-icon">♫</span>{{ list.name }}</button>
      <div v-if="!playlists.length" class="empty-playlists">还没有歌单</div>
      <div class="sidebar-footer"><span class="status-dot" :class="{ offline: !connected }"></span>{{ connected ? 'Navidrome 已连接' : '等待音乐库连接' }}</div>
    </aside>

    <main class="main-area">
      <header class="topbar">
        <div class="history-actions"><button class="icon-button" title="返回" @click="view = 'home'">‹</button><button class="icon-button" title="前进" disabled>›</button></div>
        <label class="search-box"><span class="search-icon">⌕</span><input v-model="query" placeholder="搜索歌曲、歌手或专辑" @input="onSearch"><kbd>⌘ K</kbd></label>
        <button class="profile-button" title="个人音乐库">J</button>
      </header>

      <section class="content" :key="view">
        <div class="welcome-row"><div><div class="eyebrow">你的私人音乐库</div><h1>{{ pageTitle }}</h1></div><div class="date-label">{{ greeting }}</div></div>
        <div v-if="error" class="notice"><span>音乐库暂不可用</span><span>{{ error }}</span><button @click="loadHome">重试</button></div>
        <template v-if="query.trim()">
          <div class="section-heading"><h2>搜索结果</h2><span>{{ songs.length }} 首歌曲</span></div>
          <song-table :songs="songs" :current-id="current && current.id" :favorites="favorites" :playlists="playlists" @play="playSong" @favorite="toggleFavorite" @queue="queueSong" @add="addToPlaylist" />
          <div v-if="!songs.length && !loading" class="blank-state">没有找到匹配的歌曲</div>
        </template>
        <template v-else-if="view === 'home'">
          <div class="feature-band">
            <div class="feature-copy"><div class="eyebrow">我的音乐，我做主</div><h2>只听音乐<br><span>不被打扰。</span></h2><p>你的私人音乐库，简单、安静、随时播放。</p><button class="primary-button" @click="playAll(songs)"><span>▶</span> 随机播放</button></div>
            <div class="feature-art"><div class="record"><div class="record-label">JQ.<br><small>MUSIC</small></div></div><div class="art-note note-one">♪</div><div class="art-note note-two">♫</div></div>
          </div>
          <div class="section-heading"><h2>为你挑选</h2><button class="text-button" @click="loadHome">换一批 <span>↻</span></button></div>
          <song-table :songs="songs" :current-id="current && current.id" :favorites="favorites" :playlists="playlists" @play="playSong" @favorite="toggleFavorite" @queue="queueSong" @add="addToPlaylist" />
          <div class="section-heading albums-heading"><h2>最近添加的专辑</h2><button class="text-button" @click="view = 'albums'">全部专辑 <span>→</span></button></div>
          <div class="album-grid"><button v-for="album in albums.slice(0, 6)" :key="album.id" class="album-item" @click="openAlbum(album)"><img :src="album.cover || placeholder" :alt="album.name"><strong>{{ album.name }}</strong><span>{{ album.artist }}</span></button></div>
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
      <div class="now-playing"><img :src="current && current.cover || placeholder" alt=""><div class="track-meta"><strong>{{ current ? current.title : '选择一首歌曲开始播放' }}</strong><span>{{ current ? current.artist : '你的音乐，由你掌控' }}</span></div><button class="icon-button player-favorite" :class="{ liked: current && favorites.includes(current.id) }" :title="current && favorites.includes(current.id) ? '取消收藏' : '收藏歌曲'" :disabled="!current" @click="current && toggleFavorite(current)">{{ current && favorites.includes(current.id) ? '♥' : '♡' }}</button></div>
      <div class="playback"><div class="transport">
        <button class="icon-button" :title="shuffle ? '关闭随机播放' : '随机播放'" :class="{ selected: shuffle }" aria-label="随机播放" @click="shuffle = !shuffle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg></button>
        <button class="icon-button" title="上一首" aria-label="上一首" @click="previous"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="icon-fill" d="M7 5h2v14H7zM18 6v12l-8-6z"/></svg></button>
        <button class="play-button" :title="isPlaying ? '暂停' : '播放'" :aria-label="isPlaying ? '暂停' : '播放'" @click="togglePlay"><svg v-if="isPlaying" viewBox="0 0 24 24" aria-hidden="true"><path class="icon-fill" d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg><svg v-else viewBox="0 0 24 24" aria-hidden="true"><path class="icon-fill" d="m8 5 11 7-11 7z"/></svg></button>
        <button class="icon-button" title="下一首" aria-label="下一首" @click="next"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="icon-fill" d="M15 5h2v14h-2zM6 6v12l8-6z"/></svg></button>
        <button class="icon-button" :title="repeat === 'one' ? '单曲循环' : '列表循环'" :class="{ selected: repeat === 'one' }" aria-label="切换循环模式" @click="repeat = repeat === 'all' ? 'one' : 'all'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/><text v-if="repeat === 'one'" x="12" y="15">1</text></svg></button>
      </div><div class="progress-row"><span>{{ formatTime(position) }}</span><input v-model.number="position" type="range" min="0" :max="duration || 1" @input="seek"><span>{{ formatTime(duration) }}</span></div></div>
      <div class="player-extras"><button class="icon-button queue-button" title="播放队列" @click="queueOpen = !queueOpen">☷<span v-if="queue.length" class="queue-count">{{ queue.length }}</span></button><span class="volume-icon">◖</span><input v-model.number="volume" aria-label="音量" type="range" min="0" max="1" step="0.01" @input="setVolume"></div>
      <div v-if="queueOpen" class="queue-popover"><div class="queue-head"><strong>播放队列</strong><button class="icon-button" @click="queueOpen = false">×</button></div><div v-for="(track, i) in queue" :key="track.id + i" class="queue-row" @click="playAt(i)"><span>{{ i + 1 }}</span><div><strong>{{ track.title }}</strong><small>{{ track.artist }}</small></div><button class="icon-button" title="从队列移除" @click.stop="queue.splice(i, 1)">×</button></div><div v-if="!queue.length" class="queue-empty">队列为空</div></div>
    </footer>
    <audio ref="audio" @timeupdate="syncTime" @loadedmetadata="syncDuration" @ended="onEnded" @play="isPlaying = true" @pause="isPlaying = false" @error="audioError"></audio>
    <div v-if="showPlaylistDialog" class="modal-backdrop" @click.self="showPlaylistDialog = false"><form class="modal" @submit.prevent="savePlaylist"><div class="modal-title"><h2>新建歌单</h2><button type="button" class="icon-button" @click="showPlaylistDialog = false">×</button></div><label>歌单名称<input v-model="playlistName" autofocus maxlength="120" placeholder="给歌单起个名字"></label><div class="modal-actions"><button type="button" class="secondary-button" @click="showPlaylistDialog = false">取消</button><button class="primary-button" :disabled="!playlistName.trim()">创建歌单</button></div></form></div>
  </div>
</template>

<script>
import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 12000 })
const placeholder = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23252822"/%3E%3Ctext x="50%25" y="57%25" text-anchor="middle" font-size="32" fill="%2395ad70"%3E♫%3C/text%3E%3C/svg%3E'

const SongTable = {
  props: ['songs', 'currentId', 'favorites', 'showRemove', 'playlists'],
  template: `<div class="song-table"><div class="song-head"><span>#</span><span>标题</span><span>专辑</span><span>时长</span><span></span></div><div v-for="(song, index) in songs" :key="song.id" class="song-row" :class="{ playing: currentId === song.id }" @dblclick="$emit('play', song)"><span class="song-index"><span class="index-number">{{ String(index + 1).padStart(2, '0') }}</span><button class="row-play" title="播放" @click="$emit('play', song)">▶</button></span><div class="song-title"><img :src="song.cover || placeholder" alt=""><div><strong>{{ song.title }}</strong><span>{{ song.artist }}</span></div></div><span class="song-album">{{ song.album }}</span><span class="song-duration">{{ formatTime(song.duration) }}</span><div class="row-actions"><button class="icon-button" :class="{ liked: favorites.includes(song.id) }" :title="favorites.includes(song.id) ? '取消收藏' : '收藏歌曲'" @click="$emit('favorite', song)">{{ favorites.includes(song.id) ? '♥' : '♡' }}</button><button v-if="playlists.length" class="icon-button" title="添加到歌单" @click="$emit('add', song)">＋</button><button v-if="showRemove" class="icon-button" title="从歌单移除" @click="$emit('remove', song)">−</button><button class="icon-button" title="加入播放队列" @click="$emit('queue', song)">⋯</button></div></div></div>`,
  data: () => ({ placeholder }),
  methods: { formatTime(value) { const seconds = Number(value || 0); return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` } }
}

export default {
  components: { SongTable },
  data() { return { view: 'home', query: '', songs: [], albums: [], playlists: [], favorites: [], playlistSongs: [], current: null, queue: [], queueOpen: false, queueIndex: -1, isPlaying: false, shuffle: false, repeat: 'all', volume: 0.72, position: 0, duration: 0, loading: false, connected: false, error: '', showPlaylistDialog: false, playlistName: '', activePlaylist: null, selectedAlbum: null, searchTimer: null, placeholder } },
  computed: {
    pageTitle() { if (this.view === 'favorites') return '喜欢的音乐'; if (this.view === 'albums') return '专辑'; if (this.view.startsWith('playlist:')) return this.activePlaylist?.name || '我的歌单'; if (this.view === 'album') return this.selectedAlbum?.name || '专辑'; return '你好，音乐爱好者' },
    greeting() { const h = new Date().getHours(); return h < 11 ? '早上好' : h < 18 ? '下午好' : '晚上好' }
  },
  created() { this.loadHome(); this.loadPlaylists(); this.loadFavorites(); this.loadView = this.loadHome; window.addEventListener('keydown', this.keyboard) },
  beforeDestroy() { window.removeEventListener('keydown', this.keyboard); clearTimeout(this.searchTimer) },
  watch: { view() { this.query = ''; this.loadViewData() } },
  methods: {
    async request(path, options) { const { data } = await api({ url: path, ...options }); return data },
    async loadHome() { this.loading = true; this.error = ''; try { const [recommendations, albumResult, favoriteResult] = await Promise.all([this.request('/recommendations'), this.request('/albums'), this.request('/favorites')]); this.songs = recommendations.songs; this.albums = albumResult.albums; this.favorites = favoriteResult.ids; this.connected = true } catch (error) { this.error = error.response?.data?.error || '请检查后台服务、数据库和音乐库配置'; this.connected = false } finally { this.loading = false } },
    async loadPlaylists() { try { this.playlists = (await this.request('/playlists')).playlists } catch (e) { this.error ||= '无法读取歌单，请检查数据库连接' } },
    async loadFavorites() { try { this.favorites = (await this.request('/favorites')).ids } catch (e) { /* connection is reported in the library state */ } },
    async loadViewData() { if (this.view === 'home' || this.view === 'albums') { if (!this.songs.length) this.loadHome(); return } try { if (this.view === 'favorites') { this.songs = (await this.request('/favorites/songs')).songs; return } if (this.view === 'album' && this.selectedAlbum) { this.songs = (await this.request(`/albums/${encodeURIComponent(this.selectedAlbum.id)}/songs`)).songs; return } if (this.view.startsWith('playlist:')) { const id = this.view.split(':')[1]; this.songs = (await this.request(`/playlists/${id}/tracks`)).songs; return } } catch (error) { this.error = error.response?.data?.error || '读取内容失败' } },
    onSearch() { clearTimeout(this.searchTimer); const q = this.query.trim(); if (!q) { this.loadViewData(); return } this.searchTimer = setTimeout(async () => { this.loading = true; try { this.songs = (await this.request('/search', { params: { q } })).songs; this.error = '' } catch (error) { this.error = error.response?.data?.error || '搜索失败' } finally { this.loading = false } }, 250) },
    async toggleFavorite(song) { const liked = this.favorites.includes(song.id); try { await api({ url: `/favorites/${encodeURIComponent(song.id)}`, method: liked ? 'delete' : 'put' }); this.favorites = liked ? this.favorites.filter(id => id !== song.id) : [...this.favorites, song.id] } catch (error) { this.error = '收藏更新失败，请检查数据库连接' } },
    playSong(song) { this.queue = [...this.songs]; this.queueIndex = this.queue.findIndex(item => item.id === song.id); if (this.queueIndex < 0) { this.queue.unshift(song); this.queueIndex = 0 } this.startCurrent(song) },
    startCurrent(song) { this.current = song; this.position = 0; this.duration = song.duration || 0; this.$nextTick(() => { const audio = this.$refs.audio; audio.src = song.stream; audio.volume = this.volume; audio.play().then(() => api.post(`/history/${encodeURIComponent(song.id)}`)).catch(() => { this.isPlaying = false; this.error = '无法播放此歌曲，请检查音乐库和账号权限' }) }) },
    playAll(list) { if (!list.length) return; this.queue = [...list]; this.queueIndex = this.shuffle ? Math.floor(Math.random() * this.queue.length) : 0; this.startCurrent(this.queue[this.queueIndex]) },
    queueSong(song) { if (!this.queue.some(item => item.id === song.id)) this.queue.push(song) },
    playAt(index) { this.queueIndex = index; this.startCurrent(this.queue[index]); this.queueOpen = false },
    next() { if (!this.queue.length) return; this.queueIndex = this.shuffle ? Math.floor(Math.random() * this.queue.length) : (this.queueIndex + 1) % this.queue.length; this.startCurrent(this.queue[this.queueIndex]) },
    previous() { if (this.position > 3) { this.$refs.audio.currentTime = 0; return } if (!this.queue.length) return; this.queueIndex = (this.queueIndex - 1 + this.queue.length) % this.queue.length; this.startCurrent(this.queue[this.queueIndex]) },
    onEnded() { if (this.repeat === 'one') { this.$refs.audio.currentTime = 0; this.$refs.audio.play() } else this.next() },
    togglePlay() { if (!this.current) return; if (this.isPlaying) this.$refs.audio.pause(); else this.$refs.audio.play().catch(() => { this.error = '播放失败，请检查音乐库连接' }) },
    seek() { if (this.$refs.audio) this.$refs.audio.currentTime = this.position },
    syncTime() { this.position = this.$refs.audio.currentTime || 0 }, syncDuration() { this.duration = this.$refs.audio.duration || this.current?.duration || 0 }, setVolume() { this.$refs.audio.volume = this.volume },
    audioError() { if (this.current) this.error = '音频流不可用，请确认音乐库已启动并完成歌曲扫描' },
    formatTime(value) { const seconds = Number(value || 0); return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` },
    createPlaylist() { this.playlistName = ''; this.showPlaylistDialog = true },
    async savePlaylist() { try { await this.request('/playlists', { method: 'post', data: { name: this.playlistName } }); this.showPlaylistDialog = false; await this.loadPlaylists() } catch (error) { this.error = error.response?.data?.error || '创建歌单失败' } },
    openPlaylist(list) { this.activePlaylist = list; this.view = `playlist:${list.id}` },
    async deletePlaylist(list) { if (!window.confirm(`删除歌单“${list.name}”？歌曲文件不会被删除。`)) return; try { await api.delete(`/playlists/${list.id}`); this.activePlaylist = null; this.view = 'home'; await this.loadPlaylists() } catch (error) { this.error = '删除歌单失败' } },
    async removeFromPlaylist(song) { const id = this.view.split(':')[1]; await api.delete(`/playlists/${id}/songs/${encodeURIComponent(song.id)}`); this.loadViewData(); this.loadPlaylists() },
    async addToPlaylist(song) { if (!this.playlists.length) return; const choices = this.playlists.map((list, index) => `${index + 1}. ${list.name}`).join('\n'); const choice = Number(window.prompt(`添加到哪个歌单？\n${choices}`)); const list = this.playlists[choice - 1]; if (!list) return; try { await api.put(`/playlists/${list.id}/songs/${encodeURIComponent(song.id)}`); await this.loadPlaylists() } catch (error) { this.error = '添加歌曲失败' } },
    async openAlbum(album) { this.selectedAlbum = album; this.view = 'album'; try { this.songs = (await this.request(`/albums/${encodeURIComponent(album.id)}/songs`)).songs } catch (error) { this.error = '无法读取专辑歌曲' } },
    keyboard(event) { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.querySelector('.search-box input').focus() } else if (event.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); this.togglePlay() } }
  }
}
</script>
