const { join } = require("path");
const { execute: skipSong } = require(join(__dirname, "commands", "skip"));
const Discord = require("discord.js");
//require('commands/skip');

module.exports = { getQueue, removeFromQueue }

function getQueue(req, res, client) {
    logRequest(req);
    let queue = client.queue.get(req.params.guildId);
    if (queue) {
        res.writeHead(200, {"Access-Control-Allow-Origin": "*"});
        res.end(JSON.stringify(queue.songs, null, 2));
    } else {
        console.log(`Guild ${req.params.guildId} not found`);
        res.writeHead(200);
        res.end("{}");
    }
}

function removeFromQueue(req, res, client) {
    logRequest(req);
    let queue = client.queue.get(req.params.guildId);

    if (!queue) {
        res.writeHead(200);
        res.end("{}");
        return;
    }

    let songs = queue.songs;
    if (songs && songs.length >= req.params.songId) {
        let guild = client.guilds.cache.get("701565766033473607");
        const message = new Discord.Message(client, {id: "772222284252446779", test: "123"}, new Discord.DMChannel(client, {guild: client.guilds.cache.get("701565766033473607")}));
        skipSong(new Discord.Message(client, {id: "772222284252446779", guild: client.guilds.cache.get("701565766033473607"), test: "123"}, new Discord.DMChannel(client, {type: 1})));

        res.writeHead(200, {"Access-Control-Allow-Origin": "*"});
        res.end(JSON.stringify({songs}, null, 2));
    } else {
        console.warn(`Failed to remove song ${req.params.songId} (queue length ${songs ? songs.length : 0})`);
        res.writeHead(400);
        res.end(JSON.stringify(songs));
    }
}

function logRequest(req) {
    console.log(`Request from ${req.client.remoteAddress}: ${req.path}`)
}