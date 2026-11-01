const crypto = require('node:crypto');
function equalSecret(value, expected) {
    if (typeof value !== 'string' || typeof expected !== 'string' || !expected) return false;
    const a = crypto.createHash('sha256').update(value).digest();
    const b = crypto.createHash('sha256').update(expected).digest();
    return crypto.timingSafeEqual(a, b);
}
module.exports = { equalSecret };
