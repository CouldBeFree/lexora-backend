import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

// PushSubscription.toJSON() flattened, plus the device's IANA time zone
export class SubscribePushDto {
  @IsString()
  @IsNotEmpty()
  endpoint: string;

  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  auth: string;

  @IsString()
  @IsNotEmpty()
  timezone: string;

  // Reminders to switch on (true) or off (false) on this device; left out → unchanged
  @IsOptional()
  @IsBoolean()
  phrases?: boolean;

  @IsOptional()
  @IsBoolean()
  words?: boolean;
}

export class UnsubscribePushDto {
  @IsString()
  @IsNotEmpty()
  endpoint: string;
}
