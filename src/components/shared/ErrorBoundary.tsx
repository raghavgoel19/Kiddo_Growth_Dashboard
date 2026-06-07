import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onRetry?: () => void
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Section error:', error, info)
  }

  handleRetry = () => {
    this.setState({ hasError: false, message: '' })
    this.props.onRetry?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="rounded-card border border-red-200 bg-red-50 p-6 text-center text-red-700">
            <p className="font-medium">Failed to render this section</p>
            <p className="mt-1 text-sm text-red-500">{this.state.message}</p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )
      )
    }
    return this.props.children
  }
}
