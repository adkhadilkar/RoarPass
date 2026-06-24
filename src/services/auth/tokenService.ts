import jwt from 'jsonwebtoken';

export interface TokenClaims {
  sub: string;
  locale?: string;
  [key: string]: any;
}

export async function verifyAccessToken(token: string): Promise<TokenClaims> {
  return new Promise((resolve, reject) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return reject(new Error('JWT_SECRET not configured'));
    }

    try {
      const decoded = jwt.verify(token, secret) as TokenClaims;
      resolve(decoded);
    } catch (err) {
      reject(err);
    }
  });
}
