import {
    basicSetup,
} from 'codemirror';

import {
    EditorState,
    Compartment,
} from "@codemirror/state";

import {
    EditorView,
    keymap,
    lineNumbers,
} from "@codemirror/view";

import {
    defaultKeymap,
    emacsStyleKeymap,
    indentWithTab,
    undoDepth,
    redoDepth,
} from "@codemirror/commands";

import {
    vim,
} from "@replit/codemirror-vim";

import {
    indentUnit,
} from '@codemirror/language';

import {
    javascript,
} from "@codemirror/lang-javascript";

import {
    EditorCellElement,
} from './_.js';

import {
    clear_element,
} from '../../lib/ui/dom-tools.js';

import {
    get_settings,
} from '../settings/_.js';


class CodemirrorInterface {
    constructor(cell) {
        if (!(cell instanceof EditorCellElement)) {
            throw new Error('cell must be an instance of EditorCellElement');
        }

        const text = cell.get_text();

        this.#keymap_compartment          = new Compartment();
        this.#tab_size_compartment        = new Compartment();
        this.#indent_unit_compartment     = new Compartment();
        this.#tab_key_indents_compartment = new Compartment();
        this.#line_numbers_compartment    = new Compartment();

        const state = EditorState.create({
            doc: text,
            extensions: [
                this.#keymap_compartment.of([]),
                this.#tab_size_compartment.of(EditorState.tabSize.of(8)),
                this.#indent_unit_compartment.of(indentUnit.of(' '.repeat(2))),
                this.#tab_key_indents_compartment.of(keymap.of(indentWithTab)),
                this.#line_numbers_compartment.of(lineNumbers()),

                keymap.of(defaultKeymap),
                basicSetup,
                javascript(),
            ],
        });

        clear_element(cell);

        const view = new EditorView({
            parent: cell,
            state,
        });

        Object.defineProperties(this, {
            view: {
                enumerable: true,
                value: view,
            }
        });

        setTimeout(() => {  // must defer so that classList setting happens
            this.update_from_settings();
        });
    }
    #keymap_compartment;
    #tab_size_compartment;
    #indent_unit_compartment;
    #tab_key_indents_compartment;
    #line_numbers_compartment;

    get_text() {
        return this.view.state.doc.toString();
    }

    set_text(text) {
        this.view.dispatch({ from: 0, to: this.view.state.doc.length, insert: text });
    }

    get_undo_info() {
        return {
            undo_depth: undoDepth(this.view.state),
            redo_depth: redoDepth(this.view.state),
        };
    }

    focus() {
        this.view.focus();
    }

    scroll_into_view() {
        this.view.dispatch({ effects: EditorView.scrollIntoView(0) });
    }

    update_from_settings() {
        const {
            mode,
            tab_size,
            indent,
            tab_key_indents,
            line_numbers,
        } = get_settings().editor_options;

        let keymap_config;
        switch (mode) {
        case 'emacs': keymap_config = keymap.of(emacsStyleKeymap); break;
        case 'vim':   keymap_config = vim();                       break;
        default:      keymap_config = [];                          break;
        }

        const indent_unit_string = ' '.repeat(indent);

        this.view.dispatch({ effects: [
            this.#keymap_compartment.reconfigure(keymap_config),
            this.#tab_size_compartment.reconfigure(EditorState.tabSize.of(tab_size)),
            this.#indent_unit_compartment.reconfigure(indentUnit.of(indent_unit_string)),
            this.#tab_key_indents_compartment.reconfigure(tab_key_indents ? keymap.of(indentWithTab) : []),
            this.#line_numbers_compartment.reconfigure(line_numbers ? lineNumbers() : []),
        ]});

        // Note: the line_numbers setting above does not work, so we resort to this:
        const css_class_hide_line_numbers = 'codemirror-hide-line-numbers';
        if (line_numbers) {
            this.view.dom.classList.remove(css_class_hide_line_numbers);
        } else {
            this.view.dom.classList.add(css_class_hide_line_numbers);
        }
    }
}

export function create_codemirror_view(cell) {
    return new CodemirrorInterface(cell);
}
