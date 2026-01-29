import { RunnerConfig } from './config.js';
import { logger } from './logger.js';

export const registerRunner = async (runnerId: string, config: RunnerConfig): Promise<void> => {
  try {
    const response = await fetch(`${config.apiUrl}/api/runner/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        runnerId,
        publicKey: config.publicKey,
        capabilities: ['cpp', 'java', 'python', 'javascript', 'go', 'rust'],
        maxConcurrency: config.concurrency,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to register: ${response.status}`);
    }

    logger.info(`Runner ${runnerId} registered successfully`);
  } catch (error) {
    logger.error('Failed to register runner:', error);
    throw error;
  }
};

export const heartbeat = async (runnerId: string, config: RunnerConfig): Promise<void> => {
  try {
    const response = await fetch(`${config.apiUrl}/api/runner/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Runner-ID': runnerId,
      },
      body: JSON.stringify({
        runnerId,
        timestamp: Date.now(),
        status: 'healthy',
      }),
    });

    if (!response.ok) {
      logger.warn(`Heartbeat failed: ${response.status}`);
    }
  } catch (error) {
    logger.error('Heartbeat error:', error);
  }
};
