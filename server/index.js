const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
const { createSubsonicClient } = require('./navidrome')
const { createJamendoClient } = require('./jamendo')
const { createAppleMusicClient } = require('./appleMusic')
const { searchITunes } = require('./itunes')

const localConfigPath = path.resolve(process.cwd(), 'config.json')
const configPath = fs.existsSync(localConfigPath) ? localConfigPath : path.resolve(process.cwd(), 'config.example.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))
let pool
const library = createSubsonicClient(config.navidrome)
const jamendo = createJamendoClient(config.jamendo)
const appleMusic = createAppleMusicClient(config.appleMusic)

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}
function apiError(res, error, status = 502) {
  console.error(`[${new Date().toISOString()}] ${error.message}`)
  res.status(error.status || status).json({ error: error.message || '服务暂时不可用' })
}

function mapStoredSong(row) {
  return {
    id: row.id, title: row.title, artist: row.artist_name || '未知艺术家', album: row.album_name || '单曲',
    duration: row.duration || 0, cover: row.cover_url || '', stream: row.audio_url || '',
    source: row.source_name, sourcePlatformId: row.source_platform_id, type: row.source_type,
    licenseType: row.license_type || '', licenseUrl: row.license_url || '', appleMusic: row.source_name === 'Apple Music'
  }
}

async function saveSong(song, connection = pool) {
  await connection.execute(
    `INSERT INTO music_song (id, title, artist_name, album_name, cover_url, audio_url, source_type, source_name, source_platform_id, duration, license_type, license_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), artist_name = VALUES(artist_name), album_name = VALUES(album_name), cover_url = VALUES(cover_url), audio_url = VALUES(audio_url), source_type = VALUES(source_type), source_name = VALUES(source_name), source_platform_id = VALUES(source_platform_id), duration = VALUES(duration), license_type = VALUES(license_type), license_url = VALUES(license_url)`,
    [song.id, song.title, song.artist || '', song.album || '', song.cover || '', song.stream || '', song.type || 'LOCAL', song.source || 'Navidrome', song.sourcePlatformId || song.id, song.duration || 0, song.licenseType || '', song.licenseUrl || '']
  )
}

async function resolveSongs(ids) {
  if (!ids.length) return []
  const placeholders = ids.map(() => '?').join(',')
  const [rows] = await pool.query(`SELECT * FROM music_song WHERE id IN (${placeholders})`, ids)
  const stored = new Map(rows.map(row => [row.id, mapStoredSong(row)]))
  const missing = ids.filter(id => !stored.has(id) && !String(id).startsWith('jamendo:'))
  const legacySongs = await Promise.all(missing.map(id => library.song(id).catch(() => null)))
  for (const song of legacySongs.filter(Boolean)) stored.set(song.id, song)
  return ids.map(id => stored.get(id)).filter(Boolean)
}

app.get('/api/health', asyncRoute(async (req, res) => {
  await pool.query('SELECT 1')
  await library.ping()
  res.json({ ok: true, library: 'Navidrome' })
}))
app.get('/api/search', asyncRoute(async (req, res) => {
  const q = String(req.query.q || '').trim()
  if (!q) return res.json({ songs: [] })
  if (q.length > 200) return res.status(400).json({ error: '搜索内容不能超过 200 个字符' })
  res.json({ songs: await library.search(q) })
}))
app.get('/api/recommendations', asyncRoute(async (req, res) => {
  const [local, online] = await Promise.allSettled([library.random(), jamendo.recommendations()])
  const localSongs = local.status === 'fulfilled' ? local.value : []
  const onlineSongs = online.status === 'fulfilled' ? online.value : []
  const songs = [...new Map([...localSongs, ...onlineSongs].map(song => [song.id, song])).values()]
  if (!songs.length) throw local.reason || online.reason || new Error('暂时没有可推荐的歌曲')
  res.json({ songs })
}))
app.get('/api/albums', asyncRoute(async (req, res) => res.json({ albums: await library.albums() })))
app.get('/api/albums/:id/songs', asyncRoute(async (req, res) => res.json({ songs: await library.album(req.params.id) })))
app.get('/api/jamendo/search', asyncRoute(async (req, res) => {
  const q = String(req.query.q || '').trim()
  if (q.length < 2) return res.status(400).json({ error: '请输入至少 2 个字符进行搜索' })
  if (q.length > 120) return res.status(400).json({ error: '搜索内容不能超过 120 个字符' })
  const pattern = `%${q}%`
  const [rows] = await pool.execute(
    'SELECT * FROM music_song WHERE source_type = \'ONLINE\' AND source_name = \'Jamendo\' AND (title LIKE ? OR artist_name LIKE ? OR album_name LIKE ?) ORDER BY title LIMIT 50',
    [pattern, pattern, pattern]
  )
  const savedSongs = rows.map(mapStoredSong)
  let remoteSongs = []
  try {
    remoteSongs = await jamendo.search(q)
  } catch (error) {
    if (!savedSongs.length) throw error
    console.warn(`[${new Date().toISOString()}] Jamendo API search unavailable; returning saved matches: ${error.message}`)
  }
  const songsById = new Map([...savedSongs, ...remoteSongs].map(song => [song.id, song]))
  res.json({ songs: [...songsById.values()] })
}))
app.get('/api/jamendo/status', (req, res) => res.json({ configured: Boolean(config.jamendo?.clientId) }))
app.get('/api/apple-music/status', (req, res) => res.json(appleMusic.status()))
app.get('/api/apple-music/token', asyncRoute(async (req, res) => res.json({ developerToken: appleMusic.token(), storefront: appleMusic.status().storefront })))
app.get('/api/apple-music/search', asyncRoute(async (req, res) => {
  const q = String(req.query.q || '').trim()
  if (q.length < 2) return res.status(400).json({ error: '请输入至少 2 个字符进行搜索' })
  if (q.length > 120) return res.status(400).json({ error: '搜索内容不能超过 120 个字符' })
  res.json({ songs: await appleMusic.search(q) })
}))
app.get('/api/itunes/search', asyncRoute(async (req, res) => {
  const q = String(req.query.q || '').trim()
  if (q.length < 2) return res.status(400).json({ error: '请输入至少 2 个字符进行搜索' })
  if (q.length > 120) return res.status(400).json({ error: '搜索内容不能超过 120 个字符' })
  res.json({ songs: await searchITunes(q) })
}))
app.get('/api/jamendo/playlists/:id', asyncRoute(async (req, res) => {
  if (!/^\d{1,12}$/.test(req.params.id)) return res.status(400).json({ error: 'Jamendo 歌单编号无效' })
  const playlist = await jamendo.playlist(req.params.id)
  if (!playlist) return res.status(404).json({ error: '没有找到这个 Jamendo 歌单' })
  res.json({ playlist })
}))
app.get('/api/stream/:id', (req, res) => library.stream(req.params.id, req, res))
app.get('/api/cover/:id', (req, res) => library.cover(req.params.id, req, res))

app.get('/api/favorites', asyncRoute(async (req, res) => {
  const [rows] = await pool.query('SELECT song_id FROM music_favorite ORDER BY created_at DESC')
  res.json({ ids: rows.map(row => row.song_id) })
}))
app.get('/api/favorites/songs', asyncRoute(async (req, res) => {
  const [rows] = await pool.query('SELECT song_id FROM music_favorite ORDER BY created_at DESC')
  res.json({ songs: await resolveSongs(rows.map(row => row.song_id)) })
}))
app.put('/api/favorites/:songId', asyncRoute(async (req, res) => {
  const songId = String(req.params.songId).slice(0, 100)
  if (req.body?.song?.id === songId) await saveSong(req.body.song)
  await pool.execute('INSERT IGNORE INTO music_favorite (song_id) VALUES (?)', [songId])
  res.status(204).end()
}))
app.delete('/api/favorites/:songId', asyncRoute(async (req, res) => {
  await pool.execute('DELETE FROM music_favorite WHERE song_id = ?', [req.params.songId])
  res.status(204).end()
}))
app.get('/api/playlists', asyncRoute(async (req, res) => {
  const [rows] = await pool.query('SELECT p.id, p.name, p.updated_at AS updatedAt, COUNT(ps.song_id) AS songCount FROM music_playlist p LEFT JOIN music_playlist_song ps ON ps.playlist_id = p.id GROUP BY p.id ORDER BY p.updated_at DESC')
  res.json({ playlists: rows })
}))
app.post('/api/playlists', asyncRoute(async (req, res) => {
  const name = String(req.body.name || '').trim()
  if (!name || name.length > 120) return res.status(400).json({ error: '歌单名称需为 1 至 120 个字符' })
  const [result] = await pool.execute('INSERT INTO music_playlist (name) VALUES (?)', [name])
  res.status(201).json({ id: result.insertId, name, songCount: 0 })
}))
app.delete('/api/playlists/:id', asyncRoute(async (req, res) => {
  await pool.execute('DELETE FROM music_playlist WHERE id = ?', [req.params.id])
  res.status(204).end()
}))
app.get('/api/playlists/:id/songs', asyncRoute(async (req, res) => {
  const [rows] = await pool.execute('SELECT song_id AS id FROM music_playlist_song WHERE playlist_id = ? ORDER BY position, added_at', [req.params.id])
  res.json({ ids: rows.map(row => row.id) })
}))
app.get('/api/playlists/:id/tracks', asyncRoute(async (req, res) => {
  const [rows] = await pool.execute('SELECT song_id FROM music_playlist_song WHERE playlist_id = ? ORDER BY position, added_at', [req.params.id])
  res.json({ songs: await resolveSongs(rows.map(row => row.song_id)) })
}))
app.put('/api/playlists/:id/songs/:songId', asyncRoute(async (req, res) => {
  if (req.body?.song?.id === req.params.songId) await saveSong(req.body.song)
  await pool.execute('INSERT IGNORE INTO music_playlist_song (playlist_id, song_id, position) VALUES (?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM (SELECT position FROM music_playlist_song WHERE playlist_id = ?) p))', [req.params.id, req.params.songId, req.params.id])
  res.status(204).end()
}))
app.post('/api/playlists/:id/tracks', asyncRoute(async (req, res) => {
  const songs = req.body?.songs
  if (!Array.isArray(songs) || songs.length < 1 || songs.length > 100) return res.status(400).json({ error: '一次最多可导入 100 首歌曲' })
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const [[playlist]] = await connection.execute('SELECT id FROM music_playlist WHERE id = ?', [req.params.id])
    if (!playlist) {
      await connection.rollback()
      return res.status(404).json({ error: '没有找到目标歌单' })
    }
    for (const song of songs) {
      if (!song?.id || String(song.id).length > 100) throw new Error('歌单中包含无效歌曲')
      await saveSong(song, connection)
      await connection.execute('INSERT IGNORE INTO music_playlist_song (playlist_id, song_id, position) VALUES (?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM (SELECT position FROM music_playlist_song WHERE playlist_id = ?) p))', [req.params.id, song.id, req.params.id])
    }
    await connection.commit()
    res.json({ imported: songs.length })
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}))
app.delete('/api/playlists/:id/songs/:songId', asyncRoute(async (req, res) => {
  await pool.execute('DELETE FROM music_playlist_song WHERE playlist_id = ? AND song_id = ?', [req.params.id, req.params.songId])
  res.status(204).end()
}))
app.post('/api/history/:songId', asyncRoute(async (req, res) => {
  if (req.body?.song?.id === req.params.songId) await saveSong(req.body.song)
  await pool.execute('INSERT INTO music_play_history (song_id) VALUES (?)', [req.params.songId])
  res.status(204).end()
}))
app.get('/api/lyrics/:songId', asyncRoute(async (req, res) => {
  const songId = String(req.params.songId).slice(0, 100)
  const [[stored]] = await pool.execute('SELECT lyrics, source FROM music_lyrics WHERE song_id = ?', [songId])
  if (stored?.lyrics) return res.json({ lyrics: stored.lyrics, source: stored.source || '本地歌词' })
  const [[song]] = await pool.execute('SELECT id, title, artist_name, source_type FROM music_song WHERE id = ?', [songId])
  if (!song || song.source_type !== 'LOCAL') return res.json({ lyrics: '', source: '' })
  try {
    const lyrics = await library.lyrics(song.artist_name || '', song.title)
    const text = lyrics?.value || ''
    if (text) await pool.execute('INSERT INTO music_lyrics (song_id, lyrics, source) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE lyrics = VALUES(lyrics), source = VALUES(source)', [songId, text, 'Navidrome'])
    res.json({ lyrics: text, source: text ? 'Navidrome' : '' })
  } catch (error) {
    console.warn(`[${new Date().toISOString()}] Lyrics unavailable for ${songId}: ${error.message}`)
    res.json({ lyrics: '', source: '' })
  }
}))
app.get('/api/history', asyncRoute(async (req, res) => {
  const [rows] = await pool.query('SELECT song_id AS id, MAX(played_at) AS playedAt FROM music_play_history GROUP BY song_id ORDER BY playedAt DESC LIMIT 30')
  res.json({ ids: rows.map(row => row.id) })
}))

app.use(express.static(path.resolve(__dirname, '../dist')))
app.use((error, req, res, next) => apiError(res, error))
let server
async function start() {
  const bootstrapConfig = { ...config.mysql }
  delete bootstrapConfig.database
  const connection = await mysql.createConnection(bootstrapConfig)
  try {
    const schema = fs.readFileSync(path.resolve(__dirname, '../database/schema.sql'), 'utf8')
    for (const statement of schema.split(';').map(part => part.trim()).filter(Boolean)) await connection.query(statement)
  } finally {
    await connection.end()
  }
  pool = mysql.createPool({ ...config.mysql, waitForConnections: true, connectionLimit: config.mysql.connectionLimit || 10 })
  server = app.listen(config.server.port || 3000, config.server.host || '0.0.0.0', () => console.log(`JQ Music API listening on ${config.server.port || 3000}`))
}
start().catch(error => {
  console.error(`[${new Date().toISOString()}] Startup failed: ${error.message}`)
  process.exitCode = 1
})
async function shutdown() {
  if (server) server.close()
  if (pool) await pool.end()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
