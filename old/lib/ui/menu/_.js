const current_script_url = import.meta.url;  // save for later

import {
    Subscribable,
} from '../../sys/subscribable.js';

import {
    create_element,
} from '../dom-tools.js';

import {
    KeySpec,
} from '../key/_.js';

import {
    assets_server_url,
} from '../../../src/assets-server-url.js';

// import {
//     create_stylesheet_link,
// } from '../dom-tools.js';
export async function load_stylesheet() {
    // create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));
    await import('./style.css');  // webpack implementation
}


// === MENUBAR CLASS ===

// css classification classes: menubar, menu, menuitem
// other css classes: disabled, selected, active
// also: menuitem-label, menuitem-separator, menuitem-annotation, collection, collection-arrow

export class MenuBar {
    static menu_element_tag_name     = 'menu';
    static menuitem_element_tag_name = 'li';

    static find_previous_menuitem(menuitem) {
        let mi = menuitem.previousElementSibling;
        while (mi && (!mi.classList.contains('menuitem') || mi.classList.contains('disabled'))) {
            mi = mi.previousElementSibling;
        }
        return mi;
    }

    static find_next_menuitem(menuitem) {
        let mi = menuitem.nextElementSibling;
        while (mi && (!mi.classList.contains('menuitem') || mi.classList.contains('disabled'))) {
            mi = mi.nextElementSibling;
        }
        return mi;
    }

    /** call this static method, not the constructor directly
     *  @param {Element} parent
     *  @param {Object} menubar_spec: {
     *      ...
     *  }
     *  @param {Function|null|undefined} get_command_bindings
     *  @return {MenuBar} menu bar instance
     */
    static create(parent, menubar_spec, get_command_bindings) {
        const menubar = new this(parent, menubar_spec, get_command_bindings);
        return menubar;
    }

    constructor(parent, menubar_spec, get_command_bindings) {
        if (!(parent instanceof Element)) {
            throw new Error('parent must be an instance of Element');
        }
        if (get_command_bindings !== null && typeof get_command_bindings !== 'undefined' && typeof get_command_bindings !== 'function') {
            throw new Error('get_command_bindings must be null, undefined, or a function');
        }

        get_command_bindings ??= () => [];

        const commands = new Subscribable();  // emits command_context: { command: string, event: Event, target: Element }
        const selects  = new Subscribable();  // emits { select: Boolean, target: Element }  // select: true is sent before, select: false is sent after

        Object.defineProperties(this, {
            get_command_bindings: {
                value:      get_command_bindings,
                enumerable: true,
            },
            commands: {
                value:      commands,
                enumerable: true,
            },
            selects: {
                value:      selects,
                enumerable: true,
            },
        });

        this.#menu_id_to_element = {};
        this.#menubar_container = this.#build_menubar(parent, menubar_spec);
    }
    #menu_id_to_element;
    #menubar_container;

    get element (){ return this.#menubar_container; }

    #get_menu_element(menu_id) {
        const element = this.#menu_id_to_element[menu_id];
        if (!element) {
            throw new Error(`no element found for menu id "${menu_id}"`);
        }
        if (!element.classList.contains('menuitem')) {
            throw new Error(`element for menu id "${menu_id}" is not a menuitem`);
        }
        return element;
    }

    /** activate menu
     *  @param {Object} options: {
     *      set_focus?: Boolean,  // set focus, too?
     *  }
     */
    async activate(options=null) {
        if (!(this.#menubar_container instanceof Element) || !this.#menubar_container.classList.contains('menubar')) {
            throw new Error('this.#menubar_container must be an Element with class "menubar"');
        }
        const {
            set_focus,
        } = (options ?? {});
        if (!this.#menubar_container.querySelector('.selected')) {
            // select the first menuitem of the menubar
            const menubar_first_menuitem = this.#menubar_container.querySelector('.menuitem');
            if (menubar_first_menuitem) {
                this.#select_menuitem(menubar_first_menuitem);
            }
        }
        if (set_focus) {
            return new Promise(resolve => setTimeout(() => {
                this.#menubar_container.focus();
                resolve();
            }));
        }
    }

    /** deactivate menu
     */
    deactivate() {
        this.#deactivate_menu(this.#menubar_container);
    }

    set_menu_state(menu_id, state_specs) {
        state_specs ??= {};
        if (typeof state_specs !== 'object') {
            throw new Error('state_specs must be an object');
        }
        const element = this.#get_menu_element(menu_id);
        for (const [ name, value ] of Object.entries(state_specs ?? {})) {
            switch (name) {
            case 'enabled': {
                if (value) {
                    element.classList.remove('disabled');
                } else {
                    element.classList.add('disabled');
                }
                break;
            }
            case 'checked': {
                if (value) {
                    element.classList.add('checked');
                } else {
                    element.classList.remove('checked');
                }
                break;
            }
            default: {
                throw new Error('unknown state name');
            }
            }
        }
    }


    // === INTERNAL ===

    /** deactivate the menubar or menu that contains the given menuitem
     *  and reset all subordinate state.
     *  @param {Element|undefined|null} menu_element an Element object with class either .menubar or .menu
     *  This is compatible with menuitem elements that are contained
     *  in either a .menubar or .menu element.
     */
    #deactivate_menu(menu_element) {
        if (menu_element) {
            if ( !(menu_element instanceof Element) ||
                 (!menu_element.classList.contains('menubar') && !menu_element.classList.contains('menu')) ) {
                throw new Error('menu_element must be an Element with class "menubar" or "menu"');
            }
            menu_element.classList.remove('active');
            menu_element.classList.remove('selected');
            for (const mi of menu_element.children) {
                mi.classList.remove('selected');
                if (mi.classList.contains('collection')) {
                    this.#deactivate_menu(mi.querySelector('.menu'));
                }
            }
            if (menu_element.classList.contains('menubar')) {
                this.selects.dispatch({ select: false, target: menu_element });
            }
        }
    }

    /** select the given menuitem and deselect all others
     *  @param {Element} menuitem_element
     *  This is compatible with menuitem elements that are contained
     *  in either a .menubar or .menu element.
     */
    #select_menuitem(menuitem_element) {
        if (!menuitem_element.classList.contains('selected')) {
            // change selection only if not already selected
            const container = menuitem_element.closest('.menubar, .menu');
            if (container.classList.contains('menubar') && !this.#menubar_container.querySelector('.selected')) {
                this.selects.dispatch({ select: true, target: menuitem_element });
            }
            // add .selected to menuitem_element
            menuitem_element.classList.add('selected');
            if (menuitem_element.classList.contains('collection')) {
                // make it "active" so that the submenu is displayed
                menuitem_element.querySelector('.menu').classList.add('active');
                // adjust the position of the collection
                const collection = menuitem_element.querySelector('.menu');
                const menuitem_element_br = menuitem_element.getBoundingClientRect();
                if (menuitem_element.parentElement.classList.contains('menubar')) {
                    collection.style.top  = `${menuitem_element_br.y + menuitem_element_br.height}px`;
                    collection.style.left = `${menuitem_element_br.x}px`;
                } else {
                    collection.style.top  = `${menuitem_element_br.y - menuitem_element_br.height}px`;
                    collection.style.left = `${menuitem_element_br.x + menuitem_element_br.width}px`;
                }
            }
            // we updated menuitem_element first so that we don't erroneously
            // fire a selects event with select: false while we deselect all
            // other children now
            for (const mi of container.children) {
                if (mi !== menuitem_element) {
                    this.#deselect_menuitem(mi);
                }
            }
        }
    }

    /** deselect the given menuitem
     *  @param {Element} menuitem_element
     *  This is compatible with menuitem elements that are contained
     *  in either a .menubar or .menu element.
     */
    #deselect_menuitem(menuitem_element) {
        if (menuitem_element.classList.contains('selected')) {
            menuitem_element.classList.remove('selected');
            if (menuitem_element.parentElement.classList.contains('menubar') && !this.#menubar_container.querySelector('.selected')) {
                this.selects.dispatch({ select: false, target: menuitem_element });
            }
        }
        if (menuitem_element.classList.contains('collection')) {
            this.#deactivate_menu(menuitem_element.querySelector('.menu'));
        }
    }

    /** Return a new menu Element object which represents a separator.
     *  @param {Element} parent
     */
    #build_menu_item_separator(parent) {
        if (!(parent instanceof Element)) {
            throw new Error('parent must be an instance of Element');
        }
        const element = create_element({
            parent,
            tag: this.constructor.menuitem_element_tag_name,
        });
        element.classList.add('disabled', 'menuitem', 'menuitem-separator');
    }

    /** Return a new menu Element object for the given menu_spec.
     *  @param {object|string} menu_spec specification for menu item or collection.
     *         If a string, then create a separator (regardless of the string contents).
     *  @param {Element} parent
     *  @param {boolean} (optional) toplevel if the menu is the top-level "menubar" menu
     *         default value: false
     *  @return {Element} new menu Element
     *  Also updates this.#menu_id_to_element
     */
    #build_menu(menu_spec, parent, toplevel=false) {
        if (!(parent instanceof Element)) {
            throw new Error('parent must be an instance of Element');
        }
        if (typeof menu_spec === 'string') {
            return this.#build_menu_item_separator(parent);
        }

        const {
            label,
            collection,
            item,
            id: menu_id,
        } = menu_spec;

        if (typeof label !== 'string') {
            throw new Error('label must be specified as a string');
        }
        if (item && collection) {
            throw new Error('item and collection must not both be specified');
        }
        if (collection) {
            if (!Array.isArray(collection)) {
                throw new Error('collection must be an array');
            }
        }
        if (item) {
            if (typeof item !== 'object' || typeof item.command !== 'string') {
                throw new Error('item must specify an object with a string property "command"');
            }
        }
        if (!['undefined', 'string'].includes(typeof menu_id) || menu_id === '') {
            throw new Error('id must be a non-empty string');
        }

        // both items and collections are menuitem elements, but the collection also has children...
        const element = this.#build_menuitem(label, toplevel);

        if (item) {
            this.#add_item_menuitem_annotations_and_click_handler(element, item.command);
        } else {
            // collection
            element.classList.add('collection');

            const collection_element = create_element({
                parent: element,
                tag:    this.constructor.menu_element_tag_name,
            });
            collection_element.classList.add('menu');
            if (!toplevel) {
                const el = create_element({
                    parent: element,
                    attrs: {
                        class: [ 'menuitem-annotation', 'collection-arrow' ],
                    },
                });
                el.textContent = '\u25b8';  // right-pointing triangle
            }
            collection.forEach(spec => this.#build_menu(spec, collection_element));

            if (toplevel) {
                element.addEventListener('click', (event) => {
                    if (event.target.closest('.menuitem') === element) {  // make sure click is not in a child (submenu)
                        if (element.classList.contains('selected')) {
                            this.#deselect_menuitem(element);
                        } else {
                            this.#select_menuitem(element);
                        }
                        event.stopPropagation();
                        event.preventDefault();
                    }
                });
            }
        }

        if (menu_id) {
            this.#menu_id_to_element[menu_id] = element;
        }

        // wait to add to parent until everything else happens without error
        if (parent) {
            parent.appendChild(element);
        }

        return element;
    }

    #build_menuitem(label, toplevel=false) {
        // both items and collections are menuitem elements, but the collection also has children...
        const menuitem = create_element({
            tag: this.constructor.menuitem_element_tag_name,
            attrs: {
                set_id: true,
                class: 'menuitem',
            },
        });

        // add the label
        const lbl = create_element({
            parent: menuitem,
            attrs: {
                class: 'menuitem-label',
            },
        });
        lbl.innerText = label;

        menuitem.addEventListener('mousemove', (event) => {
            // don't pop open top-level menus unless one is already selected
            // this means that the user must click the top-level menu to get things started
            if (!toplevel || this.#menubar_container.querySelector('.selected')) {
                if (!menuitem.classList.contains('disabled')) {
                    this.#select_menuitem(menuitem);
                }
            }
        });
        return menuitem;
    }
    #add_item_menuitem_annotations_and_click_handler(menuitem, command) {
        if (command) {
            const command_bindings = this.get_command_bindings();
            const kbd_bindings = command_bindings[command];
            if (kbd_bindings) {
                const kbd_container = create_element({
                    parent: menuitem,
                    attrs: {
                        class: 'menuitem-annotation',
                    },
                });
                // create <kbd>...</kbd> elements
                kbd_bindings.forEach(binding => {
                    const binding_glyphs = new KeySpec(binding).glyphs;
                    create_element({ parent: kbd_container, tag: 'kbd' }).textContent = binding_glyphs;
                });
            }
        }

        menuitem.addEventListener('click', (event) => {
            this.#deactivate_menu(menuitem.closest('.menubar'));
            const command_context = { command, event, target: event.target };
            this.commands.dispatch(command_context);
            event.stopPropagation();
            event.preventDefault();
        });
    }

    #build_menubar(parent, menubar_spec) {
        const menubar_container = create_element({
            parent,
            tag: this.constructor.menu_element_tag_name,
            attrs: {
                role:     'navigation',
                tabindex: 0,
                class: [ 'active', 'menubar' ],
            },
            before: parent.firstChild,  // prepend
        });
        menubar_spec.forEach(spec => this.#build_menu(spec, menubar_container, true));

        // add event listener to close menu when focus is lost
        menubar_container.addEventListener('blur', (event) => {
            this.#deactivate_menu(menubar_container);
        });

        // add keyboard navigation event listener
        menubar_container.addEventListener('keydown', (event) => {
            const selected_elements = menubar_container.querySelectorAll('.selected');
            if (selected_elements.length <= 0) {
                if (! ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(event.key)) {
                    return;  // do not handle or alter propagation
                } else {
                    // select the first menuitem of the menubar
                    const menubar_first_menuitem = menubar_container.querySelector('.menuitem');
                    if (menubar_first_menuitem) {
                        this.#select_menuitem(menubar_first_menuitem);
                    }
                }
            } else {
                const menuitem = selected_elements[selected_elements.length-1];

                const is_in_menubar = (menuitem.parentElement === menubar_container);

                let key_menu_prev, key_menu_next, key_cross_prev, key_cross_next;
                if (is_in_menubar) {
                    key_menu_prev  = 'ArrowLeft';
                    key_menu_next  = 'ArrowRight';
                    key_cross_prev = 'ArrowUp';
                    key_cross_next = 'ArrowDown';
                } else {
                    key_menu_prev  = 'ArrowUp';
                    key_menu_next  = 'ArrowDown';
                    key_cross_prev = 'ArrowLeft';
                    key_cross_next = 'ArrowRight';
                }

                switch (event.key) {
                case 'Enter':
                case ' ': {
                    menuitem.click();
                    break;
                }
                case 'Escape': {
                    this.#deactivate_menu(menubar_container);
                    break;
                }
                case key_menu_prev: {
                    const mi = this.constructor.find_previous_menuitem(menuitem);
                    if (mi) {
                        this.#select_menuitem(mi);
                    } else if (!is_in_menubar) {
                        menuitem.classList.remove('selected');  // parent menuitem will still be selected
                    }
                    break;
                }
                case key_menu_next: {
                    const mi = this.constructor.find_next_menuitem(menuitem);
                    if (mi) {
                        this.#select_menuitem(mi);
                    }
                    break;
                }
                case key_cross_prev: {
                    if (!is_in_menubar) {
                        const menubar_menuitem = menubar_container.querySelector('.menuitem.selected');
                        const mbi = this.constructor.find_previous_menuitem(menubar_menuitem);
                        if (mbi) {
                            this.#select_menuitem(mbi);
                        }
                    }
                    break;
                }
                case key_cross_next: {
                    let navigated_into_collection = false;
                    if (menuitem.classList.contains('collection')) {
                        // enter collection if possible
                        const mi = menuitem.querySelector('.menuitem:not(.disabled)');
                        if (mi) {
                            this.#select_menuitem(mi);
                            navigated_into_collection = true;
                        }
                    }
                    if (!navigated_into_collection && !is_in_menubar) {
                        const menubar_menuitem = menubar_container.querySelector('.menuitem.selected');
                        const mbi = this.constructor.find_next_menuitem(menubar_menuitem);
                        if (mbi) {
                            this.#select_menuitem(mbi);
                        }
                    }
                    break;
                }

                default:
                    return;  // do not handle or alter propagation
                }
            }

            // if we get here, assume the event was handled and therefore
            // we should stop propagation and prevent default action.
            event.stopPropagation();
            event.preventDefault();
        }, {
            capture: true,
        });

        return menubar_container;
    }
}
