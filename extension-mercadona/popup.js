var $ = function (id) { return document.getElementById(id); };
var estado = function (t) { $("estado").textContent = t; };

$("pegar").addEventListener("click", function () {
  navigator.clipboard.readText().then(
    function (t) { $("pedido").value = t; },
    function () { estado("No he podido leer el portapapeles: pégalo a mano."); }
  );
});

$("empezar").addEventListener("click", function () {
  var r = hechoComun.leerPedido($("pedido").value);
  if (r.error) return estado(r.error);
  chrome.storage.local.set(
    { pedido: { estado: "en-curso", i: 0, articulos: r.articulos, resultados: [], intentos: 0 } },
    function () {
      chrome.tabs.create({ url: r.articulos[0].enlace });
      window.close();
    }
  );
});

$("parar").addEventListener("click", function () {
  chrome.storage.local.remove("pedido", function () { estado("Parado."); });
});
