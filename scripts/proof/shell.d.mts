// The types of scripts/proof/shell.mjs's exports, for the root tests that import it (tests/proof-audit.test.ts).

export declare function shellCommands(command: string): string[][]
export declare function commandWords(command: string): string[]
export declare function gitInvocations(command: string): string[][]
export declare function gitLocations(command: string): string[]
