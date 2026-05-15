const toolConfig = {
  workDir: process.cwd(),
  blockedPaths: ['.env', '.git', 'node_modules'],
  readMaxBytes: 100_000,
  commandTimeout: 30,
  commandMaxBuffer: 1024 * 1024,
};

export default toolConfig;
