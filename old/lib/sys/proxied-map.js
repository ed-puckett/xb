/** Map class for objects that permit property access through normal get/set
 *  operations via dot notation, square bracket notation, etc.  This is a
 *  replacement for bare Object types that are being used to store values
 *  under arbitrary property names, avoiding prototype corruption, etc.
 *  See: https://github.com/eslint-community/eslint-plugin-security/blob/main/docs/the-dangers-of-square-bracket-notation.md
 */
class ProxiedMap {
    /** constructor for ProxiedMap
     * @param {Object|null|undefined} initializer object.  default: an empty object {}
     */
    constructor(initializer=null) {
        initializer ??= {};
        if (typeof initializer !== 'object') {
            throw new Error('initializer must be null, undefined, or an object');
        }
        const initializer_entries = Object.entries(initializer);
        const map = new Map(initializer_entries);
        return new Proxy(map, {
            get(target, prop, receiver) {
                return target.get(prop);
            },
            set(target, prop, value, receiver) {
                return target.set(prop, value);
            },
            has(target, prop) {
                return target.has(prop);
            },
            ownKeys(target) {
                // simply returning target.keys() does not work on, for example, node 18.11.0.
                // it causes: Uncaught TypeError: CreateListFromArrayLike called on non-object
                // when calling Object.getOwnPropertyNames(proxied_map)
                return [ ...target.keys() ];
            },
            deleteProperty(target, prop) {
                return target.delete(prop);
            },
            defineProperty(target, key, descriptor) {
                if ( !descriptor.configurable ||  // configurable defaults to false
                     !descriptor.enumerable   ||  // enumerable defaults to false
                     !descriptor.writable     ||  // writable defaults to false
                     'get' in descriptor      ||
                     'set' in descriptor         ) {
                    return false;  // only accept "fully open" descriptor without getter or setter
                } else {
                    return true;
                }
            },
            getOwnPropertyDescriptor(target, prop) {
                if (prop in target) {  // otherwise, undefined will be returned
                    return {
                        value:        target.get(prop),
                        configurable: true,
                        enumerable:   true,
                        writable:     true,
                    };
                }
            },
        });
    }
}
