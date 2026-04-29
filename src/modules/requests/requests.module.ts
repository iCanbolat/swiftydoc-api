import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { PortalController } from './portal.controller';
import { RequestWorkflowService } from './request-workflow.service';
import { RequestsController } from './requests.controller';
import { ReviewsController } from './reviews.controller';
import { SubmissionsController } from './submissions.controller';

@Module({
  imports: [AuthModule, FilesModule],
  controllers: [
    RequestsController,
    PortalController,
    SubmissionsController,
    ReviewsController,
  ],
  providers: [RequestWorkflowService],
  exports: [RequestWorkflowService],
})
export class RequestsModule {}
