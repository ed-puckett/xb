const current_script_url = import.meta.url;  // save for later

const assets_server_script = document.querySelector('script');
if (!assets_server_script || !assets_server_script.src) {
    throw new Error('no script for assets server found in document');
}
const assets_server_root = new URL('..', assets_server_script.src);  // assumes script src points to is one directory level below the server root
const local_server_root  = new URL('..', current_script_url);        // assumes this script is located one directory level below server root


/** @return {URL} url resolved against the running server url
 */
export function assets_server_url(local_url) {
    if (typeof local_url === 'string') {
        local_url = new URL(local_url, local_server_root);
    }
    if (!(local_url instanceof URL)) {
        throw new Error('local_url must be a string or an instance of URL');
    }

    if ( local_url.protocol !== 'file:' ||
         local_server_root.protocol !== 'file:' ||
         assets_server_root.protocol === 'file:' ||
         !local_url.href.startsWith(local_server_root.href) ) {
        return local_url;  // nothing to do...
    } else {
        const relative = local_url.href.slice(local_server_root.href.length);
        return new URL(assets_server_root.href + relative);
    }
}
