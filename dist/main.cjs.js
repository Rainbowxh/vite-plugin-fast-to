'use strict';

var compilerDom = require('@vue/compiler-dom');
var MagicString = require('magic-string');
var babel = require('@babel/core');
var types = require('@babel/types');
var _babelPresetTypescript = require('@babel/preset-typescript');

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

const babelPresetTypescript = _babelPresetTypescript.default;
function transformVue(code, id, opt, customFile) {
    const ast = compilerDom.parse(code, { comments: true });
    const ms = new MagicString(code);
    function dealTag(type, node, ms) {
        const tagLength = node.tag.length || 0;
        const pos = node.loc.start.offset + tagLength + 1;
        const data = " " + generatePath(type, id, node);
        ms.appendRight(pos, data);
    }
    compilerDom.transform(ast, {
        nodeTransforms: [
            (node) => {
                const { tag, tagType } = (node || {});
                if (tagType === compilerDom.ElementTypes.ELEMENT) {
                    if (tag === "template" || tag === "script" || tag === "style") {
                        return;
                    }
                    dealTag('element', node, ms);
                }
                if (tagType === compilerDom.ElementTypes.COMPONENT) {
                    dealTag('component', node, ms);
                }
            },
        ],
    });
    const result = ms.toString();
    return result;
}
function transformTsx(code, id, opt, customFile) { }
function transformJsx(code, id, opt, customFile) { }
function transformTs(code, id, opt, customFile) {
    if (id.includes("node_modules"))
        return code;
    const { filename = "" } = customFile || {};
    // 使用 transformSync
    const result = babel.transformSync(code, {
        filename: filename,
        presets: [
            [babelPresetTypescript, {}],
        ],
        plugins: [rewriteHPlugin(filename)],
    });
    return result.code;
}
function transformJS(code, id, opt, customFile) {
    if (id.includes("node_modules"))
        return code;
    const { filename = "" } = customFile || {};
    const result = babel.transformSync(code, {
        plugins: [rewriteHPlugin(filename)],
    });
    return result.code;
}
function rewriteHPlugin(filename) {
    return () => {
        let hName = "";
        return {
            visitor: {
                ImportDeclaration(path) {
                    if (path.node.source.value !== "vue")
                        return;
                    // 查找导入的 { h }
                    const hSpecifier = path.node.specifiers.find((specifier) => types.isImportSpecifier(specifier) &&
                        specifier.imported.name === "h");
                    if (hSpecifier) {
                        hName = hSpecifier.local.name;
                        const importWrapperH = types.importDeclaration([types.importDefaultSpecifier(types.identifier("wrapperH"))], types.stringLiteral("virtual-mode"));
                        /**
                         * 增强 h 函数, 使h函数能够将当前的信息传递给 wrapperH
                         * import { h } from "vue"
                         *
                         * import wrapperH from "virtual-mode";
                         */
                        path.insertAfter(importWrapperH);
                    }
                },
                CallExpression(path) {
                    const { callee, arguments: args } = path.node;
                    if (callee.type === "Identifier" && callee.name === hName) {
                        // only choose function call
                        const scopeBinding = path.scope.getBinding(callee.name);
                        if (scopeBinding && scopeBinding.kind !== "module")
                            return;
                        const line = path.node.loc.start.line;
                        const column = path.node.loc.start.column;
                        const info = `${filename}:${line}:${column}`;
                        const newArg = types.objectExpression([
                            types.objectProperty(types.stringLiteral("fast-element"), types.stringLiteral(info)),
                        ]);
                        const newArg1 = types.identifier("h");
                        args.unshift(newArg);
                        args.unshift(newArg1);
                        // 更新函数调用
                        callee.name = "wrapperH";
                    }
                },
            },
        };
    };
}
/**
 * Generate fast-to element path;
 */
function generatePath(type, path, astNode) {
    const { line, column } = astNode.loc.start;
    return `fast-${type}="${path}:${line}:${column}"`;
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
                return `
        export default function (h, info, ...args) {
          const l = args.length;
          const propsOrChildren = args[1];
          if (l === 0) h.apply(this, args);
          if (l === 2) {
            if (
              propsOrChildren !== null &&
              typeof propsOrChildren === "object" &&
              !Array.isArray(propsOrChildren)
            ) {
              return h.apply(this, [
                args[0],
                Object.assign(args[1], info),
                ...args.slice(1),
              ]);
            } else {
              return h.apply(this, [args[0], info, ...args.slice(1)]);
            }
          } else {
            return h.apply(this, [
              args[0],
              Object.assign(args[1] || {}, info),
              ...args.slice(1),
            ]);
          }
        }
        `;
            }
        }
    };
}
function pluginTransform() {
    return {
        name: "fast-to-plugin",
        enforce: "pre",
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
                return transformTs(code, id, opt, customFile);
            }
            if (type === "jsx") {
                return transformJsx();
            }
            if (type === "tsx") {
                return transformTsx();
            }
            return code;
        },
        renderChunk() {
            console.log(arguments);
            return null;
        }
    };
}
function pluginHTML() {
    let finalConfig = null;
    let ip = 'localhost';
    return {
        name: 'vite-plugin-fast-to-html',
        enforce: 'post',
        apply: 'serve',
        configResolved(resolvedConfig) {
            // 存储最终解析的配置
            finalConfig = resolvedConfig;
            // ip = getLocalIPV4Address() || ip;
            ip = 'localhost';
        },
        transformIndexHtml(html) {
            const port = finalConfig.server.port;
            const htmlString = `
        <style>
          .vite-fast-to-mask { position: relative; }
          .vite-fast-to-mask::after { pointer-events: none; position: absolute; content: ''; left: -1px; right: -1px;bottom: -1px;top: -1px; border: 1px solid silver; background-color: rgba(192,192,192,.3); z-index: 10000; }
        </style>
        <script>
          const findRecentNode = (node) => {
            let target = node
            let maxCount = 7;
            while (target && maxCount > 0) {
              const path =
                target.attributes && target.attributes['fast-element'] && target.attributes['fast-element'].nodeValue
              if (path) {
                return {
                  target,
                  path
                }
              }
              target = target.parentNode
              maxCount--
            }
            return {}
          }
          const init = () => {
            const event = (e) => {
              const { altKey, target } = e
              console.log(e)
              if (altKey) {
                const path = findRecentNode(target).path
                if (path) {
                  fetch('http://${ip}:${port}/__open-in-editor?file=' + path)
                }
                e.preventDefault()
                e.stopPropagation()
              }
            }
            window.addEventListener('click', event, { capture: true })
            const state = {
              key: '',
              prev: null,
            }
            const onkeydown = (e) => {
              const { key } = e; 
              state.key = key;
              if(key === 'Alt') {
                window.addEventListener('mousemove', onMousemove)
              }
            }
            const onkeyup = (e) => {
              state.key = ''
              window.removeEventListener('mousemove', onMousemove)
              if(state.prev) {
                state.prev.classList.remove('vite-fast-to-mask');
              }
            }
            const onMousemove = (e) => {


              const target = findRecentNode(e.target).target;

              if(!target) return;
              // 为了性能控考虑
              if(target && target === state.prev) {
                return;              
              }
              if(state.prev) {
                state.prev.classList.remove('vite-fast-to-mask');
              }
              target.classList.add('vite-fast-to-mask')
              state.prev = target
            }
            window.addEventListener('keydown', onkeydown, true)
            window.addEventListener('keyup', onkeyup, true)
            return () => window.removeEventListener('click', event)
          }
          const unmount = init()
        </script>
      `;
            html = html.replace('</head>', `${htmlString}</head>`);
            return html;
        }
    };
}
function fastToPlugin() {
    return [
        pluginTransform(),
        pluginVirtual(),
        pluginHTML(),
    ];
}

module.exports = fastToPlugin;
//# sourceMappingURL=main.cjs.js.map
