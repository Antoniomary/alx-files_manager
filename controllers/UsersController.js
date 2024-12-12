import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import { userQueue } from '../worker';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) return res.status(400).json({ error: 'Missing email' });
    if (!password) return res.status(400).json({ error: 'Missing password' });

    if (!dbClient.isAlive()) {
      return res.status(500).json({ error: 'unable to process request' });
    }

    const existingUser = await dbClient.db.collection('users').findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Already exist' });

    const newUser = {
      email,
      password: sha1(password),
    };

    const result = await dbClient.db.collection('users').insertOne(newUser);

    try {
      await userQueue.add({ userId: result.insertedId });
    } catch (err) {
      console.log(err);
    }

    return res.status(201).json({
      id: result.insertedId,
      email,
    });
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const id = await redisClient.get(`auth_${token}`);
    if (!id) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.db.collection('users').findOne({
      _id: new ObjectId(id),
    });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    return res.status(200).json({
      id: user._id,
      email: user.email,
    });
  }
}

export default UsersController;
