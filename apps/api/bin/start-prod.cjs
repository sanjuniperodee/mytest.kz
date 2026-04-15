'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const apiRoot = path.resolve(__dirname, '..');
const mainJs = path.join(apiRoot, 'dist', 'main.js');

function resolveNestCli() {
  try {
    return require.resolve('@nestjs/cli/bin/nest.js', { paths: [apiRoot] });
  } catch {
    return null;
  }
}

function ensureBuilt() {
  if (fs.existsSync(mainJs)) return;

  console.error(
    '[@bilimland/api] dist/main.js is missing — running nest build in this workspace.\n' +
      '  Tip: after deploy run from repo root: npx turbo run build --filter=@bilimland/api --force',
  );

  const nestCli = resolveNestCli();
  if (!nestCli) {
    console.error(
      '[@bilimland/api] @nestjs/cli not found (devDependency). Install without --omit=dev, or build on the server:\n' +
        '  cd /path/to/bilimland && npx turbo run build --filter=@bilimland/api --force',
    );
    process.exit(1);
  }

  // If dist was removed but incremental info remains, `tsc` emits nothing (exit 0).
  const tsBuildInfo = path.join(apiRoot, 'tsconfig.build.tsbuildinfo');
  if (fs.existsSync(tsBuildInfo)) {
    try {
      fs.unlinkSync(tsBuildInfo);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[@bilimland/api] Could not remove tsconfig.build.tsbuildinfo:', msg);
      process.exit(1);
    }
  }

  const r = spawnSync(process.execPath, [nestCli, 'build'], {
    stdio: 'inherit',
    cwd: apiRoot,
    env: process.env,
    shell: false,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
  if (!fs.existsSync(mainJs)) {
    console.error('[@bilimland/api] nest build exited ok but dist/main.js is still missing.');
    process.exit(1);
  }
}

ensureBuilt();

try {
  execFileSync(process.execPath, [mainJs], { stdio: 'inherit', cwd: apiRoot, env: process.env });
} catch (e) {
  process.exit(typeof e.status === 'number' ? e.status : 1);
}
