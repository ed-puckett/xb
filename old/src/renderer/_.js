// Renderer is defined in a separate file to break dependency cycle in get_renderer_classes()

import {
    Renderer as imported_Renderer,
} from './renderer.js';

export const Renderer = imported_Renderer;  // re-export base class

import { TextRenderer        } from './text-renderer.js';
import { ErrorRenderer       } from './error-renderer.js';
import { MarkdownRenderer    } from './markdown-renderer.js';
import { TeXRenderer         } from './tex-renderer.js';
import { JavaScriptRenderer  } from './javascript-renderer/_.js';
import { ImageDataRenderer   } from './image-data-renderer.js';
import { GraphvizRenderer    } from './graphviz-renderer.js';
import { PlotlyRenderer      } from './plotly-renderer.js';
import { CanvasImageRenderer } from './canvas-image-renderer.js';

const initial_renderer_classes = [
    TextRenderer,
    ErrorRenderer,
    MarkdownRenderer,
    TeXRenderer,
    JavaScriptRenderer,
    ImageDataRenderer,
    GraphvizRenderer,
    PlotlyRenderer,
    CanvasImageRenderer,
];

/**
 * @param {any} thing to test
 * @return {Boolean} whether or not thing is a strict subclass of Renderer
 */
function is_renderer_subclass(thing) {
    return (thing?.prototype instanceof Renderer);
}


// === RENDERER CLASSES STATE (INITIALIZED BELOW) ===

let renderer_classes;            // Array of Renderer subclasses, priority order, all with unique type properties
let type_to_renderer_class_map;  // Map type->RendererClass, derived from current renderer_classes


// === RENDERER CLASSSES ACCESS/UPDATE ===

export function renderer_class_from_type(type) {
    return type_to_renderer_class_map.get(type);
}

export function get_renderer_classes() {
    return [ ...renderer_classes ];
}

/** set a new collection of Renderer classes
 *  @param {Renderer[]} new_renderer_classes an array of Renderer classes
 * new_renderer_classes must not contain renderers with duplicated types
 * ErrorRenderer will be added to the list if no "error" renderer is specified.
 * This is done so that, at the very least, an error renderer will be available
 * when evaluating.
 */
export function set_renderer_classes(new_renderer_classes) {
    if (!Array.isArray(new_renderer_classes)) {
        throw new Error('new_renderer_classes must be an Array');
    }
    const types_seen = new Set();
    let error_renderer_seen = false;
    for (const rc of new_renderer_classes) {
        if (!is_renderer_subclass(rc)) {
            throw new Error('new_renderer_classes must be an Array of Renderer subsclasses');
        }
        if (types_seen.has(rc.type)) {
            throw new Error(`new_renderer_classes contains multiple entries with type "${rc.type}"`);
        }
        if (rc.type === ErrorRenderer.type) {
            error_renderer_seen = true;
        }
        types_seen.add(rc.type);
    }
    // validation passed, establish new state
    if (!error_renderer_seen) {
        // make sure that an error renderer is always available
        new_renderer_classes = [ ...new_renderer_classes, ErrorRenderer ];
    }
    renderer_classes = [ ...new_renderer_classes ];
    type_to_renderer_class_map =
        new Map(
            renderer_classes.map(renderer_class => {
                return [ renderer_class.type, renderer_class ];
            })
        );
}

export function reset_to_initial_renderer_classes() {  // called in initialization below
    set_renderer_classes(initial_renderer_classes);
}

export function add_renderer_class(renderer_class) {
    if (!is_renderer_subclass(renderer_class)) {
        throw new Error('renderer_class must be a subclass of Renderer');
    }
    const new_renderer_classes = [
        renderer_class,
        ...renderer_classes.filter(rc => rc.type !== renderer_class.type),
    ];
    set_renderer_classes(new_renderer_classes);
}

export function remove_renderer_class(renderer_class) {
    const new_renderer_classes = renderer_classes.filter(rc => rc.type !== renderer_class.type);
    set_renderer_classes(new_renderer_classes);
}


// === INITIALIZATION ===

reset_to_initial_renderer_classes();
