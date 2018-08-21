enum AbortReason {
  WasCancelled, //0
  AlreadyCalled, //1
  BeforeCallWindow, //2
  AfterCallWindow, //3
  ReservedForClaimer, //4
  InsufficientGas, //5
  TooLowGasPrice //6
}
