# Inventory & Order API

## Overview

A production-ready REST API built with Node.js and Express for user authentication, protected product catalog management, and transactional order processing. Stock reductions are concurrency-safe under race conditions, and order totals are strictly computed on the server.

- **Live Deployed API**: `https://inventory-management-jhi5.onrender.com`
- **Health Check**: `https://inventory-management-jhi5.onrender.com/api/health`

## Tech Stack

- **Runtime & Framework**: Node.js (v20+), Express 5 (ES Modules)
- **Database**: MongoDB & Mongoose 9
- **Authentication**: JWT (JSON Web Tokens) with bcrypt password hashing
- **Validation**: Zod schema validation
- **Security**: Helmet, CORS, and Express Rate Limit
- **Testing**: Vitest, Supertest, and in-memory replica set integration testing

## Features

- **User Authentication**: Secure registration and login with bcrypt hashing and JWT tokens.
- **Product Management**: Full CRUD (`POST`, `GET`, `GET :id`, `PATCH`, `DELETE`) with validation.
- **Search, Filter & Pagination**: Case-insensitive name search, category filter, availability filter (`inStock=true`), and bounded pagination.
- **Transactional Orders**: Atomically reduces inventory stock within MongoDB transactions.
- **Dual Route Support**: Supports both `/api/*` and direct `/*` route prefixes (e.g., both `/api/products` and `/products`).
- **Postman Collection**: Pre-configured collection with automatic environment variable extraction.

---

## Technical Task Question: Handling Simultaneous Purchases

> **Question**: *Imagine two users try to buy the last available item at the same time. How would you make sure the stock does not become negative or both orders get confirmed?*

### Solution Implemented in this API:

1. **Atomic Conditional Updates at the Database Level**:
   Instead of performing a separate "check stock" followed by "update stock" (which causes a race condition), we use an **atomic conditional query**:
   ```javascript
   const product = await Product.findOneAndUpdate(
     {
       _id: requestedItem.product,
       stockQuantity: { $gte: requestedItem.quantity }, // Condition checked atomically
     },
     { $inc: { stockQuantity: -requestedItem.quantity } }, // Decrement applied only if condition met
     { returnDocument: 'after', session }
   );
   ```
   Because MongoDB operations on single documents are atomic, only **one** user's operation will succeed in decrementing from 1 to 0. The second simultaneous request will find `stockQuantity >= 1` to be false and return `null`.

2. **MongoDB ACID Transactions (`session.withTransaction`)**:
   The entire order creation is wrapped in a multi-document database transaction. If any product in an order fails the stock condition, an `ApiError(409, 'Insufficient stock')` is thrown, which automatically aborts the transaction and rolls back any previous stock decrements.

3. **HTTP 409 Conflict Response**:
   The winning user receives `201 Created` with their confirmed order. The losing user receives `409 Conflict` with a clear message: `"Insufficient stock for one or more products"`. The stock never becomes negative.

---

## AI Usage

In accordance with the task guidelines:

- **AI Tools Used**: Antigravity AI / Claude / Gemini
- **What they were used for**:
  - Drafting the modular architecture (`src/modules/{auth,products,orders}`)
  - Implementing the atomic decrement logic and MongoDB replica-set transaction sessions
  - Formulating strict Zod schemas with edge-case validation (e.g., rejecting client-supplied `totalAmount`, normalizing payload variants)
  - Generating integration tests in `tests/api.test.js` to simulate concurrent bursts of requests
  - Configuring and troubleshooting the cloud deployment on Render

---

## Project Structure

```text
src/
├── app.js                              # Express app setup, security middlewares, route mounting
├── server.js                           # Server entrypoint with graceful shutdown
├── config/
│   └── database.js                     # Mongoose connection logic
├── middleware/
│   ├── auth.js                         # JWT authentication & user injection
│   ├── errorHandler.js                 # Centralized error handler with standard response format
│   ├── notFound.js                     # 404 handler
│   └── validate.js                     # Zod request validation middleware
├── modules/
│   ├── auth/                           # Authentication module (controller, model, routes, schema)
│   ├── products/                       # Products module (controller, model, routes, schema)
│   └── orders/                         # Orders module (controller, model, routes, schema)
└── utils/
    ├── ApiError.js                     # Standard custom error class
    └── jwt.js                          # Token generation & verification helpers
tests/
└── api.test.js                         # Integration test suite (auth, products, orders, concurrency)
postman/
└── inventory-order-api.postman_collection.json  # Exported Postman collection
```

---

## Installation and Local Setup

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Priyanshu69-web/Inventory-Management.git
cd Inventory-Management
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `5000` | HTTP port for the API server |
| `MONGODB_URI` | `mongodb://...` | MongoDB connection string (requires replica set for transactions) |
| `JWT_SECRET` | — | Secret string for signing JWT tokens |
| `JWT_EXPIRES_IN`| `7d` | Token lifetime |
| `NODE_ENV` | `development` | Environment mode (`development`, `production`, `test`) |

### 3. Run MongoDB (with Replica Set for Transactions)
Using Docker Compose:
```bash
docker compose up -d
```
*Or connect to a free MongoDB Atlas cluster.*

### 4. Start the Server
```bash
# Development mode with nodemon
npm run dev

# Production mode
npm start
```

### 5. Run Integration Tests
```bash
npm test
```

---

## API Endpoints Reference

All requests and responses use JSON. Routes are available with or without the `/api` prefix.

| Method | Endpoint | Auth Required | Description |
| :--- | :--- | :---: | :--- |
| `GET` | `/` | No | API Status & Interactive Documentation |
| `GET` | `/api/health` | No | Health check |
| `POST` | `/api/auth/register` | No | Register new user account |
| `POST` | `/api/auth/login` | No | Login and obtain JWT token |
| `POST` | `/api/products` | Yes | Create a new product |
| `GET` | `/api/products` | Yes | List products (with search, filter, pagination) |
| `GET` | `/api/products/:id` | Yes | Get a single product by ID |
| `PATCH`| `/api/products/:id` | Yes | Update product details |
| `DELETE`| `/api/products/:id` | Yes | Delete a product |
| `POST` | `/api/orders` | Yes | Create an order (atomically reduces stock) |
| `GET` | `/api/orders` | Yes | Get logged-in user's orders |
| `GET` | `/api/orders/:id` | Yes | Get specific order by ID |

### Product Search, Filter & Pagination Parameters
- `search`: Case-insensitive partial name match (`?search=iphone`)
- `category`: Filter by product category (`?category=electronics`)
- `inStock`: Filter by availability (`?inStock=true` or `?inStock=false`)
- `page`: Page number (default: `1`)
- `limit`: Items per page (default: `10`, max: `100`)

Example:
```text
GET /api/products?category=electronics&inStock=true&page=1&limit=10
```

---

## Postman Collection

An importable Postman collection is included in [postman/inventory-order-api.postman_collection.json](postman/inventory-order-api.postman_collection.json).

1. Import the collection into Postman.
2. Set the `baseUrl` variable to `http://localhost:5000` (or `https://inventory-management-jhi5.onrender.com`).
3. Run **Register** and **Login**. The login test script automatically saves the `token`.
4. Subsequent requests in the collection automatically authenticate and pass resource IDs.
