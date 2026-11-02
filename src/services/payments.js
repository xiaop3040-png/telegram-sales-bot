const db = require("../database");
function orderToken(code, content) {
  const tokens = [
    ...new Set(
      `${typeof code === "string" ? code : ""} ${typeof content === "string" ? content : ""}`
        .toUpperCase()
        .match(/[A-Z0-9]+/g) || [],
    ),
  ].filter((x) => /^ORD\d{13,20}$/.test(x));
  return tokens.length === 1 ? tokens[0] : null;
}
function normalize(payload, source) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return null;
  const poll = source === "poller";
  const direction = poll ? payload.transaction_type : payload.transferType;
  const rawAmount = poll ? payload.amount_in : payload.transferAmount;
  const amount =
    typeof rawAmount === "number" ||
    (typeof rawAmount === "string" && /^\d+(\.0+)?$/.test(rawAmount))
      ? Number(rawAmount)
      : NaN;
  const id = payload.id;
  if (
    !["string", "number"].includes(typeof id) ||
    !/^\d+$/.test(String(id)) ||
    (typeof id === "number" && !Number.isSafeInteger(id))
  )
    return null;
  if (direction !== "in" || !Number.isSafeInteger(amount) || amount <= 0)
    return null;
  const orderCode = orderToken(
    payload.code,
    poll ? payload.transaction_content : payload.content,
  );
  const account = poll ? payload.account_number : payload.accountNumber;
  if (!orderCode || !["string", "number"].includes(typeof account)) return null;
  return {
    provider: "sepay",
    transactionId: String(BigInt(id)),
    amount,
    orderCode,
    account: String(account),
  };
}
function accept(payment) {
  if (!payment) return { accepted: false, reason: "invalid" };
  return db.atomic(() => {
    const d = db.getDb();
    if (
      d.exec(
        "SELECT 1 FROM payment_ledger WHERE provider=? AND transaction_id=?",
        [payment.provider, payment.transactionId],
      ).length
    )
      return { accepted: false, reason: "duplicate" };
    const order = db.getOrderByCode(payment.orderCode);
    if (
      !order ||
      order.status !== "pending" ||
      order.is_deleted ||
      order.source === "manual"
    )
      return { accepted: false, reason: "state" };
    if (
      payment.provider === "sepay" &&
      (order.payment_method !== "vietqr" ||
        payment.account !==
          String(
            d.exec(
              "SELECT account_no FROM order_payment_accounts WHERE order_code=?",
              [order.order_code],
            )[0]?.values[0]?.[0] || db.getBankConfig().accountNo,
          ))
    )
      return { accepted: false, reason: "destination" };
    if (
      !Number.isSafeInteger(payment.amount) ||
      payment.amount < order.total_amount ||
      order.total_amount <= 0
    )
      return { accepted: false, reason: "amount" };
    // Late transfers require reconciliation instead of silently reopening expired orders.
    if (order.expires_at && new Date(order.expires_at).getTime() <= Date.now())
      return { accepted: false, reason: "expired" };
    d.run(
      "INSERT INTO payment_ledger(provider,transaction_id,order_code,amount,accepted_at) VALUES(?,?,?,?,?)",
      [
        payment.provider,
        payment.transactionId,
        order.order_code,
        payment.amount,
        new Date().toISOString(),
      ],
    );
    db.updateOrderStatus(order.order_code, "paid");
    if (order.discount_code) {
      const discount = db.getDiscountCodeByCode(order.discount_code);
      if (discount)
        db.useDiscountCode(
          discount.id,
          order.telegram_user_id,
          order.order_code,
        );
    }
    audit("payment", "accepted", order.order_code, payment.provider);
    return { accepted: true, order: db.getOrderByCode(order.order_code) };
  });
}
function confirmManual(orderCode, actor) {
  const order = db.getOrderByCode(orderCode);
  if (!order) throw new Error("Order not found");
  const result = accept({
    provider: "admin",
    transactionId: orderCode,
    orderCode,
    amount: order.total_amount,
  });
  if (!result.accepted)
    throw new Error("Order cannot be confirmed: " + result.reason);
  audit(actor, "manual-payment", orderCode, "accepted");
  return result.order;
}
function audit(actor, action, target, outcome) {
  db.getDb().run(
    "INSERT INTO audit_events(actor,action,target,outcome) VALUES(?,?,?,?)",
    [
      String(actor).slice(0, 100),
      String(action).slice(0, 100),
      String(target).slice(0, 200),
      String(outcome).slice(0, 100),
    ],
  );
  db.saveDatabase();
}
async function processPayment(bot, payload, source) {
  const result = accept(normalize(payload, source));
  if (result.accepted) {
    await require("../handlers/deliveryHandler").deliverCredentials(
      bot,
      result.order,
    );
  }
  return result;
}
module.exports = {
  orderToken,
  normalize,
  accept,
  confirmManual,
  audit,
  processPayment,
};
