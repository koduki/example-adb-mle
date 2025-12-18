import { spawn } from 'child_process';
import path from 'path';

// Parse arguments
const args = process.argv.slice(2);

if (args.length < 2) {
    console.error('Usage: node scripts/deploy_db.js <wallet_path> <connection_string>');
    console.error('Example: node scripts/deploy_db.js ./Wallet.zip admin/password@service_alias');
    process.exit(1);
}

const [walletPath, connectionString] = args;

console.log(`Wallet Path/Mode: ${walletPath}`);
console.log(`Connecting to: ${connectionString}`);

// Construct SQLcl command
// Note: SQLcl must be in the PATH
const sqlArgs = ['-S'];

if (walletPath.toUpperCase() !== 'LOCAL') {
    const resolvedWallet = path.resolve(walletPath);
    console.log(`Using Wallet: ${resolvedWallet}`);
    sqlArgs.push('-cloudconfig', resolvedWallet);
} else {
    console.log('Using Local Connection (No Wallet)');
}

sqlArgs.push(connectionString);

const sql = spawn('sql', sqlArgs, {
    stdio: ['pipe', 'inherit', 'inherit'],
    shell: true
});

// Send Liquibase commands to stdin
const commands = [
    'lb clear-checksums',
    'lb update -changelog-file db/controller.xml',
    'exit'
];

sql.stdin.write(commands.join('\n') + '\n');
sql.stdin.end();

sql.on('exit', (code) => {
    if (code !== 0) {
        console.error('Deployment failed with code:', code);
        process.exit(code);
    }
    console.log('Deployment successful.');
});
