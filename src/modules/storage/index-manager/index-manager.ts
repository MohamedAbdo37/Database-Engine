import { Injectable } from '@nestjs/common';
import { FileManager } from '../file-manager/file-manager.js';
import { CatalogIndex } from '../dto/catalog.dto.js';
import { RID } from '../dto/rid.dto.js';
import { BTreeNode } from './indexing/b-tree.class.js';
import { BTreeLeafNode } from './indexing/BTreeLeafNode.js';
import { BTreeInternalNode } from './indexing/BTreeInternalNode.js';

const INDEX_NODE_ORDER = 8;

@Injectable()
export class IndexManager {
    constructor(private readonly fileManager: FileManager) {}

    public async createIndexFile(
        tableName: string,
        columnName: string,
        columnsID: number[],
        name?: string,
        isUnique?: boolean,
    ): Promise<void> {
        const index: CatalogIndex = {
            columnsID: columnsID,
            isUnique: isUnique ?? false,
            name: name ?? `${tableName}_${columnName}_${isUnique ?? 'unique'}`,
        };
        await this.fileManager.createIndexFile(tableName, index);
    }

    public async deleteIndexFile(tableName: string): Promise<void> {
        // TODO: Implement the logic to delete the index file associated with the given tableName
    }

    public initialize(): void {}
}
