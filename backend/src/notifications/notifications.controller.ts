import {
  Controller,
  Get,
  Param,
  Put,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ParseIdPipe } from '../common/parse-id.pipe';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Req() req: any) {
    return this.notificationsService.findAllForUser(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('feed')
  findFeed(
    @CurrentUser('userId') userId: string,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.findFeed(userId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Put('read-all')
  markAllAsRead(@Req() req: any) {
    return this.notificationsService.markAllAsRead(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/read')
  markAsRead(@Param('id', ParseIdPipe) id: string, @Req() req: any) {
    return this.notificationsService.markAsRead(id, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseIdPipe) id: string, @Req() req: any) {
    return this.notificationsService.delete(id, req.user.userId);
  }
}
