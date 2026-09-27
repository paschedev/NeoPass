import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';

// Header de sesión para un usuario: mismo payload que AuthService.login,
// firmado con el JwtService de la app.
export function authHeader(
  app: INestApplication,
  user: Pick<User, 'id' | 'email' | 'role'>,
) {
  const token = app
    .get(JwtService)
    .sign({ email: user.email, sub: user.id, role: user.role });
  return `Bearer ${token}`;
}
