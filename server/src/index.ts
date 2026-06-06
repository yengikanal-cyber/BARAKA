import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';

import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
import productsRoutes from './routes/products';
import uploadsRoutes from './routes/uploads';
import connectionsRoutes from './routes/connections';
import chatRoutes from './routes/chat';
import transactionsRoutes from './routes/transactions';
import statsRoutes from './routes/stats';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  }),
);
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());

app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, version: '0.1.0' }));

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/stats', statsRoutes);

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

app.listen(PORT, () => {
  console.log(`[baraka] api on http://localhost:${PORT}`);
});
