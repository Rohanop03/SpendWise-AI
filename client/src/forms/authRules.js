/*
 * Login / register validation as React Hook Form built-in rules. These mirror
 * `loginSchema` / `registerSchema` in schemas.js (and the backend) exactly, but keep Zod
 * out of the public pages' critical JavaScript, which is prerendered and audited for speed.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const byteLength = (value) => new TextEncoder().encode(value).length;

export const emailRules = {
  maxLength: { message: 'Email must be 320 characters or fewer.', value: 320 },
  pattern: { message: 'Enter a valid email address.', value: EMAIL },
  required: 'Enter your email address.',
};

export const loginPasswordRules = {
  maxLength: { message: 'Password must be 256 characters or fewer.', value: 256 },
  required: 'Enter your password.',
};

export const displayNameRules = {
  validate: (value) => {
    const trimmed = value.trim();
    if (!trimmed) return 'Enter a display name.';
    if (trimmed.length > 100) return 'Display name must be 100 characters or fewer.';
    return true;
  },
};

export const newPasswordRules = {
  minLength: { message: 'Password must contain at least 12 characters.', value: 12 },
  required: 'Password must contain at least 12 characters.',
  validate: (value) => byteLength(value) <= 72 || 'Password must not exceed 72 UTF-8 bytes.',
};

export function confirmPasswordRules(getPassword) {
  return {
    required: 'Confirm your password.',
    validate: (value) => value === getPassword() || 'Passwords do not match.',
  };
}
