import { Page } from 'puppeteer';

export async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.type('#body_body_CtlLogin_IoEmail', email);
  await page.type('#body_body_CtlLogin_IoPassword', password);
  await Promise.all([
    page.waitForNavigation({ timeout: 60000 }),
    page.click('#body_body_CtlLogin_CtlAceptar'),
  ]);

  // click in "Don't remember this browser" (second button in the device choice)
  const secondButtonSelector = '#body_body_CtlUp label.button:nth-of-type(2)';
  const secondButton = await page.$(secondButtonSelector);
  if (secondButton) {
    await secondButton.click();
    await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
  }
}
