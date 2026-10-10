import { Injectable } from '@nestjs/common';
import { EmailCode, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EMAIL_CODE_ATTEMPTS } from '../email-code';

export type NewEmailCode = Omit<Prisma.EmailCodeUncheckedCreateInput, 'userId'>;

@Injectable()
export class EmailCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUser(userId: string): Promise<EmailCode | null> {
    return this.prisma.emailCode.findUnique({ where: { userId } });
  }

  // The account's new code replaces the pending one.
  async save(userId: string, code: NewEmailCode) {
    await this.prisma.emailCode.upsert({
      where: { userId },
      create: { userId, ...code },
      update: code,
    });
  }

  // One more wrong guess, unless that code was replaced or used meanwhile.
  async registerWrongGuess(userId: string, codeHash: string) {
    await this.prisma.emailCode.updateMany({
      where: { userId, codeHash, attempts: { lt: EMAIL_CODE_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
  }

  async delete(userId: string) {
    await this.prisma.emailCode.deleteMany({ where: { userId } });
  }

  // Uses the code and confirms the account's email; false if another request
  // used that code first.
  confirmEmail(userId: string, codeHash: string, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.emailCode.deleteMany({
        where: { userId, codeHash },
      });
      if (count === 0) return false;
      await tx.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: now },
      });
      return true;
    });
  }

  // Uses the code and moves the account to its email, already confirmed. The
  // pending password reset links went to the old email: they stop working.
  // Returns the saved email, or null if another request used the code first;
  // throws a unique violation if another account took that email meanwhile.
  changeEmail(userId: string, code: EmailCode, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.emailCode.deleteMany({
        where: { userId, codeHash: code.codeHash },
      });
      if (count === 0) return null;
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          email: code.email,
          emailVerifiedAt: now,
          passwordResetToken: null,
          passwordResetExpires: null,
        },
        select: { email: true },
      });
      return user.email;
    });
  }
}
