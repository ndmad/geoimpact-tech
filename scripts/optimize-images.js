const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDir = './public/images/raw';
const outputDir = './public/images';

// Créer les dossiers si inexistants
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

fs.readdirSync(inputDir).forEach(file => {
    if (file.match(/\.(jpg|jpeg|png)$/i)) {
        const inputPath = path.join(inputDir, file);
        const outputPath = path.join(outputDir, file.replace(/\.[^.]+$/, '.webp'));
        
        sharp(inputPath)
            .resize(800, 600, { fit: 'inside' })
            .webp({ quality: 80 })
            .toFile(outputPath)
            .then(() => console.log(`✅ Optimisé: ${file} -> ${path.basename(outputPath)}`))
            .catch(err => console.error(`❌ Erreur: ${file}`, err));
    }
});