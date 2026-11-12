const axios = require('axios')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

function base64url(value) {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')
}

function mapSong(item) {
  const attributes = item.attributes || {}
  const artwork = attributes.artwork?.url ? attributes.artwork.url.replace('{w}', '300').replace('{h}', '300') : ''
  return {
    id: `apple:${item.id}`,
    title: attributes.name || '未知曲目',
    artist: attributes.artistName || '未知艺术家',
    album: attributes.albumName || '单曲',
    duration: Math.round(Number(attributes.durationInMillis || 0) / 1000),
    cover: artwork,
    stream: '',
    source: 'Apple Music',
    sourcePlatformId: String(item.id),
    type: 'ONLINE',
    licenseType: 'Apple Music 订阅',
    licenseUrl: attributes.url || '',
    appleMusic: true
  }
}

function createAppleMusicClient(config = {}) {
  let cachedToken = ''
  let cachedUntil = 0

  function missingFields() {
    const missing = []
    if (!String(config.teamId || '').trim()) missing.push('teamId')
    if (!String(config.keyId || '').trim()) missing.push('keyId')
    if (!String(config.privateKeyPath || '').trim()) missing.push('privateKeyPath')
    else if (!fs.existsSync(path.resolve(process.cwd(), config.privateKeyPath))) missing.push('privateKeyFile')
    return missing
  }

  function token() {
    const missing = missingFields()
    if (missing.length) {
      const error = new Error(`Apple Music 尚未配置：${missing.join(', ')}`)
      error.status = 503
      throw error
    }
    const now = Math.floor(Date.now() / 1000)
    if (cachedToken && cachedUntil - now > 300) return cachedToken
    const lifetime = Math.min(Math.max(Number(config.tokenHours || 24) * 3600, 3600), 15777000)
    const payload = { iss: String(config.teamId).trim(), iat: now, exp: now + lifetime }
    const origins = Array.isArray(config.origins) ? config.origins.filter(Boolean) : []
    if (origins.length) payload.origin = origins
    const header = { alg: 'ES256', kid: String(config.keyId).trim(), typ: 'JWT' }
    const signingInput = `${base64url(header)}.${base64url(payload)}`
    const privateKey = fs.readFileSync(path.resolve(process.cwd(), config.privateKeyPath), 'utf8')
    const signature = crypto.sign('sha256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')
    cachedUntil = payload.exp
    cachedToken = `${signingInput}.${signature}`
    return cachedToken
  }

  return {
    status() { return { configured: missingFields().length === 0, missing: missingFields(), storefront: config.storefront || 'cn' } },
    token,
    async search(query) {
      const storefront = config.storefront || 'cn'
      const { data } = await axios.get(`https://api.music.apple.com/v1/catalog/${encodeURIComponent(storefront)}/search`, {
        timeout: 12000,
        headers: { Authorization: `Bearer ${token()}` },
        params: { term: query, types: 'songs', limit: 25, l: 'zh-Hans-CN' }
      })
      return (data.results?.songs?.data || []).map(mapSong)
    }
  }
}

module.exports = { createAppleMusicClient, mapSong }
