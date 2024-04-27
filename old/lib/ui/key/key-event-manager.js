import {
    KeySpec,
} from './key-spec.js';

import {
    KeyMap,
} from './key-map.js';

import {
    EventListenerManager,
} from '../../sys/event-listener-manager.js';

import {
    beep,
} from '../beep.js';

import {
    Subscribable,
} from '../../sys/subscribable.js';


export class KeyEventManager {
    /** KeyEventManager constructor
     *  @param {EventTarget} event_target the source of events
     *  @param {Function} command_observer function to handle command events
     */
    constructor(event_target, command_observer) {
        if (!(event_target instanceof EventTarget)) {
            throw new Error('event_target must be and instance of EventTarget');
        }
        if (typeof command_observer !== 'function') {
            throw new Error('command_observer must be a function');
        }

        this.#event_listener_manager = new EventListenerManager();

        const commands = new Subscribable();  // emits command_context: { command: string, event: Event, target: Element, key_spec: KeySpec }
        this.#commands_subscription = commands.subscribe(command_observer);
        // note: we do not unsubscribe

        this.#key_map_stack = [];    // stack grows from the front, i.e., the first item is the last pushed
        this.#key_mapper    = null;  // set iff attached

        Object.defineProperties(this, {
            event_target: {
                value:      event_target,
                enumerable: true,
            },
            command_observer: {
                value:      command_observer,
                enumerable: true,
            },
            commands: {
                value:      commands,
                enumerable: true,
            },
        });
    }
    #event_listener_manager;
    #commands_subscription;
    #key_map_stack;
    #key_mapper;   // set iff attached
    #key_handler;  // set iff attached

    reset_key_map_stack() {
        if (this.#key_map_stack.length > 0) {
            this.#key_map_stack.splice(0);  // clear stack
            this.#rebuild();
        }
    }
    push_key_map(key_map) {
        if (!(key_map instanceof KeyMap)) {
            throw new Error('key_map must be an instance of KeyMap');
        }
        if (this.#key_map_stack.indexOf(key_map) !== -1) {
            throw new Error('key_map already exists in stack');
        }
        this.#key_map_stack.unshift(key_map);
        this.#rebuild();
    }
    pop_key_map() {
        const popped_key_map = this.#key_map_stack.shift();
        if (popped_key_map) {
            this.#rebuild();
        }
        return popped_key_map;
    }
    remove_key_map(key_map, remove_subsequent_too=false) {
        const index = this.#key_map_stack.indexOf(key_map);
        if (index === -1) {
            return false;
        } else {
            if (remove_subsequent_too) {
                this.#key_map_stack.splice(0, index+1);  // delete this and newer items
            } else {
                this.#key_map_stack.splice(index, 1);  // delete only this item
            }
            this.#rebuild();
            return true;
        }
    }

    get is_attached (){ return !!this.#key_mapper; }  // this.#key_mapper set iff attached

    /** attach to event_target and start listening for events.
     *  @return {Boolean} true iff successful
     */
    attach() {
        if (this.is_attached) {
            throw new Error('attach() called when already attached');
        }

        // this.#key_mapper is null
        if (this.#key_map_stack.length <= 0) {
            return false;  // indicate: attach failed
        }

        this.#key_mapper = KeyMap.multi_mapper(...this.#key_map_stack);

        const initial_state = this.#key_mapper;
        let state;         // current "location" in key mapper
        let key_sequence;  // current sequence of key_specs that have been seen

        function reset() {
            state = initial_state;
            key_sequence = [];
        }
        reset();

        const blur_handler = reset;  // attached to this.event_target

        const key_handler = (event) => {  // attached to this.event_target
            switch (event.key) {
            case 'Alt':
            case 'AltGraph':
            case 'CapsLock':
            case 'Control':
            case 'Fn':
            case 'FnLock':
            case 'Hyper':
            case 'Meta':
            case 'NumLock':
            case 'ScrollLock':
            case 'Shift':
            case 'Super':
            case 'Symbol':
            case 'SymbolLock':
            case 'OS':  // Firefox quirk
                // modifier key, ignore
                break;

            default: {
                const key_spec = KeySpec.from_keyboard_event(event);
                key_sequence.push(key_spec);
                const mapping_result = state.consume(key_spec);
                if (!mapping_result) {
                    // failed
                    if (state !== initial_state) {
                        // beep only if at least one keypress has already been accepted
                        event.preventDefault();
                        beep();
                    }
                    // if still in initial_state, then no event.preventDefault()
                    reset();
                } else {
                    event.preventDefault();
                    if (typeof mapping_result === 'string') {
                        const command = mapping_result;
                        const command_context = { command, event, target: event.target, key_spec };
                        this.commands.dispatch(command_context);
                        reset();
                    } else {
                        state = mapping_result;
                    }
                }
                break;
            }
            }
        };

        this.#key_handler = key_handler;  // for inject_key_event()

        this.#event_listener_manager.remove_all();  // prepare to re-add below
        const listener_specs = [
            [ this.event_target, 'blur',    blur_handler, { capture: true } ],
            [ this.event_target, 'keydown', key_handler,  { capture: true } ],
        ];
        for (const [ target, type, listener, options ] of listener_specs) {
            this.#event_listener_manager.add(target, type, listener, options);
        }
        this.#event_listener_manager.attach();

        return true;  // indicate: successfully attached
    }

    /** detach from event_target and stop listening for events.
     *  no-op if called when this.#event_listener_manager is already empty.
     */
    detach() {
        this.#event_listener_manager.remove_all();
        this.#key_mapper  = null;
        this.#key_handler = undefined;
    }

    inject_key_event(key_event) {
        this.#key_handler?.(key_event);
    }


    // === INTERNAL ===

    #rebuild() {
        // rebuild the event handlers and state machine.
        const was_attached = this.is_attached;
        this.detach();
        if (was_attached) {
            this.attach();  // will fail if key_map stack is empty
        }
    }
}
