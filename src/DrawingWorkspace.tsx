import { Component, lazy, Suspense } from 'react'
import type { ReactNode } from 'react'

const ArchitectureCanvas = lazy(() => {
  Object.assign(window, { EXCALIDRAW_ASSET_PATH: `${window.location.origin}${import.meta.env.BASE_URL}excalidraw/` })
  return import('./ArchitectureCanvas.tsx')
})

export default class DrawingWorkspace extends Component<object, { error: string }> {
  state = { error: '' }
  static getDerivedStateFromError(error: Error) { return { error: error.message } }
  render(): ReactNode {
    if (this.state.error) return <div className="error" role="alert">
      <p>架构画布加载失败：{this.state.error}。本机草稿未删除，请重新加载页面后重试。</p>
      <button type="button" onClick={() => window.location.reload()}>重新加载页面</button>
    </div>
    return <Suspense fallback={<p role="status">正在加载架构画布…</p>}><ArchitectureCanvas /></Suspense>
  }
}
