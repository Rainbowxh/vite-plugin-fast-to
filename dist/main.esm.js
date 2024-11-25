import * as compilerDom from '@vue/compiler-dom';
import MagicString from 'magic-string';
import babel from '@babel/core';
import jsx from '@vue/babel-plugin-jsx';
import types from '@babel/types';
import _babelPresetTypescript from '@babel/preset-typescript';

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

//@ts-ignore
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
                    dealTag("element", node, ms);
                }
                if (tagType === compilerDom.ElementTypes.COMPONENT) {
                    dealTag("component", node, ms);
                }
            },
        ],
    });
    const result = ms.toString();
    return result;
}
function transformTsx(code, id, opt, customFile) {
    const { filename = "" } = customFile || {};
    const result = babel.transformSync(code, {
        filename: filename,
        presets: [babelPresetTypescript],
        plugins: [jsx, rewriteCreateVnodePlugin(filename)],
    });
    return result.code;
}
function transformJsx(code, id, opt, customFile) {
    const { filename = "" } = customFile || {};
    const result = babel.transformSync(code, {
        filename: filename,
        presets: [babelPresetTypescript],
        plugins: [jsx, rewriteCreateVnodePlugin(filename)],
    });
    return result.code;
}
function transformTs(code, id, opt, customFile) {
    if (id.includes("node_modules"))
        return code;
    const { filename = "" } = customFile || {};
    // 使用 transformSync
    const result = babel.transformSync(code, {
        filename: filename,
        presets: [[babelPresetTypescript, {}]],
        plugins: [rewriteHPlugin(filename)],
    });
    return result.code;
}
function rewriteCreateVnodePlugin(filename) {
    return () => {
        return {
            visitor: {
                CallExpression(path) {
                    try {
                        const { callee } = path.node;
                        /**
                         * `return <div></div> ` is transfer to `return _createVNode('div')`
                         * It has no scopebinding because it is transferred by vueJsx node;
                         * To avoid custom function like:
                         *    function render() {
                         *      function _createVNode() {}
                         *      _createVNode();
                         *      return <div></div>
                         *    }
                         */
                        const scopeBinding = path.scope.getBinding(callee.name);
                        if (scopeBinding)
                            return;
                        if (callee.type === "Identifier" &&
                            callee.name.includes("_createVNode")) {
                            const loc = callee.loc || path.container.loc || path?.container?.block?.[0]?.loc || path?.scope?.block?.loc;
                            if (!loc) {
                                return;
                            }
                            const { line, column } = loc.start || {};
                            const info = `${filename}:${line}:${column}`;
                            const arg = path.node.arguments;
                            if (Array.isArray(arg) && arg.length > 1) {
                                const props = arg[1];
                                const newProperty = types.objectProperty(types.stringLiteral("fast-element"), types.stringLiteral(info));
                                if (props.properties) {
                                    props.properties.push(newProperty);
                                }
                                else {
                                    props.properties = [newProperty];
                                }
                            }
                        }
                    }
                    catch (err) {
                        return;
                    }
                },
            },
        };
    };
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
                        const importWrapperH = types.importDeclaration([types.importDefaultSpecifier(types.identifier("wrapperH"))], types.stringLiteral("virtual-mode-rewriteH"));
                        /**
                         * 增强 h 函数, 使h函数能够将当前的信息传递给 wrapperH
                         * import { h } from "vue"
                         *
                         * import wrapperH from "virtual-mode-rewriteH";
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

const str = "function initBrowserScript() {\n  initKeyBoard();\n  initStyle();\n}\n\nfunction initKeyBoard() {\n  const opt = {\n    _status: '',\n    get status() {\n      return this._status;\n    },\n    set status(value) {\n      this._status = value;\n    },\n    metaKey: false,\n    listeners: [],\n    weakMap: new WeakMap(),\n    mention: {\n      dom: document.createElement('div'),\n      cleanup: []\n    }\n  }\n  Object.defineProperty(opt, '_status', {\n    value: '',\n    writable: true,\n    enumerable: false,\n    configurable: true\n  });\n  function onKeyDown(e) {\n    opt.status = 'keydown';\n    opt.metaKey = e.metaKey\n    if(opt.metaKey) {\n      onMouseMove(e)\n      window.addEventListener('mousemove', onMouseMove);\n      opt.listeners.push(() => window.removeEventListener('mousemove', onMouseMove))\n    }\n  }\n\n  function onMouseMove(e) {\n    if(opt.status !== 'keydown') return;\n\n    window.addEventListener('click', onMouseMoveClick, {capture: true});\n    opt.listeners.push(() => window.removeEventListener('click', onMouseMoveClick));\n\n    window.addEventListener('contextmenu', onMouseMoveContextmenu, {capture: true});\n    opt.listeners.push(() => window.removeEventListener('contextmenu', onMouseMoveContextmenu));\n\n    window.addEventListener('click', onCloseContextmenu);\n    opt.listeners.push(() => window.removeEventListener('click', onMouseMoveClick));\n  }\n\n  function collectInfo(e) {\n    let current = e.target;\n    let depth = 7;\n    let result = opt.weakMap.get(current) || {\n      all: [],\n      element: [],\n      component: [],\n    }\n    if(opt.weakMap.has(current)) {\n      result = opt.weakMap.get(current);\n    }else {\n      const _target = current\n      while(current && depth > 0) {\n        const attributes = current.attributes;\n        \n        if(attributes && attributes['fast-component']){\n          result.component.push(attributes['fast-component'].value)\n          result.all.push(attributes['fast-component'].value)\n        }\n        if(attributes && attributes['fast-element']){\n          if(result.component.length === 0) result.component.push(attributes['fast-element'].value)\n          result.element.push(attributes['fast-element'].value)\n          result.all.push(attributes['fast-element'].value)\n        }\n        current = current.parentNode;\n        depth--;  \n      }\n      opt.weakMap.set(_target, result)\n    }\n  }\n  \n  function onMouseMoveClick(e) {\n    if(opt.status !== 'keydown') return;\n    if(!opt.metaKey) return;\n    e.preventDefault();\n    e.stopPropagation();\n    \n    collectInfo(e)\n\n    const current = e.target;\n    const currentInfo = opt.weakMap.get(current);\n    const path = currentInfo.element[0];\n    openEditor(path)\n  }\n\n  function onMouseMoveContextmenu(e) {\n    opt.mention.dom.innerHTML = ''\n    opt.mention.cleanup.forEach(fn => fn())\n\n    if(opt.status !== 'keydown') return;\n    if(!opt.metaKey) return;\n    \n    e.preventDefault();\n    e.stopPropagation();\n\n    collectInfo(e)\n\n    const { all } = opt.weakMap.get(e.target) || {}\n    for(let i = 0; i < all.length; i++) {\n      const dom = document.createElement('div');\n      dom.innerText = all[i].slice(-30);\n      dom.style.margin = '5px';\n      dom.style.cursor = 'pointer';\n      const func = (e) => {\n        e.preventDefault();\n        e.stopPropagation()\n        openEditor(all[i]); \n      }\n      dom.addEventListener('click', func)\n      opt.mention.dom.appendChild(dom)\n      opt.mention.cleanup.push(() => dom.removeEventListener('click', func))\n    }\n\n    opt.mention.dom.style.display = 'block';\n    opt.mention.dom.style.left = e.pageX + 'px';\n    opt.mention.dom.style.top = e.pageY + 'px';\n    opt.mention.dom.style.position = 'absolute';\n    opt.mention.dom.style.zIndex = 10000;\n    opt.mention.dom.style.background = 'white';\n    opt.mention.dom.style.border = '1px solid #ccc';\n    opt.mention.dom.style.padding = '5px';\n    opt.mention.dom.style.borderRadius = '5px';\n\n    document.body.appendChild(opt.mention.dom)\n\n  }\n\n  function onCloseContextmenu(e) {\n    try {\n      document.body.removeChild(opt.mention.dom)\n    }catch(e) {}\n  }\n\n  function openEditor(path) {\n    fetch('http://localhost:__port__/__open-in-editor?file=' + path)\n  }\n\n  function onOtherEvent() {\n    opt.status = '';\n    opt.metaKey = false;\n    opt.listeners.forEach(fn => fn())\n  }\n  window.addEventListener('keydown', onKeyDown)\n  window.addEventListener('keyup', onOtherEvent)\n  window.addEventListener('mouseleave', onOtherEvent)\n  function onVisibilityChange() {\n    if(document.hidden) {\n      onOtherEvent();\n    }\n  }\n\n  window.addEventListener('visibilitychange', onVisibilityChange)\n  \n  return () => {\n    window.removeEventListener('keydown', onKeyDown)\n    window.removeEventListener('keyup', onOtherEvent)\n    window.removeEventListener('mouseleave', onOtherEvent)\n    window.removeEventListener('visibilitychange', onVisibilityChange)\n    opt.listeners.forEach(fn => fn())\n  }\n}\n\nfunction initStyle() {\n  const body = document.body;\n  if(!body) return;\n  const styleDom = document.createElement('style');\n  styleDom.innerHTML = `\n    .vite-fast-to-mask { position: relative; }\n    .vite-fast-to-mask::after { pointer-events: none; position: absolute; content: ''; left: -1px; right: -1px;bottom: -1px;top: -1px; border: 1px solid silver; background-color: rgba(192,192,192,.3); z-index: 10000; }\n  `\n  body.appendChild(styleDom);\n}\n\nfunction initPath() {}\n\ninitBrowserScript();\n";

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
            if (id === 'virtual-mode-rewriteH') {
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
                return transformTs(code, id, opt, customFile);
            }
            if (type === "jsx") {
                return transformJsx(code, id, opt, customFile);
            }
            if (type === "tsx") {
                return transformTsx(code, id, opt, customFile);
            }
            return code;
        }
    };
}
function pluginHTML() {
    let port = '';
    return {
        name: 'vite-plugin-fast-to-html',
        enforce: 'post',
        apply: 'serve',
        configResolved(resolvedConfig) {
            port = '' + resolvedConfig.server.port;
        },
        transformIndexHtml(html) {
            let scriptContent = str.replace('__port__', port);
            const htmlString = `<script>${scriptContent}</script>`;
            html = html.replace('</head>', `${htmlString}</head>`);
            return html;
        }
    };
}
function fastToPlugin() {
    return [
        pluginTransform(),
        pluginVirtual(),
        pluginHTML()
    ];
}

export { fastToPlugin as default };
//# sourceMappingURL=main.esm.js.map
