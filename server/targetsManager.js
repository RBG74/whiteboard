const promisify = require("util").promisify;
const isNullOrUndefined = require("util").isNullOrUndefined;

module.exports = class TargetsManager {
    constructor(redisclientmanager, subManager) {
        this.rcm = redisclientmanager;
        this.subManager = subManager;
        this.targetsPerChannel = new Map();
        this.scorePerSocket = new Map();

        this.targetSize = 10;
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
        this.rcm.redisLpush(channel, payload).catch(err => {
            console.log(err);
        });
    }

    getCoordinatesInRange(maxX, maxY) {
        const x = Math.floor(Math.random() * maxX);
        const y = Math.floor(Math.random() * maxY);
        return { x: x, y: y };
    }

    targetsManagement() {
        this.subManager.channelsUsed.forEach(channel => {
            this.setTargetsForAChannel(channel);
        });
    }

    async setTargetsForAChannel(channel) {
        let targets = this.targetsPerChannel.get(channel);

        if (isNullOrUndefined(targets)) {
            targets = new Set();
        }

        if (targets.size < 3) {
            const coordinates = this.getCoordinatesInRange(800, 500);
            targets = targets.add(coordinates);
            this.targetsPerChannel.set(channel, targets);
            this.publishToChannel(
                coordinates.x,
                coordinates.y,
                channel,
                "target",
                "red",
                this.targetSize
            );
        }
    }

    deleteTargetsFromChannel(channel) {
        return this.rcm.redisDel(channel);
    }

    getOldTargets(channel) {
        return new Promise(async (resolve, reject) => {
            if (isNullOrUndefined(this.targetsPerChannel.get(channel))) {
                await this.deleteTargetsFromChannel(channel);
            }
            this.rcm
                .redisLrange(channel, 0, 2000)
                .then(reply => {
                    let targets = new Set();
                    reply.forEach(function(element) {
                        let item = JSON.parse(element);
                        if (item.type == "target") {
                            targets.add(element);
                        }
                    });
                    resolve(targets);
                })
                .catch(err => reject(err));
        });
    }

    handleClientShooting(message, socket) {
        const targets = this.targetsPerChannel.get(message.channel);
        targets.forEach(position => {
            let diffX = position.x - message.payload.x;
            let diffY = position.y - message.payload.y;
            if (diffX >= -10 && diffX <= 10 && (diffY >= -10 && diffY <= 10)) {
                targets.delete(position);
                this.targetsPerChannel.set(message.channel, targets);
                this.publishToChannel(
                    position.x,
                    position.y,
                    message.channel,
                    "clean",
                    "white",
                    this.targetSize + 2
                );
                let score = this.scorePerSocket.get(socket) || 0;
                this.scorePerSocket.set(socket, score++);
            }
        });
    }
};
