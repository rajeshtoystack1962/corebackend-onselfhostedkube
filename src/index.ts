import express from 'express';
import { config } from './config/index.js';
import routes from './routes/index.js';

const app = express();

app.use(express.json());

app.use('/api', routes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
});
