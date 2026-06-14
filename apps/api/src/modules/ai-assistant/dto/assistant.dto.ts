import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  MaxLength,
  MinLength,
  IsNumber,
  Min,
  Max,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AssistantFeedbackRating,
  AssistantFeedbackReasonCategory,
  TravelStyle,
} from '@roarpass/shared';

export class StartSessionDto {
  @IsUUID()
  event_id!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  language_code?: string;
}

export class SessionPreferenceOverridesDto {
  @IsOptional()
  @IsEnum(TravelStyle)
  travel_style?: TravelStyle;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10_000)
  budget_max_usd?: number;

  @IsOptional()
  @IsString({ each: true })
  transport_modes?: string[];
}

export class SendTurnDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4_000) // Limit user input length
  content!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SessionPreferenceOverridesDto)
  session_preference_overrides?: SessionPreferenceOverridesDto;
}

export class SubmitFeedbackDto {
  @IsEnum(AssistantFeedbackRating)
  rating!: AssistantFeedbackRating;

  @IsOptional()
  @IsEnum(AssistantFeedbackReasonCategory)
  reason_category?: AssistantFeedbackReasonCategory;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason_text?: string;
}

export class GetSessionHistoryQueryDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  before_sequence?: number;
}

export class ConsentDto {
  @IsIn([true, false])
  itinerary_context_consent!: boolean;

  @IsIn([true, false])
  llm_provider_transmission_consent!: boolean;

  @IsIn([true, false])
  feedback_improvement_consent!: boolean;
}