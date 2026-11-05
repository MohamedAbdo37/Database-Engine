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

    async createTable() {}
    async dropTable() {}

    async insertData() {}
    async updateData() {}
    async deleteData() {}
    async getById() {}
    async scanData() {}

    async createIndex() {}
    async dropIndex() {}
    async lookupIndex() {}
}
