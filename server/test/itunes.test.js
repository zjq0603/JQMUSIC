const test = require('node:test')
const assert = require('node:assert/strict')
const { mapTrack } = require('../itunes')

test('maps iTunes results as official preview-only tracks', () => {
  const song = mapTrack({ trackId: 1, trackName: '歌曲', artistName: '歌手', collectionName: '专辑', previewUrl: 'https://audio.example/preview.m4a', artworkUrl100: 'https://img/100x100.jpg', trackViewUrl: 'https://music.apple.com/cn/song/1' }, 'HK')
  assert.equal(song.id, 'itunes:1')
  assert.equal(song.duration, 30)
  assert.equal(song.previewOnly, true)
  assert.equal(song.licenseUrl, 'https://music.apple.com/cn/song/1')
  assert.equal(song.storefront, 'HK')
})

test('rejects iTunes tracks without an official preview URL', () => {
  assert.equal(mapTrack({ trackId: 1 }), null)
})
