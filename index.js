require("dotenv").config();
const { Client, Intents } = require("discord.js");
const puppeteer = require("puppeteer");
var CronJob = require("cron").CronJob;

const REDDIT_URL = "https://www.reddit.com/r/hiphopheads/";
const HHH_URL = "https://www.hotnewhiphop.com/songs/";

const getChannel = async () => {
  return await bot.channels.cache.get(process.env.MUSIC_CHANNEL_ID);
};

const getRedditMusic = async () => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(REDDIT_URL);
    const headings = await page.evaluate(() =>
      Array.from(document.getElementsByTagName("h3"), (e) => {
        return {
          title: e.innerText,
          url: e.closest("a").getAttribute("href"),
        };
      })
    );
    const newMusic = [];
    headings.forEach((heading) => {
      if (heading.title.includes("[FRESH")) {
        newMusic.push(heading);
      }
    });
    await browser.close();
    return newMusic;
  } catch (e) {
    console.log(e);
    return [];
  }
};

// const getHotNewHiphop = async () => {
//   try {
//     const browser = await puppeteer.launch();
//     const page = await browser.newPage();
//     await page.goto(HHH_URL);
//     const songs = await page.evaluate(() => {
//       Array.from(document.querySelectorAll(".grid-item"), (e) => {
//         return {
//           title: e.querySelector(".cover-title").innerText,
//           url: e.querySelector(".cover-title").getAttribute("href"),
//         };
//       });
//     });
//     console.log(songs);
//     await browser.close();
//     return songs;
//   } catch (e) {
//     console.log(e);
//     return [];
//   }
// };

// getHotNewHiphop();

const job = new CronJob("0 */3 * * *", async function () {
  try {
    const channel = await getChannel();
    const freshMusic = await getRedditMusic();
    channel.messages.fetch({ limit: 30 }).then((messages) => {
      const channelMessages = messages.map((message) => message.content);
      freshMusic.forEach((item) => {
        console.log(item);
        if (!channelMessages.includes(`https://reddit.com${item.url}`)) {
          channel.send(`https://reddit.com${item.url}`);
        }
      });
    });
  } catch (e) {
    console.log(e);
    const channel = await getChannel();
    channel.send("Something went wrong with the bot");
    job.stop();
  }
});

const bot = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
});

bot.on("messageCreate", (message) => {
  if (message.content == "[restart music bot]") {
    job.start();
    message.channel.send("Job restarted");
  }
});

job.start();
bot.login(process.env.BOT_TOKEN);
