/**
 * CryptoProvider interface for PackReader signature verification
 * Platform implementations: web (crypto.subtle + tweetnacl), WeChat (tweetnacl)
 */
export class CryptoProvider {
  /**
   * Verify Ed25519 signature
   * @param {Uint8Array} data - Data that was signed
   * @param {Uint8Array} signature - Ed25519 signature (64 bytes)
   * @param {Uint8Array} publicKey - Ed25519 public key (32 bytes)
   * @returns {boolean} True if signature is valid
   */
  verifySignature(data, signature, publicKey) {
    throw new Error('CryptoProvider.verifySignature() not implemented');
  }
}
