import { chromium } from './browser.mjs';
import { SOURCE } from './policy.mjs';
import { requireThat } from './canonical.mjs';

// Real Chromium network navigation. No injection, routes, stored response, APIRequest
// replacement, user profile, exposed signing endpoint, or caller-selected URL.
export async function capture(executablePath) {
  const browser = await chromium.launch({ headless: true, executablePath });
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: false, serviceWorkers: 'block', javaScriptEnabled: false });
    const page = await context.newPage();
    const response = await page.goto(SOURCE, { waitUntil: 'load', timeout: 60000 });
    requireThat(response && response.url() === SOURCE && response.status() === 200, 'capture: expected exact HTTPS source and 200');
    requireThat(response.request().redirectedFrom() === null && response.request().method() === 'GET', 'capture: redirects forbidden');
    const security = await response.securityDetails();
    requireThat(security && security.protocol.startsWith('TLS'), 'capture: TLS evidence missing');
    const body = await response.body();
    requireThat(body.length > 0 && body.length <= 1024 * 1024, 'capture: body size limit');
    return { body, browserVersion: browser.version(), tlsProtocol: security.protocol };
  } finally { await browser.close(); }
}
