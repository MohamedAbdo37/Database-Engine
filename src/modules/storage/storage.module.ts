import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service.js';
import { FileManager } from './file-manager/file-manager.js';

@Global()
@Module({
    providers: [StorageService, FileManager],
    exports: [StorageService],
})
export class StorageModule {}
