import { Router } from 'express';
import { login, register } from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schema.js';
import { validate } from '../../middleware/validate.js';

const router = Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);

export default router;
