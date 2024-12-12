import Bull from 'bull';
import thumbnail from 'image-thumbnail';
import fs from 'fs';
import { ObjectId } from 'mongodb';
import dbClient from './utils/db';

const fileQueue = new Bull('fileQueue');
const userQueue = new Bull('userQueue');

fileQueue.process(async (job) => {
  const { fileId, userId } = job.data;
  if (!fileId) throw new Error('Missing fileId');
  if (!userId) throw new Error('Missing userId');

  const file = await dbClient.db.collection('files').findOne({
    _id: ObjectId(fileId),
    userId: ObjectId(userId),
  });
  if (!file) throw new Error('File not found');

  try {
    let width;
    let imageThumbnail;
    let imageThumbnailPath;

    width = 500;
    imageThumbnail = await thumbnail(file.localPath, { width });
    imageThumbnailPath = `${file.localPath}_${width}`;
    fs.writeFileSync(imageThumbnailPath, imageThumbnail);

    width = 250;
    imageThumbnail = await thumbnail(file.localPath, { width });
    imageThumbnailPath = `${file.localPath}_${width}`;
    fs.writeFileSync(imageThumbnailPath, imageThumbnail);

    width = 100;
    imageThumbnail = await thumbnail(file.localPath, { width });
    imageThumbnailPath = `${file.localPath}_${width}`;
    fs.writeFileSync(imageThumbnailPath, imageThumbnail);
  } catch (err) {
    console.log('Error processing width:', err);
  }
});

userQueue.process(async (job) => {
  const { userId } = job.data;
  if (!userId) throw Error('Missing userId');

  const user = await dbClient.db.collection('users').findOne({
    _id: ObjectId(userId),
  });
  if (!user) throw new Error('User not found');

  console.log(`Welcome ${user.email}`);
});

export { fileQueue, userQueue };
