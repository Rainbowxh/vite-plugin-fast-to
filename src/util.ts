export const hasVue = (source: string): boolean =>
  typeof source === "string" && source.includes("vue");

export type CustomFile = {
  filename: string;
  type?: string;
  query?: Record<string, string>;
};

export const parseSource = (source: string): CustomFile => {
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


export const isVue = (customFile: CustomFile): boolean => {
  const { filename, query = {} } = customFile;
  if (!filename.endsWith(".vue")) return false;

  if (query.type !== "style" && !query.raw) {
    return true;
  }
  return false;
};

export const isTsx = (customFile: CustomFile): boolean => {
  const { filename } = customFile;
  return filename.endsWith(".tsx");
};

export const isJSX = (customFile: CustomFile): boolean => {
  const { filename } = customFile;
  return filename.endsWith(".jsx");
};

export const isJS = (customFile: CustomFile): boolean => {
  const { filename } = customFile;
  return filename.endsWith(".js");
};
