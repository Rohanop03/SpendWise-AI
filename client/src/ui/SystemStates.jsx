import { Component, useEffect, useState } from 'react';

import Icon from './Icon.jsx';
import { Pill } from './Pill.jsx';

/** Glass banner shown while the browser reports it is offline. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine === false : false,
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      className="glass glass-solid fixed left-1/2 top-3 z-[70] flex w-[min(30rem,calc(100vw-1.5rem))] -translate-x-1/2 items-start gap-3 rounded-2xl p-4 text-sm font-bold"
      role="status"
    >
      <Icon className="mt-0.5 size-5 shrink-0" name="wifiOff" />
      <span>
        You are offline. SpendWise cannot load or save records until the connection returns.
      </span>
    </div>
  );
}

/** Generic error boundary with a retry pill. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section
        className="mx-auto flex max-w-xl flex-col items-center px-5 py-20 text-center"
        role="alert"
      >
        <div className="obsidian grid size-16 place-items-center rounded-full">
          <Icon className="size-7" name="alert" />
        </div>
        <h1 className="mt-6 text-3xl">Something went wrong on this screen</h1>
        <p className="mt-3 text-(--graphite)">
          Your records are safe. This view failed to render; trying again usually fixes it.
        </p>
        <Pill
          className="mt-7"
          icon="refresh"
          onClick={() => this.setState({ error: null })}
          variant="ink"
        >
          Try again
        </Pill>
      </section>
    );
  }
}
