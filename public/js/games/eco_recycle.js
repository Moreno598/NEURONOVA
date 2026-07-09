/* -------------------------------------------------------------
   GAME: ECO RECYCLE (Atención Selectiva)
   ------------------------------------------------------------- */
import { sound } from '../sound.js';

export default class EcoRecycle {
    constructor(canvas, ctx, controller) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.controller = controller;
        this.animationFrameId = null;
        this.trashItems = [
            // Papel / Cartón
            { name: '📄 Periódico', type: 'papel' }, { name: '📦 Caja de Cartón', type: 'papel' }, { name: '📝 Hoja de Cuaderno', type: 'papel' }, { name: '🗞️ Revista Vieja', type: 'papel' },
            { name: '📜 Rollo de Cartón', type: 'papel' }, { name: '🏷️ Etiqueta de Ropa', type: 'papel' }, { name: '✉️ Sobre de Carta', type: 'papel' }, { name: '📇 Tarjeta de Presentación', type: 'papel' },
            { name: '🧾 Recibo de Tienda', type: 'papel' }, { name: '📓 Cuaderno Viejo', type: 'papel' }, { name: '📰 Folleto Publicitario', type: 'papel' }, { name: '🎫 Boleto de Cine', type: 'papel' },
            { name: '📦 Caja de Zapatos', type: 'papel' }, { name: '📦 Cartón de Huevos', type: 'papel' }, { name: '🗞️ Papel de Regalo', type: 'papel' }, { name: '📦 Caja de Cereal', type: 'papel' },
            { name: '📄 Apuntes de Clase', type: 'papel' }, { name: '📜 Papel Kraft', type: 'papel' }, { name: '📖 Libro Roto', type: 'papel' }, { name: '📦 Envase de Cartón', type: 'papel' },
            { name: '🏷️ Caja de Fósforos', type: 'papel' }, { name: '📄 Folleto Turístico', type: 'papel' }, { name: '📦 Empaque de Juguete', type: 'papel' }, { name: '📝 Post-it', type: 'papel' },
            { name: '📦 Caja de Pizza (Limpia)', type: 'papel' }, { name: '📄 Factura de Luz', type: 'papel' }, { name: '📜 Cartulina', type: 'papel' }, { name: '📦 Caja de Envío', type: 'papel' },
            { name: '🗞️ Suplemento Dominical', type: 'papel' }, { name: '📄 Calendario Viejo', type: 'papel' }, { name: '📦 Caja de Galletas', type: 'papel' }, { name: '📝 Dibujo Viejo', type: 'papel' },

            // Plástico
            { name: '🥤 Botella de Agua', type: 'plastico' }, { name: '🛍️ Bolsa de Supermercado', type: 'plastico' }, { name: '🥛 Envase de Yogur', type: 'plastico' },
            { name: '🧴 Bote de Champú', type: 'plastico' }, { name: '🥢 Tenedor de Plástico', type: 'plastico' }, { name: '🥄 Cuchara de Plástico', type: 'plastico' },
            { name: '🥤 Vaso Desechable', type: 'plastico' }, { name: '🥤 Tapa de Refresco', type: 'plastico' }, { name: '🧴 Envase de Crema', type: 'plastico' },
            { name: '🧴 Bote de Detergente', type: 'plastico' }, { name: '🛍️ Envoltura de Dulce', type: 'plastico' }, { name: '🥤 Sorbete/Pajita', type: 'plastico' },
            { name: '🧴 Envase de Jabón', type: 'plastico' }, { name: '🥡 Taper Desechable', type: 'plastico' }, { name: '🧴 Frasco de Pastillas', type: 'plastico' },
            { name: '🛍️ Bolsa de Snacks', type: 'plastico' }, { name: '🥛 Botella de Leche', type: 'plastico' }, { name: '🧴 Envase de Desinfectante', type: 'plastico' },
            { name: '🥢 Cuchillo Desechable', type: 'plastico' }, { name: '🧴 Tubo de Pasta Dental', type: 'plastico' }, { name: '🛍️ Plástico de Burbujas', type: 'plastico' },
            { name: '🥤 Botella de Gaseosa', type: 'plastico' }, { name: '🧴 Bote de Suavizante', type: 'plastico' }, { name: '🛍️ Bolsa de Basura', type: 'plastico' },
            { name: '🥛 Envase de Mantequilla', type: 'plastico' }, { name: '🥤 Vaso de Yogur', type: 'plastico' }, { name: '🧴 Botella de Limpiador', type: 'plastico' },
            { name: '🛍️ Envoltura de Galleta', type: 'plastico' }, { name: '🧴 Envase de Gel', type: 'plastico' }, { name: '🥡 Plato de Plástico', type: 'plastico' },
            { name: '🧴 Envase de Alcohol', type: 'plastico' }, { name: '🛍️ Bolsa Zip', type: 'plastico' }, { name: '🥤 Tapa de Café', type: 'plastico' },

            // Orgánico
            { name: '🍎 Restos de Manzana', type: 'organico' }, { name: '🍌 Cáscara de Plátano', type: 'organico' }, { name: '🥚 Cáscara de Huevo', type: 'organico' },
            { name: '☕ Posos de Café', type: 'organico' }, { name: '🍵 Bolsita de Té', type: 'organico' }, { name: '🍊 Cáscara de Naranja', type: 'organico' },
            { name: '🍗 Huesos de Pollo', type: 'organico' }, { name: '🥬 Restos de Lechuga', type: 'organico' }, { name: '🥕 Piel de Zanahoria', type: 'organico' },
            { name: '🥔 Peladuras de Papa', type: 'organico' }, { name: '🥑 Hueso de Aguacate', type: 'organico' }, { name: '🍉 Corteza de Sandía', type: 'organico' },
            { name: '🍞 Pan Duro', type: 'organico' }, { name: '🧅 Piel de Cebolla', type: 'organico' }, { name: '🍅 Restos de Tomate', type: 'organico' },
            { name: '🥥 Cáscara de Coco', type: 'organico' }, { name: '🥦 Tallos de Brócoli', type: 'organico' }, { name: '🍇 Ramas de Uva', type: 'organico' },
            { name: '🥜 Cáscaras de Maní', type: 'organico' }, { name: '🍋 Cáscara de Limón', type: 'organico' }, { name: '🍂 Hojas Secas', type: 'organico' },
            { name: '🌱 Restos de Césped', type: 'organico' }, { name: '🐟 Espinas de Pescado', type: 'organico' }, { name: '🌾 Restos de Arroz', type: 'organico' },
            { name: '🍖 Restos de Carne', type: 'organico' }, { name: '🥭 Hueso de Mango', type: 'organico' }, { name: '🍍 Corona de Piña', type: 'organico' },
            { name: '🍑 Hueso de Durazno', type: 'organico' }, { name: '🥝 Piel de Kiwi', type: 'organico' }, { name: '🌻 Flores Marchitas', type: 'organico' },
            { name: '🌶️ Tallo de Pimiento', type: 'organico' }, { name: '🍓 Rabos de Fresa', type: 'organico' }, { name: '🥒 Piel de Pepino', type: 'organico' }
        ];
        this.bins = [
            { type: 'papel', color: '#3b82f6', label: 'Papel/Cartón', x: 200, y: 400 },
            { type: 'plastico', color: '#eab308', label: 'Plástico', x: 400, y: 400 },
            { type: 'organico', color: '#22c55e', label: 'Orgánico', x: 600, y: 400 }
        ];
        this.currentTrash = null;
        this.handleClickBound = this.handleClick.bind(this);
        this.particles = [];
    }

    init() {
        this.canvas.addEventListener('mousedown', this.handleClickBound);
        this.spawnTrash();
        this.loop();
    }

    spawnTrash() {
        const item = this.trashItems[Math.floor(Math.random() * this.trashItems.length)];
        this.currentTrash = {
            ...item,
            x: 400,
            y: 150,
            scale: 0
        };
        this.controller.totalStimuli++;
    }

    createParticles(x, y, color) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 1,
                color: color
            });
        }
    }

    handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = 800 / rect.width;
        const scaleY = 500 / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        for (let bin of this.bins) {
            const dist = Math.hypot(x - bin.x, y - bin.y);
            if (dist < 60) {
                if (this.currentTrash.type === bin.type) {
                    this.controller.correctResponses++;
                    this.controller.addScore(15);
                    sound.playSuccess();
                    this.createParticles(bin.x, bin.y - 40, bin.color);
                } else {
                    this.controller.registerError();
                }
                this.spawnTrash();
                break;
            }
        }
    }

    loop() {
        if (!this.controller.isPlaying) return;
        this.ctx.clearRect(0, 0, 800, 500);

        // Draw background subtle gradient removed to show CSS animated background
        // const bgGrad = this.ctx.createLinearGradient(0, 0, 0, 500);
        // bgGrad.addColorStop(0, '#f8fafc');
        // bgGrad.addColorStop(1, '#e2e8f0');
        // this.ctx.fillStyle = bgGrad;
        // this.ctx.fillRect(0, 0, 800, 500);

        // Update & Draw Trash
        if (this.currentTrash) {
            if (this.currentTrash.scale < 1) this.currentTrash.scale += 0.1;
            
            // Difficulty scaling: items fall down faster as gameTime increases
            const fallSpeed = 0.5 + (this.controller.gameTime * 0.04);
            this.currentTrash.y += fallSpeed;

            if (this.currentTrash.y > 550) {
                this.controller.registerError();
                // Optionally play a sound here, but let's just spawn the next one
                this.spawnTrash();
                return;
            }
            
            this.ctx.save();
            this.ctx.translate(this.currentTrash.x, this.currentTrash.y);
            this.ctx.scale(this.currentTrash.scale, this.currentTrash.scale);
            
            this.ctx.fillStyle = '#ffffff';
            this.ctx.shadowColor = 'rgba(0,0,0,0.1)';
            this.ctx.shadowBlur = 15;
            this.ctx.beginPath();
            this.ctx.roundRect(-80, -40, 160, 80, 16);
            this.ctx.fill();
            
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = '#1e293b';
            this.ctx.font = 'bold 22px Outfit';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(this.currentTrash.name, 0, 0);
            
            this.ctx.restore();
        }

        // Draw Bins
        for (let bin of this.bins) {
            this.ctx.save();
            this.ctx.translate(bin.x, bin.y);
            
            // Bin shadow
            this.ctx.fillStyle = 'rgba(0,0,0,0.1)';
            this.ctx.beginPath();
            this.ctx.ellipse(0, 40, 50, 10, 0, 0, Math.PI * 2);
            this.ctx.fill();

            // Bin body
            this.ctx.fillStyle = bin.color;
            this.ctx.beginPath();
            this.ctx.roundRect(-45, -40, 90, 80, 8);
            this.ctx.fill();

            // Bin lid
            this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
            this.ctx.beginPath();
            this.ctx.rect(-50, -40, 100, 15);
            this.ctx.fill();

            // Recycle symbol
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '28px "Font Awesome 6 Free"';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('\uf1b8', 0, 0); // fa-recycle

            // Label
            this.ctx.fillStyle = '#1e293b';
            this.ctx.font = 'bold 16px Outfit';
            this.ctx.fillText(bin.label, 0, 65);
            
            this.ctx.restore();
        }

        // Draw Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.05;
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            
            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 6 * p.life, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.globalAlpha = 1;
        }

        this.ctx.fillStyle = '#64748b';
        this.ctx.font = '18px Outfit';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("Toca el contenedor correcto para la basura", 400, 40);

        this.animationFrameId = requestAnimationFrame(this.loop.bind(this));
    }

    destroy() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.canvas.removeEventListener('mousedown', this.handleClickBound);
    }
}
