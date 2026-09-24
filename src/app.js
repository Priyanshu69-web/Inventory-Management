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

// Root endpoint: returns an interactive UI dashboard for browser visits and JSON for API clients
app.get('/', (req, res) => {
  const apiData = {
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
  };

  if (req.accepts('html')) {
    return res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inventory & Order Management API</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(22, 30, 49, 0.7);
      --card-border: rgba(255, 255, 255, 0.08);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --accent: #6366f1;
      --accent-glow: rgba(99, 102, 241, 0.25);
      --success: #10b981;
      --success-glow: rgba(16, 185, 129, 0.2);
      --code-bg: #0f172a;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.12) 0px, transparent 50%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
    }
    .container {
      max-width: 900px;
      width: 100%;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-radius: 9999px;
      background: var(--success-glow);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--success);
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 10px var(--success);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.9); }
    }
    h1 {
      font-size: 2.4rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #fff 40%, #94a3b8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.lead {
      color: var(--text-muted);
      font-size: 1.05rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-top: 24px;
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(12px);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 24px;
      transition: transform 0.2s, border-color 0.2s;
    }
    .card:hover {
      transform: translateY(-2px);
      border-color: rgba(99, 102, 241, 0.4);
    }
    .card-title {
      font-size: 1.15rem;
      font-weight: 600;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .endpoint {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      background: var(--code-bg);
      border-radius: 8px;
      margin-bottom: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
    }
    .method {
      font-weight: 700;
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .method.get { background: rgba(59, 130, 246, 0.2); color: #60a5fa; }
    .method.post { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .method.patch { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }
    .method.delete { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .path { color: #cbd5e1; word-break: break-all; }
    .links {
      margin-top: 36px;
      text-align: center;
      display: flex;
      justify-content: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 10px;
      font-weight: 600;
      text-decoration: none;
      font-size: 0.95rem;
      transition: all 0.2s;
    }
    .btn-primary {
      background: var(--accent);
      color: #fff;
      box-shadow: 0 4px 14px var(--accent-glow);
    }
    .btn-primary:hover {
      background: #4f46e5;
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text-main);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">
        <span class="dot"></span>
        API Operational & Live
      </div>
      <h1>Inventory & Order REST API</h1>
      <p class="lead">Concurrency-safe e-commerce inventory and order management system</p>
    </div>

    <div class="grid">
      <div class="card">
        <div class="card-title">🔐 Authentication</div>
        <div class="endpoint"><span class="method post">POST</span><span class="path">/api/auth/register</span></div>
        <div class="endpoint"><span class="method post">POST</span><span class="path">/api/auth/login</span></div>
      </div>

      <div class="card">
        <div class="card-title">📦 Products & Stock</div>
        <div class="endpoint"><span class="method get">GET</span><span class="path">/api/products</span></div>
        <div class="endpoint"><span class="method get">GET</span><span class="path">/api/products/:id</span></div>
        <div class="endpoint"><span class="method post">POST</span><span class="path">/api/products</span></div>
        <div class="endpoint"><span class="method patch">PATCH</span><span class="path">/api/products/:id</span></div>
        <div class="endpoint"><span class="method delete">DELETE</span><span class="path">/api/products/:id</span></div>
      </div>

      <div class="card">
        <div class="card-title">🛒 Orders & Transactions</div>
        <div class="endpoint"><span class="method get">GET</span><span class="path">/api/orders</span></div>
        <div class="endpoint"><span class="method get">GET</span><span class="path">/api/orders/:id</span></div>
        <div class="endpoint"><span class="method post">POST</span><span class="path">/api/orders</span></div>
      </div>
    </div>

    <div class="links">
      <a href="/api/health" class="btn btn-primary">Check Health Status</a>
    </div>
  </div>
</body>
</html>`);
  }

  res.json(apiData);
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
