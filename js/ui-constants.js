export const LVM_CAT_COLORS = { voyageur: '#3b82f6', fret: '#22c55e', travaux: '#f59e0b', machine: '#a855f7' };

export const LVM_CAT_LABELS = { voyageur: 'Voyageur', fret: 'Fret', travaux: 'Travaux', machine: 'Machine' };

export const LVM_CAT_ICONS = { voyageur: 'img/livemap/train_voyageur.png', fret: 'img/livemap/train_fret.png', travaux: 'img/livemap/train_travaux.png', machine: 'img/livemap/train_generic.png' };

export const IG_IMAGE_LAYOUTS = {
  'sncf-dep': {
    file: 'img/infogare/AFL-DP.png',
    width: 1100, height: 610,
    bg: '#0b1836',
    header: { bg: '#fff', color: '#000' },
    headerFields: [
      { type: 'clock', x: 4, y: 5, w: 12, h: 6, color: '#000', bg: '#fff', fontSize: 20, align: 'left' },
      { type: 'station', x: 25, y: 5, w: 50, h: 6, color: '#000', bg: '#fff', fontSize: 18, align: 'center', weight: 700 },
      { type: 'static', x: 88, y: 5, w: 10, h: 6, text: 'SNCF', color: '#c00', bg: '#fff', fontSize: 14, align: 'center', style: 'font-style:italic;font-weight:900' }
    ],
    blocks: [
      { y: 25.9, h: 19.2, viaY: 33.9, viaH: 5.6, remarkY: 40.8, remarkH: 4.3, time: {x:4,w:10}, type:{x:15,w:8}, num:{x:15,yOff:2.5,w:10}, dest:{x:30,w:35}, via:{x:30,w:55}, status:{x:70,w:26}, remark:{x:30,w:55} },
      { y: 52.3, h: 13.4, viaY: 60.3, viaH: 5.4, time: {x:4,w:10}, type:{x:15,w:8}, num:{x:15,yOff:2.5,w:10}, dest:{x:30,w:35}, via:{x:30,w:55}, status:{x:70,w:26} },
      { y: 78.0, h: 13.3, viaY: 85.9, viaH: 5.4, time: {x:4,w:10}, type:{x:15,w:8}, num:{x:15,yOff:2.5,w:10}, dest:{x:30,w:35}, via:{x:30,w:55}, status:{x:70,w:26} }
    ]
  },
  'sncf-arr': {
    file: 'img/infogare/AFL-AR.png',
    width: 1100, height: 621,
    bg: '#0b2e12',
    header: { bg: '#fff', color: '#000' },
    headerFields: [
      { type: 'clock', x: 4, y: 5, w: 12, h: 6, color: '#000', bg: '#fff', fontSize: 20, align: 'left' },
      { type: 'station', x: 25, y: 5, w: 50, h: 6, color: '#000', bg: '#fff', fontSize: 18, align: 'center', weight: 700 },
      { type: 'static', x: 88, y: 5, w: 10, h: 6, text: 'SNCF', color: '#c00', bg: '#fff', fontSize: 14, align: 'center', style: 'font-style:italic;font-weight:900' }
    ],
    blocks: [
      { y: 23.8, h: 12.4, viaY: 31.9, viaH: 4.3, time: {x:4,w:10}, type:{x:15,w:8}, num:{x:15,yOff:2.5,w:10}, provenance:{x:30,w:35}, via:{x:30,w:55}, status:{x:70,w:16}, voie:{x:88,w:9} },
      { y: 40.9, h: 14.5, viaY: 49.8, viaH: 5.6, time: {x:4,w:10}, type:{x:15,w:8}, num:{x:15,yOff:2.5,w:10}, provenance:{x:30,w:35}, via:{x:30,w:55}, status:{x:70,w:16}, voie:{x:88,w:9} },
      { y: 59.9, h: 12.1, viaY: 67.6, viaH: 4.4, time: {x:4,w:10}, type:{x:15,w:8}, num:{x:15,yOff:2.5,w:10}, provenance:{x:30,w:35}, via:{x:30,w:55}, status:{x:70,w:16}, voie:{x:88,w:9} },
      { y: 77.8, h: 11.9, viaY: 85.5, viaH: 4.2, time: {x:4,w:10}, type:{x:15,w:8}, num:{x:15,yOff:2.5,w:10}, provenance:{x:30,w:35}, via:{x:30,w:55}, status:{x:70,w:16}, voie:{x:88,w:9} }
    ]
  },
  'cati-ar': {
    file: 'img/infogare/CATI-AR.png',
    width: 1100, height: 611,
    bg: '#0b2e12',
    headerFields: [
      { type: 'station', x: 0, y: 0, w: 100, h: 10, color: '#fff', bg: '#0b2e12', fontSize: 16, align: 'left', weight: 700 },
      { type: 'clock', x: 86, y: 91, w: 12, h: 7, color: '#fff', bg: '#1e40af', fontSize: 16, align: 'center', weight: 700 }
    ],
    blocks: [
      { y: 5, h: 15.5, viaY: 12.5, viaH: 7.5, status:{x:9,w:14,h:7.5}, time: {x:24,w:12,h:7.5}, provenance:{x:38,w:45,h:7.5}, via:{x:9,w:74,h:7.5} },
      { y: 20.5, h: 15.5, viaY: 28, viaH: 7.5, status:{x:9,w:14,h:7.5}, time: {x:24,w:12,h:7.5}, provenance:{x:38,w:45,h:7.5}, via:{x:9,w:74,h:7.5} },
      { y: 36, h: 15.5, viaY: 43.5, viaH: 7.5, status:{x:9,w:14,h:7.5}, time: {x:24,w:12,h:7.5}, provenance:{x:38,w:45,h:7.5}, via:{x:9,w:74,h:7.5} },
      { y: 51.5, h: 15.5, viaY: 59, viaH: 7.5, status:{x:9,w:14,h:7.5}, time: {x:24,w:12,h:7.5}, provenance:{x:38,w:45,h:7.5}, via:{x:9,w:74,h:7.5} },
      { y: 67, h: 15.5, viaY: 74.5, viaH: 7.5, status:{x:9,w:14,h:7.5}, time: {x:24,w:12,h:7.5}, provenance:{x:38,w:45,h:7.5}, via:{x:9,w:74,h:7.5} },
      { y: 81.5, h: 13.5, viaY: 86, viaH: 7.5, status:{x:9,w:14,h:6.5}, time: {x:24,w:12,h:6.5}, provenance:{x:38,w:45,h:6.5}, via:{x:9,w:74,h:6.5} }
    ]
  },
  'cati-3-3': {
    file: 'img/infogare/CATI-3-3.png',
    width: 250, height: 138,
    bg: '#0b1836',
    headerFields: [
      { type: 'station', x: 0, y: 0, w: 100, h: 11, color: '#fff', bg: '#0b1836', fontSize: 8, align: 'left', weight: 700 },
      { type: 'clock', x: 86, y: 91, w: 13, h: 7, color: '#fbbf24', bg: '#0b1836', fontSize: 8, align: 'center', weight: 700 }
    ],
    blocks: [
      { y: 12, h: 13, viaY: 19, viaH: 6, type: {x:0,w:10,h:3.5,fontSize:5}, num: {x:0,yOff:3.5,w:10,h:3.5,fontSize:5}, status: {x:10,w:10,h:7,fontSize:5}, time: {x:20,w:10,h:7,fontSize:8}, dest: {x:30,w:40,h:7,fontSize:7}, via: {x:0,w:70,h:6,fontSize:5}, voie: {x:80,w:10,yOff:7,h:6,bg:'#fff',color:'#003366',fontSize:7,align:'center',weight:900} },
      { y: 25, h: 13, viaY: 32, viaH: 6, type: {x:0,w:10,h:3.5,fontSize:5}, num: {x:0,yOff:3.5,w:10,h:3.5,fontSize:5}, status: {x:10,w:10,h:7,fontSize:5}, time: {x:20,w:10,h:7,fontSize:8}, dest: {x:30,w:40,h:7,fontSize:7}, via: {x:0,w:70,h:6,fontSize:5}, voie: {x:80,w:10,yOff:7,h:6,bg:'#fff',color:'#003366',fontSize:7,align:'center',weight:900} },
      { y: 38, h: 13, viaY: 45, viaH: 6, type: {x:0,w:10,h:3.5,fontSize:5}, num: {x:0,yOff:3.5,w:10,h:3.5,fontSize:5}, status: {x:10,w:10,h:7,fontSize:5}, time: {x:20,w:10,h:7,fontSize:8}, dest: {x:30,w:40,h:7,fontSize:7}, via: {x:0,w:70,h:6,fontSize:5}, voie: {x:80,w:10,yOff:7,h:6,bg:'#fff',color:'#003366',fontSize:7,align:'center',weight:900} },
      { y: 51, h: 13, viaY: 58, viaH: 6, type: {x:0,w:10,h:3.5,fontSize:5}, num: {x:0,yOff:3.5,w:10,h:3.5,fontSize:5}, status: {x:10,w:10,h:7,fontSize:5}, time: {x:20,w:10,h:7,fontSize:8}, dest: {x:30,w:40,h:7,fontSize:7}, via: {x:0,w:70,h:6,fontSize:5}, voie: {x:80,w:10,yOff:7,h:6,bg:'#fff',color:'#003366',fontSize:7,align:'center',weight:900} },
      { y: 64, h: 13, viaY: 71, viaH: 6, type: {x:0,w:10,h:3.5,fontSize:5}, num: {x:0,yOff:3.5,w:10,h:3.5,fontSize:5}, status: {x:10,w:10,h:7,fontSize:5}, time: {x:20,w:10,h:7,fontSize:8}, dest: {x:30,w:40,h:7,fontSize:7}, via: {x:0,w:70,h:6,fontSize:5}, voie: {x:80,w:10,yOff:7,h:6,bg:'#fff',color:'#003366',fontSize:7,align:'center',weight:900} },
      { y: 77, h: 13, viaY: 84, viaH: 6, type: {x:0,w:10,h:3.5,fontSize:5}, num: {x:0,yOff:3.5,w:10,h:3.5,fontSize:5}, status: {x:10,w:10,h:7,fontSize:5}, time: {x:20,w:10,h:7,fontSize:8}, dest: {x:30,w:40,h:7,fontSize:7}, via: {x:0,w:70,h:6,fontSize:5}, voie: {x:80,w:10,yOff:7,h:6,bg:'#fff',color:'#003366',fontSize:7,align:'center',weight:900} }
    ]
  },
  'cati-complet': {
    file: 'img/infogare/CATI-COMPLET.png',
    width: 250, height: 137,
    bg: '#0b1836',
    headerFields: [
      { type: 'station', x: 0, y: 0, w: 100, h: 11, color: '#fff', bg: '#0b1836', fontSize: 8, align: 'left', weight: 700 },
      { type: 'clock', x: 86, y: 91, w: 13, h: 7, color: '#fbbf24', bg: '#0b1836', fontSize: 8, align: 'center', weight: 700 }
    ],
    blocks: [
      { y: 12, h: 14, viaY: 17, viaH: 5, type: {x:5,w:15,h:5,fontSize:5}, num: {x:5,yOff:5,w:15,h:5,fontSize:5}, time: {x:20,w:10,h:5,fontSize:6}, dest: {x:32,w:38,h:5,fontSize:5}, via: {x:5,w:65,h:5,fontSize:5}, voie: {x:82,w:10,h:5,bg:'#fff',color:'#003366',fontSize:6,align:'center',weight:900} },
      { y: 26, h: 14, viaY: 31, viaH: 5, type: {x:5,w:15,h:5,fontSize:5}, num: {x:5,yOff:5,w:15,h:5,fontSize:5}, time: {x:20,w:10,h:5,fontSize:6}, dest: {x:32,w:38,h:5,fontSize:5}, via: {x:5,w:65,h:5,fontSize:5}, voie: {x:82,w:10,h:5,bg:'#fff',color:'#003366',fontSize:6,align:'center',weight:900} },
      { y: 40, h: 14, viaY: 45, viaH: 5, type: {x:5,w:15,h:5,fontSize:5}, num: {x:5,yOff:5,w:15,h:5,fontSize:5}, time: {x:20,w:10,h:5,fontSize:6}, dest: {x:32,w:38,h:5,fontSize:5}, via: {x:5,w:65,h:5,fontSize:5}, voie: {x:82,w:10,h:5,bg:'#fff',color:'#003366',fontSize:6,align:'center',weight:900} },
      { y: 54, h: 14, viaY: 59, viaH: 5, type: {x:5,w:15,h:5,fontSize:5}, num: {x:5,yOff:5,w:15,h:5,fontSize:5}, time: {x:20,w:10,h:5,fontSize:6}, dest: {x:32,w:38,h:5,fontSize:5}, via: {x:5,w:65,h:5,fontSize:5}, voie: {x:82,w:10,h:5,bg:'#fff',color:'#003366',fontSize:6,align:'center',weight:900} },
      { y: 68, h: 14, viaY: 73, viaH: 5, type: {x:5,w:15,h:5,fontSize:5}, num: {x:5,yOff:5,w:15,h:5,fontSize:5}, time: {x:20,w:10,h:5,fontSize:6}, dest: {x:32,w:38,h:5,fontSize:5}, via: {x:5,w:65,h:5,fontSize:5}, voie: {x:82,w:10,h:5,bg:'#fff',color:'#003366',fontSize:6,align:'center',weight:900} }
    ]
  }
};

export const PAGE_PARENT = {};

export const PAGE_GROUPS = [];
