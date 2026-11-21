import { FileManager } from '../file-manager/file-manager.js';
import { IndexManager } from './index-manager.js';
import { BTreeNodeKind } from './indexing/b-tree.class.js';
import { BTreeInternalNode } from './indexing/BTreeInternalNode.js';
import { BTreeLeafNode } from './indexing/BTreeLeafNode.js';

const mockFileManager = {
    createIndexFile: vi.fn(),
    deleteIndexFile: vi.fn(),
} as any as FileManager & {
    createIndexFile: (tableName: string, index: any) => Promise<void>;
    deleteIndexFile: (tableName: string) => Promise<void>;
};
describe('IndexManager', () => {
    it('should be defined', () => {
        expect(new IndexManager(mockFileManager)).toBeDefined();
    });
});

describe('BTreInternalNode', () => {
    it('should be defined', () => {
        const node = new BTreeInternalNode<number>(3);
        expect(node).toBeDefined();
        expect(node['order']).toBe(3);
        expect(node.kind).toBe(BTreeNodeKind.INTERNAL);
        expect(node.parent).toBeNull();
    });

    it('should return correct max and min occupancy', () => {
        const node = new BTreeInternalNode<number>(4);
        const childNode = new BTreeInternalNode<number>(4);
        expect(node['maxKeys']).toBe(3);
        expect(node.minKeys).toBe(1);
        expect(childNode['maxKeys']).toBe(3);
        expect(childNode.minKeys).toBe(1);
    });

    it('should return the right child index for a given key', () => {
        const node = new BTreeInternalNode<number>(4);
        node['_keys'] = [10, 20, 30];
        const compare = (a: number, b: number) => a - b;

        expect(node['findChildIndex'](5, compare)).toBe(0);
        expect(node['findChildIndex'](15, compare)).toBe(1);
        expect(node['findChildIndex'](25, compare)).toBe(2);
        expect(node['findChildIndex'](35, compare)).toBe(3);
    });

    it('should the number of keys in the node to be number of children - 1', () => {
        const node = new BTreeInternalNode<number>(4);
        const child1 = new BTreeInternalNode<number>(4);
        const child2 = new BTreeInternalNode<number>(4);
        const child3 = new BTreeInternalNode<number>(4);
        node['_children'] = [child1, child2, child3];
        node['_keys'] = [10, 20];

        expect(node.keyCount).toBe(node.children.length - 1);
    });

    it('should return isOverflowed and isUnderFlow correctly', () => {
        const node = new BTreeInternalNode<number>(4);
        node['_keys'] = [10, 20, 30, 40];

        expect(node.isOverflowed()).toBe(true);
        expect(node.isUnderFlow()).toBe(false);

        node['_keys'] = [10];
        expect(node.isOverflowed()).toBe(false);
        expect(node.isUnderFlow()).toBe(false);

        node['_keys'] = [];
        expect(node.isOverflowed()).toBe(false);
        expect(node.isUnderFlow()).toBe(true);
    });

    it('should return the correct child node for a given index', () => {
        const node = new BTreeInternalNode<number>(4);
        const child1 = new BTreeInternalNode<number>(4);
        const child2 = new BTreeInternalNode<number>(4);
        node['_children'] = [child1, child2];

        expect(node['getChild'](0)).toBe(child1);
        expect(node['getChild'](1)).toBe(child2);
        expect(node['getChild'](2)).toBeNull();
        expect(node['getChild'](-1)).toBeNull();
    });

    it('should each child to have the correct parent reference', () => {
        const node = new BTreeInternalNode<number>(4);
        const child1 = new BTreeInternalNode<number>(4);
        const child2 = new BTreeInternalNode<number>(4);

        child1.parent = node;
        child1['_keys'] = [0, 1];
        node['_children'] = [child1];
        child2['_keys'] = [4, 5, 6];

        node['_keys'] = [0];
        node['insertRightChildAfter'](child1, child2);

        expect(child1.parent).toBe(node);
        expect(child2.parent).toBe(node);
    });
});

describe('BTreeLeafNode', () => {
    it('should be defined', () => {
        const leafNode = new BTreeLeafNode<number>(5);
        expect(leafNode).toBeDefined();
        expect(leafNode['order']).toBe(5);
        expect(leafNode.kind).toBe(BTreeNodeKind.LEAF);
        expect(leafNode.parent).toBeNull();
    });

    it('should return correct max and min occupancy', () => {
        const leafNode = new BTreeLeafNode<number>(5);
        expect(leafNode['maxKeys']).toBe(4);
        expect(leafNode.minKeys).toBe(2);
    });

    it('should return isOverflowed and isUnderFlow correctly', () => {
        const leafNode = new BTreeLeafNode<number>(4);
        const compare = (a: number, b: number) => a - b;

        expect(leafNode.insert(10, { pageId: 1, slotNumber: 1 }, compare)).toBe(
            true,
        );

        expect(leafNode.isOverflowed()).toBe(false);
        expect(leafNode.isUnderFlow()).toBe(true);

        expect(leafNode.insert(11, { pageId: 1, slotNumber: 2 }, compare)).toBe(
            true,
        );

        expect(leafNode.insert(12, { pageId: 1, slotNumber: 3 }, compare)).toBe(
            true,
        );

        expect(leafNode.isOverflowed()).toBe(false);
        expect(leafNode.isUnderFlow()).toBe(false);

        expect(leafNode.insert(13, { pageId: 1, slotNumber: 4 }, compare)).toBe(
            true,
        );

        expect(leafNode.isOverflowed()).toBe(true);
        expect(leafNode.isUnderFlow()).toBe(false);
    });

    it('should insert and find entries correctly', () => {
        const leafNode = new BTreeLeafNode<number>(5);
        const compare = (a: number, b: number) => a - b;

        expect(leafNode.insert(10, { pageId: 1, slotNumber: 1 }, compare)).toBe(
            true,
        );

        expect(leafNode.insert(11, { pageId: 1, slotNumber: 2 }, compare)).toBe(
            true,
        );

        expect(leafNode.insert(12, { pageId: 1, slotNumber: 4 }, compare)).toBe(
            true,
        );

        expect(leafNode.keyCount).toBe(3);

        const entry = leafNode.findEntry(10, compare);
        expect(entry).not.toBeNull();
        expect(entry?.rids.length).toBe(1);
        expect(entry?.rids[0]).toEqual({ pageId: 1, slotNumber: 1 });

        expect(leafNode.findEntry(20, compare)).toBeNull();
    });

    it('should duplicate keys append RIDs rather than create another entry.', () => {
        const leafNode = new BTreeLeafNode<number>(5);
        const compare = (a: number, b: number) => a - b;

        expect(leafNode.insert(10, { pageId: 1, slotNumber: 1 }, compare)).toBe(
            true,
        );

        expect(leafNode.insert(10, { pageId: 1, slotNumber: 2 }, compare)).toBe(
            true,
        );

        const entry = leafNode.findEntry(10, compare);
        expect(entry).not.toBeNull();
        expect(entry?.rids.length).toBe(2);
        expect(entry?.rids[0]).toEqual({ pageId: 1, slotNumber: 1 });
        expect(entry?.rids[1]).toEqual({ pageId: 1, slotNumber: 2 });
    });

    it('should delete one RID preserves the other RIDs.', () => {
        const leafNode = new BTreeLeafNode<number>(5);
        const compare = (a: number, b: number) => a - b;

        expect(leafNode.insert(10, { pageId: 1, slotNumber: 1 }, compare)).toBe(
            true,
        );
        expect(leafNode.insert(10, { pageId: 1, slotNumber: 2 }, compare)).toBe(
            true,
        );

        expect(leafNode.insert(10, { pageId: 1, slotNumber: 3 }, compare)).toBe(
            true,
        );

        leafNode.delete(10, { pageId: 1, slotNumber: 2 }, compare);

        const entry = leafNode.findEntry(10, compare);
        expect(entry).not.toBeNull();
        expect(entry?.rids.length).toBe(2);
        expect(entry?.rids[0]).toEqual({ pageId: 1, slotNumber: 1 });
        expect(entry?.rids[1]).toEqual({ pageId: 1, slotNumber: 3 });
    });

    it('should delete the entry if all RIDs are deleted.', () => {
        const leafNode = new BTreeLeafNode<number>(5);
        const compare = (a: number, b: number) => a - b;

        expect(leafNode.insert(10, { pageId: 1, slotNumber: 1 }, compare)).toBe(
            true,
        );
        expect(leafNode.insert(10, { pageId: 1, slotNumber: 2 }, compare)).toBe(
            true,
        );

        leafNode.delete(10, { pageId: 1, slotNumber: 1 }, compare);
        leafNode.delete(10, { pageId: 1, slotNumber: 2 }, compare);

        const entry = leafNode.findEntry(10, compare);
        expect(entry).toBeNull();
    });
});
