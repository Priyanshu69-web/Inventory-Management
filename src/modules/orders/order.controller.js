import mongoose from 'mongoose';
import Order from './order.model.js';
import Product from '../products/product.model.js';
import { ApiError } from '../../utils/ApiError.js';

export async function createOrder(req, res) {
  const session = await mongoose.startSession();
  let createdOrder;

  try {
    await session.withTransaction(async () => {
      const orderItems = [];

      for (const requestedItem of req.validated.body.items) {
        const product = await Product.findOneAndUpdate(
          {
            _id: requestedItem.product,
            stockQuantity: { $gte: requestedItem.quantity },
          },
          { $inc: { stockQuantity: -requestedItem.quantity } },
          { returnDocument: 'after', session, runValidators: true },
        );

        if (!product) {
          const exists = await Product.exists({ _id: requestedItem.product }).session(session);
          throw new ApiError(
            exists ? 409 : 404,
            exists ? 'Insufficient stock for one or more products' : 'Product not found',
          );
        }

        const subtotal = product.price * requestedItem.quantity;
        orderItems.push({
          product: product._id,
          quantity: requestedItem.quantity,
          price: product.price,
          subtotal,
        });
      }

      const totalAmount = orderItems.reduce((total, item) => total + item.subtotal, 0);
      [createdOrder] = await Order.create(
        [{ user: req.user._id, items: orderItems, totalAmount }],
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  res.status(201).json({ success: true, data: createdOrder });
}

export async function listOrders(req, res) {
  const { page, limit } = req.validated.query;
  const filter = { user: req.user._id };
  const [orders, total] = await Promise.all([
    Order.find(filter)
      .populate('items.product', 'name category')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: orders,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function getOrder(req, res) {
  const order = await Order.findOne({
    _id: req.validated.params.id,
    user: req.user._id,
  }).populate('items.product', 'name category');

  if (!order) throw new ApiError(404, 'Order not found');
  res.json({ success: true, data: order });
}
