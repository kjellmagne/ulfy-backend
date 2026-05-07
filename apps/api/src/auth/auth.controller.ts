import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { IsEmail, IsString, MinLength } from "class-validator";
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { AuthService } from "./auth.service";

class LoginDto {
  @ApiProperty({ example: "admin@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "ChangeMe123!", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}

@ApiTags("Admin auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: "Admin login", description: "Authenticates an internal admin user. There is no public signup or self-service registration endpoint." })
  @ApiOkResponse({
    description: "Admin JWT issued.",
    schema: {
      example: {
        accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        user: { id: "85d6ab1c-cf8b-4e5e-9af0-b3e836029d28", email: "admin@example.com", fullName: "skrivDET Admin", role: "superadmin", partnerId: null }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: "Invalid email or password." })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }
}
