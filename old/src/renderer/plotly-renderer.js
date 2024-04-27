import {
    Renderer,
} from './renderer.js';

import {
    load_Plotly,
} from './plotly.js';


export class PlotlyRenderer extends Renderer {
    static type = 'plotly';

    /** Render the given Plotly configuration to ocx.
     * @param {OutputContext} ocx,
     * @param {Object} plotly_config,  // data or { data, layout?, config?, frames? }
     * @param {Object|undefined|null} options: {
     *     style?: Object,  // css style to be applied to output element
     * }
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async render(ocx, plotly_config, options=null) {
        if (typeof plotly_config !== 'object') {
            throw new Error('plotly_config must be an object');
        }

        const style = options?.style;

        let data, layout, config, frames;
        if ('data' in plotly_config && Array.isArray(plotly_config.data)) {
            ({
                data,
                layout = {},
                config = {},
                frames = [],
            } = plotly_config);
        } else {
            data = plotly_config;
            config = {};
        }
        layout ??= {};
        layout.plot_bgcolor  ??= 'rgba(0, 0, 0, 0)';
        layout.paper_bgcolor ??= 'rgba(0, 0, 0, 0)';

        config.displayModeBar = false;  // remove icons/links from top-right of plot

        const parent = ocx.create_child({
            attrs: {
                'data-type': this.type,
            },
        });
        const output_element = ocx.constructor.create_element_child(parent, {
            style,
        });
        const Plotly = await load_Plotly();
        await Plotly.newPlot(output_element, { data, layout, config, frames });  // render to the output_element

        return parent;
    }
}
