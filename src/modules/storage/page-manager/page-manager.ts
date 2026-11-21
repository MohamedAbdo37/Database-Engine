import { Injectable } from '@nestjs/common';
import { DirectoryPage, TablePage } from '../dto/page.dto.js';
import { FileManager } from '../file-manager/file-manager.js';
import { Catalog } from '../dto/catalog.dto.js';
import { PageType } from '../dto/page-type.dto.js';
import { RID } from '../dto/rid.dto.js';

export { PageType } from '../dto/page-type.dto.js';

type DirectoryPageCacheKey = {
    page: DirectoryPage;
    lastAccessed: number;
};

type TablePageCacheKey = {
    tableName: string;
    pageId: number;
};

type TablePageCacheValue = {
    page: TablePage;
    lastAccessed: number;
};

const DIRECTORY_PAGE_CACHE_SIZE_LIMIT = 5; // Limit the cache size to 10 entries
const TABLE_PAGE_CACHE_SIZE_LIMIT = 5; // Limit the cache size to 10 entries

@Injectable()
export class PageManager {
    constructor(private readonly fileManger: FileManager) {}

    private DirectoryPages: Map<string, DirectoryPageCacheKey> = new Map();
    private TablePages: Map<TablePageCacheKey, TablePageCacheValue> = new Map();

    private addToDirectoryPageCache(
        tableName: string,
        directory: DirectoryPage,
    ): void {
        if (this.DirectoryPages.size >= DIRECTORY_PAGE_CACHE_SIZE_LIMIT) {
            let oldestKey: string | null = null;
            let oldestAccessTime = Infinity;
            for (const [key, value] of this.DirectoryPages.entries()) {
                if (value.lastAccessed < oldestAccessTime) {
                    oldestAccessTime = value.lastAccessed;
                    oldestKey = key;
                }
            }

            if (oldestKey) {
                this.DirectoryPages.delete(oldestKey);
            }
        }

        this.DirectoryPages.set(tableName, {
            page: directory,
            lastAccessed: Date.now(),
        });
    }

    private addToTablePageCache(
        tableName: string,
        pageId: number,
        page: TablePage,
    ): void {
        const cacheKey: TablePageCacheKey = { tableName, pageId };
        if (this.TablePages.size >= TABLE_PAGE_CACHE_SIZE_LIMIT) {
            let oldestKey: TablePageCacheKey | null = null;
            let oldestAccessTime = Infinity;
            for (const [key, value] of this.TablePages.entries()) {
                if (value.lastAccessed < oldestAccessTime) {
                    oldestAccessTime = value.lastAccessed;
                    oldestKey = key;
                }
            }

            if (oldestKey) {
                this.TablePages.delete(oldestKey);
            }
        }

        this.TablePages.set(cacheKey, {
            page: page,
            lastAccessed: Date.now(),
        });
    }

    private async getCurrentPage(tableName: string): Promise<TablePage> {
        const directory: DirectoryPage = await this.getDirectoryPage(tableName);

        const currentPageId = directory.numberOfPages - 1;

        const page: TablePage = (await this.getTablePage(
            tableName,
            currentPageId,
        )) as TablePage;

        return page;
    }

    private async getDirectoryPage(tableName: string): Promise<DirectoryPage> {
        let directory: DirectoryPage;

        if (this.DirectoryPages.has(tableName)) {
            const DirectoryPageCacheValue = this.DirectoryPages.get(tableName);
            directory = DirectoryPageCacheValue?.page as DirectoryPage;
            DirectoryPageCacheValue!.lastAccessed = Date.now();
            return directory;
        }

        if (!this.fileManger.isFileOpen()) {
            this.fileManger.openTableFile(tableName);
        }

        directory = (await this.fileManger.readPage(
            0,
            PageType.DIRECTORY,
        )) as DirectoryPage;

        this.addToDirectoryPageCache(tableName, directory);

        return directory;
    }

    private async getTablePage(
        tableName: string,
        pageId: number,
    ): Promise<TablePage> {
        const cacheKey: TablePageCacheKey = { tableName, pageId };
        let page: TablePage;
        if (this.TablePages.has(cacheKey)) {
            const tablePageCacheValue = this.TablePages.get(cacheKey);
            page = tablePageCacheValue?.page as TablePage;
            tablePageCacheValue!.lastAccessed = Date.now();
            return page;
        }

        if (!this.fileManger.isFileOpen()) {
            this.fileManger.openTableFile(tableName);
        }

        page = (await this.fileManger.readPage(
            pageId,
            PageType.TABLE,
        )) as TablePage;

        this.addToTablePageCache(tableName, pageId, page);

        return page;
    }

    private async updateDirectoryPage(
        tableName: string,
        directory: DirectoryPage,
    ): Promise<void> {
        await this.fileManger.writePage(directory);
        this.DirectoryPages.set(tableName, {
            page: directory,
            lastAccessed: Date.now(),
        });
    }

    private async createNewTablePage(
        tableName: string,
        directoryPage?: DirectoryPage,
    ): Promise<TablePage> {
        const directory: DirectoryPage =
            directoryPage ??
            ((await this.getDirectoryPage(tableName)) as DirectoryPage);

        const newPageId = directory.numberOfPages;
        const newPage = new TablePage(newPageId);
        directory.numberOfPages += 1;

        this.addToTablePageCache(tableName, newPageId, newPage);

        await Promise.all([
            this.fileManger.writePage(newPage),
            this.updateDirectoryPage(tableName, directory),
        ]);

        return newPage;
    }

    public async createNewTable(schema: Catalog): Promise<void> {
        const directoryPage = new DirectoryPage(schema.tableName);
        await this.fileManger.createTableDateFile(schema.tableName);
        this.addToDirectoryPageCache(schema.tableName, directoryPage);

        this.fileManger.openTableFile(schema.tableName);
        await Promise.all([
            this.fileManger.writePage(directoryPage),
            this.createNewTablePage(schema.tableName, directoryPage),
        ]);

        await this.fileManger.closeTableFile();
    }

    public async deleteTable(tableName: string): Promise<void> {
        this.fileManger.deleteTableDataFile(tableName);
        this.DirectoryPages.delete(tableName);
    }

    public async addRecord(tableName: string, record: Buffer): Promise<RID> {
        this.fileManger.openTableFile(tableName);
        let currentPage: TablePage = await this.getCurrentPage(tableName);
        let slotIndex = currentPage.addTuple(record);
        if (slotIndex === -1) {
            currentPage = await this.createNewTablePage(tableName);
            slotIndex = currentPage.addTuple(record);
        }
        await this.fileManger.writePage(currentPage);

        this.fileManger.closeTableFile();
        const rid: RID = {
            pageId: currentPage.getPageId(),
            slotNumber: slotIndex,
        };

        return rid;
    }

    public async addRecords(
        tableName: string,
        records: Buffer[],
    ): Promise<RID[]> {
        this.fileManger.openTableFile(tableName);
        let currentPage: TablePage = await this.getCurrentPage(tableName);
        const rids: RID[] = [];
        for (const record of records) {
            let slotIndex = currentPage.addTuple(record);
            if (slotIndex === -1) {
                await this.fileManger.writePage(currentPage);
                currentPage = await this.createNewTablePage(tableName);
                slotIndex = currentPage.addTuple(record);
            }
            rids.push({
                pageId: currentPage.getPageId(),
                slotNumber: slotIndex,
            });
        }

        await this.fileManger.writePage(currentPage);

        this.fileManger.closeTableFile();

        return rids;
    }

    public async getRecord(
        tableName: string,
        rid: RID,
    ): Promise<Buffer | null> {
        this.fileManger.openTableFile(tableName);
        let page: TablePage = (await this.getTablePage(
            tableName,
            rid.pageId,
        )) as TablePage;
        const record: Buffer | null = page.getTuple(rid.slotNumber);
        this.fileManger.closeTableFile();
        return record;
    }

    public async deleteRecord(tableName: string, rid: RID): Promise<void> {
        this.fileManger.openTableFile(tableName);
        let page: TablePage = (await this.getTablePage(
            tableName,
            rid.pageId,
        )) as TablePage;
        page.deleteTuple(rid.slotNumber);
        await this.fileManger.writePage(page);
        this.fileManger.closeTableFile();
    }

    public async deleteRecords(tableName: string, rids: RID[]): Promise<void> {
        if (rids.length === 0) {
            return;
        }

        this.fileManger.openTableFile(tableName);
        let currentPageId = rids[0].pageId;
        let page = (await this.getTablePage(
            tableName,
            currentPageId,
        )) as TablePage;
        for (const rid of rids) {
            if (rid.pageId !== currentPageId) {
                await this.fileManger.writePage(page);
                currentPageId = rid.pageId;
                page = (await this.getTablePage(
                    tableName,
                    currentPageId,
                )) as TablePage;
            }
            page.deleteTuple(rid.slotNumber);
        }
        await this.fileManger.writePage(page);
        this.fileManger.closeTableFile();
    }

    public async updateRecord(
        tableName: string,
        rid: RID,
        updatedRecord: Buffer,
    ): Promise<RID> {
        this.fileManger.openTableFile(tableName);
        let page: TablePage = (await this.getTablePage(
            tableName,
            rid.pageId,
        )) as TablePage;

        let slotIndex: number = page.replaceTuple(
            rid.slotNumber,
            updatedRecord,
        );

        if (slotIndex === -1) {
            page = await this.createNewTablePage(tableName);
            slotIndex = page.addTuple(updatedRecord);
        }

        await this.fileManger.writePage(page);
        this.fileManger.closeTableFile();
        const updatedRID: RID = {
            pageId: page.getPageId(),
            slotNumber: slotIndex,
        };

        return updatedRID;
    }

    public async updateRecords(
        tableName: string,
        rids: RID[],
        updatedRecords: Buffer[],
    ): Promise<RID[]> {
        if (rids.length !== updatedRecords.length) {
            throw new Error(
                `The number of RIDs (${rids.length}) does not match the number of updated records (${updatedRecords.length}).`,
            );
        }

        const updatedRIDs: RID[] = [];

        this.fileManger.openTableFile(tableName);
        for (let i = 0; i < rids.length; i++) {
            let page: TablePage = (await this.getTablePage(
                tableName,
                rids[i].pageId,
            )) as TablePage;

            let slotIndex: number = page.replaceTuple(
                rids[i].slotNumber,
                updatedRecords[i],
            );

            if (slotIndex === -1) {
                let currentPage = await this.getCurrentPage(tableName);
                slotIndex = currentPage.addTuple(updatedRecords[i]);
                if (slotIndex === -1) {
                    currentPage = await this.createNewTablePage(tableName);
                    slotIndex = currentPage.addTuple(updatedRecords[i]);
                }
                page.deleteTuple(rids[i].slotNumber);
                await this.fileManger.writePage(currentPage);
                updatedRIDs.push({
                    pageId: currentPage.getPageId(),
                    slotNumber: slotIndex,
                });
                continue; // Skip the rest of the loop and move to the next record
            }

            await this.fileManger.writePage(page);

            updatedRIDs.push({
                pageId: page.getPageId(),
                slotNumber: slotIndex,
            });
        }
        this.fileManger.closeTableFile();
        return updatedRIDs;
    }

    public async getPageRecords(
        tableName: string,
        pageId: number,
    ): Promise<Buffer[]> {
        this.fileManger.openTableFile(tableName);
        const directory: DirectoryPage = await this.getDirectoryPage(tableName);

        if (pageId >= directory.numberOfPages) {
            this.fileManger.closeTableFile();
            return []; // Return an empty array if the pageId is out of bounds
        }

        const page: TablePage = (await this.getTablePage(
            tableName,
            pageId,
        )) as TablePage;

        this.fileManger.closeTableFile();

        return page.getAllTuples();
    }
}
