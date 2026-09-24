import Product from './product.model.js';
import { ApiError } from '../../utils/ApiError.js';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function createProduct(req, res) {
  const product = await Product.create(req.validated.body);
  res.status(201).json({ success: true, data: product });
}

export async function listProducts(req, res) {
  const { search, category, inStock, page, limit } = req.validated.query;
  const filter = {};

  if (search) filter.name = { $regex: escapeRegex(search), $options: 'i' };
  if (category) filter.category = category;
  if (inStock === 'true') filter.stockQuantity = { $gt: 0 };
  if (inStock === 'false') filter.stockQuantity = 0;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: products,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function getProduct(req, res) {
  const product = await Product.findById(req.validated.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({ success: true, data: product });
}

export async function updateProduct(req, res) {
  const product = await Product.findByIdAndUpdate(
    req.validated.params.id,
    req.validated.body,
    { returnDocument: 'after', runValidators: true },
  );
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({ success: true, data: product });
}

export async function deleteProduct(req, res) {
  const product = await Product.findByIdAndDelete(req.validated.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  res.status(204).send();
}
