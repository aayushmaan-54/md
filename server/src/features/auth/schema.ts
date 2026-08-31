import { z } from "zod";

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;

// Username Schema
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(USERNAME_MIN, `Username must be at least ${USERNAME_MIN} characters`)
  .max(USERNAME_MAX, `Username must be at most ${USERNAME_MAX} characters`)
  .regex(
    /^[a-z0-9](?:[a-z0-9_.]*[a-z0-9])?$/,
    "Username may contain letters, numbers, underscores and dots, and must start and end with a letter or number",
  )
  .refine(
    (value) => !/[._]{2}/.test(value),
    "Username cannot contain consecutive separators",
  );

export const loginUsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Username is required")
  .max(USERNAME_MAX, "Username is too long");

// Password Schema
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`)
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(
    /[^a-zA-Z0-9]/,
    "Password must contain at least one special character",
  );

export const loginPasswordSchema = z
  .string()
  .min(1, "Password is required")
  .max(PASSWORD_MAX, "Password is too long");

// Auth Schema
export const signupSchema = z
  .object({
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z
      .string()
      .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((data) => !data.password.toLowerCase().includes(data.username), {
    path: ["password"],
    message: "Password cannot contain your username",
  })
  // Drop confirmPassword from the output
  .transform(({ username, password }) => ({ username, password }));

export const loginSchema = z.object({
  username: loginUsernameSchema,
  password: loginPasswordSchema,
});

export type SignupData = z.infer<typeof signupSchema>;
export type LoginData = z.infer<typeof loginSchema>;
