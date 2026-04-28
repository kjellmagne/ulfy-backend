import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { IsOptional, IsString, MinLength } from "class-validator";
import { ActivationService } from "./activation.service";

class ActivateDto {
  @IsString()
  @MinLength(12)
  activationKey!: string;

  @IsString()
  @MinLength(3)
  deviceIdentifier!: string;

  @IsString()
  appVersion!: string;
}

class RefreshDto {
  @IsString()
  @MinLength(20)
  activationToken!: string;

  @IsOptional()
  @IsString()
  appVersion?: string;
}

@Controller()
export class ActivationController {
  constructor(private readonly activation: ActivationService) {}

  @Post("activate/single")
  activateSingle(@Body() dto: ActivateDto) {
    return this.activation.activateSingle(dto);
  }

  @Post("activate/enterprise")
  activateEnterprise(@Body() dto: ActivateDto) {
    return this.activation.activateEnterprise(dto);
  }

  @Post("activation/refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.activation.refresh(dto.activationToken, dto.appVersion);
  }

  @Get("config/effective")
  effectiveConfig(@Query("activationToken") activationToken: string) {
    return this.activation.effectiveConfig(activationToken);
  }
}
