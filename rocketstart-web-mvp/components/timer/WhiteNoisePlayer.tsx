'use client'

import { useRef, useState } from 'react'

type NoiseType = 'white' | 'brown' | 'rain' | 'cafe' | 'silent'

export function WhiteNoisePlayer() {
  const [noiseType, setNoiseType] = useState<NoiseType>('white')
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)

  function createNoiseBuffer(context: AudioContext, type: NoiseType) {
    const seconds = 2
    const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1
      if (type === 'brown') {
        last = (last + 0.02 * white) / 1.02
        data[i] = last * 3.5
      } else if (type === 'rain') {
        data[i] = white * (Math.random() > 0.985 ? 0.8 : 0.18)
      } else if (type === 'cafe') {
        data[i] = white * 0.08 + Math.sin(i / 180) * 0.03
      } else {
        data[i] = white * 0.16
      }
    }
    return buffer
  }

  function start() {
    if (noiseType === 'silent') return
    stop()
    const context = new AudioContext()
    const source = context.createBufferSource()
    const gain = context.createGain()
    gain.gain.value = 0.18
    source.buffer = createNoiseBuffer(context, noiseType)
    source.loop = true
    source.connect(gain).connect(context.destination)
    source.start()
    audioRef.current = context
    sourceRef.current = source
    setPlaying(true)
  }

  function stop() {
    sourceRef.current?.stop()
    audioRef.current?.close()
    sourceRef.current = null
    audioRef.current = null
    setPlaying(false)
  }

  return (
    <div className="card stack">
      <h2>백색소음</h2>
      <select className="select" value={noiseType} onChange={(event) => setNoiseType(event.target.value as NoiseType)}>
        <option value="white">화이트 노이즈</option>
        <option value="brown">브라운 노이즈</option>
        <option value="rain">빗소리 느낌</option>
        <option value="cafe">카페 소리 느낌</option>
        <option value="silent">무음</option>
      </select>
      <div className="row" style={{ justifyContent: 'flex-start' }}>
        <button className="button" onClick={start} disabled={playing}>재생</button>
        <button className="button secondary" onClick={stop}>정지</button>
      </div>
      <p className="muted">초기 MVP에서는 외부 음원 없이 Web Audio API로 간단한 노이즈를 생성합니다.</p>
    </div>
  )
}
