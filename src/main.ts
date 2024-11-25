import type { Plugin } from "vite";
import { parseSource } from "./util";
import {
  transformJS,
  transformJsx,
  transformTs,
  transformTsx,
  transformVue,
} from "./transform";


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
  let finalConfig: any = null;
  let ip = 'localhost';
  return {
      name: 'vite-plugin-fast-to-html',
      enforce: 'post',
      apply: 'serve',
      configResolved(resolvedConfig) {
        // 存储最终解析的配置
        finalConfig = resolvedConfig
        // ip = getLocalIPV4Address() || ip;
        ip = 'localhost';
      },
      transformIndexHtml(html) {
      //   const port = finalConfig.server.port
      //   const htmlString = `
      //   <style>
      //     .vite-fast-to-mask { position: relative; }
      //     .vite-fast-to-mask::after { pointer-events: none; position: absolute; content: ''; left: -1px; right: -1px;bottom: -1px;top: -1px; border: 1px solid silver; background-color: rgba(192,192,192,.3); z-index: 10000; }
      //   </style>
      //   <script>
      //     const findRecentNode = (node) => {
      //       let target = node
      //       let maxCount = 7;
      //       while (target && maxCount > 0) {
      //         const path =
      //           target.attributes && target.attributes['fast-element'] && target.attributes['fast-element'].nodeValue
      //         if (path) {
      //           return {
      //             target,
      //             path
      //           }
      //         }
      //         target = target.parentNode
      //         maxCount--
      //       }
      //       return {}
      //     }
      //     const init = () => {
      //       const event = (e) => {
      //         const { altKey, target } = e
      //         console.log(e)
      //         if (altKey) {
      //           const path = findRecentNode(target).path
      //           if (path) {
      //             fetch('http://${ip}:${port}/__open-in-editor?file=' + path)
      //           }
      //           e.preventDefault()
      //           e.stopPropagation()
      //         }
      //       }
      //       window.addEventListener('click', event, { capture: true })
      //       const state = {
      //         key: '',
      //         prev: null,
      //       }
      //       const onkeydown = (e) => {
      //         const { key } = e; 
      //         state.key = key;
      //         if(key === 'Alt') {
      //           window.addEventListener('mousemove', onMousemove)
      //         }
      //       }
      //       const onkeyup = (e) => {
      //         state.key = ''
      //         window.removeEventListener('mousemove', onMousemove)
      //         if(state.prev) {
      //           state.prev.classList.remove('vite-fast-to-mask');
      //         }
      //       }
      //       const onMousemove = (e) => {


      //         const target = findRecentNode(e.target).target;

      //         if(!target) return;
      //         // 为了性能控考虑
      //         if(target && target === state.prev) {
      //           return;              
      //         }
      //         if(state.prev) {
      //           state.prev.classList.remove('vite-fast-to-mask');
      //         }
      //         target.classList.add('vite-fast-to-mask')
      //         state.prev = target
      //       }
      //       window.addEventListener('keydown', onkeydown, true)
      //       window.addEventListener('keyup', onkeyup, true)
      //       return () => window.removeEventListener('click', event)
      //     }
      //     const unmount = init()
      //   </script>
      // `
      //   html = html.replace('</head>', `${htmlString}</head>`)
      //   return html
      }
  }
}


export default function fastToPlugin(): Plugin<any>[] {
  return [
    pluginTransform(),
    pluginVirtual(),
    pluginHTML(),
    {
      name: 'test',
      renderChunk() {
        console.log(arguments)
        return null
      }
    }
  ];
}
