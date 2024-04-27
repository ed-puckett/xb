import {
    Evaluator,
} from './evaluator.js';

import {
    Stoppable,
} from '../../lib/sys/stoppable.js';


export class MarkdownEvaluator extends Evaluator {
    static handled_input_types = [
        'markdown',
    ];

    async _perform_eval() {
        const options = {
            style:  undefined,//!!!
            inline: undefined,//!!!
            global_state: this.global_state,
        };
        const renderer = this.ocx.renderer_for_type('markdown');
        this.add_stoppable(new Stoppable(renderer));
        return this.ocx.invoke_renderer(renderer, this.input_element.get_text(), options);
    }
}
