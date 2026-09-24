import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createOrder, getOrder, listOrders } from './order.controller.js';
import { createOrderSchema, listOrdersSchema, orderIdSchema } from './order.schema.js';

const router = Router();

router.use(authenticate);
router.route('/')
  .post(validate(createOrderSchema), createOrder)
  .get(validate(listOrdersSchema), listOrders);
router.get('/:id', validate(orderIdSchema), getOrder);

export default router;
