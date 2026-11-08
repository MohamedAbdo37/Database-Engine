import { mkdir, readFile, stat, writeFile } from 'fs/promises';
import { IOException } from '../exceptions/io-exception.js';
import { CatalogSchema, DBObjects } from '../dto/catalogSchema.dto.js';
import {
    closeSync,
    existsSync,
    fstatSync,
    openSync,
    readSync,
    writeSync,
} from 'fs';
import { Page, PAGE_SIZE, TablePage } from '../dto/page.dto.js';
import { Injectable } from '@nestjs/common';
import { PageType } from '../page-manager/page-manager.js';

const DATA_FOLDER = './src/data';

@Injectable()
export class FileManager {
    private fileDescriptor: number | null = null;

    private async saveObjectToFile(
        path: string,
        obj: DBObjects,
    ): Promise<void> {
        const jsonData = JSON.stringify(obj, null, 2);
        const bytes = new TextEncoder().encode(jsonData);
        await writeFile(path, bytes).catch((error: IOException) => {
            throw new IOException(
                `Failed to write object to file ${path}: ${error instanceof Error ? error.message : String(error)}`,
            );
        });
    }

    private async createFolder(folderPath: string): Promise<void> {
        try {
            await mkdir(folderPath, { recursive: true });
            console.log(`Folder ${folderPath} created successfully.`);
        } catch (error) {
            throw new IOException(
                `Failed to create folder ${folderPath}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    private async createCatalogSchemaFile(
        schema: CatalogSchema,
    ): Promise<void> {
        const catalogFilePath = `./src/data/catalog/${schema.tableName}.dat`;
        await this.saveObjectToFile(catalogFilePath, schema);
    }

    async initializeDataFolder(): Promise<void> {
        await this.createFolder(DATA_FOLDER);
        await Promise.all([
            this.createFolder(`${DATA_FOLDER}/catalog`),
            this.createFolder(`${DATA_FOLDER}/table`),
            this.createFolder(`${DATA_FOLDER}/index`),
        ]);
    }

    public async createTableDateFiles(schema: CatalogSchema): Promise<void> {
        const dataFilePath = `./src/data/table/${schema.tableName}.dat`;
        if (existsSync(dataFilePath)) {
            throw new IOException(`Data file ${dataFilePath} already exists.`);
        }
        await writeFile(dataFilePath, Buffer.alloc(0)).catch(
            (error: IOException) => {
                throw new IOException(
                    `Failed to create data file ${dataFilePath}: ${error instanceof Error ? error.message : String(error)}`,
                );
            },
        );

        this.createCatalogSchemaFile(schema).catch((error: IOException) => {
            throw new IOException(
                `Failed to create catalog schema file for table ${schema.tableName}: ${error instanceof Error ? error.message : String(error)}`,
            );
        });
    }

    async readCatalogSchema(filePath: string): Promise<CatalogSchema> {
        const bytes = await readFile(filePath);
        const jsonData = new TextDecoder().decode(bytes);
        return JSON.parse(jsonData) as CatalogSchema;
    }

    public async openFile(filePath: string): Promise<void> {
        if (!existsSync(filePath)) {
            writeFile(filePath, Buffer.alloc(0));
        }

        this.fileDescriptor = openSync(filePath, 'r+');
    }

    public async closeFile(): Promise<void> {
        if (this.fileDescriptor !== null) {
            closeSync(this.fileDescriptor);
            this.fileDescriptor = null;
        }
    }

    public async writePage(page: Page): Promise<void> {
        if (this.fileDescriptor === null)
            throw new IOException('File is not open for writing.');

        const buffer = await page.serialize();
        const offset = page.getPageId() * PAGE_SIZE;

        writeSync(this.fileDescriptor, buffer, 0, PAGE_SIZE, offset);
    }

    public async readPage(pageId: number, type: PageType): Promise<Page> {
        if (this.fileDescriptor === null)
            throw new IOException('File is not open for reading.');

        const offset = pageId * PAGE_SIZE;
        const stat = fstatSync(this.fileDescriptor);
        if (offset >= stat.size) {
            throw new IOException(
                `Page with ID ${pageId} does not exist in the file.`,
            );
        }
        const buffer = Buffer.alloc(PAGE_SIZE);

        readSync(this.fileDescriptor, buffer, 0, PAGE_SIZE, offset);

        if (type === PageType.TABLE) {
            return new TablePage(pageId).deserialize(buffer);
        }

        return new TablePage(pageId).deserialize(buffer);
    }
}
