import { ActivityPayload } from '../types'
import Cat from './Cat'

const CAT_COLORS = ['#555', '#8B6914', '#A0522D', '#708090', '#6B4226', '#2F4F4F', '#8B4513', '#556B2F']

function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return CAT_COLORS[Math.abs(hash) % CAT_COLORS.length]
}

interface TeamPanelProps {
  members: ActivityPayload[]
  localMemberId: string | null
}

const stateLabels: Record<string, string> = {
  idle: 'のんびり中...',
  typing: 'カタカタカタ!',
  clicking: 'カチカチ!',
  scrolling: 'スクロール中',
  sleeping: 'Zzz...'
}

export default function TeamPanel({ members, localMemberId }: TeamPanelProps) {
  if (members.length === 0) return null

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 16,
      justifyContent: 'center',
      padding: 16
    }}>
      {members.map((member) => {
        const isLocal = member.memberId === localMemberId
        return (
          <div
            key={member.memberId}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: 12,
              borderRadius: 16,
              background: isLocal ? 'rgba(100, 200, 100, 0.1)' : 'rgba(0,0,0,0.03)',
              border: isLocal ? '2px solid rgba(100, 200, 100, 0.4)' : '2px solid transparent',
              minWidth: 140,
              transform: isLocal ? 'scale(1.05)' : 'scale(0.95)',
              transition: 'all 0.3s ease'
            }}
          >
            <div style={{ transform: 'scale(0.65)', transformOrigin: 'top center', height: 150 }}>
              <Cat
                state={member.state}
                color={hashColor(member.memberName)}
                fast={member.keyPressCount > 5}
              />
            </div>
            <div style={{
              fontSize: 13,
              fontWeight: 'bold',
              color: '#444',
              marginTop: -8
            }}>
              {member.memberName}
              {isLocal && <span style={{ fontSize: 10, color: '#888', marginLeft: 4 }}>(you)</span>}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 4,
              fontSize: 11,
              color: '#888'
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: member.state === 'sleeping' ? '#aaa'
                  : member.state === 'idle' ? '#f0c040'
                  : '#4caf50'
              }} />
              {stateLabels[member.state] || member.state}
            </div>
          </div>
        )
      })}
    </div>
  )
}
