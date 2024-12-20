import { CustomFile } from "./util";
//@ts-ignore
import * as compilerDom from "@vue/compiler-dom";

import MagicString from "magic-string";
//@ts-ignore
import babel from "@babel/core";

//@ts-ignore
import jsx from "@vue/babel-plugin-jsx";

//@ts-ignore
import types from "@babel/types";
//@ts-ignore
import _babelPresetTypescript from "@babel/preset-typescript";
const babelPresetTypescript = _babelPresetTypescript.default;

type VueAstNode = {
  loc: {
    start: {
      offset: number;
    };
  };
  tag: string;
  tagType: compilerDom.ElementTypes;
};

export function transformVue(
  code: string,
  id: string,
  opt: any,
  customFile?: CustomFile
) {
  const ast = compilerDom.parse(code, { comments: true });
  const ms = new MagicString(code);

  function dealTag(
    type: "element" | "component",
    node: VueAstNode,
    ms: MagicString
  ) {
    const tagLength = node.tag.length || 0;
    const pos = node.loc.start.offset + tagLength + 1;
    const data = " " + generatePath(type, id, node);
    ms.appendRight(pos, data);
  }

  compilerDom.transform(ast, {
    nodeTransforms: [
      (node) => {
        const { tag, tagType } = (node || {}) as VueAstNode;

        if (tagType === compilerDom.ElementTypes.ELEMENT) {
          if (tag === "template" || tag === "script" || tag === "style") {
            return;
          }
          dealTag("element", node as VueAstNode, ms);
        }

        if (tagType === compilerDom.ElementTypes.COMPONENT) {
          dealTag("component", node as VueAstNode, ms);
        }
      },
    ],
  });
  const result = ms.toString();
  return result;
}

export function transformTsx(
  code: string,
  id: string,
  opt: any,
  customFile?: CustomFile
) {
  const { filename = "" } = customFile || {};

  const result = babel.transformSync(code, {
    filename: filename,
    presets: [babelPresetTypescript],
    plugins: [jsx, rewriteCreateVnodePlugin(filename)],
  });

  return result.code;
}

export function transformJsx(
  code: string,
  id: string,
  opt: any,
  customFile?: CustomFile
) {
  const { filename = "" } = customFile || {};
  const result = babel.transformSync(code, {
    filename: filename,
    presets: [babelPresetTypescript],
    plugins: [jsx, rewriteCreateVnodePlugin(filename)],
  });
  return result.code;
}

export function transformTs(
  code: string,
  id: string,
  opt: any,
  customFile?: CustomFile
) {
  if (id.includes("node_modules")) return code;

  const { filename = "" } = customFile || {};

  // 使用 transformSync
  const result = babel.transformSync(code, {
    filename: filename,
    presets: [[babelPresetTypescript, {}]],
    plugins: [rewriteHPlugin(filename)],
  });

  return result.code;
}

function rewriteCreateVnodePlugin(filename: string) {
  return () => {
    return {
      visitor: {
        CallExpression(path: any) {
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
  
            if (scopeBinding) return;
  
            if (
              callee.type === "Identifier" &&
              callee.name.includes("_createVNode")
            ) {
              const loc = callee.loc || path.container.loc || path?.container?.block?.[0]?.loc || path?.scope?.block?.loc;
              if(!loc) {
                return;
              }
              const { line, column } = loc.start || {};
  
              const info = `${filename}:${line}:${column}`;
  
              const arg = path.node.arguments;
              if (Array.isArray(arg) && arg.length > 1) {
       
                const props = arg[1];
                const newProperty = types.objectProperty(
                  types.stringLiteral("fast-element"),
                  types.stringLiteral(info)
                );
                if (props.properties) {
                  props.properties.push(newProperty);
                } else {
                  props.properties = [newProperty];
                }
              }
            }
          }catch(err) {
            return;
          }
          
        },
      },
    };
  };
}

export function transformJS(
  code: string,
  id: string,
  opt: any,
  customFile?: CustomFile
) {
  if (id.includes("node_modules")) return code;

  const { filename = "" } = customFile || {};
  const result = babel.transformSync(code, {
    plugins: [rewriteHPlugin(filename)],
  });

  return result.code;
}

function rewriteHPlugin(filename: string) {
  return () => {
    let hName = "";
    return {
      visitor: {
        ImportDeclaration(path: any) {
          if (path.node.source.value !== "vue") return;

          // 查找导入的 { h }
          const hSpecifier = path.node.specifiers.find(
            (specifier: any) =>
              types.isImportSpecifier(specifier) &&
              (specifier.imported as any).name === "h"
          );

          if (hSpecifier) {
            hName = (hSpecifier.local as any).name;
            const importWrapperH = types.importDeclaration(
              [types.importDefaultSpecifier(types.identifier("wrapperH"))],
              types.stringLiteral("virtual-mode-rewriteH")
            );
            /**
             * 增强 h 函数, 使h函数能够将当前的信息传递给 wrapperH
             * import { h } from "vue"
             *
             * import wrapperH from "virtual-mode-rewriteH";
             */
            path.insertAfter(importWrapperH);
          }
        },
        CallExpression(path: any) {
          const { callee, arguments: args } = path.node;

          if (callee.type === "Identifier" && callee.name === hName) {
            // only choose function call
            const scopeBinding = path.scope.getBinding(callee.name);
            if (scopeBinding && scopeBinding.kind !== "module") return;

            const line = path.node.loc.start.line;
            const column = path.node.loc.start.column;

            const info = `${filename}:${line}:${column}`;
            const newArg = types.objectExpression([
              types.objectProperty(
                types.stringLiteral("fast-element"),
                types.stringLiteral(info)
              ),
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
function generatePath(
  type: "element" | "component",
  path: string,
  astNode: any
) {
  const { line, column } = astNode.loc.start;
  return `fast-${type}="${path}:${line}:${column}"`;
}
