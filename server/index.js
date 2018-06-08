const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const uuidv4 = require("uuid/v4");
const { promisify } = require("util");

const redis = require("redis");

// Initialize redis clients
var redisClient = redis.createClient(
    "12628",
    "redis-12628.c3.eu-west-1-1.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);
redisClient.auth("fTHIB9NGouXBvEJQ5pBRcvihfYATQ0bL");
const redisPublisher = redis.createClient(
    "12628",
    "redis-12628.c3.eu-west-1-1.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);
redisPublisher.auth("fTHIB9NGouXBvEJQ5pBRcvihfYATQ0bL");
const redisSubscriber = redis.createClient(
    "12628",
    "redis-12628.c3.eu-west-1-1.ec2.cloud.redislabs.com",
    { no_ready_check: true }
);
redisSubscriber.auth("fTHIB9NGouXBvEJQ5pBRcvihfYATQ0bL");

// Promosify the redis function we're gonna use
const redisLpush = promisify(redisClient.lpush).bind(redisClient);
const redisLrange = promisify(redisClient.lrange).bind(redisClient);

const app = express();

const PUBLIC_FOLDER = path.join(__dirname, "../public");
const PORT = process.env.PORT || 5000;

const socketsPerChannels = new Map();
const channelsPerSocket = new WeakMap();
const channelsUsed = [];
const targetsPerChannel = new Map();

// Initialize a simple http server
const server = http.createServer(app);

// Initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

/*
 * Subscribe a socket to a specific channel.
 */
function subscribe(socket, channel) {
    if (channelsUsed.indexOf(channel) == -1) channelsUsed.push(channel);
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
    if (channelsUsed.indexOf(channel) > -1)
        channelsUsed.splice(channelsUsed.indexOf(channel));
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
    redisLrange(channel, 0, 2000)
        .then(reply => {
            //console.log(reply);
            reply.forEach(element => {
                broadcastToSockets(channel, element);
            });
        })
        .catch(err => {
            console.log(err);
        });
}

redisSubscriber.on("message", function(channel, message) {
    console.log(channel, message);
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
            case "shoot":
                const targets = targetsPerChannel.get(message.channel) ;
                targets.forEach(position => {
                    let diffX = position.x - message.payload.x;
                    let diffY = position.y - message.payload.y;
                    if((diffX >= -10 && diffX <= 10) && (diffY >= -10 && diffY <= 10)){
                        targets.delete(position);
                        publishCleanToChannel(position.x, position.y, message.channel);

                    }
                });
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

function getCoordinatesInRange(maxX, maxY) {
    const x = Math.floor(Math.random() * maxX);
    const y = Math.floor(Math.random() * maxY);
    return { x: x, y: y };
}

function targetsManagement() {
    //console.log("Targets management");
    channelsUsed.forEach(channel => {
        setTargetsForAChannel(channel);
    });
}

function setTargetsForAChannel(channel) {
    let targets = targetsPerChannel.get(channel) || new Set();
    if (targets.size < 3) {
        const coordinates = getCoordinatesInRange(800, 500);
        targets = targets.add(coordinates);
        console.log("ecriture de :");
        targetsPerChannel.set(channel, targets);

        publishTargetToChannel(coordinates.x, coordinates.y, channel);
    }
}

function publishTargetToChannel(x, y, channel){
    const payload = JSON.stringify({
        channel: channel,
        type: "target",
        x: x,
        y: y,
        color: "red",
        size: 10
    });
    redisPublisher.publish(channel, payload);
}

function publishCleanToChannel(x, y, channel){
    const payload = JSON.stringify({
        channel: channel,
        type: "clean",
        x: x,
        y: y,
        color: "white",
        size: 12
    });
    redisPublisher.publish(channel, payload);
}

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
    setInterval(() => targetsManagement(), 5000);
});
