import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import {
  AdminAppsController,
  AdminInboxController,
  AdminKnowledgeController,
  AdminReportsController,
} from './admin.controller';
import { AdminService } from './admin.service';
import { StorageService } from './storage.service';

@Module({
  imports: [AuthModule],
  controllers: [
    AdminAppsController,
    AdminInboxController,
    AdminKnowledgeController,
    AdminReportsController,
  ],
  providers: [AdminService, StorageService],
})
export class AdminModule {}
