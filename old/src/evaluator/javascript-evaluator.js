import {
    Evaluator,
} from './evaluator.js';

import {
    Stoppable,
} from '../../lib/sys/stoppable.js';


export class JavaScriptEvaluator extends Evaluator {
    static handled_input_types = [
        'javascript',
    ];

    async _perform_eval() {
        const options = {
            style:  undefined,//!!!
            inline: undefined,//!!!
            global_state: this.global_state,
        };
        const renderer = this.ocx.renderer_for_type('javascript');
        this.add_stoppable(new Stoppable(renderer));
        const code = this.input_element.get_text();
        return this.ocx.invoke_renderer(renderer, code, options);
    }
}
