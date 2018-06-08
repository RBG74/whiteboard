const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const uuidv4 = require("uuid/v4");
const promisify = require("util").promisify;
const SubscriptionManager = require("./SubscriptionManager");
const app = express();
const PUBLIC_FOLDER = path.join(__dirname, "../public");
const PORT = process.env.PORT || 5000;

// Initialize a simple http server
const server = http.createServer(app);
// Initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

// Initialize redis clients
const rcm = require("./redisClientManager");
const redisClient = rcm.initializeRedisClient();
const redisSubscriber = rcm.initializeRedisClient();
const redisPublisher = rcm.initializeRedisClient();

// Promosify the redis function we're gonna use
const redisLpush = promisify(redisClient.lpush).bind(redisClient);
const redisLrange = promisify(redisClient.lrange).bind(redisClient);

const subManager = new SubscriptionManager(redisSubscriber);

const targetsPerChannel = new Map();

redisSubscriber.on("message", function(channel, message) {
    console.log(channel, message);
    subManager.broadcastToSockets(channel, message);
});

// Broadcast message from client
wss.on("connection", ws => {
    ws.on("close", () => {
        unsubscribeAll(ws);
    });

    ws.on("message", data => {
        //TODO: handle socket shooting target
        const message = JSON.parse(data.toString());

        switch (message.type) {
            case "subscribe":
                subManager.subscribe(ws, message.channel);
                subManager.getOldMessages(message.channel);
                break;
            case "shoot":
                "";
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
    console.log("Targets management");
    subManager.channelsUsed.forEach(channel => {
        setTargetsForAChannel(channel);
    });
}

function setTargetsForAChannel(channel) {
    let targets = targetsPerChannel.get(channel) || new Set();
    if (targets.size < 3) {
        const coordinates = getCoordinatesInRange(800, 500);

        targets = targets.add(coordinates);

        targetsPerChannel.set(channel, targets);

        publishTargetToChannel(coordinates.x, coordinates.y, channel);
    }
}

function publishTargetToChannel(x, y, channel) {
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
