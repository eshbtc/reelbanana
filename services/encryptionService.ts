// Secure encryption service for API keys
// Uses Web Crypto API for client-side encryption

class EncryptionService {
  private static instance: EncryptionService;
  private key: CryptoKey | null = null;

  private constructor() {}

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  // Generate a key from user's password/secret
  private async generateKey(password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('reelbanana-salt-2024'), // Fixed salt for consistency
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt API key
  async encryptApiKey(apiKey: string, userSecret: string): Promise<string> {
    try {
      const key = await this.generateKey(userSecret);
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        data
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Convert to base64 for storage
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt API key');
    }
  }

  // Decrypt API key
  async decryptApiKey(encryptedApiKey: string, userSecret: string): Promise<string> {
    try {
      const key = await this.generateKey(userSecret);
      
      // Convert from base64
      const combined = new Uint8Array(
        atob(encryptedApiKey).split('').map(char => char.charCodeAt(0))
      );

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt API key');
    }
  }

  // Generate user secret from user ID and email
  generateUserSecret(userId: string, email: string): string {
    // Create a deterministic secret from user data
    // This ensures the same user always gets the same secret
    const combined = `${userId}-${email}-reelbanana-2024`;
    return btoa(combined).replace(/[^a-zA-Z0-9]/g, '');
  }
}

export const encryptionService = EncryptionService.getInstance();
