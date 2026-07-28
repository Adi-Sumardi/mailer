import * as jwt from 'jsonwebtoken';
import { JwtPayload } from '../src/auth/jwt-payload.interface';

export function signTestToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: '1h' });
}
