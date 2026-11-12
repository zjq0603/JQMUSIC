const test = require('node:test')
const assert = require('node:assert/strict')
const { createAppleMusicClient, mapSong } = require('../appleMusic')

test('maps Apple Music catalog songs without exposing a direct audio URL', () => {
  const song = mapSong({ id: '123', attributes: { name: '歌曲', artistName: '歌手', albumName: '专辑', durationInMillis: 205000, artwork: { url: 'https://img/{w}x{h}.jpg' }, url: 'https://music.apple.com/song/123' } })
  assert.equal(song.id, 'apple:123')
  assert.equal(song.stream, '')
  assert.equal(song.appleMusic, true)
  assert.equal(song.duration, 205)
  assert.equal(song.cover, 'https://img/300x300.jpg')
})

test('reports missing Apple Music developer configuration', () => {
  const client = createAppleMusicClient({})
  assert.equal(client.status().configured, false)
  assert.deepEqual(client.status().missing, ['teamId', 'keyId', 'privateKeyPath'])
  assert.throws(() => client.token(), /尚未配置/)
})
