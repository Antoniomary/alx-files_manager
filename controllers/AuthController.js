import sha1 from 'sha1';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(req, res) {
    const { authorization } = req.headers;

    if (!authorization || !authorization.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const authDetail = authorization.split(' ')[1];
    const decoded = Buffer.from(authDetail, 'base64').toString('utf-8');
    const [email, password] = decoded.split(':');

    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!dbClient.isAlive()) {
      return res.status(500).json({ error: 'unable to process request' });
    }

    const user = await dbClient.db.collection('users').findOne({
      email,
      password: sha1(password),
    });

    if (!user) {
      return res.status(401).send('Unauthorized');
    }

    const token = uuidv4();

    const key = `auth_${token}`;
    await redisClient.set(key, user._id.toString(), 86400);

    return res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];

    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const id = await redisClient.get(`auth_${token}`);
    if (!id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await redisClient.del(`auth_${token}`);

    return res.status(204).json({});
  }
}

export default AuthController;
