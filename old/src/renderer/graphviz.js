import {
    load_d3,
} from './d3.js';

import {
    load_script,
} from '../../lib/ui/dom-tools.js';

import {
    assets_server_url,
} from '../assets-server-url.js';


let loaded = false;
async function load_modules() {
    const d3 = await load_d3();
    if (!loaded) {
        await load_script(document.head, assets_server_url('dist/graphviz.umd.js'));
        await load_script(document.head, assets_server_url('dist/d3-graphviz.min.js'));
        loaded = true;
    }
    return d3;
}

export async function render(element_selector, dot, options) {
    const d3 = await load_modules();
    const {
        transition = "main",
        ease       = d3.easeLinear,
        delay      = 0,
        duration   = 0,
        logEvents  = true,
    } = (options ?? {});
    return new Promise((resolve, reject) => {
        try {
            function reject_with_string(...args) {
                reject(new Error(args[0]));
            }
            const graphviz = d3.select(element_selector).graphviz({
                useWorker:       false,
                useSharedWorker: false,
            });
            graphviz
                .transition(function () {
                    return d3.transition(transition)
                        .ease(ease)
                        .delay(delay)
                        .duration(duration);
                })
                .logEvents(logEvents)
                .onerror(reject_with_string)
                .on("initEnd", function () {
                    graphviz
                        .renderDot(dot)
                        .onerror(reject_with_string)
                        .on("end", resolve);
                });
        } catch (error) {
            reject(error);
        }
    });
}
