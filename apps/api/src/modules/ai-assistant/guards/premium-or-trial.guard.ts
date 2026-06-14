import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PremiumGateService } from '../services/premium-gate.service';

/** REQ-AI-29, REQ-AI-30, REQ-AI-31 */
@Injectable()
export class PremiumOrTrialGuard implements CanActivate {
  constructor(private readonly premiumGate: PremiumGateService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId: string = request.user?.user_id;

    const result = await this.premiumGate.checkAccess(userId);

    if (result.allowed) {
      // Attach remaining trial info to request for controller use
      request.premiumGateResult = result;
      return true;
    }

    throw new HttpException(
      {
        error: 'premium_required',
        trial_queries_used: result.trial_queries_used,
        message:
          'Upgrade to RoarPass Premium to unlock unlimited AI Trip Assistant access.',
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}