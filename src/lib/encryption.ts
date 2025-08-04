import crypto from 'crypto';

// Encryption algorithm
const ALGORITHM = 'aes-256-cbc';

// Get encryption key from environment variables
const getEncryptionKey = (): Buffer => {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  // Create a 32-byte key from the provided string
  return crypto.createHash('sha256').update(String(key)).digest();
};

/**
 * Encrypts sensitive data
 * @param text - The text to encrypt
 * @returns The encrypted text as a base64 string with IV prepended
 */
export const encrypt = (text: string): string => {
  // Generate a random initialization vector
  const iv = crypto.randomBytes(16);
  
  // Create cipher with key and iv
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  
  // Encrypt the text
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  // Prepend IV to encrypted text (IV doesn't need to be secret)
  return iv.toString('hex') + ':' + encrypted;
};

/**
 * Decrypts encrypted data
 * @param encryptedText - The encrypted text with IV prepended
 * @returns The decrypted text
 */
export const decrypt = (encryptedText: string): string => {
  // Split IV and encrypted text
  const textParts = encryptedText.split(':');
  if (textParts.length !== 2) {
    throw new Error('Invalid encrypted text format');
  }
  
  const iv = Buffer.from(textParts[0], 'hex');
  const encryptedData = textParts[1];
  
  // Create decipher with key and iv
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  
  // Decrypt the text
  let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};