import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result } from 'antd';

type Props = { children: ReactNode };
type State = { hasError: boolean; error?: Error };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 48 }}>
          <Result
            status="error"
            title="Something went wrong"
            subTitle={this.state.error?.message || 'An unexpected error occurred'}
            extra={[
              <Button key="reload" type="primary" onClick={() => window.location.reload()}>
                Reload Page
              </Button>,
              <Button key="home" onClick={() => { window.location.href = '/'; }}>
                Go Home
              </Button>,
            ]}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
