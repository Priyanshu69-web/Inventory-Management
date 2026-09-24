import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ID');

const normalizeOrderInput = (data) => {
  if (data && typeof data === 'object') {
    const copy = { ...data };
    // If client supplied single product directly at root level
    if (!copy.items && (copy.product || copy.productId)) {
      copy.items = [
        {
          product: copy.product || copy.productId,
          quantity: copy.quantity,
        },
      ];
      delete copy.product;
      delete copy.productId;
      delete copy.quantity;
    } else if (Array.isArray(copy.items)) {
      copy.items = copy.items.map((item) => {
        if (item && typeof item === 'object' && !item.product && item.productId) {
          const { productId, ...rest } = item;
          return { product: productId, ...rest };
        }
        return item;
      });
    }
    return copy;
  }
  return data;
};

export const createOrderSchema = z.object({
  body: z.preprocess(
    normalizeOrderInput,
    z.object({
      items: z.array(
        z.object({
          product: objectId,
          quantity: z.number().int().positive(),
        }).strict(),
      ).min(1).max(100).superRefine((items, context) => {
        const seen = new Set();
        items.forEach((item, index) => {
          if (seen.has(item.product)) {
            context.addIssue({
              code: 'custom',
              path: [index, 'product'],
              message: 'Duplicate products are not allowed; combine their quantities',
            });
          }
          seen.add(item.product);
        });
      }),
    }).strict(),
  ),
  params: z.object({}),
  query: z.object({}),
});

export const orderIdSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({ id: objectId }),
  query: z.object({}),
});

export const listOrdersSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),
  }),
});
