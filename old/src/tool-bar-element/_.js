const current_script_url = import.meta.url;  // save for later

import {
    ToggleSwitchElement,
} from '../toggle-switch-element/_.js';

import {
    EventListenerManager,
} from '../../lib/sys/event-listener-manager.js';

import {
    get_evaluator_classes,
} from '../evaluator/_.js';

import {
    create_element,
    clear_element,
} from '../../lib/ui/dom-tools.js';

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

export class ToolBarElement extends HTMLElement {
    static custom_element_name = 'tool-bar';

    static indicator_control__class            = 'tool-bar-indicator';
    static indicator_control__attribute__value = 'data-indicator-value';

    static toggle_switch__autoeval__class = 'tool-bar-toggle-autoeval';

    /** create a new ToolBarElement in the document, then set target with options
     *  @param {any} target
     *  @param {Object|null|undefined} options to be passed to set_target()
     *  @return {ToolBarElement} tool bar element
     */
    static create_for(target, options) {
        const tool_bar = document.createElement(this.custom_element_name);
        if (!tool_bar) {
            throw new Error('error creating tool bar');
        }
        try {
            tool_bar.set_target(target, options);
            return tool_bar;
        } catch (error) {
            tool_bar.remove();
            throw error;
        }
    }

    constructor() {
        super();
        this.#target = null;
        this.#event_listener_manager = new EventListenerManager();
        this.#reset_configuration();
    }
    #event_listener_manager;
    #controls;  // name -> { name?, control?, get?, set?}

    set_type(type) {
        this.set_for('type', type);
    }


    // === TARGET ===

    #target;

    /** @return {any} current target
     */
    get target (){ return this.#target; }

    /** set the target for this tool bar
     *  @param {any} target
     *  @param {Object|null|undefined} options: {
     *      autoeval?, { initial?, on? },
     *      type?,     { initial?, on? },
     *      running?,  { initial?, on? },
     *      modified?, { initial?, on? },
     *      run?,      { initial?, on? },
     *  }
     * A prior target, if any, is silently replaced.
     */
    set_target(target, options=null) {
        if (target !== null && typeof target !== 'undefined' && !(target instanceof EventTarget)) {
            throw new Error('target must be null, undefined, or and instance of EventTarget');
        }
        if (!target) {
            this.#target = null;
            this.#reset_configuration();
        } else {
            if (this.#target !== target) {
                this.#target = target;
                this.#configure(options);
            }
        }
    }

    get_for(name, value) {
        if (!(name in this.#controls)) {
            throw new Error('unknown name');
        }
        return this.#controls[name].get();
    }
    set_for(name, value) {
        if (!(name in this.#controls)) {
            throw new Error('unknown name');
        }
        this.#controls[name].set(value);
    }
    enable_for(name, value) {
        if (!(name in this.#controls)) {
            throw new Error('unknown name');
        }
        this.#controls[name].enable(value);
    }


    // === CONFIGURATION ===

    /** set up controls, etc according to options
     *  @param {Object|null|undefined} options from set_target()
     */
    #configure(options=null) {
        options ??= {};
        this.#reset_configuration();
        try {
            for (const [ name, create, getter, setter, enable ] of this.#get_control_setup()) {
                let control_options = options[name];
                if (control_options) {
                    if (typeof control_options !== 'object') {
                        control_options = {};
                    }

                    const control = create(control_options.on);
                    if ('initial' in control_options) {
                        setter(control, control_options.initial);
                    }

                    this.#controls[name] = {
                        name,
                        control,
                        get:    getter.bind(ToolBarElement, control),
                        set:    setter.bind(ToolBarElement, control),
                        enable: enable.bind(ToolBarElement, control),
                    };
                }
            }
            this.#event_listener_manager.add(this, 'pointerdown', (event) => {
                this.#target.focus();
                if (event.target instanceof ToolBarElement) {
                    // stop event only if target is directly a ToolBarElement, not one of its children
                    event.preventDefault();
                    event.stopPropagation();
                }
            });

        } catch (error) {
            this.#reset_configuration();
            throw error;
        }
    }

    #reset_configuration() {
        this.#event_listener_manager.remove_all();
        clear_element(this);
        this.#controls = {};
    }

    /** @return array of arrays of [ name, create, getter, setter, enable ]
     */
    #get_control_setup() {
        const cons = this.constructor;
        return [
            // the order of this array determines order of control creation

            // NAME       CREATE_FN,                         GETTER_FN               SETTER_FN               ENABLE_FN
            [ 'type',     this.#create__type.bind(this),     cons.#getter__type,     cons.#setter__type,     cons.#enable__type     ],
            [ 'run',      this.#create__run.bind(this),      cons.#getter__run,      cons.#setter__run,      cons.#enable__run      ],
            [ 'autoeval', this.#create__autoeval.bind(this), cons.#getter__autoeval, cons.#setter__autoeval, cons.#enable__autoeval ],
            [ 'modified', this.#create__modified.bind(this), cons.#getter__modified, cons.#setter__modified, cons.#enable__modified ],
            [ 'running',  this.#create__running.bind(this),  cons.#getter__running,  cons.#setter__running,  cons.#enable__running  ],
        ];
    }


    // === CONTROL HANDLING ===

    #create__autoeval(on_change_handler=null) {
        const control = create_element({
            parent: this,
            tag: 'input',
            attrs: {
                type: 'checkbox',
                title: 'autoeval...',
            },
        });
        control.innerHTML = `\
<?xml version="1.0" encoding="UTF-8"?>
<!--
    Adapted from: https://commons.wikimedia.org/wiki/File:Ei-pencil.svg
    Alexander Madyankin, Roman Shamin, MIT <http://opensource.org/licenses/mit-license.php>, via Wikimedia Commons
-->
<svg
  xmlns="http://www.w3.org/2000/svg"
  version="1.1"
  viewBox="0 0 50 50"
>
  <path class="accent-stroke accent-fill" fill="#0000" d="M9.6 40.4 l2.5 -9.9 L27 15.6 l7.4 7.4 -14.9 14.9 -9.9 2.5z m4.3 -8.9 l-1.5 6.1 6.1 -1.5 L31.6 23 27 18.4 13.9 31.5z"/>
  <path class="accent-stroke accent-fill" fill="#0000" d="M17.8 37.3 c-.6 -2.5 -2.6 -4.5 -5.1 -5.1 l.5 -1.9 c3.2 .8 5.7 3.3 6.5 6.5 l-1.9 .5z"/>
  <path class="accent-stroke accent-fill" fill="#0000" d="M29.298 19.287 l1.414 1.414 -13.01 13.02 -1.414 -1.412z"/>
  <path class="accent-stroke accent-fill" fill="#0000" d="M11 39 l2.9 -.7 c-.3 -1.1 -1.1 -1.9 -2.2 -2.2 L11 39z"/>
  <path class="accent-stroke accent-fill" fill="#0000" d="M35 22.4 L27.6 15 l3-3 .5.1 c3.6 .5 6.4 3.3 6.9 6.9 l.1 .5 -3.1 2.9z M30.4 15 l4.6 4.6 .9 -.9 c-.5 -2.3 -2.3 -4.1 -4.6 -4.6 l-.9 .9z"/>
</svg>
`;
        if (on_change_handler) {
            this.#event_listener_manager.add(control, 'change', (event) => {
                if (!on_change_handler(event)) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                }
            });
        }
        this.#event_listener_manager.add(control, 'change', (event) => {
            control.title = control.checked ? 'autoeval off...' : 'autoeval on...';
        });
        return control;
    }
    static #getter__autoeval(control)        { return control.checked; }
    static #setter__autoeval(control, value) { control.checked = !!value; }
    static #enable__autoeval(control, value) { control.enable(value); }

    #create__type(on_change_handler=null) {
        const control = create_element({
            parent: this,
            tag: 'select',
            attrs: {
                title: 'type...',
            },
            set_id: true,  // prevent warning: "A form field element should have an id or name attribute"
        });

        const types = new Set(get_evaluator_classes().map(e => e.handled_input_types).flat()).values();
        let subsequent = false;
        for (const type of types) {
            create_element({
                parent: control,
                tag: 'option',
                attrs: {
                    title: 'type...',
                    label: type,
                    ...(subsequent ? {} : { selected: !subsequent }),  // first entry is default
                    value: type,
                },
            });
            subsequent = true;
        }

        if (on_change_handler) {
            this.#event_listener_manager.add(control, 'change', (event) => {
                if (!on_change_handler(event)) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                }
            });
        }
        this.#event_listener_manager.add(control, 'change', (event) => {
            control.title = `type ${control.value}`;
        });
        return control;
    }
    static #getter__type(control)        { return control.value; }
    static #setter__type(control, value) {
        if (![ ...control.options ].map(option => option.value).includes(value)) {  //!!! what a kludge...
            throw new Error('setting unknown/illegal value');
        }
        control.value = value;
    }
    static #enable__type(control, value) {
        if (value) {
            control.removeAttribute('disabled');
            control.removeAttribute('aria-disabled');
        } else {
            control.setAttribute('disabled', true);
            control.setAttribute('aria-disabled', true);
        }
    }

    #create__running(on_change_handler=null) {
        return this.#indicator_control__create_with_class_and_title('running', 'running...', 'done...', on_change_handler);
    }
    static #getter__running(control)        { return this.#indicator_control__getter(control); }
    static #setter__running(control, value) { this.#indicator_control__setter(control, value); }
    static #enable__running(control, value) { /* nothing */ }

    #create__modified(on_change_handler=null) {
        return this.#indicator_control__create_with_class_and_title('modified', 'modified...', 'not modified...', on_change_handler);
    }
    static #getter__modified(control)        { return this.#indicator_control__getter(control); }
    static #setter__modified(control, value) { this.#indicator_control__setter(control, value); }
    static #enable__modified(control, value)  { /* nothing */ }

    #create__run(on_change_handler=null) {
        //!!!
    }
    static #getter__run(control) {
        //!!!
    }
    static #setter__run(control, value) {
        //!!!
    }
    static #enable__run(control, value) {
        //!!!
    }

    // indicator control getter/setter
    #indicator_control__create_with_class_and_title(css_class, title_for_on, title_for_off, on_change_handler=null) {
        const control = create_element({
            parent: this,
            attrs: {
                title: title_for_off,
                class: [ this.constructor.indicator_control__class, css_class ],
            },
        });
        if (on_change_handler) {
            this.#event_listener_manager.add(control, 'change', on_change_handler);
        }
        this.#event_listener_manager.add(control, 'change', (event) => {
            control.title = this.constructor.#indicator_control__getter(control) ? title_for_on : title_for_off;
        });
        return control;
    }
    static #indicator_control__getter(control) {
        return !!control.getAttribute(this.indicator_control__attribute__value);
    }
    static #indicator_control__setter(control, value) {
        const current_value = this.#indicator_control__getter(control);
        if (value !== current_value) {
            control.setAttribute(this.indicator_control__attribute__value, (value ? 'on' : ''));
            // dispatch "change" event
            const event = new Event('change', {});
            control.dispatchEvent(event);
        }
    }


    // === WEB COMPONENT LIFECYCLE ===

    // connectedCallback:
    //     Invoked each time the custom element is appended into a document-connected element.
    //     This will happen each time the node is moved, and may happen before the element's contents have been fully parsed.
    //     Note: connectedCallback may be called once your element is no longer connected, use Node.isConnected to make sure.
    connectedCallback() {
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
ToolBarElement._init_static();
