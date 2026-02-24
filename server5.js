const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Palos y valores de las cartas
const palos = ['♠', '♥', '♦', '♣'];
const valores = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const colores = {
  '♠': 'black',
  '♣': 'black',
  '♥': 'red',
  '♦': 'red'
};

// Configuración de los 6 POZOS
const pozosConfig = {
  pokino: { nombre: 'POKINO', cartas: 5, premioBase: 50, descripcion: '5 cartas en línea' },
  cuatroEsquinas: { nombre: '4 ESQUINAS', cartas: 4, premioBase: 150, indices: [0, 4, 20, 24] },
  full: { nombre: 'FULL', cartas: 5, premioBase: 200, indices: [5, 6, 7, 8, 9] },
  poker: { nombre: 'POKER', cartas: 4, premioBase: 300, indices: [15, 16, 17, 18] },
  centro: { nombre: 'CENTRO', cartas: 1, premioBase: 250, indices: [12], especial: true, maxCartas: 5 },
  especial: { nombre: 'ESPECIAL', cartas: 25, premioBase: 500, tipo: 'cartonLleno' }
};

// Generar mazo de 52 cartas
function generarMazo() {
  let mazo = [];
  for (let palo of palos) {
    for (let valor of valores) {
      mazo.push({
        palo,
        valor,
        color: colores[palo],
        codigo: palo + valor
      });
    }
  }
  return mazo;
}

// Barajar mazo (Fisher-Yates)
function barajarMazo(mazo) {
  const mazoBarajado = [...mazo];
  for (let i = mazoBarajado.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [mazoBarajado[i], mazoBarajado[j]] = [mazoBarajado[j], mazoBarajado[i]];
  }
  return mazoBarajado;
}

// Generar 13 cartones fijos (CORREGIDO)
function generarCartonesFijos() {
  console.log('🚀 Generando 13 cartones fijos...');
  let cartones = [];
  
  let todasCartas = [];
  for (let palo of palos) {
    for (let valor of valores) {
      todasCartas.push({
        palo,
        valor,
        color: colores[palo],
        codigo: palo + valor
      });
    }
  }
  
  const distribuciones = [
    { poker: 'A', full2: '10', full3: '4' },
    { poker: '2', full2: 'J', full3: '6' },
    { poker: '3', full2: '8', full3: 'K' },
    { poker: '4', full2: 'Q', full3: '5' },
    { poker: '5', full2: '6', full3: 'K' },
    { poker: '6', full2: '9', full3: '7' },
    { poker: '7', full2: '8', full3: '10' },
    { poker: '8', full2: '6', full3: '7' },
    { poker: '9', full2: '2', full3: '10' },
    { poker: '10', full2: '9', full3: '6' },
    { poker: 'J', full2: 'Q', full3: 'K' },
    { poker: 'Q', full2: 'A', full3: 'K' },
    { poker: 'K', full2: '9', full3: '6' }
  ];
  
  for (let numCarton = 1; numCarton <= 13; numCarton++) {
    let poolCartas = JSON.parse(JSON.stringify(todasCartas));
    const dist = distribuciones[numCarton - 1];
    
    const valorPoker = dist.poker;
    const valorFull2 = dist.full2;
    const valorFull3 = dist.full3;

    // Crear las 4 cartas del POKER
    const cartasPoker = palos.map(palo => ({
      palo,
      valor: valorPoker,
      color: colores[palo],
      codigo: palo + valorPoker,
      tipo: 'poker'
    }));

    poolCartas = poolCartas.filter(c => !(c.valor === valorPoker));

    // FULL 2 cartas
    let cartasFull2 = [];
    for (let palo of palos) {
      const carta = poolCartas.find(c => c.valor === valorFull2 && c.palo === palo);
      if (carta && cartasFull2.length < 2) {
        cartasFull2.push({...carta, tipo: 'full'});
        poolCartas = poolCartas.filter(c => !(c.valor === valorFull2 && c.palo === palo));
      }
    }

    // FULL 3 cartas
    let cartasFull3 = [];
    for (let palo of palos) {
      const carta = poolCartas.find(c => c.valor === valorFull3 && c.palo === palo);
      if (carta && cartasFull3.length < 3) {
        cartasFull3.push({...carta, tipo: 'full'});
        poolCartas = poolCartas.filter(c => !(c.valor === valorFull3 && c.palo === palo));
      }
    }

    // Mezclar pool restante
    for (let i = poolCartas.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [poolCartas[i], poolCartas[j]] = [poolCartas[j], poolCartas[i]];
    }

    let cartasCarton = [];

    // Fila 1 (0-4): Aleatorias
    for (let i = 0; i < 5; i++) {
      cartasCarton.push(poolCartas.shift());
    }

    // Fila 2 (5-9): FULL
    cartasCarton.push(...cartasFull2);
    cartasCarton.push(...cartasFull3);

    // Fila 3 (10-14): ESPECIAL
    for (let i = 0; i < 5; i++) {
      cartasCarton.push(poolCartas.shift());
    }

    // Fila 4 (15-19): POKER + 1
    cartasCarton.push(...cartasPoker);
    cartasCarton.push(poolCartas.shift());

    // Fila 5 (20-24): Aleatorias
    for (let i = 0; i < 5; i++) {
      cartasCarton.push(poolCartas.shift());
    }

    // Validar que tenga 25 cartas
    if (cartasCarton.length !== 25) {
      console.error(`❌ Cartón #${numCarton} tiene ${cartasCarton.length} cartas. Regenerando...`);
      numCarton--;
      continue;
    }

    // Mapear tipos de cartas
    cartasCarton = cartasCarton.map((carta, index) => {
      if (index >= 5 && index <= 9) return {...carta, tipo: 'full'};
      if (index >= 15 && index <= 18) return {...carta, tipo: 'poker'};
      if (index >= 10 && index <= 14) return {...carta, tipo: 'especial'};
      if (index === 12) return {...carta, tipo: 'centro'};
      return carta;
    });

    // Crear cartón con TODAS las propiedades necesarias
    cartones.push({
      numero: numCarton,
      nombre: `Cartón ${valorPoker}`,
      valorPoker: valorPoker,
      valorFull2: valorFull2,
      valorFull3: valorFull3,
      dueño: null,
      cartas: cartasCarton, // ✅ IMPORTANTE: Array de 25 cartas
      tapadas: Array(25).fill(false),
      pozos: {
        pokino: false,
        cuatroEsquinas: false,
        full: false,
        poker: false,
        centro: false,
        especial: false
      }
    });
    
    console.log(`✅ Cartón ${numCarton} generado con ${cartasCarton.length} cartas`);
  }
  
  console.log(`✅ Generados ${cartones.length} cartones completos`);
  return cartones;
}

// Estado del juego
const gameState = {
  cartones: generarCartonesFijos(),
  jugadores: {},
  cartasCantadas: [],
  cantador: null,
  faseJuego: 'seleccion',
  ultimaCarta: null,
  solicitudes: [],
  juegoIniciado: false,
  pozosGanados: [],
  mazo: barajarMazo(generarMazo()),
  indiceMazo: 0,
  partidaActual: 1,
  totalPartidas: 6,
  estadisticas: {}
};

// Servir archivos estáticos
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'bingo_poker_v13.html'));
});

io.on('connection', (socket) => {
  console.log('✅ Jugador conectado:', socket.id);
  
  // Enviar estado inicial
  socket.emit('gameState', gameState);
  
  socket.on('registerPlayer', (email, nombre) => {
    console.log(`👤 Jugador registrado: ${nombre} (${email})`);
    
    if (gameState.jugadores[email]) {
      gameState.jugadores[email].socketId = socket.id;
      gameState.jugadores[email].timestamp = Date.now();
      gameState.jugadores[email].desconectado = false;
      socket.emit('reconexionExitosa', {
        mensaje: 'Reconectado. Tu estado se mantuvo.',
        monedas: gameState.jugadores[email].monedas,
        cartones: gameState.jugadores[email].cartones
      });
    } else {
      gameState.jugadores[email] = { 
        nombre, 
        timestamp: Date.now(), 
        socketId: socket.id,
        cartones: [],
        monedas: 40,
        desconectado: false,
        estadisticas: { ganadas: 0, perdidas: 0, pozosGanados: [], historial: [] }
      };
      
      if (!gameState.estadisticas[email]) {
        gameState.estadisticas[email] = {
          nombre, monedas: 40, ganadas: 0, perdidas: 0, pozosGanados: [], historial: []
        };
      }
    }
    
    io.emit('updateJugadores', gameState.jugadores);
    io.emit('updateEstadisticas', gameState.estadisticas);
  });
  
  socket.on('agregarMonedas', (emailJugador, cantidad, emailCantador) => {
    if (gameState.cantador !== emailCantador) {
      socket.emit('error', 'Solo el cantador puede agregar monedas.');
      return;
    }
    
    if (!gameState.jugadores[emailJugador]) {
      socket.emit('error', 'Jugador no encontrado.');
      return;
    }
    
    gameState.jugadores[emailJugador].monedas += cantidad;
    gameState.estadisticas[emailJugador].monedas += cantidad;
    
    io.emit('updateJugadores', gameState.jugadores);
    io.emit('updateEstadisticas', gameState.estadisticas);
    io.emit('monedasAgregadas', {
      jugador: gameState.jugadores[emailJugador].nombre,
      cantidad: cantidad,
      total: gameState.jugadores[emailJugador].monedas
    });
  });
  
  socket.on('seleccionarCarton', (numero, email, nombre) => {
    console.log(`🎴 Intentando seleccionar cartón ${numero} para ${email}`);
    
    if (gameState.faseJuego !== 'seleccion') {
      socket.emit('error', 'La selección está cerrada.');
      return;
    }
    
    const carton = gameState.cartones.find(c => c.numero === numero);
    
    if (!carton) {
      console.log(`❌ Cartón ${numero} no encontrado`);
      socket.emit('error', 'Cartón no encontrado.');
      return;
    }
    
    // Verificar que el cartón tenga cartas
    if (!carton.cartas || !Array.isArray(carton.cartas) || carton.cartas.length !== 25) {
      console.error(`❌ Cartón ${numero} inválido:`, carton);
      socket.emit('error', 'Cartón inválido.');
      return;
    }
    
    if (!carton.dueño || carton.dueño === email) {
      carton.dueño = email;
      
      if (!gameState.jugadores[email].cartones.includes(numero)) {
        gameState.jugadores[email].cartones.push(numero);
      }
      
      gameState.jugadores[email].monedas -= 6;
      gameState.estadisticas[email].monedas -= 6;
      gameState.estadisticas[email].perdidas += 6;
      
      console.log(`✅ Cartón ${numero} asignado a ${email}`);
      console.log(`📊 Cartas del cartón: ${carton.cartas.length}`);
      
      io.emit('updateCartones', gameState.cartones);
      io.emit('updateJugadores', gameState.jugadores);
      io.emit('updateEstadisticas', gameState.estadisticas);
    } else {
      console.log(`❌ Cartón ${numero} ya tiene dueño: ${carton.dueño}`);
      socket.emit('cartonBloqueado', numero);
    }
  });
  
  socket.on('liberarCarton', (numero, email) => {
    if (gameState.faseJuego !== 'seleccion') {
      socket.emit('error', 'La selección está cerrada.');
      return;
    }
    
    const carton = gameState.cartones.find(c => c.numero === numero);
    if (carton && carton.dueño === email) {
      gameState.jugadores[email].monedas += 6;
      gameState.estadisticas[email].monedas += 6;
      gameState.estadisticas[email].perdidas -= 6;
      
      carton.dueño = null;
      gameState.jugadores[email].cartones = gameState.jugadores[email].cartones.filter(n => n !== numero);
      
      io.emit('updateCartones', gameState.cartones);
      io.emit('updateJugadores', gameState.jugadores);
      io.emit('updateEstadisticas', gameState.estadisticas);
    }
  });
  
  socket.on('cantarCartaAleatoria', (email) => {
    if (gameState.cantador !== email) {
      socket.emit('error', 'Solo el cantador puede cantar cartas.');
      return;
    }
    
    if (gameState.faseJuego !== 'jugando') {
      socket.emit('error', 'El juego no ha iniciado.');
      return;
    }
    
    if (gameState.indiceMazo >= gameState.mazo.length) {
      socket.emit('error', 'Se acabaron las cartas.');
      return;
    }
    
    const carta = gameState.mazo[gameState.indiceMazo];
    gameState.indiceMazo++;
    
    gameState.cartasCantadas.push(carta);
    gameState.ultimaCarta = carta;
    
    io.emit('updateCartasCantadas', gameState.cartasCantadas);
    io.emit('updateUltimaCarta', carta);
    io.emit('cartaCantada', { carta, total: gameState.indiceMazo });
    
    console.log(`🃏 Carta #${gameState.indiceMazo}: ${carta.palo}${carta.valor}`);
  });
  
  socket.on('taparCarta', (numeroCarton, indexCasilla, email) => {
    const carton = gameState.cartones.find(c => c.numero === numeroCarton);
    if (carton && carton.dueño === email) {
      carton.tapadas[indexCasilla] = !carton.tapadas[indexCasilla];
      io.emit('updateCartones', gameState.cartones);
    }
  });
  
  socket.on('establecerCantador', (email) => {
    if (gameState.cantador) {
      socket.emit('error', 'Ya hay cantador.');
      return;
    }
    gameState.cantador = email;
    io.emit('updateCantador', email);
    io.emit('updateJugadores', gameState.jugadores);
  });
  
  socket.on('iniciarJuego', (email) => {
    if (gameState.cantador !== email) {
      socket.emit('error', 'Solo el cantador puede iniciar.');
      return;
    }
    
    gameState.faseJuego = 'jugando';
    gameState.juegoIniciado = true;
    io.emit('updateFaseJuego', 'jugando');
    io.emit('juegoIniciado', { mensaje: `¡PARTIDA ${gameState.partidaActual} INICIADA!`, partida: gameState.partidaActual });
  });
  
  socket.on('reclamarPremio', (numeroCarton, pozo, email) => {
    const carton = gameState.cartones.find(c => c.numero === numeroCarton);
    if (!carton || carton.dueño !== email) {
      socket.emit('error', 'No tienes este cartón.');
      return;
    }
    
    if (carton.pozos[pozo]) {
      socket.emit('error', 'Este pozo ya fue reclamado.');
      return;
    }
    
    if (pozo === 'centro') {
      if (gameState.cartasCantadas.length > pozosConfig.centro.maxCartas) {
        socket.emit('error', 'CENTRO debe reclamarse antes de la 6ta carta.');
        return;
      }
      
      const cartaCentro = carton.cartas[12];
      const ultimaCarta = gameState.ultimaCarta;
      if (!ultimaCarta || cartaCentro.valor !== ultimaCarta.valor || cartaCentro.palo !== ultimaCarta.palo) {
        socket.emit('error', 'La carta del CENTRO debe ser la última cantada.');
        return;
      }
    }
    
    const valido = verificarPozo(carton, pozo, gameState.cartasCantadas);
    
    if (valido) {
      io.emit('alertaGanador', {
        carton: numeroCarton,
        pozo: pozosConfig[pozo].nombre,
        jugador: gameState.jugadores[email]?.nombre || email,
        email: email,
        premio: pozosConfig[pozo].premioBase,
        mensaje: `🏆 ¡${gameState.jugadores[email]?.nombre || email} RECLAMA ${pozosConfig[pozo].nombre}!`
      });
    } else {
      socket.emit('error', `${pozosConfig[pozo].nombre} no está completo.`);
    }
  });
  
  socket.on('confirmarPremio', (numeroCarton, pozo, emailGanador, emailCantador) => {
    if (gameState.cantador !== emailCantador) {
      socket.emit('error', 'Solo el cantador puede confirmar.');
      return;
    }
    
    const carton = gameState.cartones.find(c => c.numero === numeroCarton);
    const valido = verificarPozo(carton, pozo, gameState.cartasCantadas);
    
    if (valido) {
      carton.pozos[pozo] = true;
      const premio = pozosConfig[pozo].premioBase;
      
      gameState.pozosGanados.push({ carton: numeroCarton, pozo: pozo, jugador: emailGanador, premio: premio, partida: gameState.partidaActual, timestamp: Date.now() });
      
      if (gameState.jugadores[emailGanador]) {
        gameState.jugadores[emailGanador].monedas += premio / 50;
        gameState.jugadores[emailGanador].estadisticas.ganadas += premio / 50;
      }
      
      if (gameState.estadisticas[emailGanador]) {
        gameState.estadisticas[emailGanador].monedas += premio / 50;
        gameState.estadisticas[emailGanador].ganadas += premio / 50;
      }
      
      io.emit('updateCartones', gameState.cartones);
      io.emit('updateJugadores', gameState.jugadores);
      io.emit('updateEstadisticas', gameState.estadisticas);
      io.emit('premioConfirmado', {
        carton: numeroCarton,
        pozo: pozosConfig[pozo].nombre,
        jugador: gameState.jugadores[emailGanador]?.nombre || emailGanador,
        premio: premio,
        monedas: premio / 50
      });
    } else {
      io.emit('premioRechazado', { carton: numeroCarton, pozo: pozosConfig[pozo].nombre, mensaje: '❌ NO válido' });
    }
  });
  
  socket.on('toggleFaseSeleccion', (email) => {
    if (gameState.cantador !== email) {
      socket.emit('error', 'Solo el cantador.');
      return;
    }
    gameState.faseJuego = gameState.faseJuego === 'seleccion' ? 'jugando' : 'seleccion';
    io.emit('updateFaseJuego', gameState.faseJuego);
  });
  
  socket.on('siguientePartida', (email) => {
    if (gameState.cantador !== email) {
      socket.emit('error', 'Solo el cantador.');
      return;
    }
    
    if (gameState.partidaActual >= gameState.totalPartidas) {
      socket.emit('error', 'Partidas completadas.');
      return;
    }
    
    gameState.cartasCantadas = [];
    gameState.ultimaCarta = null;
    gameState.juegoIniciado = false;
    gameState.faseJuego = 'seleccion';
    gameState.indiceMazo = 0;
    gameState.mazo = barajarMazo(generarMazo());
    
    gameState.cartones.forEach(carton => {
      carton.tapadas = Array(25).fill(false);
      carton.pozos = { pokino: false, cuatroEsquinas: false, full: false, poker: false, centro: false, especial: false };
    });
    
    gameState.partidaActual++;
    io.emit('gameState', gameState);
    io.emit('updateFaseJuego', 'seleccion');
    io.emit('siguientePartida', { partida: gameState.partidaActual });
  });
  
  socket.on('reiniciarJuego', (email) => {
    if (gameState.cantador !== email) {
      socket.emit('error', 'Solo el cantador.');
      return;
    }
    
    gameState.cartasCantadas = [];
    gameState.ultimaCarta = null;
    gameState.juegoIniciado = false;
    gameState.pozosGanados = [];
    gameState.faseJuego = 'seleccion';
    gameState.partidaActual = 1;
    gameState.indiceMazo = 0;
    gameState.mazo = barajarMazo(generarMazo());
    
    gameState.cartones.forEach(carton => {
      carton.tapadas = Array(25).fill(false);
      carton.pozos = { pokino: false, cuatroEsquinas: false, full: false, poker: false, centro: false, especial: false };
    });
    
    io.emit('gameState', gameState);
    io.emit('updateFaseJuego', 'seleccion');
  });
  
  socket.on('solicitarCambio', (email, mensaje) => {
    const solicitud = { id: Date.now(), email, nombre: gameState.jugadores[email]?.nombre || email, mensaje, timestamp: Date.now() };
    gameState.solicitudes.push(solicitud);
    io.emit('updateSolicitudes', gameState.solicitudes);
  });
  
  socket.on('responderSolicitud', (solicitudId, emailCantador, aprobar) => {
    if (gameState.cantador !== emailCantador) {
      socket.emit('error', 'Solo el cantador.');
      return;
    }
    
    const index = gameState.solicitudes.findIndex(s => s.id === solicitudId);
    if (index !== -1) {
      const solicitud = gameState.solicitudes[index];
      if (aprobar) {
        gameState.faseJuego = 'seleccion';
        io.emit('updateFaseJuego', 'seleccion');
      }
      gameState.solicitudes.splice(index, 1);
      io.emit('updateSolicitudes', gameState.solicitudes);
      
      const jugadorSocket = io.sockets.sockets.get(gameState.jugadores[solicitud.email]?.socketId);
      if (jugadorSocket) {
        jugadorSocket.emit('solicitudRespondida', { aprobada: aprobar });
      }
    }
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Jugador desconectado:', socket.id);
    for (const email in gameState.jugadores) {
      if (gameState.jugadores[email].socketId === socket.id) {
        gameState.jugadores[email].desconectado = true;
        break;
      }
    }
  });
});

// Verificar pozo
function verificarPozo(carton, pozo, cartasCantadas) {
  const config = pozosConfig[pozo];
  
  if (pozo === 'pokino') {
    return verificarLineaCompleta(carton, cartasCantadas);
  }
  
  if (pozo === 'centro') {
    if (!carton.tapadas[12]) return false;
    const carta = carton.cartas[12];
    return cartasCantadas.some(c => c.palo === carta.palo && c.valor === carta.valor);
  }
  
  for (let index of config.indices) {
    if (!carton.tapadas[index]) return false;
    const carta = carton.cartas[index];
    const cantada = cartasCantadas.find(c => c.palo === carta.palo && c.valor === carta.valor);
    if (!cantada) return false;
  }
  
  if (pozo === 'especial') {
    // Verificar que las 25 cartas estén tapadas
    for (let i = 0; i < 25; i++) {
      if (!carton.tapadas[i]) return false;
      const carta = carton.cartas[i];
      const cantada = cartasCantadas.find(c => c.palo === carta.palo && c.valor === carta.valor);
      if (!cantada) return false;
  }
  
  return true;
}

// Verificar línea completa para POKINO
function verificarLineaCompleta(carton, cartasCantadas) {
  const lineas = [
    [0, 1, 2, 3, 4], [5, 6, 7, 8, 9], [10, 11, 12, 13, 14], [15, 16, 17, 18, 19], [20, 21, 22, 23, 24],
    [0, 5, 10, 15, 20], [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24],
    [0, 6, 12, 18, 24], [4, 8, 12, 16, 20]
  ];
  
  for (let linea of lineas) {
    let completa = true;
    for (let index of linea) {
      if (!carton.tapadas[index]) { completa = false; break; }
      const carta = carton.cartas[index];
      const cantada = cartasCantadas.find(c => c.palo === carta.palo && c.valor === carta.valor);
      if (!cantada) { completa = false; break; }
    }
    if (completa) return true;
  }
  
  return false;
}

setInterval(() => {
  const ahora = Date.now();
  const emailsAEliminar = [];
  
  for (const email in gameState.jugadores) {
    if (ahora - gameState.jugadores[email].timestamp > 7200000) {
      emailsAEliminar.push(email);
      gameState.cartones.forEach(carton => {
        if (carton.dueño === email) carton.dueño = null;
      });
    }
  }
  
  emailsAEliminar.forEach(email => delete gameState.jugadores[email]);
  
  if (emailsAEliminar.length > 0) {
    io.emit('updateCartones', gameState.cartones);
    io.emit('updateJugadores', gameState.jugadores);
  }
}, 60000);

server.listen(3000, () => {
  console.log('🚀 Servidor en puerto 3000');
  console.log('📡 http://localhost:3000');
  console.log(`📊 13 cartones fijos con 25 cartas cada uno`);
  console.log('🏆 POKINO=5 cartas | CENTRO=1 carta (antes 6ta)');
});