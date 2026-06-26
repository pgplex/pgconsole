import path from 'path'
import express from 'express'
import cookieParser from 'cookie-parser'
import { authRouter } from './auth-routes'
import { connectRouter } from './connect'
import { mcpRouter, MCP_PATH } from './mcp'
import { loadConfig, loadConfigFromString, loadDemoConfig, isDemoMode, getBanner, getBranding, getExternalUrl, getAgents, isAuthEnabled, getIAMRules } from './lib/config'
import { startDemoDatabase, stopDemoDatabase } from './lib/demo'
import { testAllConnections } from './lib/test-connections'

// __dirname is provided by esbuild banner
declare const __dirname: string
// Injected by esbuild define
declare const __APP_VERSION__: string
declare const __DEV__: boolean
const app = express()

// Parse command line arguments
function parseArgs(): { config?: string; port?: string } {
  const args = process.argv.slice(2)
  const result: { config?: string; port?: string } = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) {
      result.config = args[i + 1]
    } else if (args[i] === '--port' && args[i + 1]) {
      result.port = args[i + 1]
    }
  }
  return result
}

app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', authRouter)
app.use(mcpRouter)
app.use(connectRouter)

// Public settings endpoint (no auth required)
app.get('/api/setting', (_req, res) => {
  res.json({
    banner: getBanner(),
    branding: getBranding(),
    demo: isDemoMode(),
  })
})

// Serve frontend static files in production
const clientDir = path.join(__dirname, 'client')
app.use(express.static(clientDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm')
    }
  }
}))

// SPA fallback - serve index.html for non-API routes
app.use((req, res, next) => {
  // Skip API routes and non-GET requests
  if (req.method !== 'GET' ||
      req.path.startsWith('/api/') ||
      req.path.startsWith('/connection.v1.') ||
      req.path.startsWith('/query.v1.') ||
      req.path.startsWith('/ai.v1.')) {
    return next()
  }
  res.sendFile(path.join(clientDir, 'index.html'))
})

async function start() {
  const args = parseArgs()
  const port = args.port || process.env.PORT || 9876
  if (args.config || process.env.PGCONSOLE_CONFIG) {
    try {
      if (args.config) {
        await loadConfig(args.config)
        console.log(`✓ Loaded config from: ${path.resolve(args.config)}`)
      } else {
        await loadConfigFromString(process.env.PGCONSOLE_CONFIG!)
        console.log('✓ Loaded config from PGCONSOLE_CONFIG environment variable')
      }
    } catch (error) {
      console.error('Failed to load config:', error instanceof Error ? error.message : error)
      process.exit(1)
    }
  } else {
    console.log('No --config specified — starting in demo mode...')
    const demoPort = await startDemoDatabase()
    loadDemoConfig(demoPort)
    console.log(`✓ Demo database started on port ${demoPort}`)
  }

  // IAM is opt-in: with no [[iam]] rules, every authenticated principal gets full
  // access. Warn so an empty IAM section with auth enabled isn't a silent misconfig.
  if (isAuthEnabled() && getIAMRules().length === 0) {
    console.warn(
      '⚠ Auth is enabled but no [[iam]] rules are configured — every authenticated user and agent has full access to all connections. Add [[iam]] rules to restrict access.',
    )
  }

  // Test all connections to populate cache
  try {
    await testAllConnections()
  } catch (error) {
    console.error('\nConnection test failed:', error instanceof Error ? error.message : error)
    process.exit(1)
  }

  const server = app.listen(port, () => {
    console.log(`
                                                      ___
                                                     /\\_ \\
 _____      __     ___    ___     ___     ____    ___\\//\\ \\      __
/\\ '__\`\\  /'_ \`\\  /'___\\ / __\`\\ /' _ \`\\  /',__\\  / __\`\\\\ \\ \\   /'__\`\\
\\ \\ \\L\\ \\/\\ \\L\\ \\/\\ \\__//\\ \\L\\ \\/\\ \\/\\ \\/\\__, \`\\/\\ \\L\\ \\\\_\\ \\_/\\  __/
 \\ \\ ,__/\\ \\____ \\ \\____\\ \\____/\\ \\_\\ \\_\\/\\____/\\ \\____//\\____\\ \\____\\
  \\ \\ \\/  \\/___L\\ \\/____/\\/___/  \\/_/\\/_/\\/___/  \\/___/ \\/____/\\/____/
   \\ \\_\\    /\\____/
    \\/_/    \\_/__/

    Version ${__APP_VERSION__}
`)
    console.log(`Server running on http://localhost:${port}`)
    const browserUrl = __DEV__ ? `http://localhost:5173` : getExternalUrl() || `http://localhost:${port}`
    console.log(`Open in browser: ${browserUrl}`)
    // MCP endpoint is always mounted, but rejects every request without a bearer
    // token matching a configured agent — so it's only usable once [[agents]] exist.
    const agentCount = getAgents().length
    const mcpStatus = agentCount > 0
      ? `${agentCount} agent${agentCount === 1 ? '' : 's'}`
      : 'no agents — add [[agents]] to connect'
    const mcpBaseUrl = getExternalUrl() || `http://localhost:${port}`
    console.log(`MCP server on ${mcpBaseUrl}${MCP_PATH} (${mcpStatus})`)
  })
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Error: Port ${port} is already in use.`)
    } else {
      console.error(`Error starting server: ${err.message}`)
    }
    process.exit(1)
  })

  const shutdown = async () => {
    console.log('\nShutting down...')
    try {
      if (isDemoMode()) await stopDemoDatabase()
    } catch { /* best-effort cleanup */ }
    server.close(() => {
      process.exit(0)
    })
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

start()
