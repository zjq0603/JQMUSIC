const test = require('node:test')
const assert = require('node:assert/strict')
const { mapSong } = require('../navidrome')

test('maps Subsonic song metadata to the local player format', () => {
  const song = mapSong({ id: 'a/1', title: 'Song', artist: 'Artist', album: 'Album', duration: 184, coverArt: 'cover/2' })
  assert.deepEqual(song, {
    id: 'a/1', title: 'Song', artist: 'Artist', album: 'Album', duration: 184,
    cover: '/api/cover/cover%2F2', stream: '/api/stream/a%2F1', source: 'Navidrome', type: 'LOCAL'
  })
})

test('fills missing Subsonic text fields with readable defaults', () => {
  const song = mapSong({ id: '42' })
  assert.equal(song.title, '未知曲目')
  assert.equal(song.artist, '未知艺术家')
  assert.equal(song.album, '未知专辑')
  assert.equal(song.cover, '')
  assert.equal(song.duration, 0)
})
