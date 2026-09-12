import { spawnSync } from 'node:child_process';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '0';
const result = spawnSync(process.execPath, ['node_modules/playwright/cli.js', 'install', 'chromium'], { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
