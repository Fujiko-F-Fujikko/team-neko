import { useState, useEffect, useRef } from 'react'
import Cat from './components/Cat'
import TeamPanel from './components/TeamPanel'
import { useActivity } from './hooks/useActivity'
import { useTeamPresence } from './hooks/useTeamPresence'
import { CatState, ActivityPayload } from './types'

const CAT_COLORS = ['#555', '#8B6914', '#A0522D', '#708090', '#6B4226', '#2F4F4F', '#8B4513', '#556B2F']
function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return CAT_COLORS[Math.abs(hash) % CAT_COLORS.length]
}

const DEFAULT_SCALE = 0.35
const CAT_W = 200
const CAT_H = 240
const DEFAULT_SERVER = 'ws://43.22.98.63:9876'
const states: CatState[] = ['idle', 'typing', 'clicking', 'scrolling', 'sleeping']

interface CatPos { x: number; y: number; scale: number }

// ===== 参加フォーム (App外のトップレベルコンポーネント) =====
interface JoinFormProps {
  memberName: string
  serverAddress: string
  onNameChange: (v: string) => void
  onServerChange: (v: string) => void
  onJoin: () => void
  dark?: boolean
}

function JoinForm({ memberName, serverAddress, onNameChange, onServerChange, onJoin, dark = false }: JoinFormProps) {
  const canJoin = memberName.trim() && serverAddress.trim()
  const inputStyle: React.CSSProperties = {
    padding: '8px 14px', borderRadius: 10,
    border: dark ? '2px solid #555' : '2px solid #ddd',
    background: dark ? '#333' : '#fff',
    color: dark ? '#fff' : '#333',
    fontSize: 12, outline: 'none', textAlign: 'center', width: 190
  }
  return (
    <>
      <input
        type="text"
        placeholder="あなたの名前"
        value={memberName}
        autoFocus
        onChange={(e) => onNameChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && onJoin()}
        style={inputStyle}
      />
      <input
        type="text"
        placeholder={DEFAULT_SERVER}
        value={serverAddress}
        onChange={(e) => onServerChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && onJoin()}
        style={{ ...inputStyle, color: dark ? '#aaa' : '#888', fontSize: 11 }}
      />
      <button
        onClick={onJoin}
        disabled={!canJoin}
        style={{
          padding: '7px 22px', borderRadius: 10, border: 'none',
          background: canJoin ? '#ff9800' : dark ? '#444' : '#ccc',
          color: '#fff', fontSize: 13, cursor: canJoin ? 'pointer' : 'default'
        }}
      >
        参加
      </button>
    </>
  )
}

// ===== メインコンポーネント =====
export default function App() {
  const activity = useActivity()
  const [manualState, setManualState] = useState<CatState | null>(null)
  const [memberName,    setMemberName]    = useState(() => localStorage.getItem('team-neko-name')   ?? '')
  const [serverAddress, setServerAddress] = useState(() => localStorage.getItem('team-neko-server') ?? DEFAULT_SERVER)
  const [joined,        setJoined]        = useState(false)
  const [demoMode,      setDemoMode]      = useState(false)
  const [isOverlay,     setIsOverlay]     = useState(false)
  const [catPos,        setCatPos]        = useState<Record<string, CatPos>>({})

  const isElectron       = !!window.electronAPI
  const isSettingsWindow = window.location.hash === '#settings'
  const isMiniMode       = window.location.hash === '#mini'
  const currentState     = manualState ?? activity.state

  // Electron 初期化
  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.onOverlayModeChanged((overlay) => setIsOverlay(overlay))
  }, [])

  // オーバーレイモードで未参加の場合はフォーム操作できるようにクリックスルーを無効化
  useEffect(() => {
    if (!window.electronAPI) return
    if (isOverlay && !joined) {
      window.electronAPI.setIgnoreMouseEvents(false)
    } else if (isOverlay && joined) {
      window.electronAPI.setIgnoreMouseEvents(true, { forward: true })
    }
  }, [isOverlay, joined])

  const teamPresence = useTeamPresence(
    joined ? { memberName, serverAddress, localState: currentState, keyPressCount: activity.keyPressCount, mouseClickCount: activity.mouseClickCount } : null
  )

  // 新メンバーの初期位置
  useEffect(() => {
    if (!isOverlay || !joined) return
    const members = teamPresence.members.length > 0
      ? teamPresence.members
      : [{ memberId: 'local', memberName, state: currentState, lastActiveAt: Date.now(), keyPressCount: 0, mouseClickCount: 0 }]
    setCatPos(prev => {
      const next = { ...prev }
      let changed = false
      members.forEach((m, i) => {
        if (!next[m.memberId]) {
          next[m.memberId] = {
            x: 20 + i * (CAT_W * DEFAULT_SCALE + 16),
            y: window.innerHeight - CAT_H * DEFAULT_SCALE - 20,
            scale: DEFAULT_SCALE
          }
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [isOverlay, joined, teamPresence.members])

  const handleJoin = () => {
    if (memberName.trim() && serverAddress.trim()) {
      localStorage.setItem('team-neko-name',   memberName.trim())
      localStorage.setItem('team-neko-server', serverAddress.trim())
      setJoined(true)
    }
  }

  const handleDemoToggle = () => {
    if (demoMode) { teamPresence.disableDemoMode(); setDemoMode(false) }
    else          { teamPresence.enableDemoMode();  setDemoMode(true)  }
  }

  // ===== ドラッグ =====
  const dragging = useRef<{ id: string; startMouseX: number; startMouseY: number; startCatX: number; startCatY: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = (memberId: string, e: React.MouseEvent) => {
    e.preventDefault()
    const pos = catPos[memberId] ?? { x: 0, y: 0, scale: DEFAULT_SCALE }
    dragging.current = { id: memberId, startMouseX: e.clientX, startMouseY: e.clientY, startCatX: pos.x, startCatY: pos.y }
    setIsDragging(true)
  }

  const handleDragMove = (e: React.MouseEvent) => {
    if (!dragging.current) return
    const { id, startMouseX, startMouseY, startCatX, startCatY } = dragging.current
    setCatPos(prev => ({ ...prev, [id]: { ...prev[id], x: startCatX + e.clientX - startMouseX, y: startCatY + e.clientY - startMouseY } }))
  }

  const handleDragEnd = () => {
    dragging.current = null
    setIsDragging(false)
    window.electronAPI?.setIgnoreMouseEvents(true, { forward: true })
  }

  const handleWheel = (memberId: string, e: React.WheelEvent) => {
    e.preventDefault()
    setCatPos(prev => {
      const cur = prev[memberId] ?? { x: 0, y: 0, scale: DEFAULT_SCALE }
      return { ...prev, [memberId]: { ...cur, scale: Math.max(0.15, Math.min(2.0, cur.scale - e.deltaY * 0.0008)) } }
    })
  }

  // ===== BroadcastChannel (ブラウザ ミニモード用) =====
  const [remoteState,   setRemoteState]   = useState<CatState>('idle')
  const [remoteFast,    setRemoteFast]    = useState(false)
  const [remoteMembers, setRemoteMembers] = useState<ActivityPayload[]>([])
  const [remoteLocalId, setRemoteLocalId] = useState('')

  useEffect(() => {
    const bc = new BroadcastChannel('team-neko')
    if (isMiniMode) {
      bc.onmessage = (e) => {
        if (e.data.type === 'state-update') {
          setRemoteState(e.data.state); setRemoteFast(e.data.fast)
          setRemoteMembers(e.data.members); setRemoteLocalId(e.data.localMemberId)
        }
      }
    } else {
      const iv = setInterval(() => {
        bc.postMessage({ type: 'state-update', state: currentState, fast: activity.keyPressCount > 5, members: teamPresence.members, localMemberId: teamPresence.localMemberId })
      }, 200)
      return () => { clearInterval(iv); bc.close() }
    }
    return () => bc.close()
  }, [isMiniMode, currentState, activity.keyPressCount, teamPresence.members, teamPresence.localMemberId])

  const handlePopout = () => {
    const sw = window.screen.width, sh = window.screen.height
    const w = 280, h = 350
    window.open(window.location.origin + '/#mini', 'team-neko-mini',
      `width=${w},height=${h},left=${sw-w-20},top=${sh-h-80},menubar=no,toolbar=no,location=no,status=no`)
  }

  // ===== ブラウザ ミニポップアップ =====
  if (isMiniMode) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#2a2a2a', fontFamily: "'Segoe UI', sans-serif" }}>
        <Cat state={remoteState} fast={remoteFast} />
        <p style={{ color: '#aaa', fontSize: 11, margin: '4px 0 0' }}>
          {remoteState === 'idle' && 'のんびり中...'}{remoteState === 'typing' && 'カタカタカタ...!'}{remoteState === 'clicking' && 'カチカチ!'}{remoteState === 'scrolling' && 'スクロール...'}{remoteState === 'sleeping' && 'Zzz...'}
        </p>
        {remoteMembers.length > 1 && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {remoteMembers.filter(m => m.memberId !== remoteLocalId).map((m) => (
              <div key={m.memberId} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#3a3a3a', borderRadius: 8, padding: '2px 8px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: m.state === 'typing' ? '#4caf50' : m.state === 'sleeping' ? '#666' : '#ff9800' }} />
                <span style={{ color: '#ccc', fontSize: 10 }}>{m.memberName}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ===== Electron オーバーレイモード =====
  if (isOverlay && !isSettingsWindow) {
    if (!joined) {
      return (
        <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(24,24,24,0.92)', fontFamily: "'Segoe UI', sans-serif", gap: 10 }}>
          <div style={{ fontSize: 28 }}>🐱</div>
          <p style={{ color: '#fff', fontSize: 14, margin: 0, fontWeight: 'bold' }}>Team Neko</p>
          <JoinForm memberName={memberName} serverAddress={serverAddress} onNameChange={setMemberName} onServerChange={setServerAddress} onJoin={handleJoin} dark />
        </div>
      )
    }

    const displayMembers: ActivityPayload[] = teamPresence.members.length > 0
      ? teamPresence.members
      : [{ memberId: 'local', memberName, state: currentState, lastActiveAt: Date.now(), keyPressCount: activity.keyPressCount, mouseClickCount: activity.mouseClickCount }]

    return (
      <div style={{ width: '100vw', height: '100vh', position: 'relative', background: 'transparent', overflow: 'hidden' }}>
        {displayMembers.map((member) => {
          const isLocal = member.memberId === 'local' || member.memberId === teamPresence.localMemberId
          const catState = isLocal ? currentState : member.state
          const catFast  = isLocal ? activity.keyPressCount > 5 : member.keyPressCount > 5
          const { x, y, scale } = catPos[member.memberId] ?? { x: 20, y: window.innerHeight - CAT_H * DEFAULT_SCALE - 20, scale: DEFAULT_SCALE }
          return (
            <div key={member.memberId}
              style={{ position: 'absolute', left: x, top: y, width: CAT_W * scale, height: CAT_H * scale, cursor: isDragging && dragging.current?.id === member.memberId ? 'grabbing' : 'grab', userSelect: 'none', background: 'rgba(0,0,0,0.01)' }}
              onMouseEnter={() => window.electronAPI?.setIgnoreMouseEvents(false)}
              onMouseLeave={() => { if (!dragging.current) window.electronAPI?.setIgnoreMouseEvents(true, { forward: true }) }}
              onMouseDown={(e) => handleMouseDown(member.memberId, e)}
              onWheel={(e) => handleWheel(member.memberId, e)}
            >
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: CAT_W, height: CAT_H, pointerEvents: 'none' }}>
                <Cat state={catState} color={hashColor(member.memberName)} fast={catFast} name={member.memberName} />
              </div>
            </div>
          )
        })}
        {/* ドラッグ中: 全画面キャプチャdivでマウスイベントを確実に捕捉 */}
        {isDragging && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'grabbing', background: 'rgba(0,0,0,0.01)' }}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
          />
        )}
      </div>
    )
  }

  // ===== 設定ウィンドウ / Electronウィンドウモード =====
  if (isSettingsWindow || (!isOverlay && isElectron)) {
    if (!joined) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'Segoe UI', sans-serif", background: '#f5f0eb', gap: 14 }}>
          <Cat state="idle" />
          <h1 style={{ fontSize: 24, color: '#444', margin: 0 }}>Team Neko</h1>
          <JoinForm memberName={memberName} serverAddress={serverAddress} onNameChange={setMemberName} onServerChange={setServerAddress} onJoin={handleJoin} />
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', sans-serif", background: '#f5f0eb', paddingTop: 24 }}>
        <h1 style={{ fontSize: 24, color: '#444', marginBottom: 4 }}>Team Neko</h1>
        <Cat state={currentState} fast={activity.keyPressCount > 5} />
        {teamPresence.members.length > 0 && (
          <>
            <div style={{ width: '90%', height: 1, background: '#ddd', margin: '16px 0' }} />
            <TeamPanel members={teamPresence.members} localMemberId={teamPresence.localMemberId} />
          </>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={handleDemoToggle} style={{ padding: '4px 12px', borderRadius: 12, border: demoMode ? '2px solid #e91e63' : '2px solid #ddd', background: demoMode ? '#e91e63' : '#fff', color: demoMode ? '#fff' : '#888', cursor: 'pointer', fontSize: 11 }}>
            {demoMode ? 'Demo OFF' : 'Demo'}
          </button>
        </div>
      </div>
    )
  }

  // ===== ブラウザ通常モード =====
  if (!joined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: "'Segoe UI', sans-serif", background: '#f5f0eb', gap: 14 }}>
        <Cat state="idle" />
        <h1 style={{ fontSize: 28, color: '#444', margin: 0 }}>Team Neko</h1>
        <p style={{ color: '#888', fontSize: 13, margin: 0 }}>チームの活動をネコで可視化</p>
        <JoinForm memberName={memberName} serverAddress={serverAddress} onNameChange={setMemberName} onServerChange={setServerAddress} onJoin={handleJoin} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', fontFamily: "'Segoe UI', sans-serif", background: '#f5f0eb', paddingTop: 24 }}>
      <h1 style={{ fontSize: 24, color: '#444', marginBottom: 4 }}>Team Neko</h1>
      <p style={{ color: '#888', marginBottom: 16, fontSize: 13 }}>
        {currentState === 'idle' && 'のんびり中...'}{currentState === 'typing' && 'カタカタカタ...!'}{currentState === 'clicking' && 'カチカチ!'}{currentState === 'scrolling' && 'スクロールスクロール...'}{currentState === 'sleeping' && 'Zzz...すやすや'}
      </p>
      <Cat state={currentState} fast={activity.keyPressCount > 5} />
      {teamPresence.members.length > 0 && (
        <>
          <div style={{ width: '90%', height: 1, background: '#ddd', margin: '16px 0' }} />
          <p style={{ fontSize: 12, color: '#888', margin: '0 0 8px' }}>{teamPresence.members.length} 人がオンライン</p>
          <TeamPanel members={teamPresence.members} localMemberId={teamPresence.localMemberId} />
        </>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={handlePopout} style={{ padding: '4px 12px', borderRadius: 12, border: '2px solid #ff9800', background: '#ff9800', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>
          ポップアウト
        </button>
        {states.map((s) => (
          <button key={s} onClick={() => setManualState(manualState === s ? null : s)}
            style={{ padding: '4px 12px', borderRadius: 12, border: currentState === s ? '2px solid #555' : '2px solid #ddd', background: currentState === s ? '#555' : '#fff', color: currentState === s ? '#fff' : '#888', cursor: 'pointer', fontSize: 11 }}>
            {s}
          </button>
        ))}
        <button onClick={handleDemoToggle} style={{ padding: '4px 12px', borderRadius: 12, border: demoMode ? '2px solid #e91e63' : '2px solid #ddd', background: demoMode ? '#e91e63' : '#fff', color: demoMode ? '#fff' : '#888', cursor: 'pointer', fontSize: 11 }}>
          {demoMode ? 'Demo OFF' : 'Demo'}
        </button>
      </div>
      <p style={{ color: '#aaa', fontSize: 10, marginTop: 12 }}>Keys: {activity.keyPressCount} | Clicks: {activity.mouseClickCount}</p>
    </div>
  )
}
