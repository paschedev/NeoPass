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

  // Takes one of the guesses the mailbox `email` reaches has left: counted as
  // wrong until the code turns out right (releaseGuess). Under a lock per
  // mailbox, so guesses at the same time can't all slip in under the limit.
  // The id of the guess, or null at the limit; failures before `since` no
  // longer count and go away.
  reserveGuess(email: string, now: Date, since: Date, limit: number) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(email_key(${email})))`;
      await tx.$executeRaw`
        DELETE FROM "EmailCodeFailure"
        WHERE "emailKey" = email_key(${email}) AND "createdAt" < ${since}`;
      const [{ count }] = await tx.$queryRaw<{ count: number }[]>`
        SELECT count(*)::int AS count FROM "EmailCodeFailure"
        WHERE "emailKey" = email_key(${email})`;
      if (count >= limit) return null;
      const [{ id }] = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO "EmailCodeFailure" ("id", "emailKey", "createdAt")
        VALUES (gen_random_uuid()::text, email_key(${email}), ${now})
        RETURNING "id"`;
      return id;
    });
  }

  // The right code doesn't count against its mailbox.
  async releaseGuess(id: string) {
    await this.prisma.emailCodeFailure.deleteMany({ where: { id } });
  }

  // One more wrong guess on the code, unless it was replaced or used
  // meanwhile.
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
