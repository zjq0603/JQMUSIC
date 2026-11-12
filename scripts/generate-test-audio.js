const fs = require('fs')
const path = require('path')

const sampleRate = 44100
const durationSeconds = 8
const channels = 2
const bitsPerSample = 16
const sampleCount = sampleRate * durationSeconds
const dataSize = sampleCount * channels * (bitsPerSample / 8)
const output = Buffer.alloc(44 + dataSize)

output.write('RIFF', 0)
output.writeUInt32LE(36 + dataSize, 4)
output.write('WAVE', 8)
output.write('fmt ', 12)
output.writeUInt32LE(16, 16)
output.writeUInt16LE(1, 20)
output.writeUInt16LE(channels, 22)
output.writeUInt32LE(sampleRate, 24)
output.writeUInt32LE(sampleRate * channels * bitsPerSample / 8, 28)
output.writeUInt16LE(channels * bitsPerSample / 8, 32)
output.writeUInt16LE(bitsPerSample, 34)
output.write('data', 36)
output.writeUInt32LE(dataSize, 40)

const notes = [261.63, 329.63, 392.00]
for (let i = 0; i < sampleCount; i += 1) {
  const time = i / sampleRate
  const fade = Math.min(1, time / 0.5, (durationSeconds - time) / 0.8)
  const pulse = 0.82 + 0.18 * Math.sin(2 * Math.PI * 0.35 * time)
  const mixed = notes.reduce((sum, frequency, index) => {
    return sum + Math.sin(2 * Math.PI * frequency * time + index * 0.25)
  }, 0) / notes.length
  const value = Math.round(Math.max(-1, Math.min(1, mixed * fade * pulse * 0.28)) * 32767)
  const offset = 44 + i * channels * 2
  output.writeInt16LE(value, offset)
  output.writeInt16LE(value, offset + 2)
}

const destination = path.resolve(__dirname, '../music/JQMusic-播放测试.wav')
fs.mkdirSync(path.dirname(destination), { recursive: true })
fs.writeFileSync(destination, output)
console.log(destination)
