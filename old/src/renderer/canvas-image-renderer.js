import {
    Renderer,
} from './renderer.js';


export class CanvasImageRenderer extends Renderer {
    static type = 'canvas-image';

    /** Render by evaluating the given canvas_renderer on a new HTMLCanvasElement created from ocx.
     * @param {OutputContext} ocx,
     * @param {async (HTMLCanvasElement) => undefined} canvas_renderer,  // function to render into canvas
     * @param {Object|undefined|null} options: {
     *     style?: Object,  // css style to be applied to output element
     * }
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async render(ocx, canvas_renderer, options=null) {
        if (typeof canvas_renderer !== 'function') {
            throw new Error('canvas_renderer must be a function');
        }

        options ??= {};

        if (typeof options.tag !== 'undefined') {
            console.warn('overriding options.tag value', options.tag);
        }
        if (typeof options.attrs?.['data-type'] !== 'undefined') {
            console.warn('overriding options.attrs["data-type"] value', options.attrs['data-type']);
        }
        if (typeof options.attrs?.['src'] !== 'undefined') {
            console.warn('overriding options.src value', options.attrs.src);
        }

        const image_options = {
            ...options,
            tag: 'img',
            attrs: {
                ...(options.attrs ?? {}),
                'data-type': this.type,
                // "src" set below
            },
        };

        // note: "width" and "height" attributes, if specified in options, will be
        // applied to both the canvas element and the img element.  This is ok because
        // these attributes represent size in px in both element types.

        const canvas = ocx.constructor.create_element({
            tag: 'canvas',
            attrs: {
                ...(options.attrs ?? {}),
                width:  options.attrs?.width,
                height: options.attrs?.height,
            },
            style: options.style,
        });
        await canvas_renderer(canvas);
        image_options.attrs.src = canvas.toDataURL();

        const image = ocx.create_child(image_options);
        return image;
    }
}
