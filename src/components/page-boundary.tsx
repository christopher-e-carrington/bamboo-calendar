import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { isChunkLoadError, recoverFromStaleBundle } from "@/lib/offline/chunk-recovery";

type Props = { children: ReactNode; resetKey?: string };
type State = { error: Error | null };

/**
 * Keeps a crash inside one page from replacing the entire app with the root
 * error screen. Stale-bundle errors self-heal with a cache-clearing reload.
 */
export class PageBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error) {
    console.error(error);
    if (isChunkLoadError(error)) void recoverFromStaleBundle();
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="px-5 py-16 text-center">
        <h2 className="font-display text-xl">This page didn't load</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong showing this page. You can try again or pick another page from the
          menu.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Button size="sm" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Reload app
          </Button>
        </div>
      </div>
    );
  }
}
