export type AnkiRating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy
export type CardState = 0 | 1 | 2 | 3; // 0: New, 1: Learning, 2: Review, 3: Relearning

export interface CardProgress {
  state: CardState;
  interval: number; // in days. If 0, it means the card is in a learning step (minutes).
  easeFactor: number; // e.g. 2.5 (250%)
  lapses: number;
  repetitions: number;
}

export interface ReviewOutcome {
  progress: CardProgress;
  nextReviewDate: Date;
}

/**
 * Implements the standard Anki SM-2 spaced repetition algorithm.
 */
export function calculateAnkiReview(
  current: CardProgress,
  rating: AnkiRating,
  now: Date = new Date()
): ReviewOutcome {
  let { state, interval, easeFactor, lapses, repetitions } = current;

  // Defaults if data is missing or corrupted
  if (state === undefined) state = 0;
  if (interval === undefined) interval = 0;
  if (easeFactor === undefined || easeFactor < 1.3) easeFactor = 2.5;
  if (lapses === undefined) lapses = 0;
  if (repetitions === undefined) repetitions = 0;

  let nextDate = new Date(now);
  let isLearning = state === 0 || state === 1 || state === 3;

  if (isLearning) {
    // Learning or Relearning phase
    if (rating === 1) { // Again
      state = state === 3 ? 3 : 1; // Stay in relearning or enter learning
      nextDate.setTime(now.getTime() + 1 * 60 * 1000); // 1 minute step
      repetitions = 0;
    } else if (rating === 2) { // Hard
      state = state === 3 ? 3 : 1;
      nextDate.setTime(now.getTime() + 5 * 60 * 1000); // 5 minute step
    } else if (rating === 3) { // Good
      state = 2; // Graduate to Review
      interval = 1; // 1 day
      nextDate = getLogicalDayAt3AM(now, interval);
      repetitions += 1;
    } else if (rating === 4) { // Easy
      state = 2; // Graduate to Review
      let nextIvl = 4; // 4 days (easy interval)
      interval = applyFuzz(nextIvl);
      easeFactor += 0.15; // Bonus for early easy
      nextDate = getLogicalDayAt3AM(now, interval);
      repetitions += 1;
    }
  } else {
    // Review phase (state === 2)
    if (rating === 1) { // Again
      state = 3; // Relearning
      lapses += 1;
      easeFactor = Math.max(1.3, easeFactor - 0.20);
      interval = 0; // Reset interval to 0 (minutes based)
      nextDate.setTime(now.getTime() + 10 * 60 * 1000); // 10 minute step
      repetitions = 0;
    } else if (rating === 2) { // Hard
      easeFactor = Math.max(1.3, easeFactor - 0.15);
      let nextIvl = Math.max(interval + 1, Math.round(interval * 1.2));
      interval = applyFuzz(nextIvl);
      nextDate = getLogicalDayAt3AM(now, interval);
      repetitions += 1;
    } else if (rating === 3) { // Good
      let nextIvl = Math.max(interval + 1, Math.round(interval * easeFactor));
      interval = applyFuzz(nextIvl);
      nextDate = getLogicalDayAt3AM(now, interval);
      repetitions += 1;
    } else if (rating === 4) { // Easy
      easeFactor += 0.15;
      let nextIvl = Math.max(interval + 1, Math.round(interval * easeFactor * 1.3));
      interval = applyFuzz(nextIvl);
      nextDate = getLogicalDayAt3AM(now, interval);
      repetitions += 1;
    }
  }

  return {
    progress: {
      state,
      interval,
      easeFactor,
      lapses,
      repetitions
    },
    nextReviewDate: nextDate
  };
}

/**
 * Returns the date `interval` days from now, set to 03:00:00 AM local time,
 * using the 3:00 AM cutoff as the day boundary.
 */
function getLogicalDayAt3AM(now: Date, intervalInDays: number): Date {
  let logicalDate = new Date(now);
  // If before 3 AM, treat as previous day for scheduling purposes
  if (logicalDate.getHours() < 3) {
    logicalDate.setDate(logicalDate.getDate() - 1);
  }
  logicalDate.setDate(logicalDate.getDate() + intervalInDays);
  logicalDate.setHours(3, 0, 0, 0);
  return logicalDate;
}

/**
 * Applies a random "fuzz" factor to the interval to prevent cards
 * reviewed together from sticking together forever.
 */
function applyFuzz(interval: number): number {
  if (interval < 2) return interval;

  let fuzz = 0;
  if (interval === 2) {
    // interval 2 gets a fuzz of 1 -> range [2, 3] Wait, 2-1 = 1, so range [1, 3]?
    // Anki specifically gives range [2, 3] for ivl=2, meaning +0 or +1.
    // So fuzz = 1 is applied but lower bound is kept at 2.
    // Let's implement Anki's precise formula:
    const min = 2;
    const max = 3;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  } else if (interval < 7) {
    fuzz = Math.round(interval * 0.25);
  } else if (interval < 30) {
    fuzz = Math.max(2, Math.round(interval * 0.15));
  } else {
    fuzz = Math.max(4, Math.round(interval * 0.05));
  }

  // Ensure minimum interval is 1 just in case, but generally it's larger
  const min = Math.max(1, interval - fuzz);
  const max = interval + fuzz;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

