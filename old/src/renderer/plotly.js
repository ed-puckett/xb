import {
    load_script,
} from '../../lib/ui/dom-tools.js';

import {
    assets_server_url,
} from '../assets-server-url.js';


let Plotly;  // loaded on demand

/** return the Plotly object which will be lazily loaded because Plotly is large
 */
export async function load_Plotly() {
    if (!Plotly) {
        await load_script(document.head, assets_server_url('dist/plotly.js'));  // defines globalThis.Plotly
        Plotly = globalThis.Plotly;
    }
    return Plotly;
}
