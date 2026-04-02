import { useState, useEffect } from 'react'
import Cat from './components/Cat'
import TeamPanel from './components/TeamPanel'
import { useActivity } from './hooks/useActivity'
import { useTeamPresence } from './hooks/useTeamPresence'
import { CatState } from './types'

const states: CatState[] = ['idle', 'typing', 'clicking', 'scrolling', 'sleeping']

export default function App() {
  const activity = useActivity()
  const [manualState, setManualState] = useState<CatState | null>(null)
  const [memberName, setMemberName] = useState('')
  const [serverAddress, setServerAddress] = useState('')
  const [joined, setJoined] = useState(false)
  const [demoMode, setDemoMode] = useState(false)

  const isElectron = !!window.electronAPI
  const currentState = manualState ?? activity.state

  // Auto-detect server address in Electron
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getServerAddress().then((addr) => {
        setServerAddress(addr)
      })
    }
  }, [])

  const teamPresence = useTeamPresence(
    joined ? {
      memberName,
      serverAddress,
      localState: currentState,
      keyPressCount: activity.keyPressCount,
      mouseClickCount: activity.mouseClickCount
    } : null
  )

  const handleJoin = () => {
    if (memberName.trim() && serverAddress.trim()) {
      setJoined(true)
    }
  }

  const handleDemoToggle = () => {
    if (demoMode) {
      teamPresence.disableDemoMode()
      setDemoMode(false)
    } else {
      teamPresence.enableDemoMode()
      setDemoMode(true)
    }
  }

  // Join screen
  if (!joined) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontFamily: "'Segoe UI', sans-serif",
        background: '#f5f0eb',
        gap: 16
      }}>
        <div style={{ transform: 'scale(0.8)' }}>
          <Cat state="idle" />
        </div>
        <h1 style={{ fontSize: 28, color: '#444', margin: 0 }}>Team Neko</h1>
        <p style={{ color: '#888', fontSize: 13, margin: 0 }}>
          チームの活動をネコで可視化
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16, width: 280 }}>
          <input
            type="text"
            placeholder="あなたの名前"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: '2px solid #ddd',
              fontSize: 14,
              outline: 'none',
              textAlign: 'center'
            }}
          />
          <input
            type="text"
            placeholder="サーバーアドレス (ws://192.168.x.x:9876)"
            value={serverAddress}
            onChange={(e) => setServerAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: '2px solid #ddd',
              fontSize: 12,
              outline: 'none',
              textAlign: 'center'
            }}
          />
          <button
            onClick={handleJoin}
            disabled={!memberName.trim() || !serverAddress.trim()}
            style={{
              padding: '10px 24px',
              borderRadius: 12,
              border: 'none',
              background: memberName.trim() && serverAddress.trim() ? '#555' : '#ccc',
              color: '#fff',
              fontSize: 14,
              fontWeight: 'bold',
              cursor: memberName.trim() && serverAddress.trim() ? 'pointer' : 'default'
            }}
          >
            参加する
          </button>
        </div>

        {isElectron && serverAddress && (
          <p style={{ color: '#aaa', fontSize: 11, marginTop: 8 }}>
            サーバー: {serverAddress}
          </p>
        )}
      </div>
    )
  }

  // Main app view
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100vh',
      fontFamily: "'Segoe UI', sans-serif",
      background: '#f5f0eb',
      paddingTop: 24
    }}>
      <h1 style={{ fontSize: 24, color: '#444', marginBottom: 4 }}>Team Neko</h1>
      <p style={{ color: '#888', marginBottom: 16, fontSize: 13 }}>
        {currentState === 'idle' && 'のんびり中...'}
        {currentState === 'typing' && 'カタカタカタ...!'}
        {currentState === 'clicking' && 'カチカチ!'}
        {currentState === 'scrolling' && 'スクロールスクロール...'}
        {currentState === 'sleeping' && 'Zzz...すやすや'}
      </p>

      <Cat
        state={currentState}
        fast={activity.keyPressCount > 5}
      />

      {/* Team members */}
      {teamPresence.members.length > 0 && (
        <>
          <div style={{
            width: '90%',
            height: 1,
            background: '#ddd',
            margin: '16px 0'
          }} />
          <p style={{ fontSize: 12, color: '#888', margin: '0 0 8px' }}>
            {teamPresence.members.length} 人がオンライン
          </p>
          <TeamPanel
            members={teamPresence.members}
            localMemberId={teamPresence.localMemberId}
          />
        </>
      )}

      {/* Controls */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginTop: 16,
        flexWrap: 'wrap',
        justifyContent: 'center'
      }}>
        {states.map((s) => (
          <button
            key={s}
            onClick={() => setManualState(manualState === s ? null : s)}
            style={{
              padding: '4px 12px',
              borderRadius: 12,
              border: currentState === s ? '2px solid #555' : '2px solid #ddd',
              background: currentState === s ? '#555' : '#fff',
              color: currentState === s ? '#fff' : '#888',
              cursor: 'pointer',
              fontSize: 11
            }}
          >
            {s}
          </button>
        ))}
        <button
          onClick={handleDemoToggle}
          style={{
            padding: '4px 12px',
            borderRadius: 12,
            border: demoMode ? '2px solid #e91e63' : '2px solid #ddd',
            background: demoMode ? '#e91e63' : '#fff',
            color: demoMode ? '#fff' : '#888',
            cursor: 'pointer',
            fontSize: 11
          }}
        >
          {demoMode ? 'Demo OFF' : 'Demo'}
        </button>
      </div>

      {isElectron && (
        <p style={{ color: '#aaa', fontSize: 10, marginTop: 12 }}>
          Keys: {activity.keyPressCount} | Clicks: {activity.mouseClickCount} | Server: {serverAddress}
        </p>
      )}
    </div>
  )
}
