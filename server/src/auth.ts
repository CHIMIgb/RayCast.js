import { hash, compare } from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from './env';

// Auth JWT casero (F0.5): sin OAuth ni librerías de auth completas.
// bcryptjs para el hash de contraseñas y jsonwebtoken para firmar/verificar.

export interface TokenPayload {
  sub: string;
  username: string;
}

export const hashPassword = (plain: string): Promise<string> => hash(plain, 10);

export const verifyPassword = (plain: string, hashed: string): Promise<boolean> =>
  compare(plain, hashed);

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (typeof decoded === 'object' && decoded !== null && typeof decoded.sub === 'string') {
      return decoded as TokenPayload;
    }
    return null;
  } catch {
    return null;
  }
}