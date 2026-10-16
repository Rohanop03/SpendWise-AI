// ILIKE treats %, _ and \ as pattern characters; escape them so a search term matches literally.
export function escapeLikePattern(value) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
