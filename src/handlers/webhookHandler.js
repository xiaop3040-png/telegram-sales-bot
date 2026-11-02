const config = require('../config');
const { equalSecret } = require('../security/secrets');
const { processPayment } = require('../services/payments');
function setupWebhookHandler(app, bot) {
    app.post(config.webhookPath, async (req, res) => {
        // SePay API Key authentication: Authorization: Apikey <configured webhook key>.
        if (!config.sepayWebhookKey) return res.status(503).json({ success: false });
        if (!equalSecret(req.headers.authorization, `Apikey ${config.sepayWebhookKey}`)) return res.status(401).json({ success: false });
        try {
            await processPayment(bot, req.body, 'webhook');
            res.json({ success: true });
        } catch {
            res.status(500).json({ success: false });
        }
    });
}
module.exports = { setupWebhookHandler };
