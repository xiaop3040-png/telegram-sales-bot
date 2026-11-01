const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const path = require('path');
const config = require('./config');
const { validateConfig } = require('./config');
const db = require('./database');

// Handlers
const { setupMenuHandler } = require('./handlers/menuHandler');
const { setupProductHandler } = require('./handlers/productHandler');
const { setupQuantityHandler } = require('./handlers/quantityHandler');
const { setupEmailHandler } = require('./handlers/emailHandler');
const { setupOrderHandler } = require('./handlers/orderHandler');
const { setupWebhookHandler } = require('./handlers/webhookHandler');
const { setupAdminHandler } = require('./handlers/adminHandler');
const { setupAdminAPI } = require('./handlers/adminAPI');
const { setupProfileHandler } = require('./handlers/profileHandler');
const { setupHelpHandler, setupGuideCallback } = require('./handlers/helpHandler');
const { setupInviteConfirmHandler } = require('./handlers/deliveryHandler');
const { setupDiscountHandler } = require('./handlers/discountHandler');
const { setupCartHandler } = require('./handlers/cartHandler');
const { setupCurrencyHandler } = require('./handlers/currencyHandler');
const { startOrderExpiryCheck } = require('./utils/orderExpiry');
const { startSepayPoller } = require('./utils/sepayPoller');
const { setupScheduler } = require('./scheduler');
const { setupCheckerAPI } = require('./handlers/checkerAPI');

async function main() {
    console.log('🚀 Starting XiaoP ShopBot v3...');

    // 1. Validate config
    validateConfig();

    // 2. Init database
    await db.initDatabase();

    // 3. Detect environment
    const isProduction = !!process.env.RAILWAY_PUBLIC_DOMAIN;
    const publicUrl = isProduction ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null;

    // 4. Create bot instance
    let bot;
    if (isProduction) {
        bot = new TelegramBot(config.botToken);
        console.log('🤖 Bot created in WEBHOOK mode (production)');
    } else {
        bot = new TelegramBot(config.botToken, { polling: true });
        console.log('🤖 Bot created in POLLING mode (local)');
    }

    const processUpdate = bot.processUpdate.bind(bot);
    bot.processUpdate = update => {
        const message = update?.message || update?.callback_query?.message;
        if (!message || message.chat?.type !== 'private') return;
        if (update.callback_query && typeof update.callback_query.data !== 'string') return;
        processUpdate(update);
    };

    // 5. Set bot commands (BotFather menu)
    await bot.setMyCommands([
        { command: 'start', description: 'Hiện menu chính / Main menu' },
        { command: 'products', description: 'Xem sản phẩm / Products' },
        { command: 'orders', description: 'Đơn hàng / Orders' },
        { command: 'profile', description: 'Tài khoản / Account' },
        { command: 'discount', description: 'Mã giảm giá / Discount codes' },
        { command: 'language', description: '🌐 Chọn ngôn ngữ / Language' },
        { command: 'currency', description: '💱 Đổi tiền tệ / Change currency' },
        { command: 'help', description: 'Hỗ trợ / Support' },
        { command: 'huongdan', description: 'Hướng dẫn / Guide' },
    ]).catch((err) => {
        console.error('⚠️ Failed to set bot commands:', err.message);
    });

    // 6. Setup Express server
    const app = express();
    app.disable('x-powered-by');
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
        next();
    });
    app.use(express.json({ limit: '128kb' }));

    // Health check
    app.get('/', (req, res) => {
        res.json({ status: 'ok', bot: 'XiaoP ShopBot', version: '3.0.0' });
    });

    // Serve static files (admin panel)
    app.use(express.static(path.join(__dirname, '..', 'public')));

    // Telegram webhook endpoint (production only)
    if (isProduction) {
        const telegramWebhookPath = '/telegram-webhook';
        app.post(telegramWebhookPath, (req, res) => {
            if (!require('./security/secrets').equalSecret(req.headers['x-telegram-bot-api-secret-token'], config.telegramWebhookSecret)) return res.sendStatus(401);
            bot.processUpdate(req.body);
            res.sendStatus(200);
        });
    }

    // Setup SePay webhook handler
    setupWebhookHandler(app, bot);

    // Setup admin API
    setupAdminAPI(app, bot);

    // Setup public link checker API
    setupCheckerAPI(app);

    // Helper: set webhook via native fetch
    async function setTelegramWebhook() {
        const telegramWebhookUrl = `${publicUrl}/telegram-webhook`;
        const apiUrl = `https://api.telegram.org/bot${config.botToken}/setWebhook`;
        try {
            const resp = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: telegramWebhookUrl, secret_token: config.telegramWebhookSecret }),
            });
            const data = await resp.json();
            console.log(`📡 setWebhook result:`, JSON.stringify(data));
            return data.ok;
        } catch (err) {
            console.error('❌ Failed to set Telegram webhook:', err.message);
            return false;
        }
    }

    // Helper: webhook health check
    async function checkWebhookHealth() {
        try {
            const resp = await fetch(`https://api.telegram.org/bot${config.botToken}/getWebhookInfo`);
            const data = await resp.json();
            if (!data.result.url) {
                console.log('⚠️ Webhook URL is empty! Re-setting...');
                await setTelegramWebhook();
            }
        } catch (err) {
            console.error('❌ Webhook health check failed:', err.message);
        }
    }

    // Start Express server
    app.listen(config.port, async () => {
        console.log(`🌐 Express server running on port ${config.port}`);

        if (isProduction) {
            console.log('⏳ Waiting 5s before setting webhook...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            await setTelegramWebhook();
            setInterval(checkWebhookHealth, 60000);
        }
    });

    // 7. Setup bot handlers
    setupAdminHandler(bot);
    setupMenuHandler(bot);
    setupProductHandler(bot);
    setupQuantityHandler(bot);
    setupEmailHandler(bot);
    setupOrderHandler(bot);
    setupInviteConfirmHandler(bot);
    setupDiscountHandler(bot);
    setupCartHandler(bot);
    setupCurrencyHandler(bot);
    setupScheduler(bot);
    setupProfileHandler(bot);
    setupHelpHandler(bot);
    setupGuideCallback(bot);

    // 8. Start order expiry checker
    startOrderExpiryCheck(bot);

    // 9. Start SePay polling backup (reconciles missed webhooks)
    startSepayPoller(bot);

    // 9. Bot info
    const botInfo = await bot.getMe();
    console.log(`✅ Bot @${botInfo.username} is ready!`);
    console.log(`📡 SePay Webhook: http://localhost:${config.port}${config.webhookPath}`);
    console.log(`🔧 Admin Panel: http://localhost:${config.port}/admin.html`);
    console.log(`👤 Admin ID: ${config.adminTelegramId}`);
    console.log(`🌍 Mode: ${isProduction ? 'PRODUCTION (webhook)' : 'LOCAL (polling)'}`);

    // Graceful shutdown
    const shutdown = (signal) => {
        console.log(`\n🛑 ${signal} received, shutting down...`);
        if (!isProduction) bot.stopPolling();
        db.saveDatabase();
        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
