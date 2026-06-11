import { io, Socket } from 'socket.io-client'

class SocketService {
  private socket: Socket | null = null
  private url = 'http://localhost:3000'
  private listeners: Map<string, Set<Function>> = new Map()

  connect(token: string) {
    if (this.socket?.connected) return

    this.socket = io(this.url, {
      auth: {
        token
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    })

    this.setupDefaultListeners()
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  private setupDefaultListeners() {
    if (!this.socket) return

    // Order events
    this.socket.on('order:created', (data) => this.emit('order:created', data))
    this.socket.on('order:updated', (data) => this.emit('order:updated', data))
    this.socket.on('order:status-changed', (data) => this.emit('order:status-changed', data))

    // Table events
    this.socket.on('table:status-changed', (data) => this.emit('table:status-changed', data))

    // Payment events
    this.socket.on('payment:completed', (data) => this.emit('payment:completed', data))

    // Kitchen events
    this.socket.on('kitchen:order-ready', (data) => this.emit('kitchen:order-ready', data))

    // Connection events
    this.socket.on('connect', () => this.emit('connect'))
    this.socket.on('disconnect', () => this.emit('disconnect'))
    this.socket.on('connect_error', (error) => this.emit('connect_error', error))
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)

    // Also listen on the socket if it exists
    if (this.socket && event.startsWith('socket:')) {
      this.socket.on(event.replace('socket:', ''), callback)
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (!this.listeners.has(event)) return

    if (callback) {
      this.listeners.get(event)!.delete(callback)
    } else {
      this.listeners.delete(event)
    }
  }

  private emit(event: string, data?: any) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach((callback) => callback(data))
    }
  }

  emit_to_server(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data)
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false
  }
}

export const socketService = new SocketService()
