import { PathLike, fileProvider, log } from '../io';
import { ConfigureHooks, EnvironmentConfig } from '../models';
import { toAbsoluteFilename, findRootDir } from './fsUtils';
import { loadModule } from './moduleUtils';

export async function getHttpacConfig(rootDir: PathLike) : Promise<EnvironmentConfig | undefined> {
  let result = await loadFileConfig(rootDir);
  if (!result) {
    result = (await parseJson<Record<string, EnvironmentConfig>>(fileProvider.joinPath(rootDir, 'package.json')))?.httpyac;
  }
  if (result) {
    await resolveClientCertficates(result, rootDir);
  }
  return result;
}

async function loadFileConfig(rootDir: PathLike): Promise<EnvironmentConfig | undefined> {
  const possibleConfigPaths: Array<string | undefined> = [
    process.env.HTTPYAC_SERVICE_CONFIG_PATH,
    './.httpyac.js',
    './httpyac.config.js',
    './.httpyac.json',
    './httpyac.config.json',
  ];
  let fileConfigPath: PathLike | undefined;
  for (const fileName of possibleConfigPaths) {
    const resolvedPath = fileName && fileProvider.joinPath(rootDir, fileName);
    if (resolvedPath && await fileProvider.exists(resolvedPath)) {
      fileConfigPath = resolvedPath;
      break;
    }
  }
  if (fileConfigPath) {
    const fileConfig = loadModule<EnvironmentConfig |(() => EnvironmentConfig)>(fileProvider.fsPath(fileConfigPath), fileProvider.fsPath(rootDir), true);
    if (typeof fileConfig === 'function') {
      return fileConfig();
    }
    return fileConfig;

  }
  return undefined;
}


export async function parseJson<T>(fileName: PathLike) : Promise<T | undefined> {
  try {
    const text = await fileProvider.readFile(fileName, 'utf-8');
    return JSON.parse(text);
  } catch (err) {
    log.debug(`json parse of ${fileName} failed`);
  }
  return undefined;
}


export async function resolveClientCertficates(config: EnvironmentConfig, rootDir: PathLike) : Promise<void> {
  if (config.clientCertificates) {
    for (const [, value] of Object.entries(config.clientCertificates)) {
      if (value.cert) {
        value.cert = await toAbsoluteFilename(value.cert, rootDir, true) || value.cert;
      }
      if (value.key) {
        value.key = await toAbsoluteFilename(value.key, rootDir, true) || value.key;
      }
      if (value.pfx) {
        value.pfx = await toAbsoluteFilename(value.pfx, rootDir, true) || value.pfx;
      }
    }
  }
}


interface PackageJson{
  dependencies?: Record<string, unknown>,
  devDependencies?: Record<string, unknown>
}


export async function getPlugins(rootDir: PathLike) : Promise<Record<string, ConfigureHooks>> {
  const packageJson = await getPackageJson(rootDir);
  const hooks: Record<string, ConfigureHooks> = {};
  if (packageJson?.json) {
    const plugins = [
      ...Object.keys(packageJson.json.dependencies || {}),
      ...Object.keys(packageJson.json.devDependencies || {})
    ].filter(isPlugin);
    for (const dep of plugins) {
      const hook = loadModule<ConfigureHooks>(dep, fileProvider.fsPath(packageJson.dir));
      if (hook) {
        hooks[dep] = hook;
      }
    }
  }
  return hooks;
}
async function getPackageJson(rootDir: PathLike) {
  const packageDir = await findRootDir(rootDir, 'package.json');

  if (packageDir) {
    return {
      dir: packageDir,
      json: await parseJson<PackageJson>(fileProvider.joinPath(packageDir, 'package.json')),
    };
  }
  return undefined;
}

function isPlugin(dep: string) {
  return /^(httpyac-|@[\w-]+(\.)?[\w-]+\/httpyac-)plugin-/u.test(dep);
}