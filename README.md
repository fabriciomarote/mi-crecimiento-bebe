# Dia de Bebe

App web para registrar el dia a dia del bebe con PostgreSQL.

## Requisitos

- Node.js 20 o superior.
- Una base PostgreSQL.
- Variable de entorno `DATABASE_URL`.

## Desarrollo local

```powershell
npm install
$env:DATABASE_URL="postgres://usuario:password@host:5432/db"
npm start
```

La app queda disponible en:

```txt
http://127.0.0.1:4173
```

## Deploy en Vercel

1. Subir este proyecto a GitHub.
2. Crear/importar el proyecto en Vercel.
3. Configurar la variable de entorno `DATABASE_URL` en Vercel.
4. Deploy.

La API `/api/state` usa PostgreSQL y crea las tablas automaticamente con `schema.sql` si no existen.
No se guardan datos en `localStorage` ni en archivos JSON locales.
Los archivos estaticos de la app estan en `public/`.

## Tablas principales

- `baby_profile`
- `entries`
- `appointments`
- `notification_settings`
- `audit_log`

`audit_log` guarda cada reemplazo de estado para conservar auditoria de cambios.
