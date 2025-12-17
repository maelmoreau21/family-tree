
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'static', 'builder', 'builder.js');
let content = fs.readFileSync(filePath, 'utf8');

// Fix encoding issues (UTF-8 interpreted as Latin-1/Windows-1252 and then saved as UTF-8 again)
const replacements = [
    ['Ã©', 'é'],
    ['Ã¨', 'è'],
    ['Ã ', 'à'],
    ['Ã¢', 'â'],
    ['Ãª', 'ê'],
    ['Ã´', 'ô'],
    ['Ã§', 'ç'],
    ['Ã«', 'ë'],
    ['Ã¯', 'ï'],
    ['Ã', 'à'],
    ['â€™', '’'],
    ['Â', ''], // often nbsp artifact
    ['Documents liés à la personne (Bientôt disponible)', ''],
    ['Documents liÃ©s à la personne (BientÃ´t disponible)', ''],
    ['Documents liÃƒÂ©s ÃƒÂ  la personne (BientÃƒÂ´t disponible)', ''],
    ['ÃƒÂ©', 'é'],
    ['ÃƒÂ¨', 'è'],
    ['ÃƒÂ', 'à'],
    ['Ã¢â‚¬â„¢', '’'],
    ['Ã¢Å“â€¦', '✅'],
    ['Ã¢â‚¬Â¦', '...'],
    ['àƒ©', 'é'],
    ['àƒ¨', 'è'],
    ['àƒ', 'à'],
    ['à»', 'û'],
    ['à®', 'î'],
    ['ââ‚¬¦', '...'],
    ['âÅ“â€¦', '✅']
];

for (const [bad, good] of replacements) {
    // Use global replace
    content = content.split(bad).join(good);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed encoding in ' + filePath);
