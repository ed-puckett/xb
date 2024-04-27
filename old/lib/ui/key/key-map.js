import {
    KeySpec,
} from './key-spec.js';


export class KeyMap {
    constructor(bindings=null, recognizer=null) {
        Object.defineProperties(this, {
            bindings: {  // key/command bindings
                value:      bindings,
                enumerable: true,
            },
            mapping: {  // canonical_key_string->(false|command|another_mapping)
                value:      this.constructor.#create_mapping(bindings),
                enumerable: true,
            },
            recognizer: {  // key_spec => (false|command)
                value:      recognizer,
                enumerable: true,
            },
        });
    }

    create_mapper(fallback_mapper=null) {
        return new this.constructor.Mapper(this.mapping, this.recognizer, fallback_mapper);
    }

    static multi_mapper(...key_maps) {
        if (key_maps.length <= 0) {
            throw new Error('at least one KeyMap instance must be given');
        }
        if (!key_maps.every(m => m instanceof this)) {
            throw new Error('arguments must all be KeyMap instances');
        }
        return key_maps.reduce((mapper, key_map) => key_map.create_mapper(mapper), null);
    }

    static #create_mapping(bindings) {
        if (bindings !== null && typeof bindings !== 'undefined' && typeof bindings !== 'object') {
            throw new Error('bindings must be null/undefined or an object');
        }
        const mapping = {};
        for (const command in bindings) {
            if (command.length <= 0) {
                throw new Error('bindings keys (command names) must not be empty strings');
            }
            for (const key_sequence of bindings[command]) {
                let seq_mapping = mapping;  // current mapping being acted upon by current key_string of sequence
                const seq_key_strings = key_sequence.split(KeySpec.canonical_key_string_separator);
                for (let i = 0; i < seq_key_strings.length; i++) {
                    const key_string = seq_key_strings[i];
                    const is_last = (i >= seq_key_strings.length-1);
                    const canonical_key_string = new KeySpec(key_string).canonical;
                    const existing = seq_mapping[canonical_key_string];
                    if (typeof existing === 'string' || (typeof existing === 'object' && is_last)) {
                        // something else already mapped here...
                        const seq_so_far = seq_key_strings.slice(0, i+1).join(KeySpec.canonical_key_string_separator);
                        throw new Error(`duplicate bindings specified for key sequence: ${seq_so_far}`);
                    }
                    if (!is_last) {
                        seq_mapping = existing ?? (seq_mapping[canonical_key_string] = {});
                    } else {
                        seq_mapping[canonical_key_string] = command;  // and then we're done...
                    }
                }
            }
        }
        return mapping;
    }

    static Mapper = class Mapper {
        constructor(mapping, recognizer, fallback_mapper=null) {
            if (mapping !== null && typeof mapping !== 'undefined' && typeof mapping !== 'object') {
                throw new Error('mapping must be null/undefined or an object');
            }
            if (recognizer !== null && typeof recognizer !== 'undefined' && typeof recognizer !== 'function') {
                throw new Error('recognizer must be null/undefined or a function');
            }
            if (fallback_mapper !== null && typeof fallback_mapper !== 'undefined' && !(fallback_mapper instanceof this.constructor)) {
                throw new Error('fallback_mapper must be null/undefined or a KeyMap instance');
            }
            if (!mapping && !fallback_mapper) {
                throw new Error('at least one of mapping or fallback_mapper must be given');
            }
            Object.defineProperties(this, {
                mapping: {
                    value:      mapping,
                    enumerable: true,
                },
                recognizer: {
                    value:      recognizer,
                    enumerable: true,
                },
                fallback_mapper: {
                    value:      fallback_mapper,
                    enumerable: true,
                },
            });
        }

        // returns a command string (complete), or undefined (failed), or a new Mapper instance (waiting for next key in sequence)
        consume(key_string_or_key_spec) {
            const key_spec = (key_string_or_key_spec instanceof KeySpec)
                  ? key_string_or_key_spec
                  : new KeySpec(key_string_or_key_spec);
            const recognizer_result = this.recognizer?.(key_spec);
            // this.recognizer takes precedence over this.mapping
            if (typeof recognizer_result === 'string') {
                return recognizer_result;
            }
            // this.mapping takes precedence over this.fallback_mapper
            const canonical_key_string = key_spec.canonical;
            const mapping_result = this.mapping?.[canonical_key_string];  // returns: undefined, string, or another mapping (object)
            if (typeof mapping_result === 'string') {
                return mapping_result;
            }
            const fallback_mapper_result = this.fallback_mapper?.consume(key_spec);
            if (typeof fallback_mapper_result === 'string') {
                return fallback_mapper_result;
            }
            if (!mapping_result && !fallback_mapper_result) {
                return undefined;  // indicate: failed
            }
            return mapping_result
                ? new Mapper(mapping_result, null, fallback_mapper_result)
                : fallback_mapper_result;  // no need to compose with mapping_result (which is undefined)
        }
    };
}
