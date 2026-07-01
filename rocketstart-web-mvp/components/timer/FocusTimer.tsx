'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { WhiteNoisePlayer } from './WhiteNoisePlayer'

const presets = [
  { label: '15분 최소 시작', minutes: 15 },
  { label: '25분 기본', minutes: 25 },
  { label: '50분 깊은 작업', minutes: 50 }
]

export function FocusTimer() {
  const [minutes, setMinutes] = useState(25)
  const [remaining, setRemaining] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const startedAtRef = useRef<Date | null>(null)

  useEffect(() => {
    setRemaining(minutes * 60)
    setRunning(false)
    startedAtRef.current = null
  }, [minutes])

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          setRunning(false)
          return 0
        }
        return value - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [running])

  const label = useMemo(() => {
    const min = Math.floor(remaining / 60).toString().padStart(2, '0')
    const sec = (remaining % 60).toString().padStart(2, '0')
    return `${min}:${sec}`
  }, [remaining])

  function start() {
    startedAtRef.current = new Date()
    setRunning(true)
  }

  function finishEarly() {
    setRunning(false)
    const actualMinutes = Math.max(1, Math.round((minutes * 60 - remaining) / 60))
    window.alert(`세션 기록 후보: ${actualMinutes}분. 다음 단계에서 focus_sessions에 저장합니다.`)
  }

  return (
    <div className="grid">
      <div className="card stack">
        <h2>{label}</h2>
        <div className="row" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          {presets.map((preset) => (
            <button key={preset.minutes} className="button secondary" onClick={() => setMinutes(preset.minutes)}>{preset.label}</button>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <button className="button" onClick={start} disabled={running}>시작</button>
          <button className="button secondary" onClick={() => setRunning(false)}>멈춤</button>
          <button className="button secondary" onClick={finishEarly}>세션 기록</button>
        </div>
        <p className="muted">MVP 2단계에서 이 기록은 focus_sessions 테이블에 저장됩니다.</p>
      </div>
      <WhiteNoisePlayer />
    </div>
  )
}
