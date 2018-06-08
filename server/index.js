const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const uuidv4 = require("uuid/v4");
const promisify = require("util").promisify;
const isNullOrUndefined = require("util").isNullOrUndefined;
const app = express();
const PUBLIC_FOLDER = path.join(__dirname, "../public");
const PORT = process.env.PORT || 5000;

const usernameProvider = require("./provider/usernameProvider");

// Initialize a simple http server
const server = http.createServer(app);

// Initialize redis clients
const redisconfig = require("./redis.config");
const RedisClientManager = require("./RedisClientManager");
const rcm = new RedisClientManager(redisconfig);

// Initialize the SubscriptionManager which handles subscription/unsubscription from channel and broadcasting to them
const SubscriptionManager = require("./SubscriptionManager");
const subManager = new SubscriptionManager(rcm);

// Manager for target
const TargetsManager = require("./TargetsManager");
const targetsManager = new TargetsManager(rcm, subManager);

rcm.subscriber.on("message", function(channel, message) {
    subManager.broadcastToSockets(channel, message);
});

async function socketSubscribed(message, ws) {
    if (isNullOrUndefined(message.name))
        message.name = await usernameProvider.getRandomUsername();
    subManager.subscribe(ws, message.channel, message.name);
    const targets = await targetsManager.getOldTargets(message.channel);
    targets.forEach(target => {
        subManager.broadcastToSockets(message.channel, target);
    });
}

// Initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

// Broadcast message from client
wss.on("connection", ws => {
    ws.on("close", () => {
        const channelSubscribed = subManager.channelsPerSocket.get(ws);
        subManager.unsubscribeAll(ws);
        channelSubscribed.forEach(channel => {
            targetsManager.deleteTargetsFromChannel(channel);
        });
    });

    ws.on("message", async data => {
        const message = JSON.parse(data.toString());

        switch (message.type) {
            case "subscribe":
                socketSubscribed(message, ws);
                break;
            case "shoot":
                targetsManager.handleClientShooting(message, ws);
                break;
            default:
                console.log("Unhandled message came in:", message);
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
    setInterval(() => targetsManager.targetsManagement(), 700);
});
