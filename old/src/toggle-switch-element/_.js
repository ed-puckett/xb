const current_script_url = import.meta.url;  // save for later

import {
    EventListenerManager,
} from '../../lib/sys/event-listener-manager.js';

import {
    create_element,
} from '../../lib/ui/dom-tools.js';

import {
    beep,
} from '../../lib/ui/beep.js';

import {
    assets_server_url,
} from '../assets-server-url.js';

// import {
//     create_stylesheet_link,
// } from '../../lib/ui/dom-tools.js';
export async function load_stylesheet() {
    // create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));
    await import('./style.css');  // webpack implementation
}


export class ToggleSwitchElement extends HTMLElement {
    static custom_element_name = 'toggle-switch';

    static create(options=null) {
        const {
            parent,
            class: cls,
            title_for_on,
            title_for_off,
            svg,
        } = (options ?? {});
        const control = create_element({
            parent,
            tag: this.custom_element_name,
            attrs: {
                role: 'switch',
                "aria-checked": false,
                "tabindex": "0",
                title: title_for_off,
                class: (cls ?? ''),
            },
        });
        control.#event_listener_manager.add(control, 'change', (event) => {
            control.title = control.get_state() ? title_for_on : title_for_off;
        });
        return control;
    }

    constructor() {
        super();
        this.#event_listener_manager = new EventListenerManager();
        this.#event_listener_manager.add(this, 'click', (event) => {
            if (!this.is_enabled()) {
                beep();
            } else {
                this.set_state();
                event.preventDefault();
                event.stopPropagation();
            }
        });
        this.#event_listener_manager.add(this, 'keydown', (event) => {
            if ([' ', 'Enter'].includes(event.key)) {
                if (!this.is_enabled()) {
                    beep();
                } else {
                    this.set_state();
                    event.preventDefault();
                    event.stopPropagation();
                }
            }
        });
    }
    #event_listener_manager;

    is_enabled() {
        if (!this.hasAttribute('disabled')) {
            return true;
        } else {
            const disabled_value = this.getAttribute('disabled');
            return (disabled_value === false.toString());
        }
    }

    enable(state) {
        if (state) {
            this.removeAttribute('disabled');
            this.removeAttribute('aria-disabled');
            this.setAttribute('tabindex', '0');
            this.style.removeProperty('filter');//!!! hacky way of setting "disabled" display state
        } else {
            this.setAttribute('disabled', true);
            this.setAttribute('aria-disabled', true);
            this.removeAttribute('tabindex');
            this.style.setProperty('filter', 'opacity(0.45)');//!!! hacky way of setting "disabled" display state
        }
    }

    get_state() {
        return (this.getAttribute('aria-checked') === 'true');
    }

    set_state(new_state=null) {
        const old_state = this.get_state();
        new_state ??= !old_state;  // if no argument, then toggle state
        new_state = !!new_state;
        this.setAttribute('aria-checked', new_state);
        if (old_state !== new_state) {
            this.dispatchEvent(new Event('change'));
        }
    }


    // === WEB COMPONENT LIFECYCLE ===

    // connectedCallback:
    //     Invoked each time the custom element is appended into a document-connected element.
    //     This will happen each time the node is moved, and may happen before the element's contents have been fully parsed.
    //     Note: connectedCallback may be called once your element is no longer connected, use Node.isConnected to make sure.
    connectedCallback() {
        // attributes are not allowed to be set in the constructor so set these here instead
        this.setAttribute('role', 'switch');
        this.setAttribute('aria-checked', this.get_state());  // ensure 'aria-checked' is set

        this.#event_listener_manager.attach();
    }

    // disconnectedCallback:
    //     Invoked each time the custom element is disconnected from the document's DOM.
    disconnectedCallback() {
        this.#event_listener_manager.detach();
    }

    // adoptedCallback:
    //     Invoked each time the custom element is moved to a new document.
    adoptedCallback() {
        this.#event_listener_manager.attach();
    }

    // attributeChangedCallback:
    //     Invoked each time one of the custom element's attributes is added, removed, or changed.
    //     Which attributes to notice change for is specified in a static get observedAttributes method
    attributeChangedCallback(name, old_value, new_value) {
        switch (name) {
        case 'xyzzy': {
            //!!!
            break;
        }
        }
        //!!!
    }

    static get observedAttributes() {
        return [
            'xyzzy',//!!!
        ];
    }


    // === INTERNAL ===

    // Safari does not support static initialization blocks in classes (at the time of writing), so do it this way:
    static _init_static() {
        globalThis.customElements.define(this.custom_element_name, this);
    }
}

// Safari does not support static initialization blocks in classes (at the time of writing), so do it this way:
ToggleSwitchElement._init_static();
