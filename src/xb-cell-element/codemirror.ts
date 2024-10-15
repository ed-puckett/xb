import {
    basicSetup,
} from 'codemirror';

import {
    EditorState,
    Compartment,
} from "@codemirror/state";

import {
    EditorView,
    ViewUpdate,
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
    markdown,
} from "@codemirror/lang-markdown";

import {
    clear_element,
} from 'lib/ui/dom-tools';

import {
    get_settings,
} from 'src/settings/_';

import {
    XbCellElement,
} from './_';


export type CodemirrorUndoInfo = {
    undo_depth: number,
    redo_depth: number,
    is_neutral: boolean,
};

export function create_null_codemirror_undo_info(is_neutral: boolean): CodemirrorUndoInfo {
    return {
        undo_depth: 0,
        redo_depth: 0,
        is_neutral,
    };
}


export class CodemirrorInterface {

    static create(cell: XbCellElement) {
        const codemirror_interface = new this(cell);
        codemirror_interface.set_language_from_type(cell.type)
        return codemirror_interface;
    }

    #view: EditorView;
    get view (){ return this.#view; }

    constructor(cell: XbCellElement) {
        if (!(cell instanceof XbCellElement)) {
            throw new Error('cell must be an instance of XbCellElement');
        }

        const text = cell.get_text();

        this.#keymap_compartment          = new Compartment();
        this.#tab_size_compartment        = new Compartment();
        this.#indent_unit_compartment     = new Compartment();
        this.#tab_key_indents_compartment = new Compartment();
        this.#line_numbers_compartment    = new Compartment();
        this.#line_wrapping_compartment   = new Compartment();
        this.#language_compartment        = new Compartment();

        const state = EditorState.create({
            doc: text,
            extensions: [
                EditorView.updateListener.of((update: ViewUpdate) => {
                    if (update.docChanged) {
                        this.#handle_doc_update_event(update);
                    }
                }),

                this.#keymap_compartment.of([]),
                this.#tab_size_compartment.of(EditorState.tabSize.of(8)),
                this.#indent_unit_compartment.of(indentUnit.of(' '.repeat(2))),
                this.#tab_key_indents_compartment.of(keymap.of([ indentWithTab ])),
                this.#line_numbers_compartment.of(lineNumbers()),
                this.#line_wrapping_compartment.of(EditorView.lineWrapping),
                this.#language_compartment.of([]),

                keymap.of(defaultKeymap),
                basicSetup,
            ],
        });

        clear_element(cell);

        this.#view = new EditorView({
            parent: cell,
            state,
        });

        this.#neutral_state_doc = this.#view.state.doc;  // used for is_neutral calculation

        setTimeout(() => {  // must defer so that classList setting happens
            this.update_from_settings();
        });
    }
    #keymap_compartment;
    #tab_size_compartment;
    #indent_unit_compartment;
    #tab_key_indents_compartment;
    #line_numbers_compartment;
    #line_wrapping_compartment;
    #language_compartment;

    get_text(): string {
        return this.#view.state.doc.toString();
    }

    set_text(text: string, set_neutral: boolean = true): void {
        this.#view.dispatch({ changes: [ { from: 0, to: this.#view.state.doc.length, insert: text } ] });
        if (set_neutral) {
            this.set_neutral();
        }
    }

    is_neutral(): boolean {
        if (typeof this.#cached__is_neutral !== 'undefined') {
            return this.#cached__is_neutral;
        } else {
            // recompute is_neutral
            const is_neutral: boolean = (this.#neutral_state_doc as any)?.eq(this.view.state.doc) ?? false;
            this.#cached__is_neutral = is_neutral;
            return is_neutral;
        }
    }
    set_neutral() {
        this.#cached__is_neutral = undefined;  // force recompute on next call to this.is_neutral()
        this.#neutral_state_doc = this.view.state.doc;
    }
    #handle_doc_update_event(update: ViewUpdate) {
        this.#cached__is_neutral = undefined;  // force recompute on next call to this.is_neutral()
    }
    #cached__is_neutral: undefined|boolean = undefined;  // undefined: is_neutral must be computed; boolean: is_neutral value
    #neutral_state_doc: unknown = undefined;//!!!

    get_undo_info(): CodemirrorUndoInfo {
        return {
            undo_depth: undoDepth(this.#view.state),
            redo_depth: redoDepth(this.#view.state),
            is_neutral: this.is_neutral(),
        };
    }

    focus(): void {
        this.#view.focus();
    }

    scroll_into_view(): void {
        this.#view.dispatch({ effects: EditorView.scrollIntoView(this.#view.state.selection.main) });
    }

    set_language_from_type(type: string): void {
        switch (type) {
            case 'javascript': this.#view.dispatch({ effects: this.#language_compartment.reconfigure(javascript()) }); break;
            case 'markdown':   this.#view.dispatch({ effects: this.#language_compartment.reconfigure(markdown())   }); break;
            default:           this.#view.dispatch({ effects: this.#language_compartment.reconfigure([])           }); break;
        }
    }

    update_from_settings(): void {
        const {
            mode,
            tab_size,
            indent,
            tab_key_indents,
            line_numbers,
            line_wrapping,
        } = (get_settings() as any).editor_options as any;

        let keymap_config;
        switch (mode) {
            case 'emacs': keymap_config = keymap.of(emacsStyleKeymap); break;
            case 'vim':   keymap_config = vim();                       break;
            default:      keymap_config = [];                          break;
        }

        const indent_unit_string = ' '.repeat(indent);

        this.#view.dispatch({ effects: [
            this.#keymap_compartment.reconfigure(keymap_config),
            this.#tab_size_compartment.reconfigure(EditorState.tabSize.of(tab_size)),
            this.#indent_unit_compartment.reconfigure(indentUnit.of(indent_unit_string)),
            this.#tab_key_indents_compartment.reconfigure(tab_key_indents ? keymap.of([ indentWithTab ]) : []),
            this.#line_numbers_compartment.reconfigure(line_numbers ? lineNumbers() : []),
            this.#line_wrapping_compartment.reconfigure(line_wrapping ? EditorView.lineWrapping : []),
        ]});

        // Note: the line_numbers setting above does not work, so we resort to this:
        const css_class_hide_line_numbers = 'codemirror-hide-line-numbers';
        if (line_numbers) {
            this.#view.dom.classList.remove(css_class_hide_line_numbers);
        } else {
            this.#view.dom.classList.add(css_class_hide_line_numbers);
        }
    }
}
