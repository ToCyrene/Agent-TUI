const toolConfig = {
  workDir: process.env.INIT_CWD || process.cwd(),
  blockedPaths: ['.env', '.git', 'node_modules'],
  readMaxBytes: 100_000,
  commandTimeout: 30,
  commandMaxBuffer: 1024 * 1024,
  maxToolOutputLines: 5,
  maxDiffLines: 15,
  writeMaxExistingLines: 50,
};

export default toolConfig;
