import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const platformDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workerDirectory = path.join(platformDirectory, 'workers', 'arena');
const workerBuildArguments = ['--release', '--no-panic-recovery', '--no-opt'];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: workerDirectory,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const nativeWorkerBuild = spawnSync('worker-build', ['--version'], {
  cwd: workerDirectory,
  stdio: 'ignore',
  shell: false,
});

if (!nativeWorkerBuild.error && nativeWorkerBuild.status === 0) {
  run('worker-build', workerBuildArguments);
} else {
  run('docker', [
    'run', '--rm', '--init',
    '-v', `${platformDirectory}:/workspace`,
    '-v', 'othello-cargo-registry2:/usr/local/cargo/registry',
    '-v', 'othello-cargo-target2:/workspace/target',
    '-v', 'othello-cargo-tools:/cargo-tools',
    '-w', '/workspace/workers/arena',
    'rust:1.97', 'sh', '-lc',
    'export PATH=/cargo-tools/bin:/usr/local/cargo/bin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; if [ ! -x /cargo-tools/bin/worker-build ]; then cargo install --locked --root /cargo-tools worker-build --version 0.8.5; fi; worker-build --release --no-panic-recovery --no-opt',
  ]);
}
