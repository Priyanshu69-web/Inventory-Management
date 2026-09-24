import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ID');

export const createOrderSchema = z.object({
  body: z.object({
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
