/**
 * Decimal-safe monetary arithmetic utilities using integer cents.
 * Avoids IEEE 754 floating point imprecision when performing financial calculations.
 */

export function toCents(amount) {
  if (amount === null || amount === undefined) {
    throw new TypeError('Amount is required to convert to cents.');
  }

  const str = String(amount).trim();
  if (!str) {
    throw new TypeError('Amount cannot be empty.');
  }

  // Validate format: optional sign, digits, optional period followed by at most 2 digits
  const match = str.match(/^(-)?(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    const num = Number(str);
    if (!Number.isFinite(num)) {
      throw new TypeError(`Invalid monetary amount: ${str}`);
    }
    return Math.round(num * 100);
  }

  const isNegative = Boolean(match[1]);
  const integerPart = BigInt(match[2]);
  const fractionPart = BigInt((match[3] || '').padEnd(2, '0'));

  const totalCents = integerPart * 100n + fractionPart;
  const numCents = Number(totalCents);
  return isNegative ? -numCents : numCents;
}

export function fromCents(cents) {
  const safeCents = Math.round(Number(cents));
  if (!Number.isFinite(safeCents)) {
    return '0.00';
  }

  const isNegative = safeCents < 0;
  const absCents = Math.abs(safeCents);
  const dollars = Math.floor(absCents / 100);
  const remainder = absCents % 100;

  const formatted = `${dollars}.${String(remainder).padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : formatted;
}

export function addMoney(a, b) {
  return fromCents(toCents(a) + toCents(b));
}

export function subtractMoney(a, b) {
  return fromCents(toCents(a) - toCents(b));
}

export function compareMoney(a, b) {
  const centsA = toCents(a);
  const centsB = toCents(b);
  if (centsA < centsB) return -1;
  if (centsA > centsB) return 1;
  return 0;
}

export function isGreaterThan(a, b) {
  return compareMoney(a, b) > 0;
}

export function isLessThan(a, b) {
  return compareMoney(a, b) < 0;
}

export function isEqualMoney(a, b) {
  return compareMoney(a, b) === 0;
}

export function isPositiveMoney(amount) {
  return toCents(amount) > 0;
}

export function isNonNegativeMoney(amount) {
  return toCents(amount) >= 0;
}

/**
 * Divide monetary amount by an integer divisor with standard half-up rounding.
 * e.g., quarterly $100 / 3 -> $33.33
 */
export function divideMoney(amount, divisor) {
  const cents = toCents(amount);
  const numDivisor = Number(divisor);
  if (!Number.isFinite(numDivisor) || numDivisor <= 0) {
    throw new TypeError('Divisor must be a positive finite number.');
  }

  const resultCents = Math.round(cents / numDivisor);
  return fromCents(resultCents);
}

/**
 * Multiply monetary amount by a scalar factor.
 */
export function multiplyMoney(amount, factor) {
  const cents = toCents(amount);
  const numFactor = Number(factor);
  if (!Number.isFinite(numFactor)) {
    throw new TypeError('Factor must be a finite number.');
  }

  const resultCents = Math.round(cents * numFactor);
  return fromCents(resultCents);
}
