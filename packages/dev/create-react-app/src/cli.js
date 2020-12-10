// @flow strict-local

import program from 'commander';
// flowlint-next-line untyped-import:off
import {name, version} from '../package.json';
import mkdirp from 'mkdirp';
// flowlint-next-line untyped-import:off
import simpleGit from 'simple-git';
import fs from 'fs';
import path from 'path';
import _ncp from 'ncp';
import {promisify} from 'util';
import commandExists from 'command-exists';
// flowlint-next-line untyped-import:off
import spawn from '@npmcli/promise-spawn';

const ncp = promisify(_ncp);

// flowlint-next-line untyped-import:off
require('v8-compile-cache');

program.name(name).version(version);
program.action((command: string | typeof program) => {
  if (typeof command !== 'string') {
    command.help();
    return;
  }

  run(command).catch(reason => {
    // eslint-disable-next-line no-console
    console.error(reason.message);
    process.exit(1);
  });
});

program.parse(process.argv);

async function run(packagePath: string) {
  log('running path', packagePath);
  if (await fsExists(packagePath)) {
    throw new Error(`Package at ${packagePath} already exists`);
  }

  // Create directory
  log('Creating package directory...');
  await mkdirp(packagePath);

  // Initialize repo
  const git = simpleGit({baseDir: packagePath});
  log('Initializing git repository...');
  await git.init();

  // Copy templates
  log('Copying templates...');
  await ncp(path.resolve(__dirname, '../templates'), packagePath);

  // Install packages
  log('Installing packages...');
  await installPackages(['parcel@nightly'], {
    cwd: packagePath,
    isDevDependency: true,
  });
  log('INSTALLING REACT');
  await installPackages(['react', 'react-dom'], {cwd: packagePath});

  // Initial commit

  // Print instructions
  log(`Run ${usesYarn ? 'yarn' : 'npm run'} start`);
}

async function fsExists(filePath: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(filePath)) && true;
  } catch {
    return false;
  }
}

function log(...args: Array<mixed>): void {
  // eslint-disable-next-line no-console
  console.log(...args);
}

let usesYarn;
async function installPackages(
  packageExpressions: Array<string>,
  opts: {|
    cwd: string,
    isDevDependency?: boolean,
  |},
): Promise<void> {
  if (usesYarn == null) {
    usesYarn = await commandExists('yarn');
    if (!(await commandExists('npm'))) {
      throw new Error('Neither npm nor yarn found on system');
    }
  }

  if (usesYarn) {
    return spawn(
      'yarn',
      [
        'add',
        opts.isDevDependency ? '--dev' : null,
        ...packageExpressions,
      ].filter(Boolean),
      {cwd: opts.cwd, stdio: 'inherit'},
    );
  }

  return spawn(
    'npm',
    [
      'install',
      opts.isDevDependency ? '--save-dev' : null,
      ...packageExpressions,
    ].filter(Boolean),
    {cwd: opts.cwd, stdio: 'inherit'},
  );
}
