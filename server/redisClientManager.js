const redis = require("redis");

const redisconfig = {
    redisPort: "12628",
    redisUrl: "redis-12628.c3.eu-west-1-1.ec2.cloud.redislabs.com",
    redisOption: { no_ready_check: true },
    redisKey: "fTHIB9NGouXBvEJQ5pBRcvihfYATQ0bL"
};
module.exports.redisconfig = redisconfig;

const initializeRedisClient = (config = redisconfig) => {
    const client = redis.createClient(
        config.redisPort,
        config.redisUrl,
        config.redisOption
    );
    client.auth(redisconfig.redisKey);
    return client;
};

module.exports.client = initializeRedisClient();
module.exports.subscriber = initializeRedisClient();
module.exports.publisher = initializeRedisClient();