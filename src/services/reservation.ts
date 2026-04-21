import { appendFileSync } from 'fs';
import { Page, ElementHandle } from 'puppeteer';
import {
  ButtonText,
  ReservationPreferences,
  ReservationResult,
  WeekDay,
} from '../types';
import { availableDays } from '../config';

export function parsePreferenceValue(value: string | null): {
  time: string | null;
  className: string | null;
} {
  if (!value) return { time: null, className: null };
  const [time, className] = value.split('|');
  return { time: time.trim() || null, className: className?.trim() || null };
}

export async function goToReservations(page: Page): Promise<void> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayInSeconds = Math.floor(today.getTime() / 1000);

  const currentUrl = page.url();
  const currentDomain = new URL(currentUrl).origin;

  await page.goto(`${currentDomain}/athlete/reservas.aspx?t=${todayInSeconds}`);
  await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
}

export async function getReservationState(
  reservationButton: ElementHandle<Element>
): Promise<ButtonText | null> {
  const rawText = await reservationButton.evaluate(el => {
    const span = el.querySelector('span');
    const text = (span?.textContent ?? el.textContent ?? '').trim();
    const normalized = text.replace(/\s*\(\d+\)$/, '').trim();
    // Normalizar textos del gimnasio al tipo ButtonText
    if (normalized === 'Reservar') return 'Entrenar';
    if (normalized === 'Eliminar') return 'Borrar';
    return normalized;
  });
  return rawText as ButtonText | null;
}

export function getReservationKey(time: string): string {
  return `h${time.replace(':', '')}00`;
}

export async function goToNextDay(page: Page): Promise<void> {
  await page.waitForSelector('a.next');
  await page.click('a.next');
  await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
}

export async function getDateLabel(date: Date): Promise<string> {
  return Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

async function findReservationButton(
  page: Page,
  reservationKey: string,
  className: string | null
): Promise<ElementHandle<Element> | null> {
  const buttonIndices = await page.evaluate((key: string, cls: string | null) => {
    const anchor = document.getElementById(key);
    // DEBUG: log what we find
    const allAnchors = Array.from(document.querySelectorAll('.horaAnchor')).map(el => (el as HTMLElement).id);
    const allClases = Array.from(document.querySelectorAll('[id^="clase"]')).map(el => (el as HTMLElement).id);
    if (!anchor) return { error: `anchor ${key} not found. Available anchors: ${allAnchors.join(',')}`, results: [], clases: allClases };

    const container = anchor.parentElement;
    if (!container) return { error: 'no parent', results: [], clases: allClases };

    const results: { index: number; name: string }[] = [];
    const allButtons = Array.from(document.querySelectorAll('button'));

    const claseDivs = Array.from(container.querySelectorAll('[id^="clase"]'));
    for (const claseDiv of claseDivs) {
      const nameEl = claseDiv.querySelector('h3.entrenamiento');
      const btn = claseDiv.querySelector('button.entrenar, button.avisar, button.borrar');
      if (btn) {
        results.push({
          index: allButtons.indexOf(btn as HTMLButtonElement),
          name: nameEl?.textContent?.trim() ?? '',
        });
      }
    }
    return { error: null, results, clases: allClases };
  }, reservationKey, className);

  if (buttonIndices.length === 0) return null;

  const allButtons = await page.$$('button');

  if (!className || buttonIndices.length === 1) {
    return allButtons[buttonIndices[0].index] ?? null;
  }

  const match = buttonIndices.find(b =>
    b.name.toLowerCase().includes(className.toLowerCase())
  );

  if (!match) {
    console.log(`⚠️ Class "${className}" not found at this time slot — using first available`);
    return allButtons[buttonIndices[0].index] ?? null;
  }

  return allButtons[match.index] ?? null;
}

export async function makeReservation(
  page: Page,
  preference: string | null,
  weekDay: string,
  dateLabel: string
): Promise<ReservationResult> {
  const { time, className } = parsePreferenceValue(preference);
  const pageTitle = await page.$('.mainTitle');
  const pageTitleText = (await pageTitle?.evaluate(el => el.textContent)) ?? '';

  if (!time) {
    return {
      success: false,
      message: `📅 No time scheduled for ${weekDay}s`,
      weekDay,
    };
  }

  const reservationKey = getReservationKey(time);
  const reservationButton = await findReservationButton(
    page,
    reservationKey,
    className
  );

  if (!reservationButton) {
    return {
      success: false,
      message: `🔍 No reservation slot found for ${dateLabel} at ${time}`,
      weekDay,
      time,
    };
  }

  const state = await getReservationState(reservationButton);

  if (!state) {
    return {
      success: false,
      message: `⚠️ Unable to determine reservation status for ${dateLabel} at ${time}`,
      weekDay,
      time,
    };
  }

  const result: ReservationResult = {
    success: true,
    message: '',
    weekDay,
    time,
    state,
  };

  switch (state) {
    case 'Entrenar':
      await reservationButton.click();
      await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
      result.message = `✅ ${pageTitleText} - Successfully booked! 💪`;
      break;
    case 'Avisar':
      await reservationButton.click();
      await page.waitForNetworkIdle({ timeout: 5000 }).catch(() => {});
      result.message = `⏳ ${pageTitleText} - Added to waiting list. Fingers crossed! 🤞`;
      break;
    case 'Cambiar':
      result.message = `⚠️ ${pageTitleText} - You're already booked for a different time slot`;
      result.success = false;
      break;
    case 'Finalizada':
      result.message = `❌ ${pageTitleText} - This class has already finished`;
      result.success = false;
      break;
    case 'Borrar':
      result.message = `ℹ️ ${pageTitleText} - You're already booked`;
      result.success = false;
      break;
  }

  return result;
}

function writeJobSummary(
  dayResults: Array<{ weekDay: string; result: ReservationResult }>,
  counts: {
    booked: number;
    waitlisted: number;
    alreadyBooked: number;
    skipped: number;
    other: number;
  }
) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  const statusLabel = (result: ReservationResult): string => {
    if (!result.time) return '⏭️ Skipped';
    if (result.state === 'Entrenar' && result.success) return '✅ Booked';
    if (result.state === 'Avisar' && result.success) return '⏳ Waitlisted';
    if (result.state === 'Borrar') return 'ℹ️ Already booked';
    if (result.state === 'Finalizada') return '❌ Class already finished';
    if (result.state === 'Cambiar') return '⚠️ Booked at a different time';
    return '🔍 Slot not found';
  };

  const rows = dayResults.map(({ weekDay, result }) => {
    const day = weekDay.charAt(0).toUpperCase() + weekDay.slice(1);
    const time = result.time ?? '—';
    return `| ${day} | ${time} | ${statusLabel(result)} |`;
  });

  const totals = [
    counts.booked > 0 ? `**${counts.booked} booked**` : null,
    counts.waitlisted > 0 ? `${counts.waitlisted} waitlisted` : null,
    counts.alreadyBooked > 0 ? `${counts.alreadyBooked} already booked` : null,
    counts.skipped > 0 ? `${counts.skipped} skipped` : null,
    counts.other > 0 ? `${counts.other} other` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const lines = [
    '## 🏋️ AutoWOD Booking Results',
    '',
    '| Day | Time | Status |',
    '|-----|------|--------|',
    ...rows,
    '',
    totals,
    '',
  ];

  appendFileSync(summaryFile, lines.join('\n'));
}

export async function processReservations(
  page: Page,
  preferences: ReservationPreferences
): Promise<void> {
  const dayResults: Array<{ weekDay: string; result: ReservationResult }> = [];
  let booked = 0;
  let waitlisted = 0;
  let alreadyBooked = 0;
  let other = 0;
  let skipped = 0;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < availableDays; i++) {
    const dayDate = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
    const weekDay = dayDate
      .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
      .toLowerCase();
    const dateLabel = await getDateLabel(dayDate);

    console.log(`🗓️ Checking ${weekDay} ${dateLabel}...`);

    const preference = preferences[weekDay as WeekDay];
    const result = await makeReservation(page, preference, weekDay, dateLabel);
    dayResults.push({ weekDay, result });
    console.log(result.message);

    if (!preference) {
      skipped++;
    } else if (result.state === 'Entrenar' && result.success) {
      booked++;
    } else if (result.state === 'Avisar' && result.success) {
      waitlisted++;
    } else if (result.state === 'Borrar') {
      alreadyBooked++;
    } else {
      other++;
    }

    const isLastDay = i === availableDays - 1;
    if (!isLastDay) await goToNextDay(page);
  }

  console.log(
    `📊 Summary -> booked: ${booked}, waitlist: ${waitlisted}, already booked: ${alreadyBooked}, skipped (no time): ${skipped}, other: ${other}`
  );

  writeJobSummary(dayResults, {
    booked,
    waitlisted,
    alreadyBooked,
    skipped,
    other,
  });
}
