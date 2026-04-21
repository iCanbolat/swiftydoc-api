import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  const appStatus = {
    data: {
      name: 'swiftydoc-api',
      status: 'ok',
      phase: 'foundation',
      database: {
        driver: 'postgres',
        configured: false,
        orm: 'drizzle',
      },
      storage: {
        driver: 'local',
      },
    },
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getStatus: () => appStatus,
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return foundation status payload', () => {
      expect(appController.getStatus()).toEqual(appStatus);
    });
  });
});
