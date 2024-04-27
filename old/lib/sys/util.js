export function deep_freeze(object) {
    for (const [ key, value ] of Object.entries(object)) {
        if (typeof value === 'object' || Array.isArray(value)) {
            deep_freeze(object[key]);
        }
    }
    return Object.freeze(object);
}
