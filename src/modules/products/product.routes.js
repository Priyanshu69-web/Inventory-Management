import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from './product.controller.js';
import {
  createProductSchema,
  listProductsSchema,
  productIdSchema,
  updateProductSchema,
} from './product.schema.js';

const router = Router();

router.use(authenticate);
router.route('/')
  .post(validate(createProductSchema), createProduct)
  .get(validate(listProductsSchema), listProducts);
router.route('/:id')
  .get(validate(productIdSchema), getProduct)
  .patch(validate(updateProductSchema), updateProduct)
  .delete(validate(productIdSchema), deleteProduct);

export default router;
