import {
    Renderer,
} from './renderer.js';


export class ImageDataRenderer extends Renderer {
    static type = 'image-data';

    // Format of config object: {
    //     x?:         number,  // default value: 0
    //     y?:         number,  // default value: 0
    //     image_data: ImageData,
    // }
    // (or an array of these objects)

    // may throw an error
    /** Render the given image data configuration to ocx.
     * @param {OutputContext} ocx,
     * @param {Object} config: {
     *     x?:         number,  // default: 0
     *     y?:         number,  // default: 0
     *     image_data: ImageData,
     * }
     * @param {Object|undefined|null} options: {
     *     style?: Object,   // css style to be applied to output element
     * }
     * @return {Element} element to which output was rendered
     * @throws {Error} if error occurs
     */
    async render(ocx, config, options=null) {
        const style = options?.style;

        const parent = ocx.create_child({
            attrs: {
                'data-type': this.type,
            },
        });
        const canvas = ocx.constructor.create_element_child(parent, {
            tag: 'canvas',
            style,
        });
        const ctx = canvas.getContext('2d');
        const iter_config = Array.isArray(config) ? config : [ config ];
        for (const { x = 0, y = 0, image_data } of iter_config) {
            ctx.putImageData(image_data, x, y);
        }

        return parent;
    }
}
