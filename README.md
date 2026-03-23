# Admin Panel

The admin SPA is built from `admin/` and served by the main API at:

- `https://axiomtradepro.org/admin/`

## Environment file

Use `admin/.env`:

```env
VITE_API_URL=
VITE_BASE=/admin/
VITE_DEV_PROXY_TARGET=http://127.0.0.1:3000
```

Notes:
- keep `VITE_API_URL` empty so production requests stay same-origin
- `VITE_DEV_PROXY_TARGET` is only for local `vite` dev server
- `VITE_BASE` and `VITE_API_URL` are read directly from `admin/.env` during build/dev

## Local development

```bash
npm run dev
npm run admin:dev
```

Open `http://localhost:5174/admin/`.

## Production build

```bash
npm run admin:build
```

The built files are served by the main backend from `/admin`.
