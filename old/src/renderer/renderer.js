import {
    StoppableObjectsManager,
} from '../../lib/sys/stoppable.js';

import {
    renderer_class_from_type,
    get_renderer_classes,
    set_renderer_classes,
    reset_to_initial_renderer_classes,
    add_renderer_class,
    remove_renderer_class,
} from './_.js';


export class Renderer extends StoppableObjectsManager {
    /** type which instances handle, to be overridden in subclasses
     */
    static type;

    /** get the type specified by the class
     */
    get type (){ return this.constructor.type; }

    /** implementation of rendering, to be implemented by subclasses
     * @param {OutputContext} ocx,
     * @param {any} value,  // value appropriate to type (determined by subclass)
     * @param {Object|undefined|null} options: {
     *     style?:        Object,   // css style to be applied to output element
     *     inline?:       Boolean,  // render inline vs block?
     *     global_state?: Object,   // global_state for evaluation; default: LogbookManager.singleton.global_state
     * }
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async render(ocx, value, options=null) {
        throw new Error('MUST BE IMPLEMENTED IN SUBCLASS');
    }

    static reset_classes()             { reset_to_initial_renderer_classes(); }

    static class_from_type(type)       { return renderer_class_from_type(type); }
    static get_classes()               { return get_renderer_classes(); }
    static set_classes(new_classes)    { set_renderer_classes(new_classes); }
    static add_class(rc)               { add_renderer_class(rc); }
    static remove_class(rc)            { remove_renderer_class(rc); }

    static get_class_types()           { return get_renderer_classes().map(rc => rc.type); }
    static remove_class_for_type(type) { return this.remove_class(this.class_from_type(type)); }
}
