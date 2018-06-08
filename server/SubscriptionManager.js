const promisify = require("util").promisify;

module.exports = class SubscriptionManager {
    constructor(redisclientmanager) {
        this.rcm = redisclientmanager;

        this.socketsPerChannels = new Map();
        this.channelsPerSocket = new WeakMap();
        this.channelsUsed = [];
        this.namePerSocket = new Map();
    }

    //Subscribe a socket to a specific channel.
    subscribe(socket, channel, name) {
        if (this.channelsUsed.indexOf(channel) == -1)
            this.channelsUsed.push(channel);
        let socketSubscribed =
            this.socketsPerChannels.get(channel) || new Set();
        let channelSubscribed = this.channelsPerSocket.get(socket) || new Set();

        if (socketSubscribed.size == 0) {
            this.rcm.subscriber.subscribe(channel);
        }

        this.namePerSocket.set(socket, name);

        socketSubscribed = socketSubscribed.add(socket);
        channelSubscribed = channelSubscribed.add(channel);

        this.socketsPerChannels.set(channel, socketSubscribed);
        this.channelsPerSocket.set(socket, channelSubscribed);

        console.log(name, "just subscribed to channel", channel);
    }

    //Unsubscribe a socket from a specific channel.
    unsubscribe(socket, channel) {
        if (this.channelsUsed.indexOf(channel) > -1)
            this.channelsUsed.splice(this.channelsUsed.indexOf(channel));

        let socketSubscribed =
            this.socketsPerChannels.get(channel) || new Set();
        let channelSubscribed = this.channelsPerSocket.get(socket) || new Set();

        const name = this.namePerSocket.get(socket);
        this.namePerSocket.delete(socket);

        socketSubscribed.delete(socket);
        channelSubscribed.delete(channel);

        if (socketSubscribed.size == 0) {
            this.rcm.subscriber.unsubscribe(channel);
        }

        this.socketsPerChannels.set(channel, socketSubscribed);
        this.channelsPerSocket.set(socket, channelSubscribed);

        console.log(name, "just unsubscribed from channel", channel);
    }

    // Subscribe a socket from all channels.
    unsubscribeAll(socket) {
        const channelSubscribed =
            this.channelsPerSocket.get(socket) || new Set();

        channelSubscribed.forEach(channel => {
            this.unsubscribe(socket, channel);
        });
    }

    //Broadcast a message to all sockets connected to this server.
    broadcastToSockets(channel, data) {
        const socketSubscribed =
            this.socketsPerChannels.get(channel) || new Set();

        socketSubscribed.forEach(client => {
            client.send(data);
        });
        console.log("Broadcasting", data, "to", socketSubscribed.size,"clients.")
    }

    // Get the last 2000 messages published in the channel and broadcasts them to the channel
    getOldMessages(channel) {
        const redisLrange = promisify(this.rcm.client.lrange).bind(this.rcm.client);
        redisLrange(channel, 0, 2000)
            .then(reply => {
                //console.log(reply);
                reply.forEach(element => {
                    this.broadcastToSockets(channel, element);
                });
            })
            .catch(err => {
                console.log(err);
            });
    }
};
