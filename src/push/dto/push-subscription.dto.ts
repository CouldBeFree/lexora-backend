import { IsNotEmpty, IsString } from 'class-validator';

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
}

export class UnsubscribePushDto {
  @IsString()
  @IsNotEmpty()
  endpoint: string;
}
