import { CustomFile } from "./util";
import compilerDom, { compile } from "@vue/compiler-dom";
import MagicString from "magic-string";
//@ts-ignore
import babel from "@babel/core";
//@ts-ignore
import types from "@babel/types";
import parser from "@babel/parser";
//@ts-ignore
import _traverse from "@babel/traverse";
const traverse = _traverse.default;

export function transformVue(
  code: string,
  id: string,
  opt: any,
  customFile?: CustomFile
) {
  const ast = compilerDom.parse(code, { comments: true });
  const ms = new MagicString(code);

  compilerDom.transform(ast, {
    nodeTransforms: [
      (node) => {
        const { tag, tagType } = (node || {}) as {
          tag: string;
          tagType: compilerDom.ElementTypes;
        };

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

export function transformTsx(
  code: string,
  id: string,
  opt: any,
  customFile?: CustomFile
) {}

export function transformJsx(
  code: string,
  id: string,
  opt: any,
  customFile?: CustomFile
) {}

export function transformTs(
  code: string,
  id: string,
  opt: any,
  customFile?: CustomFile
) {}

export function transformJS(
  code: string,
  id: string,
  opt: any,
  customFile?: CustomFile
) {
  if(id.includes('node_modules')) return code;

  const { filename = '' } = customFile || {};
  
  const result = babel.transformSync(code, {
    plugins: [rewriteHPlugin(filename)],
  });
  return result.code;
}

const rewriteHPlugin = (filename: string) => {

  return () => {
    return {
      visitor: {
        CallExpression(path: any) {
          const { callee, arguments: args } = path.node;
          // 仅处理导入的 h 函数
          if (
            callee.type === 'Identifier' &&
            callee.name === 'h' 
          ) {
            const line = path.node.loc.start.line;
            const column = path.node.loc.start.column;

            const info = `${filename}:${line}:${column}`

            const newArg = types.objectExpression([
              types.objectProperty(types.stringLiteral('fast-element'), types.stringLiteral(info)),
            ]);
            const newArg1 = types.identifier('h');
            args.unshift(newArg);
            args.unshift(newArg1);
            // 更新函数调用
            callee.name = 'wrapperH'
          }
        },
        ImportDeclaration(path: any) {
          // 检查是否是从 "vue" 导入
          if (path.node.source.value === "vue") {
            // 查找导入的 { h }
            const hSpecifier = path.node.specifiers.find(
              (specifier: any) =>
                types.isImportSpecifier(specifier) &&
                (specifier.imported as any).name === "h"
            );
  
            if (hSpecifier) {
              path.node._isVueH = true;
              // 修改 h 的导入为 h as _h
              const importWrapperH = types.importDeclaration(
                [types.importDefaultSpecifier(types.identifier('wrapperH'))],
                types.stringLiteral('virtual-mode')
              );
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
  }
};

/**
 * Generate fast-to element path;
 */
function generatePath(
  type: "element" | "component",
  path: string,
  astNode: any
) {
  const { line, column } = astNode.loc.start;
  return ` fast-${type}="${path}:${line}:${column}"`;
}
