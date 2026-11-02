import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import seed from './src/seed-plan.json' with { type: 'json' }
import { validatePlan } from './src/plan.ts'
import { mergeGitHubParticipants } from './src/participants.ts'

export default defineConfig(({ mode }) => {
  const participants = loadEnv(mode, process.cwd(), 'VITE_GITHUB_PARTICIPANTS').VITE_GITHUB_PARTICIPANTS || '[]'
  mergeGitHubParticipants(validatePlan(seed), JSON.parse(participants))
  return {
    base: '/ArchitecturePlanner/',
    plugins: [react()],
    define: { 'import.meta.env.VITE_GITHUB_PARTICIPANTS': JSON.stringify(participants) },
  }
})
