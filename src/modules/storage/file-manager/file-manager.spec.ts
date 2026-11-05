import { vi } from 'vitest';

import { Page } from '../dto/page.dto.js';
import { FileManager } from './file-manager.js';

describe('FileManager', () => {
    it('should be defined', () => {
        expect(new FileManager()).toBeDefined();
    });
});

describe('Page Class', () => {
    it('should be defined', () => {
        expect(new Page(0)).toBeDefined();
    });

    it('should add a tuple correctly', () => {
        const page = new Page(1);
        const tupleBuffer = Buffer.from('test data');
        const result = page.addTuple(tupleBuffer);

        expect(result).toBe(true);
        expect(page.slots.length).toBe(1);
        expect(page.slots[0].length).toBe(tupleBuffer.length);
        expect(
            page.data
                .subarray(
                    page.slots[0].offset,
                    page.slots[0].offset + tupleBuffer.length,
                )
                .equals(tupleBuffer),
        ).toBe(true);
    });

    it('should get a tuple correctly', () => {
        const page = new Page(1);
        const tupleBuffer = Buffer.from('test data');
        page.addTuple(tupleBuffer);
        const retrievedTuple = page.getTuple(0);

        expect(retrievedTuple).not.toBeNull();
        expect(retrievedTuple!.equals(tupleBuffer)).toBe(true);
    });

    it('should delete a tuple correctly', () => {
        const page = new Page(1);
        const tupleBuffer = Buffer.from('test data');
        page.addTuple(tupleBuffer);
        page.deleteTuple(0);

        expect(page.slots[0].isDeleted).toBe(true);
    });

    it('should return null for a non-existent tuple', () => {
        const page = new Page(1);
        const retrievedTuple = page.getTuple(0);

        expect(retrievedTuple).toBeNull();
        expect(page.slots.length).toBe(0);
    });

    it('should return null for a deleted tuple', () => {
        const page = new Page(1);
        const tupleBuffer = Buffer.from('test data');
        page.addTuple(tupleBuffer);
        page.deleteTuple(0);
        const retrievedTuple = page.getTuple(0);

        expect(retrievedTuple).toBeNull();
        expect(page.slots[0].isDeleted).toBe(true);
    });

    it('should replace a tuple correctly', () => {
        const page = new Page(1);
        const tupleBuffer1 = Buffer.from('test data 1');
        const tupleBuffer2 = Buffer.from('test data 2');
        page.addTuple(tupleBuffer1);
        const addTupleSpy = vi.spyOn(page, 'addTuple');
        const result = page.replaceTuple(0, tupleBuffer2);

        expect(result).toBe(true);
        expect(page.slots.length).toBe(1);
        expect(page.slots[0].length).toBe(tupleBuffer2.length);
        expect(
            page.data
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
        const page = new Page(1);
        const tupleBuffer = Buffer.from('test data');
        const addTupleSpy = vi.spyOn(page, 'addTuple');
        const result = page.replaceTuple(0, tupleBuffer);

        expect(result).toBe(true);
        expect(page.slots.length).toBe(1);
        expect(page.slots[0].length).toBe(tupleBuffer.length);
        expect(
            page.data
                .subarray(
                    page.slots[0].offset,
                    page.slots[0].offset + tupleBuffer.length,
                )
                .equals(tupleBuffer),
        ).toBe(true);

        expect(addTupleSpy).toHaveBeenCalledOnce();
    });

    it('should replace a deleted tuple correctly when use addTuple', () => {
        const page = new Page(1);
        const tupleBuffer1 = Buffer.from('test data 1');
        const tupleBuffer2 = Buffer.from('test data 2');

        page.addTuple(tupleBuffer1);
        page.deleteTuple(0);

        expect(page.slots).toHaveLength(1);
        expect(page.slots[0].isDeleted).toBe(true);
        expect(page.slots[0].length).toBe(tupleBuffer1.length);

        const result = page.addTuple(tupleBuffer2);

        expect(result).toBe(true);
        expect(page.slots).toHaveLength(1);
        expect(page.slots[0].length).toBe(tupleBuffer2.length);
        expect(
            page.data
                .subarray(
                    page.slots[0].offset,
                    page.slots[0].offset + tupleBuffer2.length,
                )
                .equals(tupleBuffer2),
        ).toBe(true);

        expect(page.slots[0].isDeleted).toBe(false);
    });

    it('should serialize and deserialize correctly', () => {
        const page = new Page(1);
        const tupleBuffer = Buffer.from('test data');
        page.addTuple(tupleBuffer);
        const serialized = page.serialize();
        const deserializedPage = Page.deserialize(serialized);

        expect(deserializedPage).toStrictEqual(page);
        expect(deserializedPage.pageId).toBe(page.pageId);
        expect(deserializedPage.slots.length).toBe(page.slots.length);
        expect(deserializedPage.data.equals(page.data)).toBe(true);
    });
});
