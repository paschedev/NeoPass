import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PresignQueryDto } from './dto/presign-query.dto';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('presign')
  getPresignedToken(
    @Query() query: PresignQueryDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
  ) {
    return this.mediaService.presign(userId, role, query.eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('avatar-presign')
  getAvatarSignature(@CurrentUser('userId') userId: string) {
    return this.mediaService.avatarSignature(userId);
  }
}
