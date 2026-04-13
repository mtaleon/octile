import nacl from 'tweetnacl';

/**
 * WeChat Mini Game CryptoProvider implementation
 * Uses tweetnacl for Ed25519 signature verification
 */
export class WeChatCryptoProvider {
  /**
   * Verify Ed25519 signature (SYNC function)
   * @param {Uint8Array} data - Data that was signed
   * @param {Uint8Array} signature - Ed25519 signature (64 bytes)
   * @param {Uint8Array} publicKey - Ed25519 public key (32 bytes)
   * @returns {boolean} True if signature is valid
   */
  verifySignature(data, signature, publicKey) {
    try {
      return nacl.sign.detached.verify(data, signature, publicKey);
    } catch (e) {
      console.error('[WeChatCryptoProvider] Signature verification error:', e);
      return false;
    }
  }
}
