const db = require('../database');
const config = require('../config');
const { audit } = require('../services/payments');
const active = new Set();
function rows(sql, params) {
    const s = db.getDb().prepare(sql); s.bind(params);
    const out = []; try { while(s.step()) out.push(s.getAsObject()); } finally { s.free(); } return out;
}
function allocate(orderCode) {
    return db.atomic(() => {
        const order = db.getOrderByCode(orderCode);
        if (!order || !['paid','delivering'].includes(order.status)) return [];
        let items = db.getOrderItems(order.id);
        if (!items.length) items = [{ id: 0, product_id: order.product_id, quantity: order.quantity }];
        for (const item of items) {
            const existing = rows('SELECT * FROM delivery_jobs WHERE order_id=? AND item_id=?', [order.id,item.id]);
            if (existing.length) continue;
            const product = db.getProductById(item.product_id);
            if (!product) throw new Error('Missing product');
            if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999) throw new Error('Invalid quantity');
            if (product.product_type === 'credential') {
                const credentials = db.getAvailableCredentials(item.product_id, item.quantity);
                if (credentials.length !== item.quantity) throw new Error('Insufficient stock');
                db.markCredentialsSold(credentials.map(c => c.id), order.id);
            }
            db.getDb().run('INSERT INTO delivery_jobs(order_id,item_id,product_id,quantity,state,updated_at) VALUES(?,?,?,?,?,?)', [order.id,item.id,item.product_id,item.quantity,product.product_type === 'credential' ? 'ready' : 'manual',new Date().toISOString()]);
        }
        db.updateOrderStatus(orderCode, 'delivering');
        return rows('SELECT * FROM delivery_jobs WHERE order_id=? ORDER BY item_id', [order.id]);
    });
}
function jobState(job, state, messageId = null) {
    db.atomic(() => {
        db.getDb().run('UPDATE delivery_jobs SET state=?,message_id=?,updated_at=? WHERE order_id=? AND item_id=?', [state,messageId,new Date().toISOString(),job.order_id,job.item_id]);
        if (state === 'sent' && job.item_id) db.updateOrderItemStatus(job.item_id,'delivered');
    });
}
async function deliverCredentials(bot, suppliedOrder, { retry = false } = {}) {
    const code = suppliedOrder.order_code;
    if (active.has(code)) return false;
    active.add(code);
    try {
        const order = db.getOrderByCode(code);
        if (!order || !['paid','delivering'].includes(order.status)) return false;
        const jobs = allocate(code);
        const english = db.getUserLanguage(order.telegram_user_id) === 'en';
        for (const job of jobs) {
            if (job.state === 'sent') continue;
            if (job.state === 'manual') continue;
            if (job.state !== 'ready' && !retry) continue;
            const product = db.getProductById(job.product_id);
            const creds = rows('SELECT * FROM credentials WHERE order_id=? AND product_id=? ORDER BY id', [order.id,job.product_id]);
            if (creds.length !== job.quantity) throw new Error('Allocation mismatch');
            let text = `XiaoP ShopBot · #${code}\n${product.name}\n\n`;
            for (const cred of creds) {
                const data = JSON.parse(cred.data);
                for (const field of JSON.parse(product.credential_fields || '[]')) if (data[field.key] != null) text += `${field.label}: ${data[field.key]}\n`;
                text += '\n';
            }
            text += english ? 'Keep this information private. Contact support for warranty or renewal.' : 'Giữ kín thông tin này. Liên hệ hỗ trợ để bảo hành hoặc gia hạn.';
            // Persist sending BEFORE external I/O. A crash/timeout requires explicit review.
            jobState(job,'sending');
            try {
                // Plain text avoids credential-controlled Markdown/HTML interpretation.
                const sent = await bot.sendMessage(order.telegram_user_id, text, { protect_content: true });
                jobState(job,'sent',sent?.message_id || null);
            } catch { jobState(job,'review'); }
        }
        const current = rows('SELECT * FROM delivery_jobs WHERE order_id=?',[order.id]);
        if (current.length && current.every(j => j.state === 'sent')) {
            db.atomic(() => {
                db.updateOrderStatus(code,'delivered');
                const days = current.map(j => db.getProductById(j.product_id)?.subscription_days).filter(Boolean);
                if (days.length) db.setSubscriptionExpiry(code,Math.min(...days));
                audit('delivery','complete',code,'success');
            });
            return true;
        }
        await bot.sendMessage(config.adminTelegramId, `XiaoP ShopBot: #${code} cần xử lý giao hàng / Delivery needs review.`).catch(() => {});
        return false;
    } catch { return false; }
    finally { active.delete(code); }
}
function completeManual(orderCode, actor) {
    return db.atomic(() => {
        const order = db.getOrderByCode(orderCode);
        if (!order || order.status !== 'delivering') throw new Error('Invalid order state');
        const jobs = rows('SELECT * FROM delivery_jobs WHERE order_id=?',[order.id]);
        if (!jobs.length || jobs.some(j => !['sent','manual'].includes(j.state))) throw new Error('Credential delivery requires review');
        for (const job of jobs.filter(j => j.state === 'manual')) jobState(job,'sent');
        db.updateOrderStatus(orderCode,'delivered');
        const days = jobs.map(j => db.getProductById(j.product_id)?.subscription_days).filter(Boolean);
        if (days.length) db.setSubscriptionExpiry(orderCode,Math.min(...days));
        audit(actor,'manual-delivery',orderCode,'success');
    });
}
function setupInviteConfirmHandler(bot) {
    bot.on('callback_query', query => {
        if (!/^(invite_done_|preorder_done_)/.test(query.data || '')) return;
        if (query.from?.id !== config.adminTelegramId || query.message?.chat?.id !== config.adminTelegramId) {
            bot.answerCallbackQuery(query.id,{text:'Unauthorized'}).catch(() => {}); return;
        }
        try { completeManual(query.data.replace(/^(invite_done_|preorder_done_)/,''),String(query.from.id)); bot.answerCallbackQuery(query.id,{text:'Completed'}).catch(() => {}); }
        catch { bot.answerCallbackQuery(query.id,{text:'Invalid order state'}).catch(() => {}); }
    });
}
module.exports = { deliverCredentials, setupInviteConfirmHandler, allocate, completeManual };
