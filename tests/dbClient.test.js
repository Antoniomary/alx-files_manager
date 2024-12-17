import { expect } from 'chai';
import dbClient from '../utils/db';

describe('dbClient Test', () => {
  it('has isAlive, nbUsers, and nbFiles methods', () => {
    expect(dbClient.isAlive).to.exist;
    expect(dbClient.nbUsers).to.exist;
    expect(dbClient.nbFiles).to.exist;
  });

  it('connected to a database', () => {
    expect(dbClient.db).to.exist;
  });

  it('accepts queries', async () => {
    const newUser = await dbClient.db.collection('users').insertOne({ user: 'test@chai' });
    const result = await dbClient.db.collection('users').findOne({ user: 'test@chai' });

    expect(newUser).to.have.property('insertedId');
    expect(result.user).to.equal('test@chai');

    await dbClient.db.collection('users').deleteOne({ user: 'test@chai' });
    const noResult = await dbClient.db.collection('users').findOne({ user: 'test@chai' });
    
    expect(noResult).to.equal(null);
  });
});
