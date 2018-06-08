const promisify = require("util").promisify;

module.exports = class targetsManager {
    constructor(redisclientmanager, subManager,targetsPerChannel) {
        this.rcm = redisclientmanager;
        this.subManager = subManager;
        this.targetsPerChannel = targetsPerChannel;
    }

    publishToChannel(x, y, channel, type, color, size) {
        const payload = JSON.stringify({
            channel: channel,
            type: type,
            x: x,
            y: y,
            color: color,
            size: size
        });
        this.rcm.publisher.publish(channel, payload);
    }

    getCoordinatesInRange(maxX, maxY) {
        const x = Math.floor(Math.random() * maxX);
        const y = Math.floor(Math.random() * maxY);
        return {x: x, y: y};
    }

    targetsManagement() {
        console.log("Targets management");
        this.subManager.channelsUsed.forEach(channel => {
            this.setTargetsForAChannel(channel);
        });
    }

    setTargetsForAChannel(channel) {
        let targets = this.targetsPerChannel.get(channel) || new Set();
        if (targets.size < 3) {
            const coordinates = this.getCoordinatesInRange(800, 500);
            targets = targets.add(coordinates);
            console.log("ecriture de :");
            this.targetsPerChannel.set(channel, targets);
            this.publishToChannel(coordinates.x, coordinates.y, channel, "target", "red", 10);
        }
    }
};