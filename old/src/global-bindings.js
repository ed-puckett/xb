/** return the initial menu specification
 *  @return {Object} menu specification
 */
export function get_menubar_spec() {
    return [
        { label: 'File', collection: [
            { label: 'Recent logbooks', id: 'recents', collection: [
                // ...
            ] },
            '---',
            { label: 'Reset cells',     item: { command: 'reset',            }, id: 'reset' },
            { label: 'Clear document',  item: { command: 'clear',            }, id: 'clear' },
            '---',
            { label: 'Save',            item: { command: 'save',             }, id: 'save' },
            { label: 'Save as...',      item: { command: 'save-as',          } },
            '---',
            { label: 'Settings...',     item: { command: 'settings',         } },
        ] },

        { label: 'Cell', collection: [
            { label: 'Eval',            item: { command: 'eval-and-refocus', }, id: 'eval-and-refocus' },
            { label: 'Eval and stay',   item: { command: 'eval',             }, id: 'eval' },
            { label: 'Eval before',     item: { command: 'eval-before',      }, id: 'eval-before' },
            { label: 'Eval all',        item: { command: 'eval-all',         }, id: 'eval-all' },
            '---',
            { label: 'Stop cell',       item: { command: 'stop',             }, id: 'stop' },
            { label: 'Stop all',        item: { command: 'stop-all',         }, id: 'stop-all' },
            '---',
            { label: 'Reset cell',      item: { command: 'reset-cell',       }, id: 'reset-cell' },
            '---',
            { label: 'Focus up',        item: { command: 'focus-up',         }, id: 'focus-up' },
            { label: 'Focus down',      item: { command: 'focus-down',       }, id: 'focus-down' },
            '---',
            { label: 'Move up',         item: { command: 'move-up',          }, id: 'move-up' },
            { label: 'Move down',       item: { command: 'move-down',        }, id: 'move-down' },
            { label: 'Add before',      item: { command: 'add-before',       }, id: 'add-before' },
            { label: 'Add after',       item: { command: 'add-after',        }, id: 'add-after' },
            { label: 'Delete',          item: { command: 'delete',           }, id: 'delete' },
            '---',
            { label: 'Shrink inputs',   item: { command: 'shrink-inputs',    }, id: 'shrink-inputs' },
            { label: 'Enlarge inputs',  item: { command: 'enlarge-inputs',   }, id: 'enlarge-inputs' },
            { label: 'Collapse inputs', item: { command: 'collapse-inputs',  }, id: 'collapse-inputs' },
            { label: 'Expand inputs',   item: { command: 'expand-inputs',    }, id: 'expand-inputs' },
        ] },

        { label: 'Help', collection: [
            { label: 'Help...',         item: { command: 'help',             } },
        ] },
    ];
}


/** return the initial key map bindings
 *  @return {Object} mapping from command strings to arrays of triggering key sequences
 */
export function get_global_initial_key_map_bindings() {
    return {
        'create-cell':         [ 'CmdOrCtrl-Shift-Alt-N' ],

        'reset-cell':          [ ],
        'reset':               [ ],
        'clear':               [ ],

        'save':                [ 'CmdOrCtrl-S' ],
        'save-as':             [ 'CmdOrCtrl-Shift-S' ],

        'eval':                [ 'CmdOrCtrl-Enter' ],
        'eval-and-refocus':    [ 'Shift-Enter' ],
        'eval-before':         [ 'CmdOrCtrl-Shift-Enter' ],
        'eval-all':            [ 'CmdOrCtrl-Shift-Alt-Enter' ],

        'stop':                [ 'CmdOrCtrl-Alt-!' ],
        'stop-all':            [ 'CmdOrCtrl-Shift-Alt-!' ],

        'focus-up':            [ 'Alt-Up' ],
        'focus-down':          [ 'Alt-Down' ],

        'move-up':             [ 'CmdOrCtrl-Alt-Up' ],
        'move-down':           [ 'CmdOrCtrl-Alt-Down' ],
        'add-before':          [ 'CmdOrCtrl-Alt-Shift-Up' ],
        'add-after':           [ 'CmdOrCtrl-Alt-Shift-Down' ],
        'delete':              [ 'CmdOrCtrl-Alt-Backspace' ],

        'set-mode-markdown':   [ 'Alt-M m' ],
        'set-mode-tex':        [ 'Alt-M t' ],
        'set-mode-javascript': [ 'Alt-M j' ],

        'shrink-inputs':       [ 'CmdOrCtrl-Alt-Left' ],
        'enlarge-inputs':      [ 'CmdOrCtrl-Alt-Right' ],
        'collapse-inputs':     [ 'CmdOrCtrl-Shift-Alt-Left' ],
        'expand-inputs':       [ 'CmdOrCtrl-Shift-Alt-Right' ],

        'settings':            [ 'CmdOrCtrl-,' ],
        'help':                [ ],
    };
}

/** return global command bindings
 *  @param {Object} implementor of command_handlers
 *  @return {Object} mapping from command strings to functions implementing that command
 * The handler functions are taken from the implementor argument.
 */
export function get_global_command_bindings(implementor) {
    const command_bindings = {
        'create-cell':         implementor.command_handler__create_cell,

        'reset-cell':          implementor.command_handler__reset_cell,
        'reset':               implementor.command_handler__reset,
        'clear':               implementor.command_handler__clear,

        'save':                implementor.command_handler__save,
        'save-as':             implementor.command_handler__save_as,

        'eval':                implementor.command_handler__eval,
        'eval-and-refocus':    implementor.command_handler__eval_and_refocus,
        'eval-before':         implementor.command_handler__eval_before,
        'eval-all':            implementor.command_handler__eval_all,

        'stop':                implementor.command_handler__stop,
        'stop-all':            implementor.command_handler__stop_all,

        'focus-up':            implementor.command_handler__focus_up,
        'focus-down':          implementor.command_handler__focus_down,

        'move-up':             implementor.command_handler__move_up,
        'move-down':           implementor.command_handler__move_down,
        'add-before':          implementor.command_handler__add_before,
        'add-after':           implementor.command_handler__add_after,
        'delete':              implementor.command_handler__delete,

        'set-mode-markdown':   implementor.command_handler__set_mode_markdown,
        'set-mode-tex':        implementor.command_handler__set_mode_tex,
        'set-mode-javascript': implementor.command_handler__set_mode_javascript,

        'shrink-inputs':       implementor.command_handler__shrink_inputs,
        'enlarge-inputs':      implementor.command_handler__enlarge_inputs,
        'collapse-inputs':     implementor.command_handler__collapse_inputs,
        'expand-inputs':       implementor.command_handler__expand_inputs,

        'settings':            implementor.command_handler__show_settings_dialog,
        'help':                implementor.command_handler__show_help,
    };

    // bind "this" for the implemented functions
    for (const command in command_bindings) {
        command_bindings[command] = command_bindings[command].bind(implementor);
    }

    return command_bindings;
}
