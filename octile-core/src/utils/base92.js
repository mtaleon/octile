/**
 * Base-92 alphabet for pack encoding
 * Uses printable ASCII 33-126, excluding ' (39) and \ (92)
 */
export const BASE92_ALPHABET = '!"#$%&()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[]^_`abcdefghijklmnopqrstuvwxyz{|}~';

/**
 * Create character code to index map for decoding
 */
const BASE92_MAP = {};
for (let i = 0; i < BASE92_ALPHABET.length; i++) {
  BASE92_MAP[BASE92_ALPHABET.charCodeAt(i)] = i;
}

/**
 * Decode a 3-character base-92 string to integer
 * @param {string} encoded - 3-character base-92 string
 * @returns {number} Decoded integer (0 to 778,687)
 */
export function decodeBase92(encoded) {
  if (encoded.length !== 3) {
    throw new Error('Base-92 encoded string must be 3 characters');
  }

  const c0 = BASE92_MAP[encoded.charCodeAt(0)];
  const c1 = BASE92_MAP[encoded.charCodeAt(1)];
  const c2 = BASE92_MAP[encoded.charCodeAt(2)];

  return c0 * 92 * 92 + c1 * 92 + c2;
}

/**
 * Encode an integer to 3-character base-92 string
 * @param {number} num - Integer to encode (0 to 778,687)
 * @returns {string} 3-character base-92 string
 */
export function encodeBase92(num) {
  if (num < 0 || num >= 92 * 92 * 92) {
    throw new Error('Number must be between 0 and 778,687');
  }

  const c0 = Math.floor(num / (92 * 92));
  const c1 = Math.floor((num % (92 * 92)) / 92);
  const c2 = num % 92;

  return BASE92_ALPHABET[c0] + BASE92_ALPHABET[c1] + BASE92_ALPHABET[c2];
}
