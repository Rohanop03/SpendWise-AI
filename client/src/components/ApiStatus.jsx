import { useApiHealth } from '../hooks/useApiHealth.js';

const statusStyles = {
  checking: {
    dot: 'bg-amber-300',
    panel: 'border-amber-300/25 bg-amber-300/10 text-amber-100',
    title: 'Checking connection',
  },
  connected: {
    dot: 'bg-emerald-300',
    panel: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100',
    title: 'API online',
  },
  unavailable: {
    dot: 'bg-rose-300',
    panel: 'border-rose-300/25 bg-rose-300/10 text-rose-100',
    title: 'API unavailable',
  },
};

function ApiStatus() {
  const connection = useApiHealth();
  const styles = statusStyles[connection.state];

  return (
    <div
      aria-live="polite"
      className={`inline-flex items-center gap-3 rounded-full border px-4 py-2.5 text-sm ${styles.panel}`}
      role="status"
    >
      <span className={`size-2.5 shrink-0 rounded-full ${styles.dot}`} aria-hidden="true" />
      <span>
        <span className="font-semibold">{styles.title}</span>
        <span className="hidden text-white/65 sm:inline"> · {connection.message}</span>
      </span>
    </div>
  );
}

export default ApiStatus;
