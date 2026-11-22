import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service.js';
import { FileManager } from './file-manager/file-manager.js';
import { PageManager } from './page-manager/page-manager.js';
import { RecordManager } from './record-manager/record-manager.js';
import { IndexManager } from './index-manager/index-manager.js';
import { CatalogManager } from './catalog-manager/catalog-manager.js';
import { TableManager } from './table-manager/table-manager.js';
import { Logger } from './logger/logger.js';

@Global()
@Module({
    providers: [
        StorageService,
        FileManager,
        PageManager,
        RecordManager,
        IndexManager,
        CatalogManager,
        TableManager,
        Logger,
    ],
    exports: [StorageService, FileManager, TableManager, Logger],
})
export class StorageModule {}
