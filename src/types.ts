interface IBlock {
	number: number;
	timestamp: number;
}

type IntervalID = number;

// TODO this is only temporary
interface ITxRequest {
	refreshData: Function;
}
  
export {
	IBlock,
	IntervalID,
	ITxRequest,
}
  