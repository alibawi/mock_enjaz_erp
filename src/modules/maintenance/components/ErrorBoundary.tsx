import { Component, type ReactNode } from 'react'
import { ErrorState } from './states'

/** Last line of defence: a crashing screen shows the standard error state instead of a blank page; the route key resets it. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(e: unknown) { return { error: e instanceof Error ? e.message : 'خطأ غير متوقع' } }
  componentDidCatch(e: unknown) { console.error('screen crashed', e) }
  render() {
    if (this.state.error) return <ErrorState message={`حدث خطأ أثناء عرض هذه الشاشة: ${this.state.error}`} onRetry={() => this.setState({ error: null })} />
    return this.props.children
  }
}
