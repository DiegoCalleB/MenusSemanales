/* Notificaciones de Menús Semanales (D-115). Solo enseña el aviso y abre la app al tocarlo. */
self.addEventListener("push", (evento) => {
  let datos = {};
  try {
    datos = evento.data ? evento.data.json() : {};
  } catch {
    datos = { cuerpo: evento.data ? evento.data.text() : "" };
  }
  const titulo =
    typeof datos.titulo === "string" && datos.titulo
      ? datos.titulo.slice(0, 100)
      : "Menús Semanales";
  const cuerpo = typeof datos.cuerpo === "string" ? datos.cuerpo.slice(0, 300) : "";
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "avisos-diarios",
      data: { url: "/" },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) if ("focus" in v) return v.focus();
      return self.clients.openWindow("/");
    }),
  );
});
