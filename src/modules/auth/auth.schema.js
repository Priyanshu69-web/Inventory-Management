import { z } from 'zod';

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const password = z.string().min(8).max(72);

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(100),
    email,
    password,
  }).strict(),
  params: z.object({}),
  query: z.object({}),
});

export const loginSchema = z.object({
  body: z.object({ email, password }).strict(),
  params: z.object({}),
  query: z.object({}),
});
