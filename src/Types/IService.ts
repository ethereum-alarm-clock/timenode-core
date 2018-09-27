export interface IService {
    api: string,
    field: string,
    morph?: (value: any) => Number;
}

export interface IServices {
  [ index: string ]: IService[];
}