export const assert = (cond: any) => {
    if (!cond) throw new Error(cond + ' fails');
}