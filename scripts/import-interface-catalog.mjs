// Rebuild from an extracted, user-owned InterfaceBench release; never fetch on startup.
import {writeFile,copyFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const root=process.argv[2];if(!root)throw Error('Pass the extracted InterfaceBench server directory');
const {builtinParts,categories}=await import(pathToFileURL(root+'/js/component-library.js'));
await writeFile('dist/interface-catalog.js','// Catalog data from INTERFACEBENCH v1.6.0-rc.1. See INTERFACEBENCH-LICENSE.txt.\nexport const interfaceCategories='+JSON.stringify(categories)+';\nexport const interfaceDefinitions='+JSON.stringify(builtinParts)+';\n');
await copyFile(root+'/LICENSE','dist/INTERFACEBENCH-LICENSE.txt');
console.log(`Imported ${builtinParts.length} definitions without changing source dimensions or provenance.`);
