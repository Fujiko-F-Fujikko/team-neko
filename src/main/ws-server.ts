import { WebSocketServer, WebSocket } from 'ws'
import { networkInterfaces } from 'os'

let wss: WebSocketServer | null = null
const WS_PORT = 9876

export function getLocalIP(): string {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return '127.0.0.1'
}

export function startWSServer(): WebSocketServer {
  wss = new WebSocketServer({ port: WS_PORT, host: '0.0.0.0' })

  wss.on('connection', (ws) => {
    // Broadcast incoming messages to all other clients
    ws.on('message', (data) => {
      const msg = data.toString()
      wss?.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(msg)
        }
      })
    })
  })

  const ip = getLocalIP()
  console.log(`[Team Neko] WebSocket server running on ws://${ip}:${WS_PORT}`)
  return wss
}

export function stopWSServer(): void {
  wss?.close()
  wss = null
}
