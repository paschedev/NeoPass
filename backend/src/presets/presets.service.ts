import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PresetsService {
  constructor(private prisma: PrismaService) {}

  // Read-only: the default presets are created at sign-up, so two concurrent
  // reads can't create duplicates.
  async findAll(organizerId: string) {
    return this.prisma.ticketPreset.findMany({
      where: { organizerId },
      orderBy: { name: 'asc' },
    });
  }

  async create(organizerId: string, name: string, price: number) {
    const count = await this.prisma.ticketPreset.count({
      where: { organizerId },
    });
    if (count >= 7) {
      throw new BadRequestException(
        'Has alcanzado el límite máximo de 7 plantillas.',
      );
    }

    return this.prisma.ticketPreset.create({
      data: {
        organizerId,
        name,
        price,
      },
    });
  }

  async update(id: string, organizerId: string, name: string, price: number) {
    const preset = await this.prisma.ticketPreset.findUnique({ where: { id } });
    if (!preset || preset.organizerId !== organizerId) {
      throw new NotFoundException('Plantilla no encontrada');
    }

    return this.prisma.ticketPreset.update({
      where: { id },
      data: { name, price },
    });
  }

  async remove(id: string, organizerId: string) {
    const preset = await this.prisma.ticketPreset.findUnique({ where: { id } });
    if (!preset || preset.organizerId !== organizerId) {
      throw new NotFoundException('Plantilla no encontrada');
    }

    return this.prisma.ticketPreset.delete({
      where: { id },
    });
  }
}
