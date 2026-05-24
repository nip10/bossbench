declare const Bun: {
  file(path: string): { textSync(): string };
  write(path: string, contents: string): void;
};
