# Screenshots Capture Guide

This directory contains screenshots of the AuraOS platform. To capture fresh screenshots:

## Prerequisites
- App running locally (`npm run dev` in root, `npm run dev` in `client/`)
- Demo data seeded (`npm run migrate`)
- Browser window at **1440×900** or **1920×1080** resolution

## Screenshot Checklist

### Public Pages
| File | Page | URL | Login Required |
|------|------|-----|----------------|
| `landing-page.png` | Landing Page | `http://localhost:3001/` | No |

### Staff Portal (login required)
| File | Page | URL | User |
|------|------|-----|------|
| `dashboard.png` | Dashboard | `http://localhost:3001/dashboard` | admin@demo-kitchen.local / demo123 |
| `orders.png` | Orders | `http://localhost:3001/orders` | admin@demo-kitchen.local / demo123 |
| `tables.png` | Tables | `http://localhost:3001/tables` | admin@demo-kitchen.local / demo123 |
| `kitchen-display.png` | Kitchen Display | `http://localhost:3001/kitchen` | kitchen@demo-kitchen.local / demo123 |
| `payments.png` | Payments | `http://localhost:3001/payments` | admin@demo-kitchen.local / demo123 |
| `inventory.png` | Inventory | `http://localhost:3001/inventory` | admin@demo-kitchen.local / demo123 |
| `reports.png` | Reports | `http://localhost:3001/reports` | admin@demo-kitchen.local / demo123 |

### Customer-Facing
| File | Page | URL | Login Required |
|------|------|-----|----------------|
| `customer-app.png` | Customer QR Ordering | `http://localhost:3001/customer?slug=demo-kitchen` | No |
| `token-display.png` | Token Display | `http://localhost:3001/token-display?slug=demo-kitchen` | No |

### Superadmin Portal (superadmin login required)
| File | Page | URL | User |
|------|------|-----|------|
| `owner-dashboard.png` | Owner Dashboard | `http://localhost:3001/owner` | Superadmin account |
| `multi-outlet.png` | Multi-Outlet | `http://localhost:3001/multi-outlet` | Superadmin account |
| `monitoring.png` | Monitoring | `http://localhost:3001/owner/monitoring` | Superadmin account |

## Tips
- Capture the **full viewport** without browser chrome
- Use **light theme** (the app uses a light UI)
- Ensure at least **some data** is visible (not all empty states)
- Use **PNG format** for lossless quality
- Keep file sizes under **500 KB** each (use pngquant or similar if needed)