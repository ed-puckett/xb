const current_script_url = import.meta.url;  // save for later

import {
    generate_object_id,
} from '../sys/uuid.js';

import {
    beep,
} from './beep.js';

import {
    assets_server_url,
} from '../../src/assets-server-url.js';


// === ESCAPE TEXT AND HTML ===

export function escape_unescaped_$(s) {
    // Note: add $ to the end and then remove the last two characters ('\\$') from
    // the result.  Why?  Because the RE does not work correctly when the remaining
    // part after a match does not contain a non-escaped $.  This workaround works
    // correctly even if s ends with \.
    const re = /((\\?.)*?)\$/g;
    return (s + '$').replace(re, (...args) => `${args[1]}\\$`).slice(0, -2);
}

/** escape_for_html(s)
 *  convert all '<' and '>' to their corresponding HTML entities
 *  @param {string} string to be converted
 *  @return {string} converted string
 */
export function escape_for_html(s) {
    return s.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** make_string_literal(s)
 *  @param {string} s
 *  @return {string} string representation of a string literal for s
 */
export function make_string_literal(s) {
    return `'${[ ...s ].map(s => s === "'" ? "\\'" : s).join('')}'`;
}


// === TIMEOUT / NEXT TICK UTILITIES ===

export async function delay_ms(ms, resolve_result=undefined) {
    return new Promise(resolve => setTimeout(resolve, (ms ?? 0), resolve_result));
}

export async function next_tick() {
    return new Promise(resolve => setTimeout(resolve));
}

export async function next_micro_tick() {
    return new Promise(resolve => queueMicrotask(resolve));
}


// === DOCUMENT UTILITIES ===

/** temporarily set document.designMode while executing thunk
 *  @param {Boolean} on
 *  @param {Function} thunk zero-parameter function to execute with temporary setting
 *  @return {any} return value of thunk()
 * thunk may be an async function or a regular function.
 */
export async function with_designMode(on, thunk) {
    return new Promise((resolve, reject) => {
        const original_setting = document.designMode;
        document.designMode = (on ? 'on' : 'off');
        delay_ms(0)
            .then(() => thunk())
            .then(thunk_result => delay_ms(0, thunk_result))
            .then(resolve)
            .finally(() => {
                document.designMode = original_setting;
            });
    });
}


// === ELEMENT UTILITIES ===

/** set an event handler on the given textarea so that it automatically resizes based on content
 * @param {HTMLTextAreaElement} textarea
 * The oninput event handler attribute of textarea is changed and used by this function.
 */
export function setup_textarea_auto_resize(textarea, max_height_px=null) {
    if (!(textarea instanceof HTMLTextAreaElement)) {
        throw new Error('textarea must be an instance of HTMLTextAreaElement');
    }
    if (typeof max_height_px !== 'undefined' && max_height_px !== null && (typeof max_height_px !== 'number' || max_height_px <= 0)) {
        throw new Error('max_height_px must be undefined, null, or a positive number');
    }
    const initial_height = (textarea.scrollHeight > 0) ? `${textarea.scrollHeight}px` : '0.5em';
    textarea.setAttribute('style', `height:${initial_height}; overflow-y:hidden;`);
    textarea.oninput = function textarea_input_handler(event) {
        const textarea = event.target.closest('textarea');
        textarea.style.height = '1px';  // prevent height from interfering with scrollHeight
        const cs = window.getComputedStyle(textarea);
        // note: all css dimensional values are floating-point values followed by 'px'
        const paddingY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
        const calculated_height = textarea.scrollHeight - paddingY;
        const new_height = (max_height_px && calculated_height > max_height_px) ? max_height_px : calculated_height;
        textarea.style.height = `${new_height}px`;
    };
}
/** trigger resize on a textarea that was setup for auto resize by
 *  setup_textarea_auto_resize().
 * @param {HTMLTextAreaElement} textarea
 */
export function trigger_textarea_auto_resize(textarea) {
    if (!(textarea instanceof HTMLTextAreaElement)) {
        throw new Error('textarea must be an instance of HTMLTextAreaElement');
    }
    textarea.dispatchEvent(new Event('input'));  // trigger resize
}

/** find the nearest ancestor of node that matches selector
 *  @param {Node} node for which to find nearest ancestor
 *  @param {String} selector to match
 *  @param {Boolean} strict_ancestor if true, then don't return node even if it matches
 *  @return {Element} the ancestor or null if none found
 */
export function find_matching_ancestor(node, selector, strict_ancestor=false) {
    for (let scan = (strict_ancestor ? node.parentNode : node); scan; scan = scan.parentNode) {
        if (scan instanceof Element) {
            if (scan.matches(selector)) {
                return scan;
            }
        }
    }
    return null;  // indicate: not found
}

/** remove all child elements and nodes of element
 *  @param {Node} element
 *  @return {Node} element
 */
export function clear_element(element) {
    if (element instanceof HTMLElement) {
        element.innerText = '';  // removes all child elements and nodes, and their event handlers
    } else if (element instanceof Node) {
        while (element.firstChild) {
            // note that removeChild() does not remove the
            // event handlers from the removed node, but
            // we are letting the node go so it will be
            // garbage-collected soon....
            element.removeChild(element.firstChild);
        }
    } else {
        throw new Error('element must be an instance of Node');
    }
    return element;
}

/** Test if element is in DOM and if any portion of element is visible in viewport.
 * @param {Element} elemnt
 * @return {Boolean} visible in viewport
 */
export function is_in_viewport(element) {
    if (!document.documentElement.contains(element)) {
        return false;
    }
    const w = window.innerWidth  ?? document.documentElement.clientWidth;
    const h = window.innerHeight ?? document.documentElement.clientHeight;
    for (const r of element.getClientRects()) {
        if ( (r.top < h && r.bottom > 0) && (r.left < w && r.right  > 0)) {
            return true;
        }
    }
    return false;  // no rect was visible
}

/** Scroll element into view.
 *  @param  {Element} element
 *  @return {Element} element
 *  //!!! this needs improvement
 */
export function scroll_element_into_view(element) {
    const rect = element.getBoundingClientRect();
    if (rect.bottom > window.innerHeight) {
        window.scrollBy(0, (rect.bottom - window.innerHeight));
    }
    return element;
}

/** set attributes on an element which are taken from an object.
 *  @param {Element} element
 *  @param {Object|undefined|null} attrs
 *  @return {Element} element
 * Attributes specified in attrs with a value of undefined cause the
 * corresponding property to be removed.
 * Attribute values obtained by calling toString() on the values in attrs
 * except that values which are undefined are translated to ''.
 */
export function set_element_attrs(element, attrs) {
    if (attrs) {
        if ('id' in attrs && document.getElementById(_attr_value(attrs.id))) {
            throw new Error(`element already exists with id ${attrs.id}`);
        }
        for (const k in attrs) {
            const v = attrs[k];
            if (typeof v === 'undefined') {
                element.removeAttribute(k);
            } else {
                element.setAttribute(k, _attr_value(v));
            }
        }
    }
    return element;
}

/** add/remove style properties on element
 *  @param {HTMLElement} element
 *  @param {Object} spec collection of properties to add or remove.
 *                  If the value of an entry is null or undefined, then
 *                  the corresponding property is removed.  If the value
 *                  of an entry is null, then the property is removed.
 *                  If the value of an entry is undefined, then that
 *                  entry is ignored.  Otherwise, the value of the
 *                  corresponding property is set.
 *  @return {HTMLElement} element
 */
export function update_element_style(element, spec) {
    for (const name in spec) {
        const value = spec[name];
        if (typeof value !== 'undefined') {
            if (value === null) {
                element.style.removeProperty(name);
            } else {
                element.style.setProperty(name, value);
            }
        }
    }
    return element;
}

function _attr_value(v) {
    return (typeof v === 'undefined') ? '' : v.toString();
}


/** safely set namespaced attributes
 *  @param {Element} element on which to set attribute
 *  @param {String|null} namespace
 *  @param {String} name of attribute
 *  @param {any} value
 * According to MDN, https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttributeNS :
 *     setAttributeNS is the only method for namespaced attributes which
 *     expects the fully qualified name, i.e. "namespace:localname".
 */
export function safe_setAttributeNS(element, namespace, name, value) {
    //!!! is this a correct implementation???
    if (namespace && !name.includes(':')) {
        // use the last non-empty component of the namespace
        //!!! is this correct?
        const namespace_components = new URL(namespace).pathname.split('/');
        const namespace_specfier = namespace_components.findLast(s => s.length > 0);
        name = `${namespace_specfier}:${name}`;
    }
    element.setAttributeNS(namespace, name, value);
}


/** validate the "parent" and "before" properties from options and return their validated values.
 *  @param {null|undefined|Object} options
 *  @param {Class} required_parent_class (default Element)
 *  @return {Object} result: { parent: Node|null, before: Node|null }
 */
export function validate_parent_and_before_from_options(options, required_parent_class=null) {
    const {
        parent: parent_from_options = null,
        before = null,
    } = (options ?? {});

    let parent = parent_from_options;
    if (before && !(before instanceof Node)) {
        throw new Error('before must be null, undefined, or an instance of Node');
    }

    if (before && !before.parentNode) {
        throw new Error('before must have a parent');
    }

    // resolve parent and before
    if (parent) {
        if (before && before.parentElement !== parent) {
            throw new Error('inconsistent parent and before nodes specified');
        }
    } else {
        if (before) {
            parent = before.parentNode;
        }
    }

    if (parent && required_parent_class && !(parent instanceof required_parent_class)) {
        throw new Error(`parent must be null, undefined, or an instance of ${required_parent_class.name}`);
    }

    return { parent, before };
}

/** This is the key under which create_element_mapping() and
 *   create_element(..., true) returns the top-level object.
 */
export const mapping_default_key = 'default';

/** create_element(options=null, return_mapping=false)
 *  create a new element with the given characteristics
 *  @param {Object|undefined|null} options: {
 *      _key?:      String,            // if return_mapping, associate the created element with this value as the key
 *      parent?:    HTMLElement|null,  // parent element, null or undefined for none; may be simply an Element if style not specified
 *      before?:    Node|null,         // sibling node before which to insert; append if null or undefined
 *      tag?:       string,            // tag name for new element; default: 'div'
 *      namespace?: string,            // namespace for new element creation
 *      attrs?:     object,            // attributes to set on new element
 *      style?:     object,            // style properties for new element
 *      set_id?:    Boolean            // if true, allocate and set an id for the element (if id not specified in attrs)
 *      children?:  ELDEF[],           // array of children to create (recursive)
 *      innerText?: string,            // innerText to set on element (invalid if "children" or "innerHTML" specified)
 *      innerHTML?: string,            // innerHTML to set on element (invalid if "children" or "innerText" specified)
 *  }
 *  @param {Boolean} return_mapping (default false)
 *  @return {Element|Object} the new element or the element mapping object
 *
 * A unique id will be assigned to the element unless that element already has
 * an id attribute specified (in attrs).
 * Attributes specified in attrs with a value of undefined are ignored.
 * The before node, if specified, must have a parent that must match parent if
 * parent is specified.
 * If neither parent nor before is specified, the new element will have no parent.
 * Warning: '!important' in style specifications does not work!  (Should use priority method.)
 * The definitions in "children", if specified, should not contain "parent" or "before".
 * attrs may contain a "class" property, and this should be a string or an array of strings,
 * each of which must not contain whitespace.
 *
 * If return_mapping, then return a mapping object from keys found in "_key" properties
 * in the options.  Each of these keys will be mapped to the corresponding object, and
 * mapping_default_key is mapped to the top-level object.  Note that duplicate keys or
 * keys that specify the same value as mapping_default_key will overwrite earlier values.
 * Elements specified in options are created in a post-order traversal of options.children.
 * This means that a _key specified in options as mapping_default_key will not be returned
 * because mapping_default_key is set after traversiing the children.
 */
export function create_element(options=null, return_mapping=false) {
    options ??= {};
    if (typeof options !== 'object') {
        throw new Error('options must be null, undefined, or an object');
    }
    const {
        _key,
        tag = 'div',
        namespace,
        attrs,
        style,
        set_id,
        children,
        innerText,
        innerHTML,
    } = options;

    const {
        parent,
        before,
    } = validate_parent_and_before_from_options(options);

    if (typeof children !== 'undefined' && children !== null) {
        if (!Array.isArray(children) || !children.every(child => ['object', 'string' ].includes(typeof child))) {
            throw new Error('children must be an array of objects');
        }
        if (typeof innerText !== 'undefined' || typeof innerHTML !== 'undefined') {
            throw new Error('"innerText" or "innerHTML" may not be specified if "children" is specified');
        }
    }
    if (typeof innerText !== 'undefined' && typeof innerHTML !== 'undefined') {
        throw new Error('"innerText" or "innerHTML" must not both be specified');
    }

    const element = namespace
          ? document.createElementNS(namespace, tag)
          : document.createElement(tag);

    let element_id_specified = false;
    if (attrs) {
        for (const k in attrs) {
            let v = attrs[k];
            if (k === 'class' && Array.isArray(v)) {
                if (!v.every(c => !c.match(/\s/))) {
                    throw new Error('attrs.class must be a string or an array of strings not containing whitespace');
                }
                v = v.join(' ');
            }
            if (k === 'id') {
                element_id_specified = true;
            }
            if (typeof v !== 'undefined') {
                element.setAttribute(k, v);
            }
        }
    }
    if (!element_id_specified && set_id) {
        element.id = generate_object_id();
    }

    // update style after attrs in case a style attribute is also specified
    if (style) {
        update_element_style(element, style);
    }

    const mapping = return_mapping ? {} : undefined;

    if (children) {
        for (const child_desc of children) {
            if (typeof child_desc === 'string') {
                element.appendChild(document.createTextNode(child_desc));
            } else {
                if (child_desc.parent || child_desc.before) {
                    console.warn('ignoring "parent" and/or "before" specified in child descriptor');
                }
                const child_result = create_element({
                    ...child_desc,
                    parent: element,
                    before: undefined,
                }, return_mapping);

                if (return_mapping) {
                    Object.assign(mapping, child_result);
                }
            }
        }
    }

    for (const [ value, setter ] of [
        [ innerText, (el, v) => { el.innerText = v; } ],
        [ innerHTML, (el, v) => { el.innerHTML = v; } ],
    ]) {
        if (typeof value !== 'undefined') {
            setter(element, value);
        }
    }

    if (return_mapping) {
        mapping[mapping_default_key] = element;
        if ([ 'string', 'symbol' ].includes(typeof _key)) {
            mapping[_key] = element;
        }
    }

    if (parent) {
        parent.insertBefore(element, before);
    }

    return return_mapping ? mapping : element;
}

/** create_element_mapping(options=null)
 *  use create_element() passing return_mapping=true.
 */
export function create_element_mapping(options=null) {
    return create_element(options, true);
}

/** move the given node according to options
 *  @param {Object|undefined|null} options: {
 *      parent?: Node|null,  // parent node, null or undefined for none
 *      before?: Node|null,  // sibling node before which to insert; append if null or undefined
 *  }
 * parent and before cannot both be null/undefined.
 */
export function move_node(node, options=null) {
    if (!(node instanceof Node)) {
        throw new Error('node must be an instance of Node');
    }
    const {
        parent,
        before,
    } = validate_parent_and_before_from_options(options);
    if (!parent) {
        throw new Error('options must specify either "parent" or "before"');
    }
    parent.insertBefore(node, before);
}

/** create or update a child text node of the given element
 *  @param {HTMLElement} element  //!!! may be sufficient to be a Node
 *  @param {any} text to be contained in the new text node
 *  @param {Object|undefined|null} options: {
 *      before?: null|Node,  // child node or element before which to insert; append if null or undefined
 *      prevent_coalesce_next?: boolean,
 *  }
 *  @return {Node|null} the new or modified text node, or null if the converted text is ''
 *
 * Text will be converted to a string (if not already a string).  A text value
 * of null or undefined is equivalent to ''.
 *
 * The text will be coalesced into the immediately previous text node, if any.
 * Otherwise, if the next node is a text node the text will be coealesced
 * into the beginning text of it unless options.prevent_coalesce_next.
 * options.prevent_coalesce_next makes sure that the same options.before
 * node can be used repeatedly with the expected results.  However,
 * options.prevent_coalesce_next may leave element non-normalized.
 * On the other hand, if !options.prevent_coalesce_next, the element
 * will not become non-normalized (but may be non-normalized if it
 * already was).
 * Note that the text is inserted into the document purely as text, and
 * no escaping or cleaning for HTML is performed (it should not be necessary).
 */
export function create_element_child_text_node(element, text, options=null) {
    if (!(element instanceof HTMLElement)) {
        throw new Error('element must be an instance of HTMLElement');
    }

    const {
        before = null,
        prevent_coalesce_next,
    } = (options ?? {});

    if (before !== null && !(before instanceof Node)) {
        throw new Error('before must be null or an instance of Node');
    }
    if (before && before.parentNode !== element) {
        throw new Error('before must be a child of element');
    }

    if (typeof text !== 'string') {
        text = `${text ?? ''}`;
    }
    if (!text) {
        return null;
    }

    let node;  // this will be the node that contains the text
    if (!node) {
        const previous = before ? before.previousSibling : element.lastChild;
        if (previous?.nodeType === Node.TEXT_NODE) {
            previous.nodeValue += text;
            node = previous;
        }
    }
    if (!node && before && !prevent_coalesce_next) {  // if no before then there will be no next node
        const next = before;
        if (next.nodeType === Node.TEXT_NODE) {
            next.nodeValue = text + next.nodeValue;
            node = next;
        }
    }
    if (!node) {
        node = document.createTextNode(text);
        element.insertBefore(node, before);
    }

    return node;
}

/** normalize the text node children of element, meaning that text nodes
 *  are non-empty and no text nodes are adjacent.
 *  @param {Element} element
 *  @return {Element} element
 */
export function normalize_element_text(element) {
    element.normalize();
    return element;
}

/** create_stylesheet_link(parent, stylesheet_url, attrs)
 *  @param {Element} parent
 *  @param {string} stylesheet_url
 *  @param {Object|undefined|null} attrs
 *  @param {boolean} permit_duplication if true then do not recreate element if already present
 *  @return {HTMLElement} the new <link> element
 */
export function create_stylesheet_link(parent, stylesheet_url, attrs=null, permit_duplication=false) {
    if (!(parent instanceof Element)) {
        throw new Error('parent must be an Element');
    }
    attrs = attrs ?? {};
    if ('rel' in attrs || 'href' in attrs) {
        throw new Error('attrs must not contain "rel" or "href"');
    }
    let link_element;
    if (!permit_duplication) {
        // note that the duplication does not take into account attrs
        link_element = parent.querySelector(`link[rel="stylesheet"][href="${stylesheet_url.toString().replaceAll('"', '\\"')}"]`);
        // make sure link_element that was found is a direct child of parent
        if (link_element?.parentElement !== parent) {
            link_element = null;
        }
    }
    return link_element ?? create_element({
        parent,
        tag: 'link',
        attrs: {
            rel: "stylesheet",
            href: stylesheet_url,
            ...attrs,
        },
    });
}

/** create_inline_stylesheet(parent, stylesheet_text, attrs)
 *  @param {Element} parent
 *  @param {string} stylesheet_text
 *  @param {Object|undefined|null} attrs
 *  @return {HTMLStyleElement} the new <style> element
 */
export function create_inline_stylesheet(parent, stylesheet_text, attrs) {
    if (!(parent instanceof Element)) {
        throw new Error('parent must be an Element');
    }
    const style_el = create_element({
        tag: 'style',
        attrs,
    });
    style_el.appendChild(document.createTextNode(stylesheet_text));
    parent.appendChild(style_el);
    return style_el;
}

/** create_script(parent, script_url, attrs=null, permit_duplication=false)
 *  @param {Element} parent
 *  @param {string} script_url
 *  @param {Object|undefined|null} attrs
 *  @param {boolean} permit_duplication if true then do not recreate element if already present
 *  @return {HTMLStyleElement} the new <style> element
 */
export function create_script(parent, script_url, attrs=null, permit_duplication=false) {
    if (!(parent instanceof Element)) {
        throw new Error('parent must be an Element');
    }
    attrs = attrs ?? {};
    if ('src' in attrs) {
        throw new Error('attrs must not contain "src"');
    }
    let script_element;
    if (!permit_duplication) {
        // note that the duplication does not take into account attrs
        script_element = parent.querySelector(`script[src="${script_url.toString().replaceAll('"', '\\"')}"]`);
        // make sure script_element that was found is a direct child of parent
        if (script_element?.parentElement !== parent) {
            script_element = null;
        }
    }
    return script_element ?? create_element({
        parent,
        tag: 'script',
        attrs: {
            src: script_url,
            ...attrs,
        },
    });
}

/** create_inline_script(parent, script_text, attrs)
 *  @param {Element} parent
 *  @param {string} script_text
 *  @param {Object|undefined|null} attrs
 *  @return {HTMLScriptElement} the new <script> element
 */
export function create_inline_script(parent, script_text, attrs) {
    if (!(parent instanceof Element)) {
        throw new Error('parent must be an Element');
    }
    if (attrs && 'src' in attrs) {
        throw new Error('attrs must not contain "src"');
    }
    const script_el = create_element({
        tag: 'script',
        attrs,
    });
    script_el.appendChild(document.createTextNode(script_text));
    parent.appendChild(script_el);
    return script_el;
}


// === SCRIPT LOADING ===

const _script_promise_data = {};  // map: url -> { promise?: Promise, resolve?: any=>void, reject?: any=>void }

// _establish_script_promise_data(script_url) returns
// { promise_data, initial } where promise_data is
// _script_promise_data[script_url] and initial is true
// iff the promise was newly created.
function _establish_script_promise_data(full_script_url) {
    const data_key = full_script_url.toString();
    let promise_data = _script_promise_data[data_key];
    let initial;
    if (promise_data) {
        initial = false;
    } else {
        promise_data = {};
        promise_data.promise = new Promise((resolve, reject) => {
            promise_data.resolve = resolve;
            promise_data.reject  = reject;
        });
        _script_promise_data[data_key] = promise_data;
        initial = true;
    }
    return { initial, promise_data };
}

/** async function load_script(parent, script_url, attrs=null, permit_duplication=false)
 *  @param {Node} parent the parent element for script
 *  @param {string} script_url url of script to load (the script tag will be created without defer or async attributes)
 *  @param {Object|undefined|null} attrs
 *  @param {boolean} permit_duplication if true then do not recreate element if already present
 *  @return {Promise}
 *  Use this to load a script and wait for its 'load' event.
 *  Only the first invokation for a particular script_url will create
 *  the script element.  Others will simply wait for the script to load
 *  or for error.
 */
export async function load_script(parent, script_url, attrs=null, permit_duplication=false) {
    const full_script_url = new URL(script_url, assets_server_url(current_script_url));
    const { promise_data, initial } = _establish_script_promise_data(full_script_url);
    if (initial) {
        let script_el;
        function script_load_handler(event) {
            promise_data.resolve?.();
            reset();
        }
        function script_load_error_handler(event) {
            promise_data.reject?.(new Error(`error loading script ${full_script_url}`));
            reset();
        }
        function reset() {
            if (script_el) {
                script_el.removeEventListener('load',  script_load_handler);
                script_el.removeEventListener('error', script_load_error_handler);
            }
            promise_data.resolve = null;
            promise_data.reject  = null;
        }
        try {
            script_el = create_script(parent, full_script_url, attrs, permit_duplication);
            script_el.addEventListener('load',  script_load_handler,       { once: true });
            script_el.addEventListener('error', script_load_error_handler, { once: true });
        } catch (err) {
            promise_data.reject?.(err);
            reset();
        }
    }
    return promise_data.promise;
}

/** async function load_script_and_wait_for_condition(parent, script_url, condition_poll_fn, attrs=null, permit_duplication=false)
 *  @param {Node} parent the parent element for script
 *  @param {string} script_url url of script to load (the script tag will be created without defer or async attributes)
 *  @param {() => boolean} condition_poll_fn function that will return true when script has loaded
 *  @param {Object|undefined|null} attrs
 *  @param {boolean} permit_duplication if true then do not recreate element if already present
 *  @return {Promise}
 *  Use this to load a script where you want to poll for condition
 *  that will be triggered asynchronously by the script, in which
 *  case waiting for the load event will not work because it fires
 *  when script execution completes but not when some later condition
 *  is triggered asynchronously by the script.
 *  Only the first invokation for a particular script_url will create
 *  the script element.  Others will simply wait for the script to load
 *  or for error.
 */
export async function load_script_and_wait_for_condition(parent, script_url, condition_poll_fn, attrs=null, permit_duplication=false) {
    const full_script_url = new URL(script_url, assets_server_url(current_script_url));
    const { promise_data, initial } = _establish_script_promise_data(full_script_url);
    if (initial) {
        let script_el;
        let wait_timer_id;
        function script_load_error_handler(event) {
            promise_data.reject?.(new Error(`error loading script ${full_script_url}`));
            reset();
        }
        function wait() {
            if (condition_poll_fn()) {
                promise_data.resolve?.();
                reset();
            } else {
                wait_timer_id = setTimeout(wait);  // check again on next tick
            }
        }
        function reset() {
            if (typeof wait_timer_id !== 'undefined') {
                clearTimeout(wait_timer_id);
                wait_timer_id = undefined;
            }
            if (script_el) {
                script_el.removeEventListener('error', script_load_error_handler);
            }
            promise_data.resolve = null;
            promise_data.reject  = null;
        }
        try {
            script_el = create_script(parent, full_script_url, attrs, permit_duplication);
            script_el.addEventListener('error', script_load_error_handler, { once: true });
            wait();
        } catch (err) {
            promise_data.reject?.(err);
            reset();
        }
    }
    return promise_data.promise;
}


// === NODE OFFSET IN PARENT ===

export function find_child_offset(child) {
    const parent_child_nodes = child?.parentNode?.childNodes;
    if (!parent_child_nodes) {
        return undefined;
    } else {
        return Array.prototype.indexOf.call(parent_child_nodes, child);
    }
}


// === SELECTION/POINT ===

export function set_selection_focus(node, offset) {
    window.getSelection().setBaseAndExtent(node, offset, node, offset);
}

export function save_current_selection() {
    const selection = window.getSelection();
    const {
        anchorNode,
        anchorOffset,
        focusNode,
        focusOffset,
    } = selection;
    const ranges = [];
    for (let i = 0; i < selection.rangeCount; i++) {
        ranges.push(selection.getRangeAt(i).cloneRange());
    }
    return {
        anchorNode,
        anchorOffset,
        focusNode,
        focusOffset,
        ranges,
    };
}

export function restore_selection(saved) {
    const selection = window.getSelection();
    selection.removeAllRanges();
    for (const range of saved.ranges) {
        selection.addRange(range);
    }
    selection.setBaseAndExtent(
        saved.anchorNode, saved.anchorOffset,
        saved.focusNode, saved.focusOffset
    );
}

export function manage_selection_for_insert(updater) {
    const selection = window.getSelection();
    selection?.deleteFromDocument();  // delete current selection, if any
    let point = {
        node:   selection?.focusNode   ?? null,
        offset: selection?.focusOffset ?? 0,
    };
    point = updater(point);
    if (!point) {
        throw new Error('updater must return { node, offset } for the new point');
    }
    selection.setBaseAndExtent(point.node, point.offset, point.node, point.offset);
    return true;  // indicate: success
}

export function manage_selection_for_delete(updater) {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
        selection.deleteFromDocument();
        // leave selection in the resultant collapsed state
    } else {
        let point = {
            node:   selection?.focusNode   ?? null,
            offset: selection?.focusOffset ?? 0,
        };
        point = updater(point);
        if (!point) {
            beep();  // there was nothing to delete
        } else {
            selection.setBaseAndExtent(point.node, point.offset, point.node, point.offset);
        }
    }
    return true;  // indicate: success
}

// modifies point, returns true iff successful
export function move_point_forward(point) {
    if (!point?.node) {
        return false;  // nowhere to move from
    }
//!!! check this:
    const child_count = (point.node.nodeType === Node.TEXT_NODE) ? point.node.length : point.node.childNodes.length;
    if (point.offset < child_count) {
        point.offset++;  // new point is within same (Text) node
        return true;
    } else {
        const tree_walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
        tree_walker.currentNode = point.node;
        point.node = tree_walker.nextNode();
        if (!point.node) {
            point.offset = 0;
            return false;
        }
        if (point.node.nodeType === Node.TEXT_NODE) {
            point.offset = 0;
        } else {
            // must point to this Element node from its parent
            point.offset = find_child_offset(point.node);
            point.node = point.node.parentNode;
        }
        return true;
    }
}

// modifies point, returns true iff successful
export function move_point_reverse(point) {
    if (!point?.node) {
        return false;  // nowhere to move from
    }
    if (point.offset > 0) {
        point.offset--;  // new point is within same node
        return true;
    } else {
        const tree_walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);
        tree_walker.currentNode = point.node;
        point.node = tree_walker.previousNode();
        if (!point.node) {
            point.offset = 0;
            return false;
        }
        if (point.node.nodeType === Node.TEXT_NODE) {
            point.offset = point.node.length;
        } else {
            // must point to this Element node from its parent
            point.offset = find_child_offset(point.node);
            point.node = point.node.parentNode;
        }
        return true;
    }
}

// modifies point, returns true iff successful
export function move_point(point, reverse=false) {
    return (reverse ? move_point_reverse : move_point_forward)(point);
}

// returns new point { node, offset } if successful, otherwise null
export function insert_at(point, thing) {
    if (typeof point !== 'object') {
        throw new Error('point must be an object');
    }
    let { node, offset } = point;
    if (!node) {
        return null;
    }
    if (typeof thing !== 'undefined' && thing !== null) {
        if (typeof thing === 'string') {
            if (node instanceof Text) {
                node.data = `${node.data.substring(0, offset)}${thing}${node.data.substring(offset)}`;
                // update offset
                offset += thing.length;
            } else {
                const text_node = document.createTextNode(thing);
                node.insertBefore(text_node, node.childNodes[offset]);
                // update offset
                offset++;
            }
        } else if (thing instanceof Node) {
            // note that thing may be a DocumentFragment here
            if (node instanceof Text) {
                //!!! could be more careful not to create empty text nodes here
                const next_node = node.splitText(offset);
                node.parentNode.insertBefore(thing, next_node);
                // update node, offset
                node = next_node;
                offset = 0;
            } else {
                node.insertBefore(thing, node.childNodes[offset]);
                offset++;
            }
        } else {
            throw new Error('thing must be a string or an instance of Node');
        }
    }
    return { node, offset };
}

// returns new point { node, offset } if successful, otherwise null
export function delete_nearest_leaf(point, options=null) {
    const { element_too, reverse } = options ?? {};

    // validate point
    let { node, offset } = point ?? {};
    if ( !(node instanceof Node) ||
         (node.nodeType !== Node.TEXT_NODE && node.nodeType !== Node.ELEMENT_NODE) ||
         typeof offset !== 'number' ||
         offset < 0 ||
         offset > ((node.nodeType === Node.TEXT_NODE) ? node.length : node.childNodes.length)
       ) {
        throw new Error('invalid point');
    }

    for (;;) {
        // if node is a non-empty Text and offset is within range then handle directly here
        if (node.nodeType === Node.TEXT_NODE && node.length > 0) {
            if (reverse) {
                if (offset > 0) {
                    offset--;
                    node.data = node.data.substring(0, offset) + node.data.substring(offset+1);
                    return { node, offset };
                }
            } else {
                if (offset < node.length) {
                    node.data = node.data.substring(0, offset) + node.data.substring(offset+1);
                    return { node, offset };
                }
            }
        }

        // At this point node is a Text node only if the deletion is to happen
        // outside it (i.e., the offset was out of the node's bounds), in which
        // case the we assume the offset indicated just one character outside
        // (otherwise, the original point was invalid).
        if (node.nodeType === Node.ELEMENT_NODE) {
            // shift to node at given offset
            node = node.childNodes[offset];
            if (!node) {
                return { node, offset: 0 };
            }
            if (reverse) {
                const child_count = (node.nodeType === Node.TEXT_NODE) ? node.length : node.childNodes.length;
                offset = child_count;
            } else {
                offset = 0;
            }
            continue;  // reprocess with new node, offset
        }

        break;
    }

    // if node is an empty (leaf) Element then handle directly here
    if (node.nodeType === Node.ELEMENT_NODE && !node.hasChildNodes()) {
        const new_point = { node: node.parentNode, offset: find_child_offset(node) };
        node.parentNode.removeChild(node);
        return new_point;
    }

    // use a TreeWalker to find a non-empty Text or a leaf Element
    const tree_walker_filter = element_too
          ? NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT
          : NodeFilter.SHOW_TEXT;
    const tree_walker = document.createTreeWalker(document.body, tree_walker_filter, {
        acceptNode(node) {
            // accept only non-empty Text nodes or empty (leaf) Element nodes
            // (the characters in Text nodes are "leaf" items)
            if ( (node.nodeType === Node.TEXT_NODE    && node.length > 0) ||
                 (node.nodeType === Node.ELEMENT_NODE && (!node.hasChildNodes() || [ ...node.childNodes ].every(n => n.nodeType === Node.TEXT_NODE && n.length <= 0)))
               ) {
                return NodeFilter.FILTER_ACCEPT;
            } else {
                return NodeFilter.FILTER_SKIP;
            }
        }
    });
    tree_walker.currentNode = node;
    node = reverse ? tree_walker.previousNode() : tree_walker.nextNode();
    if (!node) {
        return null;  // nothing found
    } else {
        if (node.nodeType === Node.TEXT_NODE) {
            offset = reverse ? node.length-1 : 0;
            node.data = node.data.substring(0, offset) + node.data.substring(offset+1);
            return { node, offset };
        } else {
            const new_point = { node: node.parentNode, offset: find_child_offset(node) };
            node.parentNode.removeChild(node);
            return new_point;
        }
    }
}


// === MISC ===

export function is_text_direction_ltr(element) {
    const dir_str = document.defaultView?.getComputedStyle?.(element)?.direction;
    switch (dir_str) {
    case 'ltr':  return true;
    case 'rtl':  return false;
    case 'auto': return true;
    default:     throw new Error('unexpected direction value');
    }
}
