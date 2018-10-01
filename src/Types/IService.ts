export interface IService {
    api: string;
    field: string;
    morph?(value: any): number;
}

export interface IServices {
  [ index: string ]: IService[];
}