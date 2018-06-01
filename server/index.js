const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const uuidv4 = require("uuid/v4");
const { promisify } = require("util");

const redis = require("redis");
const redisClient = redis.createClient();
const redisPublisher = redis.createClient();
const redisSubscriber = redis.createClient();

const app = express();

const PUBLIC_FOLDER = path.join(__dirname, "../public");
const PORT = process.env.PORT || 5000;

const socketsPerChannels /* Map<string, Set<WebSocket>> */ = new Map();
const channelsPerSocket /* WeakMap<WebSocket, Set<string> */ = new WeakMap();

// Initialize a simple http server
const server = http.createServer(app);

// Initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

const redisLpush = promisify(redisClient.lpush).bind(redisClient);
const redisLrange = promisify(redisClient.lrange).bind(redisClient);

/*
 * Subscribe a socket to a specific channel.
 */
function subscribe(socket, channel) {
    let socketSubscribed = socketsPerChannels.get(channel) || new Set();
    let channelSubscribed = channelsPerSocket.get(socket) || new Set();

    if (socketSubscribed.size == 0) {
        console.log("Subscribed to " + channel);
        redisSubscriber.subscribe(channel);
    }

    socketSubscribed = socketSubscribed.add(socket);
    channelSubscribed = channelSubscribed.add(channel);

    socketsPerChannels.set(channel, socketSubscribed);
    channelsPerSocket.set(socket, channelSubscribed);
}

/*
 * Unsubscribe a socket from a specific channel.
 */
function unsubscribe(socket, channel) {
    let socketSubscribed = socketsPerChannels.get(channel) || new Set();
    let channelSubscribed = channelsPerSocket.get(socket) || new Set();

    socketSubscribed.delete(socket);
    channelSubscribed.delete(channel);

    if (socketSubscribed.size == 0) {
        console.log("Unsubscribed to " + channel);
        redisSubscriber.unsubscribe(channel);
    }

    socketsPerChannels.set(channel, socketSubscribed);
    channelsPerSocket.set(socket, channelSubscribed);
}

/*
 * Subscribe a socket from all channels.
 */
function unsubscribeAll(socket) {
    const channelSubscribed = channelsPerSocket.get(socket) || new Set();

    channelSubscribed.forEach(channel => {
        unsubscribe(socket, channel);
    });
}

/*
 * Broadcast a message to all sockets connected to this server.
 */
function broadcastToSockets(channel, data) {
    const socketSubscribed = socketsPerChannels.get(channel) || new Set();

    socketSubscribed.forEach(client => {
        client.send(data);
    });
}

function getOldMessages(channel) {
    redisLrange(channel, 0, -1)
        .then(reply => {
            console.log(reply);
            reply.forEach(element => {
                broadcastToSockets(channel, element);
            });
        })
        .catch(err => {
            console.log(err);
        });
}

redisSubscriber.on("message", function(channel, message) {
    broadcastToSockets(channel, message);
});

// Broadcast message from client
wss.on("connection", ws => {
    ws.on("close", () => {
        unsubscribeAll(ws);
    });

    ws.on("message", data => {
        const message = JSON.parse(data.toString());

        switch (message.type) {
            case "subscribe":
                subscribe(ws, message.channel);
                getOldMessages(message.channel);
                break;
            default:
                redisPublisher.publish(message.channel, data);
                redisLpush(message.channel, data)
                    .then()
                    .catch(err => {
                        console.log(err);
                    });
                break;
        }
    });
});

// Assign a random channel to people opening the application
app.get("/", (req, res) => {
    res.redirect(`/${uuidv4()}`);
});

app.get("/:channel", (req, res, next) => {
    res.sendFile(path.join(PUBLIC_FOLDER, "index.html"), {}, err => {
        if (err) {
            next(err);
        }
    });
});

app.use(express.static(PUBLIC_FOLDER));

server.listen(PORT, () => {
    console.log(`Server started on port ${server.address().port}`);
});
