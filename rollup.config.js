import typescript from "@rollup/plugin-typescript";
import minimist from "minimist";
import fs from "fs";
import path from "path";

const generateConfig = () => {
  const input = "./src/main.ts";
  const arg = minimist(process.argv.slice(2));

  const baseConfig = {
    input,
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
      }),
      {
        name: "browser-inject",
        resolveId(id) {
          if (id.includes("_inject-browser")) {
            return id;
          }
        },
        load(id) {
          if (id.includes("_inject-browser")) {
            const filePath = path.resolve(
              process.cwd(),
              "./src/_inject-browser.js"
            );
            const file = fs.readFileSync(filePath, "utf-8");
            return `const str = ${JSON.stringify(file)};export default str;`;
          }
        },
      },
    ],
  };

  const configs = {
    esm: {
      ...baseConfig,
      output: {
        name: "vitePluginFastTo",
        file: "dist/main.esm.js",
        sourcemap: true,
        format: "esm",
      },
    },
    cjs: {
      ...baseConfig,
      output: {
        file: "dist/main.cjs.js",
        sourcemap: true,
        format: "cjs",
      },
    },
    umd: {
      ...baseConfig,
      output: {
        name: "MyLibrary",
        file: "dist/main.umd.js",
        sourcemap: true,
        format: "umd",
      },
    },
  };

  const format = arg.format || "";

  if (!format) {
    return Object.keys(configs).map((key) => configs[key]);
  } else {
    return configs[format];
  }
};

export default generateConfig();
