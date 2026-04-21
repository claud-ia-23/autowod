import { Page, ConsoleMessage } from 'puppeteer';
import { Solver } from '@2captcha/captcha-solver';
import { readFileSync } from 'fs';
import { join } from 'path';

const solver = new Solver(process.env.TWO_CAPTCHA_API_KEY ?? '');

async function waitForCaptchaAndSolve(page: Page): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      page.off('console', handleConsole);
      reject(new Error('Captcha solution timeout after 60 seconds'));
    }, 60000);

    const handleConsole = async (msg: ConsoleMessage) => {
      const txt = msg.text();
      if (txt.includes('intercepted-params:')) {
        try {
          const params = JSON.parse(txt.replace('intercepted-params:', ''));
          console.log('Captcha params intercepted:', params);

          console.log('Solving the captcha...');
          const res = await solver.cloudflareTurnstile(params);
          console.log(`Solved the captcha ${res.id}`);

          await page.evaluate((token: string) => {
            // @ts-expect-error - cfCallback is injected by our script
            window.cfCallback(token);
          }, res.data);

          await page.waitForNetworkIdle();

          clearTimeout(timeout);
          page.off('console', handleConsole);
          resolve();
        } catch (e) {
          clearTimeout(timeout);
          page.off('console', handleConsole);
          reject(e);
        }
      }
    };

    page.on('console', handleConsole);
  });
}

export async function solveCaptchaFlow(
  page: Page,
  url: string,
  maxAttempts = 3
): Promise<void> {
  const preloadFile = readFileSync(
    join(process.cwd(), 'src/scripts/captcha-interceptor.js'),
    'utf8'
  );
  await page.evaluateOnNewDocument(preloadFile);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await page.goto(url);
      await waitForCaptchaAndSolve(page);
      return;
    } catch (e) {
      if (attempt === maxAttempts) throw e;
      console.log(
        `⚠️ Captcha attempt ${attempt}/${maxAttempts} failed: ${e instanceof Error ? e.message : e}. Retrying in 5 seconds...`
      );
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}
