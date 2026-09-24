import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcrypt';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './modules/auth/auth.routes.js';
import productRoutes from './modules/products/product.routes.js';
import orderRoutes from './modules/orders/order.routes.js';
import User from './modules/auth/auth.model.js';
import Product from './modules/products/product.model.js';
import { signToken } from './utils/jwt.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.static(publicDir));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts; try again later' },
});

// Seed endpoint to create demo user and demo inventory for quick evaluation
const seedHandler = async (_req, res, next) => {
  try {
    let user = await User.findOne({ email: 'demo@example.com' });
    if (!user) {
      user = await User.create({
        name: 'Demo Evaluator',
        email: 'demo@example.com',
        password: await bcrypt.hash('password123', 10),
      });
    }

    const count = await Product.countDocuments();
    if (count === 0) {
      await Product.create([
        {
          name: 'MacBook Pro 16" M3 Max',
          description: 'Apple Silicon with 36GB unified memory, 1TB SSD, Liquid Retina XDR display',
          price: 2499.00,
          stockQuantity: 6,
          category: 'electronics',
        },
        {
          name: 'iPhone 16 Pro 256GB',
          description: 'Grade 5 Titanium design with A18 Pro chip, 48MP Fusion camera system',
          price: 999.00,
          stockQuantity: 12,
          category: 'electronics',
        },
        {
          name: 'Sony WH-1000XM5 Headphones',
          description: 'Industry-leading noise canceling wireless headphones with 30-hour battery life',
          price: 349.99,
          stockQuantity: 8,
          category: 'audio',
        },
        {
          name: 'Keychron Q1 Pro Mechanical Keyboard',
          description: 'QMK/VIA wireless custom mechanical keyboard with hot-swappable switches',
          price: 199.50,
          stockQuantity: 15,
          category: 'accessories',
        },
        {
          name: 'Logitech MX Master 3S Mouse',
          description: 'Quiet-click ergonomic wireless performance mouse with 8K DPI sensor',
          price: 99.99,
          stockQuantity: 0,
          category: 'accessories',
        },
      ]);
    }

    const token = signToken(user.id);
    res.json({
      success: true,
      message: 'Demo environment initialized successfully',
      data: {
        token,
        user: { id: user.id, name: user.name, email: user.email },
      },
    });
  } catch (err) {
    next(err);
  }
};

app.post('/api/seed', seedHandler);
app.post('/seed', seedHandler);

// Root endpoint: Serves the interactive SPA dashboard for browsers, and JSON for API clients
app.get('/', (req, res) => {
  const apiData = {
    success: true,
    message: 'Inventory & Order REST API is running',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      seed: 'POST /api/seed',
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
  };

  if (req.accepts(['json', 'html']) === 'html') {
    return res.sendFile(path.join(publicDir, 'index.html'));
  }

  res.json(apiData);
});

const healthCheck = (_req, res) => {
  res.json({ success: true, message: 'API is running' });
};

app.get('/api/health', healthCheck);
app.get('/health', healthCheck);

// Mount routes on both /api/* and /* to support all client conventions
app.use('/api/auth', authLimiter, authRoutes);
app.use('/auth', authLimiter, authRoutes);

app.use('/api/products', productRoutes);
app.use('/products', productRoutes);

app.use('/api/orders', orderRoutes);
app.use('/orders', orderRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
