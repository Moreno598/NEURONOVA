/* -------------------------------------------------------------
   NEUROSPARK DASHBOARD ENGINE (SVG Graphs & Cognitive Reports)
   ------------------------------------------------------------- */

import { coach } from './neurocoach.js';
import { i18n } from './i18n.js';

class DashboardRenderer {
    constructor() {}

    render(mountElement, appState) {
        const history      = appState.history || [];
        const fullReport   = coach.generateFullClinicalReport(appState);
        const totalSessions = history.length;
        const totalPoints   = appState.coins;

        const avgAtt  = fullReport.metrics.attention;
        const avgCtrl = fullReport.metrics.impulseControl;
        const avgMem  = fullReport.metrics.workingMemory;
        const avgOrg  = fullReport.metrics.organization;

        const locale = i18n.currentLang === 'en' ? 'en-US' : 'es-ES';

        mountElement.innerHTML = `
            <div class="adults-dashboard">
                <div class="planner-header">
                    <h2>${i18n.t('dashTitle')}</h2>
                    <button class="play-btn" id="btn-export-report" style="background:var(--primary-purple);">
                        <i class="fa-solid fa-file-pdf"></i> ${i18n.t('dashExport')}
                    </button>
                </div>

                <!-- Summary Stats -->
                <div class="dashboard-summary-cards">
                    <div class="stat-card">
                        <div class="stat-icon bg-kids"><i class="fa-solid fa-gamepad"></i></div>
                        <div class="stat-info">
                            <span class="stat-value">${totalSessions}</span>
                            <span class="stat-label">${i18n.t('statSessions')}</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon bg-teens"><i class="fa-solid fa-clock"></i></div>
                        <div class="stat-info">
                            <span class="stat-value">${fullReport.totalMinutes} min</span>
                            <span class="stat-label">${i18n.t('statTime')}</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon bg-adults" style="background:linear-gradient(135deg,#f59e0b,#d97706);">
                            <i class="fa-solid fa-gem"></i>
                        </div>
                        <div class="stat-info">
                            <span class="stat-value">${totalPoints}</span>
                            <span class="stat-label">${i18n.t('statCoins')}</span>
                        </div>
                    </div>
                </div>

                <!-- Charts & Analytics -->
                <div class="dashboard-charts-grid">
                    <div class="chart-card">
                        <h3>${i18n.t('chartCognitive', { name: appState.activeProfileName })}</h3>
                        <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:15px;">${i18n.t('chartSub')}</p>
                        <div class="radar-container" style="display:flex;justify-content:center;align-items:center;">
                            ${this.generateRadarSVG(avgAtt, avgCtrl, avgMem, avgOrg)}
                        </div>
                    </div>

                    <div class="recommendations-panel">
                        <h3>${i18n.t('diagTitle')}</h3>
                        <div class="rec-item rec-alert" style="border-left-color:var(--primary-purple);">
                            <strong>${i18n.t('diagSuspect')}</strong>
                            <p style="margin-top:4px;font-weight:700;color:var(--primary-purple);">${fullReport.subtypeSuspect}</p>
                        </div>

                        <h3>${i18n.t('recTitle')}</h3>
                        <div class="rec-item">
                            <strong>${i18n.t('recFor')}</strong>
                            <p style="margin-top:4px;font-size:0.85rem;">${fullReport.recommendation}</p>
                        </div>
                    </div>
                </div>

                <!-- Session History -->
                <div class="chart-card">
                    <h3>${i18n.t('histTitle')}</h3>
                    <div style="overflow-x:auto;margin-top:15px;">
                        <table class="history-table" style="width:100%;border-collapse:collapse;text-align:left;font-size:0.9rem;">
                            <thead>
                                <tr style="border-bottom:2px solid var(--border-color);color:var(--text-muted);">
                                    <th style="padding:10px;">${i18n.t('histDate')}</th>
                                    <th style="padding:10px;">${i18n.t('histGame')}</th>
                                    <th style="padding:10px;">${i18n.t('histDiff')}</th>
                                    <th style="padding:10px;">${i18n.t('histCoins')}</th>
                                    <th style="padding:10px;">${i18n.t('histAtt')}</th>
                                    <th style="padding:10px;">${i18n.t('histControl')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${history.length === 0
                                    ? `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">${i18n.t('histEmpty')}</td></tr>`
                                    : history.slice(-5).reverse().map(s => `
                                        <tr style="border-bottom:1px solid var(--border-color);">
                                            <td style="padding:12px 10px;">${new Date(s.timestamp).toLocaleDateString(locale)}</td>
                                            <td style="padding:12px 10px;font-weight:600;">${s.gameName}</td>
                                            <td style="padding:12px 10px;"><span class="difficulty-badge diff-${s.difficulty}">${s.difficulty.toUpperCase()}</span></td>
                                            <td style="padding:12px 10px;color:var(--accent-yellow);"><i class="fa-solid fa-coins"></i> ${s.score}</td>
                                            <td style="padding:12px 10px;font-weight:700;color:var(--primary-blue);">${s.metrics.attention}%</td>
                                            <td style="padding:12px 10px;font-weight:700;color:var(--primary-purple);">${s.metrics.impulseControl}%</td>
                                        </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>`;

        document.getElementById('btn-export-report').addEventListener('click', () => {
            this.exportReport(appState, fullReport);
        });
    }

    generateRadarSVG(att, ctrl, mem, org) {
        const sv = v => (v / 100) * 80;
        const pAtt  = { x: 100, y: 100 - sv(att)  };
        const pCtrl = { x: 100 + sv(ctrl), y: 100  };
        const pMem  = { x: 100, y: 100 + sv(mem)   };
        const pOrg  = { x: 100 - sv(org), y: 100   };

        const L = i18n.t.bind(i18n);

        return `
            <svg viewBox="0 0 200 200" class="radar-graph-svg">
                <circle cx="100" cy="100" r="80" fill="none" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="3,3"/>
                <circle cx="100" cy="100" r="60" fill="none" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="3,3"/>
                <circle cx="100" cy="100" r="40" fill="none" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="3,3"/>
                <circle cx="100" cy="100" r="20" fill="none" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="3,3"/>
                <line x1="100" y1="20"  x2="100" y2="180" stroke="var(--border-color)" stroke-width="1"/>
                <line x1="20"  y1="100" x2="180" y2="100" stroke="var(--border-color)" stroke-width="1"/>
                <text x="100" y="15"   fill="var(--primary-blue)"   font-size="7" font-weight="700" text-anchor="middle">${L('radarAtt')} (${att}%)</text>
                <text x="185" y="102"  fill="var(--primary-purple)" font-size="7" font-weight="700" text-anchor="start">${L('radarCtrl')} (${ctrl}%)</text>
                <text x="100" y="195"  fill="var(--accent-yellow)"  font-size="7" font-weight="700" text-anchor="middle">${L('radarMem')} (${mem}%)</text>
                <text x="15"  y="102"  fill="var(--primary-green)"  font-size="7" font-weight="700" text-anchor="end">${L('radarOrg')} (${org}%)</text>
                <polygon points="${pAtt.x},${pAtt.y} ${pCtrl.x},${pCtrl.y} ${pMem.x},${pMem.y} ${pOrg.x},${pOrg.y}"
                    fill="rgba(167,139,250,0.3)" stroke="var(--primary-purple)" stroke-width="2.5"/>
                <circle cx="${pAtt.x}"  cy="${pAtt.y}"  r="3.5" fill="var(--primary-blue)"/>
                <circle cx="${pCtrl.x}" cy="${pCtrl.y}" r="3.5" fill="var(--primary-purple)"/>
                <circle cx="${pMem.x}"  cy="${pMem.y}"  r="3.5" fill="var(--accent-yellow)"/>
                <circle cx="${pOrg.x}"  cy="${pOrg.y}"  r="3.5" fill="var(--primary-green)"/>
            </svg>`;
    }

    exportReport(state, report) {
        const T = (k, v) => i18n.t(k, v);
        const win = window.open('', '_blank');
        win.document.write(`
            <html><head>
            <title>NeuroSpark Report — ${report.profileName}</title>
            <meta charset="UTF-8">
            <style>
                body{font-family:'Segoe UI',Tahoma,sans-serif;color:#1e293b;padding:40px;line-height:1.6;}
                .header{border-bottom:3px solid #7c3aed;padding-bottom:20px;margin-bottom:30px;display:flex;justify-content:space-between;align-items:center;}
                .logo{font-size:24px;font-weight:800;color:#7c3aed;}
                .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px;margin-bottom:30px;}
                .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;}
                h2,h3{color:#1e1b4b;}
                .metric-val{font-size:32px;font-weight:800;color:#2563eb;}
                .metric-name{font-size:14px;color:#64748b;font-weight:bold;}
                .rec-bubble{background:#f5f3ff;border-left:6px solid #7c3aed;padding:20px;border-radius:4px;margin-bottom:30px;}
                .print-btn{background:#7c3aed;color:white;padding:12px 24px;border:none;border-radius:6px;font-size:16px;font-weight:bold;cursor:pointer;display:block;margin:20px auto;}
                @media print{.print-btn{display:none;}}
            </style>
            </head><body>
            <div class="header">
                <div class="logo">🧬 NeuroSpark AI</div>
                <div>${T('histDate')}: ${report.date}</div>
            </div>
            <h2>${T('reportTitle')}</h2>
            <p>${T('reportIntro')}</p>
            <div class="card" style="margin-bottom:25px;">
                <h3>${T('reportStudent')}</h3>
                <p><strong>${T('reportName')}</strong> ${report.profileName}</p>
                <p><strong>${T('reportLevel')}</strong> ${report.ageMode}</p>
                <p><strong>${T('reportSessions')}</strong> ${report.totalSessions}</p>
                <p><strong>${T('reportTime')}</strong> ${report.totalMinutes} min</p>
            </div>
            <h3>${T('reportMetrics')}</h3>
            <div class="grid">
                <div class="card">
                    <div class="metric-val">${report.metrics.attention}%</div>
                    <div class="metric-name">${T('metricAtt')}</div>
                    <p style="font-size:13px;color:#64748b;">${T('reportAttDesc')}</p>
                </div>
                <div class="card">
                    <div class="metric-val">${report.metrics.impulseControl}%</div>
                    <div class="metric-name">${T('metricImpulse')}</div>
                    <p style="font-size:13px;color:#64748b;">${T('reportCtrlDesc')}</p>
                </div>
                <div class="card">
                    <div class="metric-val">${report.metrics.workingMemory}%</div>
                    <div class="metric-name">${T('radarMem')}</div>
                    <p style="font-size:13px;color:#64748b;">${T('reportMemDesc')}</p>
                </div>
                <div class="card">
                    <div class="metric-val">${report.metrics.organization}%</div>
                    <div class="metric-name">${T('radarOrg')}</div>
                    <p style="font-size:13px;color:#64748b;">${T('reportOrgDesc')}</p>
                </div>
            </div>
            <div class="rec-bubble">
                <h3>${T('reportDiagTitle')}</h3>
                <p><strong>${T('reportDiagLabel')}</strong> ${report.subtypeSuspect}</p>
                <p style="margin-top:10px;"><strong>${T('reportRecLabel')}</strong> ${report.recommendation}</p>
            </div>
            <p style="font-size:12px;color:#94a3b8;text-align:center;margin-top:50px;">${T('reportDisclaimer')}</p>
            <button class="print-btn" onclick="window.print()">${T('reportPrint')}</button>
            </body></html>`);
        win.document.close();
    }
}

export const dashboard = new DashboardRenderer();
