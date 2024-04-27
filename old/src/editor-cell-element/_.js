const current_script_url = import.meta.url;  // save for later

import {
    create_element,
    clear_element,
    escape_for_html,
    manage_selection_for_insert,
    manage_selection_for_delete,
    insert_at,
    delete_nearest_leaf,
    validate_parent_and_before_from_options,
} from '../../lib/ui/dom-tools.js';

import {
    LogbookManager,
} from '../logbook-manager.js';

import {
    EventListenerManager,
} from '../../lib/sys/event-listener-manager.js';

import {
    ToolBarElement,
} from '../tool-bar-element/_.js';

import {
    create_codemirror_view,
} from './codemirror.js';

import {
    beep,
} from '../../lib/ui/beep.js';

// import {
//     assets_server_url,
// } from '../assets-server-url.js';
// import {
//     create_stylesheet_link,
// } from '../../lib/ui/dom-tools.js';
export async function load_stylesheet() {
    // create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));
    await import('./style.css');  // webpack implementation
}


export class EditorCellElement extends HTMLElement {
    static custom_element_name = 'editor-cell';

    static attribute__active      = 'data-active';
    static #attribute__input_type = 'data-input-type';

    static default_input_type = 'markdown';


    constructor() {
        super();
        this.#event_listener_manager = new EventListenerManager();

        this.#connect_focus_listeners();

        // _tool_bar is used instead of #tool_bar so that subclasses have access (see establish_tool_bar())
        this._tool_bar = null;
    }
    #event_listener_manager;
    #codemirror;


    // === UPDATE FROM SETTINGS ===

    update_from_settings() {
        if (this.#has_text_container) {
            this.#codemirror.update_from_settings();
        }
    }


    // === TEXT CONTENT ===

    get_text() {
        return this.#has_text_container()
            ? this.#codemirror.get_text()
            : this.textContent;
    }

    // this works even if the cell is not editable
    set_text(text) {
        if (this.#has_text_container()) {
            this.#codemirror.set_text(text);
        } else {
            this.textContent = text;
        }
    }

    /** @return {String} an HTML representation of the current state of this cell
     * The 'contenteditable' and this.constructor.attribute__active are ignored
     * and the text container element, if it exists, is omitted and the text
     * made a direct child of the cell.
     */
    get_outer_html() {
        const tag = this.tagName.toLowerCase();
        const attr_segments = [];
        for (const name of this.getAttributeNames()) {
            if (name !== 'contenteditable' && name !== this.constructor.attribute__active) {
                const value = this.getAttribute(name);
                const encoded_value = escape_for_html(value).replaceAll('"', '&quot;');//!!!
                attr_segments.push(`${name}="${encoded_value}"`);
            }
        }
        const text_content = escape_for_html(this.get_text());
        return `<${tag} ${attr_segments.join(' ')}>${text_content}</${tag}>`;
    }

    #has_text_container() { return !!this.#codemirror; }

    #establish_editable_text_container() {
        if (!this.#has_text_container()) {
            this.#codemirror = create_codemirror_view(this);
        }
    }

    #remove_text_container() {
        if (this.#has_text_container()) {
            const text = this.get_text();
            this.#codemirror = undefined;
            clear_element(this);  // remove text_container element, etc
            this.set_text(text);  // will be added directly to this because no text_container
        }
    }

    /** override focus() so that we can direct focus to the contained textarea
     *  if necessary.  Setting a tabindex="0" attribute on this cell solves the
     *  problem but then causes another: SHIFT-Tab out of a textarea with a
     *  tabindex="0" parent fails.  So we just have to do it the hard way.
     */
    focus() {
        if (this.#has_text_container()) {
            this.#codemirror.focus();
        } else {
            super.focus();  // will most likely fail, but that would be appropriate
        }
    }


    // === EDITABLE ===

    get editable (){
        return this.#has_text_container();
    }

    set_editable(editable) {
        this.removeAttribute('contenteditable');  // editability established by text container element
        if (editable) {
            this.#establish_editable_text_container();
            this._tool_bar.enable_for('type', true);
        } else {
            this.#remove_text_container();
            this._tool_bar.enable_for('type', false);
        }
    }


    // === ACTIVE ===

    get active (){
        const attribute_element = this.#active_element_mapper ? this.#active_element_mapper(this) : this;
        return !!attribute_element.hasAttribute(this.constructor.attribute__active);
    }

    set_active(state=false) {
        state = !!state;
        const attribute_element = this.#active_element_mapper ? this.#active_element_mapper(this) : this;
        if (attribute_element.active !== state) {  // avoid creating an unnecessary dom mutation
            if (state) {
                attribute_element.setAttribute(this.constructor.attribute__active, true);
            } else {
                attribute_element.removeAttribute(this.constructor.attribute__active);
            }
        }
    }

    set_active_element_mapper(mapper=null) {
        const current_active_state = this.active;
        this.set_active(false);  // remove attribute from prior mapped element
        this.#active_element_mapper = mapper ?? undefined;
        this.set_active(current_active_state);  // set current state on newly-mapped element
    }
    #active_element_mapper;  // initially undefined


    // === INPUT TYPE ===

    get input_type (){ return this.getAttribute(EditorCellElement.#attribute__input_type) ?? this.constructor.default_input_type; }

    set input_type (input_type){
        this.setAttribute(EditorCellElement.#attribute__input_type, input_type);
        this._tool_bar?.set_type(input_type);
    }


    // === TOOL BAR ===

    establish_tool_bar() {
        if (!this._tool_bar) {
            this._tool_bar = ToolBarElement.create_for(this, {
                autoeval: false,
                modified: true,
            });
            this.parentElement.insertBefore(this._tool_bar, this);
        }
    }

    remove_tool_bar() {
        if (this._tool_bar) {
            this._tool_bar.remove();
            this._tool_bar = undefined;
        }
    }


    // === DOM ===

    /** create a new element instance for tag this.custom_element_name with standard settings
     *  @param {null|undefined|Object} options: {
     *      parent?:                Node,                   // default: document.body
     *      before?:                Node,                   // default: null
     *      editable:               Boolean,                // set editable?  default: current logbook editable setting
     *      innerText:              String,                 // cell text to set
     *      active_element_mapper?: null|Element=>Element,  // mapper from an EditorCellElement to the element on which "data-active" will be set
     *  }
     *  @return {EditorCellElement} new cell  // may be a subclass of EditorCellElement depending on this.custom_element_name
     */
    static create_cell(options=null) {
        const {
            parent = document.body,
            before = null,
            editable = LogbookManager.singleton.editable,
            innerText,
            active_element_mapper,
        } = (options ?? {});

        const cell = create_element({
            parent,
            before,
            tag: this.custom_element_name,
        });

        if (innerText) {
            cell.set_text(innerText);
        }
        if (active_element_mapper) {
            cell.set_active_element_mapper(active_element_mapper);
        }

        cell.establish_tool_bar();

        // these settings must be done after the tool-bar is established
        cell.set_editable(editable);

        return cell;
    }

    /** return the next cell in the document with this.tagName, or null if none
     *  @param {Boolean} forward (default false) if true, return the next cell, otherwise previous
     *  @return {null|Element} the adjacent cell, or null if not found
     */
    adjacent_cell(forward=false) {
        // note that this.tagName is a selector for elements with that tag name
        const cells = [ ...document.querySelectorAll(this.tagName) ];
        const index = cells.indexOf(this);
        if (index === -1) {
            return null;
        } else {
            if (forward) {
                if (index >= cells.length-1) {
                    return null;
                } else {
                    return cells[index+1];
                }
            } else {
                if (index <= 0) {
                    return null;
                } else {
                    return cells[index-1];
                }
            }
        }
    }

    /** remove this cell from the DOM
     */
    remove_cell() {
        this.remove_tool_bar();
        this.remove();
    }

    /** reset the cell; this base class version does nothing
     *  @return {EvalCellElement} this
     */
    reset() {
        return this;
    }

    scroll_into_view() {
        //!!! this needs improvement
        //!!! when repositioning the viewport, try to ensure that the entire cell-container, especially the tool-bar, is visible and not just the editor portion
        if (this.#has_text_container) {
            this.#codemirror.scroll_into_view();
        } else {
            //!!! this is too eager...
            this.scrollIntoView();
        }
    }


    // === FOCUS LISTENERS / ACTIVE ===

    #connect_focus_listeners() {
        function focus_handler(event) {
            // LogbookManager.singleton.set_active_cell() clears/sets the "active" attributes of cells
            LogbookManager.singleton.set_active_cell(this);
        }
        const listener_specs = [
            [ this, 'focus', focus_handler, { capture: true } ],
        ];
        for (const [ target, type, listener, options ] of listener_specs) {
            this.#event_listener_manager.add(target, type, listener, options);
        }
    }


    // === WEB COMPONENT LIFECYCLE ===

    #update_for_connected() {
        this.#event_listener_manager.attach();
        this.removeAttribute('tabindex');  // focusable parent for textarea causes SHIFT-Tab not to work
    }

    #update_for_disconnected() {
        this.#event_listener_manager.detach();
    }

    // connectedCallback:
    //     Invoked each time the custom element is appended into a document-connected element.
    //     This will happen each time the node is moved, and may happen before the element's contents have been fully parsed.
    //     Note: connectedCallback may be called once your element is no longer connected, use Node.isConnected to make sure.
    connectedCallback() {
        this.#update_for_connected();
    }

    // disconnectedCallback:
    //     Invoked each time the custom element is disconnected from the document's DOM.
    disconnectedCallback() {
        this.#update_for_disconnected();
    }

    // adoptedCallback:
    //     Invoked each time the custom element is moved to a new document.
    adoptedCallback() {
        this.#update_for_connected();
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
EditorCellElement._init_static();
