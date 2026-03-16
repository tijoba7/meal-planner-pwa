import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Sentry } from '../lib/sentry'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } })
  }

  componentDidMount() {
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection)
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection)
  }

  private handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error('[ErrorBoundary] Unhandled async error:', event.reason)
    Sentry.captureException(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason))
    )
  }

  private reset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
          <div className="flex flex-col items-center text-center max-w-sm">
            <div className="w-20 h-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
              <AlertTriangle
                size={36}
                strokeWidth={1.5}
                className="text-red-400 dark:text-red-500"
                aria-hidden="true"
              />
            </div>
            <p className="text-base font-semibold text-gray-700 dark:text-gray-200">
              Something went wrong
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              An unexpected error occurred. Your data is safe.
            </p>
            {this.state.error.message && (
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-2 font-mono break-all">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.reset}
              className="mt-5 flex items-center gap-2 bg-green-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-green-700 transition-colors"
            >
              <RefreshCw size={16} />
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
