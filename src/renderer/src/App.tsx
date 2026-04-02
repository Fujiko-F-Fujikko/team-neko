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
  const [isOverlay, setIsOverlay] = useState(false)

  const isElectron = !!window.electronAPI
  const currentState = manualState ?? activity.state

  // Detect if we're the settings window (hash-based routing)
  const isSettingsWindow = window.location.hash === '#settings'

  // Listen for overlay mode changes from Electron
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onOverlayModeChanged((overlay) => {
        setIsOverlay(overlay)
      })
      // Auto-detect server address
      window.electronAPI.getServerAddress().then((addr) => {
        setServerAddress(addr)
      })
    }
  }, [])

  // Always call hooks in the same order
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

  // ===== Overlay Mode (Bongo Cat style - default in Electron) =====
  if (isOverlay && !isSettingsWindow) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          WebkitAppRegion: 'drag' as any,
          cursor: 'grab'
        }}
      >
        <Cat
          state={currentState}
          fast={activity.keyPressCount > 5}
        />
      </div>
    )
  }

  // ===== Settings Window / Full Mode =====
  if (isSettingsWindow || (!isOverlay && isElectron)) {
    // Join screen first
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
                padding: '10px 16px', borderRadius: 12, border: '2px solid #ddd',
                fontSize: 14, outline: 'none', textAlign: 'center'
              }}
            />
            <input
              type="text"
              placeholder="サーバーアドレス (ws://192.168.x.x:9876)"
              value={serverAddress}
              onChange={(e) => setServerAddress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              style={{
                padding: '10px 16px', borderRadius: 12, border: '2px solid #ddd',
                fontSize: 12, outline: 'none', textAlign: 'center'
              }}
            />
            <button
              onClick={handleJoin}
              disabled={!memberName.trim() || !serverAddress.trim()}
              style={{
                padding: '10px 24px', borderRadius: 12, border: 'none',
                background: memberName.trim() && serverAddress.trim() ? '#555' : '#ccc',
                color: '#fff', fontSize: 14, fontWeight: 'bold',
                cursor: memberName.trim() && serverAddress.trim() ? 'pointer' : 'default'
              }}
            >
              参加する
            </button>
          </div>
          {serverAddress && (
            <p style={{ color: '#aaa', fontSize: 11, marginTop: 8 }}>サーバー: {serverAddress}</p>
          )}
        </div>
      )
    }

    // Full team view
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        minHeight: '100vh', fontFamily: "'Segoe UI', sans-serif",
        background: '#f5f0eb', paddingTop: 24
      }}>
        <h1 style={{ fontSize: 24, color: '#444', marginBottom: 4 }}>Team Neko</h1>
        <Cat state={currentState} fast={activity.keyPressCount > 5} />

        {teamPresence.members.length > 0 && (
          <>
            <div style={{ width: '90%', height: 1, background: '#ddd', margin: '16px 0' }} />
            <p style={{ fontSize: 12, color: '#888', margin: '0 0 8px' }}>
              {teamPresence.members.length} 人がオンライン
            </p>
            <TeamPanel members={teamPresence.members} localMemberId={teamPresence.localMemberId} />
          </>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={handleDemoToggle}
            style={{
              padding: '4px 12px', borderRadius: 12,
              border: demoMode ? '2px solid #e91e63' : '2px solid #ddd',
              background: demoMode ? '#e91e63' : '#fff',
              color: demoMode ? '#fff' : '#888', cursor: 'pointer', fontSize: 11
            }}
          >
            {demoMode ? 'Demo OFF' : 'Demo'}
          </button>
        </div>
      </div>
    )
  }

  // ===== Browser Mini/Popup Mode (Bongo Cat style) =====
  const isMiniMode = window.location.hash === '#mini'

  // Sync state from main tab via BroadcastChannel
  const [remoteState, setRemoteState] = useState<CatState>('idle')
  const [remoteFast, setRemoteFast] = useState(false)
  const [remoteMembers, setRemoteMembers] = useState<typeof teamPresence.members>([])
  const [remoteLocalId, setRemoteLocalId] = useState('')

  useEffect(() => {
    const bc = new BroadcastChannel('team-neko')
    if (isMiniMode) {
      // Mini window: receive state from main tab
      bc.onmessage = (e) => {
        if (e.data.type === 'state-update') {
          setRemoteState(e.data.state)
          setRemoteFast(e.data.fast)
          setRemoteMembers(e.data.members)
          setRemoteLocalId(e.data.localMemberId)
        }
      }
    } else {
      // Main tab: broadcast state to mini window
      const interval = setInterval(() => {
        bc.postMessage({
          type: 'state-update',
          state: currentState,
          fast: activity.keyPressCount > 5,
          members: teamPresence.members,
          localMemberId: teamPresence.localMemberId
        })
      }, 200)
      return () => clearInterval(interval)
    }
    return () => bc.close()
  }, [isMiniMode, currentState, activity.keyPressCount, teamPresence.members, teamPresence.localMemberId])

  const handlePopout = () => {
    const sw = window.screen.width
    const sh = window.screen.height
    const w = 280
    const h = 350
    window.open(
      window.location.origin + '/#mini',
      'team-neko-mini',
      `width=${w},height=${h},left=${sw - w - 20},top=${sh - h - 80},menubar=no,toolbar=no,location=no,status=no`
    )
  }

  if (isMiniMode) {
    const miniState = remoteState
    const miniMembers = remoteMembers
    const miniLocalId = remoteLocalId
    return (
      <div style={{
        width: '100vw', height: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        background: '#2a2a2a', fontFamily: "'Segoe UI', sans-serif",
        borderRadius: 16, overflow: 'hidden'
      }}>
        <Cat state={miniState} fast={remoteFast} />
        <p style={{ color: '#aaa', fontSize: 11, margin: '4px 0 0' }}>
          {miniState === 'idle' && 'のんびり中...'}
          {miniState === 'typing' && 'カタカタカタ...!'}
          {miniState === 'clicking' && 'カチカチ!'}
          {miniState === 'scrolling' && 'スクロール...'}
          {miniState === 'sleeping' && 'Zzz...'}
        </p>
        {miniMembers.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {miniMembers.filter(m => m.memberId !== miniLocalId).map((m) => (
              <div key={m.memberId} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: '#3a3a3a', borderRadius: 8, padding: '2px 8px'
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: m.state === 'typing' ? '#4caf50' : m.state === 'clicking' ? '#2196f3' : m.state === 'sleeping' ? '#666' : '#ff9800'
                }} />
                <span style={{ color: '#ccc', fontSize: 10 }}>{m.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ===== Browser Mode (non-Electron, full UI) =====
  if (!joined) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh',
        fontFamily: "'Segoe UI', sans-serif", background: '#f5f0eb', gap: 16
      }}>
        <div style={{ transform: 'scale(0.8)' }}>
          <Cat state="idle" />
        </div>
        <h1 style={{ fontSize: 28, color: '#444', margin: 0 }}>Team Neko</h1>
        <p style={{ color: '#888', fontSize: 13, margin: 0 }}>チームの活動をネコで可視化</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16, width: 280 }}>
          <input
            type="text" placeholder="あなたの名前" value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            style={{ padding: '10px 16px', borderRadius: 12, border: '2px solid #ddd', fontSize: 14, outline: 'none', textAlign: 'center' }}
          />
          <input
            type="text" placeholder="サーバーアドレス (ws://192.168.x.x:9876)" value={serverAddress}
            onChange={(e) => setServerAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            style={{ padding: '10px 16px', borderRadius: 12, border: '2px solid #ddd', fontSize: 12, outline: 'none', textAlign: 'center' }}
          />
          <button
            onClick={handleJoin}
            disabled={!memberName.trim() || !serverAddress.trim()}
            style={{
              padding: '10px 24px', borderRadius: 12, border: 'none',
              background: memberName.trim() && serverAddress.trim() ? '#555' : '#ccc',
              color: '#fff', fontSize: 14, fontWeight: 'bold',
              cursor: memberName.trim() && serverAddress.trim() ? 'pointer' : 'default'
            }}
          >
            参加する
          </button>
        </div>
      </div>
    )
  }

  // Browser full mode
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      minHeight: '100vh', fontFamily: "'Segoe UI', sans-serif",
      background: '#f5f0eb', paddingTop: 24
    }}>
      <h1 style={{ fontSize: 24, color: '#444', marginBottom: 4 }}>Team Neko</h1>
      <p style={{ color: '#888', marginBottom: 16, fontSize: 13 }}>
        {currentState === 'idle' && 'のんびり中...'}
        {currentState === 'typing' && 'カタカタカタ...!'}
        {currentState === 'clicking' && 'カチカチ!'}
        {currentState === 'scrolling' && 'スクロールスクロール...'}
        {currentState === 'sleeping' && 'Zzz...すやすや'}
      </p>
      <Cat state={currentState} fast={activity.keyPressCount > 5} />

      {teamPresence.members.length > 0 && (
        <>
          <div style={{ width: '90%', height: 1, background: '#ddd', margin: '16px 0' }} />
          <p style={{ fontSize: 12, color: '#888', margin: '0 0 8px' }}>
            {teamPresence.members.length} 人がオンライン
          </p>
          <TeamPanel members={teamPresence.members} localMemberId={teamPresence.localMemberId} />
        </>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={handlePopout}
          style={{
            padding: '4px 12px', borderRadius: 12,
            border: '2px solid #ff9800', background: '#ff9800',
            color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 'bold'
          }}
        >
          ポップアウト
        </button>
        {states.map((s) => (
          <button
            key={s}
            onClick={() => setManualState(manualState === s ? null : s)}
            style={{
              padding: '4px 12px', borderRadius: 12,
              border: currentState === s ? '2px solid #555' : '2px solid #ddd',
              background: currentState === s ? '#555' : '#fff',
              color: currentState === s ? '#fff' : '#888', cursor: 'pointer', fontSize: 11
            }}
          >
            {s}
          </button>
        ))}
        <button
          onClick={handleDemoToggle}
          style={{
            padding: '4px 12px', borderRadius: 12,
            border: demoMode ? '2px solid #e91e63' : '2px solid #ddd',
            background: demoMode ? '#e91e63' : '#fff',
            color: demoMode ? '#fff' : '#888', cursor: 'pointer', fontSize: 11
          }}
        >
          {demoMode ? 'Demo OFF' : 'Demo'}
        </button>
      </div>

      <p style={{ color: '#aaa', fontSize: 10, marginTop: 12 }}>
        Keys: {activity.keyPressCount} | Clicks: {activity.mouseClickCount}
      </p>
    </div>
  )
}
