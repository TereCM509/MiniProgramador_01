// =====================================================================
// Compilador.js — Convierte las piezas del workspace en una cadena para el ESP32
// Etapa 1: LECTOR — lee la pila que empieza en Inicio y revisa lo que sobra
// =====================================================================

// Tolerancia en pixeles para decidir si dos piezas están pegadas (igual que tienePiezaAbajo)
const TOLERANCIA_ACOPLE = 2;

/*
    leerAlgoritmo()
    Propósito: punto de entrada del Lector.
    Recibe: nada (lee directamente el workspace).
    Devuelve: { instrucciones, hayPiezaEncima, sueltas }
      - instrucciones: la pila desde Inicio hacia abajo, traducida a objetos ([] si no hay Inicio)
      - hayPiezaEncima: true si hay al menos una pieza pegada arriba del Inicio
      - sueltas: cuántas piezas no forman parte de la pila (si no hay Inicio, son todas)
*/
function leerAlgoritmo() {
    const piezas = [...workspace.querySelectorAll(":scope > .pieza")];   // Piezas de primer nivel (no las de adentro de un Repetir), como arreglo
    const inicio = piezas.find(p => p.id.startsWith("piezaInicio"));    // El único Inicio (el límite de la bandeja garantiza que hay 0 o 1)

    if (!inicio) {                                                       // Sin Inicio no hay pila principal
        return { instrucciones: [], hayPiezaEncima: false, sueltas: piezas.length }; // Todo cuenta como suelto (decisión de la usuaria)
    }

    const visitadas = new Set(); // Piezas de la pila o encima del Inicio; lo que no esté aquí es suelto

    // 1) Bajar desde el Inicio: esta es la pila que se va a compilar
    const instrucciones = [];                         // Aquí van las instrucciones en orden
    let actual = inicio;                              // Empezamos en el Inicio
    while (actual && !visitadas.has(actual)) {        // Mientras haya pieza y no la hayamos leído (evita ciclos)
        visitadas.add(actual);                        // La marcamos como parte de la pila
        instrucciones.push(leerPieza(actual));        // La traducimos y la agregamos
        actual = piezaDebajo(actual, piezas);         // Pasamos a la de abajo (null si ya no hay)
    }

    // 2) Subir desde el Inicio: marcar las piezas pegadas encima (tienen su propio mensaje)
    actual = piezaArriba(inicio, piezas);             // La pieza justo encima del Inicio (null si no hay)
    const hayPiezaEncima = actual !== null;           // Con una basta para mostrar el mensaje
    while (actual && !visitadas.has(actual)) {        // Subimos mientras siga habiendo piezas pegadas
        visitadas.add(actual);                        // Se marcan para que NO cuenten como sueltas
        actual = piezaArriba(actual, piezas);         // Seguimos subiendo
    }

    // 3) Lo que no se visitó es suelto
    const sueltas = piezas.filter(p => !visitadas.has(p)).length; // Solo se cuentan, no se traducen

    return { instrucciones, hayPiezaEncima, sueltas };
}

/*
    piezaDebajo(piezaArriba, piezas)
    Propósito: encontrar la pieza acoplada justo debajo de otra.
    Recibe: la pieza de arriba y la lista de piezas donde buscar.
    Devuelve: la pieza de abajo, o null si no hay ninguna.
    Por qué así: en el workspace las piezas no están enlazadas en el DOM;
    solo están "pegadas" porque su posición coincide (ver acoplar() en Interacciones.js).
*/
function piezaDebajo(piezaArriba, piezas) {
    return piezas.find(p => estanPegadas(piezaArriba, p)) || null; // La primera que esté pegada debajo; null si ninguna
}

/*
    piezaArriba(piezaAbajo, piezas)
    Propósito: lo contrario de piezaDebajo: encontrar la pieza acoplada justo encima.
    Recibe: la pieza de abajo y la lista de piezas donde buscar.
    Devuelve: la pieza de arriba, o null si no hay ninguna.
*/
function piezaArriba(piezaAbajo, piezas) {
    return piezas.find(p => estanPegadas(p, piezaAbajo)) || null; // La primera que tenga a piezaAbajo pegada debajo; null si ninguna
}

/*
    estanPegadas(arriba, abajo)
    Propósito: decidir si "abajo" está acoplada justo debajo de "arriba".
    Recibe: dos piezas del workspace.
    Devuelve: true si están pegadas, false si no.
    Por qué aparte: piezaDebajo y piezaArriba usan la misma regla; así solo se escribe una vez.
*/
function estanPegadas(arriba, abajo) {
    if (arriba === abajo) return false;                                   // Una pieza no está pegada a sí misma
    const topEsperado = arriba.offsetTop + arriba.offsetHeight;           // Donde debería empezar la de abajo
    const mismoTop = Math.abs(abajo.offsetTop - topEsperado) <= TOLERANCIA_ACOPLE;         // ¿Empieza donde termina la de arriba?
    const mismoLeft = Math.abs(abajo.offsetLeft - arriba.offsetLeft) <= TOLERANCIA_ACOPLE; // ¿Están alineadas a la izquierda?
    return mismoTop && mismoLeft;                                         // Pegadas solo si cumplen ambas
}

/*
    leerPieza(pieza)
    Propósito: traducir UNA pieza del HTML a un objeto sencillo.
    Recibe: el elemento .pieza.
    Devuelve: un objeto con "tipo" y sus valores (null si el campo está vacío).
    Por qué por id: los clones se llaman "piezaTiempo_clon3"; el inicio del id dice el tipo.
*/
function leerPieza(pieza) {
    const id = pieza.id; // Ej. "piezaTiempo_clon3"

    // --- Piezas de ambas misiones ---
    if (id.startsWith("piezaInicio")) return { tipo: "inicio" }; // Inicio no tiene valores
    if (id.startsWith("piezaFin"))    return { tipo: "fin" };    // Fin no tiene valores
    if (id.startsWith("piezaTiempo")) return { tipo: "tiempo", segundos: leerSegundos(pieza) }; // Ya convertido a segundos

    // --- Piezas de la Misión 1 ---
    if (id.startsWith("piezaAntorcha")) {
        return { tipo: "antorcha", lado: leerSelect(pieza) }; // "derecha", "izquierda" o null
    }
    if (id.startsWith("piezaRepetir")) {
        const input = pieza.querySelector(":scope > .repetir-Bsup input");       // Casilla "No.veces" de la barra superior
        const hijas = pieza.querySelectorAll(":scope > .repetir-Cont > .pieza"); // Piezas de adentro, en orden del DOM
        return {
            tipo: "repetir",
            veces: input.value === "" ? null : Number(input.value), // Vacío → null; si no, número
            cuerpo: [...hijas].map(leerPieza)                         // Cada hija se traduce con esta misma función
        };
    }

    // --- Piezas de la Misión 2 ---
    if (id.startsWith("piezaActivarCraneo"))  return { tipo: "craneo" };                           // Sin valores
    if (id.startsWith("piezaMostrarSecreto")) return { tipo: "secreto" };                          // Sin valores
    if (id.startsWith("piezaVentana"))        return { tipo: "ventana", lado: leerSelect(pieza) }; // "derecha", "izquierda" o null

    return { tipo: "desconocida", id }; // Pieza que el Lector no reconoce; el Validador la reportará
}

/*
    leerSelect(pieza)
    Propósito: leer el menú desplegable de una pieza (antorcha o ventana).
    Recibe: la pieza que contiene el <select>.
    Devuelve: el valor elegido, o null si sigue en "Selecciona".
*/
function leerSelect(pieza) {
    const valor = pieza.querySelector("select").value; // "Selecciona" tiene value="" en el HTML
    return valor === "" ? null : valor;                 // "" se guarda como null para que el Validador lo detecte fácil
}

/*
    leerSegundos(piezaTiempo)
    Propósito: leer las casillas Seg y Min y devolver el total en segundos.
    Recibe: la pieza Tiempo.
    Devuelve: número de segundos, o null si ambas casillas están vacías.
    Por qué aquí: acordamos que al ESP32 siempre le llegan segundos (Min=1 → 60).
*/
function leerSegundos(piezaTiempo) {
    const seg = piezaTiempo.querySelector('input[id^="inputTiempoSeg"]').value; // Casilla Seg (su id cambia en cada clon, por eso "empieza con")
    const min = piezaTiempo.querySelector('input[id^="inputTiempoMin"]').value; // Casilla Min

    if (seg !== "") return Number(seg);      // Si llenó Seg, se usa tal cual
    if (min !== "") return Number(min) * 60; // Si llenó Min, se convierte a segundos
    return null;                             // Ninguna llena → null (el Validador avisará)
}
