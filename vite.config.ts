import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import seed from './src/seed-plan.json' with { type: 'json' }
import { validatePlan } from './src/plan.ts'
import { mergeGitHubParticipants } from './src/participants.ts'

export default defineConfig(({ mode }) => {
  const participants = loadEnv(mode, process.cwd(), 'VITE_GITHUB_PARTICIPANTS').VITE_GITHUB_PARTICIPANTS || '[]'
  mergeGitHubParticipants(validatePlan(seed), JSON.parse(participants))
  const fontDirectory = join(dirname(fileURLToPath(import.meta.resolve('@excalidraw/excalidraw'))), 'fonts')
  const fonts = new Map(readdirSync(fontDirectory, { recursive: true, encoding: 'utf8' })
    .map(name => join(fontDirectory, name))
    .filter(path => statSync(path).isFile())
    .map(path => [`excalidraw/fonts/${relative(fontDirectory, path).replaceAll('\\', '/')}`, path]))
  return {
    base: '/ArchitecturePlanner/',
    optimizeDeps: { include: ['@excalidraw/excalidraw'] },
    plugins: [react(), {
      name: 'local-excalidraw-fonts',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const path = fonts.get((request.url ?? '').split('?')[0].replace(/^\/ArchitecturePlanner\//, ''))
          if (!path) { next(); return }
          response.setHeader('Content-Type', path.endsWith('.woff2') ? 'font/woff2' : 'text/plain; charset=utf-8')
          response.end(readFileSync(path))
        })
      },
      generateBundle() {
        for (const [fileName, path] of fonts) this.emitFile({ type: 'asset', fileName, source: readFileSync(path) })
      },
    }],
    define: { 'import.meta.env.VITE_GITHUB_PARTICIPANTS': JSON.stringify(participants) },
  }
})
