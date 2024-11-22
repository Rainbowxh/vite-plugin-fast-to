'use strict';

const parseSource = (source) => {
    const [filename] = source.split("?", 2);
    const result = {
        filename,
        type: '',
        query: {},
    };
    const regex = /\.(\w+)$/;
    const match = filename.match(regex);
    result.type = match ? match[1] : '';
    return result;
};

function fastToPlugin() {
    return {
        name: 'fast-to-plugin',
        enforce: 'pre',
        apply: 'serve',
        transform(code, id, opt) {
            const customFile = parseSource(id);
            console.log(customFile);
        }
    };
}

module.exports = fastToPlugin;
