import {
    _initial_text_renderer_factories,
} from 'src/renderer/factories';

import {
    RendererFactory,
    TextBasedRenderer,
} from 'src/renderer/renderer';

import {
    TextBasedRendererOptionsType,
} from 'src/renderer/text/types';

import {
    ErrorRenderer,
} from 'src/renderer/application/error-renderer';

import {
    TeXRenderer,
} from 'src/renderer/text/tex-renderer';

import {
    OutputContextLike,
} from 'src/output-context/types';

import {
    marked,
} from './marked';

import {
    generate_object_id,
} from 'lib/sys/uuid';


// TeX handling adapted from: marked-katex-extension/index.js
// https://github.com/UziTech/marked-katex-extension/blob/main/src/index.js
// See also: https://marked.js.org/using_pro#async

const extension_name__inline_tex = 'inline-tex';
const extension_name__block_tex  = 'block-tex';
const extension_name__eval_code  = 'eval-code';

type walkTokens_token_type = {
    type?:         string,
    raw?:          string,
    text?:         string,
    markup?:       string,
    global_state?: object,
    show?:         boolean,
    background?:   boolean,
    source_type?:  string,
};

export class MarkdownRenderer extends TextBasedRenderer {
    static get type (){ return 'markdown'; }

    static {
        // required for all TextBasedRenderer extensions
        _initial_text_renderer_factories.push(this);
    }

    /** Render by evaluating the given markdown and outputting to ocx.
     * @param {OutputContextLike} ocx,
     * @param {String} markdown,
     * @param {TextBasedRendererOptionsType|undefined} options,
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async _render(ocx: OutputContextLike, markdown: string, options?: TextBasedRendererOptionsType): Promise<Element> {
        markdown ??= '';

        const {
            style,
            inline,
            global_state = ocx.xb.global_state,
        } = (options ?? {});

        const parent = ocx.create_child({
            tag: inline ? 'span' : 'div',
            attrs: {
                'data-source-media-type': this.media_type,
            },
            style,
        });

        let deferred_evaluations: {
            output_element_id: string,
            text:              string,
            renderer:          TextBasedRenderer,
            renderer_options:  TextBasedRendererOptionsType,
        }[] = [];

        const marked_options = {
            walkTokens(token: walkTokens_token_type) {
                switch (token.type) {
                    case extension_name__inline_tex:
                    case extension_name__block_tex: {
                        token.global_state = global_state;
                        break;
                    }

                    case extension_name__eval_code: {
                        let renderer_factory: undefined|RendererFactory = undefined;
                        try {

                            const {
                                source_type,
                                text        = '',
                                show        = false,
                                background  = false,
                            } = token;
                            if (!source_type) {
                                throw new Error('no source_type given');
                            }
                            renderer_factory = TextBasedRenderer.factory_for_type(source_type);
                            if (!renderer_factory) {
                                throw new Error(`cannot find renderer for source type "${source_type}"`);
                            }
                            const markup_segments: string[] = [];
                            function add_segment(renderer_factory: RendererFactory, text_to_render: string, run_in_background: boolean) {
                                const output_element_id = generate_object_id();
                                deferred_evaluations.push({
                                    output_element_id,
                                    text: text_to_render,
                                    renderer: new renderer_factory() as TextBasedRenderer,
                                    renderer_options: {
                                        global_state,
                                        background: run_in_background,
                                    },
                                });
                                // this is the element we will render to from deferred_evaluations:
                                markup_segments.push(`<div id="${output_element_id}"></div>`);
                            }
                            if (token.show && text) {
                                // render the source text without executing
                                add_segment(MarkdownRenderer, '```'+source_type+'\n'+text+'\n```\n', false);
                            }
                            // render/execute the source text
                            add_segment(renderer_factory, text, background);
                            token.markup = markup_segments.join('\n');

                        } catch (error: unknown) {
                            const error_ocx = ocx.create_new_ocx(document.createElement('div'));  // temporary, for renderering error
                            ErrorRenderer.render_sync(error_ocx, error);
                            token.markup = error_ocx.element.innerHTML;
                        }
                        break;
                    }
                }
            }
        };

        const markup = marked.parse(markdown, marked_options);  // using extensions, see below
        parent.innerHTML = markup;

        // now run the deferred_evaluations
        // by setting up the output elements for each of deferred_evaluations, we
        // are now free to render asynchronously and in the background
        // Note: we are assuming that parent (and ocx.element) are already in the DOM
        // so that we can find the output element through document.getElementById().
        for (const { output_element_id, text, renderer, renderer_options } of deferred_evaluations) {
            const output_element = document.getElementById(output_element_id);
            if (!output_element) {
                // unexpected...
                ErrorRenderer.render_sync(ocx, new Error(`deferred_evaluations: cannot find output element with id "${output_element_id}"`));
            } else {
                const sub_ocx = ocx.create_new_ocx(output_element, ocx);
                await renderer.render(sub_ocx, text, renderer_options)
                    .catch((error: unknown) => {
                        sub_ocx.keepalive = false;  // in case this got set prior to the error
                        ErrorRenderer.render_sync(sub_ocx, error);
                    });
                if (!sub_ocx.keepalive) {
                    sub_ocx.stop();  // stop background processing, if any
                }
            }
        }

        return parent;
    }
}

marked.use({
    extensions: [
        {
            name: extension_name__inline_tex,
            level: 'inline',
            start(src: string) { return src.indexOf('$'); },
            tokenizer(src: string, tokens: unknown): undefined|walkTokens_token_type {
                const match = src.match(/^\$+([^$]+?)\$+/);
                if (!match) {
                    return undefined;
                } else {
                    return {
                        type: extension_name__inline_tex,
                        raw:  match[0],
                        text: match[1].trim(),
                        global_state: undefined,  // filled in later by walkTokens
                    };
                }
            },
            renderer(token: walkTokens_token_type) {
                return TeXRenderer.render_to_string(token.text ?? '', token.global_state, {
                    displayMode:  false,
                    throwOnError: false,
                });
            },
        },
        {
            name: extension_name__block_tex,
            level: 'block',
            start(src: string) { return src.indexOf('$$'); },
            tokenizer(src: string, tokens: unknown): undefined|walkTokens_token_type {
                const match = src.match(/^\$\$([^$]+?)\$\$/);
                if (!match) {
                    return undefined;
                } else {
                    return {
                        type: extension_name__block_tex,
                        raw:  match[0],
                        text: match[1].trim(),
                        global_state: undefined,  // filled in later by walkTokens
                    };
                }
            },
            renderer(token: walkTokens_token_type) {
                const markup = TeXRenderer.render_to_string(token.text ?? '', token.global_state, {
                    displayMode:  true,
                    throwOnError: false,
                });
                return `<p>${markup}</p>`;
            },
        },
        {
            name: extension_name__eval_code,
            level: 'block',
            start(src: string) { return src.match(/^[`]{3}[^$!&\n]*([\s]*[$])?([!]|[&])[\s]*[\n]/)?.index; },
            tokenizer(src: string, tokens: unknown): undefined|walkTokens_token_type {
                const match_re = /^[`]{3}[\s]*(?<source_type>[^$!&\n]*)[\s]*((?<flags_b>[!])|(?<flags_exec>[!])|(?<flags_show_exec>[$][\s]*[!])|(?<flags_bg>[&])|(?<flags_show_bg>[$][\s]*[&]))[\s]*[\n](?<code>.*?)[`]{3}/s;
                const match = src.match(match_re);
                if (!match) {
                    return undefined;
                } else {
                    const source_type = (match.groups?.source_type?.trim() ?? '') || 'javascript';
                    return {
                        type: extension_name__eval_code,
                        source_type,
                        raw:  match[0],
                        text: match.groups?.code ?? '',
                        show:       !!match.groups?.flags_show_exec || !!match.groups?.flags_show_bg,
                        background: !!match.groups?.flags_bg || !!match.groups?.flags_show_bg,
                        markup: undefined,  // filled in later by walkTokens
                    };
                }
            },
            renderer(token: walkTokens_token_type) {
                return token.markup;  // now already filled in by walkTokens
            },
        },
    ],
});
