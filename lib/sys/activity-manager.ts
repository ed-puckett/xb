import {
    SerialDataSource,
} from 'lib/sys/serial-data-source';


export type StopState = {
    activity: Activity,
}

export type ObjectWithStopMethod = {
    stop: () => any,
}

export class Activity {
    #stop_states = new SerialDataSource<StopState>();
    get stop_states () { return this.#stop_states; }

    #target:         undefined|ObjectWithStopMethod;
    #multiple_stops: boolean;
    #stop_count:     number;

    get target         (){ return this.#target; }
    get multiple_stops (){ return this.#multiple_stops; }
    get stop_count     (){ return this.#stop_count; }
    get stopped        (){ return (!this.#multiple_stops && this.#stop_count > 0); }


    /** create a new object representing an Activity,
     *  i.e., a something that is running and can be stopped
     *  @param {ObjectWithStopMethod} target the underlying object that may be stopped
     *  @param {Boolean} multiple_stops whether or not target's stop method may be called multiple times
     */
    constructor( target?:        ObjectWithStopMethod,
                 multiple_stops: boolean = false ) {
        this.#target         = target;
        this.#multiple_stops = multiple_stops;
        this.#stop_count     = 0;
    }

    /** this method is for use only by ActivityManager.  ActivityManager is also
     * an Activity, but the ActivityManager constructor cannot call super(this)
     * -- 'super' must be called before accessing 'this' -- so the ActivityManager
     * constructor calls this method after the super() call to set its own target
     * (in its role as an Activty) after calling super().
     */
    protected _set_target(target: ObjectWithStopMethod) {
        if (this.target) {
            throw new Error('Activity.__set_target called but this.target is already set');
        } else {
            this.#target = target;
        }
    }

    /** stop this activity.
     * No action is performed if the activity has already been stopped.
     * (Note that an activity with multiple_stops = true will never become
     * stopped.)  Otherwise, if not stopped, then this.target is (attempted
     * to be) stopped, this.stop_count is incremented, and an event is
     * dispatched through this.stopped_states.
     */
    stop(): void {
        if (!this.stopped) {
            try {
                this.target?.stop();
            } catch (error) {
                console.error('error while stopping', this, error);
            } finally {
                this.#stop_count++;
                this.stop_states.dispatch({
                    activity: this,
                });
            }
        }
    }
}


/** ActivityManager can be used hierarchically, i.e., an ActivityManager can be
 * added to different ActivityManager as an Activity,
 */
export class ActivityManager extends Activity {
    #activity_objects: Array<Activity>;  // managed Activity objects
    #stopped:          boolean;          // true iff !this.multiple_stops and this.stop() has been called, false otherwise

    constructor(multiple_stops: boolean = false) {
        super(undefined, multiple_stops);
        super._set_target(this);  // cannot call super(this), so do it this way
        this.#activity_objects = [];
        this.#stopped          = false;
    }

    /** add an Activity to this.#activity_objects
     *  @param {Activity} activity
     * If activity is already present, then do nothing.
     */
    add_activity(activity: Activity): void {
        if (!(activity instanceof Activity)) {
            throw new Error('activity must be an instance of Activity');
        }
        if (!this.#activity_objects.includes(activity)) {
            this.#activity_objects.push(activity);
        }
    }

    /** remove an Activity object from this.#activity_objects
     *  @param {Activity} activity
     *  @return {Boolean} found and removed?
     */
    remove_activity(activity: Activity): boolean {
        if (!(activity instanceof Activity)) {
            throw new Error('activity must be an instance of Activity');
        }
        const index = this.#activity_objects.indexOf(activity);
        if (index === -1) {
            return false;
        } else {
            this.#activity_objects.splice(index, 1);
            return true;
        }
    }

    /** manage the given Activity object.
     *  @param {Activity} activity
     *  @param {Function|undefined} stop_action to be called when activity stopped
     * First, perform this.add_activity(activity).  Later, if a stop_states
     * event for the activity occurs, call stop_action (if given) and finally
     * call this.remove_activity(activity).  Note that stop_action will be
     * called (if given) even if the activity was already removed
     * (which can occur if this manager object was stopped or if
     * this.remove_activity(activity) was already called).
     */
    manage_activity(activity: Activity, stop_action?: () => void): void {
        if (!(activity instanceof Activity)) {
            throw new Error('activity must be an instance of Activity');
        }
        if (!['undefined', 'function'].includes(typeof stop_action)) {
            throw new Error('stop_action must be undefined or a function');
        }
        this.add_activity(activity);
        const subscription = activity.stop_states.subscribe((state: StopState) => {
            subscription.unsubscribe();  // one-shot
            stop_action?.();
            this.remove_activity(activity);
        });
    }

    /** Stop and remove any activity objects from this.#activity_objects,
     * then stop this manager object by calling super.stop().
     */
    stop(): void {
        if (this.#activity_objects.length > 0) {
            while (this.#activity_objects.length > 0) {
                const activity: undefined|Activity = this.#activity_objects.pop();
                activity?.stop();  // note: typescript cannot tell here that activity is not undefined
            }
            super.stop();
        }
    }
}
