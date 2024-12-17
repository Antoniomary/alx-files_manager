import chai from 'chai';
import chaiHttp from 'chai-http';
import fs from 'fs';
import app from '../server';
import dbClient from '../utils/db';


chai.use(chaiHttp);
const { expect } = chai;

describe('API Endpoint Tests', () => {
  let token;

  after(async () => {
    await dbClient.db.collection('users').deleteOne({ email: 'user@test.com' });
    await dbClient.db.collection('files').deleteOne({ name: 'testFile' });
    await dbClient.db.collection('files').deleteOne({ name: 'testFolder' });
    await dbClient.db.collection('files').deleteOne({ name: 'testImage' });
  });

  it('GET /status', async () => {
    const res = await chai.request(app)
      .get('/status');

    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({ 'redis': true, 'db': true });
  });

  it('GET /stats', async () => {
    const res = await chai.request(app)
      .get('/stats');

    expect(res.status).to.equal(200);
    expect(res.body).to.have.property('users');
    expect(res.body).to.have.property('files');
  });

  it('POST /users', async() => {
    const noPassRes = await chai.request(app)
      .post('/users')
      .send({ email: 'user@test.com' });

    expect(noPassRes.status).to.equal(400);
    expect(noPassRes.body).to.deep.equal({ error: 'Missing password' });

    const noEmailRes = await chai.request(app)
      .post('/users')
      .send({ password: 'testPassword' });

    expect(noEmailRes.status).to.equal(400);
    expect(noEmailRes.body).to.deep.equal({ error: 'Missing email' });

    const res = await chai.request(app)
      .post('/users')
      .send({ email: 'user@test.com', password: 'testPassword' });

    expect(res.status).to.equal(201);
    expect(res.body).to.have.property('id');
    expect(res.body).to.have.property('email', 'user@test.com');

    const alreadyExistRes = await chai.request(app)
      .post('/users')
      .send({ email: 'user@test.com', password: 'testPassword' });

    expect(alreadyExistRes.status).to.equal(400);
    expect(alreadyExistRes.body).to.deep.equal({ error: 'Already exist' });
  });

  it('GET /connect', async() => {
    const noAuthorizationRes = await chai.request(app)
      .get('/connect');

    expect(noAuthorizationRes.status).to.equal(401);
    expect(noAuthorizationRes.body).to.deep.equal({ error: 'Unauthorized' });

    const authorizationWithoutBasicRes = await chai.request(app)
      .get('/connect')
      .set('authorization', 'testAuthorization');

    expect(authorizationWithoutBasicRes.status).to.equal(401);
    expect(authorizationWithoutBasicRes.body).to.deep.equal({ error: 'Unauthorized' });

    const wrongAuthorizationRes = await chai.request(app)
      .get('/connect')
      .set('authorization', 'wrongAuthorization');

    expect(wrongAuthorizationRes.status).to.equal(401);
    expect(wrongAuthorizationRes.body).to.deep.equal({ error: 'Unauthorized' });

    const authorizationRes = await chai.request(app)
      .get('/connect')
      .set('authorization', 'Basic dXNlckB0ZXN0LmNvbTp0ZXN0UGFzc3dvcmQ=');

    expect(authorizationRes.status).to.equal(200);
    expect(authorizationRes.body).to.have.property('token');

    token = authorizationRes.body.token;
  });

  it('GET /users/me', async() => {
    const noTokenRes = await chai.request(app)
      .get('/users/me');

    expect(noTokenRes.status).to.equal(401);
    expect(noTokenRes.body).to.deep.equal({ error: 'Unauthorized' });

    const incorrectTokenRes = await chai.request(app)
      .get('/users/me')
      .set('x-token', 'fakeToken');

    expect(noTokenRes.status).to.equal(401);
    expect(noTokenRes.body).to.deep.equal({ error: 'Unauthorized' });

    const getUserRes = await chai.request(app)
      .get('/users/me')
      .set('x-token', token);

    expect(getUserRes.status).to.equal(200);
    expect(getUserRes.body).to.have.property('id');
    expect(getUserRes.body).to.have.property('email', 'user@test.com');
  });

  it('POST /files', async() => {
    const noTokenRes = await chai.request(app)
      .post('/files');

    expect(noTokenRes.status).to.equal(401);
    expect(noTokenRes.body).to.deep.equal({ error: 'Unauthorized' });

    const incorrectTokenRes = await chai.request(app)
      .post('/files')
      .set('x-token', 'fakeToken');

    expect(incorrectTokenRes.status).to.equal(401);
    expect(incorrectTokenRes.body).to.deep.equal({ error: 'Unauthorized' });

    const noNameRes = await chai.request(app)
      .post('/files')
      .set('x-token', token)
      .send({});

    expect(noNameRes.status).to.equal(400);
    expect(noNameRes.body).to.deep.equal({ error: 'Missing name' });

    const noTypeRes = await chai.request(app)
      .post('/files')
      .set('x-token', token)
      .send({ name: 'testFile' });

    expect(noTypeRes.status).to.equal(400);
    expect(noTypeRes.body).to.deep.equal({ error: 'Missing type' });

    const fakeTypeRes = await chai.request(app)
      .post('/files')
      .set('x-token', token)
      .send({
        name: 'testFile',
        type: 'fakeType',
      });

    expect(fakeTypeRes.status).to.equal(400);
    expect(fakeTypeRes.body).to.deep.equal({ error: 'Missing type' });

    const notFolderTypeWithoutDataRes = await chai.request(app)
      .post('/files')
      .set('x-token', token)
      .send({
        name: 'testFile',
        type: 'file',
      });

    expect(notFolderTypeWithoutDataRes.status).to.equal(400);
    expect(notFolderTypeWithoutDataRes.body).to.deep.equal({ error: 'Missing data' });

    const folderTypeRes = await chai.request(app)
      .post('/files')
      .set('x-token', token)
      .send({
        name: 'testFolder',
        type: 'folder',
      });

    expect(folderTypeRes.status).to.equal(201);
    expect(folderTypeRes.body).to.have.property('id');
    expect(folderTypeRes.body).to.have.property('userId');
    expect(folderTypeRes.body).to.have.property('name');
    expect(folderTypeRes.body).to.have.property('type');
    expect(folderTypeRes.body).to.have.property('isPublic');
    expect(folderTypeRes.body).to.have.property('parentId');

    const data = 'VGhpcyBpcyBhIHRlc3Qu';
    const fileTypeWithDataRes = await chai.request(app)
      .post('/files')
      .set('x-token', token)
      .send({
        name: 'testFile',
        type: 'file',
        parentId: 0,
        data,
      });

    expect(fileTypeWithDataRes.status).to.equal(201);
    expect(fileTypeWithDataRes.body).to.have.property('id');
    expect(fileTypeWithDataRes.body).to.have.property('userId');
    expect(fileTypeWithDataRes.body).to.have.property('name');
    expect(fileTypeWithDataRes.body).to.have.property('type');
    expect(fileTypeWithDataRes.body).to.have.property('isPublic');
    expect(fileTypeWithDataRes.body).to.have.property('parentId');

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';

    expect(fs.existsSync(folderPath)).to.be.true;

    const file = await dbClient.db.collection('files').findOne({ name: 'testFile' });

    expect(fs.existsSync(file.localPath)).to.be.true;

    const content = fs.readFileSync(file.localPath);

    expect(Buffer.from(content, 'base64').toString())
      .to.equal(Buffer.from(data, 'base64').toString());

    const imageTypeRes = await chai.request(app)
      .post('/files')
      .set('x-token', token)
      .send({
        name: 'testImage',
        type: 'image',
        parentId: 0,
        isPublic: 'true',
      });
  }); 

  it('GET /files/:id', async() => {
    const file = await dbClient.db.collection('files').findOne({ name: 'testFile' });

    const noTokenRes = await chai.request(app)
      .get(`/files/${file._id}`);

    expect(noTokenRes.status).to.equal(401);
    expect(noTokenRes.body).to.deep.equal({ error: 'Unauthorized' });

    const incorrectTokenRes = await chai.request(app)
      .get(`/files/${file._id}`)
      .set('x-token', 'fakeToken');

    expect(incorrectTokenRes.status).to.equal(401);
    expect(incorrectTokenRes.body).to.deep.equal({ error: 'Unauthorized' });

    const notFoundRes = await chai.request(app)
      .get(`/files/IAmAWrongId!`)
      .set('x-token', token);

    expect(notFoundRes.status).to.equal(404);
    expect(notFoundRes.body).to.deep.equal({ error: 'Not found' });

    const foundRes = await chai.request(app)
      .get(`/files/${file._id}`)
      .set('x-token', token);

    expect(foundRes.status).to.equal(200);
    expect(foundRes.body._id).to.equal(file._id.toString());
  });

  it('GET /files', async() => {
    const noTokenRes = await chai.request(app)
      .get('/files');

    expect(noTokenRes.status).to.equal(401);
    expect(noTokenRes.body).to.deep.equal({ error: 'Unauthorized' });

    const incorrectTokenRes = await chai.request(app)
      .get('/files')
      .set('x-token', 'fakeToken');

    expect(incorrectTokenRes.status).to.equal(401);
    expect(incorrectTokenRes.body).to.deep.equal({ error: 'Unauthorized' });

    const res = await chai.request(app)
      .get('/files?page=1')
      .set('x-token', token);

    expect(res.status).to.equal(200);
    expect(res.body).to.be.an('array');
    expect(res.body.length).to.be.lessThan(21);
  });

  it('PUT /files/:id/publish', async() => {
    const file = await dbClient.db.collection('files').findOne({ name: 'testFile' });

    const noTokenRes = await chai.request(app)
      .put(`/files/${file._id}/publish`);

    expect(noTokenRes.status).to.equal(401);
    expect(noTokenRes.body).to.deep.equal({ error: 'Unauthorized' });

    const incorrectTokenRes = await chai.request(app)
      .put(`/files/${file._id}/publish`)
      .set('x-token', 'fakeToken');

    expect(incorrectTokenRes.status).to.equal(401);
    expect(incorrectTokenRes.body).to.deep.equal({ error: 'Unauthorized' });

    const notFoundRes = await chai.request(app)
      .put(`/files/IAmAWrongId!/publish`)
      .set('x-token', token);

    expect(notFoundRes.status).to.equal(404);
    expect(notFoundRes.body).to.deep.equal({ error: 'Not found' });

    const res = await chai.request(app)
      .put(`/files/${file._id}/publish`)
      .set('x-token', token);

    expect(res.status).to.equal(200);
    expect(res.body.isPublic).to.be.true;
  });

  it('PUT /files/:id/unpublish', async() => {
    const file = await dbClient.db.collection('files').findOne({ name: 'testFile' });

    const noTokenRes = await chai.request(app)
      .put(`/files/${file._id}/unpublish`);

    expect(noTokenRes.status).to.equal(401);
    expect(noTokenRes.body).to.deep.equal({ error: 'Unauthorized' });

    const incorrectTokenRes = await chai.request(app)
      .put(`/files/${file._id}/unpublish`)
      .set('x-token', 'fakeToken');

    expect(incorrectTokenRes.status).to.equal(401);
    expect(incorrectTokenRes.body).to.deep.equal({ error: 'Unauthorized' });

    const notFoundRes = await chai.request(app)
      .put(`/files/IAmAWrongId!/unpublish`)
      .set('x-token', token);

    expect(notFoundRes.status).to.equal(404);
    expect(notFoundRes.body).to.deep.equal({ error: 'Not found' });

    const res = await chai.request(app)
      .put(`/files/${file._id}/unpublish`)
      .set('x-token', token);

    expect(res.status).to.equal(200);
    expect(res.body.isPublic).to.be.false;
  });

  it('GET /files/:id/data', async() => {
    const file = await dbClient.db.collection('files').findOne({ name: 'testFile' });
    const folder = await dbClient.db.collection('files').findOne({ name: 'testFolder' });

    const noFileFoundRes = await chai.request(app)
      .get(`/files/IAmAWrongId!/data`)
      .set('x-token', token);

    expect(noFileFoundRes.status).to.equal(404);
    expect(noFileFoundRes.body).to.deep.equal({ error: 'Not found' });

    const withoutTokenRes = await chai.request(app)
      .get(`/files/${file._id}/data`)

    expect(withoutTokenRes.status).to.equal(404);
    expect(withoutTokenRes.body).to.deep.equal({ error: 'Not found' });

    const incorrectTokenRes = await chai.request(app)
      .get(`/files/${file._id}/data`)
      .set('x-token', 'fakeToken');

    expect(incorrectTokenRes.status).to.equal(404);
    expect(incorrectTokenRes.body).to.deep.equal({ error: 'Not found' });

    const folderTypeRes = await chai.request(app)
      .get(`/files/${folder._id}/data`)
      .set('x-token', token);

    expect(folderTypeRes.status).to.equal(400);
    expect(folderTypeRes.body).to.deep.equal({ error: 'A folder doesn\'t have content' });

    const withTokenRes = await chai.request(app)
      .get(`/files/${file._id}/data`)
      .set('x-token', token);

    expect(withTokenRes.status).to.equal(200);
    expect(file.isPublic).to.be.false;
    expect(withTokenRes).to.have.header('content-Type');

    await chai.request(app)
      .put(`/files/${file._id}/publish`)
      .set('x-token', token);

    const isPublicTrueRes = await chai.request(app)
      .get(`/files/${file._id}/data`);
    const checkFile = await dbClient.db.collection('files').findOne({ name: 'testFile' });

    expect(isPublicTrueRes.status).to.equal(200);
    expect(checkFile.isPublic).to.be.true;
    expect(isPublicTrueRes).to.have.header('Content-Type');
  });

  it('GET /disconnect', async() => {
    const noTokenRes = await chai.request(app)
      .get('/disconnect');

    expect(noTokenRes.status).to.equal(401);
    expect(noTokenRes.body).to.deep.equal({ error: 'Unauthorized' });

    const incorrectTokenRes = await chai.request(app)
      .get('/disconnect')
      .set('x-token', 'fakeToken');

    expect(noTokenRes.status).to.equal(401);
    expect(noTokenRes.body).to.deep.equal({ error: 'Unauthorized' });
    
    const tokenRes = await chai.request(app)
      .get('/disconnect')
      .set('x-token', token);

    expect(tokenRes.status).to.equal(204);
    expect(tokenRes.body).to.deep.equal({});
  });
});
