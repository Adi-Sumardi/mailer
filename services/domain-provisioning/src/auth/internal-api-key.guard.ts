import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Dipakai untuk endpoint service-to-service (bukan endpoint yang dipanggil user akhir lewat
// JWT). Pemanggil harus menyertakan header X-Internal-Api-Key yang sama dengan INTERNAL_API_KEY
// di sini. Sederhana secara sengaja — ganti dengan mTLS/service mesh begitu tersedia.
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-internal-api-key'];
    const expected = this.config.get<string>('INTERNAL_API_KEY');

    if (!expected || provided !== expected) {
      throw new UnauthorizedException('Internal API key tidak valid');
    }
    return true;
  }
}
