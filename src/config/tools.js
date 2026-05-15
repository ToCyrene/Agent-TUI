const toolConfig = {
  // npm 会设置 INIT_CWD 为执行 npm 命令时的目录，优先使用它
  workDir: process.env.INIT_CWD || process.cwd(),
  blockedPaths: ['.env', '.git', 'node_modules'],
  readMaxBytes: 100_000,
  commandTimeout: 30,
  commandMaxBuffer: 1024 * 1024,
};

export default toolConfig;
