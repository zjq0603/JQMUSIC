const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')
const { createSubsonicClient } = require('./navidrome')

const localConfigPath = path.resolve(process.cwd(), 'config.json')
const configPath = fs.existsSync(localConfigPath) ? localConfigPath : path.resolve(process.cwd(), 'config.example.json')
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))
let pool
const library = createSubsonicClient(config.navidrome)

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}
function apiError(res, error, status = 502) {
  console.error(`[${new Date().toISOString()}] ${error.message}`)
  res.status(status).json({ error: error.message || '服务暂时不可用' })
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
app.get('/api/recommendations', asyncRoute(async (req, res) => res.json({ songs: await library.random() })))
app.get('/api/albums', asyncRoute(async (req, res) => res.json({ albums: await library.albums() })))
app.get('/api/albums/:id/songs', asyncRoute(async (req, res) => res.json({ songs: await library.album(req.params.id) })))
app.get('/api/stream/:id', (req, res) => library.stream(req.params.id, req, res))
app.get('/api/cover/:id', (req, res) => library.cover(req.params.id, req, res))

app.get('/api/favorites', asyncRoute(async (req, res) => {
  const [rows] = await pool.query('SELECT song_id FROM music_favorite ORDER BY created_at DESC')
  res.json({ ids: rows.map(row => row.song_id) })
}))
app.get('/api/favorites/songs', asyncRoute(async (req, res) => {
  const [rows] = await pool.query('SELECT song_id FROM music_favorite ORDER BY created_at DESC')
  res.json({ songs: await library.resolve(rows.map(row => row.song_id)) })
}))
app.put('/api/favorites/:songId', asyncRoute(async (req, res) => {
  const songId = String(req.params.songId).slice(0, 100)
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
  res.json({ songs: await library.resolve(rows.map(row => row.song_id)) })
}))
app.put('/api/playlists/:id/songs/:songId', asyncRoute(async (req, res) => {
  await pool.execute('INSERT IGNORE INTO music_playlist_song (playlist_id, song_id, position) VALUES (?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM (SELECT position FROM music_playlist_song WHERE playlist_id = ?) p))', [req.params.id, req.params.songId, req.params.id])
  res.status(204).end()
}))
app.delete('/api/playlists/:id/songs/:songId', asyncRoute(async (req, res) => {
  await pool.execute('DELETE FROM music_playlist_song WHERE playlist_id = ? AND song_id = ?', [req.params.id, req.params.songId])
  res.status(204).end()
}))
app.post('/api/history/:songId', asyncRoute(async (req, res) => {
  await pool.execute('INSERT INTO music_play_history (song_id) VALUES (?)', [req.params.songId])
  res.status(204).end()
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
