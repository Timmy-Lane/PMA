import { Telegraf, Context } from "telegraf";
import dotenv from "dotenv";

dotenv.config();

interface BotContext extends Context {}

class TelegramBot {
  private bot: Telegraf<BotContext>;
  private token: string;

  constructor() {
    this.token = process.env.TG_BOT || "";

    if (!this.token) {
      throw new Error("TG_BOT environment variable is required");
    }

    this.bot = new Telegraf<BotContext>(this.token);
    this.setupCommands();
  }

  private setupCommands() {
    this.bot.start((ctx) => {
      ctx.reply("Welcome! Bot is running.");
    });

    this.bot.help((ctx) => {
      ctx.reply(
        "Available commands:\n/start - Start the bot\n/help - Show this help message\n/status - Check bot status"
      );
    });

    this.bot.command("status", (ctx) => {
      ctx.reply("Bot is online and working!");
    });

    this.bot.on("text", (ctx) => {
      const message = ctx.message.text;
      ctx.reply(`You said: ${message}`);
    });
  }

  public async start() {
    try {
      await this.bot.launch();
      console.log("Telegram bot started successfully");

      process.once("SIGINT", () => this.bot.stop("SIGINT"));
      process.once("SIGTERM", () => this.bot.stop("SIGTERM"));
    } catch (error) {
      console.error("Failed to start Telegram bot:", error);
      throw error;
    }
  }

  public async stop() {
    this.bot.stop();
  }

  public sendMessage(chatId: string | number, message: string) {
    return this.bot.telegram.sendMessage(chatId, message);
  }

  public getBot() {
    return this.bot;
  }
}

export default TelegramBot;
