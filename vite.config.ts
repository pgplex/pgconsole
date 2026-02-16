import path from "path"
import fs from "fs"
import { execSync } from "child_process"
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))

// Plugin to serve WASM files from node_modules (dev) and copy to build output (prod)
function serveWasm(): Plugin {
  const wasmPath = path.join(__dirname, 'node_modules/@libpg-query/parser/wasm/libpg-query.wasm')

  return {
    name: 'serve-wasm',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.endsWith('.wasm')) {
          if (fs.existsSync(wasmPath)) {
            res.setHeader('Content-Type', 'application/wasm')
            fs.createReadStream(wasmPath).pipe(res)
            return
          }
        }
        next()
      })
    },
    writeBundle(options) {
      // Copy WASM file to output directory during build
      if (options.dir && fs.existsSync(wasmPath)) {
        const outDir = options.dir
        const assetsDir = path.join(outDir, 'assets')
        fs.mkdirSync(assetsDir, { recursive: true })
        fs.copyFileSync(wasmPath, path.join(assetsDir, 'libpg-query.wasm'))
        // Also copy to root for Emscripten loaders that resolve without /assets
        fs.copyFileSync(wasmPath, path.join(outDir, 'libpg-query.wasm'))
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const isProd = command === 'build'
  const appVersion = isProd ? pkg.version : `${pkg.version}-dev`
  let gitCommit = process.env.GIT_COMMIT?.slice(0, 7) || ''
  if (!gitCommit) {
    try {
      gitCommit = execSync('git rev-parse --short HEAD').toString().trim()
    } catch {
      gitCommit = 'unknown'
    }
  }
  const buildDate = new Date().toISOString()

  return {
  plugins: [react(), tailwindcss(), serveWasm()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ['@libpg-query/parser'],
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __GIT_COMMIT__: JSON.stringify(gitCommit),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  build: {
    outDir: 'dist/client',
  },
  server: {
    proxy: {
      '/api': 'http://localhost:9876',
      '/connection.v1.ConnectionService': 'http://localhost:9876',
      '/query.v1.QueryService': 'http://localhost:9876',
      '/ai.v1.AIService': 'http://localhost:9876',
    },
  },
  }
})
