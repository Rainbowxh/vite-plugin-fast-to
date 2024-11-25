import type { Plugin } from "vite";
import { parseSource } from "./util";
import {
  transformJS,
  transformJsx,
  transformTs,
  transformTsx,
  transformVue,
} from "./transform";
//@ts-ignore
import browser from "./_inject-browser.js";

function pluginVirtual(): Plugin<any> {
  return  {
    name: "fast-to-plugin-virtual",
    enforce: "pre",
    apply: "serve",
    resolveId(id: string) {
      if (id.includes("virtual-mode")) {
        return id;
      }
    },
    load(id: string) {
      if(id === 'virtual-mode-rewriteH') {
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
        `
      }


    }
  }
}

function pluginTransform(): Plugin<any> {
  return {
    name: "fast-to-plugin",
    enforce: "pre",
    apply: "serve",
    transform(code, id, opt) {
      const customFile = parseSource(id);
      const { type } = customFile;
      if (type === "vue") {
        return transformVue(code, id, opt, customFile);
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
  }
}

function pluginHTML(): Plugin<any> {
  let port = '';
  return {
      name: 'vite-plugin-fast-to-html',
      enforce: 'post',
      apply: 'serve',
      configResolved(resolvedConfig) {
        port = '' + resolvedConfig.server.port
      },
      transformIndexHtml(html) {
        let scriptContent = browser.replace('__port__', port);
        const htmlString = `<script>${scriptContent}</script>`
        html = html.replace('</head>', `${htmlString}</head>`)
        return html
      }
  }
}


export default function fastToPlugin(): Plugin<any>[] {
  return [
    pluginTransform(),
    pluginVirtual(),
    pluginHTML()
  ]
}
