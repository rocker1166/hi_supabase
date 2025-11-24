#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const dotenv = require('dotenv');
const { execSync } = require('child_process');

// Load environment variables from .env file
dotenv.config();

const projectRoot = process.cwd();
const templatesDir = path.join(__dirname, '../templates');

const filesToCopy = [
  {
    src: 'route.ts',
    dest: 'app/api/keep-alive/route.ts',
    msg: 'Created API route at app/api/keep-alive/route.ts'
  },
  {
    src: 'keepAliveUtils.ts',
    dest: 'app/api/keep-alive/keepAliveUtils.ts',
    msg: 'Created utils at app/api/keep-alive/keepAliveUtils.ts'
  },
  {
    src: 'keep-alive-config.ts',
    dest: 'config/keep-alive-config.ts',
    msg: 'Created config at config/keep-alive-config.ts'
  },
  {
    src: 'keep-alive.sql',
    dest: 'keep-alive.sql',
    msg: 'Created SQL script at keep-alive.sql'
  },
  {
    src: 'vercel.json',
    dest: 'vercel.json',
    msg: 'Created vercel.json at vercel.json'
  }
];

function detectPackageManager() {
  if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function installDependencies() {
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return;

  const packageJson = fs.readJsonSync(packageJsonPath);
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};

  const requiredDeps = ['@supabase/supabase-js'];
  const missingDeps = requiredDeps.filter(dep => !dependencies[dep] && !devDependencies[dep]);

  if (missingDeps.length > 0) {
    const pm = detectPackageManager();
    console.log(chalk.blue(`\nInstalling missing dependencies (${missingDeps.join(', ')}) using ${pm}...`));
    
    try {
      const installCmd = pm === 'npm' ? 'install' : 'add';
      execSync(`${pm} ${installCmd} ${missingDeps.join(' ')}`, { stdio: 'inherit' });
      console.log(chalk.green('✓ Dependencies installed successfully.'));
    } catch (error) {
      console.error(chalk.red('! Failed to install dependencies automatically. Please install them manually.'));
    }
  }
}

async function checkAndCreateSupabaseClient() {
  const targetPath = path.join(projectRoot, 'lib/supabase/server.ts');
  
  // Check if file exists
  if (fs.existsSync(targetPath)) {
    console.log(chalk.green('✓ Found existing Supabase client at lib/supabase/server.ts'));
    return;
  }

  // Also check if user might have it in other common locations to avoid duplication
  const commonPaths = [
    'utils/supabase/server.ts',
    'lib/supabase/client.ts',
    'utils/supabase/client.ts'
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(path.join(projectRoot, p))) {
      console.log(chalk.yellow(`! Found Supabase client at ${p}. Please ensure 'app/api/keep-alive/route.ts' imports it correctly.`));
      // We don't overwrite if they have one elsewhere, but we warn them.
      // However, our route.ts imports from @/lib/supabase/server, so we might need to create it anyway or ask them to change it.
      // For now, let's create it at the expected location if it doesn't exist there, to ensure our code works out of the box.
      // But creating a duplicate might be confusing.
      // Let's stick to: if lib/supabase/server.ts doesn't exist, create it.
    }
  }

  try {
    const srcPath = path.join(templatesDir, 'supabase-server.ts');
    await fs.ensureDir(path.dirname(targetPath));
    await fs.copy(srcPath, targetPath);
    console.log(chalk.green('✓ Created Supabase client at lib/supabase/server.ts'));
  } catch (err) {
     console.error(chalk.red(`Error creating Supabase client: ${err.message}`));
  }
}

async function init() {
  console.log(chalk.blue('Initializing hi-supabase...'));

  // 1. Check for Environment Variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn(chalk.yellow('Warning: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not found in .env file.'));
    console.warn(chalk.yellow('Please ensure you have your Supabase credentials set up.'));
  } else {
    console.log(chalk.green('✓ Found Supabase environment variables.'));
  }

  // 2. Copy Files
  for (const file of filesToCopy) {
    try {
      const srcPath = path.join(templatesDir, file.src);
      const destPath = path.join(projectRoot, file.dest);

      // Ensure destination directory exists
      await fs.ensureDir(path.dirname(destPath));

      // Copy file
      await fs.copy(srcPath, destPath, { overwrite: false, errorOnExist: true });
      console.log(chalk.green(`✓ ${file.msg}`));
    } catch (err) {
      if (err.code === 'EEXIST') {
        console.log(chalk.yellow(`! File already exists: ${file.dest} (skipped)`));
      } else {
        console.error(chalk.red(`Error copying ${file.src}: ${err.message}`));
      }
    }
  }

  // 3. Check/Create Supabase Client
  await checkAndCreateSupabaseClient();

  // 4. Install Dependencies
  installDependencies();

  console.log(chalk.blue('\nSetup complete!'));
  console.log(chalk.white('To finish setup:'));
  console.log(chalk.white('1. Run the content of `keep-alive.sql` in your Supabase SQL Editor to create the table.'));
  console.log(chalk.white('2. Deploy your project. The `vercel.json` will automatically configure the cron job.'));
}

async function uninstall() {
  console.log(chalk.blue('Uninstalling hi-supabase...'));

  const filesToDelete = [
    'app/api/keep-alive/route.ts',
    'app/api/keep-alive/keepAliveUtils.ts',
    'config/keep-alive-config.ts',
    'keep-alive.sql',
    'vercel.json'
  ];

  for (const file of filesToDelete) {
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath)) {
      try {
        await fs.remove(filePath);
        console.log(chalk.green(`✓ Deleted ${file}`));
      } catch (err) {
        console.error(chalk.red(`Error deleting ${file}: ${err.message}`));
      }
    } else {
      console.log(chalk.gray(`- ${file} not found (skipped)`));
    }
  }

  // Attempt to remove directories if empty
  const dirsToClean = [
    'app/api/keep-alive',
    'config'
  ];

  for (const dir of dirsToClean) {
    const dirPath = path.join(projectRoot, dir);
    if (fs.existsSync(dirPath)) {
      const files = await fs.readdir(dirPath);
      if (files.length === 0) {
        await fs.remove(dirPath);
        console.log(chalk.green(`✓ Removed empty directory ${dir}`));
      }
    }
  }

  console.log(chalk.blue('\nUninstallation complete!'));
  console.log(chalk.white('Note: `lib/supabase/server.ts` was NOT deleted as it may be used by other parts of your app.'));
  console.log(chalk.white('You can now remove the package dependency:'));
  console.log(chalk.cyan('   pnpm remove hi-supabase'));
}

const args = process.argv.slice(2);

if (args.includes('uninstall')) {
  uninstall().catch(err => {
    console.error(chalk.red('An unexpected error occurred during uninstall:'), err);
    process.exit(1);
  });
} else {
  init().catch(err => {
    console.error(chalk.red('An unexpected error occurred:'), err);
    process.exit(1);
  });
}
