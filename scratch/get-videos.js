const https = require('https');

function searchYouTube(label, query) {
    const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
    https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const match = data.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
            if (match) {
                console.log(`[${label}] -> ${match[1]}`);
            } else {
                console.log(`[${label}] -> NOT FOUND`);
            }
        });
    }).on('error', err => console.error(err));
}

// Kids (6-11 años) - simples, animados, cortos
searchYouTube('KIDS-tdah',     'que es el tdah para niños animado español');
searchYouTube('KIDS-study',    'tecnicas de estudio para niños primaria español animado');
searchYouTube('KIDS-time',     'organizacion del tiempo para niños español');
searchYouTube('KIDS-emotions', 'manejo de emociones para niños español animado');
searchYouTube('KIDS-habits',   'habitos saludables para niños español animado');

// Teens (12-17 años) - más profundos pero accesibles
searchYouTube('TEEN-tdah',     'que es el tdah adolescentes español');
searchYouTube('TEEN-study',    'tecnicas de estudio para adolescentes español');
searchYouTube('TEEN-time',     'como organizar el tiempo adolescentes español');
searchYouTube('TEEN-emotions', 'inteligencia emocional adolescentes español');
searchYouTube('TEEN-habits',   'habitos saludables adolescentes español');
