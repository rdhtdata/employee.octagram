interface AttemptRecord {
  count: number;
  lockedUntil: number | null;
  lastAttempt: number;
}

const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// In-memory store for high-performance zero-overhead lockout tracking
const attemptsStore = new Map<string, AttemptRecord>();

// Clean up stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attemptsStore.entries()) {
    if (record.lockedUntil && record.lockedUntil < now && now - record.lastAttempt > LOCKOUT_DURATION_MS * 2) {
      attemptsStore.delete(key);
    } else if (!record.lockedUntil && now - record.lastAttempt > LOCKOUT_DURATION_MS) {
      attemptsStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

function getKeys(email: string, ip?: string): string[] {
  const keys: string[] = [];
  const normalizedEmail = email.toLowerCase().trim();
  if (normalizedEmail) keys.push(`email:${normalizedEmail}`);
  if (ip && ip !== '::1' && ip !== '127.0.0.1') keys.push(`ip:${ip}`);
  return keys;
}

export const LoginRateLimiter = {
  /**
   * Checks if an email or IP address is currently locked out.
   */
  checkLockout(email: string, ip?: string): { isLocked: boolean; remainingSeconds: number } {
    const now = Date.now();
    const keys = getKeys(email, ip);

    for (const key of keys) {
      const record = attemptsStore.get(key);
      if (record && record.lockedUntil && record.lockedUntil > now) {
        const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
        return { isLocked: true, remainingSeconds };
      }
    }

    return { isLocked: false, remainingSeconds: 0 };
  },

  /**
   * Records a failed login attempt. If attempts reach 3, locks the account for 5 minutes.
   */
  recordFailure(email: string, ip?: string): { isLocked: boolean; remainingAttempts: number; remainingSeconds: number } {
    const now = Date.now();
    const keys = getKeys(email, ip);
    let isNowLocked = false;
    let maxRemainingSeconds = 0;
    let minRemainingAttempts = MAX_FAILED_ATTEMPTS;

    for (const key of keys) {
      let record = attemptsStore.get(key);
      if (!record || (record.lockedUntil && record.lockedUntil <= now)) {
        record = { count: 0, lockedUntil: null, lastAttempt: now };
      }

      record.count += 1;
      record.lastAttempt = now;

      if (record.count >= MAX_FAILED_ATTEMPTS) {
        record.lockedUntil = now + LOCKOUT_DURATION_MS;
        isNowLocked = true;
        const remainingSec = Math.ceil(LOCKOUT_DURATION_MS / 1000);
        if (remainingSec > maxRemainingSeconds) maxRemainingSeconds = remainingSec;
        minRemainingAttempts = 0;
      } else {
        const left = MAX_FAILED_ATTEMPTS - record.count;
        if (left < minRemainingAttempts) minRemainingAttempts = left;
      }

      attemptsStore.set(key, record);
    }

    return {
      isLocked: isNowLocked,
      remainingAttempts: minRemainingAttempts,
      remainingSeconds: maxRemainingSeconds,
    };
  },

  /**
   * Resets failed attempt counters on successful login.
   */
  recordSuccess(email: string, ip?: string): void {
    const keys = getKeys(email, ip);
    for (const key of keys) {
      attemptsStore.delete(key);
    }
  },

  /**
   * Manually unlocks an account (DEV / Admin action).
   */
  unlock(email: string): void {
    const keys = getKeys(email);
    for (const key of keys) {
      attemptsStore.delete(key);
    }
  }
};
