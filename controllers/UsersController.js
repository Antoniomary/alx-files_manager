import dbClient from '../utils/db';
import sha1 from 'sha1';

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
      email: email,
      password: sha1(password),
    };

    const result = await dbClient.db.collection('users').insertOne(newUser);

    res.status(201).json({
      id: result.insertedId,
      email: email,
    });
  }
}

export default UsersController;
