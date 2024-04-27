import {
    load_script,
} from '../ui/dom-tools.js';

import {
    assets_server_url,
} from '../../src/assets-server-url.js';


// The "esm" distribution of rxjs is suitable for nodejs but not for
// within browsers (at least currently) because it internally imports
// files without specifying their ".js" extensions assuming that the
// extension will be implicitly added.  Imports in browsers require
// an explicit full path.
// Therefore, load the bundle version (which stores the result in
// globalThis.rxjs) and deal with it that way
// DOES NOT WORK: import * as rxjs from '../../node_modules/rxjs/dist/esm/index.js';

await load_script(document.head, assets_server_url('dist/rxjs.umd.min.js'));

export default { ...globalThis.rxjs };
globalThis.rxjs = undefined;  // remove from global environment
