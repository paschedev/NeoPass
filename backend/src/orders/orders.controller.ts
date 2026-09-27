import {
  Controller,
  Post,
  Body,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CaptchaService } from '../auth/captcha.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly captchaService: CaptchaService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async createCheckout(@Req() req: any, @Body() body: CreateOrderDto) {
    await this.captchaService.assertHuman(body.captchaToken);

    const finalUserId = req.user?.userId;
    if (!finalUserId) {
      throw new BadRequestException(
        'Se requiere sesión activa para procesar la compra.',
      );
    }

    return this.ordersService.createCheckoutSession(
      finalUserId,
      body.items,
      body.promoterId,
    );
  }
}
