import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { STORAGE_KEY } from './saveLoad.js';

interface Props {
  children: ReactNode;
}

interface State {
  failure: Error | null;
  /** Bumped to throw the whole game subtree away and mount it fresh. */
  attempt: number;
}

/** Catches a render crash anywhere in the game and shows a pixel-style panel instead of a white screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failure: null, attempt: 0 };

  static getDerivedStateFromError(failure: Error): Partial<State> {
    return { failure };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('The game crashed', error, info.componentStack);
  }

  private restart = (clearSave: boolean): void => {
    if (clearSave) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // storage unavailable: nothing to clear
      }
    }
    this.setState((s) => ({ failure: null, attempt: s.attempt + 1 }));
  };

  render(): ReactNode {
    if (!this.state.failure) return <div key={this.state.attempt} style={{ display: 'contents' }}>{this.props.children}</div>;
    return (
      <div className="screen crash-screen" data-screen="crash" role="alert">
        <div className="panel panel--stone step-8 crash-panel">
          <h1 className="plaque plaque--blood">Something went wrong</h1>
          <p className="crash-text">The game hit an unexpected error. Your saved run is kept unless you clear it.</p>
          <pre className="well crash-detail">{this.state.failure.message}</pre>
          <div className="toolbar crash-actions">
            <button className="btn btn--l btn--primary" onClick={() => this.restart(false)}>
              Back to menu
            </button>
            <button className="btn btn--l btn--danger" onClick={() => this.restart(true)}>
              Clear save and restart
            </button>
          </div>
        </div>
      </div>
    );
  }
}
