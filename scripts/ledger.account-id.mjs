import { Command, InvalidArgumentError, Option } from 'commander';
import { Principal } from '@dfinity/principal';
import { accountIdentifier } from './utils/ledger.utils.mjs';

const program = new Command();
program
    .addOption(
        new Option('--to <value>', 'Defines the type of output value. By default, the account identifier is displayed in hex.')
            .default('hex')
            .choices(['hex', 'did'])
    )
    .addOption(
        new Option('--principal <principal>', 'The user principal.').argParser(parsePrincipal)
    )
    .parse(process.argv);
    
function parsePrincipal(principal) {
    try {
        return Principal.fromText(principal);
    } catch (_) {
        throw new InvalidArgumentError('Not a principal.');
    }
}
    
const opts = program.opts();
switch (opts.to) {
    case 'did':
        console.log(`record { bytes = vec { ${accountIdentifier(opts.principal).toUint8Array().join(';')} }; }`);
        break;
    default:
        console.log('Account identifier:', accountIdentifier(opts.principal).toHex());
        break;
}