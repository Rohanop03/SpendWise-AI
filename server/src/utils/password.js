import bcrypt from 'bcrypt';

export const minimumPasswordCharacters = 12;
export const maximumPasswordBytes = 72;

export function getPasswordByteLength(password) {
  return Buffer.byteLength(password, 'utf8');
}

export function createPasswordManager(cost) {
  return {
    compare(password, hash) {
      return bcrypt.compare(password, hash);
    },
    hash(password) {
      return bcrypt.hash(password, cost);
    },
  };
}
