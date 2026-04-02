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

export function startWSServer(): Promise<WebSocketServer | null> {
  return new Promise((resolve) => {
    const server = new WebSocketServer({ port: WS_PORT, host: '0.0.0.0' })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[Team Neko] Port ${WS_PORT} already in use - connecting as client only`)
        resolve(null)
      } else {
        console.error('[Team Neko] WebSocket server error:', err)
        resolve(null)
      }
    })

    server.on('listening', () => {
      wss = server
      const ip = getLocalIP()
      console.log(`[Team Neko] WebSocket server running on ws://${ip}:${WS_PORT}`)

      server.on('connection', (ws) => {
        ws.on('message', (data) => {
          const msg = data.toString()
          wss?.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(msg)
            }
          })
        })
      })

      resolve(server)
    })
  })
}

export function stopWSServer(): void {
  wss?.close()
  wss = null
}
