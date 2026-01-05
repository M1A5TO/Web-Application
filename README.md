# M1A5TO (frontend)

Frontend aplikacji **M1A5TO** zbudowany w **React + TypeScript + Vite**.

## Wymagania
- Node.js (LTS)
- npm

## Uruchomienie lokalne
```bash
npm install
npm run dev
```
Domyślnie Vite uruchomi aplikację pod adresem z terminala (zwykle `http://localhost:5173`).

> Jeśli ktoś pobiera projekt pierwszy raz lub po zmianach w zależnościach (np. dodaniu nowej paczki jak `react-icons`), musi wykonać `npm install`.

## Zależności (uwagi dla zespołu)
- UI używa ikon z paczki `react-icons` (instalowanej przez `npm install`).
- Dla powtarzalnych, identycznych instalacji między devami warto commitować plik lock (`package-lock.json`).

## Build (wersja produkcyjna)
```bash
npm run build
npm run preview
```
Artefakty produkcyjne trafiają do katalogu `dist/`.

## Konfiguracja API
Aplikacja komunikuje się z backendem przez `src/api/client.ts`.

Domyślny backend to:
- `https://api.matiko.ovh`

Opcjonalnie możesz nadpisać adres API zmienną środowiskową Vite:

1. Utwórz plik `.env.local` w katalogu projektu:
```env
VITE_API_BASE_URL=https://api.matiko.ovh
```
2. Uruchom ponownie `npm run dev`.

> Uwaga: zmienne środowiskowe Vite muszą zaczynać się od prefiksu `VITE_`.

## Deploy (hosting statyczny)
To jest aplikacja typu SPA. Hosting musi przekierowywać wszystkie ścieżki (np. `/results`, `/listing/:id`) do `index.html`.

Przykładowe ustawienia:
- **Vercel**: framework `Vite`, build command `npm run build`, output `dist`
- **Netlify**: build `npm run build`, publish `dist`, redirect `/* -> /index.html (200)`

## Repozytorium Git
Rekomendowane pliki do repo:
- kod źródłowy `src/`, `public/`, konfiguracje (`package.json`, `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, itd.)

Nie commituj:
- `node_modules/`
- `dist/`
- `.env.local` (zwykle zawiera ustawienia środowiskowe)
