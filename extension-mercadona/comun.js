// Lo que comparten el popup y el script de la página. Sin dependencias.
/* exported hechoComun */
var hechoComun = (function () {
  var MAX_ARTICULOS = 80;

  /** La dirección limpia de un producto de Mercadona (https, su dominio, sin parámetros), o null. */
  function enlaceValido(texto) {
    try {
      var u = new URL(String(texto));
      var propio = u.hostname === "tienda.mercadona.es";
      var ruta = u.pathname.replace(/\/+$/, "");
      if (u.protocol !== "https:" || !propio || ruta === "" || ruta.indexOf("/search-results") === 0) {
        return null;
      }
      return "https://" + u.host + ruta;
    } catch (e) {
      return null;
    }
  }

  /** Lee lo copiado de ¡Hecho!. Devuelve { articulos } o { error }. */
  function leerPedido(texto) {
    var crudo;
    try {
      crudo = JSON.parse(String(texto).trim());
    } catch (e) {
      return { error: "Eso no es un pedido de ¡Hecho!. Cópialo otra vez desde la lista de la compra." };
    }
    if (!crudo || crudo.formato !== "hecho-pedido" || crudo.version !== 1 || !Array.isArray(crudo.articulos)) {
      return { error: "Eso no es un pedido de ¡Hecho!." };
    }
    var articulos = [];
    crudo.articulos.slice(0, MAX_ARTICULOS).forEach(function (a) {
      var enlace = a && enlaceValido(a.enlace);
      if (enlace) articulos.push({ nombre: String(a.nombre || "").slice(0, 80), enlace: enlace });
    });
    if (articulos.length === 0) return { error: "El pedido no trae ningún producto de Mercadona." };
    return { articulos: articulos };
  }

  return { enlaceValido: enlaceValido, leerPedido: leerPedido };
})();
