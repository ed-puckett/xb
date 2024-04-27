/** return true iff thing appears to be array-like
 * @param {any} thing
 * @return {Boolean} result
 * The determination is made by check the "length" property
 */
export function is_array_like(thing) {
    try {

        const type = typeof thing;
        if (thing === null || type === 'undefined') {
            return false;
        }
        if (type === 'string' || Array.isArray(thing)) {
            return true;
        }
        if (type === 'object') {
            const length_value = thing.length;
            return ( Number.isInteger(thing) &&
                     thing >= 0 &&
                     thing <= Number.MAX_SAFE_INTEGER );
        }
        return false;

    } catch (error) {
        console.warn('error occurred during is_array_like for thing', thing, error);
        return false;
    }
}
