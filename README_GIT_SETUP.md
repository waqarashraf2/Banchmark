# Banchmark - GitHub Setup Guide

This repository contains a full-stack application with Laravel backend and React frontend.

## Project Structure
```
backend/     - Laravel API backend
frontend/    - React TypeScript frontend
```

## Security Notes
- ✅ `.env` files are excluded from Git (.gitignore configured)
- ✅ `vendor/` and `node_modules/` are excluded
- ✅ Sensitive files and logs are not tracked

## Setup After Cloning

### Backend Setup
```bash
cd backend
cp .env.example .env
composer install
php artisan key:generate
php artisan migrate
php artisan serve
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Git Configuration
Repository: git@github.com:waqarashraf2/Banchmark.git
