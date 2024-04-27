const current_script_url = import.meta.url;  // save for later

import { fileURLToPath } from "node:url";

import { CycloneDxWebpackPlugin } from '@cyclonedx/webpack-plugin';

const dist_dir_path = fileURLToPath(new URL("./dist", current_script_url));

const webpack_config = {
    entry: './src/init.js',
    mode:  'production',

    optimization: {
        minimize: true,
    },

    stats: {
        errorDetails: true,
    },

    output: {
        path: dist_dir_path,
        filename: 'main.js',
    },

    devtool: 'source-map',

    plugins: [
        new CycloneDxWebpackPlugin({
            specVersion: '1.4',
            outputLocation: './cyclonedx-sbom',
            reproducibleResults: true,
        }),
    ],

    module: {
        rules: [
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
};

export default webpack_config;
