import { Injectable } from '@nestjs/common';
import { FileManager } from '../file-manager/file-manager.js';
import { Catalog, CatalogColumn, CatalogIndex } from '../dto/catalog.dto.js';
import { Datatype } from '../dto/datatype.dto.js';

const CATALOG_CACHE_SIZE_LIMIT = 5;

type CatalogCacheValue = {
    catalog: Catalog;
    lastAccessed: number;
};

@Injectable()
export class CatalogManager {
    private catalogCache: Map<string, CatalogCacheValue> = new Map();

    constructor(private readonly fileManager: FileManager) {}

    private addToCache(tableName: string, catalog: Catalog): void {
        if (this.catalogCache.size >= CATALOG_CACHE_SIZE_LIMIT) {
            let lruKey: string | null = null;
            let oldestAccessTime = Infinity;

            for (const [key, value] of this.catalogCache.entries()) {
                if (value.lastAccessed < oldestAccessTime) {
                    oldestAccessTime = value.lastAccessed;
                    lruKey = key;
                }
            }

            if (lruKey) {
                this.catalogCache.delete(lruKey);
            }
        }

        this.catalogCache.set(tableName, {
            catalog,
            lastAccessed: Date.now(),
        });
    }

    public async getCatalog(tableName: string): Promise<Catalog> {
        let catalog: Catalog;
        if (this.catalogCache.has(tableName)) {
            const cachedValue = this.catalogCache.get(tableName);
            catalog = cachedValue!.catalog;
            cachedValue!.lastAccessed = Date.now();
            return catalog;
        }

        catalog = await this.fileManager.readCatalogSchema(tableName);
        this.addToCache(tableName, catalog);
        return catalog;
    }

    public async createCatalog(schema: Catalog): Promise<void> {
        this.fileManager.writeCatalogSchemaFile(schema);
        this.addToCache(schema.tableName, schema);
    }

    public async updateCatalog(schema: Catalog): Promise<void> {
        await this.fileManager.writeCatalogSchemaFile(schema);
        this.addToCache(schema.tableName, schema);
    }

    public async dropTable(tableName: string): Promise<void> {
        await this.fileManager.deleteTableDataFile(tableName);
        await this.fileManager.deleteIndexFile(tableName);
        await this.fileManager.deleteCatalogSchemaFile(tableName);
        this.catalogCache.delete(tableName);
    }

    public async getCatalogSchemaRecord(
        tableName: string,
    ): Promise<Datatype<any>[]> {
        const catalog = await this.getCatalog(tableName);
        const schemaRecord: Datatype<any>[] = [];
        for (const column of catalog.columns) {
            schemaRecord.push(column.getColumnDatatypeObject());
        }
        return schemaRecord;
    }

    public async getCatalogColumns(
        tableName: string,
    ): Promise<CatalogColumn[]> {
        return (await this.fileManager.readCatalogSchema(tableName)).columns;
    }

    public async getCatalogIndex(tableName: string): Promise<CatalogIndex[]> {
        return (await this.fileManager.readCatalogSchema(tableName)).indexes;
    }
}
