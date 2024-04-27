import {
    load_script,
} from '../../../lib/ui/dom-tools.js';

import {
    assets_server_url,
} from '../../assets-server-url.js';

import imported_katex from '../../../dist/katex/dist/katex.mjs';

// import {
//     create_stylesheet_link,
// } from '../../../lib/ui/dom-tools.js';
export async function load_stylesheet() {
    // create_stylesheet_link(document.head, new URL('dist/katex/dist/katex.min.css', assets_server_url(current_script_url)));
    // create_stylesheet_link(document.head, new URL('./style.css', assets_server_url(current_script_url)));
    await import('../../../dist/katex/dist/katex.min.css');  // webpack implementation
    await import('./style.css');  // webpack implementation
}
await load_stylesheet();  // load stylesheet now

export const katex = imported_katex;
