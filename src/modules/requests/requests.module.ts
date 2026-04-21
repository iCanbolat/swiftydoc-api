import { Module } from '@nestjs/common';
import { PortalController } from './portal.controller';
import { RequestWorkflowService } from './request-workflow.service';
import { RequestsController } from './requests.controller';
import { ReviewsController } from './reviews.controller';
import { SubmissionsController } from './submissions.controller';

@Module({
  controllers: [
    RequestsController,
    PortalController,
    SubmissionsController,
    ReviewsController,
  ],
  providers: [RequestWorkflowService],
})
export class RequestsModule {}
