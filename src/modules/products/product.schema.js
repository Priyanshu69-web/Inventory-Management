import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ID');
const productFields = {
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().min(1).max(2000),
  price: z.number().finite().nonnegative(),
  stockQuantity: z.number().int().nonnegative(),
  category: z.string().trim().min(1).max(100).transform((value) => value.toLowerCase()),
};

export const createProductSchema = z.object({
  body: z.object(productFields).strict(),
  params: z.object({}),
  query: z.object({}),
});

export const updateProductSchema = z.object({
  body: z.object(productFields).partial().strict().refine(
    (body) => Object.keys(body).length > 0,
    'At least one product field is required',
  ),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

export const productIdSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

export const listProductsSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}),
  query: z.object({
    search: z.string().trim().min(1).max(150).optional(),
    category: z.string().trim().min(1).max(100).transform((value) => value.toLowerCase()).optional(),
    inStock: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
  }),
});
