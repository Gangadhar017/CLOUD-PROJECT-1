import Docker from 'dockerode';
import { createSigner } from './crypto.js';
import { logger } from './logger.js';
import { processSubmission } from './executor.js';
import { registerRunner, heartbeat } from './registry.js';
import { loadConfig } from './config.js';

const config = loadConfig();

const docker = new Docker({
  socketPath: config.dockerSocket,
});

const signer = createSigner(config.privateKey);

const RUNNER_ID = config.runnerId;
const CONCURRENCY = config.concurrency;

const activeContainers = new Map<string, Docker.Container>();

const cleanupContainer = async (containerId: string) => {
  try {
    const container = docker.getContainer(containerId);
    await container.stop({ t: 5 });
    await container.remove({ force: true });
    activeContainers.delete(containerId);
    logger.info(`Container ${containerId} cleaned up`);
  } catch (error) {
    logger.error(`Failed to cleanup container ${containerId}:`, error);
  }
};

const cleanupAllContainers = async () => {
  logger.info('Cleaning up all containers...');
  for (const [id, container] of activeContainers) {
    await cleanupContainer(id);
  }
};

const processJob = async (job: any) => {
  const containerId = `runner-${RUNNER_ID}-${job.submissionId}`;
  
  try {
    const result = await processSubmission(docker, job, config);
    
    const signedResult = {
      ...result,
      runnerId: RUNNER_ID,
      signature: signer.sign(JSON.stringify(result)),
    };

    await fetch(`${config.apiUrl}/api/runner/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Runner-ID': RUNNER_ID,
        'X-Runner-Signature': signedResult.signature,
      },
      body: JSON.stringify(signedResult),
    });

    logger.info(`Submission ${job.submissionId} processed: ${result.verdict}`);
  } catch (error) {
    logger.error(`Failed to process submission ${job.submissionId}:`, error);
    
    await fetch(`${config.apiUrl}/api/runner/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Runner-ID': RUNNER_ID,
      },
      body: JSON.stringify({
        submissionId: job.submissionId,
        verdict: 'SYSTEM_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    });
  }
};

const pollQueue = async () => {
  try {
    const response = await fetch(`${config.apiUrl}/api/runner/job`, {
      headers: {
        'X-Runner-ID': RUNNER_ID,
        'X-Runner-Signature': signer.sign('job-request'),
      },
    });

    if (!response.ok) {
      if (response.status !== 204) {
        logger.warn(`Failed to fetch job: ${response.status}`);
      }
      return;
    }

    const job = await response.json();
    
    if (activeContainers.size >= CONCURRENCY) {
      logger.warn('Max concurrency reached, skipping job');
      return;
    }

    processJob(job);
  } catch (error) {
    logger.error('Failed to poll queue:', error);
  }
};

const main = async () => {
  logger.info(`Starting runner ${RUNNER_ID}...`);

  await registerRunner(RUNNER_ID, config);

  setInterval(() => heartbeat(RUNNER_ID, config), 30000);
  setInterval(pollQueue, 1000);

  logger.info(`Runner ${RUNNER_ID} started with concurrency ${CONCURRENCY}`);
};

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  await cleanupAllContainers();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down...');
  await cleanupAllContainers();
  process.exit(0);
});

main().catch((error) => {
  logger.error('Runner failed:', error);
  process.exit(1);
});
