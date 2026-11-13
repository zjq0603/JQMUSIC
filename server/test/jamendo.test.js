const test = require('node:test')
const assert = require('node:assert/strict')
const { createJamendoClient, normalizeTrack } = require('../jamendo')

test('normalizes Jamendo tracks and retains their source and license details', () => {
  const song = normalizeTrack({
    id: 123,
    name: 'Track',
    artist_name: 'Artist',
    album_name: 'Album',
    duration: 187,
    image: 'https://img.example/cover.jpg',
    audio: 'https://audio.example/track.mp3',
    license_ccurl: 'https://creativecommons.org/licenses/by/4.0/'
  })
  assert.deepEqual(song, {
    id: 'jamendo:123', title: 'Track', artist: 'Artist', album: 'Album', duration: 187,
    cover: 'https://img.example/cover.jpg', stream: 'https://audio.example/track.mp3',
    source: 'Jamendo', sourcePlatformId: '123', type: 'ONLINE', licenseType: 'BY/4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/'
  })
})

test('rejects tracks without a numeric ID or playable audio URL', () => {
  assert.equal(normalizeTrack({ id: 'abc', audio: 'https://audio.example/a.mp3' }), null)
  assert.equal(normalizeTrack({ id: 123 }), null)
})

test('reports missing local Jamendo client ID without making a network request', async () => {
  const client = createJamendoClient({})
  await assert.rejects(client.search('jazz'), error => error.status === 503 && /client_id/.test(error.message))
  await assert.rejects(client.popular({ offset: 30, limit: 30 }), error => error.status === 503 && /client_id/.test(error.message))
})
