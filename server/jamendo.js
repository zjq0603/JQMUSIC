const axios = require('axios')

const API_BASE = 'https://api.jamendo.com/v3.0'

function normalizeTrack(track) {
  const id = String(track.id || '')
  if (!/^\d+$/.test(id) || !track.audio) return null
  const licenseUrl = track.license_ccurl || ''
  const licenseType = licenseUrl ? licenseUrl.split('/licenses/')[1]?.replace(/\/$/, '').toUpperCase() || 'CC' : 'Jamendo'
  return {
    id: `jamendo:${id}`,
    title: track.name || '未知曲目',
    artist: track.artist_name || '未知艺术家',
    album: track.album_name || '单曲',
    duration: Number(track.duration) || 0,
    cover: track.image || track.album_image || '',
    stream: track.audio,
    source: 'Jamendo',
    sourcePlatformId: id,
    type: 'ONLINE',
    licenseType,
    licenseUrl
  }
}

function createJamendoClient(config = {}) {
  const clientId = String(config.clientId || '').trim()
  const http = axios.create({ baseURL: API_BASE, timeout: 12000 })

  async function request(path, params) {
    if (!clientId) {
      const error = new Error('尚未配置 Jamendo client_id，请在本机 config.json 中填写')
      error.status = 503
      throw error
    }
    const { data } = await http.get(path, { params: { client_id: clientId, format: 'json', ...params } })
    if (data?.headers?.status !== 'success' || data.headers.code !== 0) {
      throw new Error(data?.headers?.error_message || 'Jamendo 暂时无法提供音乐数据')
    }
    return data.results || []
  }

  return {
    async recommendations() {
      const topics = ['piano', 'jazz', 'classical', 'electronic']
      const search = topics[Math.floor(Math.random() * topics.length)]
      const results = await request('/tracks/', {
        search,
        limit: 12,
        type: 'single albumtrack',
        audioformat: 'mp32',
        imagesize: 150,
        include: 'licenses',
        order: 'popularity_total'
      })
      return results.map(normalizeTrack).filter(Boolean)
    },
    async search(query) {
      const results = await request('/tracks/', {
        search: query,
        limit: 50,
        type: 'single albumtrack',
        audioformat: 'mp32',
        imagesize: 150,
        include: 'licenses'
      })
      return results.map(normalizeTrack).filter(Boolean)
    },
    async playlist(id) {
      const results = await request('/playlists/tracks/', {
        id,
        limit: 1,
        track_type: 'single albumtrack',
        audioformat: 'mp32',
        imagesize: 150,
        order: 'track_position_asc'
      })
      const playlist = results[0]
      if (!playlist) return null
      return {
        id: String(playlist.id),
        name: playlist.name || 'Jamendo 歌单',
        owner: playlist.user_name || '',
        shareUrl: playlist.shareurl || '',
        songs: (playlist.tracks || []).map(normalizeTrack).filter(Boolean)
      }
    }
  }
}

module.exports = { createJamendoClient, normalizeTrack }
