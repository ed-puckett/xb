const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from 'lib/sys/assets-server-url';

const lib_dir_path = '../../../lib/';
const src_dir_path = '../../../src/';
const lib_dir_url  = new URL(lib_dir_path, assets_server_url(current_script_url));
const src_dir_url  = new URL(src_dir_path, assets_server_url(current_script_url));

// provide an implementation of dynamic import that is safe from modification by webpack
const dynamic_import = new Function('path', 'return import(path);');


// ======================================================================
//!!!
// CODE EVALUATION
// ---------------
// Within the code given for evaluation, "this" references the context
// derived from the global_state property of the options passed to the
// eval() method.
//
// vars(...objects) assigns new properties to "this" within the code),
// The return value is a array of the arguments which will be unmodified.
//
// A return statement within a cell terminates the evaluation (except
// for asynchronous parts that have already been evaluated), and the
// value passed to the return statement becomes the synchronous result
// of the evaluation.
//
// eval_environment
// -----------------
// During evaluation, a number of other values are available "globally",
// though these values do not persist after the particular evaluation
// (except for references from async code started during the evaluation).
// These values include ocx (an instance of OutputContextLike which provides
// utilities for manipulation of the output of the cell), various graphics,
// etc functions.  Also included are:
//
//     println:        prints its argument followed by newline
//     printf:         implementation of std C printf()
//     sprintf:        implementation of std C sprintf()
//     import_lib:     import other libraries from the lib/ directory
//     vars:           export new "global" properties
//     is_stopped:     determine if the evaluation has been stopped
//     delay_ms:       return a Promise that resolves after a specified delay
//     create_worker:  create a new EvalWorker instance
//
// These all continue to be available even after the evaluation has
// returned if there are any async operations still active.
// See the method #create_eval_environment().
// ======================================================================

const AsyncFunction          = Object.getPrototypeOf(async function () {}).constructor;
const AsyncGeneratorFunction = Object.getPrototypeOf(async function* () {}).constructor;

import {
    ApplicationBasedRenderer,
    TextBasedRenderer,
} from 'src/renderer/renderer';

import {
    _initial_text_renderer_factories,
} from 'src/renderer/factories';

import {
    TextBasedRendererOptionsType,
} from 'src/renderer/text/types';

import {
    ErrorRendererValueType,
    ErrorRendererOptionsType,
} from 'src/renderer/application/types';

import {
    ErrorRenderer,
} from 'src/renderer/application/error-renderer';

import {
    OutputContextLike,
} from 'src/output-context/types';

import {
    Activity,
} from 'lib/sys/activity-manager';

import {
    EvalWorker,
} from './eval-worker/_';

import {
    load_d3,
} from 'src/renderer/application/d3';

import {
    load_Plotly,
} from 'src/renderer/application/plotly';

import {
    load_Algebrite,
} from 'lib/sys/algebrite';

import * as rxjs from 'rxjs';

import * as canvas_tools from 'lib/ui/canvas-tools';


export class JavaScriptRenderer extends TextBasedRenderer {
    static get type (){ return 'javascript'; }

    static {
        // required for all TextBasedRenderer extensions
        _initial_text_renderer_factories.push(this);
    }

    /** Render by evaluating the given code and outputting to ocx.
     * @param {OutputContextLike} ocx,
     * @param {String} code,
     * @param {TextBasedRendererOptionsType|undefined} options,
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async _render(ocx: OutputContextLike, code: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        const {
            style,
            inline,
            global_state = ocx.xb.global_state,
            background   = false,
        } = (options ?? {});

        const eval_context = ((global_state as any)[this.type] ??= {});

        let eval_ocx = ocx;

        // if !style && inline, then use the given ocx,
        // otherwise, if style || !inline, create a new ocx
        if (style || !inline) {
            eval_ocx = ocx.create_child_ocx({
                tag: inline ? 'span' : 'div',
                attrs: {
                    'data-source-media-type': this.media_type,
                },
                style,
            });
        }

        const eval_environment = await this.#create_eval_environment(eval_context, eval_ocx, code);
        const eval_environment_entries = Object.entries(eval_environment);

        // create an async generator with the given code as the heart of its
        // body, and with parameters being the keys of eval_environment.
        // Then, the code will be evaluated by applying the function to the
        // corresponding values from eval_environment.  Note that evaluation
        // will be performed in the JavaScript global environment and that
        // eval_environment is effected via the function parameters/arguments.
        const eval_fn_params = eval_environment_entries.map(([k, _]) => k);
        const eval_fn_args   = eval_environment_entries.map(([_, v]) => v);

        // evaluate the code:
        const eval_fn_this = eval_context;
        // add newline to code to prevent problems in case the last line is a // comment
        // use bg() defined by #create_eval_environment() for background processing
        const code_to_run = background ? `bg(async () => { ${code}\n });` : code+'\n';
        const eval_fn_body = `try { ${code_to_run} } catch (error) { await ocx.render_error(error, { abbreviated: true }); }`;
        const eval_fn = new AsyncGeneratorFunction(...eval_fn_params, eval_fn_body);
        const result_stream = eval_fn.apply(eval_fn_this, eval_fn_args);

        // note that using for await ... of misses the return value and we
        // want to process that, too.  Therefore, instead of the following:
        //
        // for await (const result of result_stream) {
        //     if (typeof result !== 'undefined') {
        //         await eval_environment.render_value(result);
        //     }
        // }
        //
        // we consume the stream "manually":

        eval_loop:
        while (!eval_ocx.stopped) {
            let value, done;
            try {
                ({ value, done } = await result_stream.next());
            } catch (error) {
                ErrorRenderer.render_sync(eval_ocx, error);
                break eval_loop;
            }

            // output any non-undefined values that were received either from
            // a return or a yield statement in the code
            if (typeof value !== 'undefined') {
                if (done) {
                    // this was the return value, so precede with a special demarcation
                    await eval_environment.render_text('\n>>> ');
                }

                await eval_environment.render_value(value);
            }

            if (done) {
                break eval_loop;
            }
        }

        return eval_ocx.element;
    }

    async #create_eval_environment(eval_context: object, ocx: OutputContextLike, source_code: string) {
        const d3 = await load_d3();

        function is_stopped() {
            return ocx.stopped;
        }

        function keepalive(keepalive: boolean = true) {
            ocx.keepalive = keepalive;
        }

        async function bg(thunk: () => any, set_keepalive: boolean = true) {
            const error_handler = (error: unknown) => { ocx.render_error(error); }
            try {
                if (set_keepalive) {
                    keepalive();
                }
                let promise: undefined|Promise<any> = undefined;
                if (thunk instanceof AsyncFunction) {
                    promise = thunk();
                } else if (thunk instanceof Function) {
                    promise = (async () => thunk())();
                } else {
                    throw new Error('thunk must be a function or an async function');
                }
                // it is important to catch errors here to prevent unhandled rejections
                return promise?.catch(error_handler);
            } catch (error: unknown) {
                error_handler(error);
            }
        }

        async function create_worker(options?: object) {
            const worker = new EvalWorker(options);  // is an Activity; multiple_stops = false
            ocx.manage_activity(worker);
            return worker;
        }

        async function import_lib(lib_path: string) {
            return dynamic_import(new URL(lib_path, lib_dir_url));
        }
        async function import_src(src_path: string) {
            return dynamic_import(new URL(src_path, src_dir_url));
        }
        async function import_location(location_relative_path: string) {
            return dynamic_import(new URL(location_relative_path, document.location.href));
        }

        function vars(...objects: object[]) {
            Object.assign((eval_context as any), ...objects);
            return objects;
        }

        const eval_environment = {
            ocx,
            source_code,  // this evaluation's source code

            // Renderer, etc classes
            TextBasedRenderer,
            ApplicationBasedRenderer,

            d3,  // for use with Plotly
            load_Plotly,
            load_Algebrite,
            rxjs,

            // utility functions defined above
            is_stopped,      // no abort_if_stopped()....
            keepalive:       ocx.AIS(keepalive),
            bg,              // don't wrap with AIS because that will cause an unhandled rejection if stopped
            create_worker:   ocx.AIS(create_worker),
            import_lib:      ocx.AIS(import_lib),
            import_src:      ocx.AIS(import_src),
            import_location: ocx.AIS(import_location),
            vars:            ocx.AIS(vars),

            // external
            sprintf:         ocx.sprintf.bind(ocx),

            // sleep, etc
            sleep:           ocx.sleep.bind(ocx),
            delay_ms:        ocx.delay_ms.bind(ocx),
            next_tick:       ocx.next_tick.bind(ocx),
            next_micro_tick: ocx.next_micro_tick.bind(ocx),

            // output functions defined by ocx
            render_text:     ocx.render_text.bind(ocx),
            render_error:    ocx.render_error.bind(ocx),
            render_value:    ocx.render_value.bind(ocx),
            println:         ocx.println.bind(ocx),
            printf:          ocx.printf.bind(ocx),
            print__:         ocx.print__.bind(ocx),

            // code and graphics rendering defined by ocx
            javascript:      ocx.javascript.bind(ocx),
            markdown:        ocx.markdown.bind(ocx),
            tex:             ocx.tex.bind(ocx),
            image_data:      ocx.image_data.bind(ocx),
            graphviz:        ocx.graphviz.bind(ocx),
            plotly:          ocx.plotly.bind(ocx),
            canvas_image:    ocx.canvas_image.bind(ocx),
            canvas_tools,
        };

        return eval_environment;
    }
}
