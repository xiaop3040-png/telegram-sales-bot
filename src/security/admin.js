const { equalSecret } = require('./secrets');
const config = require('../config');
const { audit } = require('../services/payments');
function adminGuard() {
    const buckets = new Map();
    return (req,res,next) => {
        res.setHeader('Cache-Control','no-store');
        const now = Date.now(), ip = req.ip || 'unknown';
        for (const [key,b] of buckets) if (b.until <= now) buckets.delete(key);
        if (!buckets.has(ip)) {
            if (buckets.size >= 10000) return res.status(429).json({message:'Rate limited'});
            buckets.set(ip,{count:0,until:now+60000});
        }
        const bucket = buckets.get(ip);
        if (++bucket.count > 120) return res.status(429).json({message:'Rate limited'});
        if (!equalSecret(req.headers['x-api-key'],config.adminApiKey)) return res.status(401).json({message:'Unauthorized'});
        try {
            // Persist intent BEFORE mutation. Do not record query strings, headers or bodies.
            audit('admin-api',req.method,req.path,'requested');
        } catch { return res.status(503).json({message:'Audit unavailable'}); }
        if (['POST','PUT','PATCH'].includes(req.method) && req.body !== undefined && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) return res.status(400).json({message:'Expected JSON object'});
        next();
    };
}
module.exports = { adminGuard };
