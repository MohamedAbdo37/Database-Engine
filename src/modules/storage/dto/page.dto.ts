import { IOException } from '../exceptions/io-exception.js';
import { PageType } from './page-type.dto.js';

interface PageSlot {
    offset: number;
    length: number;
    isDeleted: boolean;
}

interface TablePageHeader {
    freeSpace: number; // 4KB
    itemsCount: number;
    nextPageId: number;
    prevPageId: number;
}

const HEADER_SIZE = 20;
const SLOT_SIZE = 9; // 4 bytes for offset, 4 bytes for length, 1 byte for isDeleted
export const PAGE_SIZE = 4096; // 4KB

export abstract class Page {
    protected data: Buffer;
    protected pageId: number;

    constructor(pageId: number) {
        this.pageId = pageId;
        this.data = Buffer.alloc(PAGE_SIZE);
    }

    public getData(): Buffer {
        return this.data;
    }

    public getPageId(): number {
        return this.pageId;
    }
    public abstract serialize(): Buffer;
    public abstract deserialize(buffer: Buffer): Page;
}

export class DirectoryPage extends Page {
    private _tableName: string;
    private _numberOfPages: number;
    private _pageType: PageType;
    private _currentPageFreeSpace: number;

    constructor(tableName: string) {
        super(0);
        if (tableName.length * 2 > 1000) {
            throw new IOException(
                `Table name "${tableName}" exceeds the maximum allowed length of 500 characters.`,
            );
        }
        this._tableName = tableName;
        this._numberOfPages = 1;
        this._pageType = PageType.DIRECTORY;
        this._currentPageFreeSpace = 0;
    }

    public get tableName(): string {
        return this._tableName;
    }
    public get numberOfPages(): number {
        return this._numberOfPages;
    }
    public get pageType(): PageType {
        return this._pageType;
    }
    public get currentPageFreeSpace(): number {
        return this._currentPageFreeSpace;
    }

    public set tableName(value: string) {
        this._tableName = value;
    }
    public set numberOfPages(value: number) {
        this._numberOfPages = value;
    }
    public set currentPageFreeSpace(value: number) {
        this._currentPageFreeSpace = value;
    }

    public serialize(): Buffer {
        const buffer = Buffer.alloc(PAGE_SIZE);
        buffer.writeUInt32LE(this._numberOfPages, 0);
        buffer.writeUInt32LE(this._pageType, 4);
        buffer.writeUInt32LE(this._currentPageFreeSpace, 8);
        buffer.writeUInt32LE(this._tableName.length * 2, 12);
        buffer.write(
            this._tableName,
            16,
            this._tableName.length * 2,
            'utf16le',
        );

        return buffer;
    }

    public deserialize(buffer: Buffer): DirectoryPage {
        this._numberOfPages = buffer.readUInt32LE(100);
        this._pageType = buffer.readUInt32LE(104);
        this._currentPageFreeSpace = buffer.readUInt32LE(108);
        this._tableName = buffer.toString('utf16le', 0, 100).replace(/\0/g, '');
        return this;
    }
}

export class TablePage extends Page {
    private _header: TablePageHeader;

    private _slots: PageSlot[];

    private _deletedSlots: { id: number; size: number }[] = [];

    constructor(pageId: number) {
        super(pageId);
        this._header = {
            freeSpace: PAGE_SIZE,
            itemsCount: 0,
            nextPageId: 0,
            prevPageId: 0,
        };
        this._slots = [];
    }

    public get slots(): PageSlot[] {
        return this._slots;
    }

    public serialize(): Buffer {
        const buffer = Buffer.alloc(PAGE_SIZE);

        buffer.writeUInt32LE(this.pageId, 0);
        buffer.writeUInt32LE(this._header.freeSpace, 4);
        buffer.writeUInt32LE(this._header.itemsCount, 8);
        buffer.writeUInt32LE(this._header.nextPageId, 12);
        buffer.writeUInt32LE(this._header.prevPageId, 16);

        for (let i = 0; i < this._slots.length; i++) {
            const slot = this._slots[i];
            const slotOffset = HEADER_SIZE + i * SLOT_SIZE;
            buffer.writeUInt32LE(slot.offset, slotOffset);
            buffer.writeUint32LE(slot.length, slotOffset + 4);
            buffer.writeUInt8(slot.isDeleted ? 1 : 0, slotOffset + 8);
        }

        this.data.copy(
            buffer,
            this._header.freeSpace,
            this._header.freeSpace,
            this.data.length,
        );

        return buffer;
    }

    public deserialize(buffer: Buffer): Page {
        this.pageId = buffer.readUInt32LE(0);

        this._header = {
            freeSpace: buffer.readUInt32LE(4),
            itemsCount: buffer.readUInt32LE(8),
            nextPageId: buffer.readUInt32LE(12),
            prevPageId: buffer.readUInt32LE(16),
        };

        const slots: PageSlot[] = [];
        for (let i = 0; i < this._header.itemsCount; i++) {
            const slotOffset = HEADER_SIZE + i * SLOT_SIZE;
            const offset = buffer.readUInt32LE(slotOffset);
            const length = buffer.readUInt32LE(slotOffset + 4);
            const isDeleted = buffer.readUInt8(slotOffset + 8) === 1;

            if (isDeleted) this._deletedSlots.push({ id: i, size: length });

            this._slots.push({ offset, length, isDeleted });
        }

        buffer.copy(
            this.data,
            this._header.freeSpace,
            this._header.freeSpace,
            PAGE_SIZE,
        );

        return this;
    }

    public deleteTuple(slotIndex: number): void {
        this._slots[slotIndex].isDeleted = true;
        this._deletedSlots.push({
            id: slotIndex,
            size: this._slots[slotIndex].length,
        });
    }

    public replaceTuple(slotIndex: number, tupleBuffer: Buffer): number {
        if (slotIndex >= this._slots.length) return this.addTuple(tupleBuffer);

        const tupleLength: number = tupleBuffer.length;

        if (this._slots[slotIndex].length < tupleLength) {
            this.deleteTuple(slotIndex);
            return this.addTuple(tupleBuffer);
        }

        const tupleOffset = this._slots[slotIndex].offset;
        tupleBuffer.copy(this.data, tupleOffset, 0, tupleLength);

        if (this._slots[slotIndex].isDeleted)
            this._deletedSlots.splice(
                this._deletedSlots.findIndex((slot) => slot.id === slotIndex),
                1,
            );

        this._slots[slotIndex] = {
            offset: tupleOffset,
            length: tupleLength,
            isDeleted: false,
        };

        return slotIndex;
    }

    public addTuple(tupleBuffer: Buffer): number {
        const tupleLength = tupleBuffer.length;

        if (this._deletedSlots.length > 0) {
            const deletedSlot = this._deletedSlots.find(
                (slot) => slot.size >= tupleLength,
            );

            return this.replaceTuple(deletedSlot!.id, tupleBuffer);
        }

        const currentSlotArrayEnd =
            HEADER_SIZE + this._header.itemsCount * SLOT_SIZE;
        const requiredSpace = tupleLength + SLOT_SIZE;

        if (this._header.freeSpace - currentSlotArrayEnd < requiredSpace) {
            return -1;
        }

        const newTupleOffset = this._header.freeSpace - tupleLength;

        tupleBuffer.copy(this.data, newTupleOffset, 0, tupleLength);

        this._slots.push({
            offset: newTupleOffset,
            length: tupleLength,
            isDeleted: false,
        });
        this._header.itemsCount++;
        this._header.freeSpace = newTupleOffset;

        return this._slots.length - 1;
    }

    public getTuple(slotIndex: number): Buffer | null {
        if (slotIndex >= this._slots.length) return null;
        if (this._slots[slotIndex].isDeleted) return null;

        const tupleOffset = this._slots[slotIndex].offset;
        const tupleLength = this._slots[slotIndex].length;

        return this.data.subarray(tupleOffset, tupleOffset + tupleLength);
    }
}
