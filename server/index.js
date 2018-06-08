const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const uuidv4 = require("uuid/v4");
const promisify = require("util").promisify;
const app = express();
const PUBLIC_FOLDER = path.join(__dirname, "../public");
const PORT = process.env.PORT || 5000;

// Initialize a simple http server
const server = http.createServer(app);
// Initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

// Initialize redis clients
const rcm = require("./redisClientManager");

// Manager for target
const targetManager = require("./targetsManager");

// Promosify the redis function we're gonna use
const redisLpush = promisify(rcm.client.lpush).bind(rcm.client);
const redisLrange = promisify(rcm.client.lrange).bind(rcm.client);

const SubscriptionManager = require("./SubscriptionManager");
const subManager = new SubscriptionManager(rcm.subscriber);

const targetsPerChannel = new Map();

rcm.subscriber.on("message", function(channel, message) {
    console.log(channel, message);
    subManager.broadcastToSockets(channel, message);
});

// Broadcast message from client
wss.on("connection", ws => {
    ws.on("close", () => {
        subManager.unsubscribeAll(ws);
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
                const targets = targetsPerChannel.get(message.channel) ;
                targets.forEach(position => {
                    let diffX = position.x - message.payload.x;
                    let diffY = position.y - message.payload.y;
                    if((diffX >= -10 && diffX <= 10) && (diffY >= -10 && diffY <= 10)){
                        targets.delete(position);
                        targetManager.publishToChannel(position.x, position.y, message.channel,"clean","white",12);
                    }
                });
                break;
            default:
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
    setInterval(() => targetManager.targetsManagement(), 5000);
});
