import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './modules/auth/auth.routes.js';
import productRoutes from './modules/products/product.routes.js';
import orderRoutes from './modules/orders/order.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '100kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts; try again later' },
});

// Root endpoint with API info and endpoint index
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'Inventory & Order REST API is running',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
      },
      products: {
        list: 'GET /api/products',
        getById: 'GET /api/products/:id',
        create: 'POST /api/products',
        update: 'PATCH /api/products/:id',
        delete: 'DELETE /api/products/:id',
      },
      orders: {
        list: 'GET /api/orders',
        getById: 'GET /api/orders/:id',
        create: 'POST /api/orders',
      },
    },
  });
});

const healthCheck = (_req, res) => {
  res.json({ success: true, message: 'API is running' });
};

app.get('/api/health', healthCheck);
app.get('/health', healthCheck);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
