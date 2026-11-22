import { Injectable, OnModuleInit } from '@nestjs/common';
import { FileManager } from './file-manager/file-manager.js';

@Injectable()
export class StorageService implements OnModuleInit {
    constructor(private readonly fileManager: FileManager) {}

    async onModuleInit(): Promise<void> {
        await this.fileManager.initializeDataFolder();
        console.log(
            'StorageService initialized and data folder structure is ready.',
        );
    }
}
