export interface IService {
    api: string,
    field: string,
    morph?: Function
}

export interface IServices {
  [ index: string ]: IService[];
}