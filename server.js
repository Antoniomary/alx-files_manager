import express from 'express';
import routes from './routes/index';

const PORT = process.env.PORT || 5000;

const app = express();

app.use(express.json({ limit: '10mb' }));

app.use('/', routes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
