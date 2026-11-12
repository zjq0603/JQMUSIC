const axios = require('axios')
const crypto = require('crypto')

function mapSong(song) {
  return {
    id: song.id, title: song.title || '未知曲目', artist: song.artist || '未知艺术家', album: song.album || '未知专辑',
    duration: song.duration || 0, cover: song.coverArt ? `/api/cover/${encodeURIComponent(song.coverArt)}` : '',
    stream: `/api/stream/${encodeURIComponent(song.id)}`,
    source: 'Navidrome', type: 'LOCAL'
  }
}

function createSubsonicClient(config) {
  const baseURL = `${config.url.replace(/\/$/, '')}/rest`
  const salt = crypto.randomBytes(8).toString('hex')
  const token = crypto.createHash('md5').update(`${config.password}${salt}`).digest('hex')
  const params = { u: config.username, t: token, s: salt, v: '1.16.1', c: config.client || 'jqmusic', f: 'json' }
  const http = axios.create({ baseURL, timeout: 10000, params })
  async function call(method, args = {}) {
    const { data } = await http.get(`/${method}.view`, { params: args })
    const response = data['subsonic-response']
    if (!response || response.status !== 'ok') throw new Error(response?.error?.message || 'Navidrome 返回了无效响应')
    return response
  }
  async function proxy(method, id, req, res) {
    try {
      const response = await http.get(`/${method}.view`, { params: { ...params, id }, headers: req.headers.range ? { Range: req.headers.range } : {}, responseType: 'stream' })
      res.status(response.status)
      res.set('Content-Type', response.headers['content-type'] || 'application/octet-stream')
      for (const name of ['content-length', 'content-range', 'accept-ranges']) if (response.headers[name]) res.set(name, response.headers[name])
      response.data.on('error', error => { console.error(`[${new Date().toISOString()}] Navidrome stream: ${error.message}`); res.destroy(error) })
      response.data.pipe(res)
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Navidrome ${method}: ${error.message}`)
      if (!res.headersSent) res.status(502).json({ error: 'Navidrome 音频资源暂不可用' })
      else res.destroy(error)
    }
  }
  return {
    async search(query) {
      const result = await call('search3', { query, songCount: 100, albumCount: 0, artistCount: 0 })
      return (result.searchResult3?.song || []).map(mapSong)
    },
    async random() {
      const result = await call('getRandomSongs', { size: 20 })
      return (result.randomSongs?.song || []).map(mapSong)
    },
    async albums() {
      const result = await call('getAlbumList2', { type: 'recent', size: 30 })
      return (result.albumList2?.album || []).map(a => ({ id: a.id, name: a.name, artist: a.artist || '', cover: a.coverArt ? `/api/cover/${encodeURIComponent(a.coverArt)}` : '' }))
    },
    async album(id) {
      const result = await call('getAlbum', { id })
      return (result.album?.song || []).map(mapSong)
    },
    async song(id) {
      const result = await call('getSong', { id })
      return result.song ? mapSong(result.song) : null
    },
    async lyrics(artist, title) {
      const result = await call('getLyrics', { artist, title })
      return result.lyrics || null
    },
    async resolve(ids) {
      const songs = await Promise.all(ids.slice(0, 100).map(id => this.song(id)))
      return songs.filter(Boolean)
    },
    stream(id, req, res) { return proxy('stream', id, req, res) },
    cover(id, req, res) { return proxy('getCoverArt', id, req, res) },
    async ping() { await call('ping'); return true }
  }
}

module.exports = { createSubsonicClient, mapSong }
