# Raumbuchung für ein kleines Büro

Eine REST-API zur Verwaltung von Räumen und Buchungen in einem kleinen Büro.
Sie speichert Räume mit Sitzplätzen und Ausstattungsmerkmalen sowie Buchungen
mit Titel, buchender Person und Zeitraum. Zeiträume werden als halboffene
Intervalle `[start, end)` behandelt, Überschneidungen innerhalb eines Raums
werden erkannt und einheitlich als Fehler gemeldet. Alle Antworten der API sind
JSON; eine Anmeldung gibt es nicht.

## Tech-Stack

- **api**: Python 3.12+ (getestet mit 3.13), FastAPI, Pydantic v2,
  SQLAlchemy 2.0 (declarative ORM), psycopg 3, uvicorn, pytest
- **database**: PostgreSQL (auch in den Tests — kein SQLite)
- **start_contract**: `RUN.json` auf Repo-Ebene startet den Dienst `api` auf
  Port 8000

## Voraussetzungen

- Python 3.12 oder neuer
- Eine erreichbare PostgreSQL-Instanz

## Installation

```bash
cd backend
python -m pip install -r requirements.txt
```

## Datenbank starten

Für die lokale Entwicklung liegt eine `compose.yaml` bei, die dieselbe
PostgreSQL-Version startet. Ein Befehl genügt:

```bash
docker compose up -d
```

Danach ist die Datenbank unter `postgresql://app@localhost:5432/app`
erreichbar.

## Umgebungsvariablen

| Variable | Bedeutung | Standard |
| --- | --- | --- |
| `DATABASE_URL` | Verbindungs-URL zu PostgreSQL (psycopg 3) | `postgresql+psycopg://app@localhost:5432/app` |
| `OFFICE_TIMEZONE` | IANA-Zeitzone für die Berechnung lokaler Tage | `Europe/Berlin` |

Die Werte werden erst bei der ersten Verwendung gelesen. Beim Start wird die
Konfiguration einmal geprüft und das Schema automatisch angelegt — ein leeres
Datenbanksystem funktioniert also sofort, ohne Migration von Hand.

## Starten (Entwicklung)

```bash
cd backend
DATABASE_URL="postgresql+psycopg://app@localhost:5432/app" \
OFFICE_TIMEZONE="Europe/Berlin" \
python -m uvicorn app.main:app --port 8000
```

Die interaktive Dokumentation (OpenAPI) ist anschließend unter
<http://localhost:8000/docs> erreichbar und listet alle registrierten
Endpunkte.

## Tests

Die Tests laufen gegen eine echte PostgreSQL-Instanz (dieselbe `DATABASE_URL`):

```bash
cd backend
DATABASE_URL="postgresql+psycopg://app@localhost:5432/app" PYTHONPATH=. python -m pytest
```

## Endpunkte

| Methode | Pfad | Zustände |
| --- | --- | --- |
| `GET` | `/api/health` | `200` |

Weitere Endpunkte für Räume, Buchungen, die Tagesansicht eines Raums und die
Verfügbarkeitssuche werden von den folgenden Tickets dieser Sprint-Planung
ergänzt.

### `GET /api/health`

Meldet den Dienststatus und die Erreichbarkeit der Datenbank. Antwortet immer
mit `200`; das Feld `database` ist `"ok"` oder `"unreachable"`.

Beispielantwort:

```json
{
  "status": "ok",
  "database": "ok"
}
```

### Einheitliches Fehlerformat

Jede Fehlerantwort hat dieselbe Form. `code` ist einer von
`validation_error`, `not_found`, `conflict` oder `booking_started`; niemals
wird ein einfacher `detail`-String ausgeliefert.

```json
{
  "code": "not_found",
  "message": "Not Found",
  "details": null
}
```

## Funktionen

- Konfiguration über Umgebungsvariablen (`DATABASE_URL`, `OFFICE_TIMEZONE`)
- Automatisches Anlegen des Schemas beim Start (idempotent, ohne Absturz bei
  nicht erreichbarer Datenbank)
- Health-Endpunkt mit Zustand von Dienst und Datenbank
- Einheitliches Fehlerformat für Validierungs-, Nicht-gefunden- und
  Konfliktfehler
- OpenAPI-Dokumentation unter `/docs`
- Testsuite gegen echtes PostgreSQL
