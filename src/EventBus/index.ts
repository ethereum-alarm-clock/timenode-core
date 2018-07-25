import * as EventEmitter from 'events';

interface IListener {
  onEvent(a: string): any;
}

interface ISubscribers {
  eventTopic: string[];
}

export default class EventBus {
  public subscribers: ISubscribers;
  public eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter();
  }

  public register(eventTopic: string): boolean {
    this.eventEmitter.on(eventTopic, () => {
      this.pushEvents(eventTopic);
    });
    return true;
  }

  public subscribe(eventTopic: string, listener: any): boolean {
    this.subscribers[eventTopic].push(listener);
    return true;
  }

  private pushEvents(eventTopic: string) {
    this.subscribers[eventTopic].forEach((element: IListener) => {
      element.onEvent(eventTopic);
    });
  }
}
