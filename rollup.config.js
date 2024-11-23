import typescript from '@rollup/plugin-typescript';
import minimist from "minimist"

const generateConfig = () => {
  const input = './src/main.ts'

  const arg = minimist(process.argv.slice(2))


  const baseConfig = {
    sourcemap: true,
    input,
    plugins: [typescript({
      tsconfig: './tsconfig.json'
    })]
  }

  const configs = {
    esm: {
      ...baseConfig,
      output: {
        file: 'dist/main.esm.js',
        sourcemap: true,
        format: 'esm',
      }
    },
    cjs: {
      ...baseConfig,
      output: {
        file: 'dist/main.cjs.js',
        sourcemap: true,
        format: 'cjs',
      }
    },
    umd: {
      ...baseConfig,
      output: {
        name: 'MyLibrary',
        file: 'dist/main.umd.js',
        sourcemap: true,
        format: 'umd',
      }
    }
  }

  const format = arg.format || '';

  if(!format) {
    return Object.keys(configs).map(key => configs[key]);
  }else {
    return configs[format]
  }
}


export default generateConfig();
