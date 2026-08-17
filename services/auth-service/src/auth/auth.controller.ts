import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Login2FaDto } from './dto/login-2fa.dto';
import { Verify2FaDto } from './dto/verify-2fa.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import { JwtPayload } from './jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('login-2fa')
  login2FA(@Body() dto: Login2FaDto) {
    return this.authService.login2FA(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/generate')
  generate2FA(@CurrentUser() user: JwtPayload) {
    return this.authService.generate2FA(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  enable2FA(@CurrentUser() user: JwtPayload, @Body() dto: Verify2FaDto) {
    return this.authService.enable2FA(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  disable2FA(@CurrentUser() user: JwtPayload, @Body() dto: Verify2FaDto) {
    return this.authService.disable2FA(user.sub, dto);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.findByIdOrThrow(user.sub);
  }
}

