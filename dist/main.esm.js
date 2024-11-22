import compilerDom from '@vue/compiler-dom';
import MagicString from 'magic-string';
import babel from '@babel/core';
import types from '@babel/types';
import _traverse from '@babel/traverse';

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

_traverse.default;
function transformVue(code, id, opt, customFile) {
    const ast = compilerDom.parse(code, { comments: true });
    const ms = new MagicString(code);
    compilerDom.transform(ast, {
        nodeTransforms: [
            (node) => {
                const { tag, tagType } = (node || {});
                if (tagType === compilerDom.ElementTypes.ELEMENT) {
                    if (tag === "template" || tag === "script" || tag === "style") {
                        return;
                    }
                    const tagLength = tag.length || 0;
                    const pos = node.loc.start.offset + tagLength + 1;
                    const data = generatePath("element", id, node);
                    ms.appendRight(pos, data);
                }
                if (tagType === compilerDom.ElementTypes.COMPONENT) {
                    const tagLength = tag.length || 0;
                    const pos = node.loc.start.offset + tagLength + 1;
                    const data = generatePath("component", id, node);
                    ms.appendRight(pos, data);
                }
            },
        ],
    });
    const result = ms.toString();
    return result;
}
function transformTsx(code, id, opt, customFile) { }
function transformJsx(code, id, opt, customFile) { }
function transformTs(code, id, opt, customFile) { }
function transformJS(code, id, opt, customFile) {
    if (id.includes('node_modules'))
        return code;
    const { filename = '' } = customFile || {};
    const result = babel.transformSync(code, {
        plugins: [rewriteHPlugin(filename)],
    });
    return result.code;
}
const rewriteHPlugin = (filename) => {
    return () => {
        return {
            visitor: {
                CallExpression(path) {
                    const { callee, arguments: args } = path.node;
                    // 仅处理导入的 h 函数
                    if (callee.type === 'Identifier' &&
                        callee.name === 'h') {
                        const line = path.node.loc.start.line;
                        const column = path.node.loc.start.column;
                        const info = `${filename}:${line}:${column}`;
                        const newArg = types.objectExpression([
                            types.objectProperty(types.stringLiteral('fast-element'), types.stringLiteral(info)),
                        ]);
                        const newArg1 = types.identifier('h');
                        args.unshift(newArg);
                        args.unshift(newArg1);
                        // 更新函数调用
                        callee.name = 'wrapperH';
                    }
                },
                ImportDeclaration(path) {
                    // 检查是否是从 "vue" 导入
                    if (path.node.source.value === "vue") {
                        // 查找导入的 { h }
                        const hSpecifier = path.node.specifiers.find((specifier) => types.isImportSpecifier(specifier) &&
                            specifier.imported?.name === "h");
                        if (hSpecifier) {
                            path.node._isVueH = true;
                            // 修改 h 的导入为 h as _h
                            const importWrapperH = types.importDeclaration([types.importDefaultSpecifier(types.identifier('wrapperH'))], types.stringLiteral('virtual-mode'));
                            /**
                             * 增强 h 函数, 使h函数能够将当前的信息传递给 wrapperH
                             * import { h } from "vue"
                             *
                             * import wrapperH from "virtual-mode";
                             */
                            path.insertAfter(importWrapperH);
                        }
                    }
                },
            },
        };
    };
};
/**
 * Generate fast-to element path;
 */
function generatePath(type, path, astNode) {
    const { line, column } = astNode.loc.start;
    return ` fast-${type}="${path}:${line}:${column}"`;
}

function pluginVirtual() {
    return {
        name: "fast-to-plugin-virtual",
        enforce: "pre",
        apply: "serve",
        resolveId(id) {
            if (id.includes("virtual-mode")) {
                return id;
            }
        },
        load(id) {
            if (id.includes("virtual-mode")) {
                return `export default function(h,info,...args) {
          console.log(info);
          return h(...args);
        }`;
            }
        }
    };
}
function pluginTransform() {
    return {
        name: "fast-to-plugin",
        enforce: "pre",
        apply: "serve",
        transform(code, id, opt) {
            const customFile = parseSource(id);
            const { type } = customFile;
            if (type === "vue") {
                return transformVue(code, id);
            }
            if (type === "js") {
                return transformJS(code, id, opt, customFile);
            }
            if (type === "ts") {
                return transformTs();
            }
            if (type === "jsx") {
                return transformJsx();
            }
            if (type === "tsx") {
                return transformTsx();
            }
            return code;
        }
    };
}
function fastToPlugin() {
    return [
        pluginTransform(),
        pluginVirtual()
    ];
}

export { fastToPlugin as default };
//# sourceMappingURL=main.esm.js.map
