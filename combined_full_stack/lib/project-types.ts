export type GeneratedTypeFile = {
  name: string;
  language: "typescript" | "python";
  content: string;
};

export type ProjectTypesResponse = {
  files: GeneratedTypeFile[];
};
