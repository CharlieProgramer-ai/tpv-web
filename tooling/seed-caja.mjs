// Abre la caja y genera ventas de barra variadas para que la pantalla Caja muestre un resumen rico.
const BASE = 'http://localhost:3001';
const j = async (path, opts = {}) => {
  const res = await fetch(BASE + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  let body; const t = await res.text(); try { body = JSON.parse(t); } catch { body = t; }
  return { status: res.status, body };
};

async function main() {
  const login = await j('/api/auth/login', { method: 'POST', body: JSON.stringify({ nombre_usuario: 'admin', 'contraseña': '1234' }) });
  const auth = { Authorization: `Bearer ${login.body.token}` };

  // Abrir caja (ignora si ya está abierta)
  const abrir = await j('/api/caja/abrir', { method: 'POST', headers: auth, body: JSON.stringify({ fondo_inicial: 150 }) });
  console.log('Abrir caja:', abrir.status, JSON.stringify(abrir.body).slice(0, 80));

  const productos = (await j('/api/productos', { headers: auth })).body;
  const categorias = (await j('/api/categorias', { headers: auth })).body;
  const catCocina = new Set(categorias.filter(c => c.para_cocina === 1).map(c => c.id));
  const barra = productos.filter(p => !catCocina.has(p.categoria_id));
  const mesas = (await j('/api/mesas', { headers: auth })).body;
  const mesaId = (n) => mesas.find(m => m.numero === n)?.id;

  const ventas = [
    { mesa: 1, lineas: [{ p: barra[0].id, c: 3 }], metodo: 'efectivo', cid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', cobro: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaab1' },
    { mesa: 3, lineas: [{ p: barra[1] ? barra[1].id : barra[0].id, c: 2 }, { p: barra[2] ? barra[2].id : barra[0].id, c: 2 }], metodo: 'tarjeta', cid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', cobro: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbc1' },
    { mesa: 5, lineas: [{ p: (barra[3] || barra[0]).id, c: 2 }], metodo: 'efectivo', cid: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', cobro: 'cccccccc-cccc-4ccc-8ccc-cccccccccd11' },
  ];

  for (const v of ventas) {
    const mesa_id = mesaId(v.mesa);
    const ped = await j('/api/pedidos', { method: 'POST', headers: auth, body: JSON.stringify({ mesa_id, num_comensales: 2, client_id: v.cid, detalles: v.lineas.map(l => ({ producto_id: l.p, cantidad: l.c, notas: null })) }) });
    const cobro = await j('/api/pedidos/cobrar', { method: 'POST', headers: auth, body: JSON.stringify({ mesa_id, metodo_pago: v.metodo, cobro_client_id: v.cobro }) });
    console.log(`Mesa ${v.mesa}: pedido ${ped.status}, cobro ${cobro.status} ${cobro.status === 200 ? '(' + cobro.body.total + '€ ' + v.metodo + ')' : JSON.stringify(cobro.body).slice(0, 80)}`);
  }

  const hoy = (await j('/api/caja/hoy', { headers: auth })).body;
  console.log(`\nCaja hoy: estado=${hoy.estado_caja} total=${hoy.total}€ efectivo=${hoy.efectivo}€ tarjeta=${hoy.tarjeta}€ pedidos=${hoy.num_pedidos}`);
  console.log('CAJA SEED OK');
}
main().catch(e => { console.error('ERROR', e); process.exit(1); });
