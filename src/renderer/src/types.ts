export type CatState = 'idle' | 'typing' | 'clicking' | 'scrolling' | 'sleeping'

export interface ActivityPayload {
  memberId: string
  memberName: string
  state: CatState
  lastActiveAt: number
  keyPressCount: number
  mouseClickCount: number
}
