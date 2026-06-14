import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConsentService } from '../services/consent.service';

/** REQ-AI-NFR-05 */
@Injectable()
export class ConsentGuard implements CanActivate {
  constructor(private readonly consentService: ConsentService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string = request.user?.user_id;

    const hasConsent = await this.consentService.hasRequiredConsent(userId);
    if (!hasConsent) {
      throw new HttpException(
        {
          error: 'consent_required',
          message:
            'Please accept the AI Assistant data usage terms before continuing.',
          consent_url: '/v1/assistant/consent',
        },
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}