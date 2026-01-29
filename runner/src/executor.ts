import Docker from 'dockerode';
import { RunnerConfig } from './config.js';
import { logger } from './logger.js';
import { hashCode } from './crypto.js';

interface SubmissionJob {
  submissionId: string;
  language: string;
  code: string;
  problemId: string;
  timeLimit: number;
  memoryLimit: number;
}

interface ExecutionResult {
  submissionId: string;
  verdict: string;
  score?: number;
  executionTime?: number;
  memoryUsed?: number;
  testCasesPassed?: number;
  totalTestCases?: number;
  output?: string;
  error?: string;
}

const LANGUAGE_CONFIG: Record<string, {
  image: string;
  command: string[];
  fileName: string;
  compileCommand?: string[];
}> = {
  cpp: {
    image: 'codecontest/cpp-runner:latest',
    command: ['/bin/sh', '-c', 'g++ -O2 -std=c++17 -o main main.cpp && ./main'],
    fileName: 'main.cpp',
  },
  java: {
    image: 'codecontest/java-runner:latest',
    command: ['/bin/sh', '-c', 'javac Main.java && java Main'],
    fileName: 'Main.java',
  },
  python: {
    image: 'codecontest/python-runner:latest',
    command: ['python3', 'main.py'],
    fileName: 'main.py',
  },
  javascript: {
    image: 'codecontest/nodejs-runner:latest',
    command: ['node', 'main.js'],
    fileName: 'main.js',
  },
  go: {
    image: 'codecontest/go-runner:latest',
    command: ['/bin/sh', '-c', 'go build -o main main.go && ./main'],
    fileName: 'main.go',
  },
  rust: {
    image: 'codecontest/rust-runner:latest',
    command: ['/bin/sh', '-c', 'rustc -O -o main main.rs && ./main'],
    fileName: 'main.rs',
  },
};

const SECCOMP_PROFILE = {
  defaultAction: 'SCMP_ACT_ERRNO',
  architectures: ['SCMP_ARCH_X86_64', 'SCMP_ARCH_X86', 'SCMP_ARCH_AARCH64'],
  syscalls: [
    { names: ['read', 'write', 'open', 'close', 'exit', 'exit_group'], action: 'SCMP_ACT_ALLOW' },
    { names: ['mmap', 'munmap', 'mprotect', 'brk'], action: 'SCMP_ACT_ALLOW' },
    { names: ['execve', 'execveat'], action: 'SCMP_ACT_ALLOW' },
    { names: ['access', 'faccessat'], action: 'SCMP_ACT_ALLOW' },
    { names: ['stat', 'fstat', 'lstat', 'newfstatat'], action: 'SCMP_ACT_ALLOW' },
    { names: ['getdents', 'getdents64'], action: 'SCMP_ACT_ALLOW' },
    { names: ['clock_gettime', 'gettimeofday', 'time'], action: 'SCMP_ACT_ALLOW' },
    { names: ['arch_prctl', 'set_tid_address', 'set_robust_list'], action: 'SCMP_ACT_ALLOW' },
    { names: ['prlimit64', 'getrlimit'], action: 'SCMP_ACT_ALLOW' },
    { names: ['sigaltstack', 'rt_sigaction', 'rt_sigprocmask'], action: 'SCMP_ACT_ALLOW' },
    { names: ['clone', 'wait4', 'waitpid'], action: 'SCMP_ACT_ALLOW' },
    { names: ['pipe', 'pipe2', 'dup', 'dup2'], action: 'SCMP_ACT_ALLOW' },
    { names: ['fcntl', 'ioctl'], action: 'SCMP_ACT_ALLOW' },
    { names: ['getpid', 'getppid', 'getpgrp', 'getuid', 'getgid'], action: 'SCMP_ACT_ALLOW' },
    { names: ['pread64', 'pwrite64', 'readv', 'writev'], action: 'SCMP_ACT_ALLOW' },
    { names: ['lseek'], action: 'SCMP_ACT_ALLOW' },
    { names: ['uname'], action: 'SCMP_ACT_ALLOW' },
    { names: ['sysinfo'], action: 'SCMP_ACT_ALLOW' },
    { names: ['getrandom'], action: 'SCMP_ACT_ALLOW' },
  ],
};

export const processSubmission = async (
  docker: Docker,
  job: SubmissionJob,
  config: RunnerConfig
): Promise<ExecutionResult> => {
  const langConfig = LANGUAGE_CONFIG[job.language];
  
  if (!langConfig) {
    return {
      submissionId: job.submissionId,
      verdict: 'SYSTEM_ERROR',
      error: `Unsupported language: ${job.language}`,
    };
  }

  const containerName = `submission-${job.submissionId}`;
  const codeHash = hashCode(job.code);
  
  try {
    const container = await docker.createContainer({
      Image: langConfig.image,
      name: containerName,
      Cmd: langConfig.command,
      HostConfig: {
        Memory: config.maxMemory,
        MemorySwap: config.maxMemory,
        CpuQuota: 100000,
        CpuPeriod: 100000,
        CpuShares: 512,
        PidsLimit: 32,
        NetworkMode: config.networkDisabled ? 'none' : 'bridge',
        ReadonlyRootfs: true,
        SecurityOpt: [
          'no-new-privileges:true',
          `seccomp=${JSON.stringify(SECCOMP_PROFILE)}`,
        ],
        CapDrop: ['ALL'],
        CapAdd: ['CHOWN', 'SETGID', 'SETUID'],
        Tmpfs: {
          '/tmp': 'rw,noexec,nosuid,size=50m',
        },
      },
      Env: [
        'LANG=C.UTF-8',
        'LC_ALL=C.UTF-8',
        'TZ=UTC',
        'PYTHONDONTWRITEBYTECODE=1',
        'NODE_ENV=production',
      ],
      WorkingDir: '/workspace',
      AttachStdout: true,
      AttachStderr: true,
    });

    const codeBuffer = Buffer.from(job.code);
    await container.putArchive(codeBuffer, {
      path: '/workspace',
    });

    const startTime = Date.now();
    await container.start();

    const stream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
    });

    let output = '';
    let errorOutput = '';

    stream.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8');
      if (chunk[0] === 1) {
        output += text.slice(8);
      } else if (chunk[0] === 2) {
        errorOutput += text.slice(8);
      }
    });

    const timeout = setTimeout(async () => {
      try {
        await container.kill({ signal: 'SIGKILL' });
        logger.warn(`Submission ${job.submissionId} killed due to timeout`);
      } catch (e) {}
    }, job.timeLimit + 2000);

    const result = await container.wait();
    clearTimeout(timeout);

    const executionTime = Date.now() - startTime;
    
    const stats = await container.stats({ stream: false });
    const memoryUsed = stats.memory_stats?.usage || 0;

    await container.remove({ force: true });

    let verdict: string;
    let score = 0;

    if (result.StatusCode === 137 || executionTime > job.timeLimit) {
      verdict = 'TIME_LIMIT_EXCEEDED';
    } else if (memoryUsed > job.memoryLimit * 1024 * 1024) {
      verdict = 'MEMORY_LIMIT_EXCEEDED';
    } else if (result.StatusCode !== 0) {
      if (errorOutput.includes('Compilation error') || errorOutput.includes('SyntaxError')) {
        verdict = 'COMPILATION_ERROR';
      } else {
        verdict = 'RUNTIME_ERROR';
      }
    } else {
      verdict = 'ACCEPTED';
      score = 100;
    }

    return {
      submissionId: job.submissionId,
      verdict,
      score,
      executionTime,
      memoryUsed,
      testCasesPassed: verdict === 'ACCEPTED' ? 1 : 0,
      totalTestCases: 1,
      output: output.slice(0, 10000),
      error: errorOutput.slice(0, 10000),
    };
  } catch (error) {
    logger.error(`Execution failed for ${job.submissionId}:`, error);
    
    try {
      const container = docker.getContainer(containerName);
      await container.remove({ force: true });
    } catch (e) {}

    return {
      submissionId: job.submissionId,
      verdict: 'SYSTEM_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
