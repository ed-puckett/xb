const current_script_url = import.meta.url;  // save for later

import {
    XbManager,
} from 'src/xb-manager/_';

import {
    OutputContextLike,
} from 'src/output-context/types';

import {
    OutputContext,
} from 'src/output-context/_';

import {
    clear_element,
} from 'lib/ui/dom-tools';

import {
    make_string_literal,
} from 'lib/sys/string-tools';

import {
    EventListenerManager,
} from 'lib/sys/event-listener-manager';

import {
    CodemirrorUndoInfo,
    create_null_codemirror_undo_info,
    CodemirrorInterface,
} from './codemirror';

import {
    generate_object_id,
} from 'lib/sys/uuid';

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

import {
    create_stylesheet_link,
} from 'lib/ui/dom-tools';


export async function load_stylesheet() {
    create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));
}

/** XbCellElement represents a text-based input/source
 *  It represents media types text/???
 */
export class XbCellElement extends HTMLElement {
    get CLASS (){ return this.constructor as typeof XbCellElement; }

    static #custom_element_name = 'xb-cell';
    static get custom_element_name (){ return this.#custom_element_name; }

    static #css_class__show_in_presentation = 'show-in-presentation';
    static get css_class__show_in_presentation (){ return this.#css_class__show_in_presentation; }

    static #attribute__active = 'data-active';
    static get attribute__active (){ return this.#attribute__active; }

    static #attribute__type = 'data-type';
    static get attribute__type (){ return this.#attribute__type; }

    static #default_type = 'markdown';
    static get default_type (){ return this.#default_type; }

    #codemirror: undefined|CodemirrorInterface = undefined;
    #event_listener_manager = new EventListenerManager();

    #xb: undefined|XbManager = undefined;
    get xb (){ return this.#xb; }

    /** _set_xb() must be called prior this.get_text() or this.set_text() being called.
     */
    _set_xb(xb: XbManager) {
        if (!(xb instanceof XbManager)) {
            throw new Error('xb must be an instance of XbManager');
        }
        this.#xb = xb;
    }

    constructor() {
        super();
        this.#connect_focus_listeners();
    }


    // === UPDATE FROM SETTINGS ===

    update_from_settings(): void {
        if (this.#has_text_container()) {
            this.#codemirror?.update_from_settings();
        }
    }


    // === SHOWING ===

    /** control whether or not this element is shown when view is set to "presentation"
     * @param {Boolean} new_state
     */
    show_in_presentation(new_state: boolean = true): void {
        if (new_state) {
            this.classList.add(this.CLASS.css_class__show_in_presentation);
        } else {
            this.classList.remove(this.CLASS.css_class__show_in_presentation);
        }
    }

    /** @return (Boolean) whether or not this element is shown when view is set to "presentation".
     */
    get shown_in_presentation (){ return this.classList.contains(this.CLASS.css_class__show_in_presentation); }

    /** @return (Boolean) whether or not this element is currently showing.
     * Note that "showing" does not necessarily mean visible; the cell may be scrolled out of the viewport.
     */
    get showing (){ return (this.xb && (!this.xb.in_presentation_view || this.shown_in_presentation)); }


    // === TEXT CONTENT ===

    get_text(): string {
        if (!(this.#xb instanceof XbManager)) {
            throw new Error('xb not set!');
        }
        const text = this.#has_text_container()
            ? this.#codemirror?.get_text()
            : this.textContent;
        return text ?? '';
    }

    // this works even if the cell is not editable
    set_text(text: string, set_neutral: boolean = true): void {
        if (!(this.#xb instanceof XbManager)) {
            throw new Error('xb not set!');
        }
        if (this.#codemirror) {
            this.#codemirror.set_text(text, set_neutral);
        } else {
            this.textContent = text;
            if (set_neutral) {
                this.set_neutral();
            }
        }
    }

    #has_text_container(): boolean { return !!this.#codemirror; }

    #establish_editable_text_container(): void {
        if (!this.#has_text_container()) {
            this.#codemirror = CodemirrorInterface.create(this);
        }
        // this.#is_neutral_without_text_container remains the same
    }

    #remove_text_container(): void {
        if (this.#codemirror) {
            const text = this.get_text();
            this.#is_neutral_without_text_container &&= this.#codemirror.is_neutral();
            this.#codemirror = undefined;
            clear_element(this);  // remove text_container element, etc
            this.set_text(text);  // will be added directly to this because no text_container
        }
    }

    is_neutral() {
        return this.#codemirror
            ? this.#is_neutral_without_text_container && this.#codemirror.is_neutral()
            : this.#is_neutral_without_text_container;
    }
    #is_neutral_without_text_container: boolean = true;  // once set to false, will stay false until set back to true by this.set_neutral()

    set_neutral() {
        this.#is_neutral_without_text_container = true;
        if (this.#codemirror) {
            this.#codemirror.set_neutral();
        }
    }

    get_undo_info(): CodemirrorUndoInfo {
        if (this.#codemirror) {
            return this.#codemirror.get_undo_info();
        } else {
            return create_null_codemirror_undo_info(this.is_neutral());
        }
    }

    /** override focus() so that we can direct focus to the contained "textarea"
     *  if necessary.  Setting a tabindex="0" attribute on this cell solves the
     *  problem but then causes another: SHIFT-Tab out of a textarea with a
     *  tabindex="0" parent fails.  So we just have to do it the hard way.
     */
    focus(options?: object): void {
        this.set_active(true);  // set "active" right away
        if (this.#has_text_container()) {
            this.#codemirror?.focus();
        } else {
            super.focus(options);  // will most likely fail, but that would be appropriate
        }
    }


    // === EDITABLE ===

    get editable (): boolean {
        return this.#has_text_container();
    }

    set_editable(editable: boolean): void {
        this.removeAttribute('contenteditable');  // editability established by text container element
        if (editable) {
            this.#establish_editable_text_container();
        } else {
            this.#remove_text_container();
        }
    }


    // === ACTIVE ===

    get active () {
        return !!this.hasAttribute(this.CLASS.attribute__active);
    }

    set_active(state: boolean = false): void {
        state = !!state;
        if (this.active !== state) {  // avoid creating an unnecessary dom mutation
            if (state) {
                this.setAttribute(this.CLASS.attribute__active, true.toString());
            } else {
                this.removeAttribute(this.CLASS.attribute__active);
            }
        }
    }


    // === ID, TYPE ===

    ensure_id(): void {
        if (!this.id) {
            this.id = generate_object_id();
        }
    }

    get type (): string { return this.getAttribute(XbCellElement.#attribute__type) ?? this.CLASS.default_type; }

    set type (type: string){
        this.setAttribute(XbCellElement.#attribute__type, type);
        this.#codemirror?.set_language_from_type(this.type);
    }


    // === DOM ===

    get_output_element_selector() { return `[${OutputContextLike.attribute__data_source_element}="${this.id}"]`; }

    /** reset the cell, removing all associated output elements
     */
    reset(): void {
        this.xb?.stop_cell(this);        
        if (this.id) {
            for (const output_element of document.querySelectorAll(this.get_output_element_selector())) {
                output_element.remove();
            }
        }
    }

    /** stop any running activities for this cell
     */
    stop(): void {
        this.xb?.stop_cell(this);
    }

    get can_stop (): boolean {
        return this.xb?.can_stop_cell(this) ?? false;
    }

    scroll_into_view(focus_too: boolean = false): void {
        this.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        if (this.#has_text_container()) {
            // this adjusts the codemirror view
            this.#codemirror?.scroll_into_view();
        }
        if (focus_too) {
            this.focus();
        }
    }

    /* Override this.outerHTML to provide clean output for save_serializer() in 'src/init.ts'.
     * This is done so that CodeMirror stuff does not get included, only the text.
     */
    get outerHTML (): string {
        return this.getOuterHTML();
    }

    getOuterHTML(include_active_cell_setting: boolean = false): string {
        const open_tag_segments = [
            `<${this.CLASS.custom_element_name}`,
        ];
        //!!! attributes values' containing " character are incorrectly translated to \"
        for (const name of this.getAttributeNames()) {
            if (name !== this.CLASS.attribute__active || include_active_cell_setting) {
                const value = this.getAttribute(name);
                if (!value) {
                    open_tag_segments.push(name);
                } else {
                    open_tag_segments.push(`${name}=${make_string_literal(value, true)}`);
                }
            }
        }
        const open_tag = open_tag_segments.join(' ') + '>';
        return `${open_tag}${this.get_text()}</${this.CLASS.custom_element_name}>`;
    }


    // === FOCUS LISTENERS / ACTIVE ===

    #connect_focus_listeners(): void {
        // note: this gets called before _set_xb() has been called
        const self = this;
        function select_handler(event: Event) {
            const target = event.target;
            if (target instanceof Element) {
                const cell = target.closest(XbCellElement.custom_element_name) as XbCellElement;
                if (cell) {
                    // self.xb?.set_active_cell() clears the "active" attributes of all other cells
                    self.xb?.set_active_cell(cell);
                }
            }
        }
        this.#event_listener_manager.add(this, 'focus', select_handler, { capture: true });
        this.#event_listener_manager.add(this, 'click', select_handler, { capture: true });
    }


    // === WEB COMPONENT LIFECYCLE ===

    #update_for_connected(): void {
        this.#event_listener_manager.attach();
        this.removeAttribute('tabindex');  // focusable parent for textarea causes SHIFT-Tab not to work
    }

    #update_for_disconnected(): void {
        this.#event_listener_manager.detach();
    }

    // connectedCallback:
    //     Invoked each time the custom element is appended into a document-connected element.
    //     This will happen each time the node is moved, and may happen before the element's contents have been fully parsed.
    //     Note: connectedCallback may be called once your element is no longer connected, use Node.isConnected to make sure.
    connectedCallback(): void {
        this.#update_for_connected();
    }

    // disconnectedCallback:
    //     Invoked each time the custom element is disconnected from the document's DOM.
    disconnectedCallback(): void {
        this.#update_for_disconnected();
    }

    // adoptedCallback:
    //     Invoked each time the custom element is moved to a new document.
    adoptedCallback(): void {
        this.#update_for_connected();
    }

    // attributeChangedCallback:
    //     Invoked each time one of the custom element's attributes is added, removed, or changed.
    //     Which attributes to notice change for is specified in a static get observedAttributes method
    attributeChangedCallback(name: string, old_value: any, new_value: any): void {
        switch (name) {
            case 'xyzzy': {
                //!!!
                break;
            }
        }
        //!!!
    }

    static get observedAttributes(): string[] {
        return [
            'xyzzy',//!!!
        ];
    }


    // === INITIALIZATION ===

    static {  // static initialization
        globalThis.customElements.define(this.custom_element_name, this);
    }
}
