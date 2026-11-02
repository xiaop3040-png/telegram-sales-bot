const { EventEmitter } = require("node:events");
const { Api } = require("node-telegram-bot-api");
// Preserve the existing event-handler contract while using the maintained v2 API client.
class TelegramAdapter extends EventEmitter {
  constructor(token, { polling = false, api } = {}) {
    super({ captureRejections: true });
    this.api = api || new Api(token);
    this.commands = [];
    this.running = false;
    this.on("error", () => console.warn("[Telegram] Handler failed"));
    if (polling) setImmediate(() => this.startPolling());
  }
  onText(regex, handler) {
    this.commands.push({ regex, handler });
  }
  processUpdate(update) {
    const message = update?.message;
    const callback = update?.callback_query;
    if (
      callback &&
      typeof callback.data === "string" &&
      callback.message?.chat?.type === "private"
    )
      this.emit("callback_query", callback);
    if (!message || message.chat?.type !== "private" || !message.from) return;
    this.emit("message", message);
    if (message.document) this.emit("document", message);
    if (typeof message.text === "string")
      for (const { regex, handler } of this.commands) {
        regex.lastIndex = 0;
        const match = regex.exec(message.text);
        if (match)
          Promise.resolve()
            .then(() => handler(message, match))
            .catch(() => this.emit("error", new Error("Command failed")));
      }
  }
  async startPolling() {
    if (this.running) return;
    this.running = true;
    this.abort = new AbortController();
    let offset = 0;
    while (this.running) {
      try {
        const updates = await this.api.getUpdates(
          {
            offset,
            timeout: 25,
            allowed_updates: ["message", "callback_query"],
          },
          this.abort.signal,
        );
        for (const update of updates) {
          this.processUpdate(update);
          offset = update.update_id + 1;
        }
      } catch {
        if (this.running)
          await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }
  stopPolling() {
    this.running = false;
    this.abort?.abort();
  }
  sendMessage(chat_id, text, options = {}) {
    return this.api.sendMessage({ chat_id, text, ...options });
  }
  sendPhoto(chat_id, photo, options = {}) {
    return this.api.sendPhoto({ chat_id, photo, ...options });
  }
  editMessageText(text, options = {}) {
    return this.api.editMessageText({ text, ...options });
  }
  answerCallbackQuery(callback_query_id, options = {}) {
    return this.api.answerCallbackQuery({ callback_query_id, ...options });
  }
  getChat(chat_id) {
    return this.api.getChat({ chat_id });
  }
  getChatMember(chat_id, user_id) {
    return this.api.getChatMember({ chat_id, user_id });
  }
  getFile(file_id) {
    return this.api.getFile({ file_id });
  }
  getMe() {
    return this.api.getMe();
  }
  setMyCommands(commands) {
    return this.api.setMyCommands({ commands });
  }
}
module.exports = TelegramAdapter;
