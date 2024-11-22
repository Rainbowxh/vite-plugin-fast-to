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
      if( id.includes("virtual-mode")) {
        return `export default function(h,info,...args) {
          console.log(info);
          return h(...args);
        }`
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


export default function fastToPlugin(): Plugin<any>[] {
  return [
    pluginTransform(),
    pluginVirtual()
  ];
}
