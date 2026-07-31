import { Module } from '@nestjs/common';
import { PublicAppsController } from './public-apps.controller';

@Module({ controllers: [PublicAppsController] })
export class PublicAppsModule {}
