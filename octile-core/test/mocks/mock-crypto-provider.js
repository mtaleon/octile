import { CryptoProvider } from '../../src/interfaces/crypto-provider.js';

/**
 * Mock CryptoProvider for testing
 * Returns configured validity for all signature checks
 */
export class MockCryptoProvider extends CryptoProvider {
  constructor(alwaysValid = true) {
    super();
    this.alwaysValid = alwaysValid;
  }

  verifySignature(data, signature, publicKey) {
    // Mock: return configured validity
    return this.alwaysValid;
  }
}
