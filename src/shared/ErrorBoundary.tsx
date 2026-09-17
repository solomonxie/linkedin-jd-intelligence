import { Component, type ErrorInfo, type ReactNode } from "react";

/** A throw during render unmounts the whole React tree, leaving an empty document with nothing to
 * act on — indistinguishable from "the scripts never loaded". This keeps the failure on screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Side panel crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty-state">
        <p>Something went wrong rendering this panel.</p>
        <p className="muted">{this.state.error.message}</p>
        <button type="button" className="btn-primary" onClick={() => location.reload()}>
          Reload panel
        </button>
      </div>
    );
  }
}
