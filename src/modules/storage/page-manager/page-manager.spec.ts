import { vi } from 'vitest';

import { DirectoryPage, TablePage } from '../dto/page.dto.js';
import { PageManager, PageType } from './page-manager.js';

describe('Page Class', () => {
    it('should be defined', () => {
        expect(new TablePage(0)).toBeDefined();
    });

    it('should add a tuple correctly', () => {
        const page = new TablePage(1);
        const tupleBuffer = Buffer.from('test data');
        const result = page.addTuple(tupleBuffer);

        expect(result).toBe(0);
        expect(page.slots.length).toBe(1);
        expect(page.slots[0].length).toBe(tupleBuffer.length);
        expect(
            page
                .getData()
                .subarray(
                    page.slots[0].offset,
                    page.slots[0].offset + tupleBuffer.length,
                )
                .equals(tupleBuffer),
        ).toBe(true);
    });

    it('should get a tuple correctly', () => {
        const page = new TablePage(1);
        const tupleBuffer = Buffer.from('test data');
        page.addTuple(tupleBuffer);
        const retrievedTuple = page.getTuple(0);

        expect(retrievedTuple).not.toBeNull();
        expect(retrievedTuple!.equals(tupleBuffer)).toBe(true);
    });

    it('should delete a tuple correctly', () => {
        const page = new TablePage(1);
        const tupleBuffer = Buffer.from('test data');
        page.addTuple(tupleBuffer);
        page.deleteTuple(0);

        expect(page.slots[0].isDeleted).toBe(true);
    });

    it('should return null for a non-existent tuple', () => {
        const page = new TablePage(1);
        const retrievedTuple = page.getTuple(0);

        expect(retrievedTuple).toBeNull();
        expect(page.slots.length).toBe(0);
    });

    it('should return null for a deleted tuple', () => {
        const page = new TablePage(1);
        const tupleBuffer = Buffer.from('test data');
        page.addTuple(tupleBuffer);
        page.deleteTuple(0);
        const retrievedTuple = page.getTuple(0);

        expect(retrievedTuple).toBeNull();
        expect(page.slots[0].isDeleted).toBe(true);
    });

    it('should replace a tuple correctly', () => {
        const page = new TablePage(1);
        const tupleBuffer1 = Buffer.from('test data 1');
        const tupleBuffer2 = Buffer.from('test data 2');
        page.addTuple(tupleBuffer1);
        const addTupleSpy = vi.spyOn(page, 'addTuple');
        const result = page.replaceTuple(0, tupleBuffer2);

        expect(result).toBe(0);
        expect(page.slots.length).toBe(1);
        expect(page.slots[0].length).toBe(tupleBuffer2.length);
        expect(
            page
                .getData()
                .subarray(
                    page.slots[0].offset,
                    page.slots[0].offset + tupleBuffer2.length,
                )
                .equals(tupleBuffer2),
        ).toBe(true);

        expect(page.slots[0].isDeleted).toBe(false);
        expect(addTupleSpy).toHaveBeenCalledTimes(0);
    });

    it('should add a new tuple if replacing a non-existent slot', () => {
        const page = new TablePage(1);
        const tupleBuffer = Buffer.from('test data');
        const addTupleSpy = vi.spyOn(page, 'addTuple');
        const result = page.replaceTuple(0, tupleBuffer);

        expect(result).toBe(0);
        expect(page.slots.length).toBe(1);
        expect(page.slots[0].length).toBe(tupleBuffer.length);
        expect(
            page
                .getData()
                .subarray(
                    page.slots[0].offset,
                    page.slots[0].offset + tupleBuffer.length,
                )
                .equals(tupleBuffer),
        ).toBe(true);

        expect(addTupleSpy).toHaveBeenCalledOnce();
    });

    it('should replace a deleted tuple correctly when use addTuple', () => {
        const page = new TablePage(1);
        const tupleBuffer1 = Buffer.from('test data 1');
        const tupleBuffer2 = Buffer.from('test data 2');

        page.addTuple(tupleBuffer1);
        page.deleteTuple(0);

        expect(page.slots).toHaveLength(1);
        expect(page.slots[0].isDeleted).toBe(true);
        expect(page.slots[0].length).toBe(tupleBuffer1.length);

        const result = page.addTuple(tupleBuffer2);

        expect(result).toBe(0);
        expect(page.slots).toHaveLength(1);
        expect(page.slots[0].length).toBe(tupleBuffer2.length);
        expect(
            page
                .getData()
                .subarray(
                    page.slots[0].offset,
                    page.slots[0].offset + tupleBuffer2.length,
                )
                .equals(tupleBuffer2),
        ).toBe(true);

        expect(page.slots[0].isDeleted).toBe(false);
    });

    it('should serialize and deserialize correctly', () => {
        const page = new TablePage(1);
        const tupleBuffer = Buffer.from('test data');
        page.addTuple(tupleBuffer);
        const serialized = page.serialize();

        const deserializedPage = new TablePage(0).deserialize(serialized);

        expect(deserializedPage).toStrictEqual(page);
        expect(deserializedPage.getPageId()).toBe(page.getPageId());
        expect((deserializedPage as TablePage).slots.length).toBe(
            page.slots.length,
        );
        expect(deserializedPage.getData().equals(page.getData())).toBe(true);
    });
});

describe('PageManager', () => {
    const fileManagerMock = {
        initializeDataFolder: vi.fn(),
        isFileOpen: vi.fn(),
        createTableDateFile: vi.fn(),
        createIndexFile: vi.fn(),
        writeCatalogSchemaFile: vi.fn(),
        readCatalogSchema: vi.fn(),
        openTableFile: vi.fn(),
        closeTableFile: vi.fn(),
        writePage: vi.fn(),
        readPage: vi.fn(),
    } as unknown as PageManager['fileManger'];

    it('should be defined', () => {
        expect(new PageManager(fileManagerMock)).toBeDefined();
    });

    it('should create a new table', async () => {
        const pageManager = new PageManager(fileManagerMock);
        const schema = { tableName: 'test_table' } as any;

        await pageManager.createNewTable(schema);

        expect(fileManagerMock.createTableDateFile).toHaveBeenCalledWith(
            schema.tableName,
        );
        expect(fileManagerMock.writePage).toHaveBeenCalledTimes(3);
    });

    it('should add a record to the current page', async () => {
        const pageManager = new PageManager(fileManagerMock);
        const tableName = 'test_table';
        const record = Buffer.from('test_record');
        const directoryPage = new DirectoryPage(tableName);
        const currentPageMock = {
            addTuple: vi.fn().mockReturnValue(0),
            getPageId: vi.fn().mockReturnValue(1),
        } as unknown as TablePage;
        const addTupleSpy = vi.spyOn(currentPageMock, 'addTuple');

        vi.mocked(fileManagerMock.readPage)
            .mockResolvedValueOnce(directoryPage)
            .mockResolvedValueOnce(currentPageMock);

        const rid = await pageManager.addRecord(tableName, record);

        expect(addTupleSpy).toHaveBeenCalledWith(record);
        expect(rid).toEqual({ pageId: 1, slotNumber: 0 });
    });
});
