import {
    load_script,
} from '../../lib/ui/dom-tools.js';

import {
    assets_server_url,
} from '../assets-server-url.js';


let d3;

export async function load_d3() {
    if (!d3) {
        await load_script(document.head, assets_server_url('dist/d3.min.js'));  // defines globalThis.d3
        d3 = globalThis.d3;
    }
    return d3;
}
