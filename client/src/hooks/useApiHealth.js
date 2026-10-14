import { useEffect, useState } from 'react';

import { getApiHealth } from '../api/health.js';
import { getApiErrorMessage } from '../api/http.js';

const initialState = {
  message: 'Checking the SpendWise API connection…',
  state: 'checking',
};

export function useApiHealth() {
  const [connection, setConnection] = useState(initialState);

  useEffect(() => {
    const controller = new AbortController();

    async function checkConnection() {
      try {
        const health = await getApiHealth({ signal: controller.signal });

        if (health.status !== 'ok') {
          throw new Error('Unexpected API health response');
        }

        setConnection({
          message: 'Backend connected',
          state: 'connected',
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setConnection({
          message: getApiErrorMessage(error),
          state: 'unavailable',
        });
      }
    }

    checkConnection();

    return () => controller.abort();
  }, []);

  return connection;
}
