# Inventory & Order API

## Overview

A small production-style REST API for user authentication, protected product management, and user-specific orders. Order totals are calculated on the server and stock changes are transactionally safe under concurrent requests.

## Tech stack

- Node.js 20+, Express 5, ES modules
- MongoDB 8 and Mongoose 9
- JWT authentication and bcrypt password hashing
- Zod request validation
- Helmet, CORS, and rate limiting
- Vitest, Supertest, and an in-memory MongoDB replica set for integration tests

## Features

- Registration and login with normalized unique emails and secure password hashes
- JWT-protected product CRUD (all product routes require authentication)
- Case-insensitive name search, category and stock filters, and bounded pagination
- User-specific order creation and retrieval
- Historical item prices, server-calculated subtotals/totals, and atomic stock updates
- Consistent validation/error responses and graceful startup/shutdown
- Importable Postman collection with automatically saved token and resource IDs

## Project structure

```text
src/
├── config/database.js
├── middleware/{auth,errorHandler,notFound,validate}.js
├── modules/
│   ├── auth/{auth.controller,auth.model,auth.routes,auth.schema}.js
│   ├── products/{product.controller,product.model,product.routes,product.schema}.js
│   └── orders/{order.controller,order.model,order.routes,order.schema}.js
├── utils/{ApiError,jwt}.js
├── app.js
└── server.js
tests/api.test.js
postman/inventory-order-api.postman_collection.json
```

## Installation and environment

```bash
git clone <repo-url>
cd inventory-order-api
npm install
```

Copy `.env.example` to `.env` and set:

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port, default `5000` |
| `MONGODB_URI` | MongoDB connection string; order transactions require a replica set |
| `JWT_SECRET` | Long, random signing secret; never commit it |
| `JWT_EXPIRES_IN` | JWT lifetime such as `7d` |
| `NODE_ENV` | `development`, `test`, or `production` |

For a local transaction-capable MongoDB instance, Docker is the simplest option:

```bash
docker compose up -d
npm run dev
```

The included Compose health check initializes a single-node replica set. MongoDB Atlas is also suitable. A standalone `mongod` without replica-set support cannot run multi-document transactions.

Run normally with `npm start`. Run the integration tests with `npm test`; tests start their own temporary replica set and do not use `.env` or the Docker database.

## API endpoints

All request and response bodies are JSON. Product management is intentionally protected consistently; send `Authorization: Bearer <JWT>` on every product and order request.

| Method | URL | Auth | Body/query | Response |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | No | — | Service status |
| POST | `/api/auth/register` | No | `{ name, email, password }` | Created user (never its password) |
| POST | `/api/auth/login` | No | `{ email, password }` | JWT and user |
| POST | `/api/products` | Yes | `{ name, description, price, stockQuantity, category }` | Created product |
| GET | `/api/products` | Yes | Query parameters below | Products and pagination metadata |
| GET | `/api/products/:id` | Yes | — | One product |
| PATCH | `/api/products/:id` | Yes | Any supplied product fields | Updated product |
| DELETE | `/api/products/:id` | Yes | — | `204 No Content` |
| POST | `/api/orders` | Yes | `{ "items": [{ "product": "<id>", "quantity": 2 }] }` | Created order |
| GET | `/api/orders` | Yes | `page`, `limit` | Logged-in user's orders |
| GET | `/api/orders/:id` | Yes | — | User's order, or 404 if absent/not owned |

### Product search, filters, and pagination

- `search`: case-insensitive partial product-name match
- `category`: normalized exact category match
- `inStock=true`: stock greater than zero; `inStock=false`: zero stock
- `page`: positive integer, default `1`
- `limit`: `1`–`100`, default `10`

Example: `GET /api/products?search=phone&category=electronics&inStock=true&page=1&limit=10`

## Order and concurrency logic

The API does not accept or trust client-provided totals; strict validation rejects them. During one MongoDB transaction, each product is conditionally decremented with `findOneAndUpdate({ _id, stockQuantity: { $gte: quantity } }, { $inc: { stockQuantity: -quantity } })`. The returned product price is copied into the order item, then subtotals and the total are computed server-side. If any product is absent or short on stock, an error aborts the transaction and every prior decrement rolls back. The conditional update prevents two concurrent buyers from both purchasing the last unit. Duplicate product IDs in one order are rejected so quantities remain unambiguous.

## Errors

Errors have one shape:

```json
{ "success": false, "message": "Product not found" }
```

Validation responses also contain `errors`, an array of `{ field, message }`. The API uses 400/401/404/409/422 as appropriate and hides internal error details in production.

## Postman

Import `postman/inventory-order-api.postman_collection.json`. Run **Register**, **Login**, **Create product**, and then the order requests in sequence. Login saves `token`; product and order creation save `productId` and `orderId`. The product deletion request is in **Cleanup (run last)** so a top-to-bottom collection run does not delete the product before order creation. The collection variable `baseUrl` defaults to `http://localhost:5000`.

## AI usage

Codex was used to create the project structure and implementation, review validation/error handling and concurrency logic, create API documentation, and run/fix the integration tests. The final concurrency behavior was tested against a MongoDB replica set.

## Future improvements

For a larger production system, add role-based product administration, idempotency keys for order submission, currency stored in integer minor units, structured logging, and deployment-focused observability.
