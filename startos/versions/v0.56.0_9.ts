import { VersionInfo } from '@start9labs/start-sdk'

export const v_0_56_0_9 = VersionInfo.of({
  version: '0.56.0:9',
  releaseNotes: {
    en_US:
      'No change to how the node runs. The interface names other packages rely on are now published by the package itself, so the Quai Mining Dashboard imports them instead of keeping its own copy and cannot drift out of step with this one.',
    es_ES:
      'Sin cambios en el funcionamiento del nodo. Los nombres de interfaz de los que dependen otros paquetes ahora los publica el propio paquete, de modo que el Panel de Mineria Quai los importa en lugar de mantener su propia copia y no puede quedar desincronizado.',
    de_DE:
      'Keine Aenderung am Betrieb des Knotens. Die Schnittstellennamen, auf die andere Pakete angewiesen sind, werden jetzt vom Paket selbst veroeffentlicht, sodass das Quai-Mining-Dashboard sie importiert, statt eine eigene Kopie zu pflegen, und nicht mehr aus dem Tritt geraten kann.',
    pl_PL:
      'Bez zmian w dzialaniu wezla. Nazwy interfejsow, na ktorych polegaja inne pakiety, sa teraz publikowane przez sam pakiet, dzieki czemu Panel Kopania Quai importuje je zamiast trzymac wlasna kopie i nie moze sie rozjechac z tym pakietem.',
    fr_FR:
      "Aucun changement dans le fonctionnement du noeud. Les noms d'interface dont dependent les autres paquets sont desormais publies par le paquet lui-meme, de sorte que le tableau de bord de minage Quai les importe au lieu d'en garder sa propre copie et ne peut plus se desynchroniser.",
  },
  migrations: {},
})
