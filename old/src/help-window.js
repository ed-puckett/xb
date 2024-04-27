const current_script_url = import.meta.url;  // save for later

import {
    assets_server_url,
} from './assets-server-url.js';


export function open_help_window() {
    window.open(new URL('../help.html', assets_server_url(current_script_url)));
}
