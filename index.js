/**
 * Module Imports
 */
const { Client, Collection } = require("discord.js");
const { readdirSync } = require("fs");
const { join } = require("path");
const { TOKEN, PREFIX, TRUSTED_BOTS } = require("./util/EvobotUtil");

/* HTTP Server Imports */
const express = require('express');
const app = express();
const http = require("http");
const https = require("https");
const fs = require("fs");
const httpPort = process.env.HTTP_PORT || 8080;
const httpsPort = process.env.HTTPS_PORT || 8081;
const api = require("./api");

const client = new Client({ disableMentions: "everyone" });

client.login(TOKEN);
client.commands = new Collection();
client.prefix = PREFIX;
client.queue = new Map();
const cooldowns = new Collection();
const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Process Events
 */
function handleSignal(signal) {
  console.log(`Received ${signal}`);
  client.destroy();
  process.exit(0);
}

process.on('SIGTERM', handleSignal);
process.on('SIGINT', handleSignal);

/**
 * Setup HTTP server
 */
app.get("/api/queue/:guildId", (req, res) => api.getQueue(req, res, client));
app.delete("/api/queue/:guildId/:songId", (req, res) => api.removeFromQueue(req, res, client));

app.listen(httpPort, () => {
  console.log("Listening on port 8080 (HTTP)");
});

try {
  const cert = {
      key: fs.readFileSync("./private.key"),
      cert: fs.readFileSync("./certificate.crt")
  }
  https.createServer(cert, (req, res) => handleRequest(req, res)).listen(httpsPort, () => {
    console.log(`HTTPS Server listening on port ${httpsPort}`);
  });
} catch (err) {
  console.warn("No key or cert found. Skipping HTTPS server");
}

/**
 * Client Events
 */
client.on("ready", () => {
  if (process.env.FRED_VERSION) {
    console.log(`${client.user.username} ready (${process.env.FRED_VERSION})!`)
  } else {
    console.log(`${client.user.username} ready!`);
  }
  client.user.setActivity('some neighborhood jams', { type : "PLAYING" });
});
client.on("warn", (info) => console.log(info));
client.on("error", console.error);

/**
 * Import all commands
 */
const commandFiles = readdirSync(join(__dirname, "commands")).filter((file) => file.endsWith(".js"));
for (const file of commandFiles) {
  const command = require(join(__dirname, "commands", `${file}`));
  client.commands.set(command.name, command);
}

client.on("message", async (message) => {
  const prefixRegex = new RegExp(`^(<@!?${client.user.id}>|${escapeRegex(PREFIX)})\\s*`);
  if (!prefixRegex.test(message.content)) return;
  const [, matchedPrefix] = message.content.match(prefixRegex);
  const args = message.content.slice(matchedPrefix.length).trim().split(/ +/);
  if (message.author.bot) {
    if (TRUSTED_BOTS.includes(message.author.id)) {
      const realAuthorId = args.pop().slice(1, -1);
      message.author = client.users.cache.get(realAuthorId);
      if (!message.author) {
        return message.channel.send(`User ${realAuthorId} is not currently in a voice channel.`)
      }
    } else {
      return;
    }
  }

  if (!message.guild || !message.author) return; // TODO: Return error

  const commandName = args.shift().toLowerCase();

  const command =
    client.commands.get(commandName) ||
    client.commands.find((cmd) => cmd.aliases && cmd.aliases.includes(commandName));

  if (!command) return;

  if (!cooldowns.has(command.name)) {
    cooldowns.set(command.name, new Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(command.name);
  const cooldownAmount = (command.cooldown || 1) * 1000;

  if (timestamps.has(message.author.id)) {
    const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      return message.reply(
        `please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${command.name}\` command.`
      );
    }
  }

  timestamps.set(message.author.id, now);
  setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

  try {
    console.log(`Executing command from ${message.author.id} (${message.author.username}): ${message.content}`)
    command.execute(message, args);
  } catch (error) {
    console.error(error);
    message.reply("There was an error executing that command.").catch(console.error);
  }
});
