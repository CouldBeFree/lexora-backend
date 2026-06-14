import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'email must be a valid email' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'password should not be empty' })
  password: string;
}
