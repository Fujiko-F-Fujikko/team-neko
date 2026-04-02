import { useState, useEffect, useCallback } from 'react'
import { ActivityPayload, CatState } from '../types'
import { joinTeam, updateActivity, onTeamUpdate, leaveTeam, getLocalMemberId, startDemoMode, stopDemoMode } from '../services/sync'

interface UseTeamPresenceOptions {
  memberName: string
  serverAddress: string
  localState: CatState
  keyPressCount: number
  mouseClickCount: number
}

export function useTeamPresence(options: UseTeamPresenceOptions | null) {
  const [members, setMembers] = useState<ActivityPayload[]>([])
  const [connected, setConnected] = useState(false)

  const memberName = options?.memberName ?? ''
  const serverAddress = options?.serverAddress ?? ''
  const localState = options?.localState ?? 'idle'
  const kpCount = options?.keyPressCount ?? 0
  const mcCount = options?.mouseClickCount ?? 0

  useEffect(() => {
    if (!memberName || !serverAddress) return

    onTeamUpdate((updatedMembers) => {
      setMembers([...updatedMembers])
      setConnected(true)
    })

    joinTeam(memberName, serverAddress)

    return () => {
      leaveTeam()
      setConnected(false)
    }
  }, [memberName, serverAddress])

  // Update activity when local state changes
  useEffect(() => {
    if (!memberName || !serverAddress) return
    updateActivity(localState, kpCount, mcCount)
  }, [memberName, serverAddress, localState, kpCount, mcCount])

  const localMemberId = getLocalMemberId()

  const enableDemoMode = useCallback(() => {
    startDemoMode()
  }, [])

  const disableDemoMode = useCallback(() => {
    stopDemoMode()
  }, [])

  return { members, connected, localMemberId, enableDemoMode, disableDemoMode }
}
