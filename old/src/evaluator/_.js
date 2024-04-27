// Evaluator is defined in a separate file to break dependency cycle in get_evaluator_classes()
export {
    Evaluator,
} from './evaluator.js';

import { MarkdownEvaluator   } from './markdown-evaluator.js';
import { TeXEvaluator        } from './tex-evaluator.js';
import { JavaScriptEvaluator } from './javascript-evaluator.js';

/** return an array of all known evaluator classes, with the first entry being considered as the "default"
 *  @return {String[]} array of evaluator classes
 */
export function get_evaluator_classes() {
    return [
        MarkdownEvaluator,  // first entry is the default
        TeXEvaluator,
        JavaScriptEvaluator,
    ];
}
