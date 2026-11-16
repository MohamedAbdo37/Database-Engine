import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from './storage.service.js';
import { FileManager } from './file-manager/file-manager.js';
import { IndexManager } from './index-manager/index-manager.js';
import { CatalogManager } from './catalog-manager/catalog-manager.js';
import { TableManager } from './table-manager/table-manager.js';

describe('StorageService', () => {
    let service: StorageService;
    const mockFileManager = {};

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StorageService,
                { provide: FileManager, useValue: mockFileManager },
                { provide: IndexManager, useValue: {} },
                { provide: CatalogManager, useValue: {} },
                { provide: TableManager, useValue: {} },
            ],
        })
            .compile();

        service = module.get<StorageService>(StorageService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
