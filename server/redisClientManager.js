const redis = require("redis");
const isNullOrUndefined = require("util").isNullOrUndefined;
const promisify = require("util").promisify;

module.exports = class RedisClientManager {
  constructor(config) {
    if (isNullOrUndefined(config)) config = require("./redis.config");

    this.client = initializeRedisClient(config);
    this.subscriber = initializeRedisClient(config);
    this.publisher = initializeRedisClient(config);

    this.redisLpush = promisify(this.client.lpush).bind(this.client);
    this.redisDel = promisify(this.client.del).bind(this.client);
    this.redisLrange = promisify(this.client.lrange).bind(this.client);
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
