import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Ditampilkan bila anak gagal render. Default: tidak menampilkan apa-apa. */
  fallback?: ReactNode
}

/** Menangkap error render di subtree supaya tidak menjatuhkan seluruh halaman. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.warn('ErrorBoundary:', error, info.componentStack)
  }

  render(): ReactNode {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}
