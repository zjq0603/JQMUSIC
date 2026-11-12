const axios = require('axios')

function mapTrack(track, storefront = 'CN') {
  if (!track?.trackId || !track.previewUrl) return null
  return {
    id: `itunes:${track.trackId}`,
    title: track.trackName || '未知曲目',
    artist: track.artistName || '未知艺术家',
    album: track.collectionName || '单曲',
    duration: 30,
    cover: String(track.artworkUrl100 || '').replace('100x100', '300x300'),
    stream: track.previewUrl,
    source: 'iTunes Store',
    sourcePlatformId: String(track.trackId),
    type: 'ONLINE',
    licenseType: '30 秒官方试听',
    licenseUrl: track.trackViewUrl || track.collectionViewUrl || '',
    previewOnly: true,
    storefront
  }
}

async function searchITunes(query) {
  for (const country of ['CN', 'HK', 'TW']) {
    const { data } = await axios.get('https://itunes.apple.com/search', {
      timeout: 12000,
      params: { term: query, country, media: 'music', entity: 'song', limit: 30, explicit: 'No', lang: 'zh_cn' }
    })
    const songs = (data.results || []).map(track => mapTrack(track, country)).filter(Boolean)
    if (songs.length) return songs
  }
  return []
}

module.exports = { searchITunes, mapTrack }
