import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PresetsService } from './presets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PresetDto } from './dto/preset.dto';

@Controller('presets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ORGANIZER', 'ADMIN')
export class PresetsController {
  constructor(private readonly presetsService: PresetsService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.presetsService.findAll(req.user.userId);
  }

  @Post()
  create(@Req() req: any, @Body() body: PresetDto) {
    return this.presetsService.create(req.user.userId, body.name, body.price);
  }

  @Put(':id')
  update(@Param('id') id: string, @Req() req: any, @Body() body: PresetDto) {
    return this.presetsService.update(
      id,
      req.user.userId,
      body.name,
      body.price,
    );
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    return this.presetsService.remove(id, req.user.userId);
  }
}
