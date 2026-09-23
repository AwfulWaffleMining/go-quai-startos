import { VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.56.0:10',
  releaseNotes: {
    en_US:
      'Removes the Pool Tag setting, which stopped workshares from being rewarded. With a tag set, this node produced no on-chain workshares for six hours at 51 TH/s, where one an hour was expected — while its own counters looked perfect: 1,905 valid shares, none stale, none invalid, and a best share within 3% of the target. Clearing the tag and restarting, rewards resumed within the hour. A cosmetic label on your coinbase is not worth a setting that can silently cost you everything you mine, so it is gone rather than documented. Nothing else changes; an existing tag is ignored.',
    es_ES:
      'Elimina el ajuste Pool Tag, que impedia que las participaciones se recompensaran. Con una etiqueta puesta, este nodo no produjo ninguna participacion en cadena durante seis horas a 51 TH/s, cuando se esperaba una por hora, mientras sus propios contadores parecian perfectos: 1.905 participaciones validas, ninguna obsoleta ni invalida. Al quitar la etiqueta y reiniciar, las recompensas volvieron en una hora. Una etiqueta decorativa no vale un ajuste que puede costarte en silencio todo lo que minas.',
    de_DE:
      'Entfernt die Einstellung Pool Tag, die verhinderte, dass Arbeitsanteile belohnt wurden. Mit gesetztem Tag erzeugte dieser Knoten sechs Stunden lang bei 51 TH/s keinen einzigen Arbeitsanteil in der Kette, erwartet war etwa einer pro Stunde - waehrend die eigenen Zaehler einwandfrei aussahen: 1.905 gueltige Anteile, keine veralteten, keine ungueltigen. Nach dem Entfernen und Neustart kamen die Belohnungen binnen einer Stunde zurueck. Ein kosmetisches Etikett ist keine Einstellung wert, die still alles kosten kann, was man schuerft.',
    pl_PL:
      'Usuwa ustawienie Pool Tag, ktore uniemozliwialo nagradzanie udzialow. Z ustawionym tagiem ten wezel przez szesc godzin przy 51 TH/s nie wyprodukowal zadnego udzialu w lancuchu, choc oczekiwano okolo jednego na godzine - podczas gdy wlasne liczniki wygladaly bez zarzutu: 1905 poprawnych udzialow, zero przestarzalych i niepoprawnych. Po usunieciu tagu i restarcie nagrody wrocily w ciagu godziny. Kosmetyczna etykieta nie jest warta ustawienia, ktore po cichu moze kosztowac wszystko, co wykopiesz.',
    fr_FR:
      "Supprime le reglage Pool Tag, qui empechait les parts de travail d'etre recompensees. Avec une etiquette definie, ce noeud n'a produit aucune part sur la chaine pendant six heures a 51 TH/s, alors qu'on en attendait environ une par heure - tandis que ses propres compteurs semblaient parfaits : 1 905 parts valides, aucune obsolete, aucune invalide. Apres suppression et redemarrage, les recompenses sont revenues en moins d'une heure. Une etiquette cosmetique ne vaut pas un reglage qui peut vous couter en silence tout ce que vous minez.",
  },
  migrations: {},
})
