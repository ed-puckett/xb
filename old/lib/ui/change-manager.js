import {
    safe_setAttributeNS,
    set_selection_focus,
} from './dom-tools.js';

import {
    Subscribable,
} from '../sys/subscribable.js';


export class ChangeManager {
    /** @param {Node} target,
     *  @param {Object|null|undefined} options: {
     *      neutral_changes_filter?:   Function,  // currently not used
     *      neutral_changes_observer?: Function,
     *  }
     */
    constructor(target, options=null) {
        if (!(target instanceof Node)) {
            throw new Error('target must be an instance of Node');
        }
        options ??= {};
        if (typeof options !== 'object') {
            throw new Error('options must be null, undefined, or an object');
        }

        const {
            neutral_changes_filter,
            neutral_changes_observer,
        } = options;
        if (neutral_changes_filter !== null && typeof neutral_changes_filter !== 'undefined' && typeof neutral_changes_filter !== 'function') {
            throw new Error('neutral_changes_filter must be null, undefined, or a function');
        }
        if (neutral_changes_observer !== null && typeof neutral_changes_observer !== 'undefined' && typeof neutral_changes_observer !== 'function') {
            throw new Error('neutral_changes_observer must be null, undefined, or a function');
        }

        this.#target  = target;
        this.#stack   = [];
        this.#current = -1;
        this.#neutral = undefined;
        this.#inhibit = false;
        this.#mutation_observer = new MutationObserver(this.#mutation_handler.bind(this));

        Object.defineProperties(this, {
            neutral_changes_filter: { // neutral_changes_filter as passed by user
                value: neutral_changes_filter,
                enumerable: true,
            },
            neutral_changes: {  // fires when neutral status changes; emits { neutral, change_manager }
                value: new Subscribable(),
                enumerable: true,
            },
        });

        if (neutral_changes_observer) {
            this.#neutral_changes_subscription = this.neutral_changes.subscribe(neutral_changes_observer);  //!!! never unsubscribed....
        }

        this.#mutation_observer.observe(this.#target, {
            childList:             true,
            subtree:               true,
            attributeFilter:       undefined,  // undefined: track all attributes
            attributeOldValue:     true,       // implies attributes: true
            characterDataOldValue: true,       // implies characterData: true
        });
    }

    get is_connected (){ return !!this.#mutation_observer; }

    disconnect() {
        if (this.#mutation_observer) {
            this.#mutation_observer.disconnect();
            this.#mutation_observer = undefined;
            this.#inhibit = false;
            this.#neutral = undefined;
            this.#current = -1;
            this.#stack   = [];
        }
    }

    is_neutral() { return (this.#neutral === this.#current); }

    set_neutral() {
        this.#neutral = this.#current;
        this.#dispatch_neutral_change_if_needed();
    }

    reset_neutral() {
        this.#neutral = undefined;
        this.#dispatch_neutral_change_if_needed();
    }

    reset(set_neutral_too=false) {
        this.#stack.splice(0);  // clear stack
        this.#current = -1;
        this.#neutral = undefined;
        this.#inhibit = false;

        if (set_neutral_too) {
            this.set_neutral();  // will call this.#dispatch_neutral_change_if_needed();
        } else {
            this.#dispatch_neutral_change_if_needed();
        }
    }

    get can_perform_undo (){ return (this.#current >= 0); }

    perform_undo() {
//console.log('UNDO', this);//!!!
        if (!this.can_perform_undo) {
            return false;
        } else {
            try {
                this.#inhibit = true;  // inhibit adding the following changes to the stack
                const change = this.#stack[this.#current--];
                set_selection_focus(change.focus_node, change.focus_offset);
                for (let i = change.mutations.length; --i >= 0; ) {
                    this.#perform_mutation_reverse(change.mutations[i]);
                }
                this.#dispatch_neutral_change_if_needed();
                return true;  // indicate: success
            } finally {
                // reset on next tick
                queueMicrotask(() => { this.#inhibit = false; });
            }
        }
    }

    get can_perform_redo (){ return (this.#current < this.#stack.length-1); }

    perform_redo() {
//console.log('REDO', this);//!!!
        if (!this.can_perform_redo) {
            return false;
        } else {
            try {
                this.#inhibit = true;  // inhibit adding the following changes to the stack
                const change = this.#stack[++this.#current];
                for (let i = 0; i < change.mutations.length; i++) {
                    this.#perform_mutation_forward(change.mutations[i]);
                }
                this.#dispatch_neutral_change_if_needed();
                return true;  // indicate: success
            } finally {
                // reset on next tick
                queueMicrotask(() => { this.#inhibit = false; });
            }
        }
    }


    // === INTERNAL ===

    static MutationData = class MutationData {
        constructor(mutation, extra_props=null) {
            if (extra_props) {
                Object.assign(this, extra_props);
            }
            Object.defineProperties(this, {
                mutation: {
                    value:      mutation,
                    enumerable: true,
                },
            });
        }
    };

    #target;   // the specified target
    #stack;    // array of { timestamp: Number, mutations: Array<MutationData> }
    #current;  // current position in stack (-1 if no entries)
    #neutral;  // numeric stack index of "neutral" position, undefined if none
    #inhibit;  // inhibit mutation collection (while performing undo/redo)
    #mutation_observer;
    #neutral_changes_subscription;

    #perform_mutation_reverse(mutation_data) {
        if (!(mutation_data instanceof this.constructor.MutationData)) {
            throw new Error('mutation_data must be an instance of ChangeManager.MutationData');
        }

        const { mutation } = mutation_data;
        switch (mutation.type) {
        default: {
            throw new Error(`unknown MutationRecord type: ${mutation.type}`);
        }

        case 'attributes': {
            // note that mutation_data.had_attribute and mutation_data.newValue is set by us in #mutation_handler()
            if ('attributeNamespace' in mutation) {
                if (mutation.had_attribute) {
                    safe_setAttributeNS(mutation.target, mutation.attributeNamespace, mutation.attributeName, mutation.oldValue);
                } else {
                    mutation.target.removeAttributeNS(mutation.attributeNamespace, mutation.attributeName);
                }
            } else{
                if (mutation.had_attribute) {
                    mutation.target.setAttribute(mutation.attributeName, mutation.oldValue);
                } else {
                    mutation.target.removeAttribute(mutation.attributeName);
                }
            }
            break;
        }

        case 'characterData': {
            mutation.target.data = mutation.oldValue;
            break;
        }

        case 'childList': {
            for (let i = mutation.addedNodes.length; --i >= 0; ) {
                mutation.target.removeChild(mutation.addedNodes[i]);
            }
            for (let i = mutation.removedNodes.length; --i >= 0; ) {
                mutation.target.insertBefore(mutation.removedNodes[i], mutation.nextSibling);
            }
            break;
        }
        }
    }

    #perform_mutation_forward(mutation_data) {
        if (!(mutation_data instanceof this.constructor.MutationData)) {
            throw new Error('mutation_data must be an instance of ChangeManager.MutationData');
        }

        const { mutation } = mutation_data;
        switch (mutation.type) {
        default: {
            throw new Error(`unknown MutationRecord type: ${mutation.type}`);
        }

        case 'attributes': {
            // note that mutation_data.had_attribute and mutation_data.newValue is set by us in #mutation_handler()
            if ('attributeNamespace' in mutation) {
                safe_setAttributeNS(mutation.target, mutation.attributeNamespace, mutation.attributeName, mutation_data.newValue);
            } else{
                mutation.target.setAttribute(mutation.attributeName, mutation_data.newValue);
            }
            break;
        }

        case 'characterData': {
            // note that mutation_data.newValue is set by us in #mutation_handler()
            mutation.target.data = mutation_data.newValue;
            break;
        }

        case 'childList': {
            for (let i = 0; i < mutation.removedNodes.length; i++) {
                mutation.target.removeChild(mutation.removedNodes[i]);
            }
            for (let i = 0; i < mutation.addedNodes.length; i++) {
                mutation.target.insertBefore(mutation.addedNodes[i], mutation.nextSibling);
            }
            break;
        }
        }
    }

    #mutation_handler(mutation_list, observer) {
//console.log('mutation_handler', mutation_list);//!!!
        if (!this.#inhibit) {
            // map mutation_list to form an array of MutationData objects
            // "attributes" and "characterData" records store newValue in the MutationData
            const mutations = mutation_list.map(mutation => {
                const extra_props = {
                    had_attribute: undefined,  // set for 'attributes' mutations
                    newValue:      undefined,  // set for 'attributes' and 'characterData' mutations
                };
                switch (mutation.type) {
                case 'attributes': {
                    // Add had_attribute and newValue fields to extra_props.
                    // This is for when we want to "redo" this mutation.
                    const had_attribute = ('attributeNamespace' in mutation)
                          ? mutation.target.hasAttributeNS(mutation.attributeNamespace, mutation.attributeName)
                          : mutation.target.hasAttribute(mutation.attributeName);
                    const newValue = ('attributeNamespace' in mutation)
                          ? mutation.target.getAttributeNS(mutation.attributeNamespace, mutation.attributeName)
                          : mutation.target.getAttribute(mutation.attributeName);
                    extra_props.had_attribute = had_attribute;
                    extra_props.newValue      = newValue;
                    break;
                }
                case 'characterData': {
                    // Add a newValue field to extra_props.
                    // This is for when we want to "redo" this mutation.
                    const newValue = mutation.target.data;
                    extra_props.newValue = newValue;
                    break;
                }
                }
                return new this.constructor.MutationData(mutation, extra_props);
            });

            const selection = window.getSelection();
            const new_change = {
                timestamp:    Date.now(),
                focus_node:   selection.focusNode,
                focus_offset: selection.focusOffset,
                mutations,
            };

            // remove everything from stack after current
            this.#stack.splice(this.#current+1, this.#stack.length-(this.#current+1));
            this.#current = this.#stack.length-1;  // last change on stack
            if (typeof this.#neutral === 'number' && this.#neutral > this.#current) {
                // neutral position was within the removed range
                this.#neutral = undefined;  // no neutral position
            }

            // add the new change:
            // add new change to stack (will be at position current+1)
            this.#stack.push(new_change);
            // update current
            this.#current = this.#stack.length-1;  // last change on stack
        }
        this.#dispatch_neutral_change_if_needed();
    }

    #last_was_neutral;
    #dispatch_neutral_change_if_needed() {
        const neutral = this.is_neutral();
        if (typeof this.#last_was_neutral === 'undefined' || this.#last_was_neutral !== neutral) {
            this.neutral_changes.dispatch({
                neutral,
                change_manager: this,
            });
        }
        this.#last_was_neutral = neutral;
    }
}
