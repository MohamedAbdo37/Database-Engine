import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service.js';
import { FileManager } from './file-manager/file-manager.js';

describe('StorageService', () => {
    let service: StorageService;
    const mockFileManager = {};

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [StorageService, FileManager],
        })
            .overrideProvider(FileManager)
            .useValue(mockFileManager)
            .compile();

        service = module.get<StorageService>(StorageService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
