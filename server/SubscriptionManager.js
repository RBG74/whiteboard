module.exports = class SubscriptionManager {
    constructor(redisSubscriber) {
        this.redisSubscriber = redisSubscriber;
        this.socketsPerChannels = new Map();
        this.channelsPerSocket = new WeakMap();
        this.channelsUsed = [];
    }

    //Subscribe a socket to a specific channel.
    subscribe(socket, channel) {
        if (this.channelsUsed.indexOf(channel) == -1)
            this.channelsUsed.push(channel);
        let socketSubscribed =
            this.socketsPerChannels.get(channel) || new Set();
        let channelSubscribed = this.channelsPerSocket.get(socket) || new Set();

        if (socketSubscribed.size == 0) {
            console.log("Subscribed to " + channel);
            this.redisSubscriber.subscribe(channel);
        }

        socketSubscribed = socketSubscribed.add(socket);
        channelSubscribed = channelSubscribed.add(channel);

        this.socketsPerChannels.set(channel, socketSubscribed);
        this.channelsPerSocket.set(socket, channelSubscribed);
    }

    //Unsubscribe a socket from a specific channel.
    unsubscribe(socket, channel) {
        if (this.channelsUsed.indexOf(channel) > -1)
            this.channelsUsed.splice(this.channelsUsed.indexOf(channel));

        let socketSubscribed =
            this.socketsPerChannels.get(channel) || new Set();
        let channelSubscribed = this.channelsPerSocket.get(socket) || new Set();

        socketSubscribed.delete(socket);
        channelSubscribed.delete(channel);

        if (socketSubscribed.size == 0) {
            console.log("Unsubscribed to " + channel);
            this.redisSubscriber.unsubscribe(channel);
        }

        socketsPerChannels.set(channel, socketSubscribed);
        channelsPerSocket.set(socket, channelSubscribed);
    }

    // Subscribe a socket from all channels.
    unsubscribeAll(socket) {
        const channelSubscribed =
            this.channelsPerSocket.get(socket) || new Set();

        channelSubscribed.forEach(channel => {
            unsubscribe(socket, channel);
        });
    }

    //Broadcast a message to all sockets connected to this server.
    broadcastToSockets(channel, data) {
        const socketSubscribed =
            this.socketsPerChannels.get(channel) || new Set();

        socketSubscribed.forEach(client => {
            client.send(data);
        });
    }
};
