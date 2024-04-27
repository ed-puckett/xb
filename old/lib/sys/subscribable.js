import rxjs from '../../lib/sys/rxjs.js';


export class Subscribable extends rxjs.Subject {
    dispatch(event_data) {
        this.next(event_data);
    }
}
