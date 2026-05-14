import "dotenv/config";
import { Client, GatewayIntentBits, Events, TextChannel } from "discord.js";
import puppeteer from "puppeteer";
import { CronJob } from "cron";

const REDDIT_URL = "https://www.reddit.com/r/hiphopheads/";

const { MUSIC_CHANNEL_ID, BOT_TOKEN } = process.env;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is not set");
if (!MUSIC_CHANNEL_ID) throw new Error("MUSIC_CHANNEL_ID is not set");

type MusicItem = { title: string; url: string };

const bot = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const getChannel = async (): Promise<TextChannel | undefined> => {
  const channel = bot.channels.cache.get(MUSIC_CHANNEL_ID);
  return channel instanceof TextChannel ? channel : undefined;
};

const getRedditMusic = async (): Promise<MusicItem[]> => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: [
      "--incognito",
      "--no-sandbox",
      "--single-process",
      "--no-zygote",
      "--disable-setuid-sandbox",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.goto(REDDIT_URL);
    const raw = await page.evaluate(() =>
      Array.from(document.getElementsByTagName("h3"), (e) => ({
        title: e.innerText,
        url: e.closest("a")?.getAttribute("href") ?? "",
      }))
    );
    const headings: MusicItem[] = raw.map((item) => ({
      title: String(item.title),
      url: String(item.url),
    }));
    return headings.filter((h) => h.title.includes("[FRESH"));
  } catch (e) {
    console.error(e);
    return [];
  } finally {
    await browser.close();
  }
};

const job = new CronJob("0 */8 * * *", async function () {
  try {
    const channel = await getChannel();
    if (!channel) return;
    const freshMusic = await getRedditMusic();
    const messages = await channel.messages.fetch({ limit: 30 });
    const channelMessages = messages.map((message) => message.content);
    for (const item of freshMusic) {
      if (!channelMessages.includes(`https://reddit.com${item.url}`)) {
        await channel.send(`https://reddit.com${item.url}`);
      }
    }
  } catch (e) {
    console.error(e);
    try {
      const channel = await getChannel();
      await channel?.send("Something went wrong with the bot");
    } catch {
      // ignore secondary failure
    }
    job.stop();
  }
});

bot.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply("pong");
  }

  if (interaction.commandName === "restart") {
    job.start();
    await interaction.reply("Job restarted");
  }
});

job.start();
bot.login(BOT_TOKEN).catch((e) => {
  console.error("Failed to log in:", e);
  process.exit(1);
});
