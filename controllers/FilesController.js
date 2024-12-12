import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import { lookup } from 'mime-types';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
// import { fileQueue } from '../worker';

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const {
      name, type, parentId = 0, isPublic = false, data,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing name' });
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== 0) {
      const parentFile = await dbClient.db.collection('files').findOne({
        _id: ObjectId(parentId),
      });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const fileData = {
      userId: new ObjectId(userId),
      name,
      type,
      parentId: parentId ? new ObjectId(parentId) : 0,
      isPublic,
    };

    if (type === 'folder') {
      const newFile = await dbClient.db.collection('files').insertOne(fileData);

      return res.status(201).json({
        id: newFile.insertedId,
        userId: fileData.userId,
        name: fileData.name,
        type: fileData.type,
        isPublic: fileData.isPublic,
        parentId: fileData.parentId,
      });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    fs.mkdirSync(folderPath, { recursive: true });

    const fileName = uuidv4();
    fileData.localPath = path.join(folderPath, fileName);

    const asciiData = Buffer.from(data, 'base64');
    fs.writeFileSync(fileData.localPath, asciiData);

    const newFile = await dbClient.db.collection('files').insertOne(fileData);

    /*
    if (type === 'image') {
      try {
        await fileQueue.add({ fileId: newFile.insertedId, userId: fileData.userId });
      } catch (err) {
        console.log(err);
      }
    }
    */

    return res.status(201).json({
      id: newFile.insertedId,
      userId: fileData.userId,
      name: fileData.name,
      type: fileData.type,
      isPublic: fileData.isPublic,
      parentId: fileData.parentId,
    });
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.db.collection('users').findOne({
      _id: ObjectId(userId),
    });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    if (!fileId) return res.status(404).json({ error: 'Not found' });

    const file = await dbClient.db.collection('files').findOne({
      _id: ObjectId(fileId),
      userId: user._id,
    });
    if (!file) return res.status(404).json({ error: 'Not found' });

    delete file.localPath;

    return res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const userObjectId = new ObjectId(userId);

    let parentId = req.query.parentId || 0;
    if (parentId !== 0) parentId = ObjectId(parentId);

    const page = parseInt(req.query.page, 10) || 0;

    const pageSize = 20;
    const skipItems = page * pageSize;

    const aggregationMatch = parentId === 0 ? {
      userId: userObjectId, parentId: 0,
    } : {
      userId: userObjectId, parentId,
    };

    const files = await dbClient.db.collection('files').aggregate([
      { $match: aggregationMatch },
      { $skip: skipItems },
      { $limit: pageSize },
    ]).toArray();

    const linkedFiles = files.map((file) => ({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    }));

    return res.status(200).json(linkedFiles);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id || '';
    let file = await dbClient.db.collection('files').findOne({
      _id: ObjectId(id),
      userId: ObjectId(userId),
    });
    if (!file) return res.status(404).json({ error: 'Not found' });

    await dbClient.db.collection('files').updateOne(
      { _id: ObjectId(id) },
      { $set: { isPublic: true } },
    );

    file = await dbClient.db.collection('files').findOne({
      _id: ObjectId(id),
      userId: ObjectId(userId),
    });

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = req.params.id || '';
    let file = await dbClient.db.collection('files').findOne({
      _id: ObjectId(id),
      userId: ObjectId(userId),
    });
    if (!file) return res.status(404).json({ error: 'Not found' });

    await dbClient.db.collection('files').updateOne(
      { _id: ObjectId(id) },
      { $set: { isPublic: false } },
    );

    file = await dbClient.db.collection('files').findOne({
      _id: ObjectId(id),
      userId: ObjectId(userId),
    });

    return res.status(200).json({
      id: file._id,
      userId: file.userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId,
    });
  }

  static async getFile(req, res) {
    const id = req.params.id || '';
    const file = await dbClient.db.collection('files').findOne({
      _id: ObjectId(id),
    });
    if (!file) return res.status(404).json({ error: 'Not found' });

    const token = req.headers['x-token'];
    let userId = null;
    if (token) userId = await redisClient.get(`auth_${token}`);

    if (!file.isPublic && (!userId || file.userId.toString() !== userId)) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: 'A folder doesn\'t have content' });
    }

    if (!fs.existsSync(file.localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const mimeType = lookup(file.name);
    const fileContent = fs.readFileSync(file.localPath);

    res.setHeader('Content-Type', mimeType);

    return res.send(fileContent);
  }
}

export default FilesController;
