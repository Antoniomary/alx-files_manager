import { expect } from 'chai';
import redisClient from '../utils/redis';

describe('redisClient Test', () => {
  it('has isAlive, get, set, and del methods', () => {
    expect(redisClient.isAlive).to.exist;
    expect(redisClient.get).to.exist;
    expect(redisClient.set).to.exist;
    expect(redisClient.del).to.exist;
  });

  it('connected to a redis server', () => {
    expect(redisClient.client.connected).to.equal(true);
  });

  it('accepts queries', async () => {
    await redisClient.set('user', 'test', 1000);
    const result = await redisClient.get('user');

    expect(result).to.equal('test');

    await redisClient.del('user');
    const noResult = await redisClient.get('user');
    
    expect(noResult).to.equal(null);
  });
});
