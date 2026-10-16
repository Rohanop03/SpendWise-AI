import { useApiHealth } from '../hooks/useApiHealth.js';
import { StateDot } from '../ui/Status.jsx';

const statusStyles = {
  checking: { dot: 'half', title: 'Checking connection' },
  connected: { dot: 'solid', title: 'API online' },
  unavailable: { dot: 'cross', title: 'API unavailable' },
};

/** Backend connectivity chip (GET /health). State is shown by glyph + label, never colour. */
function ApiStatus() {
  const connection = useApiHealth();
  const styles = statusStyles[connection.state];

  return (
    <div
      aria-live="polite"
      className="neu-pressed depth-1 inline-flex items-center gap-2.5 rounded-full px-3.5 py-2 text-sm"
      role="status"
    >
      <StateDot kind={styles.dot} />
      <span>
        <span className="font-bold">{styles.title}</span>
        <span className="hidden text-(--graphite) sm:inline"> · {connection.message}</span>
      </span>
    </div>
  );
}

export default ApiStatus;
