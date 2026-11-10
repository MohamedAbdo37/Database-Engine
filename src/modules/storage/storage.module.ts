import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service.js';
import { FileManager } from './file-manager/file-manager.js';
import { PageManager } from './page-manager/page-manager.js';
import { RecordManager } from './record-manager/record-manager.js';

@Global()
@Module({
    providers: [StorageService, FileManager, PageManager, RecordManager],
    exports: [StorageService, FileManager, PageManager, RecordManager],
})
export class StorageModule {}
