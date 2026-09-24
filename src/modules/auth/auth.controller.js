import bcrypt from 'bcrypt';
import User from './auth.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { signToken } from '../../utils/jwt.js';

export async function register(req, res) {
  const { name, email, password } = req.validated.body;

  if (await User.exists({ email })) {
    throw new ApiError(409, 'Email is already registered');
  }

  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 12),
  });

  res.status(201).json({ success: true, data: user });
}

export async function login(req, res) {
  const { email, password } = req.validated.body;
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new ApiError(401, 'Invalid email or password');
  }

  res.json({
    success: true,
    data: {
      token: signToken(user.id),
      user: { id: user.id, name: user.name, email: user.email },
    },
  });
}
