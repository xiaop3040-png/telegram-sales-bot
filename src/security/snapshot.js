const crypto = require('node:crypto');
const magic = Buffer.from('XPSB3\0');
function key() {
    const value = process.env.DATA_ENCRYPTION_KEY;
    if (!value) return null;
    if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('DATA_ENCRYPTION_KEY must be 64 hex characters');
    return Buffer.from(value, 'hex');
}
function encode(data) {
    const secret = key();
    if (!secret) return Buffer.from(data);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', secret, iv);
    cipher.setAAD(magic);
    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
    return Buffer.concat([magic, iv, cipher.getAuthTag(), ciphertext]);
}
function decode(data) {
    if (!data.subarray(0, magic.length).equals(magic)) return data;
    const secret = key();
    if (!secret) throw new Error('Encrypted database requires DATA_ENCRYPTION_KEY');
    const decipher = crypto.createDecipheriv('aes-256-gcm', secret, data.subarray(6, 18));
    decipher.setAAD(magic);
    decipher.setAuthTag(data.subarray(18, 34));
    return Buffer.concat([decipher.update(data.subarray(34)), decipher.final()]);
}
module.exports = { encode, decode };
