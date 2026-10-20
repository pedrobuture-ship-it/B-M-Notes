import { Component, type ReactNode } from "react";
import { tr } from "@/lib/i18n";

interface Props {
  children: ReactNode;
  /** Changing it clears the error (e.g. the open note or view). */
  resetKey: string;
  onBack?: () => void;
}

interface State {
  error: Error | null;
  key: string;
}

/** Keeps one broken view from blanking the whole window; shows the error instead. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="empty h-full" role="alert">
        <p className="hand">{tr("Something broke while showing this.")}</p>
        <code style={{ maxWidth: 520, whiteSpace: "pre-wrap", color: "var(--ink-faint)" }}>{error.message}</code>
        <div className="flex gap-2">
          <button className="btn" onClick={() => this.setState({ error: null })}>{tr("Try again")}</button>
          {this.props.onBack && <button className="btn" onClick={this.props.onBack}>{tr("Back to the mural")}</button>}
        </div>
      </div>
    );
  }
}
