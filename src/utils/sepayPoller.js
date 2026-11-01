const config = require('../config');
const db = require('../database');
const { normalize, processPayment, orderToken } = require('../services/payments');
let timer, firstRun, running = false;
function findMatchingTransaction(order, transactions) {
    return transactions.find(txn => txn.transaction_type === 'in' && Number.isFinite(Number(txn.amount_in)) && Number(txn.amount_in) > 0 && Number(txn.amount_in) >= order.total_amount && orderToken(txn.code, txn.transaction_content) === order.order_code) || null;
}
async function pollAndReconcile(bot) {
    if (running || !config.sepayApiKey) return;
    running = true;
    try {
        if (!db.getPendingOrders().length) return;
        const since = new Date(Date.now() - 86400000).toISOString().slice(0,10);
        const response = await fetch(`https://my.sepay.vn/userapi/transactions/list?transaction_date_min=${since}&limit=100`, {
            headers: { Authorization: `Bearer ${config.sepayApiKey}` }, signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) throw new Error('SePay unavailable');
        const data = await response.json();
        for (const txn of Array.isArray(data.transactions) ? data.transactions : []) {
            // The API may omit transaction_type; amount_out must then be zero.
            const normalized = { ...txn, transaction_type: txn.transaction_type || (Number(txn.amount_in) > 0 && Number(txn.amount_out) === 0 ? 'in' : 'out') };
            if (normalize(normalized, 'poller')) await processPayment(bot, normalized, 'poller');
        }
    } catch { console.warn('[SePay] Reconciliation failed; next poll will retry'); }
    finally { running = false; }
}
function startSepayPoller(bot) {
    if (!config.sepayApiKey || timer) return;
    timer = setInterval(() => pollAndReconcile(bot), 120000);
    firstRun = setTimeout(() => pollAndReconcile(bot), 30000);
}
function stopSepayPoller() { clearInterval(timer); clearTimeout(firstRun); timer = null; }
module.exports = { startSepayPoller, stopSepayPoller, findMatchingTransaction, pollAndReconcile };
