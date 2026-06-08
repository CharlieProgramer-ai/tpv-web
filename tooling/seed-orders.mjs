// Siembra de pedidos realistas en la instancia DEMO del TPV (puerto 3001, DB temporal).
// Idempotente: usa client_id estables, re-ejecutable sin duplicar.
const BASE = 'http://localhost:3001';

const j = async (path, opts = {}) => {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
};

// UUIDs válidos y estables (idempotencia sin duplicar en re-ejecución)
const UUIDS = {
  m2: '11111111-1111-4111-8111-111111111111',
  m4: '22222222-2222-4222-8222-222222222222',
  m6: '33333333-3333-4333-8333-333333333333',
  m8: '44444444-4444-4444-8444-444444444444',
  'm10-barra': '55555555-5555-4555-8555-555555555555',
  'cobro-m10': '66666666-6666-4666-8666-666666666666',
};
const cid = (s) => UUIDS[s];

async function main() {
  // 1. Login
  const login = await j('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ nombre_usuario: 'admin', 'contraseña': '1234' }),
  });
  if (login.status !== 200) { console.error('LOGIN FALLO', login.status, login.body); process.exit(1); }
  const token = login.body.token;
  const auth = { Authorization: `Bearer ${token}` };
  console.log('Login OK, rol', login.body.rol);

  // 2. Productos, categorias, mesas
  const productos = (await j('/api/productos', { headers: auth })).body;
  const categorias = (await j('/api/categorias', { headers: auth })).body;
  const mesas = (await j('/api/mesas', { headers: auth })).body;
  const catCocina = new Set(categorias.filter(c => c.para_cocina === 1).map(c => c.id));
  const cocina = productos.filter(p => catCocina.has(p.categoria_id));
  const barra = productos.filter(p => !catCocina.has(p.categoria_id));
  console.log(`Productos: ${productos.length} (cocina ${cocina.length}, barra ${barra.length}), mesas ${mesas.length}`);

  const pid = (arr, nombreInc) => {
    const f = arr.find(p => p.nombre.toLowerCase().includes(nombreInc.toLowerCase()));
    return f ? f.id : arr[0].id;
  };
  const mesaId = (numero) => { const m = mesas.find(x => x.numero === numero); return m ? m.id : mesas[0].id; };

  // 3. Pedidos realistas con NOTAS por linea (muestra la funcionalidad estrella)
  const pedidos = [
    { mesa: 2, comensales: 2, detalles: [
      { p: pid(cocina, 'ensalada'), c: 1, n: 'Sin cebolla' },
      { p: pid(cocina, 'filete'), c: 1, n: 'Muy hecho' },
      { p: pid(barra, 'agua'), c: 2, n: null },
    ]},
    { mesa: 4, comensales: 4, detalles: [
      { p: pid(cocina, 'croquetas') || cocina[0].id, c: 2, n: 'Una ración sin gluten' },
      { p: pid(cocina, 'pollo') , c: 1, n: 'Sin salsa' },
      { p: pid(barra, 'vino'), c: 1, n: null },
    ]},
    { mesa: 6, comensales: 3, detalles: [
      { p: cocina[0].id, c: 1, n: 'Para compartir' },
      { p: pid(cocina, 'tiramisu') || cocina[cocina.length-1].id, c: 2, n: null },
    ]},
    { mesa: 8, comensales: 2, detalles: [
      { p: pid(cocina, 'pasta') || cocina[1].id, c: 2, n: 'Poco picante' },
    ]},
  ];

  const creados = [];
  for (const ped of pedidos) {
    const r = await j('/api/pedidos', {
      method: 'POST', headers: auth,
      body: JSON.stringify({
        mesa_id: mesaId(ped.mesa),
        num_comensales: ped.comensales,
        client_id: cid('m' + ped.mesa),
        detalles: ped.detalles.map(d => ({ producto_id: d.p, cantidad: d.c, notas: d.n })),
      }),
    });
    if (r.status === 201) { creados.push({ mesa: ped.mesa, id: r.body.id }); console.log(`Pedido mesa ${ped.mesa} -> id ${r.body.id}`); }
    else console.log(`Mesa ${ped.mesa}: status ${r.status}`, JSON.stringify(r.body).slice(0, 120));
  }

  // 4. Mover algunos a "en_preparacion" para que el KDS muestre tickets activos
  for (const c of creados.slice(0, 2)) {
    const r = await j('/api/pedidos/' + c.id, { method: 'PUT', headers: auth, body: JSON.stringify({ estado: 'en_preparacion' }) });
    console.log(`Mesa ${c.mesa} -> en_preparacion: ${r.status}`);
  }

  // 5. Una mesa solo de barra (bebidas) y cobrarla -> la Caja muestra una venta
  const mesaBarra = mesaId(10);
  const rb = await j('/api/pedidos', {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      mesa_id: mesaBarra, num_comensales: 2, client_id: cid('m10-barra'),
      detalles: [
        { producto_id: barra[0].id, cantidad: 2, notas: null },
        { producto_id: (barra[1] || barra[0]).id, cantidad: 1, notas: null },
      ],
    }),
  });
  if (rb.status === 201) {
    const cobro = await j('/api/pedidos/cobrar', {
      method: 'POST', headers: auth,
      body: JSON.stringify({ mesa_id: mesaBarra, metodo_pago: 'tarjeta', cobro_client_id: cid('cobro-m10') }),
    });
    console.log('Cobro mesa 10:', cobro.status, JSON.stringify(cobro.body).slice(0, 140));
  } else {
    console.log('Pedido barra mesa 10:', rb.status, JSON.stringify(rb.body).slice(0, 120));
  }

  // 6. Estado final del plano
  const mesasFin = (await j('/api/mesas', { headers: auth })).body;
  const ocupadas = mesasFin.filter(m => m.estado === 'ocupada').length;
  console.log(`\nEstado final: ${ocupadas} mesas ocupadas de ${mesasFin.length}`);
  console.log('SEED OK');
}

main().catch(e => { console.error('ERROR', e); process.exit(1); });
