import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import { maskEmail } from '../../common/mask-email';

@Injectable()
export class UserRepository {
  constructor(private prisma: PrismaService) {}

  // The account the email reaches however it is typed: the database applies
  // the rule (see `emailKey` in the schema).
  async findByEmail(email: string): Promise<User | null> {
    const [{ key }] = await this.prisma.$queryRaw<{ key: string }[]>`
      SELECT email_key(${email}) AS key`;
    return this.prisma.user.findUnique({ where: { emailKey: key } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByResetToken(token: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    });
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async search(query: string, excludeUserId?: string) {
    if (!query || query.length < 3) {
      return [];
    }

    const whereClause: Prisma.UserWhereInput = {
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (excludeUserId) {
      whereClause.id = { not: excludeUserId };
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      select: { id: true, name: true, email: true },
      take: 10,
    });

    return users.map((user) => ({ ...user, email: maskEmail(user.email) }));
  }

  // The reset link proved the mailbox: the new password, the email confirmed
  // and any pending email code cancelled, together. Closes the open sessions.
  async completePasswordReset(id: string, passwordHash: string, now: Date) {
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null,
          passwordChangedAt: now,
          emailVerifiedAt: now,
        },
      }),
      this.prisma.emailCode.deleteMany({ where: { userId: id } }),
    ]);
  }

  async checkHasBeenRpp(userId: string): Promise<boolean> {
    const count = await this.prisma.eventStaff.count({
      where: {
        userId,
        role: 'PROMOTER',
        status: 'ACCEPTED',
      },
    });
    return count > 0;
  }

  // Whether they can scan now: scanners and managers (encargados) check
  // tickets in, the same roles the check-in accepts.
  async checkIsCurrentlyScanner(userId: string): Promise<boolean> {
    const count = await this.prisma.eventStaff.count({
      where: {
        userId,
        role: { in: ['SCANNER', 'MANAGER'] },
        status: 'ACCEPTED',
        event: {
          status: { notIn: ['FINISHED', 'CANCELLED'] },
          deletedAt: null,
        },
      },
    });
    return count > 0;
  }
}
