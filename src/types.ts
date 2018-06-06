interface Block {
	number: number;
	timestamp: number;
}

type IntervalID = number;

// TODO this is only temporary
interface TxRequest {
	refreshData: Function;
}
  
export {
	Block,
	IntervalID,
	TxRequest,
}
  