import { ActivityPayload } from '../types'

type TeamUpdateCallback = (members: ActivityPayload[]) => void

let ws: WebSocket | null = null
let localMember: ActivityPayload | null = null
const teamMembers = new Map<string, ActivityPayload>()
let onUpdateCallback: TeamUpdateCallback | null = null

// Cleanup stale members every 5 seconds
setInterval(() => {
  const now = Date.now()
  let changed = false
  for (const [id, member] of teamMembers) {
    if (now - member.lastActiveAt > 60000) {
      teamMembers.delete(id)
      changed = true
    }
  }
  if (changed) notifyUpdate()
}, 5000)

function notifyUpdate(): void {
  if (onUpdateCallback) {
    onUpdateCallback(Array.from(teamMembers.values()))
  }
}

export function joinTeam(name: string, serverAddress: string): void {
  const memberId = `${name}-${Date.now()}`
  localMember = {
    memberId,
    memberName: name,
    state: 'idle',
    lastActiveAt: Date.now(),
    keyPressCount: 0,
    mouseClickCount: 0
  }

  // Connect to WebSocket server
  const wsUrl = serverAddress.startsWith('ws://') ? serverAddress : `ws://${serverAddress}`
  ws = new WebSocket(wsUrl)

  ws.onopen = () => {
    console.log('[Team Neko] Connected to server')
    if (localMember) {
      ws?.send(JSON.stringify(localMember))
    }
  }

  ws.onmessage = (event) => {
    try {
      const payload: ActivityPayload = JSON.parse(event.data as string)
      teamMembers.set(payload.memberId, payload)
      notifyUpdate()
    } catch (e) {
      console.error('[Team Neko] Failed to parse message:', e)
    }
  }

  ws.onclose = () => {
    console.log('[Team Neko] Disconnected from server')
    // Attempt reconnect after 3 seconds
    setTimeout(() => {
      if (localMember) {
        joinTeam(localMember.memberName, serverAddress)
      }
    }, 3000)
  }

  ws.onerror = (err) => {
    console.error('[Team Neko] WebSocket error:', err)
  }

  // Add self to team members
  teamMembers.set(memberId, localMember)
  notifyUpdate()
}

export function updateActivity(state: ActivityPayload['state'], keyPressCount: number, mouseClickCount: number): void {
  if (!localMember) return

  localMember.state = state
  localMember.lastActiveAt = Date.now()
  localMember.keyPressCount = keyPressCount
  localMember.mouseClickCount = mouseClickCount

  teamMembers.set(localMember.memberId, { ...localMember })
  notifyUpdate()

  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(localMember))
  }
}

export function onTeamUpdate(callback: TeamUpdateCallback): void {
  onUpdateCallback = callback
}

export function leaveTeam(): void {
  ws?.close()
  ws = null
  localMember = null
  teamMembers.clear()
}

export function getLocalMemberId(): string | null {
  return localMember?.memberId ?? null
}

// Demo mode: simulate fake team members
let demoInterval: ReturnType<typeof setInterval> | null = null

export function startDemoMode(): void {
  const demoMembers = [
    { name: 'Alice', id: 'demo-alice' },
    { name: 'Bob', id: 'demo-bob' },
    { name: 'Charlie', id: 'demo-charlie' }
  ]
  const states: ActivityPayload['state'][] = ['idle', 'typing', 'clicking', 'scrolling', 'sleeping']

  // Initialize demo members
  for (const dm of demoMembers) {
    teamMembers.set(dm.id, {
      memberId: dm.id,
      memberName: dm.name,
      state: 'idle',
      lastActiveAt: Date.now(),
      keyPressCount: 0,
      mouseClickCount: 0
    })
  }
  notifyUpdate()

  // Randomly change states
  demoInterval = setInterval(() => {
    const dm = demoMembers[Math.floor(Math.random() * demoMembers.length)]
    const state = states[Math.floor(Math.random() * states.length)]
    const member = teamMembers.get(dm.id)
    if (member) {
      member.state = state
      member.lastActiveAt = Date.now()
      member.keyPressCount = Math.floor(Math.random() * 20)
      member.mouseClickCount = Math.floor(Math.random() * 10)
      teamMembers.set(dm.id, { ...member })
      notifyUpdate()
    }
  }, 2000)
}

export function stopDemoMode(): void {
  if (demoInterval) {
    clearInterval(demoInterval)
    demoInterval = null
  }
  // Remove demo members
  for (const key of teamMembers.keys()) {
    if (key.startsWith('demo-')) {
      teamMembers.delete(key)
    }
  }
  notifyUpdate()
}
