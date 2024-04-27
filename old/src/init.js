// ensure that the various custom elements have been defined
// this is not entirely necessary but gets stylesheets, etc loaded right away
import './toggle-switch-element/_.js';
import './tool-bar-element/_.js';
import './editor-cell-element/_.js';
import './eval-cell-element/_.js';

import {
    LogbookManager,
} from './logbook-manager.js';


if (document.readyState === 'interactive' || document.readyState === 'complete') {
    await trigger_document_initialization();
} else {
    window.addEventListener('load', async (load_event) => {
        await trigger_document_initialization();
    }, {
        once: true,
    });
}

async function trigger_document_initialization() {
    await LogbookManager._initialize_singleton();

    const {
        view_var_name,
        view_var_value_edit,
        view_var_value_output,
        autoeval_var_name,
    } = LogbookManager;

    // update view according to parameter
    const view_value = new URLSearchParams(document.location.search).get(view_var_name)  // from URL search
          ?? document.body?.getAttribute(view_var_name)                                  // from document.body
          ?? document.documentElement.getAttribute(view_var_name);                       // from document.documentElement

    const autoeval_value = new URLSearchParams(document.location.search).get(autoeval_var_name)  // from URL search
          ?? document.body?.getAttribute(autoeval_var_name)                                      // from document.body
          ?? document.documentElement.getAttribute(autoeval_var_name);                           // from document.documentElement

    switch (view_value) {
    case view_var_value_edit:   LogbookManager.singleton.expand_input_output_split(true); break;
    case view_var_value_output: LogbookManager.singleton.collapse_input_output_split();   break;

    default: {
        if (view_value) {
            console.warn(`ignored unknown "${view_var_name}" parameter "${view_value}"`);
        }
        break;
    }
    }

    if (autoeval_value || autoeval_value === '') {
        switch (autoeval_value) {
        case false.toString(): break;

        default: {
            LogbookManager.singleton.inject_command('eval-all');
            break;
        }
        }
    }

    globalThis.logbook_manager = LogbookManager.singleton;//!!!
}
