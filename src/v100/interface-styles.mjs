/* Shared card and document-level dialog design. Keep both surfaces in sync. */
export const interfaceStyles = `
  .glt-v1-modal,.glt-v1-modal *{box-sizing:border-box}
  .glt-v1-modal{padding:24px;background:rgb(2 6 23 / .68)}
  .glt-v1-dialog{width:min(1080px,100%);max-height:calc(100dvh - 48px);overscroll-behavior:contain;font:14px/1.55 var(--paper-font-body1_-_font-family,system-ui,sans-serif);color:var(--primary-text-color,#172b3a);border-color:var(--divider-color,#cbd5e1)}
  .glt-v1-head{gap:16px;padding:16px 20px;min-height:64px}
  .glt-v1-head>b{font-size:18px;line-height:1.35;overflow-wrap:anywhere}
  .glt-v1-body{padding:20px;min-width:0;overflow-x:auto}
  .glt-v1-close,.glt-v1-btn{min-height:44px;min-width:44px;font-size:14px;line-height:1.4;padding:10px 14px;border-color:var(--divider-color,#cbd5e1);touch-action:manipulation}
  .glt-v1-close{font-size:20px;flex-shrink:0}
  .glt-v1-btn:hover:not(:disabled),.glt-v1-close:hover{background:color-mix(in srgb,var(--primary-color,#0284c7) 12%,transparent)}
  .glt-v1-btn.primary:hover:not(:disabled){background:#076aa5}
  .glt-v1-btn:disabled{cursor:wait;opacity:.65}
  .glt-v1-modal :focus-visible,.glt-v1-toolbar :focus-visible{outline:3px solid var(--primary-color,#0284c7);outline-offset:3px}
  .glt-v1-actions{gap:10px;align-items:center}
  .glt-v1-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:16px}
  .glt-v1-card{padding:16px;border-radius:12px;min-width:0;border-color:var(--divider-color,#cbd5e1)}
  .glt-v1-card b{font-size:15px;line-height:1.4;overflow-wrap:anywhere}
  .glt-v1-card small,.glt-v1-label{font-size:13px;line-height:1.5;color:var(--secondary-text-color,#526579)}
  .glt-v1-card .glt-v1-actions{margin-top:12px}
  .glt-v1-table{font-size:14px;line-height:1.5}
  .glt-v1-table th,.glt-v1-table td{padding:12px;overflow-wrap:anywhere}
  .glt-v1-table th{font-weight:650;background:color-mix(in srgb,var(--primary-color,#0284c7) 6%,var(--card-background-color,#fff))}
  .glt-v1-table tbody tr:hover{background:color-mix(in srgb,var(--primary-color,#0284c7) 5%,transparent)}
  .glt-v1-input,.glt-v1-select,.glt-v1-text{box-sizing:border-box;min-height:44px;font:inherit;font-size:16px;padding:10px 12px;max-width:100%}
  .glt-v1-actions>.glt-v1-input,.glt-v1-actions>.glt-v1-select{flex:1 1 200px;width:auto;min-width:0}
  .glt-v1-toolbar{gap:8px;padding:10px;align-items:center}
  .glt-v1-toolbar button{height:auto;min-height:44px;font-size:13px;padding:8px 12px}
  .glt-v1-loading{display:flex;align-items:center;gap:12px;min-height:120px;color:var(--secondary-text-color,#526579)}
  .glt-v1-loading::before{content:"";width:20px;height:20px;flex-shrink:0;border:2px solid var(--divider-color,#cbd5e1);border-top-color:var(--primary-color,#0284c7);border-radius:50%;animation:glt-loading .8s linear infinite}
  @keyframes glt-loading{to{transform:rotate(360deg)}}
  @media(max-width:600px){
    .glt-v1-modal{padding:8px;padding-bottom:max(8px,env(safe-area-inset-bottom))}
    .glt-v1-dialog{max-height:calc(100dvh - 24px);border-radius:12px}
    .glt-v1-head,.glt-v1-body{padding:12px}
    .glt-v1-grid{gap:12px}
    .glt-v1-table th,.glt-v1-table td{padding:8px}
    .glt-v1-minimap{display:none}
  }
  @media(prefers-reduced-motion:reduce){.glt-v1-loading::before{animation:none}}
`;

export const workspaceStyles = `
  .glt-header{gap:16px;flex-wrap:wrap}
  .glt-heading,.glt-heading>div{min-width:0}
  .glt-heading h2{overflow-wrap:anywhere;white-space:normal}
  .glt-toolbar{position:relative;z-index:70;gap:12px;flex-wrap:wrap}
  .glt-view-switch{min-width:0;max-width:100%;flex-wrap:wrap;gap:6px}
  .glt-view-switch button,.glt-tool-btn{min-height:44px;min-width:44px;font-size:13px}
  .glt-kpi-strip{gap:10px;flex-wrap:wrap}
  .glt-kpi{min-width:0;flex:1 1 150px;padding:12px}
  .glt-kpi small{font-size:12px;white-space:normal;overflow-wrap:anywhere}
  .glt-kpi strong{font-size:20px;font-variant-numeric:tabular-nums}
  .glt-menu-panel{max-width:calc(100vw - 32px);max-height:70dvh;overflow-y:auto;overscroll-behavior:contain}
  .glt-menu-item{min-height:44px;font-size:14px}
  .glt-menu-title{font-size:12px}
  .dt,.vb,.bottom{height:auto;min-height:44px;flex-wrap:wrap;gap:8px}
  .tools,.views,.seg{flex-wrap:wrap;min-width:0;gap:6px}
  .mini{min-width:44px;min-height:44px}
  .tb,.tab,.act{height:auto;min-height:44px;font-size:13px}
  .f label,.st,.grp,.help,.bottom,.notice{font-size:12px;line-height:1.5}
  .f input,.f select,.search input{min-height:44px;font-size:16px;min-width:0;max-width:100%}
  .pi{font-size:12px;min-height:76px}
  .left,.right,.center{min-width:0}
  @media(max-width:700px){
    .work{grid-template-columns:minmax(0,1fr)}
    .left,.right{grid-column:1/-1;border:0;border-bottom:1px solid var(--b,#294154)}
    .pal{max-height:210px}
    .pg{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}
    .center{min-height:420px}
    .insp{max-height:none}
    .stage{padding:8px}
    .glt-header{padding:14px}
    .glt-toolbar{padding:10px}
    .glt-heading h2{font-size:18px}
  }
  @media(prefers-reduced-motion:reduce){.path,.glt-flow-line,.glt-sym *{animation:none!important}}
`;
