import {
    load_script,
} from '../ui/dom-tools.js';

import {
    assets_server_url,
} from '../../src/assets-server-url.js';


await load_script(document.head, assets_server_url('dist/sprintf.min.js'));

export const sprintf = globalThis.sprintf;
