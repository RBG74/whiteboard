const rcm = require("./redisClientManager");
const SubscriptionManager = require("./SubscriptionManager");
const subManager = new SubscriptionManager(rcm.subscriber);

function publishToChannel(x, y, channel, type, color, size) {
    const payload = JSON.stringify({
        channel: channel,
        type: type,
        x: x,
        y: y,
        color: color,
        size: size
    });
    rcm.publisher.publish(channel, payload);
}

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
        console.log("ecriture de :");
        targetsPerChannel.set(channel, targets);
        targetManager.publishToChannel(coordinates.x, coordinates.y, channel,"target","red",10);
        publishTargetToChannel(coordinates.x, coordinates.y, channel);
    }
}

module.exports.publishToChannel = publishToChannel;
module.exports.targetsManagement = targetsManagement;