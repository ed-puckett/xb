import {
    Subscribable,
} from './subscribable.js';


export class Stoppable {
    /** create a new Stoppable object
     *  @param {Object} target object that may be stopped
     *  @param {Function} stopper function that takes target and stops it; default: (target) => target.stop()
     *  @param {Boolean} multiple_stops whether or not target's stop method may be called multiple times
     */
    constructor(target, stopper=null, multiple_stops=false) {
        if (target === null || typeof target === 'undefined') {
            throw new Error('target must not be null or undefined');
        }
        stopper ??= (target) => target.stop();  // default
        if (typeof stopper !== 'function') {
            throw new Error('stopper must be a function taking target as a parameter');
        }
        Object.defineProperties(this, {
            target: {
                value: target,
                enumerable: true,
            },
            stopper: {
                value: stopper,
                enumerable: true,
            },
            multiple_stops: {
                value: multiple_stops,
                enumerable: true,
            },
        });
        this.#stop_count = 0;
    }
    #stop_count;

    get stop_count (){ return this.#stop_count; }

    get stopped (){ return this.#stop_count > 0; }

    /** @return {Boolean} true iff stopper called on target,
     */
    stop() {
        if (!this.multiple_stops && this.stopped) {
            return false;  // indicate: stop not called
        } else {
            this.stopper(this.target);
            this.#stop_count++;
            return true;  // indicate: stop called
        }
    }
}

export class StoppableObjectsManager {
    constructor() {
        this.#stoppable_objects = [];
        this.#stopped           = false;
        this.#stop_states       = new Subscribable();
    }
    #stoppable_objects;  // array of Stoppable objects
    #stopped;            // true iff this.stop() has been called, false otherwise
    #stop_states;        // Subscribable to receive stop state updates

    get stopped     (){ return this.#stopped; }
    get stop_states (){ return this.#stop_states; }

    /** add a Stoppable to this.#stoppable_objects
     *  @param {Stoppable} stoppable
     */
    add_stoppable(stoppable) {
        if (!(stoppable instanceof Stoppable)) {
            throw new Error('stoppable must be an instance of Stoppable');
        }
        this.#stoppable_objects.push(stoppable);
    }

    /** remove a Stoppable object from this.#stoppable_objects
     *  @param {Stoppable} stoppable
     *  @return {Boolean} found and removed?
     */
    remove_stoppable(stoppable) {
        const index = this.#stoppable_objects.indexOf(stoppable);
        if (index !== -1) {
            this.#stoppable_objects.splice(index, 1);
        }
    }

    /** stop and remove all stoppables from this.#stoppable_objects.
     *  dispatch change to this.stop_states.
     */
    stop() {
        const changed = !this.#stopped;
        this.#stopped = true;
        while (this.#stoppable_objects.length > 0) {
            const stoppable = this.#stoppable_objects.pop();
            try {
                stoppable.stop();
            } catch (error) {
                console.warn('error while stopping', stoppable, error);
            }
        }
        if (changed) {
            this.stop_states.dispatch({
                manager: this,
                stopped: this.#stopped,
            });
        }
    }
}
