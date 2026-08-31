// Mirrors server/src/features/auth/schema.ts — keep the two in sync by hand
// (deliberately not shared/imported: client and server are separate
// deployables here). Used for live as-you-type feedback only; the server
// is still the source of truth and re-validates on submit.

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;

const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9_.]*[a-z0-9])?$/;

export function validateUsername(rawValue: string): string | null {
  const value = rawValue.trim().toLowerCase();
  if (value.length === 0) return null;

  if (value.length < USERNAME_MIN)
    return `Username must be at least ${USERNAME_MIN} characters`;
  if (value.length > USERNAME_MAX)
    return `Username must be at most ${USERNAME_MAX} characters`;
  if (!USERNAME_PATTERN.test(value))
    return "Username may contain letters, numbers, underscores and dots, and must start and end with a letter or number";
  if (/[._]{2}/.test(value))
    return "Username cannot contain consecutive separators";

  return null;
}

export function validatePassword(
  password: string,
  username = "",
): string | null {
  if (password.length === 0) return null;

  if (password.length < PASSWORD_MIN)
    return `Password must be at least ${PASSWORD_MIN} characters`;
  if (password.length > PASSWORD_MAX)
    return `Password must be at most ${PASSWORD_MAX} characters`;
  if (!/[a-z]/.test(password))
    return "Password must contain at least one lowercase letter";
  if (!/[A-Z]/.test(password))
    return "Password must contain at least one uppercase letter";
  if (!/[0-9]/.test(password))
    return "Password must contain at least one number";
  if (!/[^a-zA-Z0-9]/.test(password))
    return "Password must contain at least one special character";
  if (
    username.trim().length > 0 &&
    password.toLowerCase().includes(username.trim().toLowerCase())
  )
    return "Password cannot contain your username";

  return null;
}

export function validateConfirmPassword(
  password: string,
  confirmPassword: string,
): string | null {
  if (confirmPassword.length === 0) return null;
  if (password !== confirmPassword) return "Passwords do not match";
  return null;
}
