import {
    Renderer,
} from './renderer.js';

import {
    LogbookManager,
} from '../logbook-manager.js';

import {
    katex,
} from './katex/_.js';


export class TeXRenderer extends Renderer {
    static type = 'tex';

    /** Render the given TeX source to ocx.
     * @param {OutputContext} ocx,
     * @param {String} tex,
     * @param {Object|undefined|null} options: {
     *     style?:        Object,  // css style to be applied to output element
     *     global_state?: Object,  // global_state for evaluation; default: LogbookManager.singleton.global_state
     * }
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async render(ocx, tex, options=null) {
        tex ??= '';

        const {
            style,
            global_state = LogbookManager.singleton.global_state,
        } = (options ?? {});

        const markup = this.constructor.render_to_string(tex, global_state, {
            displayMode:  true,
            throwOnError: false,
        });

        const parent = ocx.create_child({
            attrs: {
                'data-type': this.type,
            },
            style,
        });
        parent.innerHTML = markup;

        return parent;
    }

    static render_to_string(tex, global_state, katex_options=null) {
        // this function encapsulates how the "macros" options is gotten from global_state
        katex_options ??= {};
        katex_options.macros ??= (global_state[this.type] ??= {});  // for persistent \gdef macros
        return katex.renderToString(tex, katex_options);
    }
}
