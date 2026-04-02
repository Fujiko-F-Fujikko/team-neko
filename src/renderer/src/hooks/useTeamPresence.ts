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

  useEffect(() => {
    if (!options) return

    onTeamUpdate((updatedMembers) => {
      setMembers([...updatedMembers])
      setConnected(true)
    })

    joinTeam(options.memberName, options.serverAddress)

    return () => {
      leaveTeam()
      setConnected(false)
    }
  }, [options?.memberName, options?.serverAddress])

  // Update activity when local state changes
  useEffect(() => {
    if (!options) return
    updateActivity(options.localState, options.keyPressCount, options.mouseClickCount)
  }, [options?.localState, options?.keyPressCount, options?.mouseClickCount])

  const localMemberId = getLocalMemberId()

  const enableDemoMode = useCallback(() => {
    startDemoMode()
  }, [])

  const disableDemoMode = useCallback(() => {
    stopDemoMode()
  }, [])

  return { members, connected, localMemberId, enableDemoMode, disableDemoMode }
}
