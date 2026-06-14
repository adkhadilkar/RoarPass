import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthController } from './controllers/auth.controller';
import { ProfileController } from './controllers/profile.controller';
import { EventActivationController } from './controllers/event-activation.controller';
import { AdminIdentityController } from './controllers/admin-identity.controller';

import { AuthService } from './services/auth.service';
import { ProfileService } from './services/profile.service';
import { OtpService } from './services/otp.service';
import { TokenService } from './services/token.service';
import { EventActivationService } from './services/event-activation.service';
import { GdprService } from './services/gdpr.service';
import { PasswordService } from './services/password.service';

import { UserEntity } from './entities/user.entity';
import { AuthProviderLinkEntity } from './entities/auth-provider-link.entity';
import { EventActivationEntity } from './entities/event-activation.entity';
import { RefreshTokenEntity } from './entities/refresh-token.entity';
import { OtpEntity } from './entities/otp.entity';
import { EmailVerificationTokenEntity } from './entities/email-verification-token.entity';
import { PasswordResetTokenEntity } from './entities/password-reset-token.entity';
import { UserTranslationPreferenceEntity } from './entities/user-translation-preference.entity';

import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      AuthProviderLinkEntity,
      EventActivationEntity,
      RefreshTokenEntity,
      OtpEntity,
      EmailVerificationTokenEntity,
      PasswordResetTokenEntity,
      UserTranslationPreferenceEntity,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m'),
          issuer: 'roarpass',
          audience: 'roarpass-api',
        },
      }),
    }),
    ThrottlerModule.forRoot([
      {
        name: 'auth',
        ttl: 60_000,
        limit: 10,
      },
    ]),
  ],
  controllers: [
    AuthController,
    ProfileController,
    EventActivationController,
    AdminIdentityController,
  ],
  providers: [
    AuthService,
    ProfileService,
    OtpService,
    TokenService,
    EventActivationService,
    GdprService,
    PasswordService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, ProfileService, TokenService, JwtAuthGuard, RolesGuard],
})
export class IdentityModule {}