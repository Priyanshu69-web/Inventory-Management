import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import app from '../src/app.js';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import User from '../src/modules/auth/auth.model.js';
import Product from '../src/modules/products/product.model.js';
import Order from '../src/modules/orders/order.model.js';

let replicaSet;

async function registerAndLogin(email = 'user@example.com') {
  await request(app).post('/api/auth/register').send({
    name: 'Test User',
    email,
    password: 'password123',
  });
  const response = await request(app).post('/api/auth/login').send({
    email,
    password: 'password123',
  });
  return response.body.data.token;
}

async function createProduct(token, overrides = {}) {
  return request(app)
    .post('/api/products')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'iPhone 17',
      description: 'A test phone',
      price: 999.5,
      stockQuantity: 5,
      category: 'Electronics',
      ...overrides,
    });
}

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-with-enough-entropy';
  process.env.NODE_ENV = 'test';
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDatabase(replicaSet.getUri());
}, 120_000);

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Product.deleteMany({}), Order.deleteMany({})]);
});

it('reports API health', async () => {
  const response = await request(app).get('/api/health');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ success: true, message: 'API is running' });

  const healthAlias = await request(app).get('/health');
  expect(healthAlias.status).toBe(200);
  expect(healthAlias.body).toEqual({ success: true, message: 'API is running' });
});

it('returns API overview on root GET /', async () => {
  const response = await request(app).get('/');
  expect(response.status).toBe(200);
  expect(response.body.success).toBe(true);
  expect(response.body.message).toBe('Inventory & Order REST API is running');
  expect(response.body.endpoints).toBeDefined();
});

afterAll(async () => {
  await disconnectDatabase();
  await replicaSet?.stop();
});

describe('authentication', () => {
  it('registers, hashes the password, logs in, and rejects duplicates', async () => {
    const registration = await request(app).post('/api/auth/register').send({
      name: 'Ada Lovelace',
      email: 'ADA@example.com',
      password: 'password123',
    });
    expect(registration.status).toBe(201);
    expect(registration.body.data.password).toBeUndefined();

    const storedUser = await User.findOne({ email: 'ada@example.com' }).select('+password');
    expect(storedUser.password).not.toBe('password123');

    const login = await request(app).post('/api/auth/login').send({
      email: 'ada@example.com',
      password: 'password123',
    });
    expect(login.status).toBe(200);
    expect(login.body.data.token).toBeTypeOf('string');

    const duplicate = await request(app).post('/api/auth/register').send({
      name: 'Another Ada',
      email: 'ada@example.com',
      password: 'password123',
    });
    expect(duplicate.status).toBe(409);
  });

  it('rejects missing and invalid JWTs', async () => {
    expect((await request(app).get('/api/products')).status).toBe(401);
    expect((await request(app).get('/api/products').set('Authorization', 'Bearer bad-token')).status).toBe(401);

    const expiredToken = jwt.sign(
      { sub: '507f1f77bcf86cd799439011' },
      process.env.JWT_SECRET,
      { expiresIn: -1 },
    );
    const expired = await request(app)
      .get('/api/products')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(expired.status).toBe(401);
    expect(expired.body.message).toBe('Token has expired');
  });

  it('rejects invalid registration, invalid credentials, and malformed JSON', async () => {
    const invalidRegistration = await request(app).post('/api/auth/register').send({
      name: '',
      email: 'not-an-email',
      password: 'short',
    });
    expect(invalidRegistration.status).toBe(422);
    expect(invalidRegistration.body.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'name' }),
      expect.objectContaining({ field: 'email' }),
      expect.objectContaining({ field: 'password' }),
    ]));

    const invalidLogin = await request(app).post('/api/auth/login').send({
      email: 'nobody@example.com',
      password: 'password123',
    });
    expect(invalidLogin.status).toBe(401);

    const malformed = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"name":');
    expect(malformed.status).toBe(400);
    expect(malformed.body.success).toBe(false);
  });
});

describe('products', () => {
  it('supports CRUD, validation, search, filters, and pagination', async () => {
    const token = await registerAndLogin();
    const created = await createProduct(token);
    expect(created.status).toBe(201);
    const id = created.body.data._id;

    await createProduct(token, {
      name: 'Desk', category: 'Furniture', stockQuantity: 0, price: 200,
    });

    const filtered = await request(app)
      .get('/api/products?search=iphone&category=electronics&inStock=true&page=1&limit=1')
      .set('Authorization', `Bearer ${token}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.pagination).toMatchObject({ page: 1, limit: 1, total: 1, totalPages: 1 });

    const outOfStock = await request(app)
      .get('/api/products?inStock=false')
      .set('Authorization', `Bearer ${token}`);
    expect(outOfStock.body.data).toHaveLength(1);
    expect(outOfStock.body.data[0].name).toBe('Desk');

    const fetched = await request(app)
      .get(`/api/products/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data._id).toBe(id);

    const updated = await request(app)
      .patch(`/api/products/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ price: 899, stockQuantity: 3 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.price).toBe(899);

    expect((await request(app)
      .get('/api/products/not-an-id')
      .set('Authorization', `Bearer ${token}`)).status).toBe(422);

    expect((await createProduct(token, { price: -1 })).status).toBe(422);

    const deleted = await request(app)
      .delete(`/api/products/${id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(204);
    expect((await request(app)
      .get(`/api/products/${id}`)
      .set('Authorization', `Bearer ${token}`)).status).toBe(404);
  });

  it('enforces update validation, ID validation, and pagination boundaries', async () => {
    const token = await registerAndLogin();
    const authorization = { Authorization: `Bearer ${token}` };
    const product = await createProduct(token);
    const id = product.body.data._id;

    expect((await request(app).patch(`/api/products/${id}`).set(authorization).send({})).status).toBe(422);
    expect((await request(app).patch(`/api/products/${id}`).set(authorization).send({ stockQuantity: 1.5 })).status).toBe(422);
    expect((await request(app).delete('/api/products/invalid-id').set(authorization)).status).toBe(422);
    expect((await request(app).get('/api/products?page=0').set(authorization)).status).toBe(422);
    expect((await request(app).get('/api/products?limit=101').set(authorization)).status).toBe(422);

    const beyondLastPage = await request(app)
      .get('/api/products?page=2&limit=1')
      .set(authorization);
    expect(beyondLastPage.status).toBe(200);
    expect(beyondLastPage.body.data).toHaveLength(0);
    expect(beyondLastPage.body.pagination).toMatchObject({ page: 2, limit: 1, total: 1, totalPages: 1 });
  });
});

describe('orders', () => {
  it('calculates totals, stores prices, reduces stock, and scopes orders to their user', async () => {
    const token = await registerAndLogin();
    const secondToken = await registerAndLogin('second@example.com');
    const product = await createProduct(token, { price: 12.5, stockQuantity: 5 });
    const productId = product.body.data._id;

    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ product: productId, quantity: 2 }] });
    expect(created.status).toBe(201);
    expect(created.body.data.totalAmount).toBe(25);
    expect(created.body.data.items[0]).toMatchObject({ price: 12.5, subtotal: 25, quantity: 2 });
    expect((await Product.findById(productId)).stockQuantity).toBe(3);

    const orderList = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);
    expect(orderList.status).toBe(200);
    expect(orderList.body.data).toHaveLength(1);

    const ownOrder = await request(app)
      .get(`/api/orders/${created.body.data._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(ownOrder.status).toBe(200);

    const otherUsersView = await request(app)
      .get(`/api/orders/${created.body.data._id}`)
      .set('Authorization', `Bearer ${secondToken}`);
    expect(otherUsersView.status).toBe(404);

    const otherUsersList = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${secondToken}`);
    expect(otherUsersList.body.data).toHaveLength(0);
  });

  it('rejects missing products and insufficient stock without changing stock', async () => {
    const token = await registerAndLogin();
    const product = await createProduct(token, { stockQuantity: 1 });
    const secondProduct = await createProduct(token, {
      name: 'Tablet', stockQuantity: 1,
    });
    const productId = product.body.data._id;

    const insufficient = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { product: productId, quantity: 1 },
          { product: secondProduct.body.data._id, quantity: 2 },
        ],
      });
    expect(insufficient.status).toBe(409);
    expect((await Product.findById(productId)).stockQuantity).toBe(1);
    expect((await Product.findById(secondProduct.body.data._id)).stockQuantity).toBe(1);

    const missing = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ product: '507f1f77bcf86cd799439011', quantity: 1 }] });
    expect(missing.status).toBe(404);
    expect(await Order.countDocuments()).toBe(0);
  });

  it('creates multiple items, rejects invalid items, and preserves historical prices', async () => {
    const token = await registerAndLogin();
    const authorization = { Authorization: `Bearer ${token}` };
    const first = await createProduct(token, { name: 'Keyboard', price: 40, stockQuantity: 4 });
    const second = await createProduct(token, { name: 'Mouse', price: 15.5, stockQuantity: 4 });
    const firstId = first.body.data._id;
    const secondId = second.body.data._id;

    const created = await request(app)
      .post('/api/orders')
      .set(authorization)
      .send({ items: [
        { product: firstId, quantity: 2 },
        { product: secondId, quantity: 3 },
      ] });
    expect(created.status).toBe(201);
    expect(created.body.data.totalAmount).toBe(126.5);
    expect(created.body.data.items).toEqual([
      expect.objectContaining({ product: firstId, price: 40, quantity: 2, subtotal: 80 }),
      expect.objectContaining({ product: secondId, price: 15.5, quantity: 3, subtotal: 46.5 }),
    ]);

    await request(app).patch(`/api/products/${firstId}`).set(authorization).send({ price: 99 });
    const fetched = await request(app)
      .get(`/api/orders/${created.body.data._id}`)
      .set(authorization);
    expect(fetched.body.data.items[0].price).toBe(40);
    expect(fetched.body.data.totalAmount).toBe(126.5);

    const invalidQuantity = await request(app)
      .post('/api/orders')
      .set(authorization)
      .send({ items: [{ product: firstId, quantity: 0 }] });
    expect(invalidQuantity.status).toBe(422);

    const duplicateItem = await request(app)
      .post('/api/orders')
      .set(authorization)
      .send({ items: [{ product: firstId, quantity: 1 }, { product: firstId, quantity: 1 }] });
    expect(duplicateItem.status).toBe(422);

    const clientTotal = await request(app)
      .post('/api/orders')
      .set(authorization)
      .send({ items: [{ product: firstId, quantity: 1 }], totalAmount: 0 });
    expect(clientTotal.status).toBe(422);
    expect((await request(app).get('/api/orders/invalid-id').set(authorization)).status).toBe(422);
  });

  it('allows only one concurrent purchase of the last item', async () => {
    const token = await registerAndLogin();
    const product = await createProduct(token, { stockQuantity: 1 });
    const productId = product.body.data._id;
    const placeOrder = () => request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ product: productId, quantity: 1 }] });

    const responses = await Promise.all([placeOrder(), placeOrder()]);
    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect((await Product.findById(productId)).stockQuantity).toBe(0);
    expect(await Order.countDocuments()).toBe(1);
  });

  it('never oversells under a burst of concurrent requests', async () => {
    const token = await registerAndLogin();
    const product = await createProduct(token, { stockQuantity: 3 });
    const productId = product.body.data._id;
    const placeOrder = () => request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ product: productId, quantity: 1 }] });

    const responses = await Promise.all(Array.from({ length: 10 }, placeOrder));
    const statuses = responses.map(({ status }) => status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(3);
    expect(statuses.filter((status) => status === 409)).toHaveLength(7);
    expect(statuses.every((status) => status === 201 || status === 409)).toBe(true);
    expect((await Product.findById(productId)).stockQuantity).toBe(0);
    expect(await Order.countDocuments()).toBe(3);
  });
});
