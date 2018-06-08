const redis = require("redis");
const isNullOrUndefined = require("util").isNullOrUndefined;

module.exports = class RedisClientManager {
    constructor(config) {
        if (isNullOrUndefined(config)) config = require("./redis.config");

        this.client = initializeRedisClient(config);
        this.subscriber = initializeRedisClient(config);
        this.publisher = initializeRedisClient(config);
    }
};

initializeRedisClient = config => {
    const client = redis.createClient(
        config.redisPort,
        config.redisUrl,
        config.redisOption
    );
    client.auth(config.redisKey);
    return client;
};
