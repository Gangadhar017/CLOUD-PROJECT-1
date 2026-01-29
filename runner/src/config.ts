import { readFileSync } from 'fs';
import { join } from 'path';
import { generateKeyPairSync } from 'crypto';

export interface RunnerConfig {
  runnerId: string;
  privateKey: string;
  publicKey: string;
  apiUrl: string;
  dockerSocket: string;
  concurrency: number;
  maxExecutionTime: number;
  maxMemory: number;
  networkDisabled: boolean;
}

export const loadConfig = (): RunnerConfig => {
  const runnerId = process.env.RUNNER_ID || generateRunnerId();
  
  let privateKey: string;
  let publicKey: string;
  
  try {
    privateKey = readFileSync(process.env.PRIVATE_KEY_PATH || '/secrets/runner-key', 'utf-8');
    publicKey = readFileSync(process.env.PUBLIC_KEY_PATH || '/secrets/runner-key.pub', 'utf-8');
  } catch (error) {
    const keys = generateKeyPair();
    privateKey = keys.privateKey;
    publicKey = keys.publicKey;
  }

  return {
    runnerId,
    privateKey,
    publicKey,
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    dockerSocket: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
    concurrency: parseInt(process.env.CONCURRENCY || '4', 10),
    maxExecutionTime: parseInt(process.env.MAX_EXECUTION_TIME || '10000', 10),
    maxMemory: parseInt(process.env.MAX_MEMORY || '536870912', 10),
    networkDisabled: process.env.NETWORK_DISABLED !== 'false',
  };
};

const generateRunnerId = (): string => {
  return `runner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const generateKeyPair = () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  return { privateKey, publicKey };
};
