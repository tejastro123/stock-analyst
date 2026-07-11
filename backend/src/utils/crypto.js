const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
// Ensure we have a 32-byte key. Fallback for development.
const SECRET_KEY = crypto
  .createHash('sha256')
  .update(process.env.ENCRYPTION_SECRET || 'quantdesk-terminal-enterprise-encryption-secret-key-1234')
  .digest();

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag().toString('hex');
  
  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag
  };
}

function decrypt(encryptedData, iv, authTag) {
  if (!encryptedData || !iv || !authTag) return null;
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    SECRET_KEY,
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

module.exports = {
  encrypt,
  decrypt
};
