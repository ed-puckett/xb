import v4 from '../../node_modules/uuid/dist/esm-browser/v4.js';

export const uuidv4 = v4;

export function generate_object_id() {
    // html element ids cannot start with a number
    // (if it does, document.querySelector throws error: '... is not a valid selector')
    return `id-${uuidv4()}`;
}

export function generate_uuid() {
    return uuidv4();
}
