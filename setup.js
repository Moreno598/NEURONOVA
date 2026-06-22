const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
const filesToMove = ['index.html', 'index.css', 'insignia.png', 'js', 'assets'];

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

filesToMove.forEach(file => {
    const oldPath = path.join(__dirname, file);
    const newPath = path.join(publicDir, file);
    if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        console.log(`Moved ${file} to public/`);
    }
});

console.log('Setup complete. Run "npm install" and then "npm start".');
