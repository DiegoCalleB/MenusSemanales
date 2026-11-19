// Corre dentro de tienda.mercadona.es, en tu navegador y con tu sesión. Recorre los productos del
// pedido de ¡Hecho!, pulsa «Añadir» en cada uno y al final enseña cuáles se han añadido y cuáles no.
// No lee ni guarda contraseñas ni nada de tu cuenta.
(function () {
  var ESPERA_BOTON = 12000;
  var ESPERA_TRAS_PULSAR = 1500;

  function dormir(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }
  function limpia(url) {
    return hechoComun.enlaceValido(url);
  }

  function visible(el) {
    return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }

  /** El botón «Añadir» (o «Añadir al carro») del producto abierto, o null. */
  function botonAnadir() {
    var raices = [document.querySelector('[role="dialog"]'), document].filter(Boolean);
    for (var i = 0; i < raices.length; i++) {
      var botones = raices[i].querySelectorAll("button");
      for (var j = 0; j < botones.length; j++) {
        var t = (botones[j].textContent || "").replace(/\s+/g, " ").trim();
        if (
          /^a[ñn]adir( al carro| a la cesta)?$/i.test(t) &&
          visible(botones[j]) &&
          !botones[j].disabled
        ) {
          return botones[j];
        }
      }
    }
    return null;
  }

  async function esperarBoton() {
    var fin = Date.now() + ESPERA_BOTON;
    while (Date.now() < fin) {
      var b = botonAnadir();
      if (b) return b;
      await dormir(300);
    }
    return null;
  }

  function guardar(pedido) {
    return chrome.storage.local.set({ pedido: pedido });
  }

  function pintar(pedido, texto, final) {
    var caja = document.getElementById("hecho-extension");
    if (!caja) {
      caja = document.createElement("div");
      caja.id = "hecho-extension";
      caja.setAttribute("role", "status");
      caja.style.cssText =
        "position:fixed;z-index:2147483647;left:12px;bottom:12px;max-width:340px;padding:12px 14px;" +
        "background:#2a1a20;color:#fff;border-radius:14px;font:14px/1.4 system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.35)";
      document.body.appendChild(caja);
    }
    caja.textContent = "";
    var p = document.createElement("div");
    p.style.fontWeight = "700";
    p.textContent = texto;
    caja.appendChild(p);
    if (final) {
      var mal = pedido.resultados.filter(function (r) {
        return !r.ok;
      });
      if (mal.length) {
        var l = document.createElement("div");
        l.textContent =
          "Sin añadir: " +
          mal
            .map(function (r) {
              return r.nombre;
            })
            .join(", ");
        caja.appendChild(l);
      }
    }
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = final ? "Cerrar" : "Parar";
    b.style.cssText = "margin-top:8px;padding:6px 10px;border-radius:8px;border:0;cursor:pointer";
    b.onclick = function () {
      chrome.storage.local.remove("pedido");
      caja.remove();
    };
    caja.appendChild(b);
  }

  async function paso() {
    var datos = await chrome.storage.local.get("pedido");
    var pedido = datos.pedido;
    if (!pedido) return;
    var total = pedido.articulos.length;

    if (pedido.estado === "terminado") {
      var ok = pedido.resultados.filter(function (r) {
        return r.ok;
      }).length;
      return pintar(
        pedido,
        ok + " de " + total + " añadidos a la cesta. Revisa el pedido y paga.",
        true,
      );
    }
    if (pedido.estado !== "en-curso") return;

    var a = pedido.articulos[pedido.i];
    if (!a) {
      pedido.estado = "terminado";
      await guardar(pedido);
      return paso();
    }
    pintar(pedido, "Añadiendo " + (pedido.i + 1) + " de " + total + ": " + a.nombre);

    // Ir a la página del producto (con un tope de intentos para no dar vueltas).
    if (limpia(location.href) !== a.enlace) {
      pedido.intentos = (pedido.intentos || 0) + 1;
      if (pedido.intentos > 2) {
        pedido.resultados.push({ nombre: a.nombre, ok: false });
        pedido.i += 1;
        pedido.intentos = 0;
        await guardar(pedido);
        return paso();
      }
      await guardar(pedido);
      location.href = a.enlace;
      return;
    }

    var boton = await esperarBoton();
    var resultado = false;
    if (boton) {
      boton.click();
      await dormir(ESPERA_TRAS_PULSAR);
      // Tras añadir, el botón «Añadir» suele dejar paso al selector de cantidad.
      resultado = true;
    }
    pedido.resultados.push({ nombre: a.nombre, ok: resultado });
    pedido.i += 1;
    pedido.intentos = 0;
    await guardar(pedido);
    var siguiente = pedido.articulos[pedido.i];
    if (siguiente) {
      location.href = siguiente.enlace;
    } else {
      pedido.estado = "terminado";
      await guardar(pedido);
      return paso();
    }
  }

  paso();
})();
