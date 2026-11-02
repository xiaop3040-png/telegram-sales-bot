import { it, expect, vi } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const Bot = require("../src/telegram");
it("adapts v2 parameter objects and private event handlers", async () => {
  const api = {
    sendMessage: vi.fn(async () => ({ message_id: 1 })),
    getChatMember: vi.fn(async () => ({ status: "member" })),
  };
  const bot = new Bot("test", { api });
  const cmd = vi.fn(),
    callback = vi.fn();
  bot.onText(/^\/start$/, cmd);
  bot.on("callback_query", callback);
  bot.processUpdate({
    message: {
      chat: { type: "private", id: 1 },
      from: { id: 1 },
      text: "/start",
    },
  });
  await Promise.resolve();
  expect(cmd).toHaveBeenCalledTimes(1);
  bot.processUpdate({
    message: {
      chat: { type: "group", id: -1 },
      from: { id: 1 },
      text: "/start",
    },
  });
  await Promise.resolve();
  expect(cmd).toHaveBeenCalledTimes(1);
  await bot.sendMessage(1, "Hello", { protect_content: true });
  expect(api.sendMessage).toHaveBeenCalledWith({
    chat_id: 1,
    text: "Hello",
    protect_content: true,
  });
  await bot.getChatMember(-123, 42);
  expect(api.getChatMember).toHaveBeenCalledWith({
    chat_id: -123,
    user_id: 42,
  });
  bot.processUpdate({
    callback_query: { data: "test", message: { chat: { type: "private" } } },
  });
  expect(callback).toHaveBeenCalledTimes(1);
});
