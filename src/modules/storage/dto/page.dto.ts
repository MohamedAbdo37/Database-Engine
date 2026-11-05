import { IOException } from '../exceptions/io-exception.js';

interface PageSlot {
    offset: number;
    length: number;
    isDeleted: boolean;
}

interface PageHeader {
    freeSpace: number; // 4KB
    itemsCount: number;
}

export const PAGE_SIZE = 4096; // 4KB

export class Page {
    private _pageId: number;

    private _header: PageHeader;

    private _slots: PageSlot[];

    private _data: Buffer;

    private _deletedSlots: { id: number; size: number }[] = [];

    constructor(pageId: number) {
        this._pageId = pageId;
        this._header = {
            freeSpace: PAGE_SIZE,
            itemsCount: 0,
        };
        this._data = Buffer.alloc(PAGE_SIZE);
        this._slots = [];
    }

    public get pageId(): number {
        return this._pageId;
    }
    public get slots(): PageSlot[] {
        return this._slots;
    }
    public get data(): Buffer {
        return this._data;
    }

    public serialize(): Buffer {
        const buffer = Buffer.alloc(PAGE_SIZE);

        buffer.writeUInt32LE(this._pageId, 0);
        buffer.writeUInt32LE(this._header.freeSpace, 4);
        buffer.writeUInt32LE(this._header.itemsCount, 8);

        for (let i = 0; i < this._slots.length; i++) {
            const slot = this._slots[i];
            const slotOffset = 12 + i * 9;
            buffer.writeUInt32LE(slot.offset, slotOffset);
            buffer.writeUint32LE(slot.length, slotOffset + 4);
            buffer.writeUInt8(slot.isDeleted ? 1 : 0, slotOffset + 8);
        }

        this._data.copy(
            buffer,
            this._header.freeSpace,
            this._header.freeSpace,
            this._data.length,
        );

        return buffer;
    }

    public static deserialize(buffer: Buffer): Page {
        const pageId = buffer.readUInt32LE(0);
        const page = new Page(pageId);

        page._header = {
            freeSpace: buffer.readUInt32LE(4),
            itemsCount: buffer.readUInt32LE(8),
        };

        const slots: PageSlot[] = [];
        for (let i = 0; i < page._header.itemsCount; i++) {
            const slotOffset = 12 + i * 9;
            const offset = buffer.readUInt32LE(slotOffset);
            const length = buffer.readUInt32LE(slotOffset + 4);
            const isDeleted = buffer.readUInt8(slotOffset + 8) === 1;

            if (isDeleted) page._deletedSlots.push({ id: i, size: length });

            page._slots.push({ offset, length, isDeleted });
        }

        buffer.copy(
            page._data,
            page._header.freeSpace,
            page._header.freeSpace,
            PAGE_SIZE,
        );

        return page;
    }

    public deleteTuple(slotIndex: number): void {
        this._slots[slotIndex].isDeleted = true;
        this._deletedSlots.push({
            id: slotIndex,
            size: this._slots[slotIndex].length,
        });
    }

    public replaceTuple(slotIndex: number, tupleBuffer: Buffer): boolean {
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

        return true;
    }

    public addTuple(tupleBuffer: Buffer): boolean {
        const tupleLength = tupleBuffer.length;

        if (this._deletedSlots.length > 0) {
            const deletedSlot = this._deletedSlots.find(
                (slot) => slot.size >= tupleLength,
            );

            return this.replaceTuple(deletedSlot!.id, tupleBuffer);
        }

        const currentSlotArrayEnd = 12 + this._header.itemsCount * 9;
        const requiredSpace = tupleLength + 9;

        if (this._header.freeSpace - currentSlotArrayEnd < requiredSpace) {
            return false;
        }

        const newTupleOffset = this._header.freeSpace - tupleLength;

        tupleBuffer.copy(this._data, newTupleOffset, 0, tupleLength);

        this._slots.push({
            offset: newTupleOffset,
            length: tupleLength,
            isDeleted: false,
        });
        this._header.itemsCount++;
        this._header.freeSpace = newTupleOffset;

        return true;
    }

    public getTuple(slotIndex: number): Buffer | null {
        if (slotIndex >= this._slots.length) return null;
        if (this._slots[slotIndex].isDeleted) return null;

        const tupleOffset = this._slots[slotIndex].offset;
        const tupleLength = this._slots[slotIndex].length;

        return this._data.subarray(tupleOffset, tupleOffset + tupleLength);
    }
}
