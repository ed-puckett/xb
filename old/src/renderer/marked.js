import {
    load_script,
} from '../../lib/ui/dom-tools.js';

import {
    assets_server_url,
} from '../assets-server-url.js';


await load_script(document.head, assets_server_url('dist/marked.min.js'));

export const marked = globalThis.marked;
