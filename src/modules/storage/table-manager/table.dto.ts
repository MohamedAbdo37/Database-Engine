import { Datatype } from '../dto/datatype.dto.js';

export class Table {
    private _data: Datatype<any>[][];

    public get data(): Datatype<any>[][] {
        return this._data;
    }
    public set data(value: Datatype<any>[][]) {
        this._data = value;
    }

    constructor() {}
}
