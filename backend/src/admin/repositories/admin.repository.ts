import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// What ADMIN sees of every event: no organizer data beyond name and email.
const ADMIN_EVENT_SELECT = {
  id: true,
  title: true,
  status: true,
  startDate: true,
  endDate: true,
  deletedAt: true,
  neoPassFeePercentage: true,
  organizer: { select: { name: true, email: true } },
} satisfies Prisma.EventSelect;

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEvents({
    search,
    skip,
    take,
  }: {
    search?: string;
    skip: number;
    take: number;
  }) {
    const where: Prisma.EventWhereInput = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { organizer: { email: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        select: ADMIN_EVENT_SELECT,
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.event.count({ where }),
    ]);
    return { items, total };
  }

  findEventPhase(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
      select: { status: true, startDate: true, endDate: true, deletedAt: true },
    });
  }

  updateServiceFee(id: string, percentage: number) {
    return this.prisma.event.update({
      where: { id },
      data: { neoPassFeePercentage: percentage },
      select: { id: true, neoPassFeePercentage: true },
    });
  }
}
