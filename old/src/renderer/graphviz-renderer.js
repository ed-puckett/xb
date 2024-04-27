import {
    Renderer,
} from './renderer.js';

import {
    render as graphviz_render,
} from './graphviz.js';


export class GraphvizRenderer extends Renderer {
    static type = 'graphviz';

    /** Render the given graphviz configuration to ocx.
     * @param {OutputContext} ocx,
     * @param {Object} graphviz_config: {
     *     node_config?: string,
     *     nodes[]?: (string | [ string, string ])[],  // name and node_options
     *     edges[]?: [ string, string, { label?: string, ... }? ][],  // from and to
     * }
     * @param {Object|undefined|null} options: {
     *     style?: Object,  // css style to be applied to output element
     * }
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async render(ocx, graphviz_config, options=null) {
        const style = options?.style;

        const element = ocx.create_child({
            attrs: {
                'data-type': this.type,
            },
            style,
            set_id: true,  // required for selector below
        });
        const element_selector = `#${element.id}`;

        const dot_stmts = [];
        if (graphviz_config?.node_config) {
            dot_stmts.push(`node ${graphviz_config.node_config}`);
        }
        for (const node_spec of (graphviz_config?.nodes ?? [])) {
            if (typeof node_spec === 'string') {
                const name = node_spec;
                dot_stmts.push(name);
            } else {
                const [ name, node_options ] = node_spec;
                dot_stmts.push(`${name} [${node_options}]`);
            }
        }
        for (const [ from, to, edge_options ] of (graphviz_config?.edges ?? [])) {
            dot_stmts.push(`${from}->${to}${edge_options ? `[${edge_options}]` : ''}`);
        }
        const dot = `digraph { ${dot_stmts.join(';')} }`;

        // create and run the renderer
        await graphviz_render(element_selector, dot, {});

        return element;
    }
}
