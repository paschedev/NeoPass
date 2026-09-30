import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CaptchaService } from '../auth/captcha.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly captchaService: CaptchaService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async createCheckout(
    @CurrentUser('userId') userId: string,
    @Body() body: CreateOrderDto,
  ) {
    await this.captchaService.assertHuman(body.captchaToken);

    return this.ordersService.createCheckoutSession(
      userId,
      body.items,
      body.promoterId,
    );
  }
}
