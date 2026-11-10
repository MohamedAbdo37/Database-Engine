import { Injectable, NotFoundException } from '@nestjs/common';
import { Datatype } from '../dto/datatype.dto.js';
import { RID } from '../dto/rid.dto.js';
import { PageManager } from '../page-manager/page-manager.js';

@Injectable()
export class RecordManager {
    constructor(private readonly pageManger: PageManager) {}

    private async getRecordBuffer(
        tableName: string,
        recordId: RID,
    ): Promise<Buffer | null> {
        const recordBuffer = await this.pageManger.getRecord(
            tableName,
            recordId,
        );
        if (!recordBuffer) {
            return null;
        }

        return recordBuffer;
    }

    private async *pageStreamerGenerator(
        initialPageId: number,
        tableName: string,
    ): AsyncGenerator<Buffer[], void, unknown> {
        let currentPageId = initialPageId;

        let fetchPage: Promise<Buffer[]> = this.pageManger.getPageRecords(
            tableName,
            currentPageId,
        );

        while (true) {
            currentPageId++;

            const records = await fetchPage;

            if (records.length === 0) {
                break;
            }

            fetchPage = this.pageManger.getPageRecords(
                tableName,
                currentPageId,
            );

            yield records;
        }
    }

    private serializeRecord(record: Datatype<any>[]): Buffer {
        const totalSize = record.reduce(
            (sum, datatype) => sum + datatype.size,
            0,
        );

        const recordBuffer = Buffer.alloc(totalSize);

        let offset = 0;
        for (const field of record) {
            recordBuffer.write(
                field.serialize().toString('hex'),
                offset,
                field.size,
                'hex',
            );

            offset += field.size;
        }

        return recordBuffer;
    }

    private deserializeRecord(
        recordBuffer: Buffer,
        recordSchema: Datatype<any>[],
    ): Datatype<any>[] {
        const deserializedRecord: Datatype<any>[] = [];
        let offset = 0;

        for (const field of recordSchema) {
            const fieldCopy = Object.assign(
                Object.create(Object.getPrototypeOf(field)),
                field,
            ) as Datatype<any>;

            deserializedRecord.push(
                fieldCopy.deserialize(
                    recordBuffer.subarray(offset, offset + field.size),
                ),
            );

            offset += field.size;
        }

        return deserializedRecord;
    }

    public async insertRecord(
        tableName: string,
        record: Datatype<any>[],
    ): Promise<RID> {
        const rid: RID = await this.pageManger.addRecord(
            tableName,
            this.serializeRecord(record),
        );
        return rid;
    }

    public async updateRecord(
        tableName: string,
        recordId: RID,
        updatedRecord: Datatype<any>[],
    ): Promise<RID> {
        const recordBuffer = await this.getRecordBuffer(tableName, recordId);
        if (recordBuffer === null) {
            throw new NotFoundException(
                `Record with ID ${recordId.pageId}-${recordId.slotNumber} not found in table ${tableName}.`,
            );
        }

        const updatedRecordBuffer = this.serializeRecord(updatedRecord);
        const rid: RID = await this.pageManger.updateRecord(
            tableName,
            recordId,
            updatedRecordBuffer,
        );

        return rid;
    }

    public async retrieveRecord(
        tableName: string,
        recordId: RID,
        record: Datatype<any>[],
    ): Promise<Datatype<any>[] | null> {
        const recordBuffer = await this.getRecordBuffer(tableName, recordId);

        if (!recordBuffer) {
            return null;
        }

        const deserializedRecord = this.deserializeRecord(recordBuffer, record);

        return deserializedRecord;
    }

    public async retrieveMultipleRecords(
        tableName: string,
        recordIds: RID[],
        recordSchema: Datatype<any>[],
    ): Promise<Datatype<any>[][]> {
        const records: Datatype<any>[][] = [];

        const sortedRecordIds = recordIds.sort((a, b) => {
            if (a.pageId === b.pageId) {
                return a.slotNumber - b.slotNumber;
            }
            return a.pageId - b.pageId;
        });

        for (const recordId of sortedRecordIds) {
            const recordBuffer = await this.getRecordBuffer(
                tableName,
                recordId,
            );

            if (!recordBuffer) {
                throw new NotFoundException(
                    `Record with ID ${recordId.pageId}-${recordId.slotNumber} not found in table ${tableName}.`,
                );
            }

            const deserializedRecord = this.deserializeRecord(
                recordBuffer,
                recordSchema,
            );
            records.push(deserializedRecord);
        }

        return records;
    }

    public async deleteRecord(tableName: string, recordId: RID): Promise<void> {
        await this.pageManger.deleteRecord(tableName, recordId);
    }

    public async scanRecords(
        tableName: string,
        schema: Datatype<any>[],
    ): Promise<Datatype<any>[][]> {
        const records: Datatype<any>[][] = [];

        for await (const pageRecords of this.pageStreamerGenerator(
            1,
            tableName,
        )) {
            for (const recordBuffer of pageRecords) {
                const deserializedRecord = this.deserializeRecord(
                    recordBuffer,
                    schema,
                );
                records.push(deserializedRecord);
            }
        }

        return records;
    }
}
