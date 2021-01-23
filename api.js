const http = require("http");
const https = require("https");
const express = require("express");
const app = express();
const { discordClient } = require(".");
const firebase = require('./firebase')

const httpPort = process.env.HTTP_PORT || 8080;
const httpsPort = process.env.HTTPS_PORT || 8081;
const { HTTPS } = require("./util/EvobotUtil");

// Express endpoints
app.get('/api/queue', (req, res) => {
    res.writeHead(200, {"Access-Control-Allow-Origin": "*"});
        let songs = [];
        discordClient.queue.forEach(value => value.songs.forEach(song => songs.push(song)));
        res.end(JSON.stringify({songs}, null, 2));
});

app.get('/api/topsongs', (req, res) => {
    res.writeHead(200, {"Access-Control-Allow-Origin": "*"});
        firebase.getMostPlayedSongs(5).then(result => {
            res.end(JSON.stringify(result, null, 2))
        });
});

app.get('/api/test', (req, res) => {
    res.writeHead(200, {"Access-Control-Allow-Origin": "*"});
        firebase.getAllSongHistory().then(result => {
            res.end(JSON.stringify({result}, null, 2));
        });
});

/**
 * HTTP Server
 */
if (HTTPS) {
    try {
        const cert = {
            key: HTTPS.private_key,
            cert: HTTPS.certificate
        }
        https.createServer(cert, app).listen(httpsPort);
        console.log(`HTTPS Server listening on port ${httpsPort}`);
    } catch (err) {
        console.warn(`Failed to  start HTTPS server: ${err}`)
    }
}
http.createServer(app).listen(httpPort);
console.log(`HTTP Server listening on port ${httpPort}`);