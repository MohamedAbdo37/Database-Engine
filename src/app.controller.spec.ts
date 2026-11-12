import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { RecordManager } from './modules/storage/record-manager/record-manager.js';
import { StorageModule } from './modules/storage/storage.module.js';
import { SqlEngineModule } from './modules/sql-engine/sql-engine.module.js';

describe('AppController', () => {
    let appController: AppController;

    let recordManagerMock = {};
    beforeEach(async () => {
        const app: TestingModule = await Test.createTestingModule({
            imports: [StorageModule, SqlEngineModule],
            controllers: [AppController],
            providers: [AppService],
        })
            .overrideProvider(RecordManager)
            .useValue(recordManagerMock)
            .compile();

        appController = app.get<AppController>(AppController);
    });

    describe('root', () => {
        it('should return "Hello World!"', () => {
            expect(appController.getHello()).toBe('Hello World!');
        });
    });
});
