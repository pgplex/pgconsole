#!/usr/bin/env node
// Wait for a port to be ready before continuing
import net from 'net'

const port = parseInt(process.argv[2] || '9876')
const timeout = parseInt(process.argv[3] || '30000')
const start = Date.now()

async function checkPort() {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(1000)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.on('error', () => {
      socket.destroy()
      resolve(false)
    })
    socket.connect(port, 'localhost')
  })
}

async function wait() {
  while (Date.now() - start < timeout) {
    if (await checkPort()) {
      process.exit(0)
    }
    await new Promise(r => setTimeout(r, 100))
  }
  console.error(`Timeout waiting for port ${port}`)
  process.exit(1)
}

wait()
