/**
 * Use prettier
 */
const fs = require('fs');
const prettier = require('prettier');

const sourceDir = 'src';

const pOpts = {
    arrowParens: 'always',
    semi: true,
    singleQuote: true,
    trailingComma: 'es5',
    parser: 'babylon',
}

const main = () => {
    const files = fs.readdirSync(sourceDir);
    files.map((file) => {
        // Set the Typescript parser for Typescript files
        if (file.slice(-2) === 'ts') {
            pOpts.parser = 'typescript';
        }

        const filePath = sourceDir + '/' + file;
        const raw = fs.readFileSync(filePath, 'utf8');

        // Check if it needs to be formatted
        const isFormatted = prettier.check(raw, pOpts);

        if (!isFormatted) {
            // Make backups
            const backup = filePath + '.b';
            fs.copyFileSync(filePath, backup);

            // Format the file in place
            const rawFormatted = prettier.format(raw, pOpts);
            fs.writeFileSync(filePath, rawFormatted, 'utf8');
        }
    })
}

main();
