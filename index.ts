import { CronJob } from "cron";
import { Client, Events, GatewayIntentBits, TextChannel } from "discord.js";
import "dotenv/config";
import ora from "ora";

const REDDIT_URL = "https://www.reddit.com/r/hiphopheads/.json?limit=50";
const CRON_TIME = "0 */8 * * *" // runs 3 times a day — at 00:00, 08:00, and 16:00

const { MUSIC_CHANNEL_ID, BOT_TOKEN } = process.env;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is not set");
if (!MUSIC_CHANNEL_ID) throw new Error("MUSIC_CHANNEL_ID is not set");

type MusicItem = { title: string; url: string };

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const getChannel = async (): Promise<TextChannel | undefined> => {
  const channel = bot.channels.cache.get(MUSIC_CHANNEL_ID);
  return channel instanceof TextChannel ? channel : undefined;
};

const getRedditMusic = async (): Promise<MusicItem[]> => {
  const spinner = ora("Fetching Reddit music...").start();
  try {
    const res = await fetch(REDDIT_URL, {
      headers: { "User-Agent": "discord-music-bot/1.0" },
    });
    if (!res.ok) throw new Error(`Reddit API returned ${res.status}`);
    const data = await res.json();
    const items = (data.data.children as { data: { title: string; permalink: string } }[])
      .map((p) => ({ title: p.data.title, url: p.data.permalink }))
      .filter((h) => h.title.includes("[FRESH"));
    spinner.succeed(`Found ${items.length} fresh track(s)`);
    return items;
  } catch (e) {
    spinner.fail("Failed to fetch Reddit music");
    console.error(e);
    return [];
  } finally {
    spinner.stop();
  }
};

const job = new CronJob(CRON_TIME, async function () {
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

bot.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (message.content.toLowerCase() === "ping") {
    await message.reply("pong");
  }
});

bot.on(Events.InteractionCreate, async (interaction) => {
  console.log(interaction)
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
getRedditMusic()
